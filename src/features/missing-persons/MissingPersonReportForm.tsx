import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { ReportConsiderations } from "../reporting/ReportConsiderations";
import { buildLastSeenQuery, parseDraftCoordinates } from "./geocoding";
import { LastSeenLocationPicker } from "./LastSeenLocationPicker";
import { preparePhotosForUpload } from "./photoProcessing";
import {
  ALLOWED_PHOTO_HELP,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_COUNT,
  validateAndMergePhotos,
} from "./photoValidation";
import {
  createIdempotencyKey,
  submitMissingPersonReport,
  type SubmitReportOptions,
} from "./reportSubmission";
import type {
  MissingPersonReportDraft,
  MissingPersonReportReceipt,
  SelectedPhoto,
} from "./reportTypes";

const initialDraft: MissingPersonReportDraft = {
  firstNames: "",
  lastNames: "",
  aliases: "",
  birthDate: "",
  approximateAge: "",
  genderIdentity: "",
  nationality: "",
  documentType: "",
  documentNumber: "",
  heightCm: "",
  build: "",
  skinTone: "",
  hairDescription: "",
  eyeDescription: "",
  distinctiveMarks: "",
  medicalInformation: "",
  lastSeenDate: "",
  lastSeenTime: "",
  department: "",
  municipality: "",
  lastSeenArea: "",
  lastSeenLatitude: "",
  lastSeenLongitude: "",
  clothingDescription: "",
  circumstances: "",
  additionalDescription: "",
  reporterName: "",
  reporterRelationship: "",
  reporterPhone: "",
  reporterEmail: "",
  officialReportNumber: "",
  truthConfirmed: false,
  photoAuthorizationConfirmed: false,
  reviewAcknowledged: false,
};

interface MissingPersonReportFormProps {
  onBack: () => void;
  // CHG-053: accesos para reportar con cuenta desde la leyenda.
  onRegister?: () => void;
  onLogin?: () => void;
  pickPhotos?: () => Promise<SelectedPhoto[]>;
  submitReport?: (
    draft: MissingPersonReportDraft,
    photos: SelectedPhoto[],
    options?: SubmitReportOptions,
  ) => Promise<MissingPersonReportReceipt>;
}

const defaultPickPhotos = async (): Promise<SelectedPhoto[]> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_PHOTO_MIME_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? null,
    mimeType: asset.mimeType ?? null,
  }));
};

const defaultSubmitReport = submitMissingPersonReport;

