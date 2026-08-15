import { Platform } from "react-native";
import { getLastKnownVisitorLocation } from "../operational-map/visitorPresence";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import type {
  UnverifiedBuildingReportDraft,
  UnverifiedBuildingReportReceipt,
} from "./reportTypes";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type UnverifiedBuildingReportPayload = Record<
  string,
  string | number | boolean | string[]
>;

const OPTIONAL_TEXT_FIELDS = [
  "address",
  "observedTime",
  "reporterOrganization",
  "reporterPhone",
  "reporterEmail",
  "officialReportNumber",
] as const;

export function buildBuildingReportPayload(
  draft: UnverifiedBuildingReportDraft,
): UnverifiedBuildingReportPayload {
  const payload: UnverifiedBuildingReportPayload = {
    buildingReference: draft.buildingReference.trim(),
    buildingType: draft.buildingType,
    department: draft.department.trim(),
    municipality: draft.municipality.trim(),
    sector: draft.sector.trim(),
    locationReference: draft.locationReference.trim(),
    observedDate: draft.observedDate.trim(),
    searchStatus: draft.searchStatus,
    occupancyReport: draft.occupancyReport,
    pendingReasons: draft.pendingReasons,
    observedConditions: draft.observedConditions,
    observationDescription: draft.observationDescription.trim(),
    reporterName: draft.reporterName.trim(),
    reporterRole: draft.reporterRole.trim(),
    truthConfirmed: draft.truthConfirmed,
    photoAuthorizationConfirmed: draft.photoAuthorizationConfirmed,
    reviewAcknowledged: draft.reviewAcknowledged,
  };

  OPTIONAL_TEXT_FIELDS.forEach((field) => {
    const value = draft[field].trim();
    if (value) {
      payload[field] = value;
    }
  });

  // CHG-092: selección → id; texto libre → nombre (el backend
  // deduplica o crea el evento). Nunca ambos.
  if (draft.relatedEventId.trim()) {
    payload.relatedDisasterId = draft.relatedEventId.trim();
  } else if (draft.relatedEventName.trim()) {
    payload.relatedEventName = draft.relatedEventName.trim();
  }

  const latitude = Number.parseFloat(draft.latitude.trim());
  const longitude = Number.parseFloat(draft.longitude.trim());
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.latitude = latitude;
    payload.longitude = longitude;
  }

  // CHG-066: instantánea de la ubicación del reportante (si concedió el
  // permiso de ubicación); viaja cifrada y solo la ve super_admin.
  const snapshot = getLastKnownVisitorLocation();
  if (snapshot) {
    payload.reporterLatitude = snapshot.latitude;
    payload.reporterLongitude = snapshot.longitude;
  }

  return payload;
}

export function createBuildingReportIdempotencyKey(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) {
    return generated;
  }
  return `building-report-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  413: "Las fotografías superan el tamaño permitido: máximo 10 MiB por foto y 50 MiB en total.",
  415: "Alguna fotografía tiene un formato no permitido. Usa JPEG, PNG, WebP o HEIC.",
  422: "La API rechazó el reporte por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados reportes seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de reportes de edificios no está disponible. Intenta más tarde.",
};

async function extractProblemDetail(response: Response): Promise<string | null> {
  try {
    const problem = (await response.json()) as { detail?: unknown };
    return typeof problem.detail === "string" && problem.detail
      ? problem.detail
      : null;
  } catch {
    return null;
  }
}

async function appendPhoto(body: FormData, photo: SelectedPhoto) {
  const type = photo.mimeType ?? "image/jpeg";
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    body.append(
      "photos",
      blob.type ? blob : new Blob([blob], { type }),
      photo.name,
    );
    return;
  }
  body.append("photos", {
    uri: photo.uri,
    name: photo.name,
    type,
  } as unknown as Blob);
}

export interface SubmitBuildingReportOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
  requestBaseUrl?: string;
}

export async function submitUnverifiedBuildingReport(
  draft: UnverifiedBuildingReportDraft,
  photos: SelectedPhoto[],
  options: SubmitBuildingReportOptions = {},
): Promise<UnverifiedBuildingReportReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar el reporte desde un dispositivo móvil.",
    );
  }

  const body = new FormData();
  const serializedPayload = JSON.stringify(buildBuildingReportPayload(draft));
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

  const response = await fetch(
    `${requestBaseUrl}/api/v1/unverified-building-reports`,
    {
      method: "POST",
      // CHG-054: la cookie de sesión (si existe) vincula el reporte a
      // la cuenta; sin sesión sigue siendo anónimo.
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Idempotency-Key":
          options.idempotencyKey ?? createBuildingReportIdempotencyKey(),
      },
      body,
      signal: options.signal,
    },
  );

  if (!response.ok) {
    const detail = await extractProblemDetail(response);
    throw new Error(
      detail ??
        ERROR_MESSAGES_BY_STATUS[response.status] ??
        `El envío del reporte respondió con estado ${response.status}.`,
    );
  }

  const receipt = (await response.json()) as UnverifiedBuildingReportReceipt;
  if (
    !receipt.id ||
    !receipt.publicTrackingCode ||
    receipt.status !== "under_review" ||
    !receipt.receivedAt
  ) {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
