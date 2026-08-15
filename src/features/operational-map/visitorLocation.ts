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
  watchPosition?(
    onSuccess: (position: {
      coords: { latitude: number; longitude: number };
    }) => void,
    onError: (error: { code?: number; message?: string }) => void,
    options?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    },
  ): number;
  clearWatch?(watchId: number): void;
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

// CHG-064: estado del permiso recordado por el navegador. Con
// "granted" se puede reanudar el seguimiento sin volver a preguntar;
// si el navegador lo olvidó (prompt/denied/unknown), el botón vuelve a
// pedirlo.
export type GeolocationPermissionState =
  | "granted"
  | "prompt"
  | "denied"
  | "unknown";

export async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  try {
    const permissions = (
      navigator as unknown as {
        permissions?: {
          query: (input: {
            name: string;
          }) => Promise<{ state?: string }>;
        };
      }
    )?.permissions;
    if (!permissions?.query) return "unknown";
    const status = await permissions.query({ name: "geolocation" });
    if (
      status.state === "granted" ||
      status.state === "prompt" ||
      status.state === "denied"
    ) {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

// CHG-064: seguimiento continuo mientras la página está abierta. La
// coordenada sigue viviendo solo en memoria del navegador.
export function watchVisitorLocation(
  onUpdate: (center: GeographicCenter) => void,
  onRevoked?: () => void,
  geolocation: GeolocationLike | null = getBrowserGeolocation(),
): () => void {
  if (geolocation?.watchPosition === undefined) {
    return () => undefined;
  }
  const watchId = geolocation.watchPosition(
    (position) =>
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
    (error) => {
      // Solo la revocación del permiso detiene el seguimiento; los
      // fallos transitorios de señal se ignoran.
      if (error.code === PERMISSION_DENIED) {
        onRevoked?.();
      }
    },
    { enableHighAccuracy: true, maximumAge: 5_000 },
  );
  return () => geolocation.clearWatch?.(watchId);
}

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
