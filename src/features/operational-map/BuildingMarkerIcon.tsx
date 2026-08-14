import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { fontFamilies } from "../../theme";

interface BuildingMarkerIconProps {
  color: string;
  glyph: string;
  selected?: boolean;
  animated?: boolean;
}

export function BuildingMarkerIcon({
  color,
  glyph,
  selected = false,
  animated = true,
}: BuildingMarkerIconProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated || reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.62,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [animated, opacity, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="building-marker-icon"
      style={[
        styles.shell,
        selected && styles.shellSelected,
        { borderColor: color, opacity },
      ]}
    >
      <Svg width={selected ? 27 : 23} height={selected ? 29 : 25} viewBox="0 0 26 30">
        <Path d="M4 27V5h13v22M17 11h5v16M2 27h22" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="7" y="9" width="2.5" height="2.5" fill={color} />
        <Rect x="12" y="9" width="2.5" height="2.5" fill={color} />
        <Rect x="7" y="15" width="2.5" height="2.5" fill={color} />
        <Rect x="12" y="15" width="2.5" height="2.5" fill={color} />
        <Path d="M9 27v-5h4v5" fill="none" stroke={color} strokeWidth="1.8" />
      </Svg>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{glyph}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 9,
    backgroundColor: "rgba(5,9,17,0.94)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  shellSelected: {
    width: 41,
    height: 47,
    borderWidth: 2,
    shadowOpacity: 0.72,
    shadowRadius: 12,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -6,
    width: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  badgeText: { color: "#07101b", fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900" },
});
