import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { categoryMeta } from "./categoryMeta";
import { CategoryMarkerIcon } from "./CategoryMarkerIcon";
import { FallbackMapCanvas } from "./FallbackMapCanvas";
import { HumanMapMarkerIcon } from "./HumanMapMarkerIcon";
import { humanFeatureAccessibilityLabel } from "./humanStatusMeta";
import { MapZoomControls } from "./MapZoomControls";
import { LocateMeControl } from "./LocateMeControl";
import { MapMouseHint } from "./MapMouseHint";
import { OsmAttribution } from "./OsmAttribution";
import type {
  OperationalMapCanvasProps,
  OperationalMapPoint,
} from "./types";
import { useWebMapMouseInteractions } from "./webMapMouseInteractions";
import {
  COLOMBIA_CENTER,
  COLOMBIA_BOUNDS,
  OSM_MAX_ZOOM as MAX_ZOOM,
  TILE_SIZE,
  buildTilePlacements,
  latitudeToWorldY,
  longitudeToWorldX,
  panGeographicCenter,
  viewportBounds,
  type CanvasSize,
  type GeographicCenter,
} from "./webMercator";

export { panGeographicCenter } from "./webMercator";
export type { GeographicCenter } from "./webMercator";

interface MarkerPlacement {
  point: OperationalMapPoint;
  left: number;
  top: number;
}

interface HumanMarkerPlacement {
  feature: NonNullable<OperationalMapCanvasProps["humanFeatures"]>[number];
  left: number;
  top: number;
}

