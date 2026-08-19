import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
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
import type { AidLocationParentCandidate } from "../aid-locations/types";
import { SessionGate } from "../auth/SessionGate";
import {
  useSessionAccount,
  type SessionAccountSource,
} from "../auth/useSessionAccount";
import {
  ReportRejectedError,
  createIdempotencyKey,
  type SubmitReportOptions,
} from "../missing-persons/reportSubmission";
import {
  fetchTransportCenterCandidates,
  submitTransport,
} from "./reportSubmission";
import { CenterPickerModal } from "./CenterPickerModal";
import { CityAutocompleteField } from "./CityAutocompleteField";
import { fetchTransportCities, type TransportCity } from "./cityCatalog";
import { TransportJourneyPanel } from "./TransportJourneyPanel";
import {
  DRIVER_DOCUMENT_TYPES,
  DRIVER_PHONE_PATTERN,
  MAX_DRIVER_DOCUMENT_LENGTH,
  MAX_DRIVER_NAME_LENGTH,
  MAX_DRIVER_PHONE_LENGTH,
  MAX_SUPPLIES_LENGTH,
  MAX_VEHICLE_CHARACTERISTICS_LENGTH,
  PLATE_PATTERN,
  normalizePlate,
  transportDriverCopy,
  transportFormCopy,
  transportKindLabel,
  transportSideCopy,
  transportVehicleCopy,
  type TransportDraft,
  type TransportKind,
  type TransportReceipt,
  type TransportSide,
} from "./types";

// CHG-161 — Formulario compartido de «La mulera» y «La lanchera»:
// exige sesión (portón; el gateway refuerza con 401), pide ciudad y
// centro de cada lado del viaje (candidatos de CHG-153, filtrados por
// el backend y revalidados al crear) y publica con constancia.

export const initialTransportDraft: TransportDraft = {
  originMunicipality: "",
  originLocationId: "",
  destinationMunicipality: "",
  destinationLocationId: "",
  suppliesSummary: "",
  truthConfirmed: false,
  // CHG-171: conductor y vehículo.
  driverFullName: "",
  driverDocumentType: "",
  driverDocumentNumber: "",
  driverPhone: "",
  tractorPlate: "",
  trailerPlate: "",
  vehicleVisibleCharacteristics: "",
};

export type TransportIssueField = keyof TransportDraft;

export interface TransportIssue {
  field: TransportIssueField;
  message: string;
}

// Espejo del contrato (`HumanitarianTransportInput`): las mismas
// reglas que aplicará el backend, avisadas antes del viaje.
export function collectTransportIssues(
  draft: TransportDraft,
): TransportIssue[] {
  const issues: TransportIssue[] = [];
  const push = (field: TransportIssueField, message: string) =>
    issues.push({ field, message });

  if (!draft.originMunicipality.trim()) {
    push("originMunicipality", "Indica la ciudad de la que salen los insumos.");
  }
  if (!draft.originLocationId.trim()) {
    push(
      "originLocationId",
      "Elige el centro de acopio local del que sale el transporte.",
    );
  }
  if (!draft.destinationMunicipality.trim()) {
    push(
      "destinationMunicipality",
      "Indica la ciudad a la que llegan los insumos.",
    );
  }
  if (!draft.destinationLocationId.trim()) {
    push(
      "destinationLocationId",
      "Elige el centro de acopio receptor al que llega el transporte.",
    );
  }
  // CHG-171 §42: conductor y vehículo obligatorios (espejo backend).
  if (draft.driverFullName.trim().length < 3) {
    push(
      "driverFullName",
      "Escribe el nombre completo de la persona que conduce.",
    );
  }
  if (!draft.driverDocumentType) {
    push(
      "driverDocumentType",
      "Elige el tipo de documento de quien conduce.",
    );
  }
  if (draft.driverDocumentNumber.trim().length < 3) {
    push(
      "driverDocumentNumber",
      "Escribe el número de documento de quien conduce.",
    );
  }
  if (!DRIVER_PHONE_PATTERN.test(draft.driverPhone.trim())) {
    push(
      "driverPhone",
      "Escribe un número de contacto válido para quien conduce.",
    );
  }
  if (!PLATE_PATTERN.test(normalizePlate(draft.tractorPlate))) {
    push(
      "tractorPlate",
      "La placa debe tener entre 5 y 10 letras o números.",
    );
  }
  if (!PLATE_PATTERN.test(normalizePlate(draft.trailerPlate))) {
    push(
      "trailerPlate",
      "La placa del tráiler debe tener entre 5 y 10 letras o números.",
    );
  }
  const characteristics = draft.vehicleVisibleCharacteristics.trim();
  if (
    characteristics.length < 5 ||
    characteristics.length > MAX_VEHICLE_CHARACTERISTICS_LENGTH
  ) {
    push(
      "vehicleVisibleCharacteristics",
      `Describe las características visibles del vehículo (5 a ${MAX_VEHICLE_CHARACTERISTICS_LENGTH} caracteres).`,
    );
  }
  if (draft.suppliesSummary.trim().length > MAX_SUPPLIES_LENGTH) {
    push(
      "suppliesSummary",
      `La descripción de los insumos no puede superar los ${MAX_SUPPLIES_LENGTH} caracteres.`,
    );
  }
  if (!draft.truthConfirmed) {
    push("truthConfirmed", "Debes confirmar que el transporte es real.");
  }

  return issues;
}

