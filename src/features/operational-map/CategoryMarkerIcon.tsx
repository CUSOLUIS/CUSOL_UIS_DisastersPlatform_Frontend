import { categoryMeta } from "./categoryMeta";
import { BuildingMarkerIcon } from "./BuildingMarkerIcon";
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
