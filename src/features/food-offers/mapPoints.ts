import type { OperationalMapPoint } from "../operational-map/types";
import type { ActiveFoodOffer } from "./types";

export const FOOD_OFFER_POINT_PREFIX = "food_offer:";

// CHG-163 / patrón DEC-125-10 — Las ofertas NO viven en la tabla
// compartida del mapa: el panel las fusiona en cliente como puntos de
// la categoría `community_meal` (que existía desde CHG-044 sin datos),
// así la expiración server-side rige el mapa sin ampliar una tabla
// ajena.
export function foodOffersToMapPoints(
  offers: ActiveFoodOffer[],
): OperationalMapPoint[] {
  // Regla DEC-127-02: las ofertas sin coordenadas (llegaron solo con
  // dirección escrita) no se dibujan; siguen visibles en Mi espacio.
  return offers
    .filter(
      (
        offer,
      ): offer is ActiveFoodOffer & {
        latitude: number;
        longitude: number;
      } => offer.latitude !== null && offer.longitude !== null,
    )
    .map((offer) => ({
      id: `${FOOD_OFFER_POINT_PREFIX}${offer.id}`,
      category: "community_meal",
      title: "Comida comunitaria",
      locationLabel: offer.address,
      latitude: offer.latitude,
      longitude: offer.longitude,
      // CHG-134 (patrón): el radio de aviso se dibuja en el mapa a
      // escala.
      alertRadiusKm: offer.notificationRadiusKm ?? undefined,
      coordinatePrecision: "exact" as const,
      verificationStatus: "unverified" as const,
      relatedDisasterId: null,
      description: offer.description,
      source: {
        name: "Oferta ciudadana",
        sourceType: "citizen" as const,
        url: null,
      },
      updatedAt: offer.createdAt,
    }));
}

export function foodOfferIdFromPointId(pointId: string): string | null {
  return pointId.startsWith(FOOD_OFFER_POINT_PREFIX)
    ? pointId.slice(FOOD_OFFER_POINT_PREFIX.length)
    : null;
}
