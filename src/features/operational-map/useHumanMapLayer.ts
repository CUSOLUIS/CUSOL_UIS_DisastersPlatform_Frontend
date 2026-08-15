import { useEffect, useState } from "react";
import { useDataRefreshTick } from "../../platform/dataRefresh";
import type { HumanStatus } from "../human-impact/types";
import type {
  HumanMapDataSource,
  HumanMapOverview,
  HumanMapViewport,
} from "./types";
import { COLOMBIA_BOUNDS } from "./webMercator";

export type HumanMapLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      data: HumanMapOverview;
      stale: boolean;
      refreshing: boolean;
    };

export function useHumanMapLayer({
  dataSource,
  enabled,
  statuses,
  viewport,
}: {
  dataSource: HumanMapDataSource;
  enabled: boolean;
  statuses: HumanStatus[];
  viewport: HumanMapViewport;
}) {
  const [loadState, setLoadState] = useState<HumanMapLoadState>(() =>
    dataSource.initialOverview
      ? {
          status: "success",
          data: dataSource.initialOverview,
          stale: false,
          refreshing: false,
        }
      : { status: "loading" },
  );
  const [requestVersion, setRequestVersion] = useState(0);
  // CHG-082: refresco inmediato cuando la señal de cambios avisa.
  const refreshTick = useDataRefreshTick();
  const statusKey = statuses.join(",");
  const { west, south, east, north } = viewport.bounds;

  useEffect(() => {
    if (!enabled || statuses.length === 0) return;

    const usesInitialOverview =
      dataSource.initialOverview !== undefined &&
      viewport.zoom === 5 &&
      west === COLOMBIA_BOUNDS.west &&
      south === COLOMBIA_BOUNDS.south &&
      east === COLOMBIA_BOUNDS.east &&
      north === COLOMBIA_BOUNDS.north &&
      statusKey ===
        "missing,reported_deceased,confirmed_alive,confirmed_deceased";
    if (usesInitialOverview && requestVersion === 0) return;

    const controller = new AbortController();
    const query = {
      bounds: { west, south, east, north },
      zoom: viewport.zoom,
      statuses,
    };

    const loadOverview = async () => {
      setLoadState((current) =>
        current.status === "success"
          ? { ...current, refreshing: true }
          : { status: "loading" },
      );
      try {
        const data = await dataSource.getOverview(query, controller.signal);
        if (controller.signal.aborted) return;
        setLoadState({
          status: "success",
          data,
          stale: false,
          refreshing: false,
        });
      } catch (error: unknown) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible consultar la capa de situación humana.";
        setLoadState((current) =>
          current.status === "success"
            ? { ...current, stale: true, refreshing: false }
            : { status: "error", message },
        );
      }
    };

    const debounceTimer =
      dataSource.transport === "api"
        ? globalThis.setTimeout(() => void loadOverview(), 280)
        : undefined;
    if (dataSource.transport === "fixture") void loadOverview();
    const refreshTimer =
      dataSource.transport === "api"
        ? globalThis.setInterval(() => void loadOverview(), 30_000)
        : undefined;

    return () => {
      controller.abort();
      if (debounceTimer !== undefined) globalThis.clearTimeout(debounceTimer);
      if (refreshTimer !== undefined) globalThis.clearInterval(refreshTimer);
    };
  }, [
    dataSource,
    east,
    enabled,
    north,
    refreshTick,
    requestVersion,
    south,
    statusKey,
    statuses,
    viewport.zoom,
    west,
  ]);

  return {
    loadState,
    retry: () => setRequestVersion((current) => current + 1),
  };
}
