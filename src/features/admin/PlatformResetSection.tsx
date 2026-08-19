// CHG-139 — Sección «10 · Reinicio» de la consola (renumerada por
// CHG-165): el reinicio
// absoluto de la plataforma. Borra TODOS los datos de emergencia,
// fotografías, auditoría y cuentas (excepto la del super admin que lo
// ordena, cuya sesión sobrevive). Para ejecutarlo hay que escribir la
// frase exacta: no existe el clic accidental.

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { PLATFORM_RESET_CONFIRMATION } from "./types";
import type { AdminDataSource, AdminPlatformResetReceipt } from "./types";

export function PlatformResetSection({
  dataSource,
}: {
  dataSource: AdminDataSource;
}) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<AdminPlatformResetReceipt | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const phraseMatches = phrase.trim() === PLATFORM_RESET_CONFIRMATION;

  const runReset = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await dataSource.resetPlatform(phrase.trim());
      setReceipt(result);
      setPhrase("");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "El reinicio no se completó; consulta y reintenta.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="admin-platform-reset-section">
      <View style={styles.dangerPanel}>
        <Text style={styles.overline}>ZONA DE PELIGRO · IRREVERSIBLE</Text>
        <Text style={styles.title}>Reinicio absoluto de la plataforma</Text>
        <Text style={styles.body}>
          Borra TODO: personas desaparecidas, edificios, ofertas,
          solicitudes de ayuda, puntos del mapa, fotografías, auditoría y
          todas las cuentas registradas excepto la tuya. La plataforma
          queda como recién instalada y esta operación no se puede
          deshacer. El acto quedará como el primer evento de la
          auditoría nueva.
        </Text>
        <Text style={styles.instruction}>
          {`Para confirmar, escribe exactamente: ${PLATFORM_RESET_CONFIRMATION}`}
        </Text>
        <TextInput
          accessibilityLabel="Frase de confirmación del reinicio"
          style={styles.input}
          value={phrase}
          onChangeText={setPhrase}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={PLATFORM_RESET_CONFIRMATION}
          placeholderTextColor={colors.inkDim}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ejecutar el reinicio absoluto de la plataforma"
          accessibilityState={{ disabled: !phraseMatches || busy }}
          disabled={!phraseMatches || busy}
          onPress={() => void runReset()}
          style={[
            styles.resetButton,
            (!phraseMatches || busy) && styles.resetButtonDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.emergency} />
          ) : (
            <Text style={styles.resetButtonText}>
              REINICIAR LA PLATAFORMA
            </Text>
          )}
        </Pressable>
      </View>

      {errorMessage && (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      )}

      {receipt && (
        <View style={styles.receipt} accessibilityRole="alert">
          <Text style={styles.receiptTitle}>PLATAFORMA REINICIADA</Text>
          <Text style={styles.receiptText}>
            {`Se vaciaron ${receipt.tablesCleared} tablas de datos y se eliminaron ${receipt.accountsDeleted} cuentas. Tu cuenta y tu sesión siguen activas; la auditoría nueva empieza con este acto.`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  dangerPanel: {
    gap: 10,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.emergency,
    borderRadius: 12,
    backgroundColor: "rgba(255,77,94,0.06)",
  },
  overline: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  title: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  body: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  instruction: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.5)",
    borderRadius: 8,
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    letterSpacing: 1,
    backgroundColor: "rgba(5,9,17,0.6)",
  },
  resetButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.emergency,
    borderRadius: 8,
    backgroundColor: "rgba(255,77,94,0.14)",
  },
  resetButtonDisabled: { opacity: 0.4 },
  resetButtonText: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  error: {
    color: colors.reported,
    fontSize: 10,
    lineHeight: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,103,136,0.34)",
    borderRadius: 8,
  },
  receipt: {
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(67,231,173,0.34)",
    borderRadius: 9,
    backgroundColor: "rgba(67,231,173,0.07)",
  },
  receiptTitle: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  receiptText: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
});
