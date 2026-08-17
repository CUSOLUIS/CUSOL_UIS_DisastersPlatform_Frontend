import * as DocumentPicker from "expo-document-picker";
import { fieldGridLayout } from "../../components/fieldGrid";
import { LinearGradient } from "expo-linear-gradient";
import { createContext, useContext, useEffect, useRef, useState } from "react";
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
import { DatePickerField } from "../../components/DatePickerField";
import {
  LAST_SEEN_YEAR_MESSAGE,
  PLATFORM_FIRST_YEAR,
  isBeforePlatformCoverage,
} from "./platformCoverage";
import { InnerRouteHeader } from "../../components/InnerRouteHeader";
import {
  PHONE_FORMAT_MESSAGE,
  PHONE_MAX_INPUT_LENGTH,
  isValidPhone,
} from "../contact/phoneValidation";
import { TimePickerField } from "../../components/TimePickerField";
import { ReportConsiderations } from "../reporting/ReportConsiderations";
import { reportActionCatalog } from "../reporting/reportActionCatalog";
import { personSuggestionsDataSource } from "../person-suggestions/dataSource";
import { PersonSuggestionsPanel } from "../person-suggestions/PersonSuggestionsPanel";
import { usePersonSuggestions } from "../person-suggestions/usePersonSuggestions";
import type { PersonSuggestionsDataSource } from "../person-suggestions/types";
import { normalizeSearchValue } from "./dataSource";
import {
  useSessionAccount,
  type SessionAccountSource,
} from "../auth/useSessionAccount";
import { buildLastSeenQuery, parseDraftCoordinates } from "./geocoding";
import { AddressAutocompleteField } from "./AddressAutocompleteField";
import { LastSeenLocationPicker } from "./LastSeenLocationPicker";
import {
  DOCUMENT_TYPE_OPTIONS,
  NATIONALITY_OPTIONS,
  SEX_OPTIONS,
} from "./personFieldOptions";
import {
  preparePhotosForUpload,
  totalSizeNotice,
} from "./photoProcessing";
import {
  ALLOWED_PHOTO_HELP,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_COUNT,
  validateAndMergePhotos,
} from "./photoValidation";
import { MAX_APPROXIMATE_AGE, ageFromBirthDate } from "./ageFromBirthDate";
import {
  ReportRejectedError,
  createIdempotencyKey,
  submitMissingPersonReport,
  type SubmitReportOptions,
} from "./reportSubmission";
import type {
  MissingPersonReportDraft,
  MissingPersonReportReceipt,
  SelectedPhoto,
  TransportMode,
} from "./reportTypes";

// CHG-113: se exporta para que las pruebas puedan partir de un
// borrador vacío al comprobar qué campos siguen siendo obligatorios.
export const initialDraft: MissingPersonReportDraft = {
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
  tattooDescription: "",
  scarsDescription: "",
  prostheticsDescription: "",
  piercingsAndMoles: "",
  mentalHealthCondition: "",
  vitalMedication: "",
  severeAllergies: "",
  belongingsDescription: "",
  transportMode: "",
  vehicleDetails: "",
  companionsDescription: "",
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
  officialAuthorityName: "",
  isReporterPhonePublic: false,
  isReporterEmailPublic: false,
  truthConfirmed: false,
  photoAuthorizationConfirmed: false,
};

