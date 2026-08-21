import { Platform } from "react-native";
import {
  UpstreamOutageError,
  isRetryableStatus,
  retryOnUpstreamOutage,
} from "../reporting/retryOnUpstreamOutage";
import {
  ReportRejectedError,
  appendPhoto,
  createIdempotencyKey,
  extractProblem,
  type SubmitReportOptions,
} from "../missing-persons/reportSubmission";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import { searchAddressCandidates } from "../missing-persons/geocoding";
import type { DamagedHomeDraft, DamagedHomeReceipt } from "./types";

// CHG-182 — Alta de «Mi casita destruida» (antes «Mi casita partida»,
// CHG-162). Solo con cuenta: la cookie de sesión viaja siempre y el
// backend responde 401 sin ella. Con
// Idempotency-Key en todos los intentos y reintento acotado durante
// ventanas de despliegue (CHG-101). La cookie de sesión (si existe)
// asocia la publicación a su dueña, que es quien recibirá los avisos
// de los comentarios.
//
// F2: con fotografías del daño el envío es multipart (parte `payload`
// + partes `photos`, como los demás reportes con evidencia); sin
// fotografías se mantiene el JSON suelto que ya aceptaba el backend.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type DamagedHomePayload = Record<string, string | number>;

export function buildDamagedHomePayload(
  draft: DamagedHomeDraft,
): DamagedHomePayload {
  const payload: DamagedHomePayload = {
    description: draft.description.trim(),
    municipality: draft.municipality.trim(),
    department: draft.department.trim(),
    address: draft.address.trim(),
    // CHG-182: cuántas personas viven en la casa.
    householdSize: Number.parseInt(draft.householdSize.trim(), 10),
  };

  // CHG-182: el medio de ayuda viaja completo o no viaja: un canal sin
  // referencia no sirve para transferirle a nadie (el backend lo
  // rechaza igual).
  const reference = draft.donationReference.trim();
  if (draft.donationChannel && reference) {
    payload.donationChannel = draft.donationChannel;
    payload.donationReference = reference;
  }

  // CHG-201: el vídeo es opcional; vacío significa que no hay, así que
  // el campo no viaja (el backend prohíbe campos desconocidos, pero un
  // null explícito solo añadiría ruido).
  const video = draft.videoUrl.trim();
  if (video) {
    payload.videoUrl = video;
  }

  // Las coordenadas viajan solo en pareja (regla del contrato).
  const latitude = Number.parseFloat(draft.latitude.trim());
  const longitude = Number.parseFloat(draft.longitude.trim());
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.latitude = latitude;
    payload.longitude = longitude;
  }

  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  401: "Para publicar tu casita necesitas iniciar sesión.",
  413: "Las fotografías superan el máximo permitido. Quita alguna e intenta de nuevo.",
  415: "Alguna fotografía no pudo procesarse. Prueba con otra imagen.",
  422: "La API rechazó el informe por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de informes no está disponible en este momento. Intenta más tarde.",
};

// CHG-132 (patrón): si la persona escribió solo la dirección sin fijar
// el punto, las coordenadas se resuelven aquí solas — mejor esfuerzo;
// sin geocodificador el informe viaja igual solo con la dirección.
export async function resolveDraftCoordinates(
  draft: DamagedHomeDraft,
  geocodeAddress: typeof searchAddressCandidates,
): Promise<DamagedHomeDraft> {
  const hasCoordinates =
    Number.isFinite(Number.parseFloat(draft.latitude.trim())) &&
    Number.isFinite(Number.parseFloat(draft.longitude.trim()));
  const address = draft.address.trim();
  const municipality = draft.municipality.trim();
  if (hasCoordinates || !address) {
    return draft;
  }
  try {
    const query = municipality
      ? `${address}, ${municipality}, Colombia`
      : `${address}, Colombia`;
    const [candidate] = await geocodeAddress(query);
    if (!candidate) {
      return draft;
    }
    return {
      ...draft,
      latitude: candidate.latitude.toFixed(5),
      longitude: candidate.longitude.toFixed(5),
    };
  } catch {
    return draft;
  }
}

export async function submitDamagedHomeReport(
  draft: DamagedHomeDraft,
  photos: SelectedPhoto[] = [],
  options: SubmitReportOptions & {
    geocodeAddress?: typeof searchAddressCandidates;
  } = {},
): Promise<DamagedHomeReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar el informe desde un dispositivo móvil.",
    );
  }

  const resolvedDraft = await resolveDraftCoordinates(
    draft,
    options.geocodeAddress ?? searchAddressCandidates,
  );
  const serializedPayload = JSON.stringify(
    buildDamagedHomePayload(resolvedDraft),
  );
  // La misma llave en todos los intentos: reintentar es seguro porque
  // el backend devuelve la constancia ya creada en vez de duplicarla.
  const idempotencyKey = options.idempotencyKey ?? createIdempotencyKey();

  // El cuerpo se arma dentro del intento: un FormData ya enviado no se
  // puede reutilizar de forma fiable en un reintento.
  const attempt = async (): Promise<Response> => {
    let body: FormData | string = serializedPayload;
    // Sin fotos el envío sigue siendo JSON; con ellas, multipart —y el
    // navegador escribe el `Content-Type` con su frontera.
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
    };
    if (photos.length > 0) {
      const form = new FormData();
      if (Platform.OS === "web") {
        form.append(
          "payload",
          new Blob([serializedPayload], { type: "application/json" }),
        );
      } else {
        form.append("payload", serializedPayload);
      }
      for (const photo of photos) {
        await appendPhoto(form, photo);
      }
      body = form;
    } else {
      headers["Content-Type"] = "application/json";
    }

    const attemptResponse = await fetch(
      `${requestBaseUrl}/api/v1/damaged-homes`,
      {
        method: "POST",
        credentials: "include",
        headers,
        body,
        signal: options.signal,
      },
    );

    if (isRetryableStatus(attemptResponse.status)) {
      throw new UpstreamOutageError(
        attemptResponse.status,
        ERROR_MESSAGES_BY_STATUS[attemptResponse.status] ??
          `El envío del informe respondió con estado ${attemptResponse.status}.`,
      );
    }

    return attemptResponse;
  };

  const response = await retryOnUpstreamOutage(attempt, {
    signal: options.signal,
    delaysMs: options.retryDelaysMs,
    wait: options.wait,
    onRetry: options.onRetry,
  });

  if (!response.ok) {
    const problem = await extractProblem(response);
    throw new ReportRejectedError(
      problem.detail ??
        ERROR_MESSAGES_BY_STATUS[response.status] ??
        `El envío del informe respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as DamagedHomeReceipt;
  if (!receipt.id || !receipt.createdAt) {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
