import { Platform } from "react-native";

// CHG-171 §50-§53 — Catálogo de ciudades de Colombia para La Mulera:
// el backend lo sirve una sola vez (sembrado 044 UNIDO con los
// municipios reales de acopios publicados) y aquí se cachea y se
// filtra localmente, sin depender de tildes ni mayúsculas.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export interface TransportCity {
  name: string;
  department: string;
}

/** Texto listo para comparar: sin tildes, minúsculas, recortado (§8). */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

/**
 * Filtra el catálogo por lo escrito: primero las ciudades que EMPIEZAN
 * por el término, luego las que lo contienen (§7). Con el campo vacío
 * devuelve las primeras `limit` en orden alfabético.
 */
export function filterCities(
  cities: TransportCity[],
  query: string,
  limit = 12,
): TransportCity[] {
  const term = normalizeSearchText(query);
  if (!term) return cities.slice(0, limit);
  const startsWith: TransportCity[] = [];
  const contains: TransportCity[] = [];
  for (const city of cities) {
    const name = normalizeSearchText(city.name);
    if (name.startsWith(term)) startsWith.push(city);
    else if (name.includes(term)) contains.push(city);
    if (startsWith.length >= limit) break;
  }
  return [...startsWith, ...contains].slice(0, limit);
}

let citiesCache: TransportCity[] | null = null;

export async function fetchTransportCities(
  options: { requestBaseUrl?: string; signal?: AbortSignal } = {},
): Promise<TransportCity[]> {
  if (citiesCache) return citiesCache;
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar las ciudades.",
    );
  }
  const response = await fetch(
    `${requestBaseUrl}/api/v1/transports/cities`,
    { headers: { Accept: "application/json" }, signal: options.signal },
  );
  if (!response.ok) {
    throw new Error(
      `El catálogo de ciudades respondió con estado ${response.status}.`,
    );
  }
  const body = (await response.json()) as { items: TransportCity[] };
  citiesCache = body.items;
  return citiesCache;
}

// Solo para pruebas: limpia la caché del módulo.
export function resetTransportCitiesCache() {
  citiesCache = null;
}
