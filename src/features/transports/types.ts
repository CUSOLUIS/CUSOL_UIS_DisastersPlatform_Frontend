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

export interface TransportDraft {
  originMunicipality: string;
  originLocationId: string;
  destinationMunicipality: string;
  destinationLocationId: string;
  suppliesSummary: string;
  truthConfirmed: boolean;
}

export interface TransportReceipt {
  id: string;
  kind: TransportKind;
  status: TransportStatus;
  originLocationId: string;
  destinationLocationId: string;
  createdAt: string;
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
