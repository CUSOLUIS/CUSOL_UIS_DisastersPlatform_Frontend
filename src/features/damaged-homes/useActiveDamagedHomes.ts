import { useCallback, useEffect, useState } from "react";
import { useDataRefreshTick } from "../../platform/dataRefresh";
import type { ActiveDamagedHome, DamagedHomesDataSource } from "./types";

export interface ActiveDamagedHomesState {
  status: "loading" | "error" | "success";
  items: ActiveDamagedHome[];
  errorMessage: string | null;
}

// CHG-182 — Lista de casitas publicadas con el mismo pulso de la portada
// (CHG-082): poll de 30 s en modo api más el refresco inmediato de la
// señal de cambios. Cuando una casita se retira (moderación o denuncias), el backend
// deja de devolverla y aquí desaparece sola.
export function useActiveDamagedHomes(dataSource: DamagedHomesDataSource): {
  state: ActiveDamagedHomesState;
  refresh: () => void;
} {
  const [state, setState] = useState<ActiveDamagedHomesState>({
    status: "loading",
    items: [],
    errorMessage: null,
  });
  const [requestVersion, setRequestVersion] = useState(0);
  const refreshTick = useDataRefreshTick();

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const page = await dataSource.listActive(controller.signal);
        setState({ status: "success", items: page.items, errorMessage: null });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState((current) =>
          current.status === "success"
            ? current
            : {
                status: "error",
                items: [],
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : "No fue posible consultar las ofertas de comida.",
              },
        );
      }
    };

    void load();
    const timer =
      dataSource.transport === "api"
        ? globalThis.setInterval(() => void load(), 30_000)
        : undefined;

    return () => {
      controller.abort();
      if (timer !== undefined) {
        globalThis.clearInterval(timer);
      }
    };
  }, [dataSource, refreshTick, requestVersion]);

  const refresh = useCallback(
    () => setRequestVersion((current) => current + 1),
    [],
  );

  return { state, refresh };
}
