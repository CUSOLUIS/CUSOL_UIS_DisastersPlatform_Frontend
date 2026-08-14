import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { fontFamilies } from "../../theme";

interface PersonMarkerIconProps {
  color: string;
  glyph: string;
  selected?: boolean;
  animated?: boolean;
}

export function PersonMarkerIcon({
  color,
  glyph,
  selected = false,
  animated = true,
}: PersonMarkerIconProps) {
  const reducedMotion = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || reducedMotion) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, {
          toValue: -3,
          duration: 780,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(offset, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [animated, offset, reducedMotion]);

  return (
    <Animated.View
      testID="person-marker-icon"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.shell,
        selected && styles.shellSelected,
        { borderColor: color, transform: [{ translateY: offset }] },
      ]}
    >
      <Svg width={selected ? 24 : 21} height={selected ? 28 : 25} viewBox="0 0 24 28">
        <Circle cx="12" cy="6" r="4" fill={color} />
        <Path
          d="M5 25c.7-7 3-11 7-11s6.3 4 7 11M12 14v11M8 18l-4 4M16 18l4 4"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{glyph}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: 32,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "rgba(5, 9, 17, 0.92)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  shellSelected: {
    width: 39,
    height: 45,
    borderWidth: 2,
    shadowOpacity: 0.7,
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
  badgeText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "900",
  },
});
