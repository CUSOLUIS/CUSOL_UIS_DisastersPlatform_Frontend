import { Platform } from "react-native";
import { missingPersonDemoData } from "./demoData";
import type {
  MissingPersonPublicRecord,
  MissingPersonSearchDataSource,
  MissingPersonSearchResponse,
} from "./types";

const missingPersonTransport =
  process.env.EXPO_PUBLIC_MISSING_PERSON_DATA_MODE === "demo"
    ? "fixture"
    : "api";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

export function filterPublicRecords(
  records: MissingPersonPublicRecord[],
  query: string,
): MissingPersonPublicRecord[] {
  const normalizedQuery = normalizeSearchValue(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  return records.filter((record) =>
    normalizeSearchValue(
      [
        record.publicCaseCode,
        record.displayName,
        ...record.aliases,
        record.approximateAge?.toString() ?? "",
        record.lastSeenArea,
        record.municipality,
        record.department,
        record.clothingDescription ?? "",
        record.physicalDescription ?? "",
        record.distinctiveMarks ?? "",
      ].join(" "),
    ).includes(normalizedQuery),
  );
}

async function searchFixture(
  query: string,
): Promise<MissingPersonSearchResponse> {
  const items = filterPublicRecords(missingPersonDemoData, query).slice(0, 20);
  return { items, total: items.length, query: query.trim() };
}

async function searchApi(
  query: string,
  signal?: AbortSignal,
): Promise<MissingPersonSearchResponse> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para buscar desde un dispositivo móvil.",
    );
  }

  const parameters = new URLSearchParams({ q: query.trim(), limit: "20" });
  const response = await fetch(
    `${apiBaseUrl}/api/v1/missing-persons/search?${parameters.toString()}`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    throw new Error(`La búsqueda respondió con estado ${response.status}`);
  }

  return (await response.json()) as MissingPersonSearchResponse;
}

export const missingPersonSearchDataSource: MissingPersonSearchDataSource = {
  transport: missingPersonTransport,
  search: missingPersonTransport === "api" ? searchApi : searchFixture,
};
