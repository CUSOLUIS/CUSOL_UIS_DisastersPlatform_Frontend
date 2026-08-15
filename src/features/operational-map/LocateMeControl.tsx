import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { getBrowserGeolocation } from "./visitorLocation";

// CHG-055/064: botón "mi ubicación" del mapa. El lienzo es dueño del
// estado (hook de seguimiento); aquí solo se presenta el botón, el
// spinner y el error. Sin geolocalización disponible no se ofrece.

interface LocateMeControlProps {
  onPress: () => void;
  locating: boolean;
  error: string | null;
  available?: boolean;
}

export function LocateMeControl({
  onPress,
  locating,
  error,
  available = getBrowserGeolocation() !== null,
}: LocateMeControlProps) {
  if (!available) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centrar el mapa en mi ubicación actual"
        accessibilityHint="El navegador pedirá permiso para conocer tu ubicación y el marcador te seguirá mientras la página esté abierta"
        disabled={locating}
        onPress={onPress}
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
