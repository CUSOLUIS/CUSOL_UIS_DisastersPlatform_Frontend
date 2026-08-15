import { Platform } from "react-native";

// CHG-082 — Sonda de la señal de cambios de la plataforma: una
// huella barata que el backend recalcula con cada registro nuevo o
// modificado. Cuando cambia, la portada refresca todos sus módulos.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export interface ChangeSignalSource {
  transport: "fixture" | "api";
  fetchSignal(signal?: AbortSignal): Promise<string>;
}

export const CHANGE_SIGNAL_INTERVAL_MS = 10_000;

export const changeSignalSource: ChangeSignalSource = {
  transport:
    process.env.EXPO_PUBLIC_DASHBOARD_DATA_MODE === "demo" ||
    apiBaseUrl === undefined
      ? "fixture"
      : "api",
  async fetchSignal(abortSignal) {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/platform/change-signal`,
      {
        headers: { Accept: "application/json" },
        signal: abortSignal,
      },
    );
    if (!response.ok) {
      throw new Error(`La señal respondió ${response.status}.`);
    }
    const body = (await response.json()) as { signal?: unknown };
    if (typeof body.signal !== "string" || body.signal.length === 0) {
      throw new Error("La señal llegó incompleta.");
    }
    return body.signal;
  },
};
