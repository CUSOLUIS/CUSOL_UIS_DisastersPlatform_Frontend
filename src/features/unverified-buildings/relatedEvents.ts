import { Platform } from "react-native";
import { normalizeSearchValue } from "../missing-persons/dataSource";

// CHG-092 — Autocompletado creable de "Evento relacionado": búsqueda
// difusa de eventos existentes; en modo api la similitud la calcula
// pg_trgm en el backend.

export interface DisasterEventSuggestion {
  id: string;
  title: string;
  disasterType: string;
  verificationStatus: "unverified" | "under_review" | "verified" | "rejected";
  occurredAt: string | null;
  similarity: number;
}

export interface DisasterEventAutocompleteResponse {
  items: DisasterEventSuggestion[];
  query: string;
  generatedAt: string;
}

export interface RelatedEventsDataSource {
  transport: "fixture" | "api";
  autocomplete(
    query: string,
    signal?: AbortSignal,
  ): Promise<DisasterEventAutocompleteResponse>;
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

const eventsTransport =
  process.env.EXPO_PUBLIC_HUMANITARIAN_DIRECTORY_DATA_MODE === "demo"
    ? "fixture"
    : "api";

export const EVENT_SUGGESTIONS_LIMIT = 5;

// Modo demo: los mismos eventos que muestran las cifras de la portada.
const demoEvents: Array<
  Pick<DisasterEventSuggestion, "id" | "title" | "disasterType">
> = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    title: "Inundación en el norte de Bucaramanga",
    disasterType: "inundacion",
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    title: "Sismo de magnitud 4.8 con epicentro en Los Santos, Santander",
    disasterType: "sismo",
  },
  {
    id: "22222222-2222-4222-8222-222222222204",
    title: "Creciente súbita en quebrada de Piedecuesta",
    disasterType: "inundacion",
  },
];

export const relatedEventsDataSource: RelatedEventsDataSource = {
  transport: eventsTransport,

  async autocomplete(query, signal) {
    if (eventsTransport === "fixture") {
      const normalized = normalizeSearchValue(query);
      return {
        items: demoEvents
          .filter((event) =>
            normalizeSearchValue(event.title).includes(normalized),
          )
          .slice(0, EVENT_SUGGESTIONS_LIMIT)
          .map((event) => ({
            ...event,
            verificationStatus: "verified" as const,
            occurredAt: null,
            similarity: 1,
          })),
        query,
        generatedAt: new Date().toISOString(),
      };
    }

    if (apiBaseUrl === undefined) {
      throw new Error(
        "Configura EXPO_PUBLIC_API_BASE_URL para consultar eventos desde un dispositivo móvil.",
      );
    }

    const parameters = new URLSearchParams({
      q: query.trim(),
      limit: String(EVENT_SUGGESTIONS_LIMIT),
    });
    const response = await fetch(
      `${apiBaseUrl}/api/v1/disaster-events/autocomplete?${parameters.toString()}`,
      { headers: { Accept: "application/json" }, signal },
    );

    if (!response.ok) {
      throw new Error(
        `Los eventos respondieron con estado ${response.status}.`,
      );
    }

    return (await response.json()) as DisasterEventAutocompleteResponse;
  },
};
