import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";

// CHG-053: leyenda superior de los formularios de reporte ciudadano.
// Reúne las consideraciones del reporte y explica el beneficio de
// reportar con cuenta: notificaciones sobre el avance y mayor
// prioridad de revisión que los reportes anónimos.

interface ReportConsiderationsProps {
  considerations: string[];
  onRegister?: () => void;
  onLogin?: () => void;
}

export function ReportConsiderations({
  considerations,
  onRegister,
  onLogin,
}: ReportConsiderationsProps) {
  return (
    <View
      testID="report-considerations"
      accessibilityLabel="Consideraciones antes de enviar el reporte"
      style={styles.panel}
    >
      <Text style={styles.title}>ANTES DE ENVIAR ESTE REPORTE</Text>
      <View style={styles.list}>
        {considerations.map((consideration) => (
          <View key={consideration} style={styles.item}>
            <Text style={styles.bullet}>▸</Text>
            <Text style={styles.itemText}>{consideration}</Text>
          </View>
        ))}
      </View>

      <View style={styles.accountNote}>
        <Text style={styles.accountTitle}>REPORTAR CON CUENTA TIENE VENTAJAS</Text>
        <Text style={styles.accountText}>
          Puedes enviar este reporte de forma anónima, pero si te
          registras o inicias sesión antes de enviarlo podrás recibir
          notificaciones sobre su avance, y los reportes y comentarios
          hechos con cuenta tienen mayor prioridad de revisión que los
          anónimos.
        </Text>
        {(onRegister || onLogin) && (
          <View style={styles.accountActions}>
            {onRegister && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Registrarme para reportar con cuenta"
                onPress={onRegister}
                style={({ pressed }) => [
                  styles.accountButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.accountButtonText}>REGISTRARME</Text>
              </Pressable>
            )}
            {onLogin && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Iniciar sesión para reportar con cuenta"
                onPress={onLogin}
                style={({ pressed }) => [
                  styles.accountButtonGhost,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.accountButtonGhostText}>
                  YA TENGO CUENTA
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 13,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.24)",
    borderRadius: 12,
    backgroundColor: "rgba(81,229,255,0.045)",
  },
  title: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  list: { gap: 8 },
  item: { flexDirection: "row", gap: 8 },
  bullet: { color: colors.cyan, fontSize: 11, lineHeight: 17 },
  itemText: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 17,
  },
  accountNote: {
    gap: 8,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(137,166,207,0.16)",
  },
  accountTitle: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  accountText: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  accountActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  accountButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  accountButtonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  accountButtonGhost: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
    backgroundColor: "rgba(81,229,255,0.05)",
  },
  accountButtonGhostText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  pressed: { opacity: 0.72 },
});
