import { Platform } from "react-native";
import { getHumanMapDemoOverview } from "./humanMapDemoData";
import type {
  HumanMapCluster,
  HumanMapDataSource,
  HumanMapFeature,
  HumanMapOverview,
  HumanMapPoint,
  HumanMapQuery,
} from "./types";
import { humanMapStatuses } from "./types";
import { COLOMBIA_BOUNDS } from "./webMercator";

const humanMapTransport =
  process.env.EXPO_PUBLIC_HUMAN_MAP_DATA_MODE === "demo" ? "fixture" : "api";
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

function validateFeature(feature: HumanMapFeature): void {
  if (
    feature.latitude < -90 ||
    feature.latitude > 90 ||
    feature.longitude < -180 ||
    feature.longitude > 180
  ) {
    throw new Error("La API devolvió una ubicación humana fuera de rango.");
  }

  if (feature.kind === "point") {
    if ((feature.coordinatePrecision as string) === "exact") {
      throw new Error(
        "La API devolvió una ubicación humana exacta que no puede publicarse.",
      );
    }
    return;
  }

  const countedStatuses = Object.values(feature.statusCounts).reduce(
    (total, value) => total + value,
    0,
  );
  if (feature.count < 2 || countedStatuses !== feature.count) {
    throw new Error("La API devolvió un cluster humano inconsistente.");
  }
}

export function validateHumanMapOverview(
  page: HumanMapOverview,
): HumanMapOverview {
  if (
    page.totalMatched !== page.totalMapped + page.unmappedCount ||
    page.returnedFeatures !== page.features.length
  ) {
    throw new Error("La API devolvió totales humanos inconsistentes.");
  }
  page.features.forEach(validateFeature);
  return page;
}

async function requestPage(
  query: HumanMapQuery,
  cursor: string | null,
  signal?: AbortSignal,
  requestBaseUrl = apiBaseUrl,
): Promise<HumanMapOverview> {
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para conectar la capa humana móvil.",
    );
  }

  const parameters = new URLSearchParams({
    west: String(query.bounds.west),
    south: String(query.bounds.south),
    east: String(query.bounds.east),
    north: String(query.bounds.north),
    zoom: String(Math.round(query.zoom)),
    limit: "500",
  });
  query.statuses.forEach((status) => parameters.append("statuses", status));
  if (cursor) parameters.set("cursor", cursor);

  const response = await fetch(
    `${requestBaseUrl}/api/v1/people/map-overview?${parameters.toString()}`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!response.ok) {
    throw new Error(
      `La API de situación humana respondió con estado ${response.status}`,
    );
  }
  return validateHumanMapOverview((await response.json()) as HumanMapOverview);
}

function representedPeople(feature: HumanMapFeature): number {
  return feature.kind === "cluster" ? feature.count : 1;
}

export async function getHumanMapOverviewFromApi(
  query: HumanMapQuery,
  signal?: AbortSignal,
  requestBaseUrl = apiBaseUrl,
): Promise<HumanMapOverview> {
  const features: HumanMapFeature[] = [];
  const seenCursors = new Set<string>();
  let firstPage: HumanMapOverview | null = null;
  let cursor: string | null = null;

  do {
    const page = await requestPage(query, cursor, signal, requestBaseUrl);
    firstPage ??= page;
    if (
      page.totalMatched !== firstPage.totalMatched ||
      page.totalMapped !== firstPage.totalMapped ||
      page.unmappedCount !== firstPage.unmappedCount
    ) {
      throw new Error("La paginación humana cambió sus totales durante la consulta.");
    }
    features.push(...page.features);
    cursor = page.nextCursor;
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error("La API repitió un cursor de la capa humana.");
      }
      seenCursors.add(cursor);
    }
  } while (cursor);

  if (!firstPage) {
    throw new Error("La API no devolvió una respuesta de situación humana.");
  }
  const countedPeople = features.reduce(
    (total, feature) => total + representedPeople(feature),
    0,
  );
  if (countedPeople !== firstPage.totalMapped) {
    throw new Error("La capa humana perdió registros durante la paginación.");
  }

  return {
    ...firstPage,
    features,
    returnedFeatures: features.length,
    nextCursor: null,
  };
}

const initialDemoOverview = getHumanMapDemoOverview({
  bounds: COLOMBIA_BOUNDS,
  zoom: 5,
  statuses: [...humanMapStatuses],
});

export const humanMapDataSource: HumanMapDataSource = {
  transport: humanMapTransport,
  initialOverview:
    humanMapTransport === "fixture" ? initialDemoOverview : undefined,
  getOverview:
    humanMapTransport === "api"
      ? getHumanMapOverviewFromApi
      : async (query) => getHumanMapDemoOverview(query),
};

export type { HumanMapCluster, HumanMapPoint };
