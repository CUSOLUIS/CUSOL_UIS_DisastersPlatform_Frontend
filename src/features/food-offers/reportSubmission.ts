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
import type { FoodOfferDraft, FoodOfferReceipt } from "./types";

// CHG-163 — Envío de la oferta «Ofrecer comida»: JSON con
// Idempotency-Key en todos los intentos y reintento acotado durante
// ventanas de despliegue (CHG-101). La cookie de sesión (si existe)
// asocia la cuenta; sin sesión la oferta sigue siendo anónima.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type FoodOfferPayload = Record<string, string | number>;

export function buildFoodOfferPayload(draft: FoodOfferDraft): FoodOfferPayload {
  // El contrato viaja siempre en horas; los días se convierten aquí
  // (el backend valida 1-720 igualmente).
  const durationValue = Number.parseInt(draft.durationValue.trim(), 10);
  const payload: FoodOfferPayload = {
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
    // El radio de aviso solo tiene sentido con coordenadas; sin punto
    // en el mapa se omite (el backend lo rechazaría).
    const radius = Number.parseInt(draft.notificationRadiusKm.trim(), 10);
    if (Number.isFinite(radius)) {
      payload.notificationRadiusKm = radius;
    }
  }

  return payload;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  422: "La API rechazó la oferta por datos inválidos. Revisa los campos e intenta de nuevo.",
  429: "Se recibieron demasiados envíos seguidos. Espera un momento e intenta de nuevo.",
  503: "El servicio de ofertas no está disponible en este momento. Intenta más tarde.",
};

// CHG-132 (patrón): si la persona escribió solo la dirección sin fijar
// el punto, las coordenadas se resuelven aquí solas — mejor esfuerzo;
// sin geocodificador la oferta viaja igual solo con la dirección.
export async function resolveDraftCoordinates(
  draft: FoodOfferDraft,
  geocodeAddress: typeof searchAddressCandidates,
): Promise<FoodOfferDraft> {
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

export async function submitFoodOffer(
  draft: FoodOfferDraft,
  options: SubmitReportOptions & {
    geocodeAddress?: typeof searchAddressCandidates;
  } = {},
): Promise<FoodOfferReceipt> {
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar la oferta desde un dispositivo móvil.",
    );
  }

  const resolvedDraft = await resolveDraftCoordinates(
    draft,
    options.geocodeAddress ?? searchAddressCandidates,
  );
  const serializedPayload = JSON.stringify(buildFoodOfferPayload(resolvedDraft));
  // La misma llave en todos los intentos: reintentar es seguro porque
  // el backend devuelve la constancia ya creada en vez de duplicarla.
  const idempotencyKey = options.idempotencyKey ?? createIdempotencyKey();

  const attempt = async (): Promise<Response> => {
    const attemptResponse = await fetch(`${requestBaseUrl}/api/v1/food-offers`, {
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
          `El envío de la oferta respondió con estado ${attemptResponse.status}.`,
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
        `El envío de la oferta respondió con estado ${response.status}.`,
      problem.fields,
    );
  }

  const receipt = (await response.json()) as FoodOfferReceipt;
  if (!receipt.id || !receipt.publicCode || !receipt.expiresAt) {
    throw new Error("La API devolvió una constancia incompleta.");
  }
  return receipt;
}