// Sección (01..06, CHG-171 §4) de cada campo, para el scroll al primer
// error.
const FIELD_SECTIONS: Record<string, string> = {
  originMunicipality: "01",
  originLocationId: "01",
  destinationMunicipality: "02",
  destinationLocationId: "02",
  driverFullName: "03",
  driverDocumentType: "03",
  driverDocumentNumber: "03",
  driverPhone: "03",
  tractorPlate: "04",
  trailerPlate: "04",
  vehicleVisibleCharacteristics: "04",
  suppliesSummary: "05",
  truthConfirmed: "06",
};

type CandidatesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; items: AidLocationParentCandidate[] }
  | { status: "error"; message: string };

interface TransportFormProps {
  kind: TransportKind;
  onBack: () => void;
  onHome?: () => void;
  onRegister?: () => void;
  onLogin?: () => void;
  sessionSource?: SessionAccountSource;
  submitTransportReport?: (
    kind: TransportKind,
    draft: TransportDraft,
    options?: SubmitReportOptions,
  ) => Promise<TransportReceipt>;
  loadCenterCandidates?: (
    side: TransportSide,
    municipality: string,
    options?: { signal?: AbortSignal },
  ) => Promise<AidLocationParentCandidate[]>;
  // CHG-171: catálogo de ciudades inyectable en pruebas.
  loadCities?: () => Promise<TransportCity[]>;
}

// Campos del borrador que guardan la ciudad y el centro de cada lado.
const SIDE_FIELDS: Record<
  TransportSide,
  { municipality: "originMunicipality" | "destinationMunicipality";
    locationId: "originLocationId" | "destinationLocationId" }
> = {
  origin: {
    municipality: "originMunicipality",
    locationId: "originLocationId",
  },
  destination: {
    municipality: "destinationMunicipality",
    locationId: "destinationLocationId",
  },
};

