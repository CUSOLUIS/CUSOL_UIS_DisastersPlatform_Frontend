import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { ReportRejectedError } from "../missing-persons/reportSubmission";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import { CountdownLabel } from "./CountdownLabel";
import { communityTextIssue } from "../humanitarian-directory/textQuality";
import {
  submitHelpRequestVolunteer,
  type HelpRequestVolunteerDraft,
} from "./volunteerSubmission";
import type { ActiveHelpRequest, HelpRequestAttendReceipt } from "./types";

// CHG-148 — Ventana de acción de una solicitud tocada en el mapa.
// Muestra la info y, según la sesión, la acción de voluntario:
//   · con cuenta → botón que registra la atención (aumenta el contador);
//   · sin cuenta → formulario con los datos personales del voluntario
//     (nombre, teléfono, correo, foto opcional). Esos datos son
//     PRIVADOS (solo super_admin); el público solo ve el contador.

const countFormatter = new Intl.NumberFormat("es-CO");
const VOLUNTEER_MIN_NAME_WORDS = 1;

function attendersLabel(count: number): string {
  return count === 1
    ? "1 PERSONA ATENDIENDO"
    : `${countFormatter.format(count)} PERSONAS ATENDIENDO`;
}

export interface HelpRequestActionSheetProps {
  request: ActiveHelpRequest;
  visible: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  attend: (id: string) => Promise<HelpRequestAttendReceipt>;
  onAttended?: () => void;
  onLogin?: () => void;
  onRegister?: () => void;
  // Selector de foto opcional del voluntario (inyectable en pruebas).
  pickPhoto?: () => Promise<SelectedPhoto[]>;
  submitVolunteer?: typeof submitHelpRequestVolunteer;
  // CHG-164: abre la vista de información completa de la solicitud.
  onViewMore?: () => void;
}

const initialDraft: HelpRequestVolunteerDraft = {
  name: "",
  phone: "",
  email: "",
};

