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
import {
  useSessionAccount,
  type SessionAccountSource,
} from "../auth/useSessionAccount";
import { parseDraftCoordinates } from "../missing-persons/geocoding";
import { LastSeenLocationPicker } from "../missing-persons/LastSeenLocationPicker";
import {
  ReportRejectedError,
  createIdempotencyKey,
  type SubmitReportOptions,
} from "../missing-persons/reportSubmission";
import { ReportConsiderations } from "../reporting/ReportConsiderations";
import {
  fetchParentCandidates,
  submitAidLocation,
} from "./reportSubmission";
import {
  AID_LOCATION_PARENT_KIND,
  MAX_ADDRESS_LENGTH,
  MAX_CITY_LENGTH,
  MAX_CONTACT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SCHEDULE_LENGTH,
  MIN_ADDRESS_LENGTH,
  MIN_NAME_LENGTH,
  aidLocationFormCopy,
  aidLocationKindLabel,
  type AidLocationDraft,
  type AidLocationKind,
  type AidLocationParentCandidate,
  type AidLocationReceipt,
} from "./types";

// CHG-153 — Formulario único de alta de los cuatro tipos de puntos
// logísticos, con la misma silueta de los reportes ciudadanos
// (plantilla «Necesitamos ayuda»). Los tipos dependientes (recolección
// y distribución) exigen elegir el centro asociado de su ciudad; los
// candidatos los filtra el backend y el servicio revalida al crear.

export const initialAidLocationDraft: AidLocationDraft = {
  name: "",
  address: "",
  municipality: "",
  department: "",
  latitude: "",
  longitude: "",
  schedule: "",
  contact: "",
  description: "",
  parentId: "",
  truthConfirmed: false,
};

export type AidLocationIssueField =
  | keyof AidLocationDraft
  | "location";

export interface AidLocationIssue {
  field: AidLocationIssueField;
  message: string;
}