interface MissingPersonReportFormProps {
  onBack: () => void;
  // CHG-053: accesos para reportar con cuenta desde la leyenda.
  onRegister?: () => void;
  onLogin?: () => void;
  // CHG-078: fuente de sesión inyectable en pruebas.
  sessionSource?: SessionAccountSource;
  // CHG-083: salida explícita de la constancia hacia la portada.
  onHome?: () => void;
  pickPhotos?: () => Promise<SelectedPhoto[]>;
  // CHG-091: aviso de posibles duplicados al escribir el nombre.
  suggestionsDataSource?: PersonSuggestionsDataSource;
  onOpenExistingCase?: (publicCaseCode: string) => void;
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
  onHome,
  sessionSource,
  pickPhotos = defaultPickPhotos,
  suggestionsDataSource = personSuggestionsDataSource,
  onOpenExistingCase,
  submitReport = defaultSubmitReport,
}: MissingPersonReportFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  // CHG-078: con sesión activa la leyenda confirma la asociación a la
  // cuenta en lugar de ofrecer registro/inicio de sesión. El envío ya
  // viaja con `credentials: "include"` (CHG-054), así que el gateway
  // vincula la cuenta desde la cookie sin cambios adicionales.
  const session = useSessionAccount(sessionSource);
  const [draft, setDraft] = useState<MissingPersonReportDraft>(initialDraft);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [selectingPhotos, setSelectingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<MissingPersonReportReceipt | null>(null);
  // CHG-083: campos con error para el resaltado inline y scroll.
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const idempotencyKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // CHG-091: aviso de posibles duplicados mientras se escribe el
  // nombre. Descartar el aviso lo silencia para ese par exacto de
  // nombres; si el nombre cambia, vuelve a evaluarse.
  const [dismissedDuplicatesKey, setDismissedDuplicatesKey] = useState<
    string | null
  >(null);
  const duplicatesKey = normalizeSearchValue(
    `${draft.firstNames} ${draft.lastNames}`,
  );
  const duplicateSuggestions = usePersonSuggestions({
    dataSource: suggestionsDataSource,
    firstName: draft.firstNames,
    lastName: draft.lastNames,
    enabled: dismissedDuplicatesKey !== duplicatesKey && receipt === null,
  });
  const sectionOffsets = useRef<Record<string, number>>({});

  const registerSection = (code: string, y: number) => {
    sectionOffsets.current[code] = y;
  };

  // CHG-083: con sesión activa se precargan (editables) los datos del
  // reportante desde el perfil, solo sobre campos aún vacíos.
  useEffect(() => {
    if (session.status !== "authenticated") {
      return;
    }
    const { displayName, email, phone } = session.account;
    setDraft((current) => ({
      ...current,
      reporterName: current.reporterName || displayName,
      reporterEmail: current.reporterEmail || email,
      reporterPhone: current.reporterPhone || (phone ?? ""),
    }));
  }, [session]);

  const setField = <Key extends keyof MissingPersonReportDraft>(
    key: Key,
    value: MissingPersonReportDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  // CHG-115: la edad es un dato derivado mientras haya fecha de
  // nacimiento. Se calculan las dos a la vez para que el borrador
  // nunca contenga una pareja que se contradiga; al borrar la fecha,
  // la edad vuelve a quedar libre y en blanco, que es como se captura
  // cuando quien reporta no conoce la fecha exacta.
  const setBirthDate = (value: string) =>
    setDraft((current) => ({
      ...current,
      birthDate: value,
      approximateAge: value
        ? (ageFromBirthDate(value)?.toString() ?? "")
        : "",
    }));

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

  // CHG-083/CHG-114: desplaza a la sección del campo señalado, venga
  // el señalamiento de la validación local o del rechazo del servicio.
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
    const issues = collectDraftIssues(draft, photos);
    setFormErrors(
      issues
        .map((issue) => issue.message)
        .filter((message) => message.length > 0),
    );
    setInvalidFields(new Set(issues.map((issue) => issue.field)));
    if (issues.length > 0) {
      // CHG-083: scroll suave a la sección del primer campo con error.
      scrollToField(issues[0].field);
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
      // CHG-114: hasta ahora el rechazo del servicio era un texto
      // suelto al pie: no resaltaba nada y dejaba al usuario buscando
      // el campo por su cuenta entre seis secciones.
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
    return <ReportConfirmation receipt={receipt} onHome={onHome ?? onBack} />;
  }

  return (
    <LinearGradient colors={["#070a13", colors.canvas, "#080b15"]} style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        {/* CHG-097: el mismo navbar de la portada — logos, nombre de
            la plataforma y sesión — para que la ruta no se vea como
            una pantalla suelta. */}
        <InnerRouteHeader
          onNavigateHome={onHome ?? onBack}
          onLogin={onLogin ?? (() => undefined)}
          onRegister={onRegister ?? (() => undefined)}
          sessionSource={sessionSource}
          session={session}
        />
        {/* Barra de acciones secundarias, debajo del navbar. */}
        <View style={styles.header} testID="report-action-bar">
          <Pressable accessibilityRole="button" accessibilityLabel="Volver a la portada" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
          <View style={styles.headerStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.headerStatusText}>PUBLICACIÓN INMEDIATA · DATOS SENSIBLES PRIVADOS</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.intro}>
              <Text style={styles.overline}>MISSING PERSON / NEW REPORT</Text>
              <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
                Reportar persona perdida
              </Text>
              <Text style={styles.introText}>
                Completa la información que ayude a identificarla. El reporte se publica de inmediato en la búsqueda al enviarlo y no reemplaza una denuncia ante las autoridades.
              </Text>
            </View>

            <ReportConsiderations
              purpose={reportActionCatalog["missing-person"].purpose}
              considerations={[
                "Documento, información médica y datos de contacto del reportante son privados y se guardan cifrados; las fotografías no se publican y solo las ve el equipo.",
                "La información debe ser veraz y de buena fe. Este reporte no reemplaza la denuncia ante la Fiscalía o la Policía Nacional.",
                "Describe con el mayor detalle posible la última vez que fue vista; la dirección que escribas será visible en la búsqueda pública para ayudar a encontrarla.",
              ]}
              onRegister={onRegister}
              onLogin={onLogin}
              session={session}
            />

            <PrivacyNotice />

            <FormSection code="01" title="Datos de la persona" description="Identificación básica. Los campos marcados con * son obligatorios." onPosition={registerSection}>
              <FieldGrid>
                <FormField testID="field-firstnames" label="Nombres *" invalid={invalidFields.has("firstNames")} value={draft.firstNames} onChangeText={(value) => setField("firstNames", value)} autoComplete="name-given" />
                <FormField label="Apellidos *" invalid={invalidFields.has("lastNames")} value={draft.lastNames} onChangeText={(value) => setField("lastNames", value)} autoComplete="name-family" />
                {duplicateSuggestions.status === "ready" && (
                  <PersonSuggestionsPanel
                    items={duplicateSuggestions.items}
                    actions={{
                      mode: "duplicates",
                      onSamePerson: (item) =>
                        onOpenExistingCase?.(item.publicCaseCode),
                      onDismiss: () =>
                        setDismissedDuplicatesKey(duplicatesKey),
                    }}
                  />
                )}
                <FormField label="Alias o nombre conocido" value={draft.aliases} onChangeText={(value) => setField("aliases", value)} />
                <DatePickerField label="Fecha de nacimiento" accessibilityLabel="Elegir fecha de nacimiento" clearAccessibilityLabel="Borrar fecha de nacimiento" testID="birth-date-calendar" value={draft.birthDate} onChange={setBirthDate} invalid={invalidFields.has("birthDate")} />
                <FormField label="Edad aproximada" hint={draft.birthDate ? "calculada" : undefined} editable={!draft.birthDate} placeholder={draft.birthDate ? "" : "Escribe aquí"} invalid={invalidFields.has("approximateAge")} value={draft.approximateAge} onChangeText={(value) => setField("approximateAge", value)} keyboardType="number-pad" />
                <ChoiceChipsField label="Sexo" options={SEX_OPTIONS} value={draft.genderIdentity} onChange={(value) => setField("genderIdentity", value)} />
                <SelectListField label="Nacionalidad" options={NATIONALITY_OPTIONS} value={draft.nationality} onChange={(value) => setField("nationality", value)} searchable searchPlaceholder="Busca tu nacionalidad" />
              </FieldGrid>
              <PrivateFieldsLabel />
              <FieldGrid>
                <SelectListField label="Tipo de documento · privado" options={DOCUMENT_TYPE_OPTIONS} value={draft.documentType} onChange={(value) => setField("documentType", value)} />
                <FormField label="Número de documento · privado" value={draft.documentNumber} onChangeText={(value) => setField("documentNumber", value)} />
              </FieldGrid>
            </FormSection>

            <FormSection code="02" title="Última vez que fue vista" description="Escribe la dirección o el lugar donde fue vista por última vez." onPosition={registerSection}>
              <FieldGrid>
                <DatePickerField label="Fecha *" accessibilityLabel="Elegir fecha de la última visualización" testID="last-seen-date-calendar" minYear={PLATFORM_FIRST_YEAR} value={draft.lastSeenDate} onChange={(value) => setField("lastSeenDate", value)} invalid={invalidFields.has("lastSeenDate")} />
                <TimePickerField label="Hora aproximada" accessibilityLabel="Elegir hora de la última visualización" clearAccessibilityLabel="Borrar hora" testID="last-seen-time-picker" value={draft.lastSeenTime} onChange={(value) => setField("lastSeenTime", value)} invalid={invalidFields.has("lastSeenTime")} />
                <FormField label="Departamento *" invalid={invalidFields.has("department")} value={draft.department} onChangeText={(value) => setField("department", value)} />
                <FormField label="Municipio *" invalid={invalidFields.has("municipality")} value={draft.municipality} onChangeText={(value) => setField("municipality", value)} />
              </FieldGrid>
              {/* CHG-141: la dirección escrita basta; mientras se
                  escribe aparecen sugerencias detalladas y elegir una
                  sustituye el texto por la dirección completa. */}
              <AddressAutocompleteField
                label="Dirección *"
                invalid={invalidFields.has("lastSeenArea")}
                hint="Dirección o lugar de referencia donde fue vista"
                value={draft.lastSeenArea}
                onChangeText={(value) => setField("lastSeenArea", value)}
              />
              <LastSeenLocationPicker
                locateMode="dot"
                addressQuery={buildLastSeenQuery(draft)}
                value={parseDraftCoordinates(draft.lastSeenLatitude, draft.lastSeenLongitude)}
                onChange={(coordinates) =>
                  setDraft((current) => ({
                    ...current,
                    lastSeenLatitude: coordinates ? coordinates.latitude.toFixed(5) : "",
                    lastSeenLongitude: coordinates ? coordinates.longitude.toFixed(5) : "",
                  }))
                }
                // CHG-086: fijar el muñequito autocompleta la
                // dirección (editable); municipio y departamento solo
                // se rellenan si estaban vacíos.
                onAddressResolved={(address) =>
                  setDraft((current) => ({
                    ...current,
                    lastSeenArea: address.label,
                    municipality:
                      current.municipality.trim() ||
                      (address.municipality ?? ""),
                    department:
                      current.department.trim() ||
                      (address.department ?? ""),
                  }))
                }
              />
              <FormField label="Vestimenta" placeholder="Ej. Camiseta azul, jeans negros (opcional si no lo sabes)" invalid={invalidFields.has("clothingDescription")} multiline value={draft.clothingDescription} onChangeText={(value) => setField("clothingDescription", value)} />
              <FormField label="Circunstancias de la desaparición *" invalid={invalidFields.has("circumstances")} multiline value={draft.circumstances} onChangeText={(value) => setField("circumstances", value)} />
              {/* CHG-094: contexto del desplazamiento — qué llevaba,
                  cómo se movilizaba y con quién. */}
              <FormField label="Pertenencias que llevaba" hint="Mochila, dispositivos, joyas, documentos…" multiline value={draft.belongingsDescription} onChangeText={(value) => setField("belongingsDescription", value)} />
              <TransportModeField
                value={draft.transportMode}
                onChange={(value) => {
                  setField("transportMode", value);
                  // Los datos del vehículo solo aplican con vehículo:
                  // cambiar el medio limpia lo que dejaría de valer.
                  if (value !== "private_vehicle" && value !== "other") {
                    setField("vehicleDetails", "");
                  }
                }}
              />
              {(draft.transportMode === "private_vehicle" ||
                draft.transportMode === "other") && (
                <FormField label="Datos del vehículo · privado" hint="Placa, marca, modelo, color" value={draft.vehicleDetails} onChangeText={(value) => setField("vehicleDetails", value)} />
              )}
              <FormField testID="field-companions" label="Acompañantes" hint="Personas o grupos con los que se le vio por última vez" multiline value={draft.companionsDescription} onChangeText={(value) => setField("companionsDescription", value)} />
            </FormSection>

            <FormSection code="03" title="Características físicas" description="Agrega detalles visuales que permitan reconocer a la persona." onPosition={registerSection}>
              <FieldGrid>
                <FormField label="Estatura aproximada (cm)" invalid={invalidFields.has("heightCm")} value={draft.heightCm} onChangeText={(value) => setField("heightCm", value)} keyboardType="number-pad" />
                <FormField label="Contextura" value={draft.build} onChangeText={(value) => setField("build", value)} />
                <FormField label="Tono de piel" value={draft.skinTone} onChangeText={(value) => setField("skinTone", value)} />
                <FormField label="Cabello" value={draft.hairDescription} onChangeText={(value) => setField("hairDescription", value)} />
                <FormField label="Ojos" value={draft.eyeDescription} onChangeText={(value) => setField("eyeDescription", value)} />
              </FieldGrid>
              <FormField label="Señales particulares" multiline value={draft.distinctiveMarks} onChangeText={(value) => setField("distinctiveMarks", value)} />
              {/* CHG-094: marcas desglosadas — describir por separado
                  ayuda a reconocer más rápido que un solo párrafo. */}
              <FieldGrid>
                <FormField label="Tatuajes" hint="Ubicación y diseño" multiline value={draft.tattooDescription} onChangeText={(value) => setField("tattooDescription", value)} />
                <FormField label="Cicatrices" multiline value={draft.scarsDescription} onChangeText={(value) => setField("scarsDescription", value)} />
                <FormField label="Prótesis u órtesis" multiline value={draft.prostheticsDescription} onChangeText={(value) => setField("prostheticsDescription", value)} />
                <FormField label="Perforaciones, aretes y lunares" multiline value={draft.piercingsAndMoles} onChangeText={(value) => setField("piercingsAndMoles", value)} />
              </FieldGrid>
              <FormField label="Descripción adicional" multiline value={draft.additionalDescription} onChangeText={(value) => setField("additionalDescription", value)} />
              <PrivateFieldsLabel />
              <FormField label="Información médica relevante · privada" multiline value={draft.medicalInformation} onChangeText={(value) => setField("medicalInformation", value)} />
              {/* CHG-094: alertas médicas — el backend las guarda
                  cifradas, como el resto de la información de salud. */}
              <FormField label="Condición cognitiva o de salud mental · privada" hint="Desorientación, Alzheimer, autismo…" multiline value={draft.mentalHealthCondition} onChangeText={(value) => setField("mentalHealthCondition", value)} />
              <FormField label="Medicación de dependencia vital · privada" multiline value={draft.vitalMedication} onChangeText={(value) => setField("vitalMedication", value)} />
              <FormField label="Alergias graves · privada" multiline value={draft.severeAllergies} onChangeText={(value) => setField("severeAllergies", value)} />
            </FormSection>

            <FormSection code="04" title="Datos del reportante" description="Esta información es privada y se usa únicamente para verificar el reporte." onPosition={registerSection}>
              <FieldGrid>
                <FormField label="Nombre completo *" invalid={invalidFields.has("reporterName")} value={draft.reporterName} onChangeText={(value) => setField("reporterName", value)} autoComplete="name" />
                <FormField label="Relación con la persona *" invalid={invalidFields.has("reporterRelationship")} value={draft.reporterRelationship} onChangeText={(value) => setField("reporterRelationship", value)} />
                <FormField label="Teléfono privado" hint="Ej. +57 300 123 4567" maxLength={PHONE_MAX_INPUT_LENGTH} invalid={invalidFields.has("reporterPhone")} value={draft.reporterPhone} onChangeText={(value) => setField("reporterPhone", value)} keyboardType="phone-pad" autoComplete="tel" />
                <FormField label="Correo privado" invalid={invalidFields.has("reporterEmail")} value={draft.reporterEmail} onChangeText={(value) => setField("reporterEmail", value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <FormField label="Número de denuncia o radicado" value={draft.officialReportNumber} onChangeText={(value) => setField("officialReportNumber", value)} />
                <FormField label="Autoridad donde se denunció" hint="Fiscalía, Policía, Gaula…" value={draft.officialAuthorityName} onChangeText={(value) => setField("officialAuthorityName", value)} />
              </FieldGrid>
              <Text style={styles.fieldHint}>Debes ingresar al menos teléfono o correo.</Text>
              {/* CHG-094: el texto describe lo que realmente ocurre —
                  el equipo de revisión puede compartir el dato con
                  quien aporte información; no se publica en la ficha. */}
              <ConsentCheckbox
                checked={draft.isReporterPhonePublic}
                label="Autorizo compartir mi teléfono con quien aporte información sobre el caso"
                onPress={() => setField("isReporterPhonePublic", !draft.isReporterPhonePublic)}
              />
              <ConsentCheckbox
                checked={draft.isReporterEmailPublic}
                label="Autorizo compartir mi correo con quien aporte información sobre el caso"
                onPress={() => setField("isReporterEmailPublic", !draft.isReporterEmailPublic)}
              />
            </FormSection>

            <FormSection code="05" title="Fotografías" description="Adjunta imágenes recientes y claras de la persona." onPosition={registerSection}>
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
              {totalSizeNotice(photos) && (
                <Text style={styles.photoRulesText} accessibilityRole="alert" testID="photo-total-notice">
                  {totalSizeNotice(photos)}
                </Text>
              )}
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

            <FormSection code="06" title="Confirmaciones" description="Lee y confirma antes de preparar el reporte." onPosition={registerSection}>
              <ConsentCheckbox checked={draft.truthConfirmed} label="Confirmo que la información es veraz según mi conocimiento." onPress={() => setField("truthConfirmed", !draft.truthConfirmed)} />
              <ConsentCheckbox checked={draft.photoAuthorizationConfirmed} label="Confirmo que tengo autorización para compartir estas fotografías." onPress={() => setField("photoAuthorizationConfirmed", !draft.photoAuthorizationConfirmed)} />
            </FormSection>

            {formErrors.length > 0 && (
              <View style={styles.errorSummary} accessibilityRole="alert">
                <Text style={styles.errorSummaryTitle}>Revisa el reporte antes de continuar</Text>
                {formErrors.map((error) => <Text key={error} style={styles.errorSummaryItem}>• {error}</Text>)}
              </View>
            )}

            <View style={[styles.submitPanel, compact && styles.submitPanelCompact]}>
              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>ENVÍO Y PUBLICACIÓN</Text>
                <Text style={styles.submitText}>El reporte se publica de inmediato en la búsqueda pública; documento, salud, contactos y fotografías quedan privados. Recibirás una constancia con el código del caso.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Publicar reporte" disabled={submitting} onPress={() => void submit()} style={({ pressed }) => [styles.submitButton, pressed && styles.pressedButton]}>
                {submitting ? <ActivityIndicator color="#07101b" /> : <Text style={styles.submitButtonText}>PUBLICAR REPORTE →</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// CHG-083 — Cada regla produce campo + mensaje: el banner general se
// conserva y además se resalta el campo exacto y se hace scroll al
// primero con error.
export type ReportIssueField =
  | keyof MissingPersonReportDraft
  | "photos"
  | "confirmations";

export interface DraftIssue {
  field: ReportIssueField;
  message: string;
}

// CHG-121: espejo de `height_cm` en el contrato del backend
// (`ge=30, le=250`).
export const MIN_HEIGHT_CM = 30;
export const MAX_HEIGHT_CM = 250;

export function collectDraftIssues(
  draft: MissingPersonReportDraft,
  photos: SelectedPhoto[],
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const push = (field: ReportIssueField, message: string) =>
    issues.push({ field, message });
  const requiredFields: Array<[keyof MissingPersonReportDraft, string]> = [
    ["firstNames", "Ingresa los nombres de la persona."],
    ["lastNames", "Ingresa los apellidos de la persona."],
    ["lastSeenDate", "Ingresa la fecha de la última visualización."],
    ["department", "Ingresa el departamento."],
    ["municipality", "Ingresa el municipio."],
    ["lastSeenArea", "Ingresa la dirección donde fue vista."],
    ["circumstances", "Describe las circunstancias."],
    ["reporterName", "Ingresa el nombre del reportante."],
    ["reporterRelationship", "Indica la relación con la persona."],
  ];

  requiredFields.forEach(([field, message]) => {
    if (typeof draft[field] === "string" && draft[field].trim().length === 0) {
      push(field, message);
    }
  });

  if (!draft.reporterPhone.trim() && !draft.reporterEmail.trim()) {
    push("reporterPhone", "Ingresa al menos un teléfono o correo de contacto privado.");
    push("reporterEmail", "");
  }
  // CHG-100: un teléfono inválido deja al equipo sin forma de
  // contactar a quien reporta, así que se valida antes de enviar.
  if (draft.reporterPhone.trim() && !isValidPhone(draft.reporterPhone)) {
    push("reporterPhone", PHONE_FORMAT_MESSAGE);
  }
  if (draft.reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.reporterEmail)) {
    push("reporterEmail", "El correo del reportante no tiene un formato válido.");
  }
  if (draft.lastSeenDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.lastSeenDate)) {
    push("lastSeenDate", "La fecha de última visualización debe usar AAAA-MM-DD.");
  } else if (draft.lastSeenDate && isBeforePlatformCoverage(draft.lastSeenDate)) {
    // CHG-106: el calendario ya no ofrece años previos, pero la regla
    // vive también aquí para que un envío armado a mano no la esquive.
    push("lastSeenDate", LAST_SEEN_YEAR_MESSAGE);
  } else if (draft.lastSeenDate && new Date(`${draft.lastSeenDate}T23:59:59`).getTime() > Date.now()) {
    push("lastSeenDate", "La fecha de última visualización no puede estar en el futuro.");
  }
  if (draft.lastSeenTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.lastSeenTime)) {
    push("lastSeenTime", "La hora debe usar el formato HH:MM de 24 horas.");
  }
  // CHG-073: listas cerradas y nacimiento plausible (espejo del
  // backend y de la base de datos).
  if (draft.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate)) {
      push("birthDate", "La fecha de nacimiento debe elegirse en el calendario.");
    } else if (new Date(`${draft.birthDate}T23:59:59`).getTime() > Date.now()) {
      push("birthDate", "La fecha de nacimiento no puede estar en el futuro.");
    } else if (draft.birthDate < "1900-01-01") {
      push("birthDate", "La fecha de nacimiento no puede ser anterior a 1900.");
    } else if ((ageFromBirthDate(draft.birthDate) ?? 0) > MAX_APPROXIMATE_AGE) {
      // CHG-115: el servicio y la base topan la edad en 120; guardarla
      // recortada devolvería a tener un dato que miente.
      push(
        "birthDate",
        `La fecha de nacimiento implica una edad mayor a ${MAX_APPROXIMATE_AGE} años.`,
      );
    }
  }
  // CHG-121: espejo del contrato del backend (30–250 cm). Sin esta
  // regla, "1.75" viajaba mutilado como 1 y "abc" se descartaba en
  // silencio; el único aviso llegaba del servicio, genérico y tras el
  // viaje completo. `Number` en vez de `parseInt` para que un valor
  // con decimales o letras falle en lugar de mutilarse.
  if (draft.heightCm.trim()) {
    const heightCm = Number(draft.heightCm.trim());
    if (
      !Number.isInteger(heightCm) ||
      heightCm < MIN_HEIGHT_CM ||
      heightCm > MAX_HEIGHT_CM
    ) {
      push(
        "heightCm",
        `La estatura debe ser un número en centímetros entre ${MIN_HEIGHT_CM} y ${MAX_HEIGHT_CM} (ej. 170).`,
      );
    }
  }
  if (draft.genderIdentity && !(SEX_OPTIONS as readonly string[]).includes(draft.genderIdentity)) {
    push("genderIdentity", "El sexo debe elegirse entre Hombre o Mujer.");
  }
  if (draft.nationality && !(NATIONALITY_OPTIONS as readonly string[]).includes(draft.nationality)) {
    push("nationality", "La nacionalidad debe elegirse de la lista.");
  }
  if (draft.documentType && !(DOCUMENT_TYPE_OPTIONS as readonly string[]).includes(draft.documentType)) {
    push("documentType", "El tipo de documento debe elegirse de la lista.");
  }
  if (photos.length === 0) {
    push("photos", "Adjunta al menos una fotografía permitida.");
  }
  if (!draft.truthConfirmed || !draft.photoAuthorizationConfirmed) {
    push("confirmations", "Debes aceptar las dos confirmaciones.");
  }
  return issues;
}

