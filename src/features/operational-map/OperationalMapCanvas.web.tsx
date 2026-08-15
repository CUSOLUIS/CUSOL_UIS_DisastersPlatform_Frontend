import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { categoryMeta } from "./categoryMeta";
import { humanFeatureAccessibilityLabel, humanStatusMeta } from "./humanStatusMeta";
import { MapMouseHint } from "./MapMouseHint";
import { MapZoomControls } from "./MapZoomControls";
import { OsmWebMapCanvas } from "./OsmWebMapCanvas";
import type { OperationalMapCanvasProps } from "./types";
import { useWebMapMouseInteractions } from "./webMapMouseInteractions";

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
const mapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";
let loaderConfigured = false;
const colombiaBounds = { north: 13.5, south: -4.5, west: -82, east: -66.5 };

export function OperationalMapCanvas(props: OperationalMapCanvasProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerLibraryRef = useRef<google.maps.MarkerLibrary | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const humanMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    apiKey ? "loading" : "failed",
  );
  const [zoom, setZoom] = useState(5);
  const changeZoom = (direction: 1 | -1) => {
    const currentZoom = mapRef.current?.getZoom() ?? zoom;
    mapRef.current?.setZoom(Math.max(4, Math.min(18, currentZoom + direction)));
  };
  const attachMouseInteractions = useWebMapMouseInteractions({
    onPanBy: (deltaX, deltaY) =>
      mapRef.current?.panBy(-deltaX, -deltaY),
    onZoomBy: changeZoom,
    dragButtons: [2],
    // Google Maps procesa su propio pellizco en modo greedy. El controlador
    // exterior solo agrega mouse derecho para evitar un zoom táctil duplicado.
    touchGestures: false,
  });

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      return;
    }

    let cancelled = false;

    async function initializeMap() {
      try {
        if (!loaderConfigured) {
          setOptions({
            key: apiKey,
            v: "weekly",
            language: "es",
            region: "CO",
            authReferrerPolicy: "origin",
            mapIds: [mapId],
          });
          loaderConfigured = true;
        }

        const [mapsLibrary, markerLibrary] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);

        if (cancelled || !containerRef.current) {
          return;
        }

        mapRef.current = new mapsLibrary.Map(containerRef.current, {
          center: { lat: 4.65, lng: -74.25 },
          zoom: 5,
          mapId,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          keyboardShortcuts: true,
        });
        markerLibraryRef.current = markerLibrary;
        mapRef.current.fitBounds(colombiaBounds, 28);
        mapRef.current.addListener("zoom_changed", () => {
          const nextZoom = mapRef.current?.getZoom();
          if (typeof nextZoom === "number") setZoom(nextZoom);
        });
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("failed");
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLibrary = markerLibraryRef.current;

    if (status !== "ready" || !map || !markerLibrary) {
      return;
    }

    markersRef.current.forEach((marker) => {
      google.maps.event.clearInstanceListeners(marker);
      marker.map = null;
    });

    const bounds = new google.maps.LatLngBounds();
    markersRef.current = props.points.map((point) => {
      const meta = categoryMeta[point.category];
      const selected = props.selectedId === point.id;
      const markerElement = createMarkerElement(
        meta.color,
        meta.glyph,
        selected,
        meta.markerKind,
      );
      const position = { lat: point.latitude, lng: point.longitude };
      const marker = new markerLibrary.AdvancedMarkerElement({
        map,
        position,
        title: `${meta.label}: ${point.title}, ${point.locationLabel}`,
        gmpClickable: true,
      });

      marker.append(markerElement);
      marker.addListener("click", () => props.onSelect(point.id));
      bounds.extend(position);
      return marker;
    });

    return () => {
      markersRef.current.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker);
        marker.map = null;
      });
      markersRef.current = [];
    };
  }, [props.onSelect, props.points, props.selectedId, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;

    const notifyViewport = () => {
      const bounds = map.getBounds()?.toJSON();
      const currentZoom = map.getZoom();
      if (bounds && typeof currentZoom === "number") {
        props.onViewportChange?.({ bounds, zoom: Math.round(currentZoom) });
      }
    };
    const listener = map.addListener("idle", notifyViewport);
    notifyViewport();
    return () => listener.remove();
  }, [props.onViewportChange, status]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLibrary = markerLibraryRef.current;
    if (status !== "ready" || !map || !markerLibrary) return;

    humanMarkersRef.current.forEach((marker) => {
      google.maps.event.clearInstanceListeners(marker);
      marker.map = null;
    });

    humanMarkersRef.current = (props.humanFeatures ?? []).map((feature) => {
      const selected = props.selectedHumanFeatureId === feature.id;
      const marker = new markerLibrary.AdvancedMarkerElement({
        map,
        position: { lat: feature.latitude, lng: feature.longitude },
        title: humanFeatureAccessibilityLabel(feature),
        gmpClickable: true,
      });
      marker.append(createHumanMarkerElement(feature, selected, props.compact));
      marker.addListener("click", () => {
        props.onSelectHumanFeature?.(feature.id);
        if (feature.kind === "cluster") {
          map.fitBounds(feature.bounds, 72);
        }
      });
      return marker;
    });

    return () => {
      humanMarkersRef.current.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker);
        marker.map = null;
      });
      humanMarkersRef.current = [];
    };
  }, [
    props.humanFeatures,
    props.onSelectHumanFeature,
    props.selectedHumanFeatureId,
    status,
  ]);

  if (!apiKey || status === "failed") {
    return <OsmWebMapCanvas {...props} />;
  }

  return (
    <View
      ref={attachMouseInteractions}
      style={[styles.container, props.compact && styles.containerCompact]}
    >
      <View
        ref={(node) => {
          containerRef.current = node as unknown as HTMLElement | null;
        }}
        style={styles.map}
      />
      {status === "loading" && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loadingText}>CARGANDO GOOGLE MAPS</Text>
        </View>
      )}
      <View style={styles.providerBadge}>
        <View style={styles.providerDot} />
        <Text style={styles.providerText}>GOOGLE MAPS</Text>
      </View>
      <MapZoomControls
        canZoomIn={zoom < 18}
        canZoomOut={zoom > 4}
        onZoomIn={() => changeZoom(1)}
        onZoomOut={() => changeZoom(-1)}
      />
      <MapMouseHint />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    minHeight: 480,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(81, 229, 255, 0.16)",
    borderRadius: 10,
    backgroundColor: "#07101b",
  },
  containerCompact: { minHeight: 370 },
  map: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#07101b",
  },
  loadingText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 1,
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
    backgroundColor: colors.alive,
  },
  providerText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 0.7,
  },
});

