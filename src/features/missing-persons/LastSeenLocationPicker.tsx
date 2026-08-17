import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fontFamilies } from "../../theme";
import { LocateMeControl } from "../operational-map/LocateMeControl";
import { MapZoomControls } from "../operational-map/MapZoomControls";
import { OsmAttribution } from "../operational-map/OsmAttribution";
import {
  getBrowserGeolocation,
  requestVisitorLocation,
} from "../operational-map/visitorLocation";
import {
  getLastKnownVisitorLocation,
  setLastKnownVisitorLocation,
} from "../operational-map/visitorPresence";
import { useWebMapMouseInteractions } from "../operational-map/webMapMouseInteractions";
import { useNativeMapTouchInteractions } from "../operational-map/nativeMapTouchInteractions";
import {
  COLOMBIA_CENTER,
  OSM_MAX_ZOOM,
  TILE_SIZE,
  buildTilePlacements,
  latitudeToWorldY,
  longitudeToWorldX,
  movePointByScreenDelta,
  panGeographicCenter,
  type CanvasSize,
  type GeographicCenter,
} from "../operational-map/webMercator";
import { useDraggableMarker, useNativeMarkerDrag } from "./draggableMarker";
import {
  reverseGeocode,
  searchAddressCandidates,
  type AddressCandidate,
  type ResolvedAddress,
} from "./geocoding";

const MIN_ZOOM = 5;
const CANDIDATE_ZOOM = 17;

export interface LastSeenLocationPickerProps {
  addressQuery: string;
  value: GeographicCenter | null;
  onChange: (next: GeographicCenter | null) => void;
  searchCandidates?: (query: string) => Promise<AddressCandidate[]>;
  // CHG-080: obtención de la posición GPS, inyectable en pruebas.
  locateVisitor?: () => Promise<GeographicCenter>;
  // CHG-086: al fijar el muñequito se resuelve la dirección del sitio
  // para autocompletar el campo Dirección (siempre editable).
  onAddressResolved?: (address: ResolvedAddress) => void;
  resolveAddress?: (point: GeographicCenter) => Promise<ResolvedAddress>;
  // CHG-125: rótulo y ayuda propios (la solicitud de ayuda exige el
  // punto, así que "OPCIONAL" dejaría de ser cierto allí).
  title?: string;
  helper?: string;
  // CHG-125: botón visible de GPS junto a las acciones («¿Dónde
  // estoy?»); el control ◎ del lienzo sigue disponible igual.
  locateActionLabel?: string;
  // CHG-130: al entrar a la funcionalidad se intenta UNA vez obtener
  // la ubicación del dispositivo y prellenar punto/dirección. La
  // última posición conocida (portón de la app, «Ubícame» previo) se
  // usa sin volver a pedir permiso; si no hay, se pide como con el
  // botón. El rechazo no bloquea: queda el aviso no invasivo del
  // control ◎ y la dirección manual. Opt-in: los demás formularios
  // (p. ej. persona desaparecida) no deben prellenar con la posición
  // de quien reporta.
  autoLocateOnEntry?: boolean;
}

