import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, UrlTile } from "react-native-maps";
import { colors, fontFamilies } from "../../theme";
import { categoryMeta } from "./categoryMeta";
import { CategoryMarkerIcon } from "./CategoryMarkerIcon";
import { FallbackMapCanvas } from "./FallbackMapCanvas";
import { OsmWebMapCanvas } from "./OsmWebMapCanvas";
import { HumanMapMarkerIcon } from "./HumanMapMarkerIcon";
import { humanFeatureAccessibilityLabel } from "./humanStatusMeta";
import { MapZoomControls } from "./MapZoomControls";
import { OsmAttribution } from "./OsmAttribution";
import type { OperationalMapCanvasProps } from "./types";
import { probeTileUrl, tileProvider } from "./tileProvider";

const googleMapsNativeEnabled =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_ENABLED === "true";
const osmTilesDisabled =
  process.env.EXPO_PUBLIC_OSM_TILES_DISABLED === "true";
const osmProbeUrl = probeTileUrl();

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b1320" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8291a7" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1320" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#182536" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#07101b" }] },
];

export function OperationalMapCanvas({
  platformOs = Platform.OS,
  ...props
}: OperationalMapCanvasProps & { platformOs?: typeof Platform.OS }) {
  const mapRef = useRef<MapView | null>(null);
  const [zoom, setZoom] = useState(5);
  const [osmStatus, setOsmStatus] = useState<"checking" | "ready" | "failed">(
    osmTilesDisabled ? "failed" : "checking",
  );
  // CHG-074: en Android react-native-maps SOLO funciona con Google Maps
  // y exige una API key en el manifest; sin ella, inflar MapView tumba
  // la app entera al abrir (crash nativo, no capturable en JS). Sin la
  // clave configurada, MapView jamás se monta. En iOS el proveedor por
  // defecto es Apple Maps y no la necesita.
  const androidWithoutGoogleKey =
    platformOs === "android" && !googleMapsNativeEnabled;

  useEffect(() => {
    if (googleMapsNativeEnabled || osmTilesDisabled) {
      return;
    }

    const controller = new AbortController();
    fetch(osmProbeUrl, {
      signal: controller.signal,
      headers: {
        Accept: "image/png",
        "User-Agent": "CUSOLDisasters/0.1 (co.edu.uis.cusol.disasters)",
      },
    })
      .then((response) => {
        if (!response.ok || response.headers.get("x-blocked")) {
          throw new Error(`OpenStreetMap respondió ${response.status}`);
        }
        setOsmStatus("ready");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setOsmStatus("failed");
        }
      });

    return () => controller.abort();
  }, []);

  // CHG-121: en Android sin clave el mapa real lo pinta el lienzo de
  // teselas propio (CARTO, CHG-109), que no depende de Google y si las
  // teselas fallan degrada por sí mismo al lienzo neutro.
  if (androidWithoutGoogleKey) {
    return <OsmWebMapCanvas {...props} />;
  }

  if (!googleMapsNativeEnabled && osmStatus === "failed") {
    return <FallbackMapCanvas {...props} />;
  }

  const changeZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    void mapRef.current?.animateCamera({
      center: { latitude: 4.5, longitude: -74.25 },
      zoom: nextZoom,
    });
  };

  return (
    <View style={[styles.container, props.compact && styles.containerCompact]}>
      <MapView
        ref={mapRef}
        provider={googleMapsNativeEnabled ? PROVIDER_GOOGLE : undefined}
        mapType={googleMapsNativeEnabled ? "standard" : "none"}
        style={styles.map}
        initialRegion={{
          latitude: 4.5,
          longitude: -74.25,
          latitudeDelta: 18,
          longitudeDelta: 15.5,
        }}
        customMapStyle={googleMapsNativeEnabled ? darkMapStyle : undefined}
        toolbarEnabled={false}
        showsCompass={false}
        showsUserLocation={false}
        accessibilityLabel={`${googleMapsNativeEnabled ? "Google Maps" : "OpenStreetMap"} con ${props.points.length} puntos operativos en ${Platform.OS}`}
        onRegionChangeComplete={(region) => {
          const nextZoom = Math.max(
            3,
            Math.min(19, Math.round(Math.log2(360 / region.longitudeDelta))),
          );
          setZoom(nextZoom);
          props.onViewportChange?.({
            zoom: nextZoom,
            bounds: {
              west: region.longitude - region.longitudeDelta / 2,
              south: region.latitude - region.latitudeDelta / 2,
              east: region.longitude + region.longitudeDelta / 2,
              north: region.latitude + region.latitudeDelta / 2,
            },
          });
        }}
      >
        {!googleMapsNativeEnabled && (
          <UrlTile
            urlTemplate={tileProvider.urlTemplate.replace("{s}", tileProvider.subdomains[0] ?? "")}
            maximumNativeZ={19}
            maximumZ={19}
            minimumZ={4}
            shouldReplaceMapContent
            tileCacheMaxAge={86_400}
            zIndex={0}
          />
        )}
        {/* CHG-134: radio de aviso de las solicitudes de ayuda, a
            escala real sobre el mapa nativo. */}
        {props.points
          .filter((point) => point.alertRadiusKm)
          .map((point) => (
            <Circle
              key={`radius-${point.id}`}
              center={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              radius={(point.alertRadiusKm ?? 0) * 1000}
              strokeColor={colors.emergency}
              strokeWidth={1.5}
              fillColor="rgba(255,77,94,0.10)"
              zIndex={1}
            />
          ))}
        {/* CHG-171: rastro del GPS de los viajes (no interactivo). */}
        {(props.trailDots ?? []).map((dot) => (
          <Circle
            key={dot.id}
            center={{ latitude: dot.latitude, longitude: dot.longitude }}
            radius={60}
            strokeColor="rgba(255,122,217,0.5)"
            strokeWidth={1}
            fillColor="rgba(255,122,217,0.4)"
            zIndex={1}
          />
        ))}
        {props.points.map((point) => {
          const meta = categoryMeta[point.category];
          const selected = props.selectedId === point.id;

          return (
            <Marker
              key={point.id}
              identifier={point.id}
              coordinate={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              title={point.title}
              description={`${meta.label} · ${point.locationLabel}`}
              opacity={selected ? 1 : 0.82}
              onPress={() => props.onSelect(point.id)}
              tracksViewChanges
            >
              <CategoryMarkerIcon category={point.category} selected={selected} />
            </Marker>
          );
        })}
        {(props.humanFeatures ?? []).map((feature) => {
          const selected = props.selectedHumanFeatureId === feature.id;
          return (
            <Marker
              key={`human-${feature.id}`}
              identifier={`human-${feature.id}`}
              coordinate={{
                latitude: feature.latitude,
                longitude: feature.longitude,
              }}
              title={humanFeatureAccessibilityLabel(feature)}
              opacity={selected ? 1 : 0.9}
              onPress={() => {
                props.onSelectHumanFeature?.(feature.id);
                if (feature.kind === "cluster") {
                  const nextZoom = Math.min(18, zoom + 2);
                  setZoom(nextZoom);
                  void mapRef.current?.animateCamera({
                    center: {
                      latitude: feature.latitude,
                      longitude: feature.longitude,
                    },
                    zoom: nextZoom,
                  });
                }
              }}
              tracksViewChanges
            >
              <HumanMapMarkerIcon
                compact={props.compact}
                feature={feature}
                selected={selected}
              />
            </Marker>
          );
        })}
      </MapView>

      <ProviderBadge
        label={
          googleMapsNativeEnabled
            ? "GOOGLE MAPS"
            : osmStatus === "checking"
              ? "OPENSTREETMAP · VERIFICANDO"
              : "OPENSTREETMAP · SIN CLAVE"
        }
        operational={googleMapsNativeEnabled || osmStatus === "ready"}
      />
      <MapZoomControls
        canZoomIn={zoom < 18}
        canZoomOut={zoom > 5}
        onZoomIn={() => changeZoom(Math.min(18, zoom + 1))}
        onZoomOut={() => changeZoom(Math.max(5, zoom - 1))}
      />
      {!googleMapsNativeEnabled && <OsmAttribution />}
    </View>
  );
}

function ProviderBadge({ label, operational }: { label: string; operational: boolean }) {
  return (
    <View style={styles.providerBadge}>
      <View
        style={[
          styles.providerDot,
          { backgroundColor: operational ? colors.alive : colors.missing },
        ]}
      />
      <Text style={styles.providerText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    minHeight: 480,
    overflow: "hidden",
    borderRadius: 10,
  },
  containerCompact: { minHeight: 370 },
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
  providerDot: { width: 5, height: 5, borderRadius: 3 },
  providerText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 0.7,
  },
});
