import { useEffect, useState } from "react";
import type { PersonSuggestion, PersonSuggestionsDataSource } from "./types";

// CHG-091 — Sugerencias mientras se escribe. El debounce de 400 ms y
// el disparo con 3+ caracteres vienen fijados por la especificación:
// la llamada espera una pausa breve del tecleo en vez de salir por
// cada tecla, y toda respuesta vieja se aborta al re-disparar.
export const SUGGESTIONS_DEBOUNCE_MS = 400;
export const SUGGESTIONS_MIN_LENGTH = 3;

export type SuggestionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; items: PersonSuggestion[] };

interface UsePersonSuggestionsInput {
  dataSource: PersonSuggestionsDataSource;
  // Modo autocompletado: texto libre del buscador.
  query?: string;
  // Modo duplicados: nombres y apellidos del formulario.
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

export function usePersonSuggestions({
  dataSource,
  query,
  firstName,
  lastName,
  enabled = true,
}: UsePersonSuggestionsInput): SuggestionsState {
  const [state, setState] = useState<SuggestionsState>({ status: "idle" });
  const mode = query !== undefined ? "autocomplete" : "duplicates";
  const effectiveText =
    mode === "autocomplete"
      ? (query ?? "").trim()
      : `${(firstName ?? "").trim()} ${(lastName ?? "").trim()}`.trim();

  useEffect(() => {
    if (!enabled || effectiveText.length < SUGGESTIONS_MIN_LENGTH) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(() => {
      setState({ status: "loading" });
      const request =
        mode === "autocomplete"
          ? dataSource.autocomplete(effectiveText, controller.signal)
          : dataSource.checkDuplicates(
              (firstName ?? "").trim(),
              (lastName ?? "").trim(),
              controller.signal,
            );
      request
        .then((response) => {
          if (!cancelled) {
            setState({ status: "ready", items: response.items });
          }
        })
        .catch(() => {
          // Las sugerencias jamás bloquean el flujo principal: ante
          // cualquier error simplemente no se muestran.
          if (!cancelled) {
            setState({ status: "idle" });
          }
        });
    }, SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [dataSource, effectiveText, enabled, firstName, lastName, mode]);

  return state;
}
