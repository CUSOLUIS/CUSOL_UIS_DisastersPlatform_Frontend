// CHG-125 — «Necesitamos ayuda»: solicitudes públicas de emergencia
// con vigencia en horas. La expiración la impone el backend en cada
// consulta (DEC-125-02): el frontend solo pinta el contador.

// Espejo del contrato (`HelpRequestInput`): vigencia acotada en
// servidor, el cliente valida lo mismo antes de enviar. CHG-130: la
// vigencia se expresa en horas (1-72) o días (1-30); al enviar, los
// días se convierten a horas (tope del contrato: 720).
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 72;
export const MIN_DURATION_DAYS = 1;
export const MAX_DURATION_DAYS = 30;

export type DurationUnit = "hours" | "days";

// CHG-131: radio de aviso en la app instalada (km a la redonda).
export const MIN_NOTIFICATION_RADIUS_KM = 1;
export const MAX_NOTIFICATION_RADIUS_KM = 100;
export const DEFAULT_NOTIFICATION_RADIUS_KM = 5;
export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 1000;
// CHG-146: la descripción de una solicitud de ayuda es breve por
// naturaleza; pide 3 palabras distintas (el reporte de persona pide 5).
// Mismo umbral que aplica el backend.
export const HELP_REQUEST_MIN_DISTINCT_WORDS = 3;
export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 300;
// DEC-125: una única fotografía opcional del lugar.
export const MAX_HELP_REQUEST_PHOTOS = 1;

export interface HelpRequestDraft {
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  // CHG-130: valor numérico + unidad; al enviar se convierte a horas
  // (`durationHours` del contrato).
  durationValue: string;
  durationUnit: DurationUnit;
  // CHG-131: km a la redonda para el aviso en la app; vacío = sin
  // aviso. Solo viaja si hay coordenadas.
  notificationRadiusKm: string;
  truthConfirmed: boolean;
}

export interface HelpRequestReceipt {
  id: string;
  publicCode: string;
  status: "active";
  receivedAt: string;
  expiresAt: string;
}

export interface ActiveHelpRequest {
  id: string;
  description: string;
  address: string;
  // CHG-127: null cuando la solicitud llegó solo con dirección escrita;
  // esas solicitudes no se dibujan en el mapa.
  latitude: number | null;
  longitude: number | null;
  // CHG-131: radio de aviso en km; null si la solicitud no lo definió.
  notificationRadiusKm: number | null;
  createdAt: string;
  expiresAt: string;
  attendersCount: number;
  // Solo puede ser true con sesión activa.
  attendedByMe: boolean;
  photoUrl: string | null;
}

export interface HelpRequestPage {
  items: ActiveHelpRequest[];
  total: number;
  generatedAt: string;
}

export interface HelpRequestAttendReceipt {
  id: string;
  attendersCount: number;
  attending: boolean;
}

export interface HelpRequestsDataSource {
  transport: "api" | "demo";
  listActive(signal?: AbortSignal): Promise<HelpRequestPage>;
  attend(id: string): Promise<HelpRequestAttendReceipt>;
}