export function HelpRequestActionSheet({
  request,
  visible,
  onClose,
  isAuthenticated,
  attend,
  onAttended,
  onLogin,
  onRegister,
  pickPhoto,
  submitVolunteer = submitHelpRequestVolunteer,
  onViewMore,
}: HelpRequestActionSheetProps) {
  const [count, setCount] = useState(request.attendersCount);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<HelpRequestVolunteerDraft>(initialDraft);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [invalid, setInvalid] = useState<Set<keyof HelpRequestVolunteerDraft>>(
    () => new Set(),
  );

  const setField = (key: keyof HelpRequestVolunteerDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const attendNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const receipt = await attend(request.id);
      setCount(receipt.attendersCount);
      setDone(true);
      onAttended?.();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible registrar la atención. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pickVolunteerPhoto = async () => {
    if (!pickPhoto) {
      return;
    }
    try {
      const picked = await pickPhoto();
      if (picked.length > 0) {
        setPhotos(picked.slice(0, 1));
      }
    } catch {
      setError("No fue posible abrir el selector de fotografías.");
    }
  };

  const volunteerNow = async () => {
    const issues = new Set<keyof HelpRequestVolunteerDraft>();
    if (
      draft.name.trim().length === 0 ||
      communityTextIssue(draft.name, VOLUNTEER_MIN_NAME_WORDS) !== null
    ) {
      issues.add("name");
    }
    setInvalid(issues);
    if (issues.size > 0) {
      setError("Escribe tu nombre para ofrecerte como voluntario.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const receipt = await submitVolunteer(request.id, draft, photos);
      setCount(receipt.attendersCount);
      setDone(true);
      onAttended?.();
    } catch (caught: unknown) {
      if (caught instanceof ReportRejectedError && caught.fields.length > 0) {
        setInvalid(new Set(["name"]));
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible registrarte como voluntario. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="help-request-action-sheet">
          <ScrollView
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Text style={styles.category}>
                NECESITAMOS AYUDA · SOLICITUD VIGENTE
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={onClose}
                style={styles.close}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{request.address}</Text>
            <Text style={styles.description}>{request.description}</Text>
            <View style={styles.metaRow}>
              <CountdownLabel
                expiresAt={request.expiresAt}
                style={[styles.meta, { color: colors.emergency }]}
              />
              <Text style={styles.meta} testID="action-sheet-count">
                {attendersLabel(count)}
              </Text>
            </View>

            {/* CHG-164: información completa de la solicitud, para
                cualquier visitante (anónimo o con cuenta). */}
            {onViewMore && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver más información de la solicitud"
                onPress={onViewMore}
                style={styles.viewMoreButton}
                testID="action-sheet-view-more"
              >
                <Text style={styles.viewMoreText}>VER MÁS</Text>
              </Pressable>
            )}

            {done ? (
              <View style={styles.confirmation} accessibilityRole="alert">
                <Text style={styles.confirmationText}>
                  {isAuthenticated
                    ? "Quedaste registrado como atendiendo esta solicitud. ¡Gracias!"
                    : "Gracias por ofrecerte. Quedaste en la lista de voluntarios."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  onPress={onClose}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>LISTO</Text>
                </Pressable>
              </View>
            ) : isAuthenticated ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Atender esta solicitud"
                disabled={busy}
                onPress={() => void attendNow()}
                style={[styles.primaryButton, busy && styles.disabled]}
              >
                {busy ? (
                  <ActivityIndicator color="#07101b" />
                ) : (
                  <Text style={styles.primaryButtonText}>ATENDER SOLICITUD</Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.form}>
                <Text style={styles.formTitle}>
                  OFRÉCETE COMO VOLUNTARIO
                </Text>
                <Text style={styles.formHint}>
                  Tus datos son privados: solo los ve el equipo que
                  coordina. La comunidad solo ve cuántas personas atienden.
                </Text>
                <Field
                  label="Tu nombre *"
                  value={draft.name}
                  invalid={invalid.has("name")}
                  onChangeText={(value) => setField("name", value)}
                />
                <Field
                  label="Teléfono · privado"
                  value={draft.phone}
                  onChangeText={(value) => setField("phone", value)}
                  keyboardType="phone-pad"
                />
                <Field
                  label="Correo · privado"
                  value={draft.email}
                  onChangeText={(value) => setField("email", value)}
                  keyboardType="email-address"
                />
                {pickPhoto && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Adjuntar una fotografía"
                    onPress={() => void pickVolunteerPhoto()}
                    style={styles.photoButton}
                  >
                    <Text style={styles.photoButtonText}>
                      {photos.length > 0
                        ? `FOTO: ${photos[0].name}`
                        : "+ ADJUNTAR FOTO (OPCIONAL)"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Enviar mis datos como voluntario"
                  disabled={busy}
                  onPress={() => void volunteerNow()}
                  style={[styles.primaryButton, busy && styles.disabled]}
                >
                  {busy ? (
                    <ActivityIndicator color="#07101b" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      OFRECERME COMO VOLUNTARIO
                    </Text>
                  )}
                </Pressable>
                {(onLogin || onRegister) && (
                  <Text style={styles.altText}>
                    ¿Tienes cuenta?{" "}
                    {onLogin && (
                      <Text
                        style={styles.link}
                        accessibilityRole="button"
                        onPress={onLogin}
                      >
                        Inicia sesión
                      </Text>
                    )}
                    {onLogin && onRegister ? " o " : ""}
                    {onRegister && (
                      <Text
                        style={styles.link}
                        accessibilityRole="button"
                        onPress={onRegister}
                      >
                        regístrate
                      </Text>
                    )}{" "}
                    para atender con un toque.
                  </Text>
                )}
              </View>
            )}

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  invalid = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  invalid?: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, invalid && styles.fieldLabelInvalid]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        placeholder="Escribe aquí"
        placeholderTextColor="#4b586d"
        style={[styles.fieldInput, invalid && styles.fieldInputInvalid]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(3,6,12,0.72)",
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.32)",
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  sheetBody: { padding: 20, gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  category: {
    flex: 1,
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  close: { padding: 4 },
  closeText: { color: colors.inkDim, fontSize: 18 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  description: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  meta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: colors.emergency,
  },
  primaryButtonText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  disabled: { opacity: 0.55 },
  form: { gap: 10 },
  formTitle: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  formHint: { color: colors.inkDim, fontSize: 11, lineHeight: 16 },
  field: { gap: 6 },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldLabelInvalid: { color: colors.reported },
  fieldInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: 12,
  },
  fieldInputInvalid: {
    borderColor: colors.reported,
    backgroundColor: "rgba(255,103,136,0.06)",
  },
  // CHG-164: acceso a la vista de información completa.
  viewMoreButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 6,
  },
  viewMoreText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  photoButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.cyan,
    borderRadius: 8,
    backgroundColor: "rgba(81,229,255,0.06)",
  },
  photoButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  confirmation: { gap: 12 },
  confirmationText: { color: colors.alive, fontSize: 13, lineHeight: 20 },
  altText: { color: colors.inkDim, fontSize: 11, lineHeight: 17 },
  link: { color: colors.cyan, fontWeight: "700" },
  error: { color: colors.reported, fontSize: 11, lineHeight: 16 },
});
