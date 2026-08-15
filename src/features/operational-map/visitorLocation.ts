// CHG-055: ubicación actual del visitante para centrar el mapa.
// El navegador pide el permiso al usuario; la coordenada solo vive en
// memoria para centrar y dibujar el marcador "estás aquí" — jamás se
// envía al backend ni se persiste.

import type { GeographicCenter } from "./webMercator";

interface GeolocationLike {
  getCurrentPosition(
    onSuccess: (position: {
      coords: { latitude: number; longitude: number };
    }) => void,
    onError: (error: { code?: number; message?: string }) => void,
    options?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    },
  ): void;
}

export function getBrowserGeolocation(): GeolocationLike | null {
  if (
    typeof navigator === "undefined" ||
    !("geolocation" in navigator) ||
    !navigator.geolocation
  ) {
    return null;
  }
  return navigator.geolocation as GeolocationLike;
}

export class VisitorLocationError extends Error {}

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

export function requestVisitorLocation(
  geolocation: GeolocationLike | null = getBrowserGeolocation(),
): Promise<GeographicCenter> {
  if (geolocation === null) {
    return Promise.reject(
      new VisitorLocationError(
        "Este dispositivo o navegador no permite obtener la ubicación.",
      ),
    );
  }
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => {
        if (error.code === PERMISSION_DENIED) {
          reject(
            new VisitorLocationError(
              "Permiso de ubicación denegado. Habilítalo en tu " +
                "navegador para centrar el mapa donde estás.",
            ),
          );
          return;
        }
        if (error.code === TIMEOUT) {
          reject(
            new VisitorLocationError(
              "La ubicación tardó demasiado. Intenta de nuevo.",
            ),
          );
          return;
        }
        if (error.code === POSITION_UNAVAILABLE) {
          reject(
            new VisitorLocationError(
              "No fue posible determinar tu ubicación en este momento.",
            ),
          );
          return;
        }
        reject(
          new VisitorLocationError(
            "No fue posible obtener tu ubicación.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  });
}
