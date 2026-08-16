import { Platform } from "react-native";
import {
  UpstreamOutageError,
  isRetryableStatus,
  retryOnUpstreamOutage,
} from "../reporting/retryOnUpstreamOutage";
import { sanitizePhone } from "../contact/phoneValidation";
import { getLastKnownVisitorLocation } from "../operational-map/visitorPresence";
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
  string | number | boolean | string[]
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
  // CHG-113: la vestimenta puede no conocerse; si va en blanco no
  // viaja, para que el expediente quede sin dato en vez de con "no sé".
  "clothingDescription",
  "additionalDescription",
  "reporterPhone",
  "reporterEmail",
  "officialReportNumber",
  // CHG-094 — Identificación física detallada.
  "tattooDescription",
  "scarsDescription",
  "prostheticsDescription",
  "piercingsAndMoles",
  // CHG-094 — Alertas médicas.
  "mentalHealthCondition",
  "vitalMedication",
  "severeAllergies",
  // CHG-094 — Contexto del desplazamiento.
  "belongingsDescription",
  "transportMode",
  "vehicleDetails",
  "companionsDescription",
  // CHG-094 — Estado institucional.
  "officialAuthorityName",
] as const;

export function buildReportPayload(
  draft: MissingPersonReportDraft,
  photos: SelectedPhoto[] = [],
): MissingPersonReportPayload {
  const payload: MissingPersonReportPayload = {
    firstNames: draft.firstNames.trim(),
    lastNames: draft.lastNames.trim(),
    lastSeenDate: draft.lastSeenDate.trim(),
    department: draft.department.trim(),
    municipality: draft.municipality.trim(),
    lastSeenArea: draft.lastSeenArea.trim(),
    circumstances: draft.circumstances.trim(),
    reporterName: draft.reporterName.trim(),
    reporterRelationship: draft.reporterRelationship.trim(),
    truthConfirmed: draft.truthConfirmed,
    photoAuthorizationConfirmed: draft.photoAuthorizationConfirmed,
    // CHG-094: el consentimiento viaja siempre explícito, también en
    // falso — su ausencia no debe confundirse con una negativa.
    isReporterPhonePublic: draft.isReporterPhonePublic,
    isReporterEmailPublic: draft.isReporterEmailPublic,
  };

  OPTIONAL_TEXT_FIELDS.forEach((field) => {
    // CHG-114: un separador suelto al final del teléfono pasaba la
    // validación local y lo rechazaba el servicio.
    const value =
      field === "reporterPhone"
        ? sanitizePhone(draft[field])
        : draft[field].trim();
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

  // CHG-094: el backend exige una categoría por foto, así que el
  // arreglo solo viaja si alguna se declaró, y entonces completo:
  // las no declaradas caen en "other" para no desalinear posiciones.
  if (photos.some((photo) => photo.category)) {
    payload.photoCategories = photos.map(
      (photo) => photo.category ?? "other",
    );
  }

  const latitude = Number.parseFloat(draft.lastSeenLatitude.trim());
  const longitude = Number.parseFloat(draft.lastSeenLongitude.trim());
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.lastSeenLatitude = latitude;
    payload.lastSeenLongitude = longitude;
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
  // CHG-117: el cliente ya comprime y acota las fotos antes de
  // enviarlas, así que un 413 no significa que quien reporta se
  // haya pasado del límite: significa que algo del lado del
  // servidor cortó el envío. El aviso dejaba de decir la verdad
  // —el proxy cortaba en 1 MiB y el texto hablaba de 10—.
  413: "El servidor rechazó el envío por su tamaño. Intenta con menos fotografías o más livianas.",
  415: "Alguna fotografía tiene un formato no permitido. Usa JPEG, PNG, WebP o HEIC.",
  422: "La API rechazó el reporte por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de reportes no está disponible en este momento. Intenta más tarde.",
};

// CHG-114: el rechazo del servicio viaja con las claves de los campos
// que falló, para que el formulario pueda resaltarlos y desplazarse
// hasta el primero en vez de dejar al usuario buscándolo a mano.
export class ReportRejectedError extends Error {
  readonly fields: readonly string[];

  constructor(message: string, fields: readonly string[] = []) {
    super(message);
    this.name = "ReportRejectedError";
    this.fields = fields;
  }
}

async function extractProblem(
  response: Response,
): Promise<{ detail: string | null; fields: string[] }> {
  try {
    const problem = (await response.json()) as {
      detail?: unknown;
      fields?: unknown;
    };
    return {
      detail:
        typeof problem.detail === "string" && problem.detail
          ? problem.detail
          : null,
      fields: Array.isArray(problem.fields)
        ? problem.fields.filter(
            (field): field is string => typeof field === "string",
          )
        : [],
    };
  } catch {
    return { detail: null, fields: [] };
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
  // CHG-101: inyectables en pruebas para no esperar de verdad.
  retryDelaysMs?: readonly number[];
  wait?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number) => void;
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

  const serializedPayload = JSON.stringify(
    buildReportPayload(draft, photos),
  );
  // CHG-101: la misma llave en todos los intentos — es lo que hace
  // seguro reintentar: el backend devuelve la constancia del reporte
  // ya creado en vez de duplicarlo.
  const idempotencyKey =
    options.idempotencyKey ?? createIdempotencyKey();

  // El cuerpo se arma dentro del intento: un FormData ya enviado no se
  // puede reutilizar de forma fiable en un reintento.
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

    const attemptResponse = await fetch(
      `${requestBaseUrl}/api/v1/missing-person-reports`,
      {
        method: "POST",
        // CHG-054: la cookie de sesión (si existe) vincula el reporte
        // a la cuenta para notificaciones y prioridad; sin sesión
        // sigue anónimo.
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body,
        signal: options.signal,
      },
    );

    // Un despliegue en curso no es un rechazo del contenido: se
    // marca como tal para que el reintento lo distinga de un 4xx.
    if (isRetryableStatus(attemptResponse.status)) {
      throw new UpstreamOutageError(
        attemptResponse.status,
        ERROR_MESSAGES_BY_STATUS[attemptResponse.status] ??
          `El envío del reporte respondió con estado ${attemptResponse.status}.`,
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
        `El envío del reporte respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as MissingPersonReportReceipt;
  // CHG-075: el reporte se publica inmediatamente al crearse.
  if (!receipt.publicCaseCode || receipt.status !== "published") {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
