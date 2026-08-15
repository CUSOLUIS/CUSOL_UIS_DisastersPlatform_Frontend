// CHG-066: presencia del visitante.
// - La última ubicación conocida vive en memoria y se adjunta como
//   instantánea (reporterLatitude/reporterLongitude) a los reportes que
//   la persona envíe, sea anónima o con cuenta.
// - La ubicación EN VIVO solo se comparte con sesión de usuario
//   registrado: el gateway rechaza con 401 cualquier envío sin cuenta y
//   únicamente el dashboard super_admin puede consultarla.

import { Platform } from "react-native";
import type { GeographicCenter } from "./webMercator";

let lastKnownLocation: GeographicCenter | null = null;

export function setLastKnownVisitorLocation(
  center: GeographicCenter | null,
) {
  lastKnownLocation = center;
}

export function getLastKnownVisitorLocation(): GeographicCenter | null {
  return lastKnownLocation;
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

const PRESENCE_STORAGE_KEY = "cusol_presence_id";
// Envío como máximo cada 30 s; el gateway además limita por minuto.
const REPORT_INTERVAL_MS = 30_000;
// Sin sesión el gateway responde 401: se pausa el envío un rato en vez
// de insistir (si la persona inicia sesión luego, se retoma solo).
const UNAUTHENTICATED_BACKOFF_MS = 5 * 60_000;

let inMemoryPresenceId: string | null = null;
let lastReportAt = 0;
let pausedUntil = 0;

function generatePresenceId(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) return generated;
  // Variante v4 mínima para entornos sin crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.trunc(Math.random() * 16);
    const value = char === "x" ? random : (random % 4) + 8;
    return value.toString(16);
  });
}

export function getPresenceId(): string {
  if (inMemoryPresenceId) return inMemoryPresenceId;
  try {
    const storage = (
      globalThis as unknown as { localStorage?: Storage }
    ).localStorage;
    const stored = storage?.getItem(PRESENCE_STORAGE_KEY);
    if (stored) {
      inMemoryPresenceId = stored;
      return stored;
    }
    const created = generatePresenceId();
    storage?.setItem(PRESENCE_STORAGE_KEY, created);
    inMemoryPresenceId = created;
    return created;
  } catch {
    inMemoryPresenceId = inMemoryPresenceId ?? generatePresenceId();
    return inMemoryPresenceId;
  }
}

export function presencePlatform(): "web" | "android" | "ios" {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  return "web";
}

export interface ReportPresenceOptions {
  accuracyMeters?: number;
  requestBaseUrl?: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

// Mejor esfuerzo: jamás lanza ni bloquea el mapa.
export async function reportVisitorPresence(
  center: GeographicCenter,
  options: ReportPresenceOptions = {},
): Promise<void> {
  const now = options.now?.() ?? Date.now();
  if (now < pausedUntil || now - lastReportAt < REPORT_INTERVAL_MS) {
    return;
  }
  const requestBaseUrl = options.requestBaseUrl ?? apiBaseUrl;
  if (requestBaseUrl === undefined) return;
  lastReportAt = now;
  const request = options.fetchFn ?? fetch;
  try {
    const response = await request(`${requestBaseUrl}/api/v1/presence`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        presenceId: getPresenceId(),
        latitude: center.latitude,
        longitude: center.longitude,
        ...(options.accuracyMeters !== undefined
          ? { accuracyMeters: options.accuracyMeters }
          : {}),
        platform: presencePlatform(),
      }),
    });
    if (response.status === 401) {
      pausedUntil = now + UNAUTHENTICATED_BACKOFF_MS;
    }
  } catch {
    // Fallo de red: el siguiente intento llega con la próxima lectura.
  }
}

export function resetVisitorPresenceForTests() {
  lastKnownLocation = null;
  inMemoryPresenceId = null;
  lastReportAt = 0;
  pausedUntil = 0;
}
