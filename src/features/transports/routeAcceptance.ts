import { Platform } from "react-native";

/**
 * CHG-174 — Aceptación inicial de ruta Centro de Acopio Local ↔ Mulera.
 *
 * Dos etapas que el contrato exige no confundir: la **solicitud**
 * («acepto que esta Mulera use mi centro») y la **ruta** («esta es la
 * ruta que vamos a iniciar», con código único). Todo el estado vive en
 * backend: aquí no se decide nada, solo se consulta y se pide.
 */

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export type TransportRequestStatus = "pending" | "accepted" | "declined";
export type TransportCenterRole = "local" | "reception";
export type RouteAcceptanceStatus = "code_issued" | "accepted";

export interface CenterTransportRequest {
  id: string;
  transportId: string;
  centerId: string;
  centerRole: TransportCenterRole;
  status: TransportRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  centerName: string;
  centerMunicipality: string;
  transportKind: "mule" | "boat";
  originCenterName: string;
  destinationCenterName: string;
  originMunicipality: string;
  destinationMunicipality: string;
  suppliesSummary: string | null;
  transportCreatedAt: string;
  // Vista autorizada del centro responsable: nunca se reutiliza en
  // mapa, fichas públicas ni comentarios.
  driverFullName: string | null;
  driverDocumentType: string | null;
  driverDocumentNumber: string | null;
  driverPhone: string | null;
  tractorPlate: string | null;
  trailerPlate: string | null;
  vesselRegistration: string | null;
  vesselName: string | null;
  vesselType: string | null;
  vehicleVisibleCharacteristics: string | null;
}

export interface TransportRouteState {
  transportId: string;
  transportKind: "mule" | "boat";
  transportCreatedAt: string;
  originCenterName: string;
  destinationCenterName: string;
  originMunicipality: string;
  destinationMunicipality: string;
  localStatus: TransportRequestStatus | null;
  receptionStatus: TransportRequestStatus | null;
  routeStatus: RouteAcceptanceStatus | null;
  confirmationCode: string | null;
  localAcceptedAt: string | null;
  muleCodeValidatedAt: string | null;
  muleAcceptedAt: string | null;
  // CHG-175 — Etapa 2: Mulera ↔ Centro de Acopio Receptor. Cada centro
  // recibe únicamente el código de SU etapa.
  receptionConfirmationCode: string | null;
  receptionStartedAt: string | null;
  receptionMuleCodeValidatedAt: string | null;
  receptionMuleAcceptedAt: string | null;
  // Sello del estado global: solo con las DOS etapas completas.
  routeAcceptedAt: string | null;
  isLocalSteward: boolean;
  isReceptionSteward: boolean;
}

export interface RouteCodeReceipt {
  transportId: string;
  confirmationCode: string;
  status: RouteAcceptanceStatus;
  reused: boolean;
}

export interface RouteAcceptanceDataSource {
  listRequests(signal?: AbortSignal): Promise<CenterTransportRequest[]>;
  decideRequest(
    requestId: string,
    decision: "accept" | "decline",
  ): Promise<{ status: TransportRequestStatus }>;
  listRouteStates(signal?: AbortSignal): Promise<TransportRouteState[]>;
  startRouteAcceptance(transportId: string): Promise<RouteCodeReceipt>;
  startReceptionRouteAcceptance(
    transportId: string,
  ): Promise<RouteCodeReceipt>;
}

