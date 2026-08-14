import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import type { HumanStatus } from "../human-impact/types";
import { categoryMeta } from "./categoryMeta";
import { CategoryMarkerIcon } from "./CategoryMarkerIcon";
import { humanStatusMeta } from "./humanStatusMeta";
import { OperationalMapCanvas } from "./OperationalMapCanvas";
import type {
  HumanMapDataSource,
  HumanMapFeature,
  HumanMapOverview,
  HumanMapStatusCounts,
  HumanMapViewport,
  OperationalMapCategory,
  OperationalMapDataSource,
  OperationalMapOverview,
  OperationalMapPoint,
} from "./types";
import { humanMapStatuses, operationalResponseCategories } from "./types";
import {
  type HumanMapLoadState,
  useHumanMapLayer,
} from "./useHumanMapLayer";
import { COLOMBIA_BOUNDS } from "./webMercator";

type MapLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: OperationalMapOverview; stale: boolean };

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const mapNumberFormatter = new Intl.NumberFormat("es-CO");

const verificationLabels = {
  unverified: "Sin verificar",
  under_review: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
} as const;

const precisionLabels = {
  exact: "Coordenada exacta",
  approximate: "Zona aproximada",
  municipality: "Referencia municipal",
} as const;

interface OperationalMapPanelProps {
  dataSource: OperationalMapDataSource;
  humanDataSource: HumanMapDataSource;
  compact: boolean;
}

const INITIAL_HUMAN_VIEWPORT: HumanMapViewport = {
  bounds: COLOMBIA_BOUNDS,
  zoom: 5,
};