function createMarkerElement(
  color: string,
  glyph: string,
  selected: boolean,
  markerKind: "person" | "building",
): HTMLDivElement {
  const element = document.createElement("div");
  const width = selected ? 39 : 32;
  const height = selected ? 45 : 38;
  element.setAttribute("aria-hidden", "true");
  element.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    "position:relative",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    `border:${selected ? 2 : 1}px solid ${color}`,
    "border-radius:12px",
    "background:rgba(5,9,17,.92)",
    `box-shadow:0 4px ${selected ? 18 : 8}px ${color}66`,
    "cursor:pointer",
  ].join(";");
  const symbol =
    markerKind === "building"
      ? `<svg width="25" height="29" viewBox="0 0 26 30" aria-hidden="true">
          <path d="M4 27V5h13v22M17 11h5v16M2 27h22M9 27v-5h4v5" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          <rect x="7" y="9" width="2.5" height="2.5" fill="${color}"></rect><rect x="12" y="9" width="2.5" height="2.5" fill="${color}"></rect>
          <rect x="7" y="15" width="2.5" height="2.5" fill="${color}"></rect><rect x="12" y="15" width="2.5" height="2.5" fill="${color}"></rect>
        </svg>`
      : `<svg width="24" height="28" viewBox="0 0 24 28" aria-hidden="true">
          <circle cx="12" cy="6" r="4" fill="${color}"></circle>
          <path d="M5 25c.7-7 3-11 7-11s6.3 4 7 11M12 14v11M8 18l-4 4M16 18l4 4" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;
  element.innerHTML = `
    ${symbol}
    <span style="position:absolute;top:-6px;right:-7px;width:15px;height:15px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:${color};color:#07101b;font:900 8px monospace">${glyph}</span>
  `;

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-3px)" }, { transform: "translateY(0)" }],
      { duration: 1560, iterations: Infinity, easing: "ease-in-out" },
    );
  }

  return element;
}

function createHumanMarkerElement(
  feature: NonNullable<OperationalMapCanvasProps["humanFeatures"]>[number],
  selected: boolean,
  compact: boolean,
): HTMLDivElement {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");

  if (feature.kind === "cluster") {
    const size = selected ? (compact ? 46 : 58) : compact ? 38 : 50;
    const count = feature.count >= 1_000
      ? `${(feature.count / 1_000).toFixed(1)}K`
      : String(feature.count);
    element.style.cssText = [
      `width:${size}px`, `height:${size}px`, "display:flex",
      "flex-direction:column", "align-items:center", "justify-content:center",
      "border-radius:50%", `border:${selected ? 3 : 2}px solid ${colors.cyan}`,
      "background:rgba(5,9,17,.95)", `color:${colors.ink}`,
      "font-family:monospace", "font-weight:900", "font-size:14px",
      "box-shadow:0 0 16px rgba(81,229,255,.45)",
    ].join(";");
    element.textContent = count;
    return element;
  }

  const meta = humanStatusMeta[feature.status];
  element.style.cssText = [
    `width:${selected ? 42 : 34}px`, `height:${selected ? 42 : 34}px`,
    "display:flex", "align-items:center", "justify-content:center",
    "border-radius:50%", `border:2px solid ${meta.color}`,
    "background:rgba(5,9,17,.94)", `color:${meta.color}`,
    "font-family:monospace", "font-weight:900", "font-size:16px",
  ].join(";");
  element.textContent = meta.glyph;
  return element;
}
