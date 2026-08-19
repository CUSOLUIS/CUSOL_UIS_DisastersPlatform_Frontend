// CHG-163 — «Ofrecer comida»: ofertas comunitarias de alimentos con
// las reglas de «Necesitamos ayuda» (CHG-125/127/130/131). La
// expiración la impone el backend en cada consulta: el frontend solo
// pinta el contador. Se ven en el mapa para todo el mundo bajo la
// categoría `community_meal` y se notifican a las cuentas en Mi
// espacio.

import type { DurationUnit } from "../help-requests/types";

// Espejo del contrato (`FoodOfferInput`): vigencia acotada en
// servidor, el cliente valida lo mismo antes de enviar. La vigencia se
// expresa en horas (1-72) o días (1-30); al enviar, los días se
// convierten a horas (tope del contrato: 720).
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 72;
export const MIN_DURATION_DAYS = 1;
export const MAX_DURATION_DAYS = 30;

// Radio de aviso en la app instalada (km a la redonda).
export const MIN_NOTIFICATION_RADIUS_KM = 1;
export const MAX_NOTIFICATION_RADIUS_KM = 100;
export const DEFAULT_NOTIFICATION_RADIUS_KM = 5;
export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 1000;
// La descripción de una oferta es breve por naturaleza («Sancocho
// comunitario para 40 personas»); mismo umbral que las solicitudes.
export const FOOD_OFFER_MIN_DISTINCT_WORDS = 3;
export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 300;

export type { DurationUnit };

export interface FoodOfferDraft {
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  // Valor numérico + unidad; al enviar se convierte a horas
  // (`durationHours` del contrato).
  durationValue: string;
  durationUnit: DurationUnit;
  // Km a la redonda para el aviso en la app; vacío = sin aviso. Solo
  // viaja si hay coordenadas.
  notificationRadiusKm: string;
  truthConfirmed: boolean;
}

export interface FoodOfferReceipt {
  id: string;
  publicCode: string;
  status: "active";
  receivedAt: string;
  expiresAt: string;
}

export interface ActiveFoodOffer {
  id: string;
  description: string;
  address: string;
  // Null cuando la oferta llegó solo con dirección escrita; esas
  // ofertas no se dibujan en el mapa.
  latitude: number | null;
  longitude: number | null;
  // Radio de aviso en km; null si la oferta no lo definió.
  notificationRadiusKm: number | null;
  createdAt: string;
  expiresAt: string;
}

export interface FoodOfferPage {
  items: ActiveFoodOffer[];
  total: number;
  generatedAt: string;
}

export interface FoodOffersDataSource {
  transport: "api" | "demo";
  listActive(signal?: AbortSignal): Promise<FoodOfferPage>;
}
