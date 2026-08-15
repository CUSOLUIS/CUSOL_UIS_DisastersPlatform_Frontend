import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import type { GeographicCenter } from "./webMercator";
import {
  getBrowserGeolocation,
  requestVisitorLocation,
} from "./visitorLocation";

// CHG-055: botón "mi ubicación" del mapa. Pide el permiso del
// navegador y entrega la coordenada al lienzo para centrarse y marcar
// al visitante; los errores se muestran junto al botón y desaparecen.

interface LocateMeControlProps {
  onLocated: (center: GeographicCenter) => void;
  locate?: () => Promise<GeographicCenter>;
}

export function LocateMeControl({
  onLocated,
  locate = requestVisitorLocation,
}: LocateMeControlProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // Sin geolocalización disponible (p. ej. nativo sin módulo) el botón
  // no se ofrece.
  if (getBrowserGeolocation() === null && locate === requestVisitorLocation) {
    return null;
  }

  const press = async () => {
    setLocating(true);
    setError(null);
    try {
      const center = await locate();
      if (mounted.current) onLocated(center);
    } catch (caught: unknown) {
      if (mounted.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No fue posible obtener tu ubicación.",
        );
      }
    } finally {
      if (mounted.current) setLocating(false);
    }
  };

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centrar el mapa en mi ubicación actual"
        accessibilityHint="El navegador pedirá permiso para conocer tu ubicación"
        disabled={locating}
        onPress={() => void press()}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          locating && styles.buttonDisabled,
        ]}
        testID="locate-me-button"
      >
        {locating ? (
          <ActivityIndicator color={colors.cyan} size="small" />
        ) : (
          <Text style={styles.symbol}>◎</Text>
        )}
      </Pressable>
      {error && (
        <Text
          accessibilityRole="alert"
          style={styles.error}
          testID="locate-me-error"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    right: 12,
    top: 104,
    zIndex: 6,
    alignItems: "flex-end",
    gap: 6,
  },
  button: {
    width: 42,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.30)",
    borderRadius: 8,
    backgroundColor: "rgba(5,9,17,0.92)",
  },
  buttonPressed: { backgroundColor: "rgba(81,229,255,0.16)" },
  buttonDisabled: { opacity: 0.6 },
  symbol: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  error: {
    maxWidth: 220,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,103,136,0.32)",
    borderRadius: 7,
    color: colors.reported,
    backgroundColor: "rgba(5,9,17,0.94)",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "right",
  },
});
