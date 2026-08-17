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
import { LastSeenLocationPicker } from "../missing-persons/LastSeenLocationPicker";
import {
  preparePhotosForUpload,
  totalSizeNotice,
} from "../missing-persons/photoProcessing";
import {
  ALLOWED_PHOTO_HELP,
  ALLOWED_PHOTO_MIME_TYPES,
  validateAndMergePhotos,
} from "../missing-persons/photoValidation";
import {
  ReportRejectedError,
  createIdempotencyKey,
  type SubmitReportOptions,
} from "../missing-persons/reportSubmission";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import { ReportConsiderations } from "../reporting/ReportConsiderations";
import { reportActionCatalog } from "../reporting/reportActionCatalog";
import { submitHelpRequest } from "./reportSubmission";
import {
  DEFAULT_NOTIFICATION_RADIUS_KM,
  MAX_ADDRESS_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_DURATION_DAYS,
  MAX_DURATION_HOURS,
  MAX_HELP_REQUEST_PHOTOS,
  MAX_NOTIFICATION_RADIUS_KM,
  MIN_ADDRESS_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MIN_DURATION_DAYS,
  MIN_DURATION_HOURS,
  MIN_NOTIFICATION_RADIUS_KM,
  type HelpRequestDraft,
  type HelpRequestReceipt,
} from "./types";

// CHG-125 — «Necesitamos ayuda»: formulario público (anónimos y
// registrados) con la misma silueta de los reportes ciudadanos.

export const initialHelpRequestDraft: HelpRequestDraft = {
  description: "",
  address: "",
  latitude: "",
  longitude: "",
  durationValue: "",
  durationUnit: "hours",
  // CHG-131: radio de aviso con un valor inicial razonable; editable y
  // borrable (vacío = sin aviso de proximidad).
  notificationRadiusKm: String(DEFAULT_NOTIFICATION_RADIUS_KM),
  truthConfirmed: false,
};

export type HelpRequestIssueField =
  | keyof HelpRequestDraft
  | "location"
  | "photos";

export interface HelpRequestIssue {
  field: HelpRequestIssueField;
  message: string;
}

