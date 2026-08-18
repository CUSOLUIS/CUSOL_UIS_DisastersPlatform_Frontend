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
import type {
  AidLocationDraft,
  AidLocationKind,
  AidLocationParentCandidate,
  AidLocationReceipt,
} from "./types";

// CHG-153 — Alta de puntos logísticos: JSON con Idempotency-Key en
// todos los intentos y reintento acotado durante ventanas de despliegue
// (CHG-101). La cookie de sesión (si existe) asocia la cuenta; sin
// sesión el registro sigue siendo anónimo.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type AidLocationPayload = Record<string, string | number>;

export function buildAidLocationPayload(
  kind: AidLocationKind,
  draft: AidLocationDraft,
): AidLocationPayload {
  const payload: AidLocationPayload = {
    kind,
    name: draft.name.trim(),
    address: draft.address.trim(),
    municipality: draft.municipality.trim(),
    department: draft.department.trim(),
  };

  // Las coordenadas viajan solo en pareja (regla del contrato).
  const latitude = Number.parseFloat(draft.latitude.trim());
  const longitude = Number.parseFloat(draft.longitude.trim());
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.latitude = latitude;
    payload.longitude = longitude;
  }

  const schedule = draft.schedule.trim();
  if (schedule) payload.schedule = schedule;
  const contact = draft.contact.trim();
  if (contact) payload.contact = contact;
  const description = draft.description.trim();
  if (description) payload.description = description;
  const parentId = draft.parentId.trim();
  if (parentId) payload.parentId = parentId;

  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  422: "La API rechazó el registro por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de registro no está disponible en este momento. Intenta más tarde.",
};

// CHG-132 (patrón): si la persona escribió solo la dirección sin fijar
// el punto, las coordenadas se resuelven aquí solas — mejor esfuerzo;
// sin geocodificador el registro viaja igual solo con la dirección.
export async function resolveDraftCoordinates(
  draft: AidLocationDraft,
  geocodeAddress: typeof searchAddressCandidates,
): Promise<AidLocationDraft> {
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

export async function submitAidLocation(
  kind: AidLocationKind,
  draft: AidLocationDraft,
  options: SubmitReportOptions & {
    geocodeAddress?: typeof searchAddressCandidates;
  } = {},
): Promise<AidLocationReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para registrar el punto desde un dispositivo móvil.",
    );
  }

  const resolvedDraft = await resolveDraftCoordinates(
    draft,
    options.geocodeAddress ?? searchAddressCandidates,
  );
  const serializedPayload = JSON.stringify(
    buildAidLocationPayload(kind, resolvedDraft),
  );
  // La misma llave en todos los intentos: reintentar es seguro porque
  // el backend devuelve la constancia ya creada en vez de duplicarla.
  const idempotencyKey = options.idempotencyKey ?? createIdempotencyKey();

  const attempt = async (): Promise<Response> => {
    const attemptResponse = await fetch(
      `${requestBaseUrl}/api/v1/aid-locations`,
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
          `El registro del punto respondió con estado ${attemptResponse.status}.`,
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
        `El registro del punto respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as AidLocationReceipt;
  if (!receipt.id || !receipt.kind || !receipt.createdAt) {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}

// Centros válidos para asociar un punto dependiente, filtrados por el
// backend (tipo padre correcto, publicados, no inactivos, misma
// ciudad). El formulario solo los ofrece; el servicio revalida al
// crear.
export async function fetchParentCandidates(
  kind: AidLocationKind,
  municipality: string,
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<AidLocationParentCandidate[]> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar los centros asociados.",
    );
  }
  const query = new URLSearchParams({
    kind,
    municipality: municipality.trim(),
  });
  const response = await fetch(
    `${requestBaseUrl}/api/v1/aid-locations/parent-candidates?${query}`,
    {
      headers: { Accept: "application/json" },
      signal: options.signal,
    },
  );
  if (!response.ok) {
    throw new Error("No fue posible consultar los centros asociados.");
  }
  const body = (await response.json()) as {
    items?: AidLocationParentCandidate[];
  };
  return body.items ?? [];
}
