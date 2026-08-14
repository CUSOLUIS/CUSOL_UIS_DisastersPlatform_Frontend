import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { colors, fontFamilies } from "../../theme";
import type { HumanImpactSummary, HumanStatus } from "./types";

interface DonutChartProps {
  summary: HumanImpactSummary;
}

const chartSegments: Array<{
  key: keyof HumanImpactSummary;
  status: HumanStatus;
  label: string;
  color: string;
}> = [
  { key: "missing", status: "missing", label: "Desaparecidos", color: colors.missing },
  {
    key: "reportedDeceased",
    status: "reported_deceased",
    label: "Muertos reportados",
    color: colors.reported,
  },
  {
    key: "confirmedAlive",
    status: "confirmed_alive",
    label: "Confirmados vivos",
    color: colors.alive,
  },
  {
    key: "confirmedDeceased",
    status: "confirmed_deceased",
    label: "Muertos confirmados",
    color: colors.deceased,
  },
];

const numberFormatter = new Intl.NumberFormat("es-CO");

export function DonutChart({ summary }: DonutChartProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const total = chartSegments.reduce(
    (sum, segment) => sum + summary[segment.key],
    0,
  );
  let accumulatedPercentage = 0;

  const accessibleSummary = chartSegments
    .map((segment) => {
      const value = summary[segment.key];
      const percentage = total === 0 ? 0 : Math.round((value / total) * 100);
      return `${segment.label}: ${numberFormatter.format(value)}, ${percentage}%`;
    })
    .join(". ");

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View
        style={styles.chartWrap}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Distribución de ${numberFormatter.format(total)} registros. ${accessibleSummary}.`}
      >
        <View style={[styles.orbitOuter, styles.noPointerEvents]} />
        <View style={[styles.orbitInner, styles.noPointerEvents]} />
        <Svg width="100%" height="100%" viewBox="0 0 42 42">
          <G transform="rotate(-90 21 21)">
            <Circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="rgba(118, 143, 177, 0.10)"
              strokeWidth="5"
            />
            {chartSegments.map((segment) => {
              const value = summary[segment.key];
              const percentage = total === 0 ? 0 : (value / total) * 100;
              const dashOffset = 25 - accumulatedPercentage;
              accumulatedPercentage += percentage;

              return (
                <Circle
                  key={segment.status}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="5"
                  strokeDasharray={`${percentage} ${100 - percentage}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        </Svg>
        <View style={[styles.chartCenter, styles.noPointerEvents]}>
          <Text style={styles.centerOverline}>TOTAL CONSOLIDADO</Text>
          <Text style={styles.centerValue}>{numberFormatter.format(total)}</Text>
          <Text style={styles.centerLabel}>PERSONAS</Text>
        </View>
      </View>

      <View
        style={styles.legend}
        accessibilityLabel="Leyenda de la distribución"
      >
        {chartSegments.map((segment) => {
          const value = summary[segment.key];
          const percentage = total === 0 ? 0 : Math.round((value / total) * 100);

          return (
            <View key={segment.status} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
              <Text style={styles.legendLabel}>{segment.label}</Text>
              <Text style={styles.legendValue}>{numberFormatter.format(value)}</Text>
              <Text style={styles.legendPercentage}>{percentage}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noPointerEvents: { pointerEvents: "none" },
  container: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 44,
  },
  containerCompact: {
    flexDirection: "column",
    gap: 28,
  },
  chartWrap: {
    position: "relative",
    width: 290,
    height: 290,
    alignSelf: "center",
  },
  orbitOuter: {
    position: "absolute",
    inset: -12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(81, 229, 255, 0.16)",
    borderRadius: 999,
  },
  orbitInner: {
    position: "absolute",
    inset: 42,
    borderWidth: 1,
    borderColor: "rgba(135, 150, 255, 0.14)",
    borderRadius: 999,
  },
  chartCenter: {
    position: "absolute",
    inset: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  centerOverline: {
    marginBottom: 5,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 1.1,
  },
  centerValue: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: "600",
    letterSpacing: -2.5,
  },
  centerLabel: {
    marginTop: 2,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  legend: {
    flex: 1,
    width: "100%",
    gap: 7,
  },
  legendRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(137, 166, 207, 0.09)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.018)",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 12,
  },
  legendValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  legendPercentage: {
    width: 34,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    textAlign: "right",
  },
});
