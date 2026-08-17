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
import type { HelpRequestDraft, HelpRequestReceipt } from "./types";

// CHG-125 — Envío de la solicitud «Necesitamos ayuda»: mismo canal que
// los demás reportes ciudadanos (multipart con `payload` + `photos`,
// Idempotency-Key en todos los intentos y reintento acotado durante
// ventanas de despliegue, CHG-101). La cookie de sesión (si existe)
// asocia la cuenta; sin sesión la solicitud sigue siendo anónima.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type HelpRequestPayload = Record<string, string | number>;

export function buildHelpRequestPayload(
  draft: HelpRequestDraft,
): HelpRequestPayload {
  // CHG-130: el contrato viaja siempre en horas; los días se
  // convierten aquí (el backend valida 1-720 igualmente).
  const durationValue = Number.parseInt(draft.durationValue.trim(), 10);
  const payload: HelpRequestPayload = {
    description: draft.description.trim(),
    address: draft.address.trim(),
    durationHours:
      draft.durationUnit === "days" ? durationValue * 24 : durationValue,
  };

  const latitude = Number.parseFloat(draft.latitude.trim());
  const longitude = Number.parseFloat(draft.longitude.trim());
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.latitude = latitude;
    payload.longitude = longitude;
    // CHG-131: el radio de aviso solo tiene sentido con coordenadas;
    // sin punto en el mapa se omite (el backend lo rechazaría).
    const radius = Number.parseInt(draft.notificationRadiusKm.trim(), 10);
    if (Number.isFinite(radius)) {
      payload.notificationRadiusKm = radius;
    }
  }

  // CHG-136: aquí NO viaja la instantánea del reportante
  // (reporterLatitude/reporterLongitude). Ese patrón es del reporte de
  // persona (CHG-066, cifrado para super_admin); la solicitud de ayuda
  // es pública por diseño (DEC-125-12), su backend rechaza campos
  // desconocidos, y desde la auto-ubicación (CHG-130) casi siempre
  // había instantánea: por eso el envío moría con 422 «latitud,
  // longitud del reportante» — un campo que el formulario ni pide.

  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  413: "El servidor rechazó el envío por su tamaño. Intenta con una fotografía más liviana.",
  415: "La fotografía tiene un formato no permitido. Usa JPEG, PNG, WebP o HEIC.",
  422: "La API rechazó la solicitud por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de solicitudes no está disponible en este momento. Intenta más tarde.",
};

// CHG-132: si la persona escribió solo la dirección (sin fijar punto),
// las coordenadas se resuelven aquí solas a partir de ese texto — a
// nadie se le piden latitudes. Mejor esfuerzo: si el geocodificador no
// responde o no encuentra nada, la solicitud viaja igual solo con la
// dirección (CHG-127).
export async function resolveDraftCoordinates(
  draft: HelpRequestDraft,
  geocodeAddress: typeof searchAddressCandidates,
): Promise<HelpRequestDraft> {
  const hasCoordinates =
    Number.isFinite(Number.parseFloat(draft.latitude.trim())) &&
    Number.isFinite(Number.parseFloat(draft.longitude.trim()));
  const address = draft.address.trim();
  if (hasCoordinates || !address) {
    return draft;
  }
  try {
    const [candidate] = await geocodeAddress(`${address}, Colombia`);
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

export async function submitHelpRequest(
  draft: HelpRequestDraft,
  photos: SelectedPhoto[],
  options: SubmitReportOptions & {
    geocodeAddress?: typeof searchAddressCandidates;
  } = {},
): Promise<HelpRequestReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar la solicitud desde un dispositivo móvil.",
    );
  }

  const resolvedDraft = await resolveDraftCoordinates(
    draft,
    options.geocodeAddress ?? searchAddressCandidates,
  );
  const serializedPayload = JSON.stringify(
    buildHelpRequestPayload(resolvedDraft),
  );
  // La misma llave en todos los intentos: reintentar es seguro porque
  // el backend devuelve la constancia ya creada en vez de duplicarla.
  const idempotencyKey = options.idempotencyKey ?? createIdempotencyKey();

  const attempt = async (): Promise<Response> => {
    const body = new FormData();
    if (Platform.OS === "web") {
      body.append(
        "payload",
        new Blob([serializedPayload], { type: "application/json" }),
      );
    } else {
      body.append("payload", serializedPayload);
    }
    for (const photo of photos) {
      await appendPhoto(body, photo);
    }

    const attemptResponse = await fetch(`${requestBaseUrl}/api/v1/help-requests`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body,
      signal: options.signal,
    });

    if (isRetryableStatus(attemptResponse.status)) {
      throw new UpstreamOutageError(
        attemptResponse.status,
        ERROR_MESSAGES_BY_STATUS[attemptResponse.status] ??
          `El envío de la solicitud respondió con estado ${attemptResponse.status}.`,
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
        `El envío de la solicitud respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as HelpRequestReceipt;
  if (!receipt.publicCode || receipt.status !== "active" || !receipt.expiresAt) {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
