import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PressableStateCallbackType } from "react-native";
import { colors, fontFamilies } from "../theme";
import { font } from "../typography";

// CHG-095 — Ayuda contextual junto a la etiqueta de un campo: un botón
// "?" que despliega una explicación breve. En web se abre también al
// pasar el puntero; en táctil, donde no hay hover, basta con tocarlo.
// El texto se anuncia como `accessibilityHint` del propio botón, así
// que un lector de pantalla lo entrega sin tener que abrir nada.

export function FieldHelpTooltip({
  label,
  help,
  testID = "field-help",
}: {
  // Nombre del campo: da contexto al anuncio accesible.
  label: string;
  help: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.anchor}>
      <Pressable
        testID={`${testID}-trigger`}
        accessibilityRole="button"
        accessibilityLabel={`Qué es ${label}`}
        accessibilityHint={help}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        onHoverIn={() => setOpen(true)}
        onHoverOut={() => setOpen(false)}
        style={({ pressed }: PressableStateCallbackType) => [
          styles.trigger,
          open && styles.triggerActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.triggerText, open && styles.triggerTextActive]}>
          ?
        </Text>
      </Pressable>

      {open && (
        <View testID={`${testID}-popover`} style={styles.popover}>
          {/* La punta se dibuja rotando un cuadrado: react-native no
              tiene bordes en diagonal. */}
          <View style={styles.arrow} />
          <Text style={styles.popoverText}>{help}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // El ancla no crece: el popover flota en absoluto para no empujar la
  // cuadrícula de campos ni desalinear las columnas.
  anchor: { position: "relative", justifyContent: "center" },
  trigger: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: "rgba(81,229,255,0.06)",
  },
  triggerActive: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.14)",
  },
  triggerText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    lineHeight: 14,
  },
  triggerTextActive: { color: colors.cyan },
  popover: {
    position: "absolute",
    top: 28,
    left: -8,
    zIndex: 20,
    width: 260,
    maxWidth: 300,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.34)",
    borderRadius: 10,
    // Fondo sólido: el popover se monta sobre otros campos y no puede
    // dejar traslucir el texto de abajo.
    backgroundColor: "#0b1220",
  },
  arrow: {
    position: "absolute",
    top: -5,
    left: 12,
    width: 9,
    height: 9,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: "rgba(81,229,255,0.34)",
    borderLeftColor: "rgba(81,229,255,0.34)",
    backgroundColor: "#0b1220",
    transform: [{ rotate: "45deg" }],
  },
  popoverText: {
    color: colors.ink,
    fontSize: font(12),
    lineHeight: 18,
  },
  pressed: { opacity: 0.72 },
});
