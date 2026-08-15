import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fontFamilies } from "../../theme";
import { categoryMeta } from "./categoryMeta";
import { CategoryMarkerIcon } from "./CategoryMarkerIcon";
import { HumanMapMarkerIcon } from "./HumanMapMarkerIcon";
import { humanFeatureAccessibilityLabel } from "./humanStatusMeta";
import { LocateMeControl } from "./LocateMeControl";
import { useVisitorLocationTracking } from "./useVisitorLocationTracking";
import { MapMouseHint } from "./MapMouseHint";
import { MapZoomControls } from "./MapZoomControls";
import type {
  OperationalMapCanvasProps,
  OperationalMapPoint,
} from "./types";
import { useWebMapMouseInteractions } from "./webMapMouseInteractions";

interface ProjectedPoint {
  point: OperationalMapPoint;
  left: `${number}%`;
  top: `${number}%`;
}

const colombiaBounds = {
  north: 13.5,
  south: -4.5,
  west: -82,
  east: -66.5,
} as const;

function projectPoints(points: OperationalMapPoint[], zoom: number): ProjectedPoint[] {
  return points.map((point) => ({
    point,
    ...projectLocation(point.latitude, point.longitude, zoom),
  }));
}

function projectLocation(latitude: number, longitude: number, zoom: number) {
  const latitudeRange = colombiaBounds.north - colombiaBounds.south;
  const longitudeRange = colombiaBounds.east - colombiaBounds.west;
  const baseLeft = 8 + ((longitude - colombiaBounds.west) / longitudeRange) * 84;
  const baseTop = 8 + ((colombiaBounds.north - latitude) / latitudeRange) * 84;
  return {
    left: `${50 + (baseLeft - 50) * zoom}%` as const,
    top: `${50 + (baseTop - 50) * zoom}%` as const,
  };
}

