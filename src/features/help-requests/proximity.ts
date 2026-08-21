// CHG-131 — Proximidad de las solicitudes de ayuda. La solicitud
// define su radio de aviso (km); la app instalada compara su posición
// (el portón de ubicación CHG-066 la mantiene fresca) con cada
// solicitud activa del poll de 30 s. Todo en cliente: el backend no
// conoce posiciones anónimas y no hay infraestructura push (los avisos
// se ven con la app abierta; push real exigiría FCM y un ADR).

import type { GeographicCenter } from "../operational-map/webMercator";
import type { ActiveHelpRequest } from "./types";

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: GeographicCenter, b: GeographicCenter): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface NearbyHelpRequest {
  request: ActiveHelpRequest;
  distanceKm: number;
}

// Solicitudes con punto y radio definidos cuya distancia a la posición
// dada cae dentro de SU radio, ordenadas de la más cercana a la más
// lejana. Sin posición no hay nada que medir.
export function nearbyHelpRequests(
  requests: ActiveHelpRequest[],
  location: GeographicCenter | null,
): NearbyHelpRequest[] {
  if (!location) {
    return [];
  }
  return requests
    .filter(
      (
        request,
      ): request is ActiveHelpRequest & {
        latitude: number;
        longitude: number;
        notificationRadiusKm: number;
      } =>
        request.latitude !== null &&
        request.longitude !== null &&
        request.notificationRadiusKm !== null,
    )
    .map((request) => ({
      request,
      distanceKm: distanceKm(location, {
        latitude: request.latitude,
        longitude: request.longitude,
      }),
    }))
    .filter((entry) => entry.distanceKm <= entry.request.notificationRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// CHG-191 — Cuánto hay hasta la solicitud, dicho como lo diría una
// persona: metros cuando se puede llegar caminando, kilómetros cuando
// no. Redondear a la decena de metros evita fingir una precisión que el
// GPS de un teléfono no tiene, y el separador decimal es el de Colombia.
const kilometerFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatDistance(distance: number): string {
  if (!Number.isFinite(distance) || distance < 0) {
    return "";
  }
  if (distance < 1) {
    const meters = Math.max(10, Math.round((distance * 1000) / 10) * 10);
    return `${meters} m`;
  }
  if (distance < 10) {
    return `${kilometerFormatter.format(distance)} km`;
  }
  return `${Math.round(distance)} km`;
}

// La distancia entre quien mira y una solicitud, o null cuando falta
// alguna de las dos posiciones: la solicitud pudo llegar solo con
// dirección escrita (CHG-127) y el navegador puede no haber dado
// permiso. Sin dato no se inventa uno (constitución §1).
export function distanceToRequest(
  request: ActiveHelpRequest,
  viewer: GeographicCenter | null,
): number | null {
  if (!viewer || request.latitude === null || request.longitude === null) {
    return null;
  }
  return distanceKm(viewer, {
    latitude: request.latitude,
    longitude: request.longitude,
  });
}
