import type { ActiveHelpRequest } from "../help-requests/types";
import type { ActiveFoodOffer } from "../food-offers/types";
import type { ActiveTransport } from "../transports/types";
import type { HumanMapPoint, OperationalMapPoint } from "./types";

// CHG-164 — «Ver más» de un marcador: la vista completa recibe el
// registro serializado en el parámetro `datos` de /detalle-punto. Es
// la misma información pública que ya llegó al dashboard (no hay
// endpoint nuevo): tras una recarga sin parámetro, la vista explica y
// ofrece volver al mapa.

export type MapPointDetailPayload =
  | { kind: "operational"; point: OperationalMapPoint }
  | { kind: "help_request"; request: ActiveHelpRequest }
  | { kind: "food_offer"; offer: ActiveFoodOffer }
  | { kind: "human"; feature: HumanMapPoint }
  // CHG-171: viaje de La Mulera/La Lanchera.
  | { kind: "transport"; transport: ActiveTransport };

export function encodeMapPointDetail(payload: MapPointDetailPayload): string {
  return JSON.stringify(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStringFields(
  value: Record<string, unknown>,
  fields: string[],
): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

/**
 * Reconstruye el registro del parámetro de la ruta. Devuelve `null`
 * ante cualquier cosa que no tenga la forma mínima esperada (parámetro
 * ausente, recortado por el navegador o manipulado a mano): la vista
 * muestra su aviso en vez de reventar.
 */
export function decodeMapPointDetail(
  raw: string | undefined | null,
): MapPointDetailPayload | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }

  switch (parsed.kind) {
    case "operational": {
      const point = parsed.point;
      if (
        isRecord(point) &&
        hasStringFields(point, [
          "id",
          "category",
          "title",
          "locationLabel",
          "verificationStatus",
          "updatedAt",
        ]) &&
        isRecord(point.source)
      ) {
        return { kind: "operational", point: point as unknown as OperationalMapPoint };
      }
      return null;
    }
    case "help_request": {
      const request = parsed.request;
      if (
        isRecord(request) &&
        hasStringFields(request, ["id", "description", "address", "expiresAt"])
      ) {
        return {
          kind: "help_request",
          request: request as unknown as ActiveHelpRequest,
        };
      }
      return null;
    }
    case "food_offer": {
      const offer = parsed.offer;
      if (
        isRecord(offer) &&
        hasStringFields(offer, ["id", "description", "address", "expiresAt"])
      ) {
        return { kind: "food_offer", offer: offer as unknown as ActiveFoodOffer };
      }
      return null;
    }
    case "transport": {
      const transport = parsed.transport;
      if (
        isRecord(transport) &&
        hasStringFields(transport, [
          "id",
          "kind",
          "status",
          "originName",
          "destinationName",
          "createdAt",
        ])
      ) {
        return {
          kind: "transport",
          transport: transport as unknown as ActiveTransport,
        };
      }
      return null;
    }
    case "human": {
      const feature = parsed.feature;
      if (
        isRecord(feature) &&
        feature.kind === "point" &&
        hasStringFields(feature, ["id", "status", "updatedAt"])
      ) {
        return { kind: "human", feature: feature as unknown as HumanMapPoint };
      }
      return null;
    }
    default:
      return null;
  }
}
