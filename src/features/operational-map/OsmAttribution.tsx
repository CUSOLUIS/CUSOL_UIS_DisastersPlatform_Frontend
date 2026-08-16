import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { tileProvider } from "./tileProvider";

export function OsmAttribution() {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Atribución de ${tileProvider.attribution}`}
      onPress={() => {
        void Linking.openURL(tileProvider.attributionUrl);
      }}
      style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{tileProvider.attribution}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  attribution: {
    position: "absolute",
    right: 8,
    bottom: 8,
    zIndex: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: "rgba(5,9,17,0.88)",
  },
  pressed: { opacity: 0.72 },
  text: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    textDecorationLine: "underline",
  },
});