export function OsmWebMapCanvas(props: OperationalMapCanvasProps) {
  const initialZoom = props.compact ? 4 : 5;
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState<GeographicCenter>(COLOMBIA_CENTER);
  const [tilesFailed, setTilesFailed] = useState(
    process.env.EXPO_PUBLIC_OSM_TILES_DISABLED === "true",
  );
  const [visitorLocation, setVisitorLocation] =
    useState<GeographicCenter | null>(null);
  const [size, setSize] = useState<CanvasSize>({
    width: props.compact ? 360 : 1180,
    height: props.canvasMinHeight ?? (props.compact ? 370 : 480),
  });

  const tiles = useMemo(
    () => buildTilePlacements(size, zoom, center),
    [center, size, zoom],
  );
  const markers = useMemo(
    () => buildMarkerPlacements(props.points, size, zoom, center),
    [center, props.points, size, zoom],
  );
  const humanMarkers = useMemo(
    () => buildHumanMarkerPlacements(props.humanFeatures ?? [], size, zoom, center),
    [center, props.humanFeatures, size, zoom],
  );
  const changeZoom = (direction: 1 | -1) => {
    setZoom((current) =>
      Math.max(initialZoom, Math.min(MAX_ZOOM, current + direction)),
    );
  };
  const attachMouseInteractions = useWebMapMouseInteractions({
    onPanBy: (deltaX, deltaY) =>
      setCenter((current) =>
        panGeographicCenter(current, zoom, deltaX, deltaY),
      ),
    onZoomBy: changeZoom,
  });

  useEffect(() => {
    if (zoom === initialZoom) {
      setCenter(COLOMBIA_CENTER);
    }
  }, [initialZoom, zoom]);

  useEffect(() => {
    const isNationalCenter =
      Math.abs(center.latitude - COLOMBIA_CENTER.latitude) < 0.000001 &&
      Math.abs(center.longitude - COLOMBIA_CENTER.longitude) < 0.000001;
    props.onViewportChange?.({
      bounds:
        zoom === initialZoom && isNationalCenter
          ? COLOMBIA_BOUNDS
          : viewportBounds(size, zoom, center),
      zoom,
    });
  }, [center, initialZoom, props.onViewportChange, size, zoom]);

  if (tilesFailed) {
    return <FallbackMapCanvas {...props} />;
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    }
  };

  return (
    <View
      accessibilityLabel={`Mapa OpenStreetMap con ${props.points.length} puntos operativos`}
      onLayout={handleLayout}
      ref={attachMouseInteractions}
      style={[
        styles.canvas,
        props.compact && styles.canvasCompact,
        props.canvasMinHeight !== undefined && {
          minHeight: props.canvasMinHeight,
        },
      ]}
    >
      <View style={styles.tileLayer} accessibilityElementsHidden>
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            accessibilityIgnoresInvertColors
            onError={() => setTilesFailed(true)}
            resizeMode="cover"
            source={{ uri: tile.uri }}
            style={[styles.tile, { left: tile.left, top: tile.top }]}
            testID={`osm-tile-${tile.key}`}
          />
        ))}
      </View>

      <View style={styles.tint} />
      <ProviderBadge />

      <MapZoomControls
        canZoomIn={zoom < MAX_ZOOM}
        canZoomOut={zoom > initialZoom}
        onZoomIn={() => changeZoom(1)}
        onZoomOut={() => changeZoom(-1)}
      />

      <LocateMeControl
        onLocated={(located) => {
          // CHG-055: centrar el mapa en el visitante y marcarlo.
          setVisitorLocation(located);
          setCenter(located);
          setZoom((current) => Math.max(current, 14));
        }}
      />

      {markers.map(({ point, left, top }) => {
        const meta = categoryMeta[point.category];
        const selected = props.selectedId === point.id;

        return (
          <Pressable
            key={point.id}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label}: ${point.title}, ${point.locationLabel}`}
            accessibilityState={{ selected }}
            onPress={() => props.onSelect(point.id)}
            style={[styles.marker, { left, top }, selected && styles.markerSelected]}
            testID={`map-marker-${point.id}`}
          >
            <CategoryMarkerIcon category={point.category} selected={selected} />
          </Pressable>
        );
      })}

      {humanMarkers.map(({ feature, left, top }) => {
        const selected = props.selectedHumanFeatureId === feature.id;
        return (
          <Pressable
            key={`human-${feature.id}`}
            accessibilityRole="button"
            accessibilityLabel={humanFeatureAccessibilityLabel(feature)}
            accessibilityState={{ selected }}
            onPress={() => {
              props.onSelectHumanFeature?.(feature.id);
              if (feature.kind === "cluster") {
                setCenter({
                  latitude: feature.latitude,
                  longitude: feature.longitude,
                });
                setZoom((current) => Math.min(MAX_ZOOM, current + 2));
              }
            }}
            style={[
              styles.humanMarker,
              { left, top },
              selected && styles.humanMarkerSelected,
            ]}
            testID={`human-map-feature-${feature.id}`}
          >
            <HumanMapMarkerIcon
              compact={props.compact}
              feature={feature}
              selected={selected}
            />
          </Pressable>
        );
      })}

      {visitorLocation && (() => {
        const worldSize = TILE_SIZE * 2 ** zoom;
        const left =
          size.width / 2 +
          longitudeToWorldX(visitorLocation.longitude, worldSize) -
          longitudeToWorldX(center.longitude, worldSize);
        const top =
          size.height / 2 +
          latitudeToWorldY(visitorLocation.latitude, worldSize) -
          latitudeToWorldY(center.latitude, worldSize);
        return (
          <View
            accessibilityLabel="Tu ubicación actual en el mapa"
            style={[styles.visitorMarker, { left, top }]}
            testID="visitor-location-marker"
          >
            <View style={styles.visitorHalo} />
            <View style={styles.visitorDot} />
          </View>
        );
      })()}

      {props.points.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>SIN PUNTOS VISIBLES</Text>
        </View>
      )}

      <MapMouseHint />
      <OsmAttribution />
    </View>
  );
}

function ProviderBadge() {
  return (
    <View style={styles.providerBadge}>
      <View style={styles.providerDot} />
      <Text style={styles.providerText}>OPENSTREETMAP · SIN CLAVE</Text>
    </View>
  );
}

function buildMarkerPlacements(
  points: OperationalMapPoint[],
  size: CanvasSize,
  zoom: number,
  center: GeographicCenter,
): MarkerPlacement[] {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const centerX = longitudeToWorldX(center.longitude, worldSize);
  const centerY = latitudeToWorldY(center.latitude, worldSize);

  return points.map((point) => ({
    point,
    left: size.width / 2 + longitudeToWorldX(point.longitude, worldSize) - centerX,
    top: size.height / 2 + latitudeToWorldY(point.latitude, worldSize) - centerY,
  }));
}

function buildHumanMarkerPlacements(
  features: NonNullable<OperationalMapCanvasProps["humanFeatures"]>,
  size: CanvasSize,
  zoom: number,
  center: GeographicCenter,
): HumanMarkerPlacement[] {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const centerX = longitudeToWorldX(center.longitude, worldSize);
  const centerY = latitudeToWorldY(center.latitude, worldSize);
  return features.map((feature) => ({
    feature,
    left:
      size.width / 2 +
      longitudeToWorldX(feature.longitude, worldSize) -
      centerX,
    top:
      size.height / 2 +
      latitudeToWorldY(feature.latitude, worldSize) -
      centerY,
  }));
}

const styles = StyleSheet.create({
  canvas: {
    position: "relative",
    minHeight: 480,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.16)",
    borderRadius: 10,
    backgroundColor: "#07101b",
  },
  canvasCompact: { minHeight: 370 },
  tileLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  tile: { position: "absolute", width: TILE_SIZE, height: TILE_SIZE },
  tint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    backgroundColor: "rgba(5,10,20,0.17)",
  },
  providerBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: "rgba(5,9,17,0.88)",
  },
  providerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.alive },
  providerText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.7 },
  marker: {
    position: "absolute",
    width: 42,
    height: 50,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -21,
    marginTop: -25,
  },
  markerSelected: { zIndex: 3 },
  humanMarker: {
    position: "absolute",
    width: 66,
    height: 66,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -33,
    marginTop: -33,
  },
  humanMarkerSelected: { zIndex: 5 },
  // CHG-055: marcador del visitante ("estás aquí").
  visitorMarker: {
    position: "absolute",
    zIndex: 5,
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  visitorHalo: {
    position: "absolute",
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.55)",
    backgroundColor: "rgba(81,229,255,0.16)",
  },
  visitorDot: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#07101b",
    backgroundColor: colors.cyan,
  },
  empty: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  emptyText: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 9, letterSpacing: 1.2 },
});
