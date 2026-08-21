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
import { fieldGridLayout } from "../../components/fieldGrid";
import { InnerRouteHeader } from "../../components/InnerRouteHeader";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import {
  useSessionAccount,
  type SessionAccountSource,
} from "../auth/useSessionAccount";
import { parseDraftCoordinates } from "../missing-persons/geocoding";
import {
  preparePhotosForUpload,
  totalSizeNotice,
} from "../missing-persons/photoProcessing";
import {
  ALLOWED_PHOTO_HELP,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_COUNT,
  validateAndMergePhotos,
} from "../missing-persons/photoValidation";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import { LastSeenLocationPicker } from "../missing-persons/LastSeenLocationPicker";
import {
  MapScrollLockProvider,
  useMapScrollLockController,
} from "../operational-map/mapScrollLock";
import {
  ReportRejectedError,
  createIdempotencyKey,
  type SubmitReportOptions,
} from "../missing-persons/reportSubmission";
import { ReportConsiderations } from "../reporting/ReportConsiderations";
import { SessionGate } from "../auth/SessionGate";
import { submitDamagedHomeReport } from "./reportSubmission";
import {
  DAMAGED_HOME_DONATION_CHANNELS,
  DONATION_DISCLAIMER,
  donationReferenceHint,
  MAX_DONATION_REFERENCE_LENGTH,
  MAX_HOUSEHOLD_SIZE,
  MIN_DONATION_REFERENCE_LENGTH,
  MIN_HOUSEHOLD_SIZE,
  MAX_DAMAGE_DESCRIPTION_LENGTH,
  MAX_HOME_ADDRESS_LENGTH,
  MAX_HOME_CITY_LENGTH,
  MIN_DAMAGE_DESCRIPTION_LENGTH,
  MIN_HOME_ADDRESS_LENGTH,
  type DamagedHomeDonationChannel,
  type DamagedHomeDraft,
  type DamagedHomeReceipt,
} from "./types";

// CHG-182 — Formulario de «Mi casita destruida» (antes «Mi casita
// partida», CHG-162). Ahora publica SOLO quien tiene cuenta: aquí se
// declara un medio para recibir dinero y hay a quién avisarle de los
// comentarios. Conserva las reglas de ubicación de CHG-160 —dirección
// que se completa sola al fijar el muñequito, «CRUZAR DIRECCIÓN», GPS y
// paneo táctil— y sale en el mapa con la categoría `damaged_home` (🏚).
//
// F2: acepta hasta tres fotografías del daño (opcionales), con el mismo
// pipeline de evidencia que los demás reportes — se comprimen si hace
// falta y viajan en multipart hacia claves opacas del servidor.

export const initialDamagedHomeDraft: DamagedHomeDraft = {
  description: "",
  municipality: "",
  department: "",
  address: "",
  latitude: "",
  longitude: "",
  householdSize: "",
  donationChannel: null,
  donationReference: "",
  truthConfirmed: false,
};

// CHG-182 — Por qué esta publicación exige cuenta, dicho donde se
// pregunta.
export const DAMAGED_HOME_SESSION_EXPLANATION =
  "Publicar tu casita exige iniciar sesión: aquí puedes dejar un medio para recibir ayuda directa, y quien lo publica debe poder responder por él y recibir los comentarios de quienes quieran ayudar.";

export type DamagedHomeIssueField = keyof DamagedHomeDraft | "location";

export interface DamagedHomeIssue {
  field: DamagedHomeIssueField;
  message: string;
}

