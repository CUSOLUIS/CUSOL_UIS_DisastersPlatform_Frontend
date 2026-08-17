// CHG-126 — Sección "Sistema" de la consola super_admin: métricas del
// sistema operativo del host donde corre el gateway (el VPS en
// producción), con sondeo cada pocos segundos y gráficas SVG
// interactivas: arrastrar o tocar sobre una gráfica revela el valor y
// la hora de esa muestra. Sin librerías de charts: react-native-svg ya
// está en el árbol y sirve igual en web, Android e iOS.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, G, Line, Path, Polyline } from "react-native-svg";
import { colors, fontFamilies } from "../../theme";
import type { AdminDataSource, AdminSystemMetrics } from "./types";

const POLL_INTERVAL_MS = 5_000;
const CHART_SURFACE = "#0d1320";

// Paleta de series: tokens del tema, un matiz fijo por métrica. El par
// adyacente RX/TX (cian/naranja) pasa la separación CVD (ΔE 22.1
// deutan) y el contraste ≥3:1 sobre la superficie oscura.
const SERIES_COLORS = {
  cpu: colors.cyan,
  temperature: colors.reported,
  memory: colors.deceased,
  networkRx: colors.cyan,
  networkTx: colors.building,
} as const;

interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export function SystemMetricsSection({
  dataSource,
  refreshKey,
}: {
  dataSource: AdminDataSource;
  refreshKey: number;
}) {
  const [data, setData] = useState<AdminSystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await dataSource.getSystemMetrics());
      setError(null);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar las métricas del sistema.",
      );
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const timestamps = useMemo(
    () => (data?.series ?? []).map((sample) => sample.sampledAt),
    [data],
  );
  const cpuSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "cpu",
        label: "CPU",
        color: SERIES_COLORS.cpu,
        values: (data?.series ?? []).map((sample) => sample.cpuPercent),
      },
    ],
    [data],
  );
  // CHG-140: solo hay serie de temperatura si el host expone sensores;
  // en una VPS sin ellos la gráfica se omite y la tarjeta marca N/D.
  const hasTemperature = useMemo(
    () =>
      (data?.series ?? []).some(
        (entry) => entry.cpuTemperatureCelsius !== null,
      ),
    [data],
  );
  const temperatureSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "temperature",
        label: "Temperatura",
        color: SERIES_COLORS.temperature,
        values: (data?.series ?? []).map(
          (sample) => sample.cpuTemperatureCelsius ?? 0,
        ),
      },
    ],
    [data],
  );
  const memorySeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "memory",
        label: "Memoria usada",
        color: SERIES_COLORS.memory,
        values: (data?.series ?? []).map(
          (sample) => sample.memoryUsedBytes,
        ),
      },
    ],
    [data],
  );
  const networkSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "rx",
        label: "Recibido",
        color: SERIES_COLORS.networkRx,
        values: (data?.series ?? []).map(
          (sample) => sample.networkRxBytesPerSecond,
        ),
      },
      {
        key: "tx",
        label: "Enviado",
        color: SERIES_COLORS.networkTx,
        values: (data?.series ?? []).map(
          (sample) => sample.networkTxBytesPerSecond,
        ),
      },
    ],
    [data],
  );

  if (loading && !data) {
    return (
      <View style={styles.sectionContent}>
        <Heading />
        <View accessibilityLabel="Cargando métricas del sistema" style={styles.inlineState}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.inlineStateText}>
            Cargando métricas del sistema…
          </Text>
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.sectionContent}>
        <Heading />
        <View accessibilityRole="alert" style={styles.inlineError}>
          <Text style={styles.inlineErrorTitle}>
            No fue posible consultar las métricas
          </Text>
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>REINTENTAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!data) return null;
  const latest = data.latest;
  const memoryPercent =
    latest.memoryTotalBytes > 0
      ? (100 * latest.memoryUsedBytes) / latest.memoryTotalBytes
      : 0;
  const diskPercent =
    latest.diskTotalBytes > 0
      ? (100 * latest.diskUsedBytes) / latest.diskTotalBytes
      : 0;

  return (
    <View style={styles.sectionContent} testID="system-metrics-section">
      <Heading />
      {error && (
        <View accessibilityRole="alert" style={styles.staleNotice}>
          <Text style={styles.staleNoticeText}>
            Última consulta fallida ({error}). Se muestran los datos
            anteriores; el sondeo continúa.
          </Text>
        </View>
      )}

      <View style={styles.tileGrid}>
        <StatTile
          accent={SERIES_COLORS.cpu}
          label="CPU del host"
          value={`${latest.cpuPercent.toFixed(1)}%`}
          detail={`Carga ${latest.load1m.toFixed(2)} · ${latest.load5m.toFixed(2)} · ${latest.load15m.toFixed(2)}`}
        />
        <StatTile
          accent={SERIES_COLORS.temperature}
          label="Temperatura del CPU"
          value={
            latest.cpuTemperatureCelsius !== null
              ? formatTemperature(latest.cpuTemperatureCelsius)
              : "N/D"
          }
          detail={
            latest.cpuTemperatureCelsius !== null
              ? "Sensor térmico del host"
              : "Este host no expone sensores térmicos"
          }
        />
        <StatTile
          accent={SERIES_COLORS.memory}
          label="Memoria usada"
          value={formatBytes(latest.memoryUsedBytes)}
          detail={`${memoryPercent.toFixed(1)}% de ${formatBytes(latest.memoryTotalBytes)} · libre ${formatBytes(latest.memoryAvailableBytes)}`}
        />
        <StatTile
          accent={colors.missing}
          label="Disco libre"
          value={formatBytes(latest.diskFreeBytes)}
          detail={`Usado ${formatBytes(latest.diskUsedBytes)} de ${formatBytes(latest.diskTotalBytes)}`}
          meterPercent={diskPercent}
        />
        <StatTile
          accent={SERIES_COLORS.networkTx}
          label="Red del gateway"
          value={`↓ ${formatRate(latest.networkRxBytesPerSecond)}`}
          detail={`↑ ${formatRate(latest.networkTxBytesPerSecond)} · swap ${formatBytes(latest.swapUsedBytes)} de ${formatBytes(latest.swapTotalBytes)}`}
        />
        <StatTile
          accent={colors.alive}
          label="Encendido hace"
          value={formatUptime(latest.uptimeSeconds)}
          detail={`Muestra cada ${data.intervalSeconds.toFixed(0)} s · ${data.series.length} en ventana`}
        />
      </View>

      <MetricTimeChart
        formatValue={(value) => `${value.toFixed(1)}%`}
        series={cpuSeries}
        testID="system-chart-cpu"
        timestamps={timestamps}
        title="USO DE CPU"
        yMax={100}
      />
      {hasTemperature && (
        <MetricTimeChart
          formatValue={formatTemperature}
          series={temperatureSeries}
          testID="system-chart-temperature"
          timestamps={timestamps}
          title="TEMPERATURA DEL HOST"
        />
      )}
      <MetricTimeChart
        formatValue={formatBytes}
        series={memorySeries}
        testID="system-chart-memory"
        timestamps={timestamps}
        title="MEMORIA USADA"
        yMax={latest.memoryTotalBytes || undefined}
      />
      <MetricTimeChart
        formatValue={formatRate}
        series={networkSeries}
        testID="system-chart-network"
        timestamps={timestamps}
        title="RED DEL GATEWAY"
      />

      <Text style={styles.footnote}>
        MEMORIA, CPU, CARGA Y DISCO SON DEL HOST DEL GATEWAY · LA RED ES
        LA DE SU CONTENEDOR · ACTUALIZADO {formatClock(data.generatedAt)}
      </Text>
    </View>
  );
}

