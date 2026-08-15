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
import {
  ALLOWED_PHOTO_HELP,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_COUNT,
  validateAndMergePhotos,
} from "../missing-persons/photoValidation";
import {
  preparePhotosForUpload,
  totalSizeNotice,
} from "../missing-persons/photoProcessing";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { ReportConsiderations } from "../reporting/ReportConsiderations";
import {
  createBuildingReportIdempotencyKey,
  submitUnverifiedBuildingReport,
  type SubmitBuildingReportOptions,
} from "./reportSubmission";
import type {
  BuildingObservedCondition,
  BuildingOccupancyReport,
  BuildingPendingReason,
  BuildingSearchStatus,
  BuildingType,
  UnverifiedBuildingReportDraft,
  UnverifiedBuildingReportReceipt,
} from "./reportTypes";

export const initialUnverifiedBuildingDraft: UnverifiedBuildingReportDraft = {
  buildingReference: "",
  buildingType: "residential",
  department: "",
  municipality: "",
  sector: "",
  locationReference: "",
  address: "",
  latitude: "",
  longitude: "",
  relatedDisasterId: "",
  observedDate: "",
  observedTime: "",
  searchStatus: "unknown",
  occupancyReport: "unknown",
  pendingReasons: [],
  observedConditions: [],
  observationDescription: "",
  reporterName: "",
  reporterRole: "",
  reporterOrganization: "",
  reporterPhone: "",
  reporterEmail: "",
  officialReportNumber: "",
  truthConfirmed: false,
  photoAuthorizationConfirmed: false,
  reviewAcknowledged: false,
};

const BUILDING_TYPES: Array<{ value: BuildingType; label: string }> = [
  { value: "residential", label: "Residencial" },
  { value: "commercial", label: "Comercial" },
  { value: "institutional", label: "Institucional" },
  { value: "industrial", label: "Industrial" },
  { value: "mixed_use", label: "Uso mixto" },
  { value: "other", label: "Otro" },
];

const SEARCH_STATUSES: Array<{
  value: BuildingSearchStatus;
  label: string;
}> = [
  { value: "not_started", label: "No iniciada" },
  { value: "interrupted", label: "Interrumpida" },
  { value: "incomplete", label: "Incompleta" },
  { value: "unknown", label: "No sé" },
];

const OCCUPANCY_REPORTS: Array<{
  value: BuildingOccupancyReport;
  label: string;
}> = [
  { value: "unknown", label: "Desconocida" },
  { value: "possibly_occupied", label: "Posible ocupación" },
  { value: "reported_empty", label: "Informado como vacío" },
];

const PENDING_REASONS: Array<{
  value: BuildingPendingReason;
  label: string;
}> = [
  { value: "access_blocked", label: "Acceso bloqueado" },
  { value: "structural_risk_observed", label: "Riesgo visible" },
  { value: "debris", label: "Escombros" },
  { value: "fire_or_smoke", label: "Fuego o humo" },
  { value: "flooding", label: "Inundación" },
  { value: "no_response_team", label: "Sin equipo disponible" },
  { value: "communication_loss", label: "Sin comunicación" },
  { value: "evacuation", label: "Evacuación" },
  { value: "other", label: "Otro motivo" },
];

const OBSERVED_CONDITIONS: Array<{
  value: BuildingObservedCondition;
  label: string;
}> = [
  { value: "obstructed_access", label: "Acceso obstruido" },
  { value: "visible_debris", label: "Escombros visibles" },
  { value: "fire_or_smoke", label: "Fuego o humo" },
  { value: "flooding", label: "Inundación" },
  { value: "visible_cracks", label: "Grietas visibles" },
  { value: "partial_collapse_observed", label: "Colapso parcial observado" },
  { value: "total_collapse_observed", label: "Colapso total observado" },
  { value: "other", label: "Otra condición" },
];

interface UnverifiedBuildingReportFormProps {
  onBack: () => void;
  // CHG-053: accesos para reportar con cuenta desde la leyenda.
  onRegister?: () => void;
  onLogin?: () => void;
  pickPhotos?: () => Promise<SelectedPhoto[]>;
  submitReport?: (
    draft: UnverifiedBuildingReportDraft,
    photos: SelectedPhoto[],
    options?: SubmitBuildingReportOptions,
  ) => Promise<UnverifiedBuildingReportReceipt>;
}

