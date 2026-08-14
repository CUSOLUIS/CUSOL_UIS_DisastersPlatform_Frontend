import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { PersonMarkerIcon } from "./PersonMarkerIcon";
import { humanStatusMeta } from "./humanStatusMeta";
import type { HumanMapFeature } from "./types";

interface HumanMapMarkerIconProps {
  feature: HumanMapFeature;
  selected?: boolean;
  compact?: boolean;
}

function compactCount(value: number): string {
  if (value < 1_000) return String(value);
  const thousands = value / 1_000;
  return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}K`;
}

export function HumanMapMarkerIcon({
  feature,
  selected = false,
  compact = false,
}: HumanMapMarkerIconProps) {
  if (feature.kind === "point") {
    const meta = humanStatusMeta[feature.status];
    return (
      <PersonMarkerIcon
        animated={false}
        color={meta.color}
        glyph={meta.glyph}
        selected={selected}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cluster,
        compact && styles.clusterCompact,
        selected && styles.clusterSelected,
        compact && selected && styles.clusterSelectedCompact,
      ]}
      testID="human-cluster-icon"
    >
      <Text style={styles.clusterCount}>{compactCount(feature.count)}</Text>
      <Text style={styles.clusterCaption}>PERSONAS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 25,
    backgroundColor: "rgba(5, 9, 17, 0.94)",
    shadowColor: colors.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 9,
  },
  clusterSelected: {
    width: 58,
    height: 58,
    borderWidth: 3,
    borderRadius: 29,
    shadowOpacity: 0.72,
    shadowRadius: 15,
  },
  clusterCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  clusterSelectedCompact: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  clusterCount: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  clusterCaption: {
    marginTop: 1,
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
