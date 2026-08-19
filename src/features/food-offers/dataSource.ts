import { Platform } from "react-native";
import type {
  ActiveFoodOffer,
  FoodOfferPage,
  FoodOffersDataSource,
} from "./types";

// CHG-163 — Ofertas «Ofrecer comida». La lista activa es pública (con
// o sin sesión). El modo demo permite trabajar la interfaz sin
// backend, con la misma expiración server-side simulada.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class FoodOffersApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FoodOffersApiError";
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (apiBaseUrl === undefined) {
    throw new FoodOffersApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar las ofertas de comida desde un dispositivo móvil.",
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
    throw new FoodOffersApiError(
      detail ??
        `Las ofertas de comida respondieron con estado ${response.status}.`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

const apiFoodOffersDataSource: FoodOffersDataSource = {
  transport: "api",
  listActive: (signal) =>
    apiRequest<FoodOfferPage>("/api/v1/food-offers?limit=50", { signal }),
};

function nowIso() {
  return new Date().toISOString();
}

function inHoursIso(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

// La vigencia demo se recalcula en cada consulta para que las tarjetas
// nunca aparezcan ya expiradas al abrir la interfaz sin backend.
function buildDemoOffers(): ActiveFoodOffer[] {
  return [
    {
      id: "7f2c8b21-2222-4d3e-8f4a-000000000001",
      description:
        "Sancocho comunitario para cuarenta personas; trae tu propio plato y cuchara si puedes.",
      address: "Salón comunal del barrio La Cumbre, Floridablanca, Santander",
      latitude: 7.0712,
      longitude: -73.0855,
      notificationRadiusKm: 5,
      createdAt: nowIso(),
      expiresAt: inHoursIso(5),
    },
    {
      id: "7f2c8b21-2222-4d3e-8f4a-000000000002",
      description:
        "Desayunos calientes para familias afectadas, de 6 a 9 de la mañana.",
      address: "Parroquia San Judas, Piedecuesta, Santander",
      latitude: 6.9882,
      longitude: -73.0512,
      notificationRadiusKm: null,
      createdAt: nowIso(),
      expiresAt: inHoursIso(12),
    },
  ];
}

let demoOffers = buildDemoOffers();

const demoFoodOffersDataSource: FoodOffersDataSource = {
  transport: "demo",
  async listActive() {
    // El filtro por vigencia también rige en demo, para que la
    // interfaz ensaye la desaparición automática.
    const now = Date.now();
    demoOffers = demoOffers.filter(
      (offer) => Date.parse(offer.expiresAt) > now,
    );
    if (demoOffers.length === 0) {
      demoOffers = buildDemoOffers();
    }
    return {
      items: demoOffers.map((offer) => ({ ...offer })),
      total: demoOffers.length,
      generatedAt: nowIso(),
    };
  },
};

// Igual que el resto de la plataforma: API real por defecto; `demo`
// solo cuando se pide explícitamente (trabajo sin backend).
const requestedMode = process.env.EXPO_PUBLIC_FOOD_OFFERS_DATA_MODE;
export const foodOffersDataSource =
  requestedMode === "demo" ? demoFoodOffersDataSource : apiFoodOffersDataSource;

export { apiFoodOffersDataSource, demoFoodOffersDataSource };
