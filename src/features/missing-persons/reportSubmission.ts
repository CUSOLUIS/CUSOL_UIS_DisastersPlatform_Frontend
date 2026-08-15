import { Platform } from "react-native";
import type {
  MissingPersonReportDraft,
  MissingPersonReportReceipt,
  SelectedPhoto,
} from "./reportTypes";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type MissingPersonReportPayload = Record<
  string,
  string | number | boolean
>;

const OPTIONAL_TEXT_FIELDS = [
  "aliases",
  "birthDate",
  "genderIdentity",
  "nationality",
  "documentType",
  "documentNumber",
  "build",
  "skinTone",
  "hairDescription",
  "eyeDescription",
  "distinctiveMarks",
  "medicalInformation",
  "lastSeenTime",
  "additionalDescription",
  "reporterPhone",
  "reporterEmail",
  "officialReportNumber",
] as const;

export function buildReportPayload(
  draft: MissingPersonReportDraft,
): MissingPersonReportPayload {
  const payload: MissingPersonReportPayload = {
    firstNames: draft.firstNames.trim(),
    lastNames: draft.lastNames.trim(),
    lastSeenDate: draft.lastSeenDate.trim(),
    department: draft.department.trim(),
    municipality: draft.municipality.trim(),
    lastSeenArea: draft.lastSeenArea.trim(),
    clothingDescription: draft.clothingDescription.trim(),
    circumstances: draft.circumstances.trim(),
    reporterName: draft.reporterName.trim(),
    reporterRelationship: draft.reporterRelationship.trim(),
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

  const approximateAge = Number.parseInt(draft.approximateAge.trim(), 10);
  if (Number.isFinite(approximateAge)) {
    payload.approximateAge = approximateAge;
  }

  const heightCm = Number.parseInt(draft.heightCm.trim(), 10);
  if (Number.isFinite(heightCm)) {
    payload.heightCm = heightCm;
  }

  const latitude = Number.parseFloat(draft.lastSeenLatitude.trim());
  const longitude = Number.parseFloat(draft.lastSeenLongitude.trim());
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.lastSeenLatitude = latitude;
    payload.lastSeenLongitude = longitude;
  }

  return payload;
}

export function createIdempotencyKey(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) {
    return generated;
  }
  return `report-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  413: "Las fotografías superan el tamaño permitido: máximo 10 MiB por foto y 50 MiB en total.",
  415: "Alguna fotografía tiene un formato no permitido. Usa JPEG, PNG, WebP o HEIC.",
  422: "La API rechazó el reporte por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de reportes no está disponible en este momento. Intenta más tarde.",
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

export interface SubmitReportOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
  requestBaseUrl?: string;
}

export async function submitMissingPersonReport(
  draft: MissingPersonReportDraft,
  photos: SelectedPhoto[],
  options: SubmitReportOptions = {},
): Promise<MissingPersonReportReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar el reporte desde un dispositivo móvil.",
    );
  }

  const serializedPayload = JSON.stringify(buildReportPayload(draft));
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

  const response = await fetch(`${requestBaseUrl}/api/v1/missing-person-reports`, {
    method: "POST",
    // CHG-054: la cookie de sesión (si existe) vincula el reporte a la
    // cuenta para notificaciones y prioridad; sin sesión sigue anónimo.
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Idempotency-Key": options.idempotencyKey ?? createIdempotencyKey(),
    },
    body,
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await extractProblemDetail(response);
    throw new Error(
      detail ??
        ERROR_MESSAGES_BY_STATUS[response.status] ??
        `El envío del reporte respondió con estado ${response.status}.`,
    );
  }

  const receipt = (await response.json()) as MissingPersonReportReceipt;
  if (!receipt.publicCaseCode || receipt.status !== "under_review") {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
