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
import type { HelpRequestAttendReceipt } from "./types";

// CHG-148 — Voluntario ANÓNIMO de una solicitud de ayuda. Mismo canal
// multipart que los demás envíos ciudadanos (payload + foto opcional,
// Idempotency-Key en todos los intentos, reintento acotado en ventanas
// de despliegue, CHG-101). Recoge SOLO los datos personales del propio
// voluntario; el backend los cifra (solo super_admin) y devuelve el
// contador. Quien tiene cuenta usa `attend`, no esto.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export interface HelpRequestVolunteerDraft {
  name: string;
  phone: string;
  email: string;
}

export function buildVolunteerPayload(
  draft: HelpRequestVolunteerDraft,
): Record<string, string> {
  const payload: Record<string, string> = { name: draft.name.trim() };
  const phone = draft.phone.trim();
  const email = draft.email.trim();
  if (phone) {
    payload.phone = phone;
  }
  if (email) {
    payload.email = email;
  }
  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  404: "La solicitud ya no está disponible; pudo expirar. Actualiza el mapa.",
  413: "El servidor rechazó el envío por su tamaño. Usa una fotografía más liviana.",
  415: "La fotografía tiene un formato no permitido. Usa JPEG, PNG, WebP o HEIC.",
  422: "Revisa tus datos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio no está disponible en este momento. Intenta más tarde.",
};

export async function submitHelpRequestVolunteer(
  requestId: string,
  draft: HelpRequestVolunteerDraft,
  photos: SelectedPhoto[],
  options: SubmitReportOptions = {},
): Promise<HelpRequestAttendReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para ofrecerte como voluntario desde un dispositivo móvil.",
    );
  }

  const serializedPayload = JSON.stringify(buildVolunteerPayload(draft));
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

    const attemptResponse = await fetch(
      `${requestBaseUrl}/api/v1/help-requests/${requestId}/volunteers`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body,
        signal: options.signal,
      },
    );

    if (isRetryableStatus(attemptResponse.status)) {
      throw new UpstreamOutageError(
        attemptResponse.status,
        ERROR_MESSAGES_BY_STATUS[attemptResponse.status] ??
          `El registro del voluntario respondió con estado ${attemptResponse.status}.`,
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
        `El registro del voluntario respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as HelpRequestAttendReceipt;
  if (typeof receipt.attendersCount !== "number") {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
