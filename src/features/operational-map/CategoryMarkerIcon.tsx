import { categoryMeta } from "./categoryMeta";
import { BuildingMarkerIcon } from "./BuildingMarkerIcon";
import { HelpRequestMarkerIcon } from "./HelpRequestMarkerIcon";
import { PersonMarkerIcon } from "./PersonMarkerIcon";
import type { OperationalMapCategory } from "./types";

interface CategoryMarkerIconProps {
  category: OperationalMapCategory;
  selected?: boolean;
  animated?: boolean;
}

export function CategoryMarkerIcon({
  category,
  selected = false,
  animated = true,
}: CategoryMarkerIconProps) {
  const meta = categoryMeta[category];
  // CHG-125: la solicitud de ayuda titila y emite ondas (estático con
  // movimiento reducido, DEC-125-05).
  if (meta.markerKind === "help") {
    return (
      <HelpRequestMarkerIcon
        animated={animated}
        color={meta.color}
        glyph={meta.glyph}
        selected={selected}
      />
    );
  }
  if (meta.markerKind === "building") {
    return (
      <BuildingMarkerIcon
        animated={animated}
        color={meta.color}
        glyph={meta.glyph}
        selected={selected}
      />
    );
  }

  return (
    <PersonMarkerIcon
      animated={animated}
      color={meta.color}
      glyph={meta.glyph}
      selected={selected}
    />
  );
}