// Sección (01..06) a la que pertenece cada campo, para el scroll.
const FIELD_SECTIONS: Record<string, string> = {
  firstNames: "01", lastNames: "01", aliases: "01", birthDate: "01",
  approximateAge: "01", genderIdentity: "01", nationality: "01",
  documentType: "01", documentNumber: "01",
  lastSeenDate: "02", lastSeenTime: "02", department: "02",
  municipality: "02", lastSeenArea: "02", clothingDescription: "02",
  circumstances: "02",
  heightCm: "03", build: "03", skinTone: "03", hairDescription: "03",
  eyeDescription: "03", distinctiveMarks: "03",
  additionalDescription: "03", medicalInformation: "03",
  tattooDescription: "03", scarsDescription: "03",
  prostheticsDescription: "03", piercingsAndMoles: "03",
  mentalHealthCondition: "03", vitalMedication: "03",
  severeAllergies: "03",
  belongingsDescription: "02", transportMode: "02",
  vehicleDetails: "02", companionsDescription: "02",
  reporterName: "04", reporterRelationship: "04", reporterPhone: "04",
  reporterEmail: "04", officialReportNumber: "04",
  officialAuthorityName: "04",
  photos: "05",
  confirmations: "06", truthConfirmed: "06",
  photoAuthorizationConfirmed: "06",
};