export function FallbackMapCanvas({
  points,
  selectedId,
  onSelect,
  compact,
  canvasMinHeight,
  humanFeatures,
  selectedHumanFeatureId,
  onSelectHumanFeature,
  onViewportChange,
}: OperationalMapCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const {
    location: visitorLocation,
    activate: activateVisitorLocation,
    locating: visitorLocating,
    error: visitorLocationError,
  } = useVisitorLocationTracking({
    onCenter: () => {
      // Lienzo neutro: el visitante se marca en el encuadre nacional.
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    },
  });
  const projectedPoints = projectPoints(points, zoom);
  const changeZoom = (direction: 1 | -1) => {
    setZoom((current) => Math.max(1, Math.min(2.5, current + direction * 0.5)));
  };
  const attachMouseInteractions = useWebMapMouseInteractions({
    onPanBy: (deltaX, deltaY) =>
      setPanOffset((current) => ({
        x: current.x + deltaX,
        y: current.y + deltaY,
      })),
    onZoomBy: changeZoom,
  });

  useEffect(() => {
    if (zoom === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoom]);

  useEffect(() => {
    onViewportChange?.({
      bounds: colombiaBounds,
      zoom: Math.max(3, Math.min(19, Math.round(5 + (zoom - 1) * 4))),
    });
  }, [onViewportChange, zoom]);

  return (
    <View
      ref={attachMouseInteractions}
      style={[
        styles.canvas,
        compact && styles.canvasCompact,
        canvasMinHeight !== undefined && { minHeight: canvasMinHeight },
      ]}
      accessibilityLabel={`Lienzo cartográfico neutro con ${points.length} puntos operativos`}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 600 330"
        style={[
          styles.background,
          {
            transform: [
              { translateX: panOffset.x },
              { translateY: panOffset.y },
              { scale: zoom },
            ],
          },
        ]}
      >
        <Path
          d="M-20 68 C95 26 155 122 258 78 S426 4 628 72 M-30 171 C96 112 179 215 292 165 S474 98 630 151 M-20 272 C112 209 208 318 329 256 S505 194 638 231"
          fill="none"
          stroke="rgba(81,229,255,0.11)"
          strokeWidth="1"
        />
        <Path
          d="M72 -20 C91 83 48 161 105 350 M211 -15 C240 75 175 174 229 351 M366 -14 C397 82 319 177 385 349 M515 -16 C539 91 469 190 533 350"
          fill="none"
          stroke="rgba(135,150,255,0.09)"
          strokeWidth="1"
        />
        <Path
          d="M103 244 139 192 200 174 231 122 302 109 350 139 421 117 493 150 467 218 402 238 359 287 270 274 204 300 147 278Z"
          fill="rgba(81,229,255,0.035)"
          stroke="rgba(81,229,255,0.24)"
          strokeWidth="1.2"
        />
        <Path
          d="M145 276 201 174 302 109 421 117 467 218 359 287Z M231 122 270 274 M350 139 204 300 M139 192 402 238"
          fill="none"
          stroke="rgba(81,229,255,0.10)"
          strokeWidth="0.8"
          strokeDasharray="5 7"
        />
      </Svg>

      <View style={styles.providerBadge}>
        <View style={styles.providerDot} />
        <Text style={styles.providerText}>LIENZO NEUTRO · SIN TESELAS</Text>
      </View>

      <MapZoomControls
        canZoomIn={zoom < 2.5}
        canZoomOut={zoom > 1}
        onZoomIn={() => changeZoom(1)}
        onZoomOut={() => changeZoom(-1)}
      />

      <LocateMeControl
        onPress={() => void activateVisitorLocation()}
        locating={visitorLocating}
        error={visitorLocationError}
      />

      {projectedPoints.map(({ point, left, top }) => {
        const meta = categoryMeta[point.category];
        const selected = selectedId === point.id;

        return (
          <Pressable
            key={point.id}
            testID={`map-marker-${point.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label}: ${point.title}, ${point.locationLabel}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(point.id)}
            style={[
              styles.marker,
              {
                left,
                top,
                transform: [
                  { translateX: panOffset.x },
                  { translateY: panOffset.y },
                ],
              },
              selected && styles.markerSelected,
            ]}
          >
            <CategoryMarkerIcon category={point.category} selected={selected} />
          </Pressable>
        );
      })}

      {(humanFeatures ?? []).map((feature) => {
        const projected = projectLocation(
          feature.latitude,
          feature.longitude,
          zoom,
        );
        const selected = selectedHumanFeatureId === feature.id;
        return (
          <Pressable
            key={`human-${feature.id}`}
            accessibilityRole="button"
            accessibilityLabel={humanFeatureAccessibilityLabel(feature)}
            accessibilityState={{ selected }}
            onPress={() => {
              onSelectHumanFeature?.(feature.id);
              if (feature.kind === "cluster") changeZoom(1);
            }}
            style={[
              styles.humanMarker,
              {
                left: projected.left,
                top: projected.top,
                transform: [
                  { translateX: panOffset.x },
                  { translateY: panOffset.y },
                ],
              },
              selected && styles.markerSelected,
            ]}
            testID={`human-map-feature-${feature.id}`}
          >
            <HumanMapMarkerIcon
              compact={compact}
              feature={feature}
              selected={selected}
            />
          </Pressable>
        );
      })}

      {visitorLocation && (
        <View
          accessibilityLabel="Tu ubicación actual en el mapa"
          style={[
            styles.visitorMarker,
            projectLocation(
              visitorLocation.latitude,
              visitorLocation.longitude,
              zoom,
            ),
            {
              transform: [
                { translateX: panOffset.x },
                { translateY: panOffset.y },
              ],
            },
          ]}
          testID="visitor-location-marker"
        >
          <View style={styles.visitorHalo} />
          <View style={styles.visitorDot} />
        </View>
      )}

      {points.length === 0 && (humanFeatures?.length ?? 0) === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>SIN PUNTOS VISIBLES</Text>
        </View>
      )}

      {Platform.OS === "web" && <MapMouseHint />}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "relative",
    minHeight: 480,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(81, 229, 255, 0.16)",
    borderRadius: 10,
    backgroundColor: "#07101b",
  },
  canvasCompact: { minHeight: 370 },
  background: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: "none",
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
    backgroundColor: "rgba(5, 9, 17, 0.86)",
  },
  providerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.missing,
  },
  providerText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 0.7,
  },
  marker: {
    position: "absolute",
    width: 42,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -21,
    marginTop: -25,
  },
  markerSelected: {
    zIndex: 2,
  },
  humanMarker: {
    position: "absolute",
    width: 66,
    height: 66,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -33,
    marginTop: -33,
  },
  // CHG-055: marcador del visitante en el lienzo neutro.
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
    left: -15,
    top: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.55)",
    backgroundColor: "rgba(81,229,255,0.16)",
  },
  visitorDot: {
    position: "absolute",
    left: -5,
    top: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
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
  },
  emptyText: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1.2,
  },
});
