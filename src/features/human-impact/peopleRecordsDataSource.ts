import { Platform } from "react-native";
import { humanImpactDemoData } from "./demoData";
import type {
  HumanStatus,
  PeopleRecordPage,
  PeopleRecordsDataSource,
  PeopleRecordsQuery,
  PersonRecord,
} from "./types";

const apiPeoplePageSizes = [10, 25, 50] as const;

function toApiPageSize(pageSize: PeopleRecordsQuery["limit"]): number {
  if (pageSize <= 10) return 10;
  if (pageSize <= 20) return 25;
  return 50;
}

const peopleRecordsTransport =
  process.env.EXPO_PUBLIC_PEOPLE_RECORDS_DATA_MODE === "demo"
    ? "fixture"
    : "api";
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);
const humanStatuses = new Set<HumanStatus>([
  "missing",
  "reported_deceased",
  "confirmed_alive",
  "confirmed_deceased",
]);

function validatePersonRecord(person: PersonRecord): void {
  if (
    !person.id ||
    !person.displayName ||
    !humanStatuses.has(person.status) ||
    !person.location ||
    !person.relatedEvent ||
    !person.source?.name ||
    Number.isNaN(new Date(person.createdAt).getTime())
  ) {
    throw new Error("La API devolvió un registro público de persona inválido.");
  }
}

export function validatePeopleRecordPage(
  page: PeopleRecordPage,
  query: Omit<PeopleRecordsQuery, "limit"> & { limit: number },
): PeopleRecordPage {
  const expectedItemCount = Math.max(
    0,
    Math.min(page.limit, page.total - page.offset),
  );
  if (
    !apiPeoplePageSizes.includes(page.limit as (typeof apiPeoplePageSizes)[number]) ||
    page.limit !== query.limit ||
    page.offset !== query.offset ||
    page.offset < 0 ||
    page.total < 0 ||
    page.items.length !== expectedItemCount ||
    Number.isNaN(new Date(page.generatedAt).getTime())
  ) {
    throw new Error("La API devolvió una página de personas inconsistente.");
  }
  page.items.forEach(validatePersonRecord);
  if (
    query.statuses.length > 0 &&
    page.items.some((person) => !query.statuses.includes(person.status))
  ) {
    throw new Error("La API ignoró el filtro de estado de personas.");
  }
  return page;
}

export async function getPeopleRecordPageFromApi(
  query: PeopleRecordsQuery,
  signal?: AbortSignal,
  requestBaseUrl = apiBaseUrl,
): Promise<PeopleRecordPage> {
  if (requestBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar personas en móvil.",
    );
  }

  const apiQuery = { ...query, limit: toApiPageSize(query.limit) };
  const parameters = new URLSearchParams({
    limit: String(apiQuery.limit),
    offset: String(query.offset),
  });
  query.statuses.forEach((status) => parameters.append("statuses", status));
  const normalizedQuery = query.q?.trim();
  if (normalizedQuery) parameters.set("q", normalizedQuery);

  const response = await fetch(
    `${requestBaseUrl}/api/v1/people/records?${parameters.toString()}`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!response.ok) {
    throw new Error(
      `La API de personas respondió con estado ${response.status}`,
    );
  }
  const apiPage = validatePeopleRecordPage(
    (await response.json()) as PeopleRecordPage,
    apiQuery,
  );
  return {
    ...apiPage,
    items: apiPage.items.slice(0, query.limit),
    limit: query.limit,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export async function getPeopleRecordDemoPage(
  query: PeopleRecordsQuery,
): Promise<PeopleRecordPage> {
  const normalizedQuery = normalizeSearchText(query.q?.trim() ?? "");
  const filtered = [...humanImpactDemoData.recentPeople]
    .sort((left, right) => {
      const dateDifference =
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return dateDifference === 0
        ? right.id.localeCompare(left.id)
        : dateDifference;
    })
    .filter((person) => {
      const matchesStatus =
        query.statuses.length === 0 || query.statuses.includes(person.status);
      const searchable = normalizeSearchText(
        [
          person.displayName,
          person.location,
          person.relatedEvent,
          person.source.name,
        ].join(" "),
      );
      return (
        matchesStatus &&
        (normalizedQuery === "" || searchable.includes(normalizedQuery))
      );
    });

  return {
    items: filtered.slice(query.offset, query.offset + query.limit),
    total: filtered.length,
    limit: query.limit,
    offset: query.offset,
    generatedAt: humanImpactDemoData.generatedAt,
  };
}

export const peopleRecordsDataSource: PeopleRecordsDataSource = {
  transport: peopleRecordsTransport,
  getPage:
    peopleRecordsTransport === "api"
      ? getPeopleRecordPageFromApi
      : getPeopleRecordDemoPage,
};
