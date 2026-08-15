import { PixelRatio, Platform } from "react-native";

// CHG-090 (QA): React Native no admite unidades rem/em, así que la
// escala tipográfica se resuelve aquí. `font()` traduce un tamaño base
// en píxeles aplicando la preferencia de tamaño de letra del usuario:
// en web, el tamaño de fuente raíz del navegador —exactamente lo que
// haría `rem`—; en nativo, el ajuste de accesibilidad del sistema.
//
// La preferencia se lee una sola vez al cargar el módulo porque los
// `StyleSheet.create` se construyen en ese momento. Cambiarla exige
// recargar, igual que una hoja de estilos con `rem` ya servida a un
// navegador abierto.

export const rootFontSize = 16;

// El factor se acota: un ajuste extremo no debe romper la diagramación
// de la portada, pero tampoco puede encoger el texto por debajo del
// diseño original.
export const minFontScale = 1;
export const maxFontScale = 1.6;

// Piso de legibilidad. El informe de QA marcó como ilegibles las
// etiquetas de 7 y 8 px del encabezado, las viñetas y el pie.
export const minLegibleFontSize = 11;

export function clampFontScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return minFontScale;
  }

  return Math.min(maxFontScale, Math.max(minFontScale, scale));
}

export function readUserFontScale(): number {
  if (Platform.OS !== "web") {
    return clampFontScale(PixelRatio.getFontScale());
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return minFontScale;
  }

  const root = document.documentElement;
  if (!root || typeof window.getComputedStyle !== "function") {
    return minFontScale;
  }

  const parsed = Number.parseFloat(window.getComputedStyle(root).fontSize);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return minFontScale;
  }

  return clampFontScale(parsed / rootFontSize);
}

export const userFontScale = readUserFontScale();

// Tamaño de letra: nunca por debajo del piso legible y siempre
// multiplicado por la preferencia del usuario.
export function font(size: number): number {
  return Math.round(Math.max(size, minLegibleFontSize) * userFontScale);
}

// Medidas que acompañan al texto (interlineado, alturas de línea): se
// escalan igual, pero sin el piso de legibilidad, que solo aplica al
// cuerpo de la letra.
export function scaled(size: number): number {
  return Math.round(size * userFontScale);
}
