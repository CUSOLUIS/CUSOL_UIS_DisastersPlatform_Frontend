import { Platform } from "react-native";
import {
  UpstreamOutageError,
  isRetryableStatus,
  retryOnUpstreamOutage,
} from "../reporting/retryOnUpstreamOutage";
import {
  ReportRejectedError,
  createIdempotencyKey,
  extractProblem,
  type SubmitReportOptions,
} from "../missing-persons/reportSubmission";
import { searchAddressCandidates } from "../missing-persons/geocoding";
import type { DamagedHomeDraft, DamagedHomeReceipt } from "./types";

// CHG-162 — Alta del informe de hogar en malas condiciones: JSON con
// Idempotency-Key en todos los intentos y reintento acotado durante
// ventanas de despliegue (CHG-101). La cookie de sesión (si existe)
// asocia la cuenta; sin sesión el informe sigue siendo anónimo.

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
  };

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

  const attempt = async (): Promise<Response> => {
    const attemptResponse = await fetch(
      `${requestBaseUrl}/api/v1/damaged-homes`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: serializedPayload,
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