export function TransportForm({
  kind,
  onBack,
  onHome,
  onRegister,
  onLogin,
  sessionSource,
  submitTransportReport = submitTransport,
  loadCenterCandidates = (side, municipality, options) =>
    fetchTransportCenterCandidates(side, municipality, options),
  loadCities = fetchTransportCities,
}: TransportFormProps) {
  const copy = transportFormCopy[kind];
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const session = useSessionAccount(sessionSource);
  const [draft, setDraft] = useState<TransportDraft>(initialTransportDraft);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<TransportReceipt | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [originCandidates, setOriginCandidates] = useState<CandidatesState>({
    status: "idle",
  });
  const [destinationCandidates, setDestinationCandidates] =
    useState<CandidatesState>({ status: "idle" });
  // CHG-171: catálogo de ciudades (una sola carga) y popup de centros.
  const [cities, setCities] = useState<TransportCity[]>([]);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [pickerSide, setPickerSide] = useState<TransportSide | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const registerSection = (code: string, y: number) => {
    sectionOffsets.current[code] = y;
  };

  // CHG-171 §50/§53: el catálogo se carga una vez y se filtra local.
  useEffect(() => {
    let mounted = true;
    loadCities()
      .then((items) => {
        if (mounted) setCities(items);
      })
      .catch(() => {
        if (mounted) {
          setCitiesError(
            "No fue posible cargar el catálogo de ciudades. Recarga la página para intentarlo de nuevo.",
          );
        }
      });
    return () => {
      mounted = false;
    };
    // La versión por defecto se recrearía en cada render.
  }, []);

  const setField = <Key extends keyof TransportDraft>(
    key: Key,
    value: TransportDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  // Los candidatos de cada lado dependen de su ciudad: al cambiarla se
  // consultan de nuevo (con un respiro para no disparar por tecla) y
  // se descarta la selección previa si ya no aplica.
  const useSideCandidates = (
    side: TransportSide,
    setCandidates: (state: CandidatesState) => void,
  ) => {
    const fields = SIDE_FIELDS[side];
    const municipality = draft[fields.municipality].trim();
    useEffect(() => {
      if (!municipality) {
        setCandidates({ status: "idle" });
        setField(fields.locationId, "");
        return;
      }
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => {
        setCandidates({ status: "loading" });
        loadCenterCandidates(side, municipality, {
          signal: controller.signal,
        })
          .then((items) => {
            setCandidates({ status: "success", items });
            setDraft((current) =>
              current[fields.locationId] &&
              !items.some((item) => item.id === current[fields.locationId])
                ? { ...current, [fields.locationId]: "" }
                : current,
            );
          })
          .catch((error: unknown) => {
            if (error instanceof Error && error.name === "AbortError") {
              return;
            }
            setCandidates({
              status: "error",
              message:
                "No fue posible consultar los centros de esta ciudad. Intenta de nuevo.",
            });
          });
      }, 600);
      return () => {
        controller.abort();
        globalThis.clearTimeout(timer);
      };
      // `loadCenterCandidates` queda fuera de las dependencias adrede:
      // el valor por defecto se recrea en cada render y relanzaría la
      // consulta en bucle.
    }, [side, municipality]);
  };

  useSideCandidates("origin", setOriginCandidates);
  useSideCandidates("destination", setDestinationCandidates);

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
    const issues = collectTransportIssues(draft);
    setFormErrors(issues.map((issue) => issue.message));
    setInvalidFields(new Set(issues.map((issue) => issue.field)));
    if (issues.length > 0) {
      scrollToField(issues[0].field);
      return;
    }

    setSubmitting(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();
    try {
      setReceipt(
        await submitTransportReport(kind, draft, {
          idempotencyKey: idempotencyKeyRef.current,
        }),
      );
      idempotencyKeyRef.current = null;
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible registrar el transporte. Intenta nuevamente.",
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
    // CHG-171 (GPS): la constancia se convierte en la pantalla del
    // viaje — activa el GPS del conductor y ofrece salida/llegada.
    return (
      <TransportJourneyPanel
        receipt={receipt}
        kind={kind}
        onHome={onHome ?? onBack}
      />
    );
  }

  // CHG-171 §10-§15: tras elegir la ciudad se muestra el CONTEO de
  // centros y el botón que abre el popup; nunca la lista suelta.
  const centerTypeLabel: Record<TransportSide, string> = {
    origin: "Centros de Acopio Local",
    destination: "Centros de Acopio Receptores",
  };

  const sideSectionBody = (
    side: TransportSide,
    candidates: CandidatesState,
  ) => {
    const fields = SIDE_FIELDS[side];
    const sideCopy = transportSideCopy[side];
    const municipality = draft[fields.municipality].trim();
    if (!municipality) {
      return (
        <Text style={styles.fieldNote}>
          Elige primero la ciudad: los centros disponibles dependen de
          ella.
        </Text>
      );
    }
    if (candidates.status === "loading") {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.fieldNote}>
            Buscando centros disponibles...
          </Text>
        </View>
      );
    }
    if (candidates.status === "error") {
      return (
        <Text style={styles.errorText} accessibilityRole="alert">
          {candidates.message}
        </Text>
      );
    }
    if (candidates.status !== "success") {
      return null;
    }
    if (candidates.items.length === 0) {
      return (
        <View style={styles.missingCenter} accessibilityRole="alert">
          <Text style={styles.missingCenterText}>
            0 {centerTypeLabel[side]} disponibles.{" "}
            {sideCopy.missingCenterMessage}
          </Text>
        </View>
      );
    }
    const selectedCandidate = candidates.items.find(
      (candidate) => candidate.id === draft[fields.locationId],
    );
    return (
      <View style={styles.centerPickerBlock}>
        <Text style={styles.centerCount} testID={`${side}-center-count`}>
          {candidates.items.length === 1
            ? `1 ${centerTypeLabel[side].replace("Centros", "Centro").replace("Receptores", "Receptor")} disponible`
            : `${candidates.items.length} ${centerTypeLabel[side]} disponibles`}
        </Text>
        {selectedCandidate ? (
          <View
            style={[styles.candidate, styles.candidateSelected]}
            testID={`${side}-selected-center`}
          >
            <View style={styles.candidateCopy}>
              <Text style={styles.candidateName}>
                {selectedCandidate.name}
              </Text>
              <Text style={styles.candidateMeta}>
                {selectedCandidate.address}
              </Text>
              <Text style={styles.candidateMeta}>
                {selectedCandidate.municipality},{" "}
                {selectedCandidate.department}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cambiar el centro de ${side === "origin" ? "origen" : "destino"}`}
              onPress={() => setPickerSide(side)}
              style={styles.changeCenterButton}
              testID={`${side}-change-center`}
            >
              <Text style={styles.changeCenterText}>CAMBIAR CENTRO</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver ${centerTypeLabel[side]} de la ciudad elegida`}
            onPress={() => setPickerSide(side)}
            style={styles.viewCentersButton}
            testID={`${side}-view-centers`}
          >
            <Text style={styles.viewCentersText}>VER CENTROS</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const sideSection = (
    code: string,
    side: TransportSide,
    candidates: CandidatesState,
  ) => {
    const fields = SIDE_FIELDS[side];
    const sideCopy = transportSideCopy[side];
    return (
      <FormSection
        code={code}
        title={sideCopy.sectionTitle}
        description={sideCopy.sectionDescription}
        onPosition={registerSection}
      >
        {citiesError && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {citiesError}
          </Text>
        )}
        <CityAutocompleteField
          label={sideCopy.cityLabel}
          hint="Elige una ciudad del catálogo"
          cities={cities}
          value={draft[fields.municipality]}
          invalid={invalidFields.has(fields.municipality)}
          testIDPrefix={`${side}-city`}
          onSelect={(city) => setField(fields.municipality, city.name)}
          onClear={() => {
            // §23: cambiar de ciudad elimina el centro incompatible.
            setField(fields.municipality, "");
            setField(fields.locationId, "");
          }}
        />
        {sideSectionBody(side, candidates)}
        {invalidFields.has(fields.locationId) && (
          <Text style={styles.errorText} accessibilityRole="alert">
            Elige el {sideCopy.centerLabel.toLocaleLowerCase("es-CO")}.
          </Text>
        )}
      </FormSection>
    );
  };

  return (
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
        <View style={styles.header} testID="transport-action-bar">
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
              REGISTRO CON TRAZABILIDAD · SOLO CON CUENTA
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
              <Text style={styles.overline}>{copy.overline}</Text>
              <Text
                style={[styles.title, compact && styles.titleCompact]}
                accessibilityRole="header"
              >
                {copy.title}
              </Text>
              <Text style={styles.introText}>{copy.intro}</Text>
            </View>

            {/* Portón de sesión (criterio 2): sin cuenta el formulario
                explica y ofrece registrarse o iniciar sesión; las
                secciones y el botón de publicar ni siquiera existen. */}
            <SessionGate
              session={session}
              explanation={copy.sessionExplanation}
              onRegister={onRegister}
              onLogin={onLogin}
            >
              {sideSection("01", "origin", originCandidates)}
              {sideSection("02", "destination", destinationCandidates)}

              {/* CHG-171 §25-§30: datos del conductor, con la regla de
                  que quien registra ES quien conduce (GPS). */}
              <FormSection
                code="03"
                title={transportDriverCopy[kind].sectionTitle}
                description={transportDriverCopy[kind].sectionDescription}
                onPosition={registerSection}
              >
                <View style={styles.gpsNotice} accessibilityRole="alert">
                  <Text style={styles.gpsNoticeText}>
                    {transportDriverCopy[kind].gpsNotice}
                  </Text>
                </View>
                <FormField
                  label="Nombre completo *"
                  invalid={invalidFields.has("driverFullName")}
                  value={draft.driverFullName}
                  maxLength={MAX_DRIVER_NAME_LENGTH}
                  onChangeText={(value) => setField("driverFullName", value)}
                />
                <View style={styles.field}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      invalidFields.has("driverDocumentType") &&
                        styles.fieldLabelInvalid,
                    ]}
                  >
                    Tipo de documento *
                  </Text>
                  <View
                    style={styles.documentTypeRow}
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Tipo de documento de quien conduce"
                  >
                    {DRIVER_DOCUMENT_TYPES.map((option) => {
                      const selected = draft.driverDocumentType === option;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="radio"
                          accessibilityLabel={option}
                          accessibilityState={{ selected }}
                          onPress={() =>
                            setField("driverDocumentType", option)
                          }
                          style={[
                            styles.documentTypeChip,
                            selected && styles.documentTypeChipSelected,
                          ]}
                          testID={`driver-document-${option}`}
                        >
                          <Text
                            style={[
                              styles.documentTypeText,
                              selected && styles.documentTypeTextSelected,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <FormField
                  label="Número de documento *"
                  hint="Se guarda cifrado; no se publica"
                  invalid={invalidFields.has("driverDocumentNumber")}
                  value={draft.driverDocumentNumber}
                  maxLength={MAX_DRIVER_DOCUMENT_LENGTH}
                  onChangeText={(value) =>
                    setField("driverDocumentNumber", value)
                  }
                />
                <FormField
                  label="Número de contacto *"
                  hint="Se guarda cifrado; no se publica"
                  invalid={invalidFields.has("driverPhone")}
                  value={draft.driverPhone}
                  maxLength={MAX_DRIVER_PHONE_LENGTH}
                  onChangeText={(value) => setField("driverPhone", value)}
                />
              </FormSection>

              {/* CHG-171 §31-§35: identificación del vehículo. */}
              <FormSection
                code="04"
                title={transportVehicleCopy[kind].sectionTitle}
                description={
                  transportVehicleCopy[kind].sectionDescription
                }
                onPosition={registerSection}
              >
                <FormField
                  label={transportVehicleCopy[kind].tractorPlateLabel}
                  hint="Ejemplo: ABC123"
                  invalid={invalidFields.has("tractorPlate")}
                  value={draft.tractorPlate}
                  maxLength={12}
                  onChangeText={(value) =>
                    setField("tractorPlate", value.toUpperCase())
                  }
                />
                <FormField
                  label={transportVehicleCopy[kind].trailerPlateLabel}
                  hint="Distinta de la anterior"
                  invalid={invalidFields.has("trailerPlate")}
                  value={draft.trailerPlate}
                  maxLength={12}
                  onChangeText={(value) =>
                    setField("trailerPlate", value.toUpperCase())
                  }
                />
                <FormField
                  label="Características visibles del vehículo *"
                  hint={`Máximo ${MAX_VEHICLE_CHARACTERISTICS_LENGTH} caracteres`}
                  multiline
                  invalid={invalidFields.has("vehicleVisibleCharacteristics")}
                  value={draft.vehicleVisibleCharacteristics}
                  maxLength={MAX_VEHICLE_CHARACTERISTICS_LENGTH}
                  onChangeText={(value) =>
                    setField("vehicleVisibleCharacteristics", value)
                  }
                  placeholder="Tractocamión blanco, tráiler gris, franja azul lateral..."
                />
              </FormSection>

              <FormSection
                code="05"
                title="Qué lleva"
                description="Opcional: un resumen de los insumos que viajan, para la trazabilidad."
                onPosition={registerSection}
              >
                <FormField
                  label="Insumos que lleva"
                  hint={`Máximo ${MAX_SUPPLIES_LENGTH} caracteres`}
                  multiline
                  invalid={invalidFields.has("suppliesSummary")}
                  value={draft.suppliesSummary}
                  maxLength={MAX_SUPPLIES_LENGTH}
                  onChangeText={(value) => setField("suppliesSummary", value)}
                />
              </FormSection>

              <FormSection
                code="06"
                title="Confirmación"
                description="Lee y confirma antes de publicar."
                onPosition={registerSection}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: draft.truthConfirmed }}
                  accessibilityLabel={`Confirmo que ${copy.vehicle} y su viaje son reales.`}
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
                    Confirmo que {copy.vehicle} y su viaje son reales.
                  </Text>
                </Pressable>
              </FormSection>

              {formErrors.length > 0 && (
                <View style={styles.errorSummary} accessibilityRole="alert">
                  <Text style={styles.errorSummaryTitle}>
                    Revisa el registro antes de continuar
                  </Text>
                  {formErrors.map((error) => (
                    <Text key={error} style={styles.errorSummaryItem}>
                      • {error}
                    </Text>
                  ))}
                </View>
              )}

              <View
                style={[
                  styles.submitPanel,
                  compact && styles.submitPanelCompact,
                ]}
              >
                <View style={styles.submitCopy}>
                  <Text style={styles.submitTitle}>
                    TRAZABILIDAD DE LOS SUMINISTROS
                  </Text>
                  <Text style={styles.submitText}>
                    El transporte queda registrado a tu nombre con su origen
                    y su destino. En próximas fases podrá reportar su
                    posición para verse en el mapa durante el viaje.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Registrar ${transportKindLabel[kind].toLocaleLowerCase("es-CO")}`}
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
                      REGISTRAR TRANSPORTE →
                    </Text>
                  )}
                </Pressable>
              </View>
            </SessionGate>
          </View>
        </ScrollView>

        {/* CHG-171 §12/§21/§54: popup reusable de selección de centro
            (origen → acopios locales; destino → receptores). */}
        {pickerSide !== null && (
          <CenterPickerModal
            visible
            title={
              pickerSide === "origin"
                ? "SELECCIONAR CENTRO DE ACOPIO LOCAL"
                : "SELECCIONAR CENTRO DE ACOPIO RECEPTOR"
            }
            candidates={
              (pickerSide === "origin"
                ? originCandidates
                : destinationCandidates
              ).status === "success"
                ? (
                    (pickerSide === "origin"
                      ? originCandidates
                      : destinationCandidates) as {
                      status: "success";
                      items: AidLocationParentCandidate[];
                    }
                  ).items
                : []
            }
            selectedId={draft[SIDE_FIELDS[pickerSide].locationId]}
            onSelect={(candidate) => {
              setField(SIDE_FIELDS[pickerSide].locationId, candidate.id);
              setPickerSide(null);
            }}
            onClose={() => setPickerSide(null)}
            testIDPrefix={`${pickerSide}-picker`}
          />
        )}
      </SafeAreaView>
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
  candidateList: { gap: 10 },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: "rgba(5,9,17,0.55)",
  },
  candidateSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.10)",
  },
  candidateCopy: { minWidth: 0, flex: 1 },
  candidateName: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  candidateMeta: {
    marginTop: 3,
    color: colors.inkDim,
    fontSize: 10,
    lineHeight: 15,
  },
  candidateStatus: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  candidateStatusSelected: { color: colors.cyan },
  missingCenter: {
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255,181,71,0.35)",
    borderRadius: 9,
    backgroundColor: "rgba(255,181,71,0.07)",
  },
  missingCenterText: { color: "#e8c890", fontSize: 11, lineHeight: 18 },
  // CHG-171: conteo + popup de centros y sección del conductor.
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  centerPickerBlock: { gap: 10 },
  centerCount: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  viewCentersButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 8,
  },
  viewCentersText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  changeCenterButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  changeCenterText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  gpsNotice: {
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.35)",
    borderRadius: 9,
    backgroundColor: "rgba(81,229,255,0.06)",
  },
  gpsNoticeText: { color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  documentTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  documentTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: "rgba(5,9,17,0.55)",
  },
  documentTypeChipSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.10)",
  },
  documentTypeText: { color: colors.inkSoft, fontSize: 11 },
  documentTypeTextSelected: { color: colors.cyan, fontWeight: "700" },
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
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  reviewStatus: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
