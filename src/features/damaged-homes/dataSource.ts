import { Platform } from "react-native";
import type {
  ActiveDamagedHome,
  DamagedHomePage,
  DamagedHomesDataSource,
  MyDamagedHomesResponse,
} from "./types";

// CHG-182 — «Mi casita destruida». La lista publicada es pública (con o
// sin sesión); la bandeja de «Mi espacio» y el sello de lectura exigen
// cuenta. El modo demo permite trabajar la interfaz sin backend.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class DamagedHomesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DamagedHomesApiError";
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (apiBaseUrl === undefined) {
    throw new DamagedHomesApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar las casitas desde un dispositivo móvil.",
      503,
    );
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    let detail: string | null;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : null;
    } catch {
      detail = null;
    }
    throw new DamagedHomesApiError(
      detail ?? `Las casitas respondieron con estado ${response.status}.`,
      response.status,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const apiDamagedHomesDataSource: DamagedHomesDataSource = {
  transport: "api",
  listActive: (signal) =>
    apiRequest<DamagedHomePage>("/api/v1/damaged-homes?limit=50", { signal }),
  listMine: (signal) =>
    apiRequest<MyDamagedHomesResponse>("/api/v1/me/damaged-homes", { signal }),
  markCommentsSeen: async (homeId) => {
    await apiRequest<void>(
      `/api/v1/me/damaged-homes/${homeId}/comments-seen`,
      { method: "POST" },
    );
  },
};

function nowIso() {
  return new Date().toISOString();
}

// Una sola casita de ejemplo: alcanza para ver el marcador, la leyenda
// resumen y la ficha sin backend.
function buildDemoHomes(): ActiveDamagedHome[] {
  return [
    {
      id: "9a1b7c33-3333-4e5f-8a6b-000000000001",
      publicCode: "CASA-2026-DEMO0001",
      description:
        "La creciente entró de noche y se llevó la cocina y una habitación. Dormimos donde una vecina mientras conseguimos con qué levantar el muro.",
      department: "Chocó",
      municipality: "Quibdó",
      address: "Barrio Niño Jesús, calle 3",
      latitude: 5.6919,
      longitude: -76.6583,
      householdSize: 5,
      donationChannel: "Nequi",
      donationReference: "3001234567",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      photoUrls: [],
      commentRatingAverage: null,
      commentRatingCount: 0,
    },
  ];
}

const demoDamagedHomesDataSource: DamagedHomesDataSource = {
  transport: "demo",
  listActive: async () => {
    const items = buildDemoHomes();
    return { items, total: items.length, generatedAt: nowIso() };
  },
  listMine: async () => ({ items: [], total: 0, unreadTotal: 0 }),
  markCommentsSeen: async () => undefined,
};

export const damagedHomesDataSource: DamagedHomesDataSource =
  process.env.EXPO_PUBLIC_DAMAGED_HOMES_DATA_MODE === "demo"
    ? demoDamagedHomesDataSource
    : apiDamagedHomesDataSource;
