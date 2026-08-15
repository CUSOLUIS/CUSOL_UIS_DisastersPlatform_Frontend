import { Platform } from "react-native";
import { normalizeSearchValue } from "../missing-persons/dataSource";
import { humanitarianDirectoryDemoData } from "../humanitarian-directory/demoData";
import type { MissingPersonDirectoryCard } from "../humanitarian-directory/types";
import type {
  PersonAutocompleteResponse,
  PersonDuplicateCheckResponse,
  PersonSuggestion,
  PersonSuggestionsDataSource,
} from "./types";

// CHG-091 — Sugerencias difusas contra los casos publicados. En modo
// api la similitud la calcula pg_trgm en el backend; el modo demo
// resuelve por subcadena normalizada (sin tildes) sobre los datos
// fixture — suficiente para la experiencia sin backend.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

const suggestionsTransport =
  process.env.EXPO_PUBLIC_HUMANITARIAN_DIRECTORY_DATA_MODE === "demo"
    ? "fixture"
    : "api";

export const SUGGESTIONS_LIMIT = 5;

function demoPersonCards(): MissingPersonDirectoryCard[] {
  return humanitarianDirectoryDemoData.filter(
    (item): item is MissingPersonDirectoryCard =>
      item.kind === "missing_person",
  );
}

function fixtureMatches(query: string): PersonSuggestion[] {
  const normalized = normalizeSearchValue(query);
  if (normalized.length === 0) {
    return [];
  }

  return demoPersonCards()
    .filter((card) =>
      [card.displayName, card.publicCaseCode, card.municipality]
        .map(normalizeSearchValue)
        .some((value) => value.includes(normalized)),
    )
    .slice(0, SUGGESTIONS_LIMIT)
    .map((card) => ({ ...card, similarity: 1 }));
}

async function fetchSuggestions<Payload>(
  path: string,
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<Payload> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar sugerencias desde un dispositivo móvil.",
    );
  }

  const response = await fetch(
    `${apiBaseUrl}${path}?${parameters.toString()}`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    throw new Error(
      `Las sugerencias respondieron con estado ${response.status}.`,
    );
  }

  return (await response.json()) as Payload;
}

export const personSuggestionsDataSource: PersonSuggestionsDataSource = {
  transport: suggestionsTransport,

  async autocomplete(query, signal) {
    if (suggestionsTransport === "fixture") {
      return {
        items: fixtureMatches(query),
        query,
        generatedAt: new Date().toISOString(),
      };
    }

    return fetchSuggestions<PersonAutocompleteResponse>(
      "/api/v1/persons/autocomplete",
      new URLSearchParams({
        q: query.trim(),
        limit: String(SUGGESTIONS_LIMIT),
      }),
      signal,
    );
  },

  async checkDuplicates(firstName, lastName, signal) {
    if (suggestionsTransport === "fixture") {
      return {
        items: fixtureMatches(`${firstName} ${lastName}`.trim()),
        firstName,
        lastName,
        generatedAt: new Date().toISOString(),
      };
    }

    return fetchSuggestions<PersonDuplicateCheckResponse>(
      "/api/v1/persons/check-duplicates",
      new URLSearchParams({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        limit: String(SUGGESTIONS_LIMIT),
      }),
      signal,
    );
  },
};
