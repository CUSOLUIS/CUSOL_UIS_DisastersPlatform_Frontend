import { useEffect, useState } from "react";
import { useDataRefreshTick } from "../../platform/dataRefresh";
import { fetchActiveTransports } from "./reportSubmission";
import type { ActiveTransport } from "./types";

export interface ActiveTransportsState {
  status: "loading" | "error" | "success";
  items: ActiveTransport[];
}

// CHG-171 — Viajes en curso con el mismo pulso de la portada (CHG-082):
// poll de 30 s más el refresco de la señal de cambios. Un viaje llegado
// hace más de 6 h deja de venir en el feed y desaparece solo. El feed
// es opcional para el mapa: si falla, el resto de capas siguen vivas.
export function useActiveTransports(
  loadTransports: (options?: {
    signal?: AbortSignal;
  }) => Promise<ActiveTransport[]> = fetchActiveTransports,
): ActiveTransportsState {
  const [state, setState] = useState<ActiveTransportsState>({
    status: "loading",
    items: [],
  });
  const refreshTick = useDataRefreshTick();

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const items = await loadTransports({ signal: controller.signal });
        setState({ status: "success", items });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState((current) =>
          current.status === "success"
            ? current
            : { status: "error", items: [] },
        );
      }
    };

    void load();
    const timer = globalThis.setInterval(() => void load(), 30_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
    // La versión por defecto de loadTransports es estable a nivel de
    // módulo; las inyectadas en pruebas también deben serlo.
  }, [loadTransports, refreshTick]);

  return state;
}