function FormSection({ code, title, description, children, onPosition }: { code: string; title: string; description: string; children: React.ReactNode; onPosition?: (code: string, y: number) => void }) {
  return (
    <View
      style={styles.section}
      onLayout={(event) => onPosition?.(code, event.nativeEvent.layout.y)}
    >
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

// CHG-145: marca si un campo vive dentro de la rejilla (fila) o suelto
// en la columna de la sección. Los estilos con `flexBasis` de la
// rejilla solo son correctos en fila; en columna reservan/solapan
// altura (por eso «Acompañantes» se montaba sobre el bloque de arriba).
const FieldGridContext = createContext(false);

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <FieldGridContext.Provider value={true}>
      <View style={styles.fieldGrid}>{children}</View>
    </FieldGridContext.Provider>
  );
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
  // CHG-100: tope de caracteres del input.
  maxLength?: number;
  // CHG-083: resaltado inline del campo con error.
  invalid?: boolean;
  // CHG-113: marcador propio para los campos donde conviene decir qué
  // se espera, o que pueden dejarse en blanco.
  placeholder?: string;
  // CHG-115: los campos derivados de otro no se editan a mano.
  editable?: boolean;
  // CHG-145: identificador opcional del contenedor del campo.
  testID?: string;
};

function FormField({
  label,
  hint,
  multiline = false,
  invalid = false,
  placeholder = "Escribe aquí",
  editable = true,
  testID,
  ...inputProps
}: FormFieldProps) {
  const insideGrid = useContext(FieldGridContext);
  // CHG-145: dentro de la rejilla, estilo con `flexBasis` (eje
  // horizontal); suelto en la columna, ancho completo y alto de
  // contenido, sin `flex*` que reserve o solape altura.
  const containerStyle = insideGrid
    ? [styles.field, multiline && styles.fieldWide]
    : styles.fieldStandalone;
  return (
    <View style={containerStyle} testID={testID}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, invalid && styles.fieldLabelInvalid]}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor="#4b586d"
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline, invalid && styles.fieldInputInvalid, !editable && styles.fieldInputDerived]}
        {...inputProps}
      />
    </View>
  );
}

