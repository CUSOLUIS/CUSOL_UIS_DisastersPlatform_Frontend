import type { OperationalMapPoint } from "../operational-map/types";
import type { ActiveHelpRequest } from "./types";

export const HELP_REQUEST_POINT_PREFIX = "help_request:";

// CHG-125 / DEC-125-10 — Las solicitudes NO viven en la tabla
// compartida del mapa: el panel las fusiona en cliente como puntos de
// la categoría `help_request`, así la expiración server-side rige el
// mapa sin ampliar una tabla ajena.
export function helpRequestsToMapPoints(
  requests: ActiveHelpRequest[],
): OperationalMapPoint[] {
  return requests.map((request) => ({
    id: `${HELP_REQUEST_POINT_PREFIX}${request.id}`,
    category: "help_request",
    title: "Necesitamos ayuda",
    locationLabel: request.address,
    latitude: request.latitude,
    longitude: request.longitude,
    coordinatePrecision: "exact",
    verificationStatus: "unverified",
    relatedDisasterId: null,
    description: request.description,
    source: { name: "Solicitud ciudadana", sourceType: "citizen", url: null },
    updatedAt: request.createdAt,
  }));
}

export function helpRequestIdFromPointId(pointId: string): string | null {
  return pointId.startsWith(HELP_REQUEST_POINT_PREFIX)
    ? pointId.slice(HELP_REQUEST_POINT_PREFIX.length)
    : null;
}
