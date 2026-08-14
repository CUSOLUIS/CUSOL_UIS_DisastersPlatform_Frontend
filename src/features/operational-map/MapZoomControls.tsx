import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";

interface MapZoomControlsProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function MapZoomControls({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}: MapZoomControlsProps) {
  return (
    <View style={styles.controls} accessibilityLabel="Controles de zoom del mapa">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Acercar mapa"
        accessibilityState={{ disabled: !canZoomIn }}
        disabled={!canZoomIn}
        onPress={onZoomIn}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          !canZoomIn && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.symbol}>+</Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alejar mapa"
        accessibilityState={{ disabled: !canZoomOut }}
        disabled={!canZoomOut}
        onPress={onZoomOut}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          !canZoomOut && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.symbol}>−</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.30)",
    borderRadius: 8,
    backgroundColor: "rgba(5,9,17,0.92)",
  },
  button: { width: 42, height: 40, alignItems: "center", justifyContent: "center" },
  buttonPressed: { backgroundColor: "rgba(81,229,255,0.16)" },
  buttonDisabled: { opacity: 0.35 },
  divider: { height: 1, backgroundColor: colors.line },
  symbol: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 22, fontWeight: "500", lineHeight: 24 },
});
