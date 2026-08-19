import { useCallback, useEffect, useState } from "react";
import { useDataRefreshTick } from "../../platform/dataRefresh";
import type { ActiveFoodOffer, FoodOffersDataSource } from "./types";

export interface ActiveFoodOffersState {
  status: "loading" | "error" | "success";
  items: ActiveFoodOffer[];
  errorMessage: string | null;
}

// CHG-163 — Lista de ofertas vigentes con el mismo pulso de la portada
// (CHG-082): poll de 30 s en modo api más el refresco inmediato de la
// señal de cambios. Al expirar una oferta, el backend deja de
// devolverla y aquí desaparece sola.
export function useActiveFoodOffers(dataSource: FoodOffersDataSource): {
  state: ActiveFoodOffersState;
  refresh: () => void;
} {
  const [state, setState] = useState<ActiveFoodOffersState>({
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
