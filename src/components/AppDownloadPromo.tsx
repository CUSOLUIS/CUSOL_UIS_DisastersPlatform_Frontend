import { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../theme";

// CHG-065: anuncio de descarga de la app al entrar a la plataforma web.
// Dura 10 segundos con cuenta regresiva visible, se puede cerrar con la
// X o se cierra solo, y aparece una única vez por sesión del navegador.

export const APP_DOWNLOAD_PROMO_SECONDS = 10;
export const ANDROID_APK_PATH = "/descargas/cusol-disasters.apk";
const SESSION_KEY = "cusol-app-promo-shown";

function alreadyShownThisSession(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
    sessionStorage.setItem(SESSION_KEY, "1");
    return false;
  } catch {
    return false;
  }
}

interface AppDownloadPromoProps {
  enabled?: boolean;
  seconds?: number;
}

export function AppDownloadPromo({
  enabled = Platform.OS === "web",
  seconds = APP_DOWNLOAD_PROMO_SECONDS,
}: AppDownloadPromoProps) {
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!enabled || alreadyShownThisSession()) return;
    setVisible(true);
  }, [enabled]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          setVisible(false);
          return 0;
        }
        return current - 1;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <View
      style={styles.backdrop}
      testID="app-download-promo"
      accessibilityViewIsModal
    >
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.overline}>APP OFICIAL / DESCARGA DIRECTA</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar anuncio de descarga"
            onPress={() => setVisible(false)}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
            testID="app-download-promo-close"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <Text style={styles.title} accessibilityRole="header">
          Lleva CUSOL Desastres en tu bolsillo
        </Text>
        <Text style={styles.text}>
          La misma plataforma, con el mapa, los reportes y tu cuenta,
          lista para instalar en tu teléfono. Cada actualización de la
          plataforma reconstruye la app automáticamente.
        </Text>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Descargar la app para Android"
          onPress={() => void Linking.openURL(ANDROID_APK_PATH)}
          style={({ pressed }) => [
            styles.downloadButton,
            pressed && styles.pressed,
          ]}
          testID="app-download-promo-android"
        >
          <Text style={styles.downloadButtonText}>
            DESCARGAR PARA ANDROID (.APK)
          </Text>
        </Pressable>
        <Text style={styles.iosNote}>
          ¿iPhone? Abre esta página en Safari y usa Compartir → Añadir a
          pantalla de inicio.
        </Text>

        <Text
          style={styles.countdown}
          accessibilityLiveRegion="polite"
          testID="app-download-promo-countdown"
        >
          ESTE ANUNCIO SE CIERRA EN {remaining} S
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(3, 6, 12, 0.82)",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    gap: 13,
    padding: 26,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.32)",
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "rgba(5,9,17,0.8)",
  },
  closeText: { color: colors.ink, fontSize: 20, lineHeight: 22 },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -1,
  },
  text: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  downloadButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 9,
    backgroundColor: colors.cyan,
  },
  downloadButtonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  iosNote: { color: colors.inkDim, fontSize: 11, lineHeight: 17 },
  countdown: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textAlign: "right",
  },
  pressed: { opacity: 0.72 },
});
