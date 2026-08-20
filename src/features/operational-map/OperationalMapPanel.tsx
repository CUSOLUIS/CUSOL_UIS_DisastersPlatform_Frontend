import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { useDataRefreshTick } from "../../platform/dataRefresh";
import { CountdownLabel } from "../help-requests/CountdownLabel";
import { HelpRequestActionSheet } from "../help-requests/HelpRequestActionSheet";
import {
  helpRequestIdFromPointId,
  helpRequestsToMapPoints,
} from "../help-requests/mapPoints";
import type {
  ActiveHelpRequest,
  HelpRequestAttendReceipt,
} from "../help-requests/types";
import {
  foodOfferIdFromPointId,
  foodOffersToMapPoints,
} from "../food-offers/mapPoints";
import type { ActiveFoodOffer } from "../food-offers/types";
import {
  damagedHomeIdFromPointId,
  damagedHomesToMapPoints,
} from "../damaged-homes/mapPoints";
import type { ActiveDamagedHome } from "../damaged-homes/types";
import {
  transportIdFromPointId,
  transportsToMapPoints,
  transportsToTrailDots,
} from "../transports/mapPoints";
import type { ActiveTransport } from "../transports/types";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import type { HumanStatus } from "../human-impact/types";
import { ratingSummaryLine } from "../aid-locations/ratingStars";
import { categoryMeta } from "./categoryMeta";
import { CategoryMarkerIcon } from "./CategoryMarkerIcon";
import { humanStatusMeta } from "./humanStatusMeta";
import { MapMarkerPopup, type MapMarkerPopupTarget } from "./MapMarkerPopup";
import type { MapPointDetailPayload } from "./pointDetail";
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
} from "./types";
import {
  humanMapStatuses,
  humanitarianAidLegendCategories,
  infrastructureLegendCategories,
  operationalResponseCategories,
} from "./types";

// CHG-157: los dos bloques de la leyenda del mapa.
const legendSections = [
  {
    title: "INFRAESTRUCTURA · FILTRA UBICACIONES",
    hint: "Estas cifras son ubicaciones operativas, no personas.",
    accessibilityLabel: "Leyenda de infraestructura",
    categories: infrastructureLegendCategories,
  },
  {
    title: "AYUDA HUMANITARIA · FILTRA SOLICITUDES Y PUNTOS DE APOYO",
    hint: "Solicitudes y puntos de apoyo activos; las cifras son ubicaciones, no personas.",
    accessibilityLabel: "Leyenda de ayuda humanitaria",
    categories: humanitarianAidLegendCategories,
  },
] as const;
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

// CHG-148: al tocar una solicitud en el mapa se abre su ventana de
// acción. Con estas acciones presentes, quien tiene cuenta atiende y
// quien no la tiene se ofrece como voluntario. Sin ellas (contextos que
// no las pasan) la solicitud solo muestra información.
export interface HelpRequestMapActions {
  isAuthenticated: boolean;
  attend: (id: string) => Promise<HelpRequestAttendReceipt>;
  onAttended?: () => void;
  onLogin?: () => void;
  onRegister?: () => void;
  pickPhoto?: () => Promise<SelectedPhoto[]>;
}

interface OperationalMapPanelProps {
  dataSource: OperationalMapDataSource;
  humanDataSource: HumanMapDataSource;
  compact: boolean;
  // CHG-125 / DEC-125-10: solicitudes de ayuda vigentes fusionadas en
  // cliente como marcadores `help_request`; nunca vienen del overview.
  helpRequests?: ActiveHelpRequest[];
  helpRequestActions?: HelpRequestMapActions;
  // CHG-163: ofertas de comida vigentes fusionadas en cliente como
  // marcadores `community_meal`; misma regla de expiración server-side.
  foodOffers?: ActiveFoodOffer[];
  // CHG-182: casitas destruidas publicadas por sus familias.
  damagedHomes?: ActiveDamagedHome[];
  // CHG-171: viajes de La Mulera/La Lanchera en curso, fusionados en
  // cliente como marcadores `humanitarian_transport` con su rastro.
  transports?: ActiveTransport[];
  // CHG-164: «VER MÁS» del popup de un marcador abre la vista de
  // información completa (/detalle-punto); sin el callback, el popup
  // solo resume y cierra.
  onOpenPointDetail?: (payload: MapPointDetailPayload) => void;
}

const INITIAL_HUMAN_VIEWPORT: HumanMapViewport = {
  bounds: COLOMBIA_BOUNDS,
  zoom: 5,
};

