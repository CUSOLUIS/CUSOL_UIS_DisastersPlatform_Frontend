import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { watchVisitorLocation } from "../operational-map/visitorLocation";
import type { GeographicCenter } from "../operational-map/webMercator";
import {
  arriveTransportJourney,
  sendTransportPosition,
  startTransportJourney,
} from "./reportSubmission";
import {
  transportKindLabel,
  transportStatusLabel,
  type TransportJourneyReceipt,
  type TransportKind,
  type TransportReceipt,
  type TransportStatus,
} from "./types";

// CHG-171 (GPS) — Tras registrar, la constancia se convierte en la
// pantalla del viaje: el GPS del teléfono del conductor queda activo
// en todo momento (mientras esta pantalla esté abierta) alimentando la
// trayectoria del mapa, y los botones marcan la salida y la llegada.

// Una posición cada ~20 s es suficiente para dibujar la trayectoria
// sin agotar el limitador del gateway (12/min).
const POSITION_INTERVAL_MS = 20_000;

const stampFormatter = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "America/Bogota",
});

export function TransportJourneyPanel({
  receipt,
  kind,
  onHome,
  startJourney = startTransportJourney,
  arriveJourney = arriveTransportJourney,
  sendPosition = sendTransportPosition,
  watchLocation = watchVisitorLocation,
  positionIntervalMs = POSITION_INTERVAL_MS,
}: {
  receipt: TransportReceipt;
  kind: TransportKind;
  onHome: () => void;
  // Inyectables en pruebas.
  startJourney?: (id: string) => Promise<TransportJourneyReceipt>;
  arriveJourney?: (id: string) => Promise<TransportJourneyReceipt>;
  sendPosition?: (
    id: string,
    position: { latitude: number; longitude: number },
  ) => Promise<TransportJourneyReceipt>;
  watchLocation?: (
    onUpdate: (center: GeographicCenter) => void,
    onRevoked?: () => void,
  ) => () => void;
  positionIntervalMs?: number;
}) {
  const [status, setStatus] = useState<TransportStatus>(receipt.status);
  const [busy, setBusy] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const lastSentRef = useRef(0);
  const statusRef = useRef<TransportStatus>(receipt.status);
  statusRef.current = status;

  // GPS activo desde que la pantalla existe hasta que el viaje llega
  // (o la pantalla se cierra). Cada lectura respeta el intervalo.
  useEffect(() => {
    if (status === "arrived" || status === "cancelled") {
      return;
    }
    setGpsError(null);
    const stop = watchLocation(
      (center) => {
        const now = Date.now();
        if (now - lastSentRef.current < positionIntervalMs) {
          return;
        }
        lastSentRef.current = now;
        sendPosition(receipt.id, {
          latitude: center.latitude,
          longitude: center.longitude,
        })
          .then(() => {
            setLastSentAt(stampFormatter.format(new Date()));
          })
          .catch(() => {
            // Sin drama: la siguiente lectura reintenta; el rastro
            // tolera huecos.
          });
      },
      () => {
        setGpsError(
          "El permiso de ubicación fue revocado. Actívalo de nuevo para seguir mostrando la trayectoria en el mapa.",
        );
      },
    );
    return stop;
    // watchLocation/sendPosition son estables (props inyectables).
  }, [status === "arrived" || status === "cancelled"]);

  const moveJourney = async (
    action: (id: string) => Promise<TransportJourneyReceipt>,
  ) => {
    setBusy(true);
    setJourneyError(null);
    try {
      const journey = await action(receipt.id);
      setStatus(journey.status);
    } catch (error: unknown) {
      setJourneyError(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el viaje.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={["#081210", colors.canvas]}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card} testID="transport-journey-panel">
          <View style={styles.confirmationIcon}>
            <Text style={styles.confirmationMark}>✓</Text>
          </View>
          <Text style={styles.overline}>CONSTANCIA / CUSOL</Text>
          <Text style={styles.title} accessibilityRole="header">
            Transporte registrado
          </Text>
          <Text style={styles.text}>
            {transportKindLabel[kind]} quedó registrada con su origen y su
            destino. Desde este momento el GPS de este teléfono alimenta
            la trayectoria del viaje en el mapa: mantén la pantalla
            abierta durante el recorrido.
          </Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>ESTADO DEL VIAJE</Text>
            <Text style={styles.statusValue} testID="journey-status">
              {transportStatusLabel[status] ?? status.toUpperCase()}
            </Text>
            <Text style={styles.gpsLine} testID="journey-gps-line">
              {gpsError
                ? gpsError
                : lastSentAt
                  ? `GPS activo · última posición enviada a las ${lastSentAt}`
                  : "GPS activo · esperando la primera posición..."}
            </Text>
          </View>

          {journeyError && (
            <Text
              style={styles.errorText}
              accessibilityRole="alert"
              testID="journey-error"
            >
              {journeyError}
            </Text>
          )}

          {status === "registered" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Iniciar el viaje"
              disabled={busy}
              onPress={() => void moveJourney(startJourney)}
              style={styles.primaryButton}
              testID="journey-start"
            >
              {busy ? (
                <ActivityIndicator color="#07101b" />
              ) : (
                <Text style={styles.primaryText}>INICIAR VIAJE →</Text>
              )}
            </Pressable>
          )}
          {status === "in_transit" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marcar la llegada al destino"
              disabled={busy}
              onPress={() => void moveJourney(arriveJourney)}
              style={[styles.primaryButton, styles.arriveButton]}
              testID="journey-arrive"
            >
              {busy ? (
                <ActivityIndicator color="#07101b" />
              ) : (
                <Text style={styles.primaryText}>YA LLEGUÉ ✓</Text>
              )}
            </Pressable>
          )}
          {status === "arrived" && (
            <Text style={styles.arrivedNote} testID="journey-arrived-note">
              El viaje quedó marcado como LLEGÓ y el mapa lo mostró de
              punta a punta. Gracias por transportar la ayuda.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la portada"
            onPress={onHome}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>VOLVER A LA PORTADA</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 600,
    alignItems: "center",
    gap: 12,
    padding: 36,
    borderWidth: 1,
    borderColor: "rgba(67,231,173,0.28)",
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  confirmationIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    borderRadius: 31,
    backgroundColor: colors.alive,
  },
  confirmationMark: { color: "#07101b", fontSize: font(28), fontWeight: "900" },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: font(34),
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  text: {
    color: colors.inkSoft,
    fontSize: font(12),
    lineHeight: 20,
    textAlign: "center",
  },
  statusBox: {
    width: "100%",
    alignItems: "center",
    gap: 7,
    marginVertical: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  statusLabel: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(8),
    letterSpacing: 0.8,
  },
  statusValue: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(21),
    fontWeight: "800",
    textAlign: "center",
  },
  gpsLine: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    letterSpacing: 0.4,
    textAlign: "center",
  },
  errorText: {
    color: colors.reported,
    fontSize: font(11),
    lineHeight: 17,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 50,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  arriveButton: { backgroundColor: colors.alive },
  primaryText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(10),
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  arrivedNote: {
    color: colors.alive,
    fontSize: font(12),
    lineHeight: 19,
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  secondaryText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
});
