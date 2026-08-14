import { Platform } from "react-native";
import { normalizeSearchValue } from "../missing-persons/dataSource";
import { missingPersonDemoData } from "../missing-persons/demoData";
import { humanitarianDirectoryDemoData } from "./demoData";
import type {
  AidLocationDirectoryCard,
  DirectoryFilter,
  HumanitarianDirectoryDataSource,
  HumanitarianDirectoryItem,
  HumanitarianDirectoryQuery,
  HumanitarianDirectorySearchResponse,
  MissingPersonDirectoryCard,
} from "./types";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

const directoryTransport =
  process.env.EXPO_PUBLIC_HUMANITARIAN_DIRECTORY_DATA_MODE === "demo"
    ? "fixture"
    : "api";

function searchableText(item: HumanitarianDirectoryItem): string {
  if (item.kind === "missing_person") {
    const demoDetails = missingPersonDemoData.find((person) => person.id === item.id);
    return [
      item.publicCaseCode,
      item.displayName,
      item.approximateAge?.toString() ?? "",
      item.lastSeenArea,
      item.municipality,
      item.department,
      ...(demoDetails?.aliases ?? []),
      demoDetails?.clothingDescription ?? "",
      demoDetails?.physicalDescription ?? "",
      demoDetails?.distinctiveMarks ?? "",
    ].join(" ");
  }

  const supplySearchTerms: Record<string, string> = {
    water: "agua",
    food: "alimentos comida",
    medicine: "medicinas medicamentos",
    clothing: "ropa vestuario",
    tools: "herramientas instrumentos",
    shelter: "refugio albergue",
    other: "otros",
  };
  return [
    item.name,
    item.locationLabel,
    item.municipality,
    item.department,
    ...item.acceptedSupplies.flatMap((supply) => [
      supply,
      supplySearchTerms[supply] ?? "",
    ]),
    item.source.name,
  ].join(" ");
}

function matchesFilter(
  item: HumanitarianDirectoryItem,
  filter: DirectoryFilter,
): boolean {
  if (filter === "all") return true;

  if (item.kind === "missing_person") {
    return item.status === filter;
  }

  if (filter === "verified") return item.verificationStatus === "verified";
  if (filter === "open") return item.openNow === true;
  if (filter === "active") return item.availabilityStatus === "active";
  if (filter === "rating_4") return (item.averageRating ?? 0) >= 4;
  return false;
}

export function filterHumanitarianDirectory(
  items: HumanitarianDirectoryItem[],
  query: HumanitarianDirectoryQuery,
): HumanitarianDirectoryItem[] {
  const normalizedQuery = normalizeSearchValue(query.query);
  if (normalizedQuery.length < 2) return [];

  return items.filter(
    (item) =>
      item.kind === query.kind &&
      normalizeSearchValue(searchableText(item)).includes(normalizedQuery) &&
      matchesFilter(item, query.filter),
  );
}

export function buildDirectorySearchParameters(
  query: HumanitarianDirectoryQuery,
): URLSearchParams {
  const parameters = new URLSearchParams({
    kind: query.kind,
    q: query.query.trim(),
    limit: String(query.limit ?? 20),
    offset: String(query.offset ?? 0),
  });

  if (["missing", "found", "deceased"].includes(query.filter)) {
    parameters.set("personStatus", query.filter);
  } else if (query.filter === "verified") {
    parameters.set("verificationStatus", "verified");
  } else if (query.filter === "open") {
    parameters.set("openNow", "true");
  } else if (query.filter === "active") {
    parameters.set("availabilityStatus", "active");
  } else if (query.filter === "rating_4") {
    parameters.set("minRating", "4");
  }

  return parameters;
}

async function searchFixture(
  query: HumanitarianDirectoryQuery,
): Promise<HumanitarianDirectorySearchResponse> {
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const matches = filterHumanitarianDirectory(humanitarianDirectoryDemoData, query);
  return {
    items: matches.slice(offset, offset + limit),
    total: matches.length,
    limit,
    offset,
    query: query.query.trim(),
    kind: query.kind,
    generatedAt: new Date().toISOString(),
  };
}

async function searchApi(
  query: HumanitarianDirectoryQuery,
  signal?: AbortSignal,
): Promise<HumanitarianDirectorySearchResponse> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar el directorio desde un dispositivo móvil.",
    );
  }

  const parameters = buildDirectorySearchParameters(query);
  const response = await fetch(
    `${apiBaseUrl}/api/v1/humanitarian-directory/search?${parameters.toString()}`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "El directorio unificado aún no está disponible en el backend."
        : `La búsqueda respondió con estado ${response.status}.`,
    );
  }

  const data = (await response.json()) as HumanitarianDirectorySearchResponse;
  const invalidKind = data.items.find((item) => item.kind !== query.kind);
  if (invalidKind) {
    throw new Error("La API mezcló tipos no solicitados en el directorio.");
  }
  return data;
}

export function isMissingPersonDirectoryCard(
  item: HumanitarianDirectoryItem,
): item is MissingPersonDirectoryCard {
  return item.kind === "missing_person";
}

export function isAidLocationDirectoryCard(
  item: HumanitarianDirectoryItem,
): item is AidLocationDirectoryCard {
  return item.kind !== "missing_person";
}

export const humanitarianDirectoryDataSource: HumanitarianDirectoryDataSource = {
  transport: directoryTransport,
  search: directoryTransport === "fixture" ? searchFixture : searchApi,
};
