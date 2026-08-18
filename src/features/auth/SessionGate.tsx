import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import type { SessionAccountState } from "./useSessionAccount";

// CHG-161 — Portón de sesión de los formularios que exigen cuenta
// (transportes, acopio local, punto de distribución): sin sesión el
// contenido no se muestra y jamás se envía nada; en su lugar se
// explica el porqué y se ofrece registrarse o iniciar sesión.

interface SessionGateProps {
  session: SessionAccountState;
  // Por qué este registro exige una cuenta, en palabras de la acción.
  explanation: string;
  // Permite compartir el mismo JSX entre tipos con y sin portón
  // (AidLocationForm): con `required` en falso no hay portón alguno.
  required?: boolean;
  onRegister?: () => void;
  onLogin?: () => void;
  children: React.ReactNode;
}

export function SessionGate({
  session,
  explanation,
  required = true,
  onRegister,
  onLogin,
  children,
}: SessionGateProps) {
  if (!required || session.status === "authenticated") {
    return <>{children}</>;
  }

  if (session.status === "resolving") {
    return (
      <View style={styles.resolving} testID="session-gate-resolving">
        <ActivityIndicator color={colors.cyan} />
        <Text style={styles.resolvingText}>Comprobando tu sesión…</Text>
      </View>
    );
  }

  return (
    <View
      testID="session-gate"
      accessibilityLabel="Este registro exige iniciar sesión"
      style={styles.panel}
    >
      <Text style={styles.title}>ESTE REGISTRO EXIGE UNA CUENTA</Text>
      <Text style={styles.explanation}>{explanation}</Text>
      <Text style={styles.note}>
        Con tu cuenta el registro queda asociado a una persona
        responsable y podrás recibir notificaciones sobre su avance.
      </Text>
      <View style={styles.actions}>
        {onRegister && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Registrarme para continuar"
            onPress={onRegister}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>REGISTRARME</Text>
          </Pressable>
        )}
        {onLogin && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión para continuar"
            onPress={onLogin}
            style={({ pressed }) => [
              styles.buttonGhost,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonGhostText}>YA TENGO CUENTA</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  resolving: {
    alignItems: "center",
    gap: 12,
    padding: 40,
  },
  resolvingText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.7,
  },
  panel: {
    gap: 13,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.28)",
    borderRadius: 14,
    backgroundColor: "rgba(81,229,255,0.05)",
  },
  title: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  explanation: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  note: { color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  button: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  buttonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  buttonGhost: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 8,
    backgroundColor: "rgba(81,229,255,0.05)",
  },
  buttonGhostText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  pressed: { opacity: 0.72 },
});
