import type { HumanStatus } from "../human-impact/types";
import { colors } from "../../theme";
import type {
  HumanMapFeature,
  HumanMapStatusCounts,
} from "./types";

export const humanStatusMeta = {
  missing: {
    label: "Desaparecidas",
    singular: "Persona desaparecida",
    color: colors.missing,
    glyph: "?",
    countKey: "missing",
  },
  reported_deceased: {
    label: "Muertes reportadas",
    singular: "Muerte reportada",
    color: colors.reported,
    glyph: "!",
    countKey: "reportedDeceased",
  },
  confirmed_alive: {
    label: "Confirmadas vivas",
    singular: "Persona confirmada viva",
    color: colors.alive,
    glyph: "✓",
    countKey: "confirmedAlive",
  },
  confirmed_deceased: {
    label: "Muertes confirmadas",
    singular: "Muerte confirmada",
    color: colors.deceased,
    glyph: "†",
    countKey: "confirmedDeceased",
  },
} as const satisfies Record<
  HumanStatus,
  {
    label: string;
    singular: string;
    color: string;
    glyph: string;
    countKey: keyof HumanMapStatusCounts;
  }
>;

export function humanFeatureAccessibilityLabel(
  feature: HumanMapFeature,
): string {
  if (feature.kind === "point") {
    return `${humanStatusMeta[feature.status].singular}, ubicación pública anónima`;
  }

  return [
    `Grupo de ${feature.count} personas`,
    `${feature.statusCounts.missing} desaparecidas`,
    `${feature.statusCounts.reportedDeceased} muertes reportadas`,
    `${feature.statusCounts.confirmedAlive} confirmadas vivas`,
    `${feature.statusCounts.confirmedDeceased} muertes confirmadas`,
    "seleccionar para acercar",
  ].join(", ");
}
