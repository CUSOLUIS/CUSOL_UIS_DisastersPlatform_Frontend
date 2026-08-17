import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { fontFamilies } from "../../theme";

interface HelpRequestMarkerIconProps {
  color: string;
  glyph: string;
  selected?: boolean;
  animated?: boolean;
}

// CHG-125 — Marcador rojo de emergencia: el núcleo titila y dos ondas
// crecen y se desvanecen alrededor para destacar la solicitud. Con
// movimiento reducido (DEC-125-05) queda el marcador rojo estático,
// distinguible por color y glifo.
export function HelpRequestMarkerIcon({
  color,
  glyph,
  selected = false,
  animated = true,
}: HelpRequestMarkerIconProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const waveOne = useRef(new Animated.Value(0)).current;
  const waveTwo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || reducedMotion) {
      return;
    }

    const useNativeDriver = Platform.OS !== "web";
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
      ]),
    );
    const ripple = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1_500,
            easing: Easing.out(Easing.ease),
            useNativeDriver,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver,
          }),
        ]),
      );

    const waves = [ripple(waveOne, 0), ripple(waveTwo, 750)];
    blink.start();
    waves.forEach((wave) => wave.start());
    return () => {
      blink.stop();
      waves.forEach((wave) => wave.stop());
    };
  }, [animated, pulse, reducedMotion, waveOne, waveTwo]);

  const waveStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0, 0.55, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 2.1],
        }),
      },
    ],
  });

  return (
    <View
      testID="help-request-marker-icon"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, selected && styles.frameSelected]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.wave, { borderColor: color }, waveStyle(waveOne)]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.wave, { borderColor: color }, waveStyle(waveTwo)]}
      />
      <Animated.View
        style={[
          styles.core,
          selected && styles.coreSelected,
          { borderColor: color, backgroundColor: color, opacity: pulse },
        ]}
      >
        <Text style={styles.glyph}>{glyph}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  frameSelected: {
    width: 44,
    height: 44,
  },
  wave: {
    position: "absolute",
    width: 26,
    height: 26,
    borderWidth: 2,
    borderRadius: 14,
  },
  core: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 13,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },
  coreSelected: {
    width: 30,
    height: 30,
    borderRadius: 16,
  },
  glyph: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 15,
  },
});
