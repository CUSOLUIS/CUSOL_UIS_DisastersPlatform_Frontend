import { colors } from "../../theme";
import type { OperationalMapCategory } from "./types";

interface CategoryMeta {
  label: string;
  shortLabel: string;
  glyph: string;
  color: string;
  markerKind: "person" | "building";
  summaryKey:
    | "missingPerson"
    | "collectionCenter"
    | "collectionPoint"
    | "rubbleReviewed"
    | "rubblePending"
    | "buildingPending"
    | "communityMeal"
    | "temporaryShelter"
    | "volunteersNeeded";
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
  collection_center: {
    label: "Centros de acopio",
    shortLabel: "Centro de acopio",
    glyph: "+",
    color: colors.cyan,
    markerKind: "person",
    summaryKey: "collectionCenter",
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
  // CHG-069: alerta ciudadana de que se necesita gente en un punto.
  volunteers_needed: {
    label: "Se necesitan voluntarios",
    shortLabel: "Se necesitan voluntarios",
    glyph: "✋",
    color: "#ffd166",
    markerKind: "person",
    summaryKey: "volunteersNeeded",
  },
};