export function OperationalMapPanel({
  dataSource,
  humanDataSource,
  compact,
}: OperationalMapPanelProps) {
  const [loadState, setLoadState] = useState<MapLoadState>(() =>
    dataSource.initialOverview
      ? { status: "success", data: dataSource.initialOverview, stale: false }
      : { status: "loading" },
  );
  const [activeCategories, setActiveCategories] = useState<OperationalMapCategory[]>([
    ...operationalResponseCategories,
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [humanLayerVisible, setHumanLayerVisible] = useState(true);
  const [activeHumanStatuses, setActiveHumanStatuses] = useState<HumanStatus[]>([
    ...humanMapStatuses,
  ]);
  const [selectedHumanFeatureId, setSelectedHumanFeatureId] = useState<
    string | null
  >(null);
  const [humanViewport, setHumanViewport] = useState<HumanMapViewport>(
    INITIAL_HUMAN_VIEWPORT,
  );
  const { loadState: humanLoadState, retry: retryHumanMap } = useHumanMapLayer({
    dataSource: humanDataSource,
    enabled: humanLayerVisible,
    statuses: activeHumanStatuses,
    viewport: humanViewport,
  });
  const handleViewportChange = useCallback((viewport: HumanMapViewport) => {
    setHumanViewport((current) =>
      current.zoom === viewport.zoom &&
      current.bounds.west === viewport.bounds.west &&
      current.bounds.south === viewport.bounds.south &&
      current.bounds.east === viewport.bounds.east &&
      current.bounds.north === viewport.bounds.north
        ? current
        : viewport,
    );
  }, []);

  useEffect(() => {
    if (dataSource.transport === "fixture" && dataSource.initialOverview) {
      return;
    }

    const controller = new AbortController();

    const loadOverview = async () => {
      try {
        const data = await dataSource.getOverview(controller.signal);
        setLoadState({ status: "success", data, stale: false });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "No fue posible consultar el mapa operativo.";

        setLoadState((current) =>
          current.status === "success"
            ? { ...current, stale: true }
            : { status: "error", message },
        );
      }
    };

    void loadOverview();
    const refreshTimer =
      dataSource.transport === "api"
        ? globalThis.setInterval(() => void loadOverview(), 30_000)
        : undefined;

    return () => {
      controller.abort();
      if (refreshTimer !== undefined) {
        globalThis.clearInterval(refreshTimer);
      }
    };
  }, [dataSource, requestVersion]);

  const retry = () => {
    setLoadState({ status: "loading" });
    setRequestVersion((current) => current + 1);
  };

  if (loadState.status === "loading") {
    return (
      <MapFrame compact={compact} status="CARGANDO">
        <View style={styles.state} accessibilityLabel="Cargando mapa operativo">
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.stateText}>Sincronizando puntos operativos…</Text>
        </View>
      </MapFrame>
    );
  }

  if (loadState.status === "error") {
    return (
      <MapFrame compact={compact} status="NO DISPONIBLE">
        <View style={styles.state} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Mapa temporalmente no disponible</Text>
          <Text style={styles.stateText}>{loadState.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga del mapa"
            onPress={retry}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>REINTENTAR</Text>
          </Pressable>
        </View>
      </MapFrame>
    );
  }

  return (
    <MapContent
      data={loadState.data}
      stale={loadState.stale}
      compact={compact}
      activeCategories={activeCategories}
      setActiveCategories={setActiveCategories}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      humanLayerVisible={humanLayerVisible}
      setHumanLayerVisible={setHumanLayerVisible}
      activeHumanStatuses={activeHumanStatuses}
      setActiveHumanStatuses={setActiveHumanStatuses}
      selectedHumanFeatureId={selectedHumanFeatureId}
      setSelectedHumanFeatureId={setSelectedHumanFeatureId}
      humanLoadState={humanLoadState}
      retryHumanMap={retryHumanMap}
      onViewportChange={handleViewportChange}
    />
  );
}

function MapContent({
  data,
  stale,
  compact,
  activeCategories,
  setActiveCategories,
  selectedId,
  setSelectedId,
  humanLayerVisible,
  setHumanLayerVisible,
  activeHumanStatuses,
  setActiveHumanStatuses,
  selectedHumanFeatureId,
  setSelectedHumanFeatureId,
  humanLoadState,
  retryHumanMap,
  onViewportChange,
}: {
  data: OperationalMapOverview;
  stale: boolean;
  compact: boolean;
  activeCategories: OperationalMapCategory[];
  setActiveCategories: React.Dispatch<React.SetStateAction<OperationalMapCategory[]>>;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  humanLayerVisible: boolean;
  setHumanLayerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  activeHumanStatuses: HumanStatus[];
  setActiveHumanStatuses: React.Dispatch<React.SetStateAction<HumanStatus[]>>;
  selectedHumanFeatureId: string | null;
  setSelectedHumanFeatureId: React.Dispatch<React.SetStateAction<string | null>>;
  humanLoadState: HumanMapLoadState;
  retryHumanMap: () => void;
  onViewportChange: (viewport: HumanMapViewport) => void;
}) {
  const visiblePoints = useMemo(
    () => data.items.filter((point) => activeCategories.includes(point.category)),
    [activeCategories, data.items],
  );
  const selectedPoint =
    visiblePoints.find((point) => point.id === selectedId) ??
    visiblePoints[0] ??
    null;
  const handleSelect = useCallback(
    (pointId: string) => setSelectedId(pointId),
    [setSelectedId],
  );
  const humanData =
    humanLoadState.status === "success" ? humanLoadState.data : null;
  const humanFeatures =
    humanLayerVisible && activeHumanStatuses.length > 0
      ? (humanData?.features ?? [])
      : [];
  const selectedHumanFeature =
    humanFeatures.find((feature) => feature.id === selectedHumanFeatureId) ??
    null;

  const toggleCategory = (category: OperationalMapCategory) => {
    setActiveCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const accessibleSummary = visiblePoints
    .map((point) => {
      const meta = categoryMeta[point.category];
      return `${meta.label}: ${point.title}, ${point.locationLabel}`;
    })
    .join(". ");

  return (
    <MapFrame
      compact={compact}
      status={
        stale
          ? "DESACTUALIZADO"
          : data.dataClassification === "demonstrative"
            ? "DATOS DEMO"
            : "OPERATIVO"
      }
    >
      <OperationalMapCanvas
        points={visiblePoints}
        selectedId={selectedPoint?.id ?? null}
        onSelect={handleSelect}
        compact={compact}
        humanFeatures={humanFeatures}
        selectedHumanFeatureId={selectedHumanFeature?.id ?? null}
        onSelectHumanFeature={setSelectedHumanFeatureId}
        onViewportChange={onViewportChange}
      />

      <HumanMapControls
        activeStatuses={activeHumanStatuses}
        data={humanData}
        layerVisible={humanLayerVisible}
        loadState={humanLoadState}
        onRetry={retryHumanMap}
        onToggleLayer={() => setHumanLayerVisible((current) => !current)}
        onToggleStatus={(status) => {
          setSelectedHumanFeatureId(null);
          setActiveHumanStatuses((current) =>
            current.includes(status)
              ? current.filter((item) => item !== status)
              : [...current, status],
          );
        }}
        selectedFeature={selectedHumanFeature}
      />

      <View
        style={styles.legend}
        accessibilityLabel="Leyenda de respuesta e infraestructura"
      >
        <View style={styles.legendHeading}>
          <Text style={styles.legendTitle}>
            RESPUESTA E INFRAESTRUCTURA · FILTRA UBICACIONES
          </Text>
          <Text style={styles.legendHint}>
            Estas cifras son ubicaciones operativas, no personas.
          </Text>
        </View>
        <View style={styles.filters}>
        {operationalResponseCategories.map((category) => {
          const meta = categoryMeta[category];
          const active = activeCategories.includes(category);

          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar mapa por ${meta.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => toggleCategory(category)}
              style={[
                styles.filter,
                active && { borderColor: meta.color, backgroundColor: `${meta.color}12` },
              ]}
            >
              <CategoryMarkerIcon category={category} animated={false} />
              <View style={styles.filterCopy}>
                <Text style={[styles.filterCount, { color: active ? meta.color : colors.inkDim }]}>
                  {data.summary[meta.summaryKey]}
                </Text>
                <Text style={[styles.filterLabel, !active && styles.filterLabelInactive]}>
                  {meta.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`${visiblePoints.length} ubicaciones de respuesta e infraestructura visibles. ${accessibleSummary}`}
        style={styles.mapCount}
      >
        <Text style={styles.mapCountText}>
          {visiblePoints.length.toString().padStart(2, "0")} UBICACIONES OPERATIVAS
        </Text>
        <Text style={styles.mapTime}>
          CORTE {dateFormatter.format(new Date(data.generatedAt)).toUpperCase()}
        </Text>
      </View>

      {selectedPoint ? (
        <PointDetail point={selectedPoint} />
      ) : (
        <View style={styles.noSelection}>
          <Text style={styles.noSelectionText}>
            Activa una categoría para consultar sus ubicaciones.
          </Text>
        </View>
      )}
    </MapFrame>
  );
}

function countHumanStatuses(
  features: HumanMapFeature[],
): HumanMapStatusCounts {
  const counts: HumanMapStatusCounts = {
    missing: 0,
    reportedDeceased: 0,
    confirmedAlive: 0,
    confirmedDeceased: 0,
  };
  features.forEach((feature) => {
    if (feature.kind === "cluster") {
      counts.missing += feature.statusCounts.missing;
      counts.reportedDeceased += feature.statusCounts.reportedDeceased;
      counts.confirmedAlive += feature.statusCounts.confirmedAlive;
      counts.confirmedDeceased += feature.statusCounts.confirmedDeceased;
      return;
    }
    counts[humanStatusMeta[feature.status].countKey] += 1;
  });
  return counts;
}

function HumanMapControls({
  activeStatuses,
  data,
  layerVisible,
  loadState,
  onRetry,
  onToggleLayer,
  onToggleStatus,
  selectedFeature,
}: {
  activeStatuses: HumanStatus[];
  data: HumanMapOverview | null;
  layerVisible: boolean;
  loadState: HumanMapLoadState;
  onRetry: () => void;
  onToggleLayer: () => void;
  onToggleStatus: (status: HumanStatus) => void;
  selectedFeature: HumanMapFeature | null;
}) {
  const statusCounts = countHumanStatuses(data?.features ?? []);
  const status = !layerVisible
    ? "CAPA OCULTA"
    : activeStatuses.length === 0
      ? "SIN ESTADOS ACTIVOS"
      : loadState.status === "loading"
        ? "CARGANDO"
        : loadState.status === "error"
          ? "NO DISPONIBLE"
          : loadState.stale
            ? "DESACTUALIZADA"
            : loadState.refreshing
              ? "ACTUALIZANDO"
              : "SINCRONIZADA";

  return (
    <View
      accessibilityLabel="Capa de situación humana"
      style={styles.humanLayer}
      testID="human-map-layer-controls"
    >
      <View style={styles.humanLayerHeading}>
        <View style={styles.humanLayerCopy}>
          <Text style={styles.humanLayerOverline}>PEOPLE / GEO CLUSTERS</Text>
          <Text style={styles.humanLayerTitle}>Situación humana</Text>
          <Text style={styles.humanLayerDescription}>
            Todos los registros georreferenciables se agrupan y se dividen al acercar.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Mostrar capa de situación humana"
          accessibilityRole="switch"
          accessibilityState={{ checked: layerVisible }}
          onPress={onToggleLayer}
          style={[styles.layerToggle, layerVisible && styles.layerToggleActive]}
        >
          <View
            style={[
              styles.layerToggleDot,
              layerVisible && styles.layerToggleDotActive,
            ]}
          />
          <Text style={styles.layerToggleText}>
            {layerVisible ? "VISIBLE" : "OCULTA"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.humanStatusLine}>
        <Text style={styles.humanStatusText}>{status}</Text>
        {data && (
          <Text style={styles.humanTotalText}>
            {mapNumberFormatter.format(data.totalMapped)} PERSONAS EN MAPA · {data.returnedFeatures} FEATURES
          </Text>
        )}
      </View>

      <View style={styles.humanFilters}>
        {humanMapStatuses.map((humanStatus) => {
          const meta = humanStatusMeta[humanStatus];
          const active = activeStatuses.includes(humanStatus);
          return (
            <Pressable
              key={humanStatus}
              accessibilityLabel={`Filtrar capa humana por ${meta.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onToggleStatus(humanStatus)}
              style={[
                styles.humanFilter,
                active && {
                  borderColor: meta.color,
                  backgroundColor: `${meta.color}12`,
                },
              ]}
            >
              <View style={[styles.humanFilterDot, { backgroundColor: meta.color }]} />
              <View style={styles.humanFilterCopy}>
                <Text
                  style={[
                    styles.humanFilterCount,
                    { color: active ? meta.color : colors.inkDim },
                  ]}
                >
                  {mapNumberFormatter.format(statusCounts[meta.countKey])}
                </Text>
                <Text
                  style={[
                    styles.humanFilterLabel,
                    !active && styles.filterLabelInactive,
                  ]}
                >
                  {meta.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {loadState.status === "error" && layerVisible && (
        <View style={styles.humanLayerNotice} accessibilityRole="alert">
          <Text style={styles.humanLayerNoticeText}>{loadState.message}</Text>
          <Pressable
            accessibilityLabel="Reintentar capa de situación humana"
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.humanRetry}
          >
            <Text style={styles.humanRetryText}>REINTENTAR</Text>
          </Pressable>
        </View>
      )}

      {data && data.unmappedCount > 0 && (
        <View style={styles.humanLayerNotice} accessibilityRole="alert">
          <Text style={styles.humanLayerNoticeText}>
            {mapNumberFormatter.format(data.unmappedCount)} registros sin ubicación pública; no se inventaron posiciones.
          </Text>
        </View>
      )}

      {selectedFeature && <HumanFeatureDetail feature={selectedFeature} />}
    </View>
  );
}

function HumanFeatureDetail({ feature }: { feature: HumanMapFeature }) {
  if (feature.kind === "cluster") {
    return (
      <View style={styles.humanDetail} testID="human-map-cluster-detail">
        <View style={styles.humanDetailMain}>
          <Text style={styles.humanDetailEyebrow}>GRUPO ANÓNIMO · SELECCIONA PARA ACERCAR</Text>
          <Text style={styles.humanDetailTitle}>
            {mapNumberFormatter.format(feature.count)} personas
          </Text>
        </View>
        <View style={styles.humanDetailCounts}>
          {humanMapStatuses.map((status) => {
            const meta = humanStatusMeta[status];
            return (
              <Text key={status} style={[styles.humanDetailCount, { color: meta.color }]}>
                {mapNumberFormatter.format(feature.statusCounts[meta.countKey])} {meta.label}
              </Text>
            );
          })}
        </View>
      </View>
    );
  }

  const meta = humanStatusMeta[feature.status];
  return (
    <View style={styles.humanDetail} testID="human-map-point-detail">
      <View style={styles.humanDetailMain}>
        <Text style={[styles.humanDetailEyebrow, { color: meta.color }]}>
          PUNTO PÚBLICO ANÓNIMO
        </Text>
        <Text style={styles.humanDetailTitle}>{meta.singular}</Text>
      </View>
      <View style={styles.humanDetailCounts}>
        <Text style={styles.humanDetailMeta}>{precisionLabels[feature.coordinatePrecision]}</Text>
        <Text style={styles.humanDetailMeta}>{verificationLabels[feature.verificationStatus]}</Text>
        <Text style={styles.humanDetailMeta}>{feature.source.name}</Text>
        <Text style={styles.humanDetailMeta}>{dateFormatter.format(new Date(feature.updatedAt))}</Text>
      </View>
    </View>
  );
}

function PointDetail({ point }: { point: OperationalMapPoint }) {
  const meta = categoryMeta[point.category];

  return (
    <View style={styles.detail} testID="operational-map-detail">
      <View style={[styles.detailAccent, { backgroundColor: meta.color }]} />
      <View style={styles.detailMain}>
        <Text style={[styles.detailCategory, { color: meta.color }]}>{meta.shortLabel}</Text>
        <Text style={styles.detailTitle}>{point.title}</Text>
        <Text style={styles.detailLocation}>{point.locationLabel}</Text>
        {point.description && <Text style={styles.detailDescription}>{point.description}</Text>}
      </View>
      <View style={styles.detailMeta}>
        <Text style={styles.detailMetaText}>{verificationLabels[point.verificationStatus]}</Text>
        <Text style={styles.detailMetaText}>{precisionLabels[point.coordinatePrecision]}</Text>
        <Text style={styles.detailMetaText}>{point.source.name}</Text>
        <Text style={styles.detailMetaText}>
          {dateFormatter.format(new Date(point.updatedAt))}
        </Text>
      </View>
    </View>
  );
}

function MapFrame({
  compact,
  status,
  children,
}: {
  compact: boolean;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.overline}>RESPONSE / GEOINT</Text>
          <Text style={styles.title} accessibilityRole="header">Mapa operativo</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    flexShrink: 0,
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(81, 229, 255, 0.20)",
    borderRadius: 14,
    backgroundColor: "rgba(7, 12, 22, 0.94)",
  },
  panelCompact: { width: "100%", padding: 10 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overline: {
    marginBottom: 3,
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 1.2,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "600", letterSpacing: -0.6 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.alive },
  statusText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  humanLayer: {
    gap: 9, padding: 11, borderWidth: 1,
    borderColor: "rgba(81,229,255,0.26)", borderRadius: 10,
    backgroundColor: "rgba(7,18,30,0.92)",
  },
  humanLayerHeading: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", gap: 12,
  },
  humanLayerCopy: { minWidth: 0, flex: 1 },
  humanLayerOverline: {
    marginBottom: 3, color: colors.cyan, fontFamily: fontFamilies.mono,
    fontSize: 7, fontWeight: "800", letterSpacing: 1,
  },
  humanLayerTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  humanLayerDescription: {
    maxWidth: 680, marginTop: 3, color: colors.inkSoft,
    fontSize: 9, lineHeight: 14,
  },
  layerToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1,
    borderColor: colors.line, borderRadius: 6,
  },
  layerToggleActive: { borderColor: "rgba(81,229,255,0.46)" },
  layerToggleDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkDim,
  },
  layerToggleDotActive: { backgroundColor: colors.alive },
  layerToggleText: {
    color: colors.inkSoft, fontFamily: fontFamilies.mono,
    fontSize: 7, fontWeight: "800", letterSpacing: 0.7,
  },
  humanStatusLine: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", gap: 6,
  },
  humanStatusText: {
    color: colors.alive, fontFamily: fontFamilies.mono,
    fontSize: 7, fontWeight: "800", letterSpacing: 0.8,
  },
  humanTotalText: {
    color: colors.cyan, fontFamily: fontFamilies.mono,
    fontSize: 7, fontWeight: "800",
  },
  humanFilters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  humanFilter: {
    minWidth: 180, flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 9, paddingVertical: 8, borderWidth: 1,
    borderColor: colors.line, borderRadius: 7,
    backgroundColor: "rgba(13,20,33,0.80)",
  },
  humanFilterDot: { width: 8, height: 8, borderRadius: 4 },
  humanFilterCopy: { minWidth: 0, flex: 1 },
  humanFilterCount: {
    fontFamily: fontFamilies.mono, fontSize: 13, fontWeight: "900",
  },
  humanFilterLabel: { color: colors.inkSoft, fontSize: 8, fontWeight: "700" },
  humanLayerNotice: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", gap: 8, padding: 9, borderWidth: 1,
    borderColor: "rgba(255,207,102,0.28)", borderRadius: 7,
    backgroundColor: "rgba(255,207,102,0.06)",
  },
  humanLayerNoticeText: {
    minWidth: 160, flex: 1, color: colors.inkSoft, fontSize: 8, lineHeight: 13,
  },
  humanRetry: {
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
    borderColor: colors.cyan, borderRadius: 5,
  },
  humanRetryText: {
    color: colors.cyan, fontFamily: fontFamilies.mono,
    fontSize: 7, fontWeight: "800",
  },
  humanDetail: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", gap: 12, padding: 10,
    borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8,
    backgroundColor: "rgba(11,19,32,0.92)",
  },
  humanDetailMain: { minWidth: 180, flex: 1 },
  humanDetailEyebrow: {
    color: colors.cyan, fontFamily: fontFamilies.mono,
    fontSize: 7, fontWeight: "800", letterSpacing: 0.7,
  },
  humanDetailTitle: {
    marginTop: 3, color: colors.ink, fontSize: 14, fontWeight: "800",
  },
  humanDetailCounts: { alignItems: "flex-end", gap: 2 },
  humanDetailCount: {
    fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800",
  },
  humanDetailMeta: {
    color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7,
  },
  legend: { gap: 8, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: "rgba(9,15,26,0.86)" },
  legendHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 },
  legendTitle: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  legendHint: { color: colors.inkDim, fontSize: 8 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filter: {
    minWidth: 210,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: "rgba(13, 20, 33, 0.80)",
  },
  filterCopy: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  filterCount: { fontFamily: fontFamilies.mono, fontSize: 13, fontWeight: "800" },
  filterLabel: { flex: 1, color: colors.inkSoft, fontSize: 8, fontWeight: "700" },
  filterLabelInactive: { color: colors.inkDim, textDecorationLine: "line-through" },
  mapCount: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mapCountText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1,
  },
  mapTime: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7 },
  detail: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.panel,
  },
  detailAccent: { position: "absolute", top: 0, bottom: 0, left: 0, width: 2 },
  detailMain: { minWidth: 0, flex: 1 },
  detailCategory: {
    marginBottom: 3,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  detailTitle: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  detailLocation: { marginTop: 3, color: colors.inkSoft, fontSize: 9 },
  detailDescription: { maxWidth: 660, marginTop: 6, color: colors.inkDim, fontSize: 8, lineHeight: 13 },
  detailMeta: { alignItems: "flex-end", gap: 2 },
  detailMetaText: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7 },
  noSelection: {
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  noSelectionText: { color: colors.inkDim, fontSize: 10 },
  state: {
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  stateText: { color: colors.inkSoft, fontSize: 11, lineHeight: 18, textAlign: "center" },
  errorTitle: { color: colors.reported, fontSize: 14, fontWeight: "700", textAlign: "center" },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 6,
  },
  retryText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