// CHG-073 — Campos de lista cerrada y mini agenda de fecha: nada de
// texto libre en sexo, nacionalidad, tipo de documento ni nacimiento.

// CHG-094 — Medio de transporte: lista cerrada con etiqueta legible y
// valor del contrato.
const TRANSPORT_MODES: Array<{ value: TransportMode; label: string }> = [
  { value: "on_foot", label: "A pie" },
  { value: "bicycle", label: "Bicicleta" },
  { value: "public_transport", label: "Transporte público" },
  { value: "private_vehicle", label: "Vehículo particular" },
  { value: "other", label: "Otro" },
];

function TransportModeField({
  value,
  onChange,
}: {
  value: TransportMode | "";
  onChange: (value: TransportMode | "") => void;
}) {
  const insideGrid = useContext(FieldGridContext);
  return (
    <View style={insideGrid ? styles.field : styles.fieldStandalone}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>Medio de transporte</Text>
      </View>
      <View style={styles.choiceRow}>
        {TRANSPORT_MODES.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`Medio de transporte: ${option.label}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? "" : option.value)}
              style={[styles.choiceChip, selected && styles.choiceChipActive]}
            >
              <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ChoiceChipsField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const insideGrid = useContext(FieldGridContext);
  return (
    <View style={insideGrid ? styles.field : styles.fieldStandalone}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? "" : option)}
              style={[styles.choiceChip, selected && styles.choiceChipActive]}
            >
              <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SelectListField({
  label,
  options,
  value,
  onChange,
  searchable = false,
  searchPlaceholder = "Busca en la lista",
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es-CO");
  const matches = normalized
    ? options.filter((option) =>
        option.toLocaleLowerCase("es-CO").includes(normalized),
      )
    : options;
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        style={styles.fieldInput}
      >
        <View style={styles.selectValueRow}>
          <Text style={value ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
            {value || "Elegir de la lista"}
          </Text>
          <Text style={styles.selectCaret}>{open ? "▴" : "▾"}</Text>
        </View>
      </Pressable>
      {open && (
        <View style={styles.selectPanel}>
          {searchable && (
            <TextInput
              accessibilityLabel={`Buscar ${label.toLocaleLowerCase("es-CO")}`}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor="#4b586d"
              style={styles.selectSearch}
            />
          )}
          <ScrollView style={styles.selectScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {value !== "" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${label.toLocaleLowerCase("es-CO")}`}
                onPress={() => {
                  onChange("");
                  setOpen(false);
                }}
                style={styles.selectOption}
              >
                <Text style={styles.selectClearText}>Quitar selección</Text>
              </Pressable>
            )}
            {matches.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={[styles.selectOption, option === value && styles.selectOptionActive]}
              >
                <Text style={styles.selectOptionText}>{option}</Text>
              </Pressable>
            ))}
            {matches.length === 0 && (
              <Text style={styles.selectEmpty}>Sin coincidencias en la lista.</Text>
            )}
          </ScrollView>
        </View>
      )}
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
        <Text style={styles.privacyText}>Documento, salud y contactos son privados. Las fotos no se publican: solo las ve el equipo de verificación. No incluyas ubicaciones residenciales exactas.</Text>
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

