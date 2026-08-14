import { Platform } from "react-native";
import { operationalMapDemoData } from "./demoData";
import type {
  OperationalMapDataSource,
  OperationalMapOverview,
  OperationalMapSummary,
} from "./types";

const operationalMapTransport =
  process.env.EXPO_PUBLIC_OPERATIONAL_MAP_DATA_MODE === "demo"
    ? "fixture"
    : "api";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export function validatePublicOverview(
  incomingOverview: OperationalMapOverview | LegacyOperationalMapOverview,
): OperationalMapOverview {
  const overview = normalizeOperationalMapOverview(incomingOverview);
  const unsafeMissingPoint = overview.items.find(
    (point) =>
      point.category === "missing_person" &&
      point.coordinatePrecision === "exact",
  );

  if (unsafeMissingPoint) {
    throw new Error(
      "La API devolvió una ubicación exacta de desaparecidos que no puede publicarse.",
    );
  }

  const invalidPoint = overview.items.find(
    (point) =>
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180,
  );

  if (invalidPoint) {
    throw new Error("La API devolvió coordenadas fuera del rango permitido.");
  }

  return overview;
}

type LegacyOperationalMapOverview = Omit<OperationalMapOverview, "summary"> & {
  summary: Omit<OperationalMapSummary, "buildingPending"> & {
    buildingPending?: number;
  };
};

export function normalizeOperationalMapOverview(
  overview: OperationalMapOverview | LegacyOperationalMapOverview,
): OperationalMapOverview {
  const items = overview.items;

  const summary: OperationalMapSummary = {
    missingPerson: 0,
    collectionCenter: 0,
    rubbleReviewed: 0,
    rubblePending: 0,
    buildingPending: 0,
  };

  items.forEach((point) => {
    switch (point.category) {
      case "missing_person":
        summary.missingPerson += 1;
        break;
      case "collection_center":
        summary.collectionCenter += 1;
        break;
      case "rubble_reviewed":
        summary.rubbleReviewed += 1;
        break;
      case "rubble_pending":
        summary.rubblePending += 1;
        break;
      case "building_pending":
        summary.buildingPending += 1;
        break;
    }
  });

  return { ...overview, items, summary };
}

async function getOverviewFromApi(
  signal?: AbortSignal,
): Promise<OperationalMapOverview> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para conectar el mapa móvil con la API.",
    );
  }

  const response = await fetch(
    `${apiBaseUrl}/api/v1/operational-map/overview?limit=200`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`La API del mapa respondió con estado ${response.status}`);
  }

  return validatePublicOverview(
    (await response.json()) as LegacyOperationalMapOverview,
  );
}

export const operationalMapDataSource: OperationalMapDataSource = {
  transport: operationalMapTransport,
  initialOverview:
    operationalMapTransport === "fixture" ? operationalMapDemoData : undefined,
  getOverview:
    operationalMapTransport === "api"
      ? getOverviewFromApi
      : async () => validatePublicOverview(operationalMapDemoData),
};