export class RouteAcceptanceApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RouteAcceptanceApiError";
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl ?? ""}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = "No fue posible completar la operación.";
    try {
      const problem = (await response.json()) as { detail?: string };
      if (problem?.detail) detail = problem.detail;
    } catch {
      // problem+json ilegible: se conserva el mensaje genérico.
    }
    throw new RouteAcceptanceApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export const routeAcceptanceDataSource: RouteAcceptanceDataSource = {
  listRequests: async (signal) => {
    const body = await apiRequest<{ items: CenterTransportRequest[] }>(
      "/api/v1/me/center-transport-requests",
      { signal },
    );
    return body.items;
  },
  decideRequest: (requestId, decision) =>
    apiRequest<{ status: TransportRequestStatus }>(
      `/api/v1/me/center-transport-requests/${requestId}/decision`,
      { method: "POST", body: JSON.stringify({ decision }) },
    ),
  listRouteStates: async (signal) => {
    const body = await apiRequest<{ items: TransportRouteState[] }>(
      "/api/v1/me/center-route-acceptances",
      { signal },
    );
    return body.items;
  },
  startRouteAcceptance: (transportId) =>
    apiRequest<RouteCodeReceipt>(
      `/api/v1/me/transports/${transportId}/route-acceptance`,
      { method: "POST" },
    ),
  startReceptionRouteAcceptance: (transportId) =>
    apiRequest<RouteCodeReceipt>(
      `/api/v1/me/transports/${transportId}/reception-route-acceptance`,
      { method: "POST" },
    ),
};

// CHG-175 §18-§21 — La etapa 2 no existe hasta que la 1 está completa.
// El backend lo revalida; esto solo evita ofrecer un botón imposible.
export function canStartReceptionRouteAcceptance(
  state: TransportRouteState,
): boolean {
  return (
    state.localStatus === "accepted" &&
    state.receptionStatus === "accepted" &&
    state.routeStatus === "accepted" &&
    state.receptionStartedAt === null
  );
}

// §73-§76 — Qué decir de la etapa 2 en cada momento, sin adelantar que
// la ruta entera esté aceptada.
export function receptionStageMessage(state: TransportRouteState): string {
  if (
    state.localStatus === "declined" ||
    state.receptionStatus === "declined"
  ) {
    return "Una solicitud fue declinada: la ruta no puede continuar.";
  }
  if (state.routeStatus !== "accepted") {
    return "Esperando la aceptación inicial entre la Mulera y el Centro de Acopio Local.";
  }
  if (state.receptionMuleAcceptedAt) {
    return "Aceptación con el Centro de Acopio Receptor completada.";
  }
  if (state.receptionStartedAt) {
    return "Código entregado. Esperando aceptación de la Mulera.";
  }
  return "La etapa anterior terminó: ya puedes aceptar la ruta con este centro.";
}

// §45-§46 — La ruta solo está aceptada con las DOS relaciones completas.
export function isRouteFullyAccepted(state: TransportRouteState): boolean {
  return state.routeAcceptedAt !== null;
}

// §23: la acción solo se ofrece cuando los DOS centros aceptaron. El
// backend lo revalida igualmente: esto es cortesía de interfaz, no la
// barrera.
export function canStartRouteAcceptance(state: TransportRouteState): boolean {
  return (
    state.localStatus === "accepted" &&
    state.receptionStatus === "accepted" &&
    state.routeStatus === null
  );
}

// §24-§25 y §74: qué decirle al centro según el estado real, sin
// prometer que la ruta completa quedó aceptada.
export function routeStateMessage(state: TransportRouteState): string {
  if (state.localStatus === "declined") {
    return "Tu centro declinó esta solicitud: la ruta no puede continuar.";
  }
  if (state.receptionStatus === "declined") {
    return "El Centro de Acopio Receptor declinó la solicitud: la ruta no puede continuar.";
  }
  if (state.localStatus !== "accepted") {
    return "Falta que tu centro acepte la solicitud en «Solicitudes de transporte».";
  }
  if (state.receptionStatus !== "accepted") {
    return "Esperando aceptación del Centro de Acopio Receptor.";
  }
  if (state.routeStatus === "accepted") {
    return "Aceptación con el Centro de Acopio Local completada.";
  }
  if (state.routeStatus === "code_issued") {
    return "Código entregado. Esperando aceptación de la Mulera.";
  }
  return "Los dos centros aceptaron: ya puedes aceptar la ruta.";
}
