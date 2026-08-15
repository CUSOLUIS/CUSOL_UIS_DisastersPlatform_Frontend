import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { authDataSource } from "./dataSource";
import type { AuthenticatedAccount, EmailVerificationResult } from "./types";

// CHG-051: destino del enlace del correo de verificación. Consume el
// token contra el gateway; al validar, la cuenta queda activa y la
// sesión de bienvenida iniciada (cookie puesta por el gateway).

type VerificationState =
  | { status: "verifying" }
  | { status: "success"; account: AuthenticatedAccount }
  | { status: "error"; message: string };

interface EmailVerificationProps {
  token: string | null;
  verify?: (token: string) => Promise<EmailVerificationResult>;
  onEnter: () => void;
  onLogin: () => void;
}

export function EmailVerification({
  token,
  verify = authDataSource.verifyEmail,
  onEnter,
  onLogin,
}: EmailVerificationProps) {
  const [state, setState] = useState<VerificationState>(
    token
      ? { status: "verifying" }
      : {
          status: "error",
          message:
            "El enlace no incluye un token de verificación. Abre el " +
            "enlace completo que llegó a tu correo.",
        },
  );

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    verify(token)
      .then((result) => {
        if (mounted) {
          setState({ status: "success", account: result.account });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "No fue posible verificar el correo en este momento.",
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, [token, verify]);

  return (
    <LinearGradient
      colors={["#071119", colors.canvas]}
      style={[styles.root, styles.centered]}
    >
      {state.status === "verifying" && (
        <View
          style={styles.card}
          accessibilityLabel="Verificando el correo"
        >
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.overline}>ACCOUNT / VERIFICATION</Text>
          <Text style={styles.title} accessibilityRole="header">
            Verificando tu correo…
          </Text>
          <Text style={styles.text}>
            Estamos confirmando el enlace con el servidor. Esto toma
            solo un momento.
          </Text>
        </View>
      )}

      {state.status === "success" && (
        <View style={[styles.card, styles.cardSuccess]}>
          <View style={styles.successIcon}>
            <Text style={styles.successMark}>✓</Text>
          </View>
          <Text style={styles.overline}>SESSION / ACTIVE</Text>
          <Text style={styles.title} accessibilityRole="header">
            Correo confirmado
          </Text>
          <Text style={styles.text}>
            Bienvenido, {state.account.displayName}. Tu cuenta quedó
            activa y tu sesión ya está iniciada; puedes cerrarla cuando
            quieras desde el encabezado.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar a la plataforma"
            onPress={onEnter}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              ENTRAR A LA PLATAFORMA →
            </Text>
          </Pressable>
        </View>
      )}

      {state.status === "error" && (
        <View style={[styles.card, styles.cardError]}>
          <Text style={styles.overline}>ACCOUNT / VERIFICATION</Text>
          <Text style={styles.title} accessibilityRole="header">
            No pudimos verificar el correo
          </Text>
          <Text style={styles.text} accessibilityRole="alert">
            {state.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a iniciar sesión"
            onPress={onLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>IR A INICIAR SESIÓN</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la portada"
            onPress={onEnter}
            style={styles.secondaryLink}
          >
            <Text style={styles.secondaryLinkText}>Volver a la portada</Text>
          </Pressable>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  centered: { alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 560,
    alignItems: "center",
    gap: 13,
    padding: 36,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  cardSuccess: { borderColor: "rgba(67,231,173,0.28)" },
  cardError: { borderColor: "rgba(255,103,136,0.32)" },
  successIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 31,
    backgroundColor: colors.alive,
  },
  successMark: { color: "#07101b", fontSize: 28, fontWeight: "900" },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  text: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 51,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 23,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  primaryButtonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  secondaryLink: { padding: 10 },
  secondaryLinkText: { color: colors.cyan, fontSize: 11, fontWeight: "700" },
  pressed: { opacity: 0.72 },
});