function Heading() {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.sectionOverline}>06 / ADMINISTRATION</Text>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Sistema del servidor
      </Text>
      <Text style={styles.sectionLead}>
        Métricas en vivo del sistema operativo donde corre la
        plataforma. Toca o arrastra sobre una gráfica para leer el valor
        exacto de cada muestra.
      </Text>
    </View>
  );
}

function StatTile({
  accent,
  label,
  value,
  detail,
  meterPercent,
}: {
  accent: string;
  label: string;
  value: string;
  detail: string;
  meterPercent?: number;
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileAccent, { backgroundColor: accent }]} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileDetail}>{detail}</Text>
      {meterPercent !== undefined && (
        <View
          accessibilityLabel={`Disco usado al ${meterPercent.toFixed(1)} por ciento`}
          style={styles.meterTrack}
        >
          <View
            style={[
              styles.meterFill,
              {
                width: `${Math.min(100, Math.max(0, meterPercent))}%`,
                backgroundColor:
                  meterPercent >= 90
                    ? colors.reported
                    : meterPercent >= 75
                      ? colors.missing
                      : colors.alive,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// Gráfica de tiempo: líneas de 2px, lavado al 10 % cuando hay una sola
// serie, rejilla de un pelo y crosshair con tooltip al tocar/arrastrar.
function MetricTimeChart({
  title,
  series,
  timestamps,
  formatValue,
  yMax,
  testID,
}: {
  title: string;
  series: ChartSeries[];
  timestamps: string[];
  formatValue: (value: number) => string;
  yMax?: number;
  testID: string;
}) {
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const widthRef = useRef(0);
  const count = timestamps.length;
  const height = 170;
  const plotTop = 6;
  const plotBottom = height - 22;
  const plotHeight = plotBottom - plotTop;

  const resolvedMax = useMemo(() => {
    if (yMax !== undefined && yMax > 0) return yMax;
    const peak = Math.max(
      1,
      ...series.flatMap((entry) => entry.values),
    );
    return peak * 1.15;
  }, [series, yMax]);

  const positionX = useCallback(
    (index: number) =>
      count > 1 ? (index * widthRef.current) / (count - 1) : widthRef.current / 2,
    [count],
  );
  const positionY = useCallback(
    (value: number) =>
      plotBottom - (Math.min(value, resolvedMax) / resolvedMax) * plotHeight,
    [plotBottom, plotHeight, resolvedMax],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    widthRef.current = nextWidth;
    setWidth(nextWidth);
  };

  const scrubTo = (event: GestureResponderEvent) => {
    if (count === 0 || widthRef.current <= 0) return;
    const ratio = event.nativeEvent.locationX / widthRef.current;
    const index = Math.round(ratio * (count - 1));
    setScrubIndex(Math.min(count - 1, Math.max(0, index)));
  };

  const scrub = scrubIndex !== null && scrubIndex < count ? scrubIndex : null;
  const latestSummary = series
    .map(
      (entry) =>
        `${entry.label} ${formatValue(entry.values[entry.values.length - 1] ?? 0)}`,
    )
    .join(", ");

  return (
    <View style={styles.chartPanel}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {series.length > 1 ? (
          <View style={styles.legendRow}>
            {series.map((entry) => (
              <View key={entry.key} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: entry.color }]}
                />
                <Text style={styles.legendLabel}>{entry.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.chartMeta}>ÚLTIMOS {count} PUNTOS</Text>
        )}
      </View>

      <View
        accessibilityLabel={`${title}: ${latestSummary}. Arrastra para inspeccionar cada muestra`}
        onLayout={handleLayout}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={scrubTo}
        onResponderMove={scrubTo}
        onResponderRelease={() => setScrubIndex(null)}
        onResponderTerminate={() => setScrubIndex(null)}
        onStartShouldSetResponder={() => true}
        style={styles.chartCanvas}
        testID={testID}
      >
        {width > 0 && count > 1 && (
          <Svg height={height} width={width}>
            {[0, 0.5, 1].map((fraction) => (
              <Line
                key={fraction}
                stroke={colors.line}
                strokeWidth={1}
                x1={0}
                x2={width}
                y1={plotTop + plotHeight * fraction}
                y2={plotTop + plotHeight * fraction}
              />
            ))}
            {series.map((entry) => {
              const points = entry.values
                .map(
                  (value, index) =>
                    `${positionX(index)},${positionY(value)}`,
                )
                .join(" ");
              const lastValue = entry.values[entry.values.length - 1] ?? 0;
              return (
                <G key={entry.key}>
                  {series.length === 1 && (
                    <Path
                      d={`M0,${plotBottom} L${points.replaceAll(" ", " L")} L${positionX(count - 1)},${plotBottom} Z`}
                      fill={entry.color}
                      opacity={0.1}
                    />
                  )}
                  <Polyline
                    fill="none"
                    points={points}
                    stroke={entry.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                  <Circle
                    cx={positionX(count - 1)}
                    cy={positionY(lastValue)}
                    fill={entry.color}
                    r={4.5}
                    stroke={CHART_SURFACE}
                    strokeWidth={2}
                  />
                </G>
              );
            })}
            {scrub !== null && (
              <>
                <Line
                  stroke={colors.lineStrong}
                  strokeWidth={1}
                  x1={positionX(scrub)}
                  x2={positionX(scrub)}
                  y1={plotTop}
                  y2={plotBottom}
                />
                {series.map((entry) => (
                  <Circle
                    key={`scrub-${entry.key}`}
                    cx={positionX(scrub)}
                    cy={positionY(entry.values[scrub] ?? 0)}
                    fill={entry.color}
                    r={4.5}
                    stroke={CHART_SURFACE}
                    strokeWidth={2}
                  />
                ))}
              </>
            )}
          </Svg>
        )}

        <Text style={[styles.axisLabel, styles.axisMax]}>
          {formatValue(resolvedMax)}
        </Text>
        <Text style={[styles.axisLabel, styles.axisMid]}>
          {formatValue(resolvedMax / 2)}
        </Text>
        {count > 0 && (
          <>
            <Text style={[styles.axisLabel, styles.axisStart]}>
              {formatClock(timestamps[0])}
            </Text>
            <Text style={[styles.axisLabel, styles.axisEnd]}>
              {formatClock(timestamps[count - 1])}
            </Text>
          </>
        )}

        {scrub !== null && (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              {
                left: Math.min(
                  Math.max(positionX(scrub) - 70, 4),
                  Math.max(4, width - 148),
                ),
              },
            ]}
            testID={`${testID}-tooltip`}
          >
            <Text style={styles.tooltipTime}>
              {formatClock(timestamps[scrub])}
            </Text>
            {series.map((entry) => (
              <View key={`tip-${entry.key}`} style={styles.tooltipRow}>
                <View
                  style={[styles.legendDot, { backgroundColor: entry.color }]}
                />
                <Text style={styles.tooltipValue}>
                  {entry.label}: {formatValue(entry.values[scrub] ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {count <= 1 && (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>
              RECOLECTANDO MUESTRAS…
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function formatBytes(value: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let magnitude = Math.max(0, value);
  let unit = 0;
  while (magnitude >= 1024 && unit < units.length - 1) {
    magnitude /= 1024;
    unit += 1;
  }
  return `${magnitude >= 100 || unit === 0 ? Math.round(magnitude) : magnitude.toFixed(1)} ${units[unit]}`;
}

export function formatRate(value: number): string {
  return `${formatBytes(value)}/s`;
}

export function formatTemperature(celsius: number): string {
  return `${celsius.toFixed(1)} °C`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days} d ${hours} h`;
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours} h ${minutes} min`;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const styles = StyleSheet.create({
  sectionContent: { gap: 18 },
  sectionIntro: { maxWidth: 850, marginBottom: 4 },
  sectionOverline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.8,
    lineHeight: 43,
  },
  sectionLead: {
    maxWidth: 760,
    marginTop: 8,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 20,
  },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    minWidth: 170,
    flex: 1,
    overflow: "hidden",
    gap: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.panel,
  },
  tileAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  tileLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  tileValue: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tileDetail: { color: colors.inkDim, fontSize: 8, lineHeight: 13 },
  meterTrack: {
    height: 6,
    marginTop: 2,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "rgba(137,166,207,0.16)",
  },
  meterFill: { height: "100%", borderRadius: 3 },
  chartPanel: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.panel,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chartTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chartMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
  },
  legendRow: { flexDirection: "row", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "700" },
  chartCanvas: {
    position: "relative",
    height: 170,
    backgroundColor: CHART_SURFACE,
  },
  axisLabel: {
    position: "absolute",
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    fontVariant: ["tabular-nums"],
  },
  axisMax: { top: 8, left: 8 },
  axisMid: { top: 76, left: 8 },
  axisStart: { bottom: 4, left: 8 },
  axisEnd: { bottom: 4, right: 8 },
  tooltip: {
    position: "absolute",
    top: 10,
    minWidth: 144,
    gap: 4,
    padding: 9,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
    backgroundColor: "rgba(5,9,17,0.96)",
  },
  tooltipTime: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
  },
  tooltipRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tooltipValue: {
    color: colors.ink,
    fontSize: 9,
    fontVariant: ["tabular-nums"],
  },
  chartEmpty: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  chartEmptyText: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 1,
  },
  footnote: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 0.6,
    lineHeight: 12,
  },
  staleNotice: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,207,102,0.32)",
    borderRadius: 8,
    backgroundColor: "rgba(255,207,102,0.07)",
  },
  staleNoticeText: { color: "#d9c08a", fontSize: 9, lineHeight: 15 },
  inlineState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  inlineStateText: { color: colors.inkSoft, fontSize: 10 },
  inlineError: {
    alignItems: "flex-start",
    gap: 9,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255,103,136,0.34)",
    borderRadius: 9,
    backgroundColor: "rgba(255,103,136,0.07)",
  },
  inlineErrorTitle: { color: colors.reported, fontSize: 12, fontWeight: "800" },
  inlineErrorText: { color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
  retryButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
  },
  retryText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    fontWeight: "800",
  },
});
