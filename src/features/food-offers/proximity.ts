// CHG-163 — Proximidad de las ofertas de comida (patrón CHG-131): la
// oferta define su radio de aviso (km); la app instalada compara su
// posición (el portón de ubicación CHG-066 la mantiene fresca) con
// cada oferta activa del poll de 30 s. Todo en cliente: el backend no
// conoce posiciones anónimas y no hay infraestructura push.

import { distanceKm } from "../help-requests/proximity";
import type { GeographicCenter } from "../operational-map/webMercator";
import type { ActiveFoodOffer } from "./types";

export interface NearbyFoodOffer {
  offer: ActiveFoodOffer;
  distanceKm: number;
}

// Ofertas con punto y radio definidos cuya distancia a la posición
// dada cae dentro de SU radio, ordenadas de la más cercana a la más
// lejana. Sin posición no hay nada que medir.
export function nearbyFoodOffers(
  offers: ActiveFoodOffer[],
  location: GeographicCenter | null,
): NearbyFoodOffer[] {
  if (!location) {
    return [];
  }
  return offers
    .filter(
      (
        offer,
      ): offer is ActiveFoodOffer & {
        latitude: number;
        longitude: number;
        notificationRadiusKm: number;
      } =>
        offer.latitude !== null &&
        offer.longitude !== null &&
        offer.notificationRadiusKm !== null,
    )
    .map((offer) => ({
      offer,
      distanceKm: distanceKm(location, {
        latitude: offer.latitude,
        longitude: offer.longitude,
      }),
    }))
    .filter((entry) => entry.distanceKm <= entry.offer.notificationRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
