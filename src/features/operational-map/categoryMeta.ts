import { colors } from "../../theme";
import type { OperationalMapCategory } from "./types";

interface CategoryMeta {
  label: string;
  shortLabel: string;
  glyph: string;
  color: string;
  markerKind: "person" | "building" | "help";
  summaryKey:
    | "missingPerson"
    | "collectionCenter"
    | "collectionPoint"
    | "receiverCenter"
    | "distributionPoint"
    | "damagedHome"
    | "rubbleReviewed"
    | "rubblePending"
    | "buildingPending"
    | "communityMeal"
    | "temporaryShelter"
    | "volunteersNeeded"
    | "helpRequests";
}

export const categoryMeta: Record<OperationalMapCategory, CategoryMeta> = {
  missing_person: {
    label: "Desaparecidos",
    shortLabel: "Zona de búsqueda",
    glyph: "?",
    color: colors.missing,
    markerKind: "person",
    summaryKey: "missingPerson",
  },
  // CHG-153: los 4 tipos logísticos. El acopio local conserva la
  // categoría collection_center histórica; receptor y distribución
  // llegan del backend con sus propias categorías.
  collection_center: {
    label: "Centros de acopio local",
    shortLabel: "Centro de acopio local",
    glyph: "+",
    color: colors.cyan,
    markerKind: "person",
    summaryKey: "collectionCenter",
  },
  receiver_center: {
    label: "Centros de acopio receptor",
    shortLabel: "Centro de acopio receptor",
    glyph: "▣",
    color: "#2dd4bf",
    markerKind: "person",
    summaryKey: "receiverCenter",
  },
  // CHG-049: categorías de las acciones comunitarias recientes, con
  // colores propios que no chocan con las categorías previas.
  collection_point: {
    label: "Puntos de recolección",
    shortLabel: "Punto de recolección",
    glyph: "▲",
    color: colors.deceased,
    markerKind: "person",
    summaryKey: "collectionPoint",
  },
  distribution_point: {
    label: "Puntos de distribución",
    shortLabel: "Punto de distribución",
    glyph: "▼",
    color: "#c084fc",
    markerKind: "person",
    summaryKey: "distributionPoint",
  },
  rubble_reviewed: {
    label: "Escombros revisados",
    shortLabel: "Revisión registrada",
    glyph: "✓",
    color: colors.alive,
    markerKind: "person",
    summaryKey: "rubbleReviewed",
  },
  rubble_pending: {
    label: "Escombros pendientes",
    shortLabel: "Revisión pendiente",
    glyph: "!",
    color: colors.reported,
    markerKind: "person",
    summaryKey: "rubblePending",
  },
  building_pending: {
    label: "Edificios sin revisar",
    shortLabel: "Inspección de edificio pendiente",
    glyph: "!",
    color: colors.building,
    markerKind: "building",
    summaryKey: "buildingPending",
  },
  community_meal: {
    label: "Comida comunitaria",
    shortLabel: "Oferta de comida comunitaria",
    glyph: "♨",
    color: "#a3e635",
    markerKind: "person",
    summaryKey: "communityMeal",
  },
  temporary_shelter: {
    label: "Alojamiento temporal",
    shortLabel: "Oferta de alojamiento temporal",
    glyph: "⌂",
    color: "#f28dd0",
    markerKind: "building",
    summaryKey: "temporaryShelter",
  },
  // CHG-162: hogares en muy malas condiciones («Mi casita partida»).
  damaged_home: {
    label: "Hogares en malas condiciones",
    shortLabel: "Hogar en malas condiciones",
    glyph: "🏚",
    color: "#fb7185",
    markerKind: "building",
    summaryKey: "damagedHome",
  },
  // CHG-069: alerta ciudadana de que se necesita gente en un punto.
  volunteers_needed: {
    label: "Se necesitan voluntarios",
    shortLabel: "Se necesitan voluntarios",
    glyph: "✋",
    color: "#ffd166",
    markerKind: "person",
    summaryKey: "volunteersNeeded",
  },
  // CHG-125: solicitud de emergencia vigente — marcador rojo animado.
  help_request: {
    label: "Necesitamos ayuda",
    shortLabel: "Solicitud de ayuda activa",
    glyph: "!",
    color: colors.emergency,
    markerKind: "help",
    summaryKey: "helpRequests",
  },
};