function ReportConfirmation({ receipt, onHome }: { receipt: MissingPersonReportReceipt; onHome: () => void }) {
  return (
    <LinearGradient colors={["#071119", colors.canvas]} style={[styles.root, styles.confirmationRoot]}>
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationIcon}><Text style={styles.confirmationMark}>✓</Text></View>
        <Text style={styles.overline}>CONSTANCIA / CUSOL</Text>
        <Text style={styles.confirmationTitle} accessibilityRole="header">Reporte publicado</Text>
        <Text style={styles.confirmationText}>El reporte ya aparece en la búsqueda pública de personas. El equipo puede editarlo, cambiar su estado o retirarlo si es necesario. Guarda el código del caso.</Text>
        <View style={styles.receiptCode}>
          <Text style={styles.receiptLabel}>CÓDIGO DEL CASO</Text>
          <Text style={styles.receiptValue}>{receipt.publicCaseCode}</Text>
          <Text style={styles.reviewStatus}>PUBLICADO</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a la portada" onPress={onHome} style={styles.submitButton}>
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
  // CHG-097: barra secundaria bajo el navbar — más baja y con fondo
  // propio para leerse como migas de pan, no como otro encabezado.
  header: { width: "100%", maxWidth: contentMaxWidth, minHeight: 52, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "rgba(11,15,25,0.72)" },
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
  // CHG-097: 14 px dejaba el textarea de un campo pegado a la
  // etiqueta del siguiente; 24 separa los bloques de forma uniforme.
  sectionBody: { gap: 24, padding: 20 },
  // CHG-116: la regla vive en components/fieldGrid.ts; era la
  // misma copiada en los tres formularios y en los tres
  // desbordaba por la derecha.
  fieldGrid: fieldGridLayout.grid,
  field: fieldGridLayout.field,
  fieldWide: fieldGridLayout.fieldWide,
  // CHG-145: campo suelto en la columna de la sección — ancho completo
  // y alto de contenido, sin el `flexBasis` de la rejilla (que en el
  // eje vertical reservaba/solapaba altura). La separación entre
  // bloques la da el `gap` de `sectionBody`.
  fieldStandalone: { alignSelf: "stretch", gap: 7 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldHint: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8 },
  fieldInput: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, color: colors.ink, backgroundColor: "rgba(5,9,17,0.72)", fontSize: 12 },
  fieldInputMultiline: { minHeight: 98 },
  // CHG-083: resaltado del campo con error.
  fieldInputInvalid: { borderColor: colors.reported, backgroundColor: "rgba(255,103,136,0.06)" },
  fieldLabelInvalid: { color: colors.reported },
  // CHG-115: un campo derivado se lee, no se escribe; el fondo lo dice
  // antes de que la persona intente teclear en él.
  fieldInputDerived: { backgroundColor: "rgba(137,166,207,0.07)", color: colors.inkSoft },
  // CHG-073: selectores de lista cerrada y mini agenda.
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceChip: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, backgroundColor: "rgba(5,9,17,0.72)" },
  choiceChipActive: { borderColor: colors.cyan, backgroundColor: "rgba(81,229,255,0.1)" },
  choiceChipText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  choiceChipTextActive: { color: colors.cyan },
  selectValueRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectValue: { color: colors.ink, fontSize: 12, flexShrink: 1 },
  selectPlaceholder: { color: "#4b586d", fontSize: 12 },
  selectCaret: { color: colors.inkDim, fontSize: 12 },
  selectPanel: { marginTop: 6, borderWidth: 1, borderColor: "rgba(137,166,207,0.28)", borderRadius: 8, backgroundColor: "rgba(7,11,20,0.98)", padding: 8, gap: 8 },
  selectSearch: { minHeight: 40, paddingHorizontal: 11, borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 7, color: colors.ink, backgroundColor: "rgba(5,9,17,0.72)", fontSize: 12 },
  selectScroll: { maxHeight: 210 },
  selectOption: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 6 },
  selectOptionActive: { backgroundColor: "rgba(81,229,255,0.1)" },
  selectOptionText: { color: colors.ink, fontSize: 12 },
  selectClearText: { color: colors.reported, fontSize: 12, fontWeight: "700" },
  selectEmpty: { color: colors.inkDim, fontSize: 11, padding: 10 },
  calendarStep: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  calendarCell: { minWidth: 62, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "rgba(137,166,207,0.18)", borderRadius: 6 },
  calendarCellSmall: { minWidth: 40, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "rgba(137,166,207,0.18)", borderRadius: 6 },
  calendarCellText: { color: colors.ink, fontSize: 12 },
  // CHG-087: márgenes propios — la separación no puede depender del `gap`
  // de flexbox (no lo aplican navegadores/WebViews viejos y la cinta
  // quedaba montada sobre el campo anterior). Fondo sólido.
  privateLabel: { marginTop: 14, marginBottom: 2, alignSelf: "stretch", paddingHorizontal: 10, paddingVertical: 7, borderLeftWidth: 2, borderLeftColor: colors.deceased, borderRadius: 4, backgroundColor: "#10142a" },
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