// Espejo del contrato (`DamagedHomeReportInput`): las mismas reglas
// que aplicará el backend, avisadas antes del viaje.
export function collectDamagedHomeIssues(
  draft: DamagedHomeDraft,
): DamagedHomeIssue[] {
  const issues: DamagedHomeIssue[] = [];
  const push = (field: DamagedHomeIssueField, message: string) =>
    issues.push({ field, message });

  const description = draft.description.trim();
  if (description.length < MIN_DAMAGE_DESCRIPTION_LENGTH) {
    push(
      "description",
      `Cuenta qué le pasó al hogar (mínimo ${MIN_DAMAGE_DESCRIPTION_LENGTH} caracteres).`,
    );
  } else if (description.length > MAX_DAMAGE_DESCRIPTION_LENGTH) {
    push(
      "description",
      `La descripción no puede superar los ${MAX_DAMAGE_DESCRIPTION_LENGTH} caracteres.`,
    );
  }

  if (!draft.municipality.trim()) {
    push("municipality", "Indica el municipio donde está el hogar.");
  }
  if (!draft.department.trim()) {
    push("department", "Indica el departamento donde está el hogar.");
  }

  const address = draft.address.trim();
  if (address.length < MIN_HOME_ADDRESS_LENGTH) {
    push("address", "Escribe la dirección del hogar o resuélvela desde el mapa.");
  } else if (address.length > MAX_HOME_ADDRESS_LENGTH) {
    push(
      "address",
      `La dirección no puede superar los ${MAX_HOME_ADDRESS_LENGTH} caracteres.`,
    );
  }

  const coordinates = parseDraftCoordinates(draft.latitude, draft.longitude);
  if (
    coordinates &&
    (coordinates.latitude < -90 ||
      coordinates.latitude > 90 ||
      coordinates.longitude < -180 ||
      coordinates.longitude > 180)
  ) {
    push("location", "Las coordenadas del hogar están fuera de rango.");
  }

  // CHG-182: cuántas personas viven en la casa.
  const household = Number.parseInt(draft.householdSize.trim(), 10);
  if (!Number.isFinite(household)) {
    push("householdSize", "Indica cuántas personas viven en la casa.");
  } else if (
    household < MIN_HOUSEHOLD_SIZE ||
    household > MAX_HOUSEHOLD_SIZE
  ) {
    push(
      "householdSize",
      `Las personas que viven en la casa deben estar entre ${MIN_HOUSEHOLD_SIZE} y ${MAX_HOUSEHOLD_SIZE}.`,
    );
  }

  // CHG-182: el medio de ayuda va completo o no va.
  const reference = draft.donationReference.trim();
  if (draft.donationChannel && !reference) {
    push(
      "donationReference",
      "Escribe a dónde transferir, o quita el medio de ayuda.",
    );
  } else if (!draft.donationChannel && reference) {
    push(
      "donationChannel",
      "Elige el medio (Nequi, Daviplata…) al que corresponde ese dato.",
    );
  } else if (
    reference &&
    (reference.length < MIN_DONATION_REFERENCE_LENGTH ||
      reference.length > MAX_DONATION_REFERENCE_LENGTH)
  ) {
    push(
      "donationReference",
      `El dato para transferir debe tener entre ${MIN_DONATION_REFERENCE_LENGTH} y ${MAX_DONATION_REFERENCE_LENGTH} caracteres.`,
    );
  }

  if (!draft.truthConfirmed) {
    push("truthConfirmed", "Debes confirmar que la información es real.");
  }

  return issues;
}

// Sección (01..03) de cada campo, para el scroll al primer error.
const FIELD_SECTIONS: Record<string, string> = {
  description: "01",
  householdSize: "01",
  donationChannel: "04",
  donationReference: "04",
  municipality: "02",
  department: "02",
  address: "02",
  location: "02",
  latitude: "02",
  longitude: "02",
  truthConfirmed: "05",
};