// Espejo del contrato (`AidLocationInput`): las mismas reglas que
// aplicará el backend, avisadas antes del viaje.
export function collectAidLocationIssues(
  kind: AidLocationKind,
  draft: AidLocationDraft,
): AidLocationIssue[] {
  const issues: AidLocationIssue[] = [];
  const push = (field: AidLocationIssueField, message: string) =>
    issues.push({ field, message });

  const name = draft.name.trim();
  if (name.length < MIN_NAME_LENGTH) {
    push("name", `Escribe el nombre del punto (mínimo ${MIN_NAME_LENGTH} caracteres).`);
  } else if (name.length > MAX_NAME_LENGTH) {
    push("name", `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`);
  }

  if (!draft.municipality.trim()) {
    push("municipality", "Indica el municipio donde funciona el punto.");
  }
  if (!draft.department.trim()) {
    push("department", "Indica el departamento donde funciona el punto.");
  }

  const address = draft.address.trim();
  if (address.length < MIN_ADDRESS_LENGTH) {
    push("address", "Escribe la dirección del lugar o resuélvela desde el mapa.");
  } else if (address.length > MAX_ADDRESS_LENGTH) {
    push("address", `La dirección no puede superar los ${MAX_ADDRESS_LENGTH} caracteres.`);
  }

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

  // Dependencia obligatoria (§6): recolección exige acopio local;
  // distribución exige acopio receptor.
  if (AID_LOCATION_PARENT_KIND[kind] && !draft.parentId.trim()) {
    push(
      "parentId",
      `Elige el ${aidLocationFormCopy[kind].parentLabel?.toLocaleLowerCase("es-CO")}.`,
    );
  }

  if (draft.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    push(
      "description",
      `La descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    );
  }

  if (!draft.truthConfirmed) {
    push("truthConfirmed", "Debes confirmar que la información es real.");
  }

  return issues;
}

// Sección (01..05) de cada campo, para el scroll al primer error.
const FIELD_SECTIONS: Record<string, string> = {
  name: "01",
  municipality: "02",
  department: "02",
  address: "02",
  location: "02",
  latitude: "02",
  longitude: "02",
  parentId: "03",
  schedule: "04",
  contact: "04",
  description: "04",
  truthConfirmed: "05",
};

type ParentCandidatesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; items: AidLocationParentCandidate[] }
  | { status: "error"; message: string };

interface AidLocationFormProps {
  kind: AidLocationKind;
  onBack: () => void;
  onHome?: () => void;
  onRegister?: () => void;
  onLogin?: () => void;
  sessionSource?: SessionAccountSource;
  // CHG-080: obtención de la posición GPS, inyectable en pruebas.
  locateVisitor?: () => Promise<{ latitude: number; longitude: number }>;
  submitLocation?: (
    kind: AidLocationKind,
    draft: AidLocationDraft,
    options?: SubmitReportOptions,
  ) => Promise<AidLocationReceipt>;
  loadParentCandidates?: (
    kind: AidLocationKind,
    municipality: string,
    options?: { signal?: AbortSignal },
  ) => Promise<AidLocationParentCandidate[]>;
}

const createdFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

// Estado operativo humano de un candidato, para la lista del selector.
const candidateStatusLabel: Record<string, string> = {
  open: "ABIERTO",
  closed: "CERRADO",
  at_capacity: "CAPACIDAD COMPLETA",
  under_observation: "EN OBSERVACIÓN",
};

export function AidLocationForm({
  kind,
  onBack,
  onHome,
  onRegister,
  onLogin,
  sessionSource,
  locateVisitor,
  submitLocation = submitAidLocation,
  loadParentCandidates = (candidateKind, municipality, options) =>
    fetchParentCandidates(candidateKind, municipality, options),
}: AidLocationFormProps) {
  const copy = aidLocationFormCopy[kind];
  const requiresParent = AID_LOCATION_PARENT_KIND[kind] !== undefined;
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const session = useSessionAccount(sessionSource);
  const [draft, setDraft] = useState<AidLocationDraft>(
    initialAidLocationDraft,
  );
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<AidLocationReceipt | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [candidates, setCandidates] = useState<ParentCandidatesState>({
    status: "idle",
  });
  const idempotencyKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const registerSection = (code: string, y: number) => {
    sectionOffsets.current[code] = y;
  };

  const setField = <Key extends keyof AidLocationDraft>(
    key: Key,
    value: AidLocationDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  // Los candidatos dependen de la ciudad escrita: al cambiarla se
  // consultan de nuevo (con un respiro para no disparar por tecla) y
  // se descarta la selección previa si ya no aplica.
  const municipality = draft.municipality.trim();
  useEffect(() => {
    if (!requiresParent) {
      return;
    }
    if (!municipality) {
      setCandidates({ status: "idle" });
      setField("parentId", "");
      return;
    }
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => {
      setCandidates({ status: "loading" });
      loadParentCandidates(kind, municipality, {
        signal: controller.signal,
      })
        .then((items) => {
          setCandidates({ status: "success", items });
          setDraft((current) =>
            current.parentId &&
            !items.some((item) => item.id === current.parentId)
              ? { ...current, parentId: "" }
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
    // `loadParentCandidates` queda fuera de las dependencias adrede:
    // el valor por defecto se recrea en cada render y relanzaría la
    // consulta en bucle.
  }, [kind, municipality, requiresParent]);

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
    const issues = collectAidLocationIssues(kind, draft);
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
        await submitLocation(kind, draft, {
          idempotencyKey: idempotencyKeyRef.current,
        }),
      );
      idempotencyKeyRef.current = null;
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible registrar el punto. Intenta nuevamente.",
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
      <LocationConfirmation receipt={receipt} onHome={onHome ?? onBack} />
    );
  }

  const parentSectionBody = () => {
    if (!municipality) {
      return (
        <Text style={styles.fieldNote}>
          Escribe primero el municipio (sección 02): los centros
          disponibles dependen de la ciudad.
        </Text>
      );
    }
    if (candidates.status === "loading") {
      return <ActivityIndicator color={colors.cyan} />;
    }
    if (candidates.status === "error") {
      return (
        <Text style={styles.errorText} accessibilityRole="alert">
          {candidates.message}
        </Text>
      );
    }
    if (candidates.status === "success" && candidates.items.length === 0) {
      // §6 del contrato: sin centro disponible no hay registro posible.
      return (
        <View style={styles.missingParent} accessibilityRole="alert">
          <Text style={styles.missingParentText}>
            {copy.missingParentMessage}
          </Text>
        </View>
      );
    }
    if (candidates.status === "success") {
      return (
        <View
          style={styles.candidateList}
          accessibilityRole="radiogroup"
          accessibilityLabel={copy.parentLabel}
        >
          {candidates.items.map((candidate) => {
            const selected = draft.parentId === candidate.id;
            return (
              <Pressable
                key={candidate.id}
                accessibilityRole="radio"
                accessibilityLabel={`${candidate.name}, ${candidate.address}`}
                accessibilityState={{ selected }}
                onPress={() => setField("parentId", candidate.id)}
                style={[
                  styles.candidate,
                  selected && styles.candidateSelected,
                ]}
                testID={`parent-candidate-${candidate.id}`}
              >
                <View style={styles.candidateCopy}>
                  <Text style={styles.candidateName}>{candidate.name}</Text>
                  <Text style={styles.candidateMeta}>
                    {candidate.address}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.candidateStatus,
                    selected && styles.candidateStatusSelected,
                  ]}
                >
                  {candidateStatusLabel[candidate.operationalStatus] ??
                    candidate.operationalStatus.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }
    return null;
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
        <View style={styles.header} testID="aid-location-action-bar">
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

            <ReportConsiderations
              purpose={copy.legend}
              considerations={[
                copy.contextNotice,
                "El nombre, la dirección y el punto del mapa son públicos: así la comunidad sabe dónde está el punto y qué hace.",
                "La comunidad puede denunciar un punto que no exista o funcione mal; con suficientes denuncias queda EN OBSERVACIÓN y lo revisa el equipo de la plataforma.",
                ...(requiresParent
                  ? [
                      `Este tipo de punto no puede existir solo: debe asociarse a un ${copy.parentLabel?.toLocaleLowerCase("es-CO")} de su misma ciudad.`,
                    ]
                  : []),
              ]}
              onRegister={onRegister}
              onLogin={onLogin}
              session={session}
            />

            <FormSection
              code="01"
              title="Cómo se llama"
              description="El nombre con el que la comunidad reconocerá este punto."
              onPosition={registerSection}
            >
              <FormField
                label="Nombre del punto *"
                hint={`Entre ${MIN_NAME_LENGTH} y ${MAX_NAME_LENGTH} caracteres`}
                invalid={invalidFields.has("name")}
                value={draft.name}
                maxLength={MAX_NAME_LENGTH}
                onChangeText={(value) => setField("name", value)}
              />
            </FormSection>

            <FormSection
              code="02"
              title="Dónde funciona"
              description="Municipio, departamento y dirección; si puedes, fija también el punto en el mapa."
              onPosition={registerSection}
            >
              <FieldGrid>
                <FormField
                  label="Municipio *"
                  hint="Ciudad donde funciona el punto"
                  invalid={invalidFields.has("municipality")}
                  value={draft.municipality}
                  maxLength={MAX_CITY_LENGTH}
                  onChangeText={(value) => setField("municipality", value)}
                />
                <FormField
                  label="Departamento *"
                  invalid={invalidFields.has("department")}
                  value={draft.department}
                  maxLength={MAX_CITY_LENGTH}
                  onChangeText={(value) => setField("department", value)}
                />
              </FieldGrid>
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
              />
              {invalidFields.has("location") && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  Las coordenadas del punto están fuera de rango.
                </Text>
              )}
            </FormSection>

            {requiresParent && (
              <FormSection
                code="03"
                title="Centro asociado"
                description={`${copy.parentLabel} *. Solo aparecen centros publicados de la ciudad indicada.`}
                onPosition={registerSection}
              >
                {parentSectionBody()}
                {invalidFields.has("parentId") && (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    Elige el centro al que estará asociado este punto.
                  </Text>
                )}
              </FormSection>
            )}

            <FormSection
              code="04"
              title="Cómo opera"
              description="Opcional: horario, contacto y una descripción de lo que hace el punto."
              onPosition={registerSection}
            >
              <FieldGrid>
                <FormField
                  label="Horario"
                  hint="Por ejemplo: L-V 8am-5pm"
                  invalid={invalidFields.has("schedule")}
                  value={draft.schedule}
                  maxLength={MAX_SCHEDULE_LENGTH}
                  onChangeText={(value) => setField("schedule", value)}
                />
                <FormField
                  label="Contacto"
                  hint="Teléfono o correo público del punto"
                  invalid={invalidFields.has("contact")}
                  value={draft.contact}
                  maxLength={MAX_CONTACT_LENGTH}
                  onChangeText={(value) => setField("contact", value)}
                />
              </FieldGrid>
              <FormField
                label="Descripción"
                hint={`Máximo ${MAX_DESCRIPTION_LENGTH} caracteres`}
                multiline
                invalid={invalidFields.has("description")}
                value={draft.description}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChangeText={(value) => setField("description", value)}
              />
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
                accessibilityLabel="Confirmo que el punto existe y la información es real."
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
                  Confirmo que el punto existe y la información es real.
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
              style={[styles.submitPanel, compact && styles.submitPanelCompact]}
            >
              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>PUBLICACIÓN Y REVISIÓN</Text>
                <Text style={styles.submitText}>
                  El punto se publica de inmediato en el mapa y en el
                  directorio. La comunidad puede denunciarlo si no existe o
                  funciona mal; con suficientes denuncias queda EN
                  OBSERVACIÓN y lo revisa el equipo de la plataforma.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Publicar ${aidLocationKindLabel[kind].toLocaleLowerCase("es-CO")}`}
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
                    PUBLICAR PUNTO →
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

function LocationConfirmation({
  receipt,
  onHome,
}: {
  receipt: AidLocationReceipt;
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
          Punto registrado
        </Text>
        <Text style={styles.confirmationText}>
          El {aidLocationKindLabel[receipt.kind].toLocaleLowerCase("es-CO")} ya
          aparece en el mapa y en el directorio desde el{" "}
          {createdFormatter.format(new Date(receipt.createdAt))}.
        </Text>
        <View style={styles.receiptCode}>
          <Text style={styles.receiptLabel}>TIPO DE PUNTO</Text>
          <Text style={styles.receiptValue}>
            {aidLocationKindLabel[receipt.kind]}
          </Text>
          <Text style={styles.reviewStatus}>
            {receipt.operationalStatus === "open"
              ? "ABIERTO"
              : receipt.operationalStatus.toUpperCase()}
          </Text>
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
  fieldNote: { color: colors.inkDim, fontSize: 10, lineHeight: 16 },
  // CHG-153: selector del centro asociado (lista de candidatos).
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
  missingParent: {
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255,181,71,0.35)",
    borderRadius: 9,
    backgroundColor: "rgba(255,181,71,0.07)",
  },
  missingParentText: { color: "#e8c890", fontSize: 11, lineHeight: 18 },
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
