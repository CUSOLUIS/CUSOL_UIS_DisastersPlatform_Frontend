import { useRef } from "react";
import { Animated, type ImageProps } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

// CHG-063: imagen que permanece invisible mientras descarga y aparece
// con un fundido al terminar, en lugar de pintarse a pedazos. Con
// "reducir movimiento" activo aparece de una vez, pero igualmente solo
// cuando ya cargó completa.

export function FadeInImage({ style, onLoad, ...props }: ImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  return (
    <Animated.Image
      {...props}
      style={[style, { opacity }]}
      onLoad={(event) => {
        if (reducedMotion) {
          opacity.setValue(1);
        } else {
          Animated.timing(opacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }).start();
        }
        onLoad?.(event);
      }}
    />
  );
}