// CHG-049: alto aproximado del encabezado del dashboard más los
// controles que acompañan al lienzo (situación humana + filtros de
// respuesta y rellenos del panel), para que toda la sección quepa en
// una pantalla sin reacomodar nada.
export const MAP_SECTION_CHROME_HEIGHT = 470;

export function getMapCanvasMinHeight(
  viewportHeight: number,
  compact: boolean,
): number {
  if (compact) return 370;
  return Math.max(
    340,
    Math.min(560, viewportHeight - MAP_SECTION_CHROME_HEIGHT),
  );
}

export function OperationalMapPanel({
  dataSource,
  humanDataSource,
  compact,
  helpRequests = [],
  helpRequestActions,
  foodOffers = [],
  damagedHomes = [],
  transports = [],
  onOpenPointDetail,
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
  // CHG-082: refresco inmediato cuando la señal de cambios avisa.
  const refreshTick = useDataRefreshTick();
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
  }, [dataSource, refreshTick, requestVersion]);

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
      helpRequests={helpRequests}
      helpRequestActions={helpRequestActions}
      foodOffers={foodOffers}
      damagedHomes={damagedHomes}
      transports={transports}
      onOpenPointDetail={onOpenPointDetail}
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
  helpRequests,
  helpRequestActions,
  foodOffers,
  damagedHomes,
  transports,
  onOpenPointDetail,
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
  helpRequests: ActiveHelpRequest[];
  helpRequestActions?: HelpRequestMapActions;
  foodOffers: ActiveFoodOffer[];
  damagedHomes: ActiveDamagedHome[];
  transports: ActiveTransport[];
  onOpenPointDetail?: (payload: MapPointDetailPayload) => void;
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
  // CHG-125 / DEC-125-10: los marcadores de ayuda se fusionan aquí; al
  // expirar, el backend deja de devolver la solicitud y el marcador
  // desaparece en el siguiente refresco sin lógica adicional.
  const mergedItems = useMemo(
    () => [
      ...data.items,
      ...helpRequestsToMapPoints(helpRequests),
      // CHG-163: las ofertas de comida se fusionan igual; comparten la
      // categoría `community_meal` que existía sin datos desde CHG-044.
      ...foodOffersToMapPoints(foodOffers),
      // CHG-182: la casita se fusiona en cliente, como la oferta.
      ...damagedHomesToMapPoints(damagedHomes),
      // CHG-171: los viajes en curso, con su marcador móvil.
      ...transportsToMapPoints(transports),
    ],
    [data.items, helpRequests, foodOffers, damagedHomes, transports],
  );
  // CHG-171: rastro no interactivo del GPS de cada viaje.
  const transportTrailDots = useMemo(
    () => transportsToTrailDots(transports),
    [transports],
  );
  const displaySummary = useMemo(
    () => ({
      ...data.summary,
      helpRequests: helpRequests.length,
      humanitarianTransports: transports.length,
      // Se SUMA al conteo del overview (hoy 0: la publicación de
      // aid-offers sigue bloqueada por DEC-021) en vez de sustituirlo.
      communityMeal: data.summary.communityMeal + foodOffers.length,
      // CHG-182: el contador sale del feed, no de la tabla del mapa.
      damagedHome: damagedHomes.length,
    }),
    [
      data.summary,
      helpRequests.length,
      foodOffers.length,
      damagedHomes.length,
      transports.length,
    ],
  );
  const visiblePoints = useMemo(
    () => mergedItems.filter((point) => activeCategories.includes(point.category)),
    [activeCategories, mergedItems],
  );
  const selectedPoint =
    visiblePoints.find((point) => point.id === selectedId) ??
    visiblePoints[0] ??
    null;
  const selectedHelpRequest = useMemo(() => {
    const rawId = selectedPoint
      ? helpRequestIdFromPointId(selectedPoint.id)
      : null;
    return rawId
      ? (helpRequests.find((request) => request.id === rawId) ?? null)
      : null;
  }, [helpRequests, selectedPoint]);
  // CHG-148: la solicitud cuya ventana de acción está abierta (solo al
  // tocar explícitamente su marcador; nunca por la selección inicial).
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  // CHG-164: el popup de resumen del marcador tocado. Guarda el
  // registro (no el id): sigue legible aunque el punto salga del
  // overview o el clúster se reparta en el siguiente refresco.
  const [popupTarget, setPopupTarget] = useState<MapMarkerPopupTarget | null>(
    null,
  );
  const handleSelect = useCallback(
    (pointId: string) => {
      setSelectedId(pointId);
      const point = mergedItems.find((item) => item.id === pointId);
      if (!point) {
        return;
      }
      const rawHelpId = helpRequestIdFromPointId(pointId);
      const request = rawHelpId
        ? (helpRequests.find((item) => item.id === rawHelpId) ?? null)
        : null;
      if (request && helpRequestActions) {
        // CHG-148: con acciones disponibles, la solicitud conserva su
        // ventana de acción (ya es un popup con info, VER MÁS y
        // cierre); no se le superpone el popup genérico.
        setPopupTarget(null);
        setActionRequestId(request.id);
        return;
      }
      if (request) {
        setPopupTarget({ kind: "help_request", request });
        return;
      }
      const rawFoodId = foodOfferIdFromPointId(pointId);
      const offer = rawFoodId
        ? (foodOffers.find((item) => item.id === rawFoodId) ?? null)
        : null;
      if (offer) {
        setPopupTarget({ kind: "food_offer", offer });
        return;
      }
      // CHG-182: la casita abre su popup con la leyenda resumen, su
      // puntuación y el VER MÁS hacia la ficha completa.
      const rawHomeId = damagedHomeIdFromPointId(pointId);
      const home = rawHomeId
        ? (damagedHomes.find((item) => item.id === rawHomeId) ?? null)
        : null;
      if (home) {
        setPopupTarget({ kind: "damaged_home", home });
        return;
      }
      // CHG-171: el marcador de un viaje abre su popup con estado,
      // salida y llegada.
      const rawTransportId = transportIdFromPointId(pointId);
      const transport = rawTransportId
        ? (transports.find((item) => item.id === rawTransportId) ?? null)
        : null;
      setPopupTarget(
        transport
          ? { kind: "transport", transport }
          : { kind: "operational", point },
      );
    },
    [
      setSelectedId,
      helpRequestActions,
      helpRequests,
      foodOffers,
      damagedHomes,
      transports,
      mergedItems,
    ],
  );
  const actionRequest = useMemo(
    () =>
      actionRequestId
        ? (helpRequests.find((request) => request.id === actionRequestId) ??
          null)
        : null,
    [actionRequestId, helpRequests],
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
  // CHG-164: tocar un punto o clúster de la capa humana también abre
  // su popup de resumen (los clústeres, sin «VER MÁS»: son anónimos).
  const handleSelectHumanFeature = useCallback(
    (featureId: string) => {
      setSelectedHumanFeatureId(featureId);
      const feature = humanFeatures.find((item) => item.id === featureId);
      if (feature) {
        setPopupTarget({ kind: "human", feature });
      }
    },
    [setSelectedHumanFeatureId, humanFeatures],
  );
  const handleViewMore = useCallback(
    (payload: MapPointDetailPayload) => {
      setPopupTarget(null);
      onOpenPointDetail?.(payload);
    },
    [onOpenPointDetail],
  );

  const toggleCategory = (category: OperationalMapCategory) => {
    setActiveCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const { height: viewportHeight } = useWindowDimensions();
  const canvasMinHeight = getMapCanvasMinHeight(viewportHeight, compact);

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
      {/* CHG-164: el popup de resumen vive sobre el lienzo, para que
          el «VER MÁS» y la «X» queden junto al marcador tocado. */}
      <View style={styles.canvasWrap}>
        <OperationalMapCanvas
          points={visiblePoints}
          trailDots={
            activeCategories.includes("humanitarian_transport")
              ? transportTrailDots
              : []
          }
          selectedId={selectedPoint?.id ?? null}
          onSelect={handleSelect}
          compact={compact}
          canvasMinHeight={canvasMinHeight}
          humanFeatures={humanFeatures}
          selectedHumanFeatureId={selectedHumanFeature?.id ?? null}
          onSelectHumanFeature={handleSelectHumanFeature}
          onViewportChange={onViewportChange}
        />
        {popupTarget && (
          <MapMarkerPopup
            target={popupTarget}
            onClose={() => setPopupTarget(null)}
            onViewMore={onOpenPointDetail ? handleViewMore : undefined}
          />
        )}
      </View>

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

      {/* CHG-125: los datos de la solicitud elegida en el mapa —
          descripción, dirección, vigencia y cuánta gente atiende.
          CHG-181: y, como en la tarjeta de un centro de acopio, su
          calificación y el paso a la ficha completa. Era la última
          superficie de la solicitud sin esas dos piezas. */}
      {selectedHelpRequest && (
        <View style={styles.detail} testID="help-request-map-detail">
          <View
            style={[styles.detailAccent, { backgroundColor: colors.emergency }]}
          />
          <View style={styles.detailMain}>
            <Text style={[styles.detailCategory, { color: colors.emergency }]}>
              NECESITAMOS AYUDA · SOLICITUD VIGENTE
            </Text>
            <Text style={styles.detailTitle}>{selectedHelpRequest.address}</Text>
            <Text
              style={styles.detailRating}
              testID="help-request-map-detail-rating"
            >
              {ratingSummaryLine(
                selectedHelpRequest.commentRatingAverage ?? null,
                selectedHelpRequest.commentRatingCount ?? 0,
              )}
            </Text>
            <Text style={styles.detailDescription}>
              {selectedHelpRequest.description}
            </Text>
          </View>
          <View style={styles.detailMeta}>
            <CountdownLabel
              expiresAt={selectedHelpRequest.expiresAt}
              style={[styles.detailMetaText, { color: colors.emergency }]}
            />
            <Text style={styles.detailMetaText}>
              {selectedHelpRequest.attendersCount === 1
                ? "1 PERSONA ATENDIENDO"
                : `${mapNumberFormatter.format(selectedHelpRequest.attendersCount)} PERSONAS ATENDIENDO`}
            </Text>
            {onOpenPointDetail && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver más información de la solicitud"
                onPress={() =>
                  onOpenPointDetail({
                    kind: "help_request",
                    request: selectedHelpRequest,
                  })
                }
                style={styles.detailMoreButton}
                testID="help-request-map-detail-more"
              >
                <Text style={styles.detailMoreText}>VER MÁS →</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* CHG-177: la oferta de comida ya no abre una banda informativa
          bajo el dashboard. Al tocar su marcador se explica todo en el
          popup, con su VER MÁS; repetirlo abajo solo alargaba la
          portada. */}

      {/* CHG-148: ventana de acción al tocar la solicitud — con cuenta
          se atiende; sin cuenta se ofrece como voluntario. */}
      {helpRequestActions && actionRequest && (
        <HelpRequestActionSheet
          request={actionRequest}
          visible
          onClose={() => setActionRequestId(null)}
          isAuthenticated={helpRequestActions.isAuthenticated}
          attend={helpRequestActions.attend}
          onAttended={helpRequestActions.onAttended}
          onLogin={helpRequestActions.onLogin}
          onRegister={helpRequestActions.onRegister}
          pickPhoto={helpRequestActions.pickPhoto}
          // CHG-164: también la ventana de acción ofrece la vista de
          // información completa de la solicitud.
          onViewMore={
            onOpenPointDetail
              ? () => {
                  setActionRequestId(null);
                  onOpenPointDetail({
                    kind: "help_request",
                    request: actionRequest,
                  });
                }
              : undefined
          }
        />
      )}

      {/* CHG-157: la leyenda se divide en dos bloques — la
          infraestructura por un lado y la ayuda humanitaria
          (solicitudes y puntos de apoyo) por el otro. */}
      {legendSections.map((section) => (
        <View
          key={section.title}
          style={styles.legend}
          accessibilityLabel={section.accessibilityLabel}
        >
          <View style={styles.legendHeading}>
            <Text style={styles.legendTitle}>{section.title}</Text>
            <Text style={styles.legendHint}>{section.hint}</Text>
          </View>
          <View style={styles.filters}>
          {section.categories.map((category) => {
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
                    {displaySummary[meta.summaryKey]}
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
      ))}

    </MapFrame>
  );
}

// CHG-099: la capa contaba solo lo dibujado, así que "Confirmadas
// vivas: 0" convivía con "CONFIRMADOS VIVOS: 1" en las cifras de la
// portada y se leía como una contradicción. Ahora suma también a
// quienes no se pueden ubicar, que es lo que miden esas cifras.
function countHumanStatuses(
  features: HumanMapFeature[],
  unmapped?: HumanMapStatusCounts,
): HumanMapStatusCounts {
  const counts: HumanMapStatusCounts = {
    missing: unmapped?.missing ?? 0,
    reportedDeceased: unmapped?.reportedDeceased ?? 0,
    confirmedAlive: unmapped?.confirmedAlive ?? 0,
    confirmedDeceased: unmapped?.confirmedDeceased ?? 0,
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

// CHG-098: se exporta para poder probar el aviso de personas sin
// ubicación sin montar el mapa completo.
export function HumanMapControls({
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
  const statusCounts = countHumanStatuses(
    data?.features ?? [],
    data?.unmappedStatusCounts,
  );
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
          <Text style={styles.humanLayerOverline}>PERSONAS / GEO CLUSTERS</Text>
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
            {mapNumberFormatter.format(data.unmappedCount)}{" "}
            {data.unmappedCount === 1
              ? "persona registrada no aparece en el mapa"
              : "personas registradas no aparecen en el mapa"}{" "}
            porque su reporte no incluyó ubicación. Siguen contando en las
            cifras; no se inventaron posiciones.
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
  // CHG-164: contenedor del lienzo para anclar el popup del marcador.
  canvasWrap: { position: "relative", width: "100%" },
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
    fontSize: font(11),
    letterSpacing: 1.2,
  },
  title: { color: colors.ink, fontSize: font(20), fontWeight: "600", letterSpacing: -0.6 },
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
    fontSize: font(11),
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
    fontSize: font(11), fontWeight: "800", letterSpacing: 1,
  },
  humanLayerTitle: { color: colors.ink, fontSize: font(16), fontWeight: "700" },
  humanLayerDescription: {
    maxWidth: 680, marginTop: 3, color: colors.inkSoft,
    fontSize: font(11), lineHeight: 17,
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
    fontSize: font(11), fontWeight: "800", letterSpacing: 0.7,
  },
  humanStatusLine: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", gap: 6,
  },
  humanStatusText: {
    color: colors.alive, fontFamily: fontFamilies.mono,
    fontSize: font(11), fontWeight: "800", letterSpacing: 0.8,
  },
  humanTotalText: {
    color: colors.cyan, fontFamily: fontFamilies.mono,
    fontSize: font(11), fontWeight: "800",
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
    fontFamily: fontFamilies.mono, fontSize: font(17), fontWeight: "900",
  },
  humanFilterLabel: { color: colors.inkSoft, fontSize: font(12), fontWeight: "700" },
  humanLayerNotice: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", gap: 8, padding: 9, borderWidth: 1,
    borderColor: "rgba(255,207,102,0.28)", borderRadius: 7,
    backgroundColor: "rgba(255,207,102,0.06)",
  },
  humanLayerNoticeText: {
    minWidth: 160, flex: 1, color: colors.inkSoft, fontSize: font(11), lineHeight: 17,
  },
  humanRetry: {
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
    borderColor: colors.cyan, borderRadius: 5,
  },
  humanRetryText: {
    color: colors.cyan, fontFamily: fontFamilies.mono,
    fontSize: font(11), fontWeight: "800",
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
    fontSize: font(11), fontWeight: "800", letterSpacing: 0.7,
  },
  humanDetailTitle: {
    marginTop: 3, color: colors.ink, fontSize: font(14), fontWeight: "800",
  },
  humanDetailCounts: { alignItems: "flex-end", gap: 2 },
  humanDetailCount: {
    fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "800",
  },
  humanDetailMeta: {
    color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11),
  },
  legend: { gap: 8, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: "rgba(9,15,26,0.86)" },
  legendHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 },
  legendTitle: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "800", letterSpacing: 0.8 },
  legendHint: { color: colors.inkDim, fontSize: font(11) },
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
  filterCount: { fontFamily: fontFamilies.mono, fontSize: font(17), fontWeight: "800" },
  filterLabel: { flex: 1, color: colors.inkSoft, fontSize: font(12), fontWeight: "700" },
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
    fontSize: font(11),
    fontWeight: "700",
    letterSpacing: 1,
  },
  mapTime: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11) },
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
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  detailTitle: { color: colors.ink, fontSize: font(11), fontWeight: "700" },
  detailLocation: { marginTop: 3, color: colors.inkSoft, fontSize: font(11) },
  detailDescription: { maxWidth: 660, marginTop: 6, color: colors.inkSoft, fontSize: font(11), lineHeight: 17 },
  // CHG-181: misma línea de estrellas que el popup del marcador.
  detailRating: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
  },
  detailMeta: { alignItems: "flex-end", gap: 2 },
  detailMoreButton: {
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
  },
  detailMoreText: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  detailMetaText: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11) },
  noSelection: {
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  noSelectionText: { color: colors.inkDim, fontSize: font(11) },
  state: {
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  stateText: { color: colors.inkSoft, fontSize: font(11), lineHeight: 18, textAlign: "center" },
  errorTitle: { color: colors.reported, fontSize: font(14), fontWeight: "700", textAlign: "center" },
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
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1,
  },
});
