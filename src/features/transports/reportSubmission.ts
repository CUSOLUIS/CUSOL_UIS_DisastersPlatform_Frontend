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
import { fetchParentCandidates } from "../aid-locations/reportSubmission";
import type {
  AidLocationKind,
  AidLocationParentCandidate,
} from "../aid-locations/types";
import {
  normalizePlate,
  type ActiveTransport,
  type TransportDraft,
  type TransportJourneyReceipt,
  type TransportKind,
  type TransportReceipt,
  type TransportSide,
} from "./types";

// CHG-161 — Alta de un transporte humanitario. SOLO con sesión (la
// cookie viaja con `credentials: "include"`; sin ella el gateway
// responde 401 y el formulario nunca debió llegar aquí). JSON con
// Idempotency-Key en todos los intentos y reintento acotado durante
// ventanas de despliegue (CHG-101).

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type TransportPayload = Record<string, string>;

export function buildTransportPayload(
  kind: TransportKind,
  draft: TransportDraft,
): TransportPayload {
  const payload: TransportPayload = {
    kind,
    originMunicipality: draft.originMunicipality.trim(),
    destinationMunicipality: draft.destinationMunicipality.trim(),
    originLocationId: draft.originLocationId.trim(),
    destinationLocationId: draft.destinationLocationId.trim(),
    // CHG-171: conductor y tractocamión (validación espejo backend).
    driverFullName: draft.driverFullName.trim(),
    driverDocumentType: draft.driverDocumentType,
    driverDocumentNumber: draft.driverDocumentNumber.trim(),
    driverPhone: draft.driverPhone.trim(),
    tractorPlate: normalizePlate(draft.tractorPlate),
    trailerPlate: normalizePlate(draft.trailerPlate),
    vehicleVisibleCharacteristics:
      draft.vehicleVisibleCharacteristics.trim(),
  };
  const suppliesSummary = draft.suppliesSummary.trim();
  if (suppliesSummary) payload.suppliesSummary = suppliesSummary;
  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  401: "Tu sesión no está activa. Inicia sesión de nuevo para registrar el transporte.",
  422: "La API rechazó el registro por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de registro no está disponible en este momento. Intenta más tarde.",
};

export async function submitTransport(
  kind: TransportKind,
  draft: TransportDraft,
  options: SubmitReportOptions = {},
): Promise<TransportReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para registrar el transporte desde un dispositivo móvil.",
    );
  }

  const serializedPayload = JSON.stringify(buildTransportPayload(kind, draft));
  // La misma llave en todos los intentos: reintentar es seguro porque
  // el backend devuelve la constancia ya creada en vez de duplicarla.
  const idempotencyKey = options.idempotencyKey ?? createIdempotencyKey();

  const attempt = async (): Promise<Response> => {
    const attemptResponse = await fetch(`${requestBaseUrl}/api/v1/transports`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: serializedPayload,
      signal: options.signal,
    });

    if (isRetryableStatus(attemptResponse.status)) {
      throw new UpstreamOutageError(
        attemptResponse.status,
        ERROR_MESSAGES_BY_STATUS[attemptResponse.status] ??
          `El registro del transporte respondió con estado ${attemptResponse.status}.`,
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
        `El registro del transporte respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as TransportReceipt;
  if (!receipt.id || !receipt.kind || !receipt.createdAt) {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}

// Cada lado del viaje reutiliza `parent-candidates` (CHG-153): el tipo
// dependiente correcto hace que el backend devuelva los centros padre
// de esa ciudad — acopios locales para el origen, receptores para el
// destino. El servicio revalida tipo y ciudad al crear.
const SIDE_QUERY_KIND: Record<TransportSide, AidLocationKind> = {
  origin: "collection_point",
  destination: "distribution_point",
};

// CHG-171 (GPS) — Hitos y posiciones del viaje: siempre con la cuenta
// del conductor (cookie). Los errores llegan como problem+json.
async function journeyRequest(
  path: string,
  body?: Record<string, number>,
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<TransportJourneyReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para reportar el viaje.",
    );
  }
  const response = await fetch(`${requestBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });
  if (!response.ok) {
    const problem = await extractProblem(response);
    throw new ReportRejectedError(
      problem.detail ??
        `El reporte del viaje respondió con estado ${response.status}.`,
      problem.fields,
    );
  }
  return (await response.json()) as TransportJourneyReceipt;
}

export function startTransportJourney(
  transportId: string,
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<TransportJourneyReceipt> {
  return journeyRequest(
    `/api/v1/me/transports/${transportId}/start`,
    undefined,
    options,
  );
}

export function arriveTransportJourney(
  transportId: string,
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<TransportJourneyReceipt> {
  return journeyRequest(
    `/api/v1/me/transports/${transportId}/arrive`,
    undefined,
    options,
  );
}

export function sendTransportPosition(
  transportId: string,
  position: { latitude: number; longitude: number },
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<TransportJourneyReceipt> {
  return journeyRequest(
    `/api/v1/me/transports/${transportId}/positions`,
    position,
    options,
  );
}

// CHG-171 — Feed público del mapa: viajes vivos con su rastro.
export async function fetchActiveTransports(
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<ActiveTransport[]> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar los viajes.",
    );
  }
  const response = await fetch(
    `${requestBaseUrl}/api/v1/transports/active`,
    { headers: { Accept: "application/json" }, signal: options.signal },
  );
  if (!response.ok) {
    throw new Error(
      `Los viajes activos respondieron con estado ${response.status}.`,
    );
  }
  const body = (await response.json()) as { items: ActiveTransport[] };
  return body.items;
}

export async function fetchTransportCenterCandidates(
  side: TransportSide,
  municipality: string,
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<AidLocationParentCandidate[]> {
  return fetchParentCandidates(SIDE_QUERY_KIND[side], municipality, options);
}
