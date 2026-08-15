// CHG-074: barrera de errores de la app instalada. Un error de render
// en React Native de producción cierra la app abruptamente; esta
// barrera lo captura, muestra una pantalla de recuperación y permite
// reintentar sin reinstalar.

import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../theme";

interface CrashGuardState {
  failed: boolean;
}

export class CrashGuard extends Component<
  { children: ReactNode },
  CrashGuardState
> {
  state: CrashGuardState = { failed: false };

  static getDerivedStateFromError(): CrashGuardState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.root} testID="crash-guard">
        <View style={styles.card}>
          <Text style={styles.overline}>CUSOL · DESASTRES COLOMBIA</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Algo salió mal
          </Text>
          <Text style={styles.body}>
            La aplicación encontró un error inesperado. Puedes
            reintentar sin perder la instalación.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            onPress={() => this.setState({ failed: false })}
            style={styles.button}
          >
            <Text style={styles.buttonText}>REINTENTAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 22,
    gap: 12,
  },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  button: {
    marginTop: 4,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.cyan,
  },
  buttonText: {
    color: colors.canvas,
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});
