// CHG-125 — «Necesitamos ayuda»: solicitudes públicas de emergencia
// con vigencia en horas. La expiración la impone el backend en cada
// consulta (DEC-125-02): el frontend solo pinta el contador.

// Espejo del contrato (`HelpRequestInput`): vigencia acotada en
// servidor, el cliente valida lo mismo antes de enviar.
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 72;
export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 300;
// DEC-125: una única fotografía opcional del lugar.
export const MAX_HELP_REQUEST_PHOTOS = 1;

export interface HelpRequestDraft {
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  durationHours: string;
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
