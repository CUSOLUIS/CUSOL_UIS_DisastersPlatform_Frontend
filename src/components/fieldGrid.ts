import type { ViewStyle } from "react-native";

/**
 * CHG-116 — Rejilla de campos de los formularios largos.
 *
 * La regla estaba copiada en el registro, el reporte de persona y el
 * reporte de edificio, y en los tres tenía el mismo defecto: los
 * campos declaraban `flex: 1` (base 0) con `minWidth: 250`. Un
 * contenedor `wrap` reparte por líneas según la base, así que con base
 * 0 caben "todos" en la misma línea y después el `minWidth` los infla
 * hasta 250 cada uno: la línea acaba midiendo más que el contenedor y
 * el último campo se sale por la derecha. En web el motor acota la
 * base con el `minWidth` antes de repartir; Yoga no, y por eso el
 * defecto se veía en Android y no en el navegador.
 *
 * Aquí la base es real y el mínimo es cero: el `wrap` baja de línea
 * cuando de verdad no cabe otro campo, y si el contenedor mide menos
 * que la base, el campo encoge en lugar de desbordarse. El apilado en
 * pantalla estrecha sale de ahí solo, sin comparar el ancho de la
 * ventana —que no es el ancho del que disponen los campos: viven
 * dentro de una tarjeta con sus propios paddings—.
 */

// Ancho al que aspira un campo. Dos campos y su separación caben a
// partir de 512 px de contenedor; por debajo, uno por línea.
export const FIELD_BASIS = 250;

export const fieldGridLayout: {
  grid: ViewStyle;
  field: ViewStyle;
  fieldWide: ViewStyle;
} = {
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  field: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: FIELD_BASIS,
    // Sin esto, un campo puede exigir más ancho del que hay.
    minWidth: 0,
    gap: 7,
  },
  // Campos que ocupan la línea entera (textos largos, mapas).
  fieldWide: { flexBasis: "100%" },
};
