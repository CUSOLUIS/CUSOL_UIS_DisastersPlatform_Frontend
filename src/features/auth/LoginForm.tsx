import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontFamilies } from "../../theme";
import { authDataSource } from "./dataSource";
import type { AccountSessionInput, AuthenticatedAccount } from "./types";

interface LoginFormProps {
  onBack: () => void;
  onRegister: () => void;
  login?: (input: AccountSessionInput) => Promise<AuthenticatedAccount>;
  onAuthenticated?: (account: AuthenticatedAccount) => void;
}

export function LoginForm({
  onBack,
  onRegister,
  login = authDataSource.login,
  onAuthenticated,
}: LoginFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<AuthenticatedAccount | null>(null);

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError("Ingresa un correo válido y tu contraseña.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const authenticated = await login({
        email: email.trim().toLocaleLowerCase("es-CO"),
        password,
      });
      setAccount(authenticated);
      onAuthenticated?.(authenticated);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Correo o contraseña incorrectos.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (account) {
    return (
      <LinearGradient colors={["#071119", colors.canvas]} style={[styles.root, styles.centered]}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}><Text style={styles.successMark}>✓</Text></View>
          <Text style={styles.overline}>SESSION / ACTIVE</Text>
          <Text style={styles.successTitle} accessibilityRole="header">Sesión iniciada</Text>
          <Text style={styles.successText}>Bienvenido, {account.displayName}. Tu sesión privada está activa.</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>IR A LA PORTADA</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#070a13", colors.canvas, "#080d18"]} style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver a la portada" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
          <Text style={styles.headerStatus}>ACCESO PRIVADO · SESIÓN SEGURA</Text>
        </View>
        <View style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.intro}>
            <Text style={styles.overline}>ACCOUNT / SIGN IN</Text>
            <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">Iniciar sesión</Text>
            <Text style={styles.introText}>Accede con el correo verificado de tu cuenta. Nunca compartas tu contraseña.</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Correo electrónico</Text>
              <TextInput accessibilityLabel="Correo electrónico" autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="nombre@correo.com" placeholderTextColor="#4b586d" style={styles.input} value={email} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Contraseña</Text>
              <View style={styles.passwordShell}>
                <TextInput accessibilityLabel="Contraseña" autoCapitalize="none" maxLength={128} onChangeText={setPassword} placeholder="Tu contraseña" placeholderTextColor="#4b586d" secureTextEntry={!passwordVisible} style={styles.passwordInput} value={password} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${passwordVisible ? "Ocultar" : "Mostrar"} contraseña`} onPress={() => setPasswordVisible((current) => !current)} style={styles.passwordToggle}>
                  <Text style={styles.passwordToggleText}>{passwordVisible ? "OCULTAR" : "MOSTRAR"}</Text>
                </Pressable>
              </View>
            </View>
            {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Iniciar sesión" disabled={submitting} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, submitting && styles.disabled]}>
              {submitting ? <ActivityIndicator color="#06101a" /> : <Text style={styles.primaryButtonText}>INICIAR SESIÓN →</Text>}
            </Pressable>
            <Text style={styles.securityNote}>La sesión usa una cookie privada HttpOnly. La aplicación no guarda tu contraseña.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onRegister} style={styles.registerLink}>
            <Text style={styles.registerLinkText}>¿Aún no tienes cuenta? Registrarse</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  safeArea: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: 20 },
  header: { width: "100%", maxWidth: 1380, minHeight: 76, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingRight: 12 },
  backArrow: { color: colors.cyan, fontSize: 24 },
  backText: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  headerStatus: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 8, letterSpacing: 0.7 },
  page: { width: "100%", maxWidth: 620, alignSelf: "center", justifyContent: "center", flex: 1, gap: 18, paddingHorizontal: 24, paddingVertical: 48 },
  pageCompact: { paddingHorizontal: 12, paddingVertical: 34 },
  intro: { gap: 8 },
  overline: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1.4, textAlign: "center" },
  title: { color: colors.ink, fontSize: 54, fontWeight: "800", letterSpacing: -2.8, lineHeight: 59, textAlign: "center" },
  titleCompact: { fontSize: 39, letterSpacing: -2, lineHeight: 44 },
  introText: { color: colors.inkSoft, fontSize: 12, lineHeight: 20, textAlign: "center" },
  card: { gap: 16, padding: 24, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.panel },
  field: { gap: 7 },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  input: { minHeight: 50, paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, color: colors.ink, backgroundColor: "rgba(5,9,17,0.72)", fontSize: 12 },
  passwordShell: { minHeight: 50, flexDirection: "row", alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, backgroundColor: "rgba(5,9,17,0.72)" },
  passwordInput: { minWidth: 0, flex: 1, paddingHorizontal: 13, color: colors.ink, fontSize: 12 },
  passwordToggle: { alignSelf: "stretch", justifyContent: "center", paddingHorizontal: 12 },
  passwordToggleText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 0.6 },
  error: { padding: 12, borderWidth: 1, borderColor: "rgba(255,103,136,0.32)", borderRadius: 8, color: colors.reported, backgroundColor: "rgba(255,103,136,0.07)", fontSize: 10, lineHeight: 16 },
  primaryButton: { minHeight: 51, alignItems: "center", justifyContent: "center", paddingHorizontal: 23, borderRadius: 8, backgroundColor: colors.cyan },
  primaryButtonText: { color: "#06101a", fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  securityNote: { color: colors.inkDim, fontSize: 9, lineHeight: 15, textAlign: "center" },
  registerLink: { alignSelf: "center", padding: 10 },
  registerLinkText: { color: colors.cyan, fontSize: 11, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
  successCard: { width: "100%", maxWidth: 560, alignItems: "center", gap: 13, padding: 36, borderWidth: 1, borderColor: "rgba(67,231,173,0.28)", borderRadius: 16, backgroundColor: colors.panel },
  successIcon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 31, backgroundColor: colors.alive },
  successMark: { color: "#07101b", fontSize: 28, fontWeight: "900" },
  successTitle: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.5, textAlign: "center" },
  successText: { color: colors.inkSoft, fontSize: 12, lineHeight: 20, textAlign: "center" },
});
