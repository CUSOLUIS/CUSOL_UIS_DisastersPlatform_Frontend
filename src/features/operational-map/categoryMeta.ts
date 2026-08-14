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
    | "rubbleReviewed"
    | "rubblePending"
    | "buildingPending";
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
};