// Espejo del contrato (`HelpRequestInput`): las mismas reglas que
// aplicará el backend, avisadas antes del viaje.
export function collectHelpRequestIssues(
  draft: HelpRequestDraft,
): HelpRequestIssue[] {
  const issues: HelpRequestIssue[] = [];
  const push = (field: HelpRequestIssueField, message: string) =>
    issues.push({ field, message });

  const description = draft.description.trim();
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    push(
      "description",
      `Describe la situación con al menos ${MIN_DESCRIPTION_LENGTH} caracteres.`,
    );
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    push(
      "description",
      `La descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    );
  }

  const address = draft.address.trim();
  if (address.length < MIN_ADDRESS_LENGTH) {
    push(
      "address",
      "Escribe la dirección del lugar o resuélvela desde el mapa.",
    );
  } else if (address.length > MAX_ADDRESS_LENGTH) {
    push(
      "address",
      `La dirección no puede superar los ${MAX_ADDRESS_LENGTH} caracteres.`,
    );
  }

  // CHG-127: el punto en el mapa es opcional — la dirección escrita
  // basta. Solo se valida el rango cuando sí hay coordenadas.
  const coordinates = parseDraftCoordinates(draft.latitude, draft.longitude);
  if (
    coordinates &&
    (coordinates.latitude < -90 ||
      coordinates.latitude > 90 ||
      coordinates.longitude < -180 ||
      coordinates.longitude > 180)
  ) {
    push("location", "Las coordenadas del punto están fuera de rango.");
  }

  // CHG-130: la vigencia se valida según la unidad elegida; al enviar
  // los días se convierten a horas (mismo tope del backend: 720).
  const rawDuration = draft.durationValue.trim();
  const durationNumber = Number(rawDuration);
  const durationLimits =
    draft.durationUnit === "days"
      ? { min: MIN_DURATION_DAYS, max: MAX_DURATION_DAYS, label: "días" }
      : { min: MIN_DURATION_HOURS, max: MAX_DURATION_HOURS, label: "horas" };
  if (
    !rawDuration ||
    !Number.isInteger(durationNumber) ||
    durationNumber < durationLimits.min ||
    durationNumber > durationLimits.max
  ) {
    push(
      "durationValue",
      `Indica la vigencia en ${durationLimits.label} enteros, entre ${durationLimits.min} y ${durationLimits.max}.`,
    );
  }

  // CHG-131: si se indica radio de aviso, debe ser un entero 1-100.
  // Vacío es válido (sin aviso); sin coordenadas el radio no viaja.
  const rawRadius = draft.notificationRadiusKm.trim();
  if (rawRadius) {
    const radius = Number(rawRadius);
    if (
      !Number.isInteger(radius) ||
      radius < MIN_NOTIFICATION_RADIUS_KM ||
      radius > MAX_NOTIFICATION_RADIUS_KM
    ) {
      push(
        "notificationRadiusKm",
        `Indica el radio de aviso en kilómetros enteros, entre ${MIN_NOTIFICATION_RADIUS_KM} y ${MAX_NOTIFICATION_RADIUS_KM}.`,
      );
    }
  }

  if (!draft.truthConfirmed) {
    push("truthConfirmed", "Debes confirmar que la solicitud es real.");
  }

  return issues;
}

// Sección (01..05) de cada campo, para el scroll al primer error.
const FIELD_SECTIONS: Record<string, string> = {
  description: "01",
  address: "02",
  location: "02",
  latitude: "02",
  longitude: "02",
  notificationRadiusKm: "02",
  durationValue: "03",
  durationUnit: "03",
  photos: "04",
  truthConfirmed: "05",
};

interface HelpRequestFormProps {
  onBack: () => void;
  onHome?: () => void;
  onRegister?: () => void;
  onLogin?: () => void;
  sessionSource?: SessionAccountSource;
  pickPhotos?: () => Promise<SelectedPhoto[]>;
  // CHG-080: obtención de la posición GPS, inyectable en pruebas.
  locateVisitor?: () => Promise<{ latitude: number; longitude: number }>;
  submitRequest?: (
    draft: HelpRequestDraft,
    photos: SelectedPhoto[],
    options?: SubmitReportOptions,
  ) => Promise<HelpRequestReceipt>;
}

const defaultPickPhotos = async (): Promise<SelectedPhoto[]> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_PHOTO_MIME_TYPES,
    multiple: false,
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

const expiryFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export function HelpRequestForm({
  onBack,
  onHome,
  onRegister,
  onLogin,
  sessionSource,
  pickPhotos = defaultPickPhotos,
  locateVisitor,
  submitRequest = submitHelpRequest,
}: HelpRequestFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const session = useSessionAccount(sessionSource);
  const [draft, setDraft] = useState<HelpRequestDraft>(initialHelpRequestDraft);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [selectingPhotos, setSelectingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<HelpRequestReceipt | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const idempotencyKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const registerSection = (code: string, y: number) => {
    sectionOffsets.current[code] = y;
  };

  const setField = <Key extends keyof HelpRequestDraft>(
    key: Key,
    value: HelpRequestDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const selectPhotos = async () => {
    setSelectingPhotos(true);
    try {
      const picked = await pickPhotos();
      if (photos.length + picked.length > MAX_HELP_REQUEST_PHOTOS) {
        setPhotoErrors(["Solo puedes adjuntar una fotografía del lugar."]);
        return;
      }
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
    const issues = collectHelpRequestIssues(draft);
    setFormErrors(issues.map((issue) => issue.message));
    setInvalidFields(new Set(issues.map((issue) => issue.field)));
    if (issues.length > 0) {
      scrollToField(issues[0].field);
      return;
    }

    setSubmitting(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();
    try {
      const prepared = await preparePhotosForUpload(photos);
      setReceipt(
        await submitRequest(draft, prepared.photos, {
          idempotencyKey: idempotencyKeyRef.current,
        }),
      );
      idempotencyKeyRef.current = null;
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible enviar la solicitud. Intenta nuevamente.",
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
    return <RequestConfirmation receipt={receipt} onHome={onHome ?? onBack} />;
  }

  return (
    <LinearGradient
      colors={["#0d070a", colors.canvas, "#0b070a"]}
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
        <View style={styles.header} testID="help-request-action-bar">
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
              PUBLICACIÓN INMEDIATA · EXPIRA SOLA AL VENCER
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.intro}>
              <Text style={styles.overline}>HELP REQUEST / SOS</Text>
              <Text
                style={[styles.title, compact && styles.titleCompact]}
                accessibilityRole="header"
              >
                Necesitamos ayuda
              </Text>
              <Text style={styles.introText}>
                Publica qué está pasando y dónde. La solicitud aparece de
                inmediato en el mapa y en la portada, y deja de mostrarse
                sola cuando vence la vigencia que definas.
              </Text>
            </View>

            <ReportConsiderations
              purpose={reportActionCatalog["help-request"].purpose}
              considerations={[
                "La descripción, la dirección y el punto del mapa son públicos: así la comunidad sabe dónde hace falta ayuda.",
                "No incluyas datos personales sensibles en la descripción; esta solicitud no reemplaza la línea de emergencias 123.",
                "Define una vigencia realista en horas o días: al vencer, la solicitud desaparece automáticamente de todos los espacios.",
              ]}
              onRegister={onRegister}
              onLogin={onLogin}
              session={session}
            />

            <FormSection
              code="01"
              title="Qué está pasando"
              description="Describe la emergencia y qué tipo de ayuda se necesita."
              onPosition={registerSection}
            >
              <FormField
                label="Descripción de la situación *"
                hint={`Entre ${MIN_DESCRIPTION_LENGTH} y ${MAX_DESCRIPTION_LENGTH} caracteres`}
                multiline
                invalid={invalidFields.has("description")}
                value={draft.description}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChangeText={(value) => setField("description", value)}
              />
            </FormSection>

            <FormSection
              code="02"
              title="Dónde"
              description="Escribe la dirección o elígela en el mapa; el punto es obligatorio para dibujar el marcador."
              onPosition={registerSection}
            >
              <FormField
                label="Dirección *"
                hint="Se completa sola al fijar el punto; siempre editable"
                invalid={invalidFields.has("address")}
                value={draft.address}
                maxLength={MAX_ADDRESS_LENGTH}
                onChangeText={(value) => setField("address", value)}
              />
              <LastSeenLocationPicker
                addressQuery={
                  draft.address.trim() ? `${draft.address.trim()}, Colombia` : ""
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
                onAddressResolved={(address) =>
                  setDraft((current) => ({
                    ...current,
                    address: address.label,
                  }))
                }
                locateVisitor={locateVisitor}
                title="UBICACIÓN EN EL MAPA · OPCIONAL"
                helper="Si puedes, cruza la dirección escrita arriba con el mapa, toca «¿Dónde estoy?» para usar tu GPS, o arrastra el muñequito hasta el lugar exacto. Con la dirección escrita basta."
                locateActionLabel="¿Dónde estoy?"
                autoLocateOnEntry
              />
              {invalidFields.has("location") && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  Las coordenadas del punto están fuera de rango.
                </Text>
              )}
              {/* CHG-131: a cuántos km a la redonda se avisa en la app
                  instalada. Requiere el punto en el mapa; sin punto el
                  radio no viaja. */}
              <FieldGrid>
                <FormField
                  label="Radio de aviso (km)"
                  hint={`A cuántos kilómetros a la redonda se avisa en la app (${MIN_NOTIFICATION_RADIUS_KM}-${MAX_NOTIFICATION_RADIUS_KM}); el lugar sale del punto del mapa o de la dirección escrita. Vacío = sin aviso`}
                  invalid={invalidFields.has("notificationRadiusKm")}
                  value={draft.notificationRadiusKm}
                  onChangeText={(value) =>
                    setField("notificationRadiusKm", value)
                  }
                  keyboardType="number-pad"
                />
              </FieldGrid>
            </FormSection>

            <FormSection
              code="03"
              title="Vigencia"
              description="Cuánto tiempo debe permanecer visible la solicitud, en horas o días."
              onPosition={registerSection}
            >
              <FieldGrid>
                <FormField
                  label="Vigencia *"
                  hint={
                    draft.durationUnit === "days"
                      ? `Entre ${MIN_DURATION_DAYS} y ${MAX_DURATION_DAYS} días`
                      : `Entre ${MIN_DURATION_HOURS} y ${MAX_DURATION_HOURS} horas`
                  }
                  invalid={invalidFields.has("durationValue")}
                  value={draft.durationValue}
                  onChangeText={(value) => setField("durationValue", value)}
                  keyboardType="number-pad"
                />
              </FieldGrid>
              {/* CHG-130: unidad de la vigencia (horas o días). */}
              <View
                style={styles.unitRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="Unidad de la vigencia"
              >
                {(
                  [
                    { unit: "hours", label: "HORAS" },
                    { unit: "days", label: "DÍAS" },
                  ] as const
                ).map(({ unit, label }) => (
                  <Pressable
                    key={unit}
                    accessibilityRole="radio"
                    accessibilityLabel={`Vigencia en ${label.toLocaleLowerCase("es-CO")}`}
                    accessibilityState={{
                      selected: draft.durationUnit === unit,
                    }}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        durationUnit: unit,
                      }))
                    }
                    style={[
                      styles.unitOption,
                      draft.durationUnit === unit && styles.unitOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitOptionText,
                        draft.durationUnit === unit &&
                          styles.unitOptionTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldNote}>
                Al vencer, la solicitud deja de mostrarse automáticamente en
                el mapa, la portada y los espacios personales. El control lo
                hace el servidor: cerrar la app no la mantiene viva.
              </Text>
            </FormSection>

            <FormSection
              code="04"
              title="Fotografía del lugar"
              description="Opcional. Una imagen ayuda a reconocer el sitio."
              onPosition={registerSection}
            >
              <View style={styles.photoRules}>
                <Text style={styles.photoRulesTitle}>FORMATOS PERMITIDOS</Text>
                <Text style={styles.photoRulesText}>{ALLOWED_PHOTO_HELP}</Text>
                <Text style={styles.photoRulesText}>
                  Máximo una fotografía; si pesa demasiado se comprime
                  automáticamente antes de enviarse.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Seleccionar una fotografía del lugar"
                disabled={selectingPhotos || photos.length >= MAX_HELP_REQUEST_PHOTOS}
                onPress={() => void selectPhotos()}
                style={({ pressed }) => [
                  styles.photoButton,
                  pressed && styles.pressedButton,
                  photos.length >= MAX_HELP_REQUEST_PHOTOS && styles.disabledButton,
                ]}
              >
                {selectingPhotos ? (
                  <ActivityIndicator color={colors.cyan} />
                ) : (
                  <Text style={styles.photoButtonText}>
                    + SELECCIONAR FOTOGRAFÍA
                  </Text>
                )}
              </Pressable>
              {photoErrors.map((error) => (
                <Text key={error} style={styles.errorText} accessibilityRole="alert">
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
                  testID={`selected-help-photo-${index}`}
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
                        current.filter((_, photoIndex) => photoIndex !== index),
                      )
                    }
                    style={styles.removePhoto}
                  >
                    <Text style={styles.removePhotoText}>QUITAR</Text>
                  </Pressable>
                </View>
              ))}
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
                accessibilityLabel="Confirmo que la solicitud es real y de buena fe."
                onPress={() => setField("truthConfirmed", !draft.truthConfirmed)}
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
                  Confirmo que la solicitud es real y de buena fe.
                </Text>
              </Pressable>
            </FormSection>

            {formErrors.length > 0 && (
              <View style={styles.errorSummary} accessibilityRole="alert">
                <Text style={styles.errorSummaryTitle}>
                  Revisa la solicitud antes de continuar
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
                <Text style={styles.submitTitle}>PUBLICACIÓN Y VIGENCIA</Text>
                <Text style={styles.submitText}>
                  La solicitud se publica de inmediato con un marcador rojo en
                  el mapa y desaparece sola al vencer su vigencia. Recibirás
                  una constancia con el código de la solicitud.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Publicar solicitud de ayuda"
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
                    PUBLICAR SOLICITUD →
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function RequestConfirmation({
  receipt,
  onHome,
}: {
  receipt: HelpRequestReceipt;
  onHome: () => void;
}) {
  return (
    <LinearGradient
      colors={["#120810", colors.canvas]}
      style={[styles.root, styles.confirmationRoot]}
    >
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationIcon}>
          <Text style={styles.confirmationMark}>✓</Text>
        </View>
        <Text style={styles.overline}>CONSTANCIA / CUSOL</Text>
        <Text style={styles.confirmationTitle} accessibilityRole="header">
          Solicitud publicada
        </Text>
        <Text style={styles.confirmationText}>
          Tu solicitud ya aparece en el mapa y en la portada. Dejará de
          mostrarse automáticamente el{" "}
          {expiryFormatter.format(new Date(receipt.expiresAt))}.
        </Text>
        <View style={styles.receiptCode}>
          <Text style={styles.receiptLabel}>CÓDIGO DE LA SOLICITUD</Text>
          <Text style={styles.receiptValue}>{receipt.publicCode}</Text>
          <Text style={styles.reviewStatus}>ACTIVA</Text>
        </View>
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
  keyboardType?: "default" | "number-pad";
  maxLength?: number;
  invalid?: boolean;
  placeholder?: string;
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
    backgroundColor: colors.emergency,
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
    color: colors.emergency,
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
    color: colors.emergency,
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
  fieldNote: { color: colors.inkDim, fontSize: 10, lineHeight: 16 },
  // CHG-130: selector de unidad de la vigencia (horas/días).
  unitRow: { flexDirection: "row", gap: 10 },
  unitOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.35)",
    backgroundColor: "rgba(81,229,255,0.08)",
  },
  unitOptionSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.22)",
  },
  unitOptionText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  unitOptionTextSelected: { color: colors.ink },
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
    borderColor: "rgba(255, 77, 94, 0.30)",
    borderRadius: 14,
    backgroundColor: "rgba(255, 77, 94, 0.06)",
  },
  submitPanelCompact: { flexDirection: "column", alignItems: "stretch" },
  submitCopy: { minWidth: 0, flex: 1 },
  submitTitle: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  submitText: {
    maxWidth: 670,
    marginTop: 5,
    color: "#b98a90",
    fontSize: 10,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: colors.emergency,
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
  confirmationRoot: { alignItems: "center", justifyContent: "center", padding: 20 },
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
  receiptCode: {
    width: "100%",
    alignItems: "center",
    gap: 7,
    marginVertical: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  receiptLabel: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  receiptValue: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 25,
    fontWeight: "800",
  },
  reviewStatus: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
