import { useEffect, useState } from "react";
import { useDataRefreshTick } from "../../platform/dataRefresh";
import type {
  PeopleRecordPage,
  PeopleRecordsDataSource,
  PeopleRecordsQuery,
} from "./types";

export type PeopleRecordsLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      data: PeopleRecordPage;
      stale: boolean;
      refreshing: boolean;
      warning?: string;
    };

export function usePeopleRecordsPage({
  dataSource,
  query,
}: {
  dataSource: PeopleRecordsDataSource;
  query: PeopleRecordsQuery;
}) {
  const [loadState, setLoadState] = useState<PeopleRecordsLoadState>({
    status: "loading",
  });
  const [requestVersion, setRequestVersion] = useState(0);
  // CHG-082: refresco inmediato cuando la señal de cambios avisa.
  const refreshTick = useDataRefreshTick();
  const statusKey = query.statuses.join(",");

  useEffect(() => {
    const controller = new AbortController();
    let latestRequest = 0;

    const loadPage = async () => {
      const request = ++latestRequest;
      setLoadState((current) =>
        current.status === "success"
          ? { ...current, refreshing: true, warning: undefined }
          : { status: "loading" },
      );
      try {
        const data = await dataSource.getPage(query, controller.signal);
        if (controller.signal.aborted || request !== latestRequest) return;
        setLoadState({
          status: "success",
          data,
          stale: false,
          refreshing: false,
        });
      } catch (error: unknown) {
        if (
          controller.signal.aborted ||
          request !== latestRequest ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible consultar las personas publicables.";
        setLoadState((current) =>
          current.status === "success"
            ? {
                ...current,
                stale: true,
                refreshing: false,
                warning: message,
              }
            : { status: "error", message },
        );
      }
    };

    void loadPage();
    const refreshTimer =
      dataSource.transport === "api"
        ? globalThis.setInterval(() => void loadPage(), 30_000)
        : undefined;

    return () => {
      controller.abort();
      if (refreshTimer !== undefined) globalThis.clearInterval(refreshTimer);
    };
  }, [
    dataSource,
    query.limit,
    query.offset,
    query.q,
    refreshTick,
    requestVersion,
    statusKey,
  ]);

  return {
    loadState,
    retry: () => setRequestVersion((current) => current + 1),
  };
}
