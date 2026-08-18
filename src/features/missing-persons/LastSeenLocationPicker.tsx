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
  kilometersToPixels,
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
// CHG-141: un segundo DESPUÉS de soltar el muñequito se resuelve la
// dirección. Es un debounce real: cada movimiento reinicia el
// contador y solo la última posición vigente llega a geocodificarse.
const RESOLVE_DEBOUNCE_MS = 1000;
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
  // CHG-134: radio de aviso (km) dibujado a escala alrededor del
  // muñequito, para ver la cobertura mientras se elige.
  previewRadiusKm?: number | null;
  // CHG-141: comportamiento del GPS (◎ / botón con nombre).
  // - "marker": fija el muñequito y resuelve la dirección (flujo de
  //   «Necesitamos ayuda», CHG-130).
  // - "dot": solo muestra el PUNTO AZUL de «aquí cree tu dispositivo
  //   que estás» — no toca el muñequito ni la dirección; «COLOCAR
  //   MUÑEQUITO» lo convierte en marcador sobre esas coordenadas.
  locateMode?: "marker" | "dot";
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
  previewRadiusKm = null,
  locateMode = "marker",
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
  // CHG-141: ubicación estimada del dispositivo (punto azul); no es el
  // muñequito ni cambia la dirección hasta que la persona lo decida.
  const [currentLocation, setCurrentLocation] =
    useState<GeographicCenter | null>(null);
  // CHG-141: feedback sutil de la geocodificación inversa.
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [resolveError, setResolveError] = useState(false);
  // CHG-143: colocar el muñequito es una intención explícita y debe
  // resolver la dirección aunque las coordenadas redondeadas
  // coincidan con las ya fijadas (recolocar en el mismo punto). Este
  // contador dispara el efecto de resolución además del cambio de
  // coordenadas.
  const [placementSeq, setPlacementSeq] = useState(0);
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
      // CHG-141: feedback sutil mientras se resuelve; si falla, el
      // muñequito y la dirección anterior se conservan y queda un
      // aviso no invasivo (mover de nuevo reintenta).
      setResolvingAddress(true);
      setResolveError(false);
      resolveAddress(value)
        .then((address) => {
          if (!cancelled) {
            onAddressResolved(address);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResolveError(true);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setResolvingAddress(false);
          }
        });
    }, RESOLVE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // CHG-143: `placementSeq` fuerza la resolución en cada colocación
    // explícita, incluso si las coordenadas redondeadas no cambian.
  }, [value?.latitude, value?.longitude, placementSeq]);

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
      if (locateMode === "dot") {
        // CHG-141: solo el punto azul; la dirección escrita no se toca
        // sin consentimiento.
        setCurrentLocation(point);
      } else {
        onChange(point);
        // CHG-143: el GPS es una colocación explícita; resolver aunque
        // caiga sobre las mismas coordenadas ya fijadas.
        setPlacementSeq((seq) => seq + 1);
      }
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
      addressLine: null,
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

      {/* CHG-144: paso a paso para que la dirección se llene bien. */}
      <View style={styles.legend} testID="address-fill-legend">
        <Text style={styles.legendTitle}>CÓMO SE LLENA LA DIRECCIÓN</Text>
        <Text style={styles.legendStep}>
          1 · Escribe arriba departamento, municipio y la dirección o lugar de
          referencia.
        </Text>
        <Text style={styles.legendStep}>
          2 · Pulsa «CRUZAR DIRECCIÓN»: la busca en el mapa y lista las
          coincidencias.
        </Text>
        <Text style={styles.legendStep}>
          3 · Elige la coincidencia correcta: se fija el muñequito y la
          dirección queda completa.
        </Text>
        <Text style={styles.legendAlt}>
          ¿Estás en el lugar? Usa el GPS y luego «COLOCAR MUÑEQUITO» para
          llenarla desde tu ubicación.
        </Text>
      </View>

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
          onPress={() => {
            // CHG-141: si hay punto azul, el muñequito cae EXACTAMENTE
            // sobre esas coordenadas y el punto desaparece (nunca
            // conviven representando lo mismo).
            const target = currentLocation ?? center;
            onChange(target);
            setCenter(target);
            setCurrentLocation(null);
            // CHG-143: recolocar sobre el mismo punto también resuelve.
            setPlacementSeq((seq) => seq + 1);
          }}
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

        {/* CHG-141: punto azul — «según tu dispositivo estás aquí».
            No es el muñequito, no se arrastra y no toca la dirección;
            desaparece al COLOCAR MUÑEQUITO sobre él. */}
        {currentLocation &&
          (() => {
            const dot = placeMarker(currentLocation, center, zoom, size);
            return (
              <View
                pointerEvents="none"
                testID="current-location-dot"
                style={[
                  styles.currentLocationDot,
                  { left: dot.left, top: dot.top },
                ]}
              >
                <View style={styles.currentLocationCore} />
              </View>
            );
          })()}

        {/* CHG-134: cobertura del radio de aviso mientras se elige;
            mismo criterio de escala que el mapa principal. */}
        {markerPlacement &&
          value &&
          previewRadiusKm != null &&
          previewRadiusKm > 0 &&
          (() => {
            const radiusPx = kilometersToPixels(
              previewRadiusKm,
              value.latitude,
              zoom,
            );
            if (radiusPx < 6 || radiusPx > 6000) {
              return null;
            }
            return (
              <View
                pointerEvents="none"
                testID="picker-alert-radius"
                style={[
                  styles.alertRadius,
                  {
                    left: markerPlacement.left - radiusPx,
                    top: markerPlacement.top - radiusPx,
                    width: radiusPx * 2,
                    height: radiusPx * 2,
                    borderRadius: radiusPx,
                  },
                ]}
              />
            );
          })()}

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

      {(resolvingAddress || resolveError) && (
        <Text
          style={resolveError ? styles.resolveError : styles.resolving}
          accessibilityRole={resolveError ? "alert" : undefined}
          testID="address-resolve-status"
        >
          {resolveError
            ? "No fue posible obtener la dirección de ese punto; puedes escribirla manualmente o mover el muñequito para reintentar."
            : "Obteniendo dirección…"}
        </Text>
      )}

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
  // CHG-144: mini-leyenda del paso a paso para llenar la dirección.
  legend: {
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.18)",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    backgroundColor: "rgba(5,9,17,0.45)",
  },
  legendTitle: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  legendStep: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  legendAlt: {
    color: colors.inkDim,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
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
  // CHG-134: círculo de cobertura del radio de aviso.
  alertRadius: {
    position: "absolute",
    zIndex: 3,
    borderWidth: 1.5,
    borderColor: colors.emergency,
    backgroundColor: "rgba(255,77,94,0.10)",
  },
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
  // CHG-141: punto azul de ubicación estimada del dispositivo.
  currentLocationDot: {
    position: "absolute",
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(77,159,255,0.25)",
  },
  currentLocationCore: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#4d9fff",
    borderWidth: 1.5,
    borderColor: "#eaf4ff",
  },
  resolving: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  resolveError: { color: "#ff8f8f", fontSize: 11, lineHeight: 16 },
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
