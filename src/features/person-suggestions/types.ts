import type { MissingPersonDirectoryCard } from "../humanitarian-directory/types";

// CHG-091 — Sugerencias en tiempo real para prevenir duplicados.
// La sugerencia es la tarjeta pública del directorio más la similitud
// trigram calculada por el backend, así que se proyecta directo a los
// componentes existentes (detalle, aporte de novedad).
export interface PersonSuggestion extends MissingPersonDirectoryCard {
  similarity: number;
}

export interface PersonAutocompleteResponse {
  items: PersonSuggestion[];
  query: string;
  generatedAt: string;
}

export interface PersonDuplicateCheckResponse {
  items: PersonSuggestion[];
  firstName: string;
  lastName: string;
  generatedAt: string;
}

export interface PersonSuggestionsDataSource {
  transport: "fixture" | "api";
  autocomplete(
    query: string,
    signal?: AbortSignal,
  ): Promise<PersonAutocompleteResponse>;
  checkDuplicates(
    firstName: string,
    lastName: string,
    signal?: AbortSignal,
  ): Promise<PersonDuplicateCheckResponse>;
}