interface DamagedHomeFormProps {
  onBack: () => void;
  onHome?: () => void;
  onRegister?: () => void;
  onLogin?: () => void;
  sessionSource?: SessionAccountSource;
  // Selector de fotografías, inyectable en pruebas.
  pickPhotos?: () => Promise<SelectedPhoto[]>;
  // CHG-080: obtención de la posición GPS, inyectable en pruebas.
  locateVisitor?: () => Promise<{ latitude: number; longitude: number }>;
  submitReport?: (
    draft: DamagedHomeDraft,
    photos: SelectedPhoto[],
    options?: SubmitReportOptions,
  ) => Promise<DamagedHomeReceipt>;
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

const createdFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export function DamagedHomeForm({
  onBack,
  onHome,
  onRegister,
  onLogin,
  sessionSource,
  pickPhotos = defaultPickPhotos,
  locateVisitor,
  submitReport = submitDamagedHomeReport,
}: DamagedHomeFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const session = useSessionAccount(sessionSource);
  const [draft, setDraft] = useState<DamagedHomeDraft>(
    initialDamagedHomeDraft,
  );
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [selectingPhotos, setSelectingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<DamagedHomeReceipt | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const idempotencyKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  // CHG-155: el gesto que nace en el mapa no desplaza el formulario.
  const { scrollEnabled, scrollLock } = useMapScrollLockController();

  const registerSection = (code: string, y: number) => {
    sectionOffsets.current[code] = y;
  };

  const setField = <Key extends keyof DamagedHomeDraft>(
    key: Key,
    value: DamagedHomeDraft[Key],
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

  const scrollToField = (field: string) => {
    const section = FIELD_SECTIONS[field];
    const offset = section ? sectionOffsets.current[section] : undefined;
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, offset - 16),
        animated: true,
      });
    }
  };

  const submit = async () => {
    const issues = collectDamagedHomeIssues(draft);
    setFormErrors(issues.map((issue) => issue.message));
    setInvalidFields(new Set(issues.map((issue) => issue.field)));
    if (issues.length > 0) {
      scrollToField(issues[0].field);
      return;
    }

    setSubmitting(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();
    try {
      // CHG-071: comprime lo que exceda el presupuesto antes de subir.
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
          : "No fue posible enviar el informe. Intenta nuevamente.",
      ]);
      if (error instanceof ReportRejectedError && error.fields.length > 0) {
        setInvalidFields(new Set(error.fields));
        const ubicable = error.fields.find(
          (field) => FIELD_SECTIONS[field] !== undefined,
        );
        if (ubicable) {
          scrollToField(ubicable);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <DamagedHomeConfirmation receipt={receipt} onHome={onHome ?? onBack} />
    );
  }

  return (
    <MapScrollLockProvider value={scrollLock}>
    <LinearGradient
      colors={["#070c14", colors.canvas, "#080b12"]}
      style={styles.root}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        {/* CHG-097: el mismo navbar de la portada. */}
        <InnerRouteHeader
          onNavigateHome={onHome ?? onBack}
          onLogin={onLogin ?? (() => undefined)}
          onRegister={onRegister ?? (() => undefined)}
          sessionSource={sessionSource}
          session={session}
        />
        <View style={styles.header} testID="damaged-home-action-bar">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la portada"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
          <View style={styles.headerStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.headerStatusText}>
              PUBLICACIÓN INMEDIATA · VISIBLE EN EL MAPA
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.intro}>
              <Text style={styles.overline}>HOGAR / MI CASITA DESTRUIDA</Text>
              <Text
                style={[styles.title, compact && styles.titleCompact]}
                accessibilityRole="header"
              >
                Publicar mi casita destruida
              </Text>
              <Text style={styles.introText}>
                Cuenta cómo quedó tu casa después del desastre: qué
                sucedió, cuántas personas viven en ella y, si quieres, a
                dónde pueden transferirte para ayudarte. La publicación
                aparece de inmediato en el mapa, para que la ayuda sepa a
                dónde llegar.
              </Text>
            </View>

            {/* CHG-182: sin cuenta no se muestra el formulario ni se
                envía nada; se explica por qué y se ofrece entrar.
                CHG-187: la leyenda del reporte va DENTRO del portón —como
                en AidLocationForm—; fuera de él repetía «REGISTRARME / YA
                TENGO CUENTA» y ofrecía enviar de forma anónima, que aquí
                no existe. */}
            <SessionGate
              session={session}
              explanation={DAMAGED_HOME_SESSION_EXPLANATION}
              onRegister={onRegister}
              onLogin={onLogin}
            >
            <ReportConsiderations
              purpose="La publicación de tu casa destruida; sale en el mapa para que la ayuda sepa a dónde llegar."
              considerations={[
                "Cuenta qué sucedió con tus palabras: qué se cayó, qué se inundó, qué quedó inservible.",
                "La dirección y el punto del mapa son públicos: así la ayuda puede llegar a tu casa.",
                "Si dejas un medio para transferir, será público. La plataforma no lo verifica ni intermedia los envíos.",
                "La publicación aparece de inmediato; el equipo puede retirarla si no corresponde.",
              ]}
              onRegister={onRegister}
              onLogin={onLogin}
              session={session}
            />

            <FormSection
              code="01"
              title="Qué le pasó a tu casa"
              description="Cuenta el estado en el que quedó: qué sucedió, qué daños hay y quiénes viven allí."
              onPosition={registerSection}
            >
              <FormField
                label="Qué sucedió y cómo quedó la casa *"
                hint={`Entre ${MIN_DAMAGE_DESCRIPTION_LENGTH} y ${MAX_DAMAGE_DESCRIPTION_LENGTH} caracteres`}
                multiline
                invalid={invalidFields.has("description")}
                value={draft.description}
                maxLength={MAX_DAMAGE_DESCRIPTION_LENGTH}
                onChangeText={(value) => setField("description", value)}
              />
              {/* CHG-182: la cifra que dimensiona la ayuda. */}
              <FormField
                label="Personas que viven en la casa *"
                hint={`Entre ${MIN_HOUSEHOLD_SIZE} y ${MAX_HOUSEHOLD_SIZE}; cuenta a todos los que dormían allí`}
                keyboardType="number-pad"
                invalid={invalidFields.has("householdSize")}
                value={draft.householdSize}
                maxLength={2}
                onChangeText={(value) =>
                  setField("householdSize", value.replace(/[^0-9]/g, ""))
                }
              />
            </FormSection>

            <FormSection
              code="02"
              title="Dónde está el hogar"
              description="Municipio, departamento y dirección; si puedes, fija también el punto en el mapa."
              onPosition={registerSection}
            >
              <FieldGrid>
                <FormField
                  label="Municipio *"
                  hint="Ciudad donde está el hogar"
                  invalid={invalidFields.has("municipality")}
                  value={draft.municipality}
                  maxLength={MAX_HOME_CITY_LENGTH}
                  onChangeText={(value) => setField("municipality", value)}
                />
                <FormField
                  label="Departamento *"
                  invalid={invalidFields.has("department")}
                  value={draft.department}
                  maxLength={MAX_HOME_CITY_LENGTH}
                  onChangeText={(value) => setField("department", value)}
                />
              </FieldGrid>
              <FormField
                label="Dirección *"
                hint="Se completa sola al fijar el punto; siempre editable"
                invalid={invalidFields.has("address")}
                value={draft.address}
                maxLength={MAX_HOME_ADDRESS_LENGTH}
                onChangeText={(value) => setField("address", value)}
              />
              <LastSeenLocationPicker
                addressQuery={
                  draft.address.trim()
                    ? `${draft.address.trim()}, ${
                        draft.municipality.trim() || "Colombia"
                      }`
                    : ""
                }
                value={parseDraftCoordinates(draft.latitude, draft.longitude)}
                onChange={(coordinates) =>
                  setDraft((current) => ({
                    ...current,
                    latitude: coordinates
                      ? coordinates.latitude.toFixed(5)
                      : "",
                    longitude: coordinates
                      ? coordinates.longitude.toFixed(5)
                      : "",
                  }))
                }
                // CHG-156: la Dirección queda corta (vía, barrio,
                // comuna); municipio y departamento van a sus campos
                // solo si estaban vacíos (siempre editables).
                onAddressResolved={(address) =>
                  setDraft((current) => ({
                    ...current,
                    address: address.addressLine ?? address.label,
                    municipality:
                      current.municipality.trim() ||
                      (address.municipality ?? ""),
                    department:
                      current.department.trim() ||
                      (address.department ?? ""),
                  }))
                }
                locateVisitor={locateVisitor}
                title="UBICACIÓN EN EL MAPA · OPCIONAL"
                helper="Si puedes, cruza la dirección escrita arriba con el mapa, toca «¿Dónde estoy?» para usar tu GPS, o arrastra el muñequito hasta el lugar exacto. Con la dirección escrita basta."
                locateActionLabel="¿Dónde estoy?"
              />
              {invalidFields.has("location") && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  Las coordenadas del hogar están fuera de rango.
                </Text>
              )}
            </FormSection>

            <FormSection
              code="03"
              title="Fotografías del daño"
              description="Opcionales. Ayudan a entender en qué estado quedó la vivienda."
              onPosition={registerSection}
            >
              <View style={styles.photoRules}>
                <Text style={styles.photoRulesTitle}>FORMATOS PERMITIDOS</Text>
                <Text style={styles.photoRulesText}>{ALLOWED_PHOTO_HELP}</Text>
                <Text style={styles.photoRulesText}>
                  Máximo {MAX_PHOTO_COUNT} fotografías; si pesan demasiado se
                  comprimen automáticamente antes de enviarse.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Seleccionar fotografías del daño"
                disabled={selectingPhotos || photos.length >= MAX_PHOTO_COUNT}
                onPress={() => void selectPhotos()}
                style={({ pressed }) => [
                  styles.photoButton,
                  pressed && styles.pressedButton,
                  photos.length >= MAX_PHOTO_COUNT && styles.disabledButton,
                ]}
              >
                {selectingPhotos ? (
                  <ActivityIndicator color={colors.cyan} />
                ) : (
                  <Text style={styles.photoButtonText}>
                    + SELECCIONAR FOTOGRAFÍAS
                  </Text>
                )}
              </Pressable>
              {photoErrors.map((error) => (
                <Text
                  key={error}
                  style={styles.errorText}
                  accessibilityRole="alert"
                >
                  {error}
                </Text>
              ))}
              {totalSizeNotice(photos) && (
                <Text style={styles.photoRulesText} accessibilityRole="alert">
                  {totalSizeNotice(photos)}
                </Text>
              )}
              {photos.map((photo, index) => (
                <View
                  key={`${photo.uri}-${index}`}
                  style={styles.photoItem}
                  testID={`selected-damaged-home-photo-${index}`}
                >
                  <View style={styles.photoItemCopy}>
                    <Text style={styles.photoName} numberOfLines={1}>
                      {photo.name}
                    </Text>
                    <Text style={styles.photoMeta}>{photo.mimeType}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar fotografía ${photo.name}`}
                    onPress={() =>
                      setPhotos((current) =>
                        current.filter(
                          (_, photoIndex) => photoIndex !== index,
                        ),
                      )
                    }
                    style={styles.removePhoto}
                  >
                    <Text style={styles.removePhotoText}>QUITAR</Text>
                  </Pressable>
                </View>
              ))}
            </FormSection>

            {/* CHG-182: el medio para recibir ayuda directa. Opcional,
                público y sin verificación de la plataforma: eso último
                se dice aquí y se repite en la ficha. */}
            <FormSection
              code="04"
              title="Cómo pueden ayudarte"
              description="Opcional. Si quieres recibir transferencias, deja el medio y el dato exacto."
              onPosition={registerSection}
            >
              <View style={styles.channels}>
                {DAMAGED_HOME_DONATION_CHANNELS.map((channel) => {
                  const active = draft.donationChannel === channel;
                  return (
                    <Pressable
                      key={channel}
                      accessibilityRole="button"
                      accessibilityLabel={`Medio de ayuda: ${channel}`}
                      accessibilityState={{ selected: active }}
                      onPress={() =>
                        setField(
                          "donationChannel",
                          (active
                            ? null
                            : channel) as DamagedHomeDonationChannel | null,
                        )
                      }
                      style={({ pressed }) => [
                        styles.channel,
                        active && styles.channelActive,
                        pressed && styles.pressedButton,
                        invalidFields.has("donationChannel") &&
                          styles.channelInvalid,
                      ]}
                      testID={`donation-channel-${channel}`}
                    >
                      <Text
                        style={[
                          styles.channelText,
                          active && styles.channelTextActive,
                        ]}
                      >
                        {channel.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {draft.donationChannel && (
                <FormField
                  label="A dónde transferir *"
                  hint={donationReferenceHint[draft.donationChannel]}
                  invalid={invalidFields.has("donationReference")}
                  value={draft.donationReference}
                  maxLength={MAX_DONATION_REFERENCE_LENGTH}
                  onChangeText={(value) =>
                    setField("donationReference", value)
                  }
                />
              )}
              <Text style={styles.disclaimer}>{DONATION_DISCLAIMER}</Text>
            </FormSection>

            <FormSection
              code="05"
              title="Confirmación"
              description="Lee y confirma antes de publicar."
              onPosition={registerSection}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.truthConfirmed }}
                accessibilityLabel="Confirmo que el hogar está en las condiciones descritas y la información es real."
                onPress={() =>
                  setField("truthConfirmed", !draft.truthConfirmed)
                }
                style={({ pressed }) => [
                  styles.consent,
                  draft.truthConfirmed && styles.consentChecked,
                  pressed && styles.pressedButton,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    draft.truthConfirmed && styles.checkboxChecked,
                  ]}
                >
                  <Text style={styles.checkmark}>
                    {draft.truthConfirmed ? "✓" : ""}
                  </Text>
                </View>
                <Text style={styles.consentText}>
                  Confirmo que el hogar está en las condiciones descritas y
                  la información es real.
                </Text>
              </Pressable>
            </FormSection>

            {formErrors.length > 0 && (
              <View style={styles.errorSummary} accessibilityRole="alert">
                <Text style={styles.errorSummaryTitle}>
                  Revisa el informe antes de continuar
                </Text>
                {formErrors.map((error) => (
                  <Text key={error} style={styles.errorSummaryItem}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}

            <View
              style={[styles.submitPanel, compact && styles.submitPanelCompact]}
            >
              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>PUBLICACIÓN Y REVISIÓN</Text>
                <Text style={styles.submitText}>
                  Tu casita se publica de inmediato y aparece en el mapa.
                  Quien quiera ayudarte podrá comentar y calificar tu
                  publicación, y te avisaremos aquí y por correo. El
                  equipo de la plataforma puede retirarla si no
                  corresponde.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Publicar mi casita destruida"
                disabled={submitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.pressedButton,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#07101b" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    PUBLICAR MI CASITA →
                  </Text>
                )}
              </Pressable>
            </View>
            </SessionGate>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
    </MapScrollLockProvider>
  );
}

function DamagedHomeConfirmation({
  receipt,
  onHome,
}: {
  receipt: DamagedHomeReceipt;
  onHome: () => void;
}) {
  return (
    <LinearGradient
      colors={["#081210", colors.canvas]}
      style={[styles.root, styles.confirmationRoot]}
    >
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationIcon}>
          <Text style={styles.confirmationMark}>✓</Text>
        </View>
        <Text style={styles.overline}>CONSTANCIA / CUSOL</Text>
        <Text style={styles.confirmationTitle} accessibilityRole="header">
          Tu casita quedó publicada
        </Text>
        <Text style={styles.confirmationText}>
          Ya aparece en el mapa desde el{" "}
          {createdFormatter.format(new Date(receipt.createdAt))}
          {receipt.publicCode ? ` con el código ${receipt.publicCode}` : ""}.
          Cuando alguien comente tu publicación te avisaremos en «Mi
          espacio» y por correo.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a la portada"
          onPress={onHome}
          style={styles.submitButton}
        >
          <Text style={styles.submitButtonText}>VOLVER A LA PORTADA</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function FormSection({
  code,
  title,
  description,
  children,
  onPosition,
}: {
  code: string;
  title: string;
  description: string;
  children: React.ReactNode;
  onPosition?: (code: string, y: number) => void;
}) {
  return (
    <View
      style={styles.section}
      onLayout={(event) => onPosition?.(code, event.nativeEvent.layout.y)}
    >
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionCode}>{code}</Text>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.fieldGrid}>{children}</View>;
}

function FormField({
  label,
  hint,
  multiline = false,
  invalid = false,
  placeholder = "Escribe aquí",
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
  invalid?: boolean;
  placeholder?: string;
  // CHG-182: el número de personas se escribe con teclado numérico.
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={[styles.field, multiline && styles.fieldWide]}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, invalid && styles.fieldLabelInvalid]}>
          {label}
        </Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor="#4b586d"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.fieldInput,
          multiline && styles.fieldInputMultiline,
          invalid && styles.fieldInputInvalid,
        ]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  safeArea: { flex: 1 },
  header: {
    width: "100%",
    maxWidth: contentMaxWidth,
    minHeight: 52,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(11,15,25,0.72)",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
  },
  backArrow: { color: colors.cyan, fontSize: 24 },
  backText: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan,
  },
  headerStatusText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  scroll: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 62,
    paddingBottom: 80,
  },
  contentCompact: { paddingHorizontal: 10, paddingTop: 38 },
  intro: { marginBottom: 10 },
  overline: {
    marginBottom: 8,
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    maxWidth: 900,
    color: colors.ink,
    fontSize: 62,
    fontWeight: "800",
    letterSpacing: -3.3,
    lineHeight: 66,
  },
  titleCompact: { fontSize: 39, letterSpacing: -2, lineHeight: 43 },
  introText: {
    maxWidth: 820,
    marginTop: 17,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 23,
  },
  section: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(15,23,38,0.86)",
  },
  sectionCode: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 32,
  },
  sectionHeadingCopy: { minWidth: 0, flex: 1 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  sectionDescription: {
    marginTop: 4,
    color: colors.inkDim,
    fontSize: 10,
    lineHeight: 16,
  },
  sectionBody: { gap: 24, padding: 20 },
  fieldGrid: fieldGridLayout.grid,
  field: fieldGridLayout.field,
  fieldWide: fieldGridLayout.fieldWide,
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldLabelInvalid: { color: colors.reported },
  fieldHint: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8 },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: 12,
  },
  fieldInputMultiline: { minHeight: 98 },
  fieldInputInvalid: {
    borderColor: colors.reported,
    backgroundColor: "rgba(255,103,136,0.06)",
  },
  consent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  consentChecked: {
    borderColor: "rgba(67,231,173,0.32)",
    backgroundColor: "rgba(67,231,173,0.05)",
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.inkDim,
    borderRadius: 5,
  },
  checkboxChecked: { borderColor: colors.alive, backgroundColor: colors.alive },
  checkmark: { color: "#07101b", fontSize: 13, fontWeight: "900" },
  consentText: {
    minWidth: 0,
    flex: 1,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 18,
  },
  errorText: { color: colors.reported, fontSize: 10, lineHeight: 16 },
  errorSummary: {
    gap: 5,
    padding: 17,
    borderWidth: 1,
    borderColor: "rgba(255,103,136,0.36)",
    borderRadius: 10,
    backgroundColor: "rgba(255,103,136,0.08)",
  },
  errorSummaryTitle: {
    marginBottom: 3,
    color: colors.reported,
    fontSize: 13,
    fontWeight: "800",
  },
  errorSummaryItem: { color: "#e6a3b2", fontSize: 10, lineHeight: 16 },
  submitPanel: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    gap: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.30)",
    borderRadius: 14,
    backgroundColor: "rgba(81,229,255,0.05)",
  },
  submitPanelCompact: { flexDirection: "column", alignItems: "stretch" },
  submitCopy: { minWidth: 0, flex: 1 },
  submitTitle: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  submitText: {
    maxWidth: 670,
    marginTop: 5,
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  submitButtonText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    textAlign: "center",
  },
  pressedButton: { opacity: 0.72 },
  disabledButton: { opacity: 0.45 },
  // CHG-182: chips del medio de ayuda y su advertencia.
  channels: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  channel: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.panelSoft,
  },
  channelActive: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.10)",
  },
  channelInvalid: { borderColor: colors.reported },
  channelText: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  channelTextActive: { color: colors.cyan },
  disclaimer: {
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 16,
    fontStyle: "italic",
  },
  // CHG-162 (F2): bloque de fotografías del daño.
  photoRules: {
    gap: 4,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.20)",
    borderRadius: 9,
    backgroundColor: "rgba(81,229,255,0.05)",
  },
  photoRulesTitle: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  photoRulesText: { color: colors.inkSoft, fontSize: 10, lineHeight: 16 },
  photoButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.cyan,
    borderRadius: 9,
    backgroundColor: "rgba(81,229,255,0.06)",
  },
  photoButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  photoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
  },
  photoItemCopy: { minWidth: 0, flex: 1 },
  photoName: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  photoMeta: {
    marginTop: 2,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
  },
  removePhoto: { paddingHorizontal: 8, paddingVertical: 7 },
  removePhotoText: {
    color: colors.reported,
    fontFamily: fontFamilies.mono,
    fontSize: 7,
    fontWeight: "800",
  },
  confirmationRoot: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  confirmationCard: {
    width: "100%",
    maxWidth: 600,
    alignItems: "center",
    gap: 12,
    padding: 36,
    borderWidth: 1,
    borderColor: "rgba(67,231,173,0.28)",
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  confirmationIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    borderRadius: 31,
    backgroundColor: colors.alive,
  },
  confirmationMark: { color: "#07101b", fontSize: 28, fontWeight: "900" },
  confirmationTitle: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  confirmationText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
});
