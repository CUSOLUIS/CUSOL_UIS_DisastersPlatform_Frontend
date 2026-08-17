// CHG-128 — Portón de actualización obligatoria de la app instalada.
// Al abrir el APK se consulta el manifiesto del VPS; si existe una
// versión más nueva, esta pantalla bloquea toda la app y «Actualizar
// ahora» inicia de inmediato la descarga del APK nuevo. Con la
// revisión al día, sin manifiesto válido o fuera de la app instalada,
// los hijos se renderizan normal (DEC-128-03: falla abierta).

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  detectRuntimeContext,
  rulesForRuntime,
} from "../../platform/runtimeContext";
import {
  APP_DOWNLOAD_URL,
  embeddedAppRevision,
  fetchLatestAppRevision,
  updateRequired,
} from "./appUpdate";

type GateStatus = "checking" | "outdated" | "ready";

export function AppUpdateGate({
  children,
  platformOs = Platform.OS,
  revision = embeddedAppRevision(),
  fetchLatest = fetchLatestAppRevision,
  openDownload = () => Linking.openURL(APP_DOWNLOAD_URL),
}: {
  children: React.ReactNode;
  platformOs?: typeof Platform.OS;
  revision?: string | null;
  fetchLatest?: () => Promise<string | null>;
  openDownload?: () => Promise<unknown> | void;
}) {
  const gateRequired =
    rulesForRuntime(detectRuntimeContext(platformOs))
      .requireLatestAppVersion && revision !== null;
  const [status, setStatus] = useState<GateStatus>(
    gateRequired ? "checking" : "ready",
  );

  useEffect(() => {
    if (!gateRequired) return;
    let mounted = true;
    void fetchLatest().then((latest) => {
      if (!mounted) return;
      setStatus(updateRequired(revision, latest) ? "outdated" : "ready");
    });
    return () => {
      mounted = false;
    };
  }, [gateRequired, revision, fetchLatest]);

  const startDownload = useCallback(() => {
    // La descarga arranca de inmediato al aceptar; el sistema instala
    // el APK y la app se reabre ya actualizada.
    void openDownload();
  }, [openDownload]);

  if (status === "ready") return <>{children}</>;

  if (status === "checking") {
    return (
      <View style={styles.root} testID="app-update-checking">
        <ActivityIndicator color={colors.cyan} />
        <Text style={styles.overline}>VERIFICANDO VERSIÓN…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="app-update-gate">
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.overline}>ACTUALIZACIÓN OBLIGATORIA</Text>
        <Text style={styles.title}>Hay una versión más nueva de la app</Text>
        <Text style={styles.body}>
          Esta versión quedó desactualizada y la app no puede usarse hasta
          instalar la última. Acepta para descargarla ahora mismo; al
          terminar, instálala y vuelve a abrir la app.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.updateButton}
          onPress={startDownload}
        >
          <Text style={styles.updateButtonText}>ACTUALIZAR AHORA</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "700",
  },
  body: {
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  updateButton: {
    marginTop: 6,
    backgroundColor: colors.cyan,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  updateButtonText: {
    color: colors.canvas,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
});
