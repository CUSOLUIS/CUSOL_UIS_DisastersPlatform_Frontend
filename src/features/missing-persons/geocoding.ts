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
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

// Geocodificador de OpenStreetMap: sin credenciales, misma familia que las teselas.
// Política de uso moderado (desarrollo/demostración), igual que CHG-008.
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

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

  const url =
    `${NOMINATIM_SEARCH_URL}?format=jsonv2&countrycodes=co&limit=5&addressdetails=0` +
    `&q=${encodeURIComponent(trimmed)}`;

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchFn(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("No fue posible consultar la dirección. Revisa la conexión.");
  }

  if (!response.ok) {
    throw new Error("El servicio de direcciones no respondió. Intenta de nuevo.");
  }

  const payload = (await response.json()) as Array<{
    display_name?: unknown;
    lat?: unknown;
    lon?: unknown;
  }>;

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => ({
      label: typeof item.display_name === "string" ? item.display_name : "",
      latitude: Number(item.lat),
      longitude: Number(item.lon),
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
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export interface ResolvedAddress {
  label: string;
  municipality: string | null;
  department: string | null;
}

export async function reverseGeocode(
  point: GeographicCenter,
  fetchFn: FetchLike = fetch,
): Promise<ResolvedAddress> {
  const url =
    `${NOMINATIM_REVERSE_URL}?format=jsonv2&addressdetails=1&zoom=17` +
    `&lat=${encodeURIComponent(String(point.latitude))}` +
    `&lon=${encodeURIComponent(String(point.longitude))}`;

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchFn(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("No fue posible resolver la dirección del punto.");
  }
  if (!response.ok) {
    throw new Error("El servicio de direcciones no respondió. Intenta de nuevo.");
  }

  const payload = (await response.json()) as {
    display_name?: unknown;
    address?: Record<string, unknown>;
  };
  const label =
    typeof payload.display_name === "string" ? payload.display_name : "";
  if (!label) {
    throw new Error("El punto no corresponde a una dirección conocida.");
  }
  const address = payload.address ?? {};
  const firstString = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = address[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  };
  return {
    label,
    municipality: firstString("city", "town", "municipality", "village"),
    department: firstString("state", "region"),
  };
}
