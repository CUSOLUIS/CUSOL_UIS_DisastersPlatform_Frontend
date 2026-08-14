import { humanImpactDemoData } from "./demoData";
import { Platform } from "react-native";
import type {
  HumanImpactDataSource,
  HumanImpactOverview,
} from "./types";

const dashboardTransport =
  process.env.EXPO_PUBLIC_DASHBOARD_DATA_MODE === "demo" ? "fixture" : "api";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);

const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

async function getOverviewFromApi(
  signal?: AbortSignal,
): Promise<HumanImpactOverview> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para conectar la aplicación móvil con la API.",
    );
  }

  const response = await fetch(
    `${apiBaseUrl}/api/v1/people/overview?recentLimit=10`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`La API respondió con estado ${response.status}`);
  }

  return (await response.json()) as HumanImpactOverview;
}

export const humanImpactDataSource: HumanImpactDataSource = {
  transport: dashboardTransport,
  // Se conserva esta clasificación hasta resolver DEC-006 y la política de privacidad.
  dataKind: "demonstrative",
  getOverview:
    dashboardTransport === "api"
      ? getOverviewFromApi
      : async () => humanImpactDemoData,
};
