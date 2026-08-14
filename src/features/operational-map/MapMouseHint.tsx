import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";

export function MapMouseHint() {
  return (
    <View
      accessible
      accessibilityLabel="Controles de mouse: mantén clic izquierdo o derecho y arrastra para desplazar; usa la rueda para acercar o alejar"
      style={styles.hint}
    >
      <Text style={styles.text}>CLIC + ARRASTRAR · RUEDA = ZOOM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: "absolute",
    left: 8,
    bottom: 38,
    zIndex: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: "rgba(5,9,17,0.88)",
  },
  text: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    letterSpacing: 0.35,
  },
});
