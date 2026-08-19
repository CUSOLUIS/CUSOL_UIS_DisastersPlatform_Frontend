// CHG-161 — «La mulera» y «La lanchera»: transporte de insumos con
// trazabilidad entre un centro de acopio local (origen) y un centro de
// acopio receptor (destino). Espejo de `HumanitarianTransportInput` y
// `HumanitarianTransportReceipt` del contrato.

export type TransportKind = "mule" | "boat";

export type TransportStatus =
  | "registered"
  | "in_transit"
  | "arrived"
  | "cancelled";

// Lado del viaje: cada uno lista los centros de su propia ciudad.
export type TransportSide = "origin" | "destination";

export const MAX_TRANSPORT_CITY_LENGTH = 100;
export const MAX_SUPPLIES_LENGTH = 1000;

// CHG-171 §27: el conductor debe quedar identificado — espejo del
// backend (subconjunto adulto del catálogo CHG-073).
export const DRIVER_DOCUMENT_TYPES = [
  "Cédula de ciudadanía",
  "Cédula de extranjería",
  "Pasaporte",
  "Permiso por protección temporal (PPT)",
] as const;

export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];

// Espejos de las validaciones del backend (CHG-171).
export const MAX_DRIVER_NAME_LENGTH = 160;
export const MAX_DRIVER_DOCUMENT_LENGTH = 20;
export const MAX_DRIVER_PHONE_LENGTH = 25;
export const MAX_VEHICLE_CHARACTERISTICS_LENGTH = 500;
export const DRIVER_PHONE_PATTERN =
  /^\+?[\s().-]*[1-9](?:[\s().-]*\d){6,14}$/;
export const PLATE_PATTERN = /^[A-Z0-9]{5,10}$/;