export function MissingPersonReportForm({
  onBack,
  onRegister,
  onLogin,
  pickPhotos = defaultPickPhotos,
  submitReport = defaultSubmitReport,
}: MissingPersonReportFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [draft, setDraft] = useState<MissingPersonReportDraft>(initialDraft);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [selectingPhotos, setSelectingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<MissingPersonReportReceipt | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const setField = <Key extends keyof MissingPersonReportDraft>(
    key: Key,
    value: MissingPersonReportDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const selectPhotos = async () => {
    setSelectingPhotos(true);
    try {
      const picked = await pickPhotos();
      const result = validateAndMergePhotos(photos, picked);
      setPhotos(result.photos);
      setPhotoErrors(result.errors);
    } catch {
      setPhotoErrors(["No fue posible abrir el selector de fotografías."]);
    } finally {
      setSelectingPhotos(false);
    }
  };

  const submit = async () => {
    const errors = validateDraft(draft, photos);
    setFormErrors(errors);
    if (errors.length > 0) {
      return;
    }

    setSubmitting(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();
    try {
      // CHG-071: si el conjunto supera el presupuesto, las imágenes se
      // comprimen automáticamente antes de guardarse.
      const prepared = await preparePhotosForUpload(photos);
      setReceipt(
        await submitReport(draft, prepared.photos, {
          idempotencyKey: idempotencyKeyRef.current,
        }),
      );
      idempotencyKeyRef.current = null;
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible enviar el reporte. Intenta nuevamente.",
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return <ReportConfirmation receipt={receipt} onBack={onBack} />;
  }

  return (
    <LinearGradient colors={["#070a13", colors.canvas, "#080b15"]} style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver a la portada" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
          <View style={styles.headerStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.headerStatusText}>REPORTE PRIVADO · NO PUBLICADO</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.intro}>
              <Text style={styles.overline}>MISSING PERSON / NEW REPORT</Text>
              <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
                Reportar persona perdida
              </Text>
              <Text style={styles.introText}>
                Completa la información que ayude a identificarla. El reporte será revisado antes de cualquier publicación y no reemplaza una denuncia ante las autoridades.
              </Text>
            </View>

            <ReportConsiderations
              considerations={[
                "El equipo revisa cada reporte antes de cualquier publicación: nada se publica automáticamente al enviarlo.",
                "Documento, información médica y datos de contacto del reportante son privados y se guardan cifrados; las fotografías no se publican sin revisión y autorización.",
                "La información debe ser veraz y de buena fe. Este reporte no reemplaza la denuncia ante la Fiscalía o la Policía Nacional.",
                "Describe con el mayor detalle posible la última vez que fue vista; evita direcciones residenciales exactas en los campos públicos.",
              ]}
              onRegister={onRegister}
              onLogin={onLogin}
            />

            <PrivacyNotice />

            <FormSection code="01" title="Datos de la persona" description="Identificación básica. Los campos marcados con * son obligatorios.">
              <FieldGrid compact={compact}>
                <FormField label="Nombres *" value={draft.firstNames} onChangeText={(value) => setField("firstNames", value)} autoComplete="name-given" />
                <FormField label="Apellidos *" value={draft.lastNames} onChangeText={(value) => setField("lastNames", value)} autoComplete="name-family" />
                <FormField label="Alias o nombre conocido" value={draft.aliases} onChangeText={(value) => setField("aliases", value)} />
                <FormField label="Fecha de nacimiento" hint="AAAA-MM-DD" value={draft.birthDate} onChangeText={(value) => setField("birthDate", value)} />
                <FormField label="Edad aproximada" value={draft.approximateAge} onChangeText={(value) => setField("approximateAge", value)} keyboardType="number-pad" />
                <FormField label="Identidad de género" value={draft.genderIdentity} onChangeText={(value) => setField("genderIdentity", value)} />
                <FormField label="Nacionalidad" value={draft.nationality} onChangeText={(value) => setField("nationality", value)} />
              </FieldGrid>
              <PrivateFieldsLabel />
              <FieldGrid compact={compact}>
                <FormField label="Tipo de documento · privado" value={draft.documentType} onChangeText={(value) => setField("documentType", value)} />
                <FormField label="Número de documento · privado" value={draft.documentNumber} onChangeText={(value) => setField("documentNumber", value)} />
              </FieldGrid>
            </FormSection>

            <FormSection code="02" title="Última vez que fue vista" description="Indica una zona reconocible, no una ubicación privada exacta.">
              <FieldGrid compact={compact}>
                <FormField label="Fecha *" hint="AAAA-MM-DD" value={draft.lastSeenDate} onChangeText={(value) => setField("lastSeenDate", value)} />
                <FormField label="Hora aproximada" hint="HH:MM" value={draft.lastSeenTime} onChangeText={(value) => setField("lastSeenTime", value)} />
                <FormField label="Departamento *" value={draft.department} onChangeText={(value) => setField("department", value)} />
                <FormField label="Municipio *" value={draft.municipality} onChangeText={(value) => setField("municipality", value)} />
              </FieldGrid>
              <FormField label="Zona o lugar de referencia *" value={draft.lastSeenArea} onChangeText={(value) => setField("lastSeenArea", value)} />
              <LastSeenLocationPicker
                addressQuery={buildLastSeenQuery(draft)}
                value={parseDraftCoordinates(draft.lastSeenLatitude, draft.lastSeenLongitude)}
                onChange={(coordinates) =>
                  setDraft((current) => ({
                    ...current,
                    lastSeenLatitude: coordinates ? coordinates.latitude.toFixed(5) : "",
                    lastSeenLongitude: coordinates ? coordinates.longitude.toFixed(5) : "",
                  }))
                }
              />
              <FormField label="Vestimenta *" multiline value={draft.clothingDescription} onChangeText={(value) => setField("clothingDescription", value)} />
              <FormField label="Circunstancias de la desaparición *" multiline value={draft.circumstances} onChangeText={(value) => setField("circumstances", value)} />
            </FormSection>

            <FormSection code="03" title="Características físicas" description="Agrega detalles visuales que permitan reconocer a la persona.">
              <FieldGrid compact={compact}>
                <FormField label="Estatura aproximada (cm)" value={draft.heightCm} onChangeText={(value) => setField("heightCm", value)} keyboardType="number-pad" />
                <FormField label="Contextura" value={draft.build} onChangeText={(value) => setField("build", value)} />
                <FormField label="Tono de piel" value={draft.skinTone} onChangeText={(value) => setField("skinTone", value)} />
                <FormField label="Cabello" value={draft.hairDescription} onChangeText={(value) => setField("hairDescription", value)} />
                <FormField label="Ojos" value={draft.eyeDescription} onChangeText={(value) => setField("eyeDescription", value)} />
              </FieldGrid>
              <FormField label="Señales particulares" multiline value={draft.distinctiveMarks} onChangeText={(value) => setField("distinctiveMarks", value)} />
              <FormField label="Descripción adicional" multiline value={draft.additionalDescription} onChangeText={(value) => setField("additionalDescription", value)} />
              <PrivateFieldsLabel />
              <FormField label="Información médica relevante · privada" multiline value={draft.medicalInformation} onChangeText={(value) => setField("medicalInformation", value)} />
            </FormSection>

            <FormSection code="04" title="Datos del reportante" description="Esta información es privada y se usa únicamente para verificar el reporte.">
              <FieldGrid compact={compact}>
                <FormField label="Nombre completo *" value={draft.reporterName} onChangeText={(value) => setField("reporterName", value)} autoComplete="name" />
                <FormField label="Relación con la persona *" value={draft.reporterRelationship} onChangeText={(value) => setField("reporterRelationship", value)} />
                <FormField label="Teléfono privado" value={draft.reporterPhone} onChangeText={(value) => setField("reporterPhone", value)} keyboardType="phone-pad" autoComplete="tel" />
                <FormField label="Correo privado" value={draft.reporterEmail} onChangeText={(value) => setField("reporterEmail", value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <FormField label="Número de denuncia o radicado" value={draft.officialReportNumber} onChangeText={(value) => setField("officialReportNumber", value)} />
              </FieldGrid>
              <Text style={styles.fieldHint}>Debes ingresar al menos teléfono o correo.</Text>
            </FormSection>

            <FormSection code="05" title="Fotografías" description="Adjunta imágenes recientes y claras de la persona.">
              <View style={styles.photoRules}>
                <PhotoIcon />
                <View style={styles.photoRulesCopy}>
                  <Text style={styles.photoRulesTitle}>FORMATOS PERMITIDOS</Text>
                  <Text style={styles.photoRulesText}>{ALLOWED_PHOTO_HELP}</Text>
                  <Text style={styles.photoRulesText}>Máximo 3 fotos · La suma no puede exceder 50 MB: si tus imágenes pesan más, se comprimen automáticamente antes de guardarse.</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Seleccionar una o varias fotografías"
                disabled={selectingPhotos || photos.length >= MAX_PHOTO_COUNT}
                onPress={() => void selectPhotos()}
                style={({ pressed }) => [styles.photoButton, pressed && styles.pressedButton, photos.length >= MAX_PHOTO_COUNT && styles.disabledButton]}
              >
                {selectingPhotos ? <ActivityIndicator color={colors.cyan} /> : <Text style={styles.photoButtonText}>+ SELECCIONAR FOTOGRAFÍAS</Text>}
              </Pressable>
              {photoErrors.map((error) => <Text key={error} style={styles.errorText} accessibilityRole="alert">{error}</Text>)}
              <View style={styles.photoList}>
                {photos.map((photo, index) => (
                  <View key={`${photo.uri}-${index}`} style={styles.photoItem} testID={`selected-photo-${index}`}>
                    <View style={styles.photoIndex}><Text style={styles.photoIndexText}>{index + 1}</Text></View>
                    <View style={styles.photoItemCopy}>
                      <Text style={styles.photoName} numberOfLines={1}>{photo.name}</Text>
                      <Text style={styles.photoMeta}>{photo.mimeType} · {formatBytes(photo.size)}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Quitar fotografía ${photo.name}`} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={styles.removePhoto}>
                      <Text style={styles.removePhotoText}>QUITAR</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </FormSection>

            <FormSection code="06" title="Confirmaciones" description="Lee y confirma antes de preparar el reporte.">
              <ConsentCheckbox checked={draft.truthConfirmed} label="Confirmo que la información es veraz según mi conocimiento." onPress={() => setField("truthConfirmed", !draft.truthConfirmed)} />
              <ConsentCheckbox checked={draft.photoAuthorizationConfirmed} label="Confirmo que tengo autorización para compartir estas fotografías." onPress={() => setField("photoAuthorizationConfirmed", !draft.photoAuthorizationConfirmed)} />
              <ConsentCheckbox checked={draft.reviewAcknowledged} label="Entiendo que el reporte será revisado y no se publicará automáticamente." onPress={() => setField("reviewAcknowledged", !draft.reviewAcknowledged)} />
            </FormSection>

            {formErrors.length > 0 && (
              <View style={styles.errorSummary} accessibilityRole="alert">
                <Text style={styles.errorSummaryTitle}>Revisa el reporte antes de continuar</Text>
                {formErrors.map((error) => <Text key={error} style={styles.errorSummaryItem}>• {error}</Text>)}
              </View>
            )}

            <View style={[styles.submitPanel, compact && styles.submitPanelCompact]}>
              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>ENVÍO PARA REVISIÓN</Text>
                <Text style={styles.submitText}>El reporte y sus fotografías se envían de forma privada al equipo de revisión. Nada se publica automáticamente: recibirás una constancia con el código del caso.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Enviar reporte para revisión" disabled={submitting} onPress={() => void submit()} style={({ pressed }) => [styles.submitButton, pressed && styles.pressedButton]}>
                {submitting ? <ActivityIndicator color="#07101b" /> : <Text style={styles.submitButtonText}>ENVIAR REPORTE PARA REVISIÓN →</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function validateDraft(draft: MissingPersonReportDraft, photos: SelectedPhoto[]): string[] {
  const errors: string[] = [];
  const requiredFields: Array<[keyof MissingPersonReportDraft, string]> = [
    ["firstNames", "Ingresa los nombres de la persona."],
    ["lastNames", "Ingresa los apellidos de la persona."],
    ["lastSeenDate", "Ingresa la fecha de la última visualización."],
    ["department", "Ingresa el departamento."],
    ["municipality", "Ingresa el municipio."],
    ["lastSeenArea", "Ingresa una zona de referencia."],
    ["clothingDescription", "Describe la vestimenta."],
    ["circumstances", "Describe las circunstancias."],
    ["reporterName", "Ingresa el nombre del reportante."],
    ["reporterRelationship", "Indica la relación con la persona."],
  ];

  requiredFields.forEach(([field, message]) => {
    if (typeof draft[field] === "string" && draft[field].trim().length === 0) {
      errors.push(message);
    }
  });

  if (!draft.reporterPhone.trim() && !draft.reporterEmail.trim()) {
    errors.push("Ingresa al menos un teléfono o correo de contacto privado.");
  }
  if (draft.reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.reporterEmail)) {
    errors.push("El correo del reportante no tiene un formato válido.");
  }
  if (draft.lastSeenDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.lastSeenDate)) {
    errors.push("La fecha de última visualización debe usar AAAA-MM-DD.");
  } else if (draft.lastSeenDate && new Date(`${draft.lastSeenDate}T23:59:59`).getTime() > Date.now()) {
    errors.push("La fecha de última visualización no puede estar en el futuro.");
  }
  if (draft.lastSeenTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.lastSeenTime)) {
    errors.push("La hora debe usar el formato HH:MM de 24 horas.");
  }
  if (photos.length === 0) {
    errors.push("Adjunta al menos una fotografía permitida.");
  }
  if (!draft.truthConfirmed || !draft.photoAuthorizationConfirmed || !draft.reviewAcknowledged) {
    errors.push("Debes aceptar las tres confirmaciones.");
  }
  return errors;
}

function FormSection({ code, title, description, children }: { code: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionCode}>{code}</Text>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function FieldGrid({ compact, children }: { compact: boolean; children: React.ReactNode }) {
  return <View style={[styles.fieldGrid, compact && styles.fieldGridCompact]}>{children}</View>;
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
  autoComplete?: "name" | "name-given" | "name-family" | "email" | "tel";
};

function FormField({ label, hint, multiline = false, ...inputProps }: FormFieldProps) {
  return (
    <View style={[styles.field, multiline && styles.fieldWide]}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholder="Escribe aquí"
        placeholderTextColor="#4b586d"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        {...inputProps}
      />
    </View>
  );
}

function PrivateFieldsLabel() {
  return (
    <View style={styles.privateLabel}>
      <Text style={styles.privateLabelText}>🔒 DATOS PRIVADOS · NO APARECEN EN LA BÚSQUEDA PÚBLICA</Text>
    </View>
  );
}

function PrivacyNotice() {
  return (
    <View style={styles.privacyNotice} accessibilityRole="alert">
      <Text style={styles.privacyIcon}>◇</Text>
      <View style={styles.privacyCopy}>
        <Text style={styles.privacyTitle}>PRIVACIDAD Y VERIFICACIÓN</Text>
        <Text style={styles.privacyText}>Documento, salud y contactos son privados. Las fotos no serán públicas hasta contar con revisión y autorización. No incluyas ubicaciones residenciales exactas.</Text>
      </View>
    </View>
  );
}

function ConsentCheckbox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.consent, checked && styles.consentChecked, pressed && styles.pressedButton]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkmark}>{checked ? "✓" : ""}</Text></View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function ReportConfirmation({ receipt, onBack }: { receipt: MissingPersonReportReceipt; onBack: () => void }) {
  return (
    <LinearGradient colors={["#071119", colors.canvas]} style={[styles.root, styles.confirmationRoot]}>
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationIcon}><Text style={styles.confirmationMark}>✓</Text></View>
        <Text style={styles.overline}>RECEIPT / LOCAL DEMO</Text>
        <Text style={styles.confirmationTitle} accessibilityRole="header">Reporte preparado</Text>
        <Text style={styles.confirmationText}>La validación local terminó correctamente. Ningún dato ni fotografía fue enviado porque el backend seguro continúa pendiente.</Text>
        <View style={styles.receiptCode}>
          <Text style={styles.receiptLabel}>CÓDIGO DE SEGUIMIENTO DEMO</Text>
          <Text style={styles.receiptValue}>{receipt.publicCaseCode}</Text>
          <Text style={styles.reviewStatus}>EN REVISIÓN</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a la portada" onPress={onBack} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>VOLVER A LA PORTADA</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function PhotoIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Path d="M4 8h7l2-3h6l2 3h7v19H4V8Z" fill="none" stroke={colors.cyan} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx="16" cy="17" r="5" fill="none" stroke={colors.cyan} strokeWidth={1.5} />
    </Svg>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Tamaño sin verificar";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  safeArea: { flex: 1 },
  header: { width: "100%", maxWidth: contentMaxWidth, minHeight: 76, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingRight: 12 },
  backArrow: { color: colors.cyan, fontSize: 24 },
  backText: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.missing },
  headerStatusText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 8, letterSpacing: 0.7 },
  scroll: { flexGrow: 1 },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", gap: 16, paddingHorizontal: 24, paddingTop: 62, paddingBottom: 80 },
  contentCompact: { paddingHorizontal: 10, paddingTop: 38 },
  intro: { marginBottom: 10 },
  overline: { marginBottom: 8, color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  title: { maxWidth: 900, color: colors.ink, fontSize: 62, fontWeight: "800", letterSpacing: -3.3, lineHeight: 66 },
  titleCompact: { fontSize: 39, letterSpacing: -2, lineHeight: 43 },
  introText: { maxWidth: 820, marginTop: 17, color: colors.inkSoft, fontSize: 14, lineHeight: 23 },
  privacyNotice: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderWidth: 1, borderColor: "rgba(67,231,173,0.28)", borderRadius: 12, backgroundColor: "rgba(67,231,173,0.07)" },
  privacyIcon: { color: colors.alive, fontSize: 30 },
  privacyCopy: { minWidth: 0, flex: 1 },
  privacyTitle: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  privacyText: { marginTop: 5, color: "#9ab9af", fontSize: 11, lineHeight: 18 },
  section: { overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.panel },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "rgba(15,23,38,0.86)" },
  sectionCode: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 28, fontWeight: "300", lineHeight: 32 },
  sectionHeadingCopy: { minWidth: 0, flex: 1 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: "700", letterSpacing: -0.6 },
  sectionDescription: { marginTop: 4, color: colors.inkDim, fontSize: 10, lineHeight: 16 },
  sectionBody: { gap: 14, padding: 20 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldGridCompact: { flexDirection: "column" },
  field: { minWidth: 250, flex: 1, gap: 7 },
  fieldWide: { minWidth: "100%" },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldHint: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8 },
  fieldInput: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, color: colors.ink, backgroundColor: "rgba(5,9,17,0.72)", fontSize: 12 },
  fieldInputMultiline: { minHeight: 98 },
  privateLabel: { paddingHorizontal: 10, paddingVertical: 7, borderLeftWidth: 2, borderLeftColor: colors.deceased, backgroundColor: "rgba(135,150,255,0.06)" },
  privateLabelText: { color: colors.deceased, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  photoRules: { flexDirection: "row", alignItems: "center", gap: 14, padding: 15, borderWidth: 1, borderColor: "rgba(81,229,255,0.20)", borderRadius: 9, backgroundColor: "rgba(81,229,255,0.05)" },
  photoRulesCopy: { minWidth: 0, flex: 1 },
  photoRulesTitle: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  photoRulesText: { marginTop: 4, color: colors.inkSoft, fontSize: 10, lineHeight: 16 },
  photoButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.cyan, borderRadius: 9, backgroundColor: "rgba(81,229,255,0.06)" },
  photoButtonText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  pressedButton: { opacity: 0.72 },
  disabledButton: { opacity: 0.45 },
  errorText: { color: colors.reported, fontSize: 10, lineHeight: 16 },
  photoList: { gap: 7 },
  photoItem: { flexDirection: "row", alignItems: "center", gap: 11, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.panelSoft },
  photoIndex: { width: 27, height: 27, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(81,229,255,0.10)" },
  photoIndexText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800" },
  photoItemCopy: { minWidth: 0, flex: 1 },
  photoName: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  photoMeta: { marginTop: 2, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7 },
  removePhoto: { paddingHorizontal: 8, paddingVertical: 7 },
  removePhotoText: { color: colors.reported, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  consentChecked: { borderColor: "rgba(67,231,173,0.32)", backgroundColor: "rgba(67,231,173,0.05)" },
  checkbox: { width: 22, height: 22, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.inkDim, borderRadius: 5 },
  checkboxChecked: { borderColor: colors.alive, backgroundColor: colors.alive },
  checkmark: { color: "#07101b", fontSize: 13, fontWeight: "900" },
  consentText: { minWidth: 0, flex: 1, color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  errorSummary: { gap: 5, padding: 17, borderWidth: 1, borderColor: "rgba(255,103,136,0.36)", borderRadius: 10, backgroundColor: "rgba(255,103,136,0.08)" },
  errorSummaryTitle: { marginBottom: 3, color: colors.reported, fontSize: 13, fontWeight: "800" },
  errorSummaryItem: { color: "#e6a3b2", fontSize: 10, lineHeight: 16 },
  submitPanel: { flexDirection: Platform.OS === "web" ? "row" : "column", alignItems: Platform.OS === "web" ? "center" : "stretch", gap: 18, padding: 22, borderWidth: 1, borderColor: "rgba(255,207,102,0.25)", borderRadius: 14, backgroundColor: "rgba(255,207,102,0.06)" },
  submitPanelCompact: { flexDirection: "column", alignItems: "stretch" },
  submitCopy: { minWidth: 0, flex: 1 },
  submitTitle: { color: colors.missing, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  submitText: { maxWidth: 670, marginTop: 5, color: "#aa9b7b", fontSize: 10, lineHeight: 17 },
  submitButton: { minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, borderRadius: 8, backgroundColor: colors.cyan },
  submitButtonText: { color: "#07101b", fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textAlign: "center" },
  confirmationRoot: { alignItems: "center", justifyContent: "center", padding: 20 },
  confirmationCard: { width: "100%", maxWidth: 600, alignItems: "center", gap: 12, padding: 36, borderWidth: 1, borderColor: "rgba(67,231,173,0.28)", borderRadius: 16, backgroundColor: colors.panel },
  confirmationIcon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", marginBottom: 5, borderRadius: 31, backgroundColor: colors.alive },
  confirmationMark: { color: "#07101b", fontSize: 28, fontWeight: "900" },
  confirmationTitle: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.5, textAlign: "center" },
  confirmationText: { color: colors.inkSoft, fontSize: 12, lineHeight: 20, textAlign: "center" },
  receiptCode: { width: "100%", alignItems: "center", gap: 7, marginVertical: 8, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  receiptLabel: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8, letterSpacing: 0.8 },
  receiptValue: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 25, fontWeight: "800" },
  reviewStatus: { color: colors.missing, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
});