export function LastSeenLocationPicker({
  addressQuery,
  value,
  onChange,
  searchCandidates = searchAddressCandidates,
  locateVisitor,
  onAddressResolved,
  resolveAddress = reverseGeocode,
  title = "UBICACIÓN EN EL MAPA · OPCIONAL",
  helper = "Cruza la dirección escrita arriba con el mapa, fija tu ubicación con el botón ◎ del GPS, o arrastra el muñequito hasta el lugar exacto.",
  locateActionLabel,
  autoLocateOnEntry = false,
}: LastSeenLocationPickerProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [center, setCenter] = useState<GeographicCenter>(COLOMBIA_CENTER);
  const [size, setSize] = useState<CanvasSize>({ width: 640, height: 300 });
  const [candidates, setCandidates] = useState<AddressCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // CHG-080: fijar el muñequito con el GPS, como en el mapa de la
  // portada (CHG-055).
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const locateAvailable =
    locateVisitor !== undefined || getBrowserGeolocation() !== null;
  // CHG-086: las candidatas ya traen su dirección; el resto de
  // movimientos del muñequito (GPS, botón, arrastre) se resuelven con
  // geocodificación inversa tras una pausa breve.
  const skipResolveRef = useRef(false);

  useEffect(() => {
    if (!onAddressResolved || !value) {
      return;
    }
    if (skipResolveRef.current) {
      skipResolveRef.current = false;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      resolveAddress(value)
        .then((address) => {
          if (!cancelled) {
            onAddressResolved(address);
          }
        })
        .catch(() => {
          // Autocompletar es un mejor esfuerzo: sin dirección conocida
          // no se interrumpe el flujo.
        });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value?.latitude, value?.longitude]);

  const trimmedQuery = addressQuery.trim();
  const tiles = useMemo(
    () => buildTilePlacements(size, zoom, center),
    [center, size, zoom],
  );

  const changeZoom = (direction: 1 | -1) => {
    setZoom((current) =>
      Math.max(MIN_ZOOM, Math.min(OSM_MAX_ZOOM, current + direction)),
    );
  };

  const attachMapInteractions = useWebMapMouseInteractions({
    onPanBy: (deltaX, deltaY) =>
      setCenter((current) => panGeographicCenter(current, zoom, deltaX, deltaY)),
    onZoomBy: changeZoom,
  });
  // CHG-121: en Android/iOS los manejadores DOM son inertes; el paneo
  // y el pellizco del mapa los aporta el responder nativo.
  const nativeTouchHandlers = useNativeMapTouchInteractions({
    onPanBy: (deltaX, deltaY) =>
      setCenter((current) => panGeographicCenter(current, zoom, deltaX, deltaY)),
    onZoomBy: changeZoom,
  });

  const attachMarkerDrag = useDraggableMarker({
    onDragBy: (deltaX, deltaY) => {
      if (value) {
        onChange(movePointByScreenDelta(value, zoom, deltaX, deltaY));
      }
    },
  });
  // CHG-130: en Android/iOS el arrastre lo aporta el responder nativo;
  // en web devuelve {} y siguen mandando los pointer events de arriba.
  const nativeMarkerDragHandlers = useNativeMarkerDrag({
    onDragBy: (deltaX, deltaY) => {
      if (value) {
        onChange(movePointByScreenDelta(value, zoom, deltaX, deltaY));
      }
    },
  });

  const runSearch = async () => {
    setSearching(true);
    setSearchError(null);
    setCandidates(null);
    try {
      const results = await searchCandidates(trimmedQuery);
      if (results.length === 0) {
        setSearchError(
          "Sin coincidencias para la dirección escrita. Ajusta la zona o coloca el muñequito manualmente.",
        );
      } else {
        setCandidates(results);
      }
    } catch (error: unknown) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "No fue posible cruzar la dirección. Intenta de nuevo.",
      );
    } finally {
      setSearching(false);
    }
  };

  const locateMe = async () => {
    setLocating(true);
    setLocateError(null);
    try {
      const point = await (locateVisitor ?? requestVisitorLocation)();
      onChange(point);
      setCenter(point);
      setZoom(CANDIDATE_ZOOM);
      // CHG-066: la posición conocida también acompaña (cifrada) al
      // reporte como instantánea del reportante.
      setLastKnownVisitorLocation(point);
    } catch (error: unknown) {
      setLocateError(
        error instanceof Error
          ? error.message
          : "No fue posible obtener tu ubicación.",
      );
    } finally {
      setLocating(false);
    }
  };

  // CHG-130: intento único al montar. Con posición conocida (portón de
  // la app o un «Ubícame» anterior) se prellena sin diálogo; sin ella
  // se pide una vez. Nunca se repite ni bloquea el formulario: si el
  // permiso se niega queda el aviso no invasivo del control ◎ y la
  // dirección manual.
  const autoLocateDoneRef = useRef(false);
  useEffect(() => {
    if (!autoLocateOnEntry || autoLocateDoneRef.current || value) {
      return;
    }
    autoLocateDoneRef.current = true;
    const known = getLastKnownVisitorLocation();
    if (known) {
      onChange(known);
      setCenter(known);
      setZoom(CANDIDATE_ZOOM);
      return;
    }
    if (locateAvailable) {
      void locateMe();
    }
  }, []);

  const selectCandidate = (candidate: AddressCandidate) => {
    const point = {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    };
    // CHG-086: la candidata ya trae su dirección; no hace falta la
    // geocodificación inversa.
    skipResolveRef.current = true;
    onAddressResolved?.({
      label: candidate.label,
      municipality: null,
      department: null,
    });
    onChange(point);
    setCenter(point);
    setZoom(CANDIDATE_ZOOM);
    setCandidates(null);
  };

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

  const markerPlacement = value ? placeMarker(value, center, zoom, size) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.helper}>{helper}</Text>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cruzar la dirección escrita con el mapa"
          accessibilityState={{ disabled: searching || trimmedQuery.length === 0 }}
          disabled={searching || trimmedQuery.length === 0}
          onPress={() => void runSearch()}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
            (searching || trimmedQuery.length === 0) && styles.actionDisabled,
          ]}
        >
          {searching ? (
            <ActivityIndicator color={colors.cyan} />
          ) : (
            <Text style={styles.actionText}>CRUZAR DIRECCIÓN</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Colocar el muñequito en el centro del mapa"
          onPress={() => onChange(center)}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>COLOCAR MUÑEQUITO</Text>
        </Pressable>
        {/* CHG-125: acceso de GPS con nombre visible; pide el permiso
            de geolocalización y aplica el fallback de precisión
            (CHG-085) igual que el control ◎. */}
        {locateActionLabel && locateAvailable && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locateActionLabel}
            accessibilityState={{ disabled: locating }}
            disabled={locating}
            onPress={() => void locateMe()}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
              locating && styles.actionDisabled,
            ]}
          >
            {locating ? (
              <ActivityIndicator color={colors.cyan} />
            ) : (
              <Text style={styles.actionText}>
                {locateActionLabel.toLocaleUpperCase("es-CO")}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {trimmedQuery.length === 0 && (
        <Text style={styles.hint}>
          Escribe departamento, municipio y la dirección para poder cruzarla
          con el mapa.
        </Text>
      )}

      {searchError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {searchError}
        </Text>
      )}

      {candidates && (
        <View style={styles.candidates}>
          <Text style={styles.candidatesTitle}>
            COINCIDENCIAS · ELIGE LA DIRECCIÓN CORRECTA
          </Text>
          {candidates.map((candidate, index) => (
            <Pressable
              key={`${candidate.latitude}-${candidate.longitude}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Usar dirección: ${candidate.label}`}
              onPress={() => selectCandidate(candidate)}
              style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
              testID={`address-candidate-${index}`}
            >
              <Text style={styles.candidateText}>{candidate.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View
        accessibilityLabel="Mapa para fijar la última ubicación conocida"
        onLayout={handleLayout}
        ref={attachMapInteractions}
        {...nativeTouchHandlers}
        style={styles.map}
      >
        <View style={styles.tileLayer} accessibilityElementsHidden>
          {tiles.map((tile) => (
            <Image
              key={tile.key}
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: tile.uri }}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
              testID={`picker-tile-${tile.key}`}
            />
          ))}
        </View>

        <MapZoomControls
          canZoomIn={zoom < OSM_MAX_ZOOM}
          canZoomOut={zoom > MIN_ZOOM}
          onZoomIn={() => changeZoom(1)}
          onZoomOut={() => changeZoom(-1)}
        />

        {/* CHG-080: fijar el muñequito según el GPS, como en el mapa
            de la portada. */}
        <LocateMeControl
          available={locateAvailable}
          onPress={() => void locateMe()}
          locating={locating}
          error={locateError}
        />

        {markerPlacement && (
          <View
            accessibilityRole="button"
            accessibilityLabel="Muñequito de ubicación. Mantén presionado y arrástralo hasta la dirección"
            ref={attachMarkerDrag}
            {...nativeMarkerDragHandlers}
            style={[styles.marker, { left: markerPlacement.left, top: markerPlacement.top }]}
            testID="last-seen-marker"
          >
            <PersonFigure />
          </View>
        )}

        {!value && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text style={styles.emptyText}>
              SIN PUNTO FIJADO · CRUZA LA DIRECCIÓN O COLOCA EL MUÑEQUITO
            </Text>
          </View>
        )}

        <OsmAttribution />
      </View>

      {value && (
        <View style={styles.readout}>
          <Text style={styles.readoutText}>
            {`PUNTO FIJADO · LAT ${value.latitude.toFixed(5)} · LON ${value.longitude.toFixed(5)}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar el punto fijado en el mapa"
            onPress={() => onChange(null)}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>QUITAR</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function placeMarker(
  value: GeographicCenter,
  center: GeographicCenter,
  zoom: number,
  size: CanvasSize,
): { left: number; top: number } {
  const worldSize = TILE_SIZE * 2 ** zoom;
  return {
    left:
      size.width / 2 +
      longitudeToWorldX(value.longitude, worldSize) -
      longitudeToWorldX(center.longitude, worldSize),
    top:
      size.height / 2 +
      latitudeToWorldY(value.latitude, worldSize) -
      latitudeToWorldY(center.latitude, worldSize),
  };
}

// El muñequito: figura humana sobre una punta que marca el lugar exacto.
function PersonFigure() {
  return (
    <Svg width={30} height={40} viewBox="0 0 30 40">
      <Path
        d="M15 39 L10 27 H20 Z"
        fill={colors.cyan}
        stroke="#07101b"
        strokeWidth={1}
      />
      <Circle cx="15" cy="7" r="5.5" fill={colors.cyan} stroke="#07101b" strokeWidth={1.5} />
      <Path
        d="M15 13 c-5 0 -8 3.4 -8 8.4 V27 h16 v-5.6 c0 -5 -3 -8.4 -8 -8.4 Z"
        fill={colors.cyan}
        stroke="#07101b"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  title: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  helper: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.35)",
    backgroundColor: "rgba(81,229,255,0.08)",
  },
  actionDisabled: { opacity: 0.45 },
  actionText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  pressed: { opacity: 0.72 },
  hint: { color: colors.inkDim, fontSize: 11 },
  error: { color: "#ff8f8f", fontSize: 11 },
  candidates: {
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.22)",
    borderRadius: 8,
    padding: 8,
    gap: 6,
    backgroundColor: "rgba(5,9,17,0.6)",
  },
  candidatesTitle: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.9,
  },
  candidate: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    backgroundColor: "rgba(81,229,255,0.07)",
  },
  candidateText: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  map: {
    position: "relative",
    height: 300,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.16)",
    borderRadius: 10,
    backgroundColor: "#07101b",
  },
  tileLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  tile: { position: "absolute", width: TILE_SIZE, height: TILE_SIZE },
  marker: {
    position: "absolute",
    width: 44,
    height: 52,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "flex-end",
    // La punta inferior del muñequito coincide con la coordenada.
    marginLeft: -22,
    marginTop: -46,
  },
  emptyOverlay: {
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
    letterSpacing: 1.1,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  readout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  readoutText: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,143,143,0.4)",
  },
  clearText: {
    color: "#ff8f8f",
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
});
