import { Platform } from "react-native";
import type { GeographicCenter } from "../operational-map/webMercator";

export interface AddressCandidate {
  label: string;
  latitude: number;
  longitude: number;
}

// Subconjunto de fetch inyectable en pruebas.
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

// CHG-147: la geocodificación ya no llama a nominatim.org desde el
// navegador (bloqueada por CORS/política de uso en producción); pasa
// por el proxy del gateway, que consulta server-side con caché y
// límite por origen. En web es el mismo origen (el proxy nginx enruta
// /api); en la app nativa manda EXPO_PUBLIC_API_BASE_URL, como en el
// resto de dataSources.
function geocodeUrl(path: string): string {
  const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
    /\/$/,
    "",
  );
  const apiBaseUrl =
    configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para resolver direcciones desde un dispositivo móvil.",
    );
  }
  return `${apiBaseUrl}${path}`;
}

export function buildLastSeenQuery(parts: {
  department: string;
  municipality: string;
  lastSeenArea: string;
}): string {
  return [parts.lastSeenArea, parts.municipality, parts.department, "Colombia"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export async function searchAddressCandidates(
  query: string,
  fetchFn: FetchLike = fetch,
): Promise<AddressCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const url = geocodeUrl(
    `/api/v1/geocode/search?q=${encodeURIComponent(trimmed)}`,
  );

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchFn(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("No fue posible consultar la dirección. Revisa la conexión.");
  }

  if (!response.ok) {
    throw new Error("El servicio de direcciones no respondió. Intenta de nuevo.");
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      label?: unknown;
      latitude?: unknown;
      longitude?: unknown;
    }>;
  };

  if (!Array.isArray(payload.candidates)) {
    return [];
  }

  return payload.candidates
    .map((item) => ({
      label: typeof item.label === "string" ? item.label : "",
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    }))
    .filter(
      (candidate) =>
        candidate.label.length > 0 &&
        Number.isFinite(candidate.latitude) &&
        Number.isFinite(candidate.longitude),
    );
}

export function parseDraftCoordinates(
  latitude: string,
  longitude: string,
): GeographicCenter | null {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (
    latitude.trim() === "" ||
    longitude.trim() === "" ||
    !Number.isFinite(parsedLatitude) ||
    !Number.isFinite(parsedLongitude)
  ) {
    return null;
  }

  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

// CHG-086 — Geocodificación inversa: al fijar el muñequito en el mapa
// (GPS, botón o arrastre) se resuelve la dirección del sitio para
// autocompletar el campo Dirección (siempre editable).
export interface ResolvedAddress {
  label: string;
  // CHG-156: dirección corta (vía, barrio, comuna) sin la cola
  // administrativa; null cuando el proxy no pudo recortarla.
  addressLine: string | null;
  municipality: string | null;
  department: string | null;
}

export async function reverseGeocode(
  point: GeographicCenter,
  fetchFn: FetchLike = fetch,
): Promise<ResolvedAddress> {
  const url = geocodeUrl(
    `/api/v1/geocode/reverse?lat=${encodeURIComponent(String(point.latitude))}` +
      `&lon=${encodeURIComponent(String(point.longitude))}`,
  );

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchFn(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("No fue posible resolver la dirección del punto.");
  }
  if (response.status === 404) {
    throw new Error("El punto no corresponde a una dirección conocida.");
  }
  if (!response.ok) {
    throw new Error("El servicio de direcciones no respondió. Intenta de nuevo.");
  }

  const payload = (await response.json()) as {
    label?: unknown;
    addressLine?: unknown;
    municipality?: unknown;
    department?: unknown;
  };
  const label = typeof payload.label === "string" ? payload.label : "";
  if (!label) {
    throw new Error("El punto no corresponde a una dirección conocida.");
  }
  return {
    label,
    addressLine:
      typeof payload.addressLine === "string" && payload.addressLine.trim()
        ? payload.addressLine.trim()
        : null,
    municipality:
      typeof payload.municipality === "string" && payload.municipality.trim()
        ? payload.municipality.trim()
        : null,
    department:
      typeof payload.department === "string" && payload.department.trim()
        ? payload.department.trim()
        : null,
  };
}
