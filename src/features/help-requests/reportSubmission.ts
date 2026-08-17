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
import { getLastKnownVisitorLocation } from "../operational-map/visitorPresence";
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
  }

  // CHG-066: instantánea de la ubicación de quien solicita (si concedió
  // el permiso); viaja cifrada y solo la ve super_admin.
  const snapshot = getLastKnownVisitorLocation();
  if (snapshot) {
    payload.reporterLatitude = snapshot.latitude;
    payload.reporterLongitude = snapshot.longitude;
  }

  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  413: "El servidor rechazó el envío por su tamaño. Intenta con una fotografía más liviana.",
  415: "La fotografía tiene un formato no permitido. Usa JPEG, PNG, WebP o HEIC.",
  422: "La API rechazó la solicitud por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de solicitudes no está disponible en este momento. Intenta más tarde.",
};

export async function submitHelpRequest(
  draft: HelpRequestDraft,
  photos: SelectedPhoto[],
  options: SubmitReportOptions = {},
): Promise<HelpRequestReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar la solicitud desde un dispositivo móvil.",
    );
  }

  const serializedPayload = JSON.stringify(buildHelpRequestPayload(draft));
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