const defaultPickPhotos = async (): Promise<SelectedPhoto[]> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_PHOTO_MIME_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? null,
    mimeType: asset.mimeType ?? null,
  }));
};

export function UnverifiedBuildingReportForm({
  onBack,
  onRegister,
  onLogin,
  pickPhotos = defaultPickPhotos,
  submitReport = submitUnverifiedBuildingReport,
}: UnverifiedBuildingReportFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [draft, setDraft] = useState(initialUnverifiedBuildingDraft);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [selectingPhotos, setSelectingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] =
    useState<UnverifiedBuildingReportReceipt | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const setField = <Key extends keyof UnverifiedBuildingReportDraft>(
    key: Key,
    value: UnverifiedBuildingReportDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleArrayValue = <
    Key extends "pendingReasons" | "observedConditions",
  >(
    key: Key,
    value: UnverifiedBuildingReportDraft[Key][number],
  ) => {
    setDraft((current) => {
      const values = current[key] as string[];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  };

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
    if (submitting) return;
    const errors = validateUnverifiedBuildingDraft(draft, photos);
    setFormErrors(errors);
    if (errors.length > 0) return;

    setSubmitting(true);
    idempotencyKeyRef.current ??= createBuildingReportIdempotencyKey();
    try {
      // CHG-071: si el conjunto supera el presupuesto, las imágenes se
      // comprimen automáticamente antes de guardarse.
      const prepared = await preparePhotosForUpload(photos);
      const result = await submitReport(draft, prepared.photos, {
        idempotencyKey: idempotencyKeyRef.current,
      });
      setReceipt(result);
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
    <LinearGradient
      colors={["#080b12", colors.canvas, "#0b0908"]}
      style={styles.root}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
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
              REPORTE PRIVADO · NO PUBLICADO
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.intro}>
              <Text style={styles.overline}>BUILDING / PENDING SEARCH</Text>
              <Text
                accessibilityRole="header"
                style={[styles.title, compact && styles.titleCompact]}
              >
                Reportar edificio sin verificar
              </Text>
              <Text style={styles.introText}>
                Informa un inmueble cuya búsqueda o inspección no ha terminado.
                Este reporte no confirma que haya personas dentro ni determina
                si la estructura es segura.
              </Text>
            </View>

            <ReportConsiderations
              considerations={[
                "Si hay una emergencia activa llama primero a la línea 123: este reporte no despacha equipos de rescate.",
                "El equipo revisa cada reporte antes de que aparezca en el mapa; no confirma presencia de personas ni evalúa la seguridad estructural.",
                "La dirección exacta, las coordenadas y tus datos de contacto son privados y se guardan cifrados; en el mapa solo se publica la zona aproximada.",
                "Reporta únicamente lo que observaste directamente e incluye mínimo una fotografía del inmueble tomada desde un lugar seguro.",
              ]}
              onRegister={onRegister}
              onLogin={onLogin}
            />

            <SafetyNotice />

            <FormSection
              code="01"
              title="Edificio y ubicación"
              description="Identifica el lugar con referencias claras. Los campos con * son obligatorios."
            >
              <ChoiceGroup
                accessibilityPrefix="Tipo de edificio"
                label="TIPO DE EDIFICIO *"
                options={BUILDING_TYPES}
                selected={draft.buildingType}
                onSelect={(value) => setField("buildingType", value)}
              />
              <FieldGrid compact={compact}>
                <FormField
                  label="Nombre o referencia del edificio *"
                  value={draft.buildingReference}
                  onChangeText={(value) => setField("buildingReference", value)}
                />
                <FormField
                  label="Departamento *"
                  value={draft.department}
                  onChangeText={(value) => setField("department", value)}
                />
                <FormField
                  label="Municipio *"
                  value={draft.municipality}
                  onChangeText={(value) => setField("municipality", value)}
                />
                <FormField
                  label="Barrio, vereda o sector *"
                  value={draft.sector}
                  onChangeText={(value) => setField("sector", value)}
                />
              </FieldGrid>
              <FormField
                label="Referencia para encontrar el lugar *"
                multiline
                value={draft.locationReference}
                onChangeText={(value) => setField("locationReference", value)}
              />
              <PrivateFieldsLabel>
                Dirección y coordenadas exactas · solo para el equipo de revisión
              </PrivateFieldsLabel>
              <FormField
                label="Dirección exacta · privada"
                value={draft.address}
                onChangeText={(value) => setField("address", value)}
              />
              <FieldGrid compact={compact}>
                <FormField
                  label="Latitud exacta · privada"
                  hint="Ej. 7.11935"
                  keyboardType="numbers-and-punctuation"
                  value={draft.latitude}
                  onChangeText={(value) => setField("latitude", value)}
                />
                <FormField
                  label="Longitud exacta · privada"
                  hint="Ej. -73.12274"
                  keyboardType="numbers-and-punctuation"
                  value={draft.longitude}
                  onChangeText={(value) => setField("longitude", value)}
                />
              </FieldGrid>
              <Text style={styles.helperText}>
                Las coordenadas son opcionales, pero si agregas una debes
                completar ambas. No se publican con el reporte.
              </Text>
            </FormSection>

            <FormSection
              code="02"
              title="Búsqueda pendiente"
              description="Registra lo que sabes sin convertir observaciones en conclusiones."
            >
              <FieldGrid compact={compact}>
                <FormField
                  label="Fecha de observación *"
                  hint="AAAA-MM-DD"
                  value={draft.observedDate}
                  onChangeText={(value) => setField("observedDate", value)}
                />
                <FormField
                  label="Hora aproximada"
                  hint="HH:MM"
                  value={draft.observedTime}
                  onChangeText={(value) => setField("observedTime", value)}
                />
                <FormField
                  label="ID del evento relacionado"
                  hint="UUID opcional"
                  autoCapitalize="none"
                  value={draft.relatedDisasterId}
                  onChangeText={(value) => setField("relatedDisasterId", value)}
                />
              </FieldGrid>
              <ChoiceGroup
                accessibilityPrefix="Estado de la búsqueda"
                label="ESTADO CONOCIDO DE LA BÚSQUEDA *"
                options={SEARCH_STATUSES}
                selected={draft.searchStatus}
                onSelect={(value) => setField("searchStatus", value)}
              />
              <ChoiceGroup
                accessibilityPrefix="Ocupación reportada"
                label="OCUPACIÓN REPORTADA *"
                options={OCCUPANCY_REPORTS}
                selected={draft.occupancyReport}
                onSelect={(value) => setField("occupancyReport", value)}
              />
              <Text style={styles.helperText}>
                “Posible ocupación” es una alerta para revisión, no confirma la
                presencia de personas.
              </Text>
              <MultiChoiceGroup
                accessibilityPrefix="Motivo pendiente"
                label="¿POR QUÉ SIGUE PENDIENTE? * · ELIGE UNO O MÁS"
                options={PENDING_REASONS}
                selected={draft.pendingReasons}
                onToggle={(value) => toggleArrayValue("pendingReasons", value)}
              />
            </FormSection>

            <FormSection
              code="03"
              title="Observación en el lugar"
              description="Selecciona únicamente señales visibles. No son una evaluación profesional de la estructura."
            >
              <MultiChoiceGroup
                accessibilityPrefix="Condición observada"
                label="CONDICIONES VISIBLES · OPCIONAL"
                options={OBSERVED_CONDITIONS}
                selected={draft.observedConditions}
                onToggle={(value) =>
                  toggleArrayValue("observedConditions", value)
                }
              />
              <FormField
                label="Describe lo observado *"
                hint="Mínimo 20 caracteres"
                multiline
                value={draft.observationDescription}
                onChangeText={(value) =>
                  setField("observationDescription", value)
                }
              />
            </FormSection>

            <FormSection
              code="04"
              title="Datos del reportante"
              description="Se usarán para verificar la información y no aparecerán en el mapa."
            >
              <PrivateFieldsLabel>
                Datos privados · no aparecen en consultas públicas
              </PrivateFieldsLabel>
              <FieldGrid compact={compact}>
                <FormField
                  label="Nombre completo *"
                  autoComplete="name"
                  value={draft.reporterName}
                  onChangeText={(value) => setField("reporterName", value)}
                />
                <FormField
                  label="Relación o rol *"
                  value={draft.reporterRole}
                  onChangeText={(value) => setField("reporterRole", value)}
                />
                <FormField
                  label="Organización"
                  value={draft.reporterOrganization}
                  onChangeText={(value) =>
                    setField("reporterOrganization", value)
                  }
                />
                <FormField
                  label="Teléfono privado"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={draft.reporterPhone}
                  onChangeText={(value) => setField("reporterPhone", value)}
                />
                <FormField
                  label="Correo privado"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={draft.reporterEmail}
                  onChangeText={(value) => setField("reporterEmail", value)}
                />
                <FormField
                  label="Radicado o reporte oficial"
                  value={draft.officialReportNumber}
                  onChangeText={(value) =>
                    setField("officialReportNumber", value)
                  }
                />
              </FieldGrid>
              <Text style={styles.helperText}>
                Debes proporcionar al menos teléfono o correo.
              </Text>
            </FormSection>

            <FormSection
              code="05"
              title="Evidencia fotográfica"
              description="Adjunta imágenes útiles del acceso, fachada o condiciones visibles sin ponerte en riesgo."
            >
              <View style={styles.photoRules}>
                <Text style={styles.photoGlyph}>▣</Text>
                <View style={styles.photoRulesCopy}>
                  <Text style={styles.photoRulesTitle}>FORMATOS PERMITIDOS</Text>
                  <Text style={styles.photoRulesText}>{ALLOWED_PHOTO_HELP}</Text>
                  <Text style={styles.photoRulesText}>
                    Máximo 3 fotos · La suma no puede exceder 50 MB: si pesan más, se comprimen automáticamente antes de guardarse.
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Seleccionar fotografías del edificio"
                disabled={selectingPhotos || photos.length >= MAX_PHOTO_COUNT}
                onPress={() => void selectPhotos()}
                style={({ pressed }) => [
                  styles.photoButton,
                  pressed && styles.pressed,
                  photos.length >= MAX_PHOTO_COUNT && styles.disabled,
                ]}
              >
                {selectingPhotos ? (
                  <ActivityIndicator color={colors.building} />
                ) : (
                  <Text style={styles.photoButtonText}>
                    + SELECCIONAR FOTOGRAFÍAS
                  </Text>
                )}
              </Pressable>
              {photoErrors.map((error) => (
                <Text key={error} accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              ))}
              {totalSizeNotice(photos) && (
                <Text
                  accessibilityRole="alert"
                  style={styles.photoRules}
                  testID="photo-total-notice"
                >
                  {totalSizeNotice(photos)}
                </Text>
              )}
              <View style={styles.photoList}>
                {photos.map((photo, index) => (
                  <View
                    key={`${photo.uri}-${index}`}
                    testID={`selected-building-photo-${index}`}
                    style={styles.photoItem}
                  >
                    <View style={styles.photoIndex}>
                      <Text style={styles.photoIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.photoItemCopy}>
                      <Text numberOfLines={1} style={styles.photoName}>
                        {photo.name}
                      </Text>
                      <Text style={styles.photoMeta}>
                        {photo.mimeType} · {formatBytes(photo.size)}
                      </Text>
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
              </View>
            </FormSection>

            <FormSection
              code="06"
              title="Confirmaciones"
              description="Lee y confirma las condiciones del reporte privado."
            >
              <ConsentCheckbox
                checked={draft.truthConfirmed}
                label="Confirmo que la información es veraz según mi conocimiento y distingue observaciones de conclusiones."
                onPress={() => setField("truthConfirmed", !draft.truthConfirmed)}
              />
              <ConsentCheckbox
                checked={draft.photoAuthorizationConfirmed}
                label="Confirmo que puedo compartir estas fotografías para su revisión."
                onPress={() =>
                  setField(
                    "photoAuthorizationConfirmed",
                    !draft.photoAuthorizationConfirmed,
                  )
                }
              />
              <ConsentCheckbox
                checked={draft.reviewAcknowledged}
                label="Entiendo que el reporte será revisado y no creará automáticamente un marcador ni un diagnóstico."
                onPress={() =>
                  setField("reviewAcknowledged", !draft.reviewAcknowledged)
                }
              />
            </FormSection>

            {formErrors.length > 0 && (
              <View accessibilityRole="alert" style={styles.errorSummary}>
                <Text style={styles.errorSummaryTitle}>
                  Revisa el reporte antes de continuar
                </Text>
                {formErrors.map((error) => (
                  <Text key={error} style={styles.errorSummaryItem}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}

            <View style={[styles.submitPanel, compact && styles.submitPanelCompact]}>
              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>ENVÍO PRIVADO PARA REVISIÓN</Text>
                <Text style={styles.submitText}>
                  Recibirás un código de seguimiento. El equipo debe verificar el
                  expediente antes de que pueda originar información operacional.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar reporte de edificio para revisión"
                accessibilityState={{ disabled: submitting }}
                disabled={submitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#171006" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    ENVIAR PARA REVISIÓN →
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

export function validateUnverifiedBuildingDraft(
  draft: UnverifiedBuildingReportDraft,
  photos: SelectedPhoto[],
): string[] {
  const errors: string[] = [];
  const required: Array<[keyof UnverifiedBuildingReportDraft, string]> = [
    ["buildingReference", "Ingresa un nombre o referencia del edificio."],
    ["department", "Ingresa el departamento."],
    ["municipality", "Ingresa el municipio."],
    ["sector", "Ingresa el barrio, vereda o sector."],
    ["locationReference", "Explica cómo encontrar el lugar."],
    ["observedDate", "Ingresa la fecha de observación."],
    ["observationDescription", "Describe lo observado en el lugar."],
    ["reporterName", "Ingresa el nombre del reportante."],
    ["reporterRole", "Indica la relación o rol del reportante."],
  ];
  required.forEach(([field, message]) => {
    const value = draft[field];
    if (typeof value === "string" && !value.trim()) errors.push(message);
  });

  if (draft.buildingReference.trim().length === 1) {
    errors.push("La referencia del edificio debe tener al menos 2 caracteres.");
  }
  if (
    draft.observationDescription.trim() &&
    draft.observationDescription.trim().length < 20
  ) {
    errors.push("La descripción de la observación debe tener al menos 20 caracteres.");
  }
  if (draft.pendingReasons.length === 0) {
    errors.push("Selecciona al menos un motivo por el que la búsqueda sigue pendiente.");
  }
  if (!draft.reporterPhone.trim() && !draft.reporterEmail.trim()) {
    errors.push("Ingresa al menos un teléfono o correo de contacto privado.");
  }
  if (
    draft.reporterEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.reporterEmail.trim())
  ) {
    errors.push("El correo del reportante no tiene un formato válido.");
  }
  if (draft.observedDate && !isValidDate(draft.observedDate)) {
    errors.push("La fecha de observación debe ser válida y usar AAAA-MM-DD.");
  } else if (draft.observedDate && isFutureLocalDate(draft.observedDate)) {
    errors.push("La fecha de observación no puede estar en el futuro.");
  }
  if (
    draft.observedTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.observedTime)
  ) {
    errors.push("La hora debe usar el formato HH:MM de 24 horas.");
  }
  if (
    draft.relatedDisasterId.trim() &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      draft.relatedDisasterId.trim(),
    )
  ) {
    errors.push("El ID del evento relacionado no tiene formato UUID válido.");
  }

  const hasLatitude = Boolean(draft.latitude.trim());
  const hasLongitude = Boolean(draft.longitude.trim());
  if (hasLatitude !== hasLongitude) {
    errors.push("Completa latitud y longitud juntas o deja ambas vacías.");
  } else if (hasLatitude && hasLongitude) {
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.push("La latitud debe ser un número entre -90 y 90.");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push("La longitud debe ser un número entre -180 y 180.");
    }
  }
  if (photos.length === 0) {
    errors.push("Adjunta al menos una fotografía permitida.");
  }
  if (
    !draft.truthConfirmed ||
    !draft.photoAuthorizationConfirmed ||
    !draft.reviewAcknowledged
  ) {
    errors.push("Debes aceptar las tres confirmaciones.");
  }
  return errors;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isFutureLocalDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const observedDay = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return observedDay > today;
}

function FormSection({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionCode}>{code}</Text>
        <View style={styles.sectionHeadingCopy}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {title}
          </Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function FieldGrid({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.fieldGrid, compact && styles.fieldGridCompact]}>
      {children}
    </View>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "phone-pad"
    | "email-address"
    | "numbers-and-punctuation";
  autoCapitalize?: "none" | "sentences" | "words";
  autoComplete?: "name" | "email" | "tel";
};

function FormField({
  label,
  hint,
  multiline = false,
  ...inputProps
}: FormFieldProps) {
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

function ChoiceGroup<Value extends string>({
  accessibilityPrefix,
  label,
  options,
  selected,
  onSelect,
}: {
  accessibilityPrefix: string;
  label: string;
  options: Array<{ value: Value; label: string }>;
  selected: Value;
  onSelect: (value: Value) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`${accessibilityPrefix}: ${option.label}`}
              accessibilityState={{ checked: active }}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radioDot, active && styles.radioDotActive]} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChoiceGroup<Value extends string>({
  accessibilityPrefix,
  label,
  options,
  selected,
  onToggle,
}: {
  accessibilityPrefix: string;
  label: string;
  options: Array<{ value: Value; label: string }>;
  selected: Value[];
  onToggle: (value: Value) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityLabel={`${accessibilityPrefix}: ${option.label}`}
              accessibilityState={{ checked: active }}
              onPress={() => onToggle(option.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.multiMark, active && styles.multiMarkActive]}>
                {active ? "✓" : "+"}
              </Text>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PrivateFieldsLabel({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.privateLabel}>
      <Text style={styles.privateLabelText}>🔒 {children}</Text>
    </View>
  );
}

function SafetyNotice() {
  return (
    <View accessibilityRole="alert" style={styles.safetyNotice}>
      <Text style={styles.safetyIcon}>!</Text>
      <View style={styles.safetyCopy}>
        <Text style={styles.safetyTitle}>OBSERVACIÓN, NO DIAGNÓSTICO</Text>
        <Text style={styles.safetyText}>
          No ingreses al inmueble ni te expongas para obtener pruebas. Si existe
          peligro inmediato, usa los canales oficiales de emergencia. Este
          formulario no solicita ni despacha ayuda.
        </Text>
      </View>
    </View>
  );
}

function ConsentCheckbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.consent,
        checked && styles.consentChecked,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.checkmark}>{checked ? "✓" : ""}</Text>
      </View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function ReportConfirmation({
  receipt,
  onBack,
}: {
  receipt: UnverifiedBuildingReportReceipt;
  onBack: () => void;
}) {
  return (
    <LinearGradient
      colors={["#171008", colors.canvas]}
      style={[styles.root, styles.confirmationRoot]}
    >
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationIcon}>
          <Text style={styles.confirmationMark}>✓</Text>
        </View>
        <Text style={styles.overline}>PRIVATE REPORT / RECEIPT</Text>
        <Text accessibilityRole="header" style={styles.confirmationTitle}>
          Reporte recibido
        </Text>
        <Text style={styles.confirmationText}>
          El expediente quedó en revisión privada. No se creó un marcador y su
          contenido aún no ha sido validado como información operacional.
        </Text>
        <View style={styles.receiptCode}>
          <Text style={styles.receiptLabel}>CÓDIGO DE SEGUIMIENTO</Text>
          <Text style={styles.receiptValue}>{receipt.publicTrackingCode}</Text>
          <Text style={styles.reviewStatus}>EN REVISIÓN</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a la portada"
          onPress={onBack}
          style={styles.submitButton}
        >
          <Text style={styles.submitButtonText}>VOLVER A LA PORTADA</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Tamaño sin verificar";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  safeArea: { flex: 1 },
  header: {
    width: "100%",
    maxWidth: contentMaxWidth,
    minHeight: 76,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
  },
  backArrow: { color: colors.building, fontSize: 24 },
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
    backgroundColor: colors.building,
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
    paddingTop: 58,
    paddingBottom: 88,
  },
  contentCompact: { paddingHorizontal: 10, paddingTop: 36 },
  intro: { marginBottom: 10 },
  overline: {
    marginBottom: 8,
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    maxWidth: 980,
    color: colors.ink,
    fontSize: 58,
    fontWeight: "800",
    letterSpacing: -3.1,
    lineHeight: 63,
  },
  titleCompact: { fontSize: 38, letterSpacing: -2, lineHeight: 43 },
  introText: {
    maxWidth: 830,
    marginTop: 17,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 23,
  },
  safetyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,159,67,0.32)",
    borderRadius: 12,
    backgroundColor: "rgba(255,159,67,0.07)",
  },
  safetyIcon: {
    width: 32,
    height: 32,
    color: "#171006",
    backgroundColor: colors.building,
    borderRadius: 16,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 32,
    textAlign: "center",
  },
  safetyCopy: { minWidth: 0, flex: 1 },
  safetyTitle: {
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  safetyText: {
    marginTop: 5,
    color: "#c0a88f",
    fontSize: 11,
    lineHeight: 18,
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
    color: colors.building,
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
  sectionBody: { gap: 16, padding: 20 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldGridCompact: { flexDirection: "column" },
  field: { minWidth: 250, flex: 1, gap: 7 },
  fieldWide: { minWidth: "100%" },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
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
  fieldInputMultiline: { minHeight: 110 },
  helperText: { color: colors.inkDim, fontSize: 9, lineHeight: 15 },
  choiceGroup: { gap: 9 },
  choiceLabel: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: "rgba(5,9,17,0.5)",
  },
  chipActive: {
    borderColor: "rgba(255,159,67,0.5)",
    backgroundColor: "rgba(255,159,67,0.1)",
  },
  chipText: { color: colors.inkDim, fontSize: 9, fontWeight: "700" },
  chipTextActive: { color: "#ffd0a5" },
  radioDot: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: colors.inkDim,
    borderRadius: 4,
  },
  radioDotActive: {
    borderColor: colors.building,
    backgroundColor: colors.building,
  },
  multiMark: {
    width: 14,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  multiMarkActive: { color: colors.building },
  privateLabel: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.deceased,
    backgroundColor: "rgba(135,150,255,0.06)",
  },
  privateLabelText: {
    color: colors.deceased,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  photoRules: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255,159,67,0.22)",
    borderRadius: 9,
    backgroundColor: "rgba(255,159,67,0.05)",
  },
  photoGlyph: { color: colors.building, fontSize: 28 },
  photoRulesCopy: { minWidth: 0, flex: 1 },
  photoRulesTitle: {
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  photoRulesText: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 16,
  },
  photoButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.building,
    borderRadius: 9,
    backgroundColor: "rgba(255,159,67,0.06)",
  },
  photoButtonText: {
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  errorText: { color: colors.reported, fontSize: 10, lineHeight: 16 },
  photoList: { gap: 7 },
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
  photoIndex: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,159,67,0.12)",
  },
  photoIndexText: {
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
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
    borderColor: "rgba(255,159,67,0.35)",
    backgroundColor: "rgba(255,159,67,0.05)",
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
  checkboxChecked: {
    borderColor: colors.building,
    backgroundColor: colors.building,
  },
  checkmark: { color: "#171006", fontSize: 13, fontWeight: "900" },
  consentText: {
    minWidth: 0,
    flex: 1,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 18,
  },
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
    borderColor: "rgba(255,159,67,0.28)",
    borderRadius: 14,
    backgroundColor: "rgba(255,159,67,0.07)",
  },
  submitPanelCompact: { flexDirection: "column", alignItems: "stretch" },
  submitCopy: { minWidth: 0, flex: 1 },
  submitTitle: {
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  submitText: {
    maxWidth: 670,
    marginTop: 5,
    color: "#b69a7c",
    fontSize: 10,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: colors.building,
  },
  submitButtonText: {
    color: "#171006",
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    textAlign: "center",
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
    borderColor: "rgba(255,159,67,0.34)",
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
    backgroundColor: colors.building,
  },
  confirmationMark: { color: "#171006", fontSize: 28, fontWeight: "900" },
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
    color: colors.building,
    fontFamily: fontFamilies.mono,
    fontSize: 25,
    fontWeight: "800",
  },
  reviewStatus: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