/** Placa normalizada como la persiste el backend (§32). */
export function normalizePlate(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

// CHG-173 — Catálogo cerrado de embarcaciones fluviales, espejo del
// backend (`TransportVesselType`).
export const VESSEL_TYPES = [
  "Lancha",
  "Chalupa",
  "Bongo",
  "Planchón",
  "Ferri",
] as const;

export type VesselType = (typeof VESSEL_TYPES)[number];

/**
 * La matrícula fluvial se normaliza como una placa (mayúsculas, sin
 * espacios ni guiones) pero admite de 4 a 15 alfanuméricos: los
 * registros de río no siguen el formato de placa terrestre.
 */
export const VESSEL_REGISTRATION_PATTERN = /^[A-Z0-9]{4,15}$/;

export interface TransportDraft {
  originMunicipality: string;
  originLocationId: string;
  destinationMunicipality: string;
  destinationLocationId: string;
  suppliesSummary: string;
  truthConfirmed: boolean;
  // CHG-171: conductor (quien registra ES quien conduce) y vehículo.
  driverFullName: string;
  driverDocumentType: DriverDocumentType | "";
  driverDocumentNumber: string;
  driverPhone: string;
  // Identificación del vehículo terrestre: solo la mulera.
  tractorPlate: string;
  trailerPlate: string;
  // CHG-173: identidad propia de la embarcación: solo la lanchera.
  vesselRegistration: string;
  vesselName: string;
  vesselType: VesselType | "";
  // Compartido por los dos medios, con etiqueta propia en cada uno.
  vehicleVisibleCharacteristics: string;
}

export interface TransportReceipt {
  id: string;
  kind: TransportKind;
  status: TransportStatus;
  originLocationId: string;
  destinationLocationId: string;
  createdAt: string;
}

// CHG-171 (GPS) — Hitos del viaje del conductor.
export interface TransportJourneyReceipt {
  id: string;
  status: TransportStatus;
  departedAt: string | null;
  arrivedAt: string | null;
  lastPositionAt: string | null;
}

export interface TransportTrailPoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

// Ficha pública del viaje para el mapa (sin datos del conductor, §30).
export interface ActiveTransport {
  id: string;
  kind: TransportKind;
  status: TransportStatus;
  originName: string;
  originMunicipality: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationName: string;
  destinationMunicipality: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  suppliesSummary: string | null;
  tractorPlate: string | null;
  trailerPlate: string | null;
  // CHG-173: identificación visible de la embarcación.
  vesselRegistration: string | null;
  vesselName: string | null;
  vesselType: string | null;
  vehicleVisibleCharacteristics: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastPositionAt: string | null;
  createdAt: string;
  trail: TransportTrailPoint[];
}

export interface TransportFormCopy {
  kind: TransportKind;
  overline: string;
  title: string;
  legend: string;
  intro: string;
  // Cómo llamar al vehículo en los textos ("la mula" / "la lancha").
  vehicle: string;
  sessionExplanation: string;
}

export const transportFormCopy: Record<TransportKind, TransportFormCopy> = {
  mule: {
    kind: "mule",
    overline: "LOGÍSTICA / TRANSPORTE POR TIERRA",
    title: "Registrar la mulera",
    legend:
      "La mula que lleva insumos desde un centro de acopio local hasta un centro de acopio receptor.",
    intro:
      "Registra el viaje de una mula que lleva insumos entre centros de ayuda. Al elegir la ciudad de origen y la de destino verás los centros disponibles de cada lado: así los suministros quedan trazables de punta a punta.",
    vehicle: "la mula",
    sessionExplanation:
      "Registrar la mulera exige iniciar sesión: la trazabilidad de los suministros necesita una persona responsable con cuenta.",
  },
  boat: {
    kind: "boat",
    overline: "LOGÍSTICA / TRANSPORTE FLUVIAL",
    title: "Registrar la lanchera",
    legend:
      "La lancha que lleva insumos desde un centro de acopio local hasta un centro de acopio receptor.",
    intro:
      "Registra el viaje de una lancha que lleva insumos entre centros de ayuda. Al elegir la ciudad de origen y la de destino verás los centros disponibles de cada lado: así los suministros quedan trazables de punta a punta.",
    vehicle: "la lancha",
    sessionExplanation:
      "Registrar la lanchera exige iniciar sesión: la trazabilidad de los suministros necesita una persona responsable con cuenta.",
  },
};

// CHG-171 — Textos de las secciones nuevas por tipo de transporte: la
// mulera habla de tractocamión y tráiler; la lanchera, de matrículas
// de la embarcación (los campos persisten en las mismas columnas).
export interface TransportVehicleCopy {
  sectionTitle: string;
  sectionDescription: string;
  characteristicsLabel: string;
  characteristicsPlaceholder: string;
  // CHG-173: cada medio identifica lo suyo. La mulera trae las dos
  // placas; la lanchera, matrícula, nombre y tipo de embarcación.
  tractorPlateLabel?: string;
  trailerPlateLabel?: string;
  vesselRegistrationLabel?: string;
  vesselNameLabel?: string;
  vesselTypeLabel?: string;
}

export const transportVehicleCopy: Record<
  TransportKind,
  TransportVehicleCopy
> = {
  mule: {
    sectionTitle: "Datos del tractocamión",
    sectionDescription:
      "Información que permite identificar visual y administrativamente el vehículo que transporta los suministros.",
    characteristicsLabel: "Características visibles del vehículo *",
    characteristicsPlaceholder:
      "Tractocamión blanco, tráiler gris, franja azul lateral...",
    tractorPlateLabel: "Placa del tractocamión *",
    trailerPlateLabel: "Placa del tráiler *",
  },
  boat: {
    sectionTitle: "Datos de la embarcación",
    sectionDescription:
      "Información que permite identificar visual y administrativamente la embarcación que transporta los suministros por el río.",
    characteristicsLabel: "Características visibles de la embarcación *",
    characteristicsPlaceholder:
      "Chalupa blanca, techo azul, franja amarilla, motor fuera de borda...",
    vesselRegistrationLabel: "Matrícula de la embarcación *",
    vesselNameLabel: "Nombre de la embarcación *",
    vesselTypeLabel: "Tipo de embarcación *",
  },
};

// CHG-171 — El conductor ES quien registra, desde su propio celular:
// su GPS seguirá el viaje en el mapa (aclaración obligatoria del
// pedido del usuario).
export const transportDriverCopy: Record<
  TransportKind,
  {
    sectionTitle: string;
    sectionDescription: string;
    gpsNotice: string;
    // CHG-173: cómo se nombra a esa persona en avisos y errores.
    driverNoun: string;
  }
> = {
  mule: {
    driverNoun: "quien conduce",
    sectionTitle: "Datos del conductor",
    sectionDescription:
      "Información de la persona responsable de conducir el vehículo durante este traslado.",
    gpsNotice:
      "Importante: quien registra la mulera DEBE ser la persona que conduce, y debe hacerlo desde el celular del conductor. Al registrar, el GPS de este teléfono se activará para mostrar en el mapa la trayectoria de la mula, su salida y su llegada.",
  },
  boat: {
    driverNoun: "quien pilota",
    sectionTitle: "Datos de quien pilota",
    sectionDescription:
      "Información de la persona responsable de pilotar la embarcación durante este traslado.",
    gpsNotice:
      "Importante: quien registra la lanchera DEBE ser la persona que pilota, y debe hacerlo desde su propio celular. Al registrar, el GPS de este teléfono se activará para mostrar en el mapa la trayectoria de la lancha, su salida y su llegada.",
  },
};

// Nombre humano del transporte, para constancias y mensajes.
export const transportKindLabel: Record<TransportKind, string> = {
  mule: "La mulera",
  boat: "La lanchera",
};

export const transportStatusLabel: Record<TransportStatus, string> = {
  registered: "REGISTRADO",
  in_transit: "EN CAMINO",
  arrived: "LLEGÓ",
  cancelled: "CANCELADO",
};

// Copy de cada lado del viaje: título de sección, etiqueta del centro
// y aviso cuando la ciudad no tiene centro disponible.
export interface TransportSideCopy {
  sectionTitle: string;
  sectionDescription: string;
  cityLabel: string;
  centerLabel: string;
  missingCenterMessage: string;
}

export const transportSideCopy: Record<TransportSide, TransportSideCopy> = {
  origin: {
    sectionTitle: "De dónde sale",
    sectionDescription:
      "Ciudad de origen y el centro de acopio local del que salen los insumos.",
    cityLabel: "Ciudad de origen *",
    centerLabel: "Centro de acopio local de origen",
    missingCenterMessage:
      "Esta ciudad todavía no tiene un centro de acopio local publicado, así que no es posible registrar un transporte que salga de aquí.",
  },
  destination: {
    sectionTitle: "A dónde llega",
    sectionDescription:
      "Ciudad de destino y el centro de acopio receptor que recibirá los insumos.",
    cityLabel: "Ciudad de destino *",
    centerLabel: "Centro de acopio receptor de destino",
    missingCenterMessage:
      "Esta ciudad todavía no tiene un centro de acopio receptor publicado, así que no es posible registrar un transporte que llegue aquí.",
  },
};
