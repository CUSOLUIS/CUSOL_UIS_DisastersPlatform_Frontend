import { LinearGradient } from "expo-linear-gradient";
import { fieldGridLayout } from "../../components/fieldGrid";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontFamilies } from "../../theme";
import {
  PHONE_FORMAT_MESSAGE,
  PHONE_MAX_INPUT_LENGTH,
  isValidPhone,
  sanitizePhone,
} from "../contact/phoneValidation";
import {
  DEPARTMENTS,
  isKnownDepartment,
  isKnownMunicipality,
  municipalitiesOf,
} from "../territory/territory";
import { TerritorySelectField } from "../territory/TerritorySelectField";
import { authDataSource } from "./dataSource";
import type {
  AccountRegistrationInput,
  AccountRegistrationReceipt,
  RegistrationDraft,
  RequestedAccountType,
} from "./types";

export const initialRegistrationDraft: RegistrationDraft = {
  firstNames: "",
  lastNames: "",
  email: "",
  phone: "",
  department: "",
  municipality: "",
  requestedAccountType: "citizen",
  organizationName: "",
  organizationRole: "",
  healthProfession: "",
  healthLicenseNumber: "",
  healthInstitution: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
  privacyAccepted: false,
  accuracyConfirmed: false,
};

interface RegistrationFormProps {
  onBack: () => void;
  onLogin: () => void;
  registerAccount?: (
    input: AccountRegistrationInput,
  ) => Promise<AccountRegistrationReceipt>;
}

const accountTypes: Array<{
  value: RequestedAccountType;
  title: string;
  description: string;
}> = [
  {
    value: "citizen",
    title: "Ciudadanía",
    description: "Consulta información y realiza reportes ciudadanos.",
  },
  {
    value: "volunteer",
    title: "Voluntariado",
    description: "Solicita vinculación; no concede permisos automáticamente.",
  },
  {
    value: "organization_representative",
    title: "Organización",
    description: "Representa una entidad y requiere revisión institucional.",
  },
];

export function RegistrationForm({
  onBack,
  onLogin,
  registerAccount = authDataSource.register,
}: RegistrationFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const [draft, setDraft] = useState(initialRegistrationDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<AccountRegistrationReceipt | null>(null);

  const setField = <Key extends keyof RegistrationDraft>(
    field: Key,
    value: RegistrationDraft[Key],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  // CHG-185: el municipio depende del departamento. Cambiarlo limpia el
  // municipio elegido; si no, quedaría guardada una pareja imposible
  // («Santander / Medellín») que ninguna validación posterior mira.
  const selectDepartment = (department: string) =>
    setDraft((current) =>
      current.department === department
        ? current
        : { ...current, department, municipality: "" },
    );

  const submit = async () => {
    const nextErrors = validateRegistrationDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    setSubmitting(true);
    try {
      setReceipt(await registerAccount(toRegistrationInput(draft)));
    } catch (error: unknown) {
      setErrors([
        error instanceof Error
          ? error.message
          : "No fue posible completar el registro. Intenta nuevamente.",
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <RegistrationConfirmation
        receipt={receipt}
        onBack={onBack}
        onLogin={onLogin}
      />
    );
  }

  return (
    <LinearGradient colors={["#070a13", colors.canvas, "#080d18"]} style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <AuthHeader onBack={onBack} label="REGISTRO PRIVADO · VERIFICACIÓN REQUERIDA" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, compact && styles.contentCompact]}>
            <View style={styles.intro}>
              <Text style={styles.overline}>ACCOUNT / NEW REGISTRATION</Text>
              <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
                Crea tu cuenta
              </Text>
              <Text style={styles.introText}>
                Regístrate para participar y dar seguimiento a tus acciones. Tu cuenta será privada y deberás verificar el correo antes de iniciar sesión.
              </Text>
            </View>

            <PrivacyNotice />

            <FormSection code="01" title="Identidad" description="Información mínima para reconocer al titular de la cuenta.">
              <FieldGrid>
                <FormField
                  label="Nombres *"
                  value={draft.firstNames}
                  maxLength={80}
                  onChangeText={(value) => setField("firstNames", value)}
                />
                <FormField
                  label="Apellidos *"
                  value={draft.lastNames}
                  maxLength={80}
                  onChangeText={(value) => setField("lastNames", value)}
                />
              </FieldGrid>
              <Text style={styles.fieldHelp}>
                No solicitamos documento, fecha de nacimiento ni información médica para crear la cuenta.
              </Text>
            </FormSection>

            <FormSection code="02" title="Contacto y ubicación" description="Datos privados para verificar la cuenta y ubicar tu contexto general.">
              <FieldGrid>
                <FormField
                  label="Correo electrónico *"
                  value={draft.email}
                  maxLength={254}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(value) => setField("email", value)}
                />
                <FormField
                  label="Teléfono privado"
                  hint="Opcional · ej. +57 300 123 4567"
                  value={draft.phone}
                  maxLength={PHONE_MAX_INPUT_LENGTH}
                  keyboardType="phone-pad"
                  onChangeText={(value) => setField("phone", value)}
                />
                {/* CHG-185: catálogo oficial del DANE en vez de dos
                    cajas libres; el municipio se acota al departamento
                    elegido. */}
                <TerritorySelectField
                  label="Departamento *"
                  name="departamento"
                  hint="Lista oficial"
                  value={draft.department}
                  options={DEPARTMENTS}
                  onSelect={selectDepartment}
                />
                <TerritorySelectField
                  label="Municipio *"
                  name="municipio"
                  hint="Del departamento elegido"
                  value={draft.municipality}
                  options={municipalitiesOf(draft.department)}
                  onSelect={(value) => setField("municipality", value)}
                  disabled={!draft.department}
                  disabledHint="Elige primero el departamento"
                />
              </FieldGrid>
              <Text style={styles.fieldHelp}>
                Solo pedimos ubicación general. No ingreses una dirección residencial exacta.
              </Text>
            </FormSection>

            <FormSection code="03" title="Cómo deseas participar" description="Esta selección expresa una solicitud; nunca asigna permisos operativos por sí sola.">
              <View style={[styles.accountTypeGrid, compact && styles.accountTypeGridCompact]}>
                {accountTypes.map((option) => (
                  <AccountTypeOption
                    key={option.value}
                    {...option}
                    selected={draft.requestedAccountType === option.value}
                    onPress={() => setField("requestedAccountType", option.value)}
                  />
                ))}
              </View>
              {draft.requestedAccountType !== "citizen" && (
                <FieldGrid>
                  <FormField
                    label={
                      draft.requestedAccountType === "organization_representative"
                        ? "Nombre de la organización *"
                        : "Organización vinculada"
                    }
                    hint={draft.requestedAccountType === "volunteer" ? "Opcional" : undefined}
                    value={draft.organizationName}
                    maxLength={160}
                    onChangeText={(value) => setField("organizationName", value)}
                  />
                  <FormField
                    label="Función o cargo"
                    hint="Opcional"
                    value={draft.organizationRole}
                    maxLength={120}
                    onChangeText={(value) => setField("organizationRole", value)}
                  />
                </FieldGrid>
              )}
              <View style={styles.roleNotice}>
                <Text style={styles.roleNoticeTitle}>ROL INICIAL: USUARIO</Text>
                <Text style={styles.roleNoticeText}>
                  Voluntariado, verificación, publicación y administración requieren revisión posterior.
                </Text>
              </View>
            </FormSection>

            {/* CHG-077: quienes declaran profesión y registro del
                sector salud pueden cambiar de inmediato el estado de
                una persona reportada como encontrada o fallecida. */}
            <FormSection code="04" title="Sector salud (opcional)" description="Si trabajas en el sector salud, declara tu profesión y registro profesional: tus novedades sobre personas desaparecidas aplican de inmediato.">
              <FieldGrid>
                <FormField
                  label="Profesión u ocupación en salud"
                  hint="Ej. Médica general, enfermero"
                  value={draft.healthProfession}
                  maxLength={120}
                  onChangeText={(value) => setField("healthProfession", value)}
                />
                <FormField
                  label="Registro o tarjeta profesional"
                  hint="Obligatorio si declaras profesión"
                  value={draft.healthLicenseNumber}
                  maxLength={80}
                  onChangeText={(value) => setField("healthLicenseNumber", value)}
                />
                <FormField
                  label="Institución de salud"
                  hint="Opcional"
                  value={draft.healthInstitution}
                  maxLength={160}
                  onChangeText={(value) => setField("healthInstitution", value)}
                />
              </FieldGrid>
            </FormSection>

            <FormSection code="05" title="Seguridad" description="Usa una contraseña única que no emplees en otros servicios.">
              <FieldGrid>
                <PasswordField
                  label="Contraseña *"
                  value={draft.password}
                  onChangeText={(value) => setField("password", value)}
                />
                <PasswordField
                  label="Confirmar contraseña *"
                  value={draft.confirmPassword}
                  onChangeText={(value) => setField("confirmPassword", value)}
                />
              </FieldGrid>
              <PasswordRequirements password={draft.password} />
            </FormSection>

            <FormSection code="06" title="Consentimientos" description="Lee y confirma cada punto antes de crear la cuenta.">
              <ConsentCheckbox
                checked={draft.termsAccepted}
                label="Acepto los términos de uso de la plataforma."
                onPress={() => setField("termsAccepted", !draft.termsAccepted)}
              />
              <ConsentCheckbox
                checked={draft.privacyAccepted}
                label="Acepto el tratamiento privado de mis datos para gestionar la cuenta."
                onPress={() => setField("privacyAccepted", !draft.privacyAccepted)}
              />
              <ConsentCheckbox
                checked={draft.accuracyConfirmed}
                label="Confirmo que la información suministrada es correcta y que una cuenta no reemplaza los canales oficiales de emergencia."
                onPress={() => setField("accuracyConfirmed", !draft.accuracyConfirmed)}
              />
            </FormSection>

            {errors.length > 0 && (
              <View style={styles.errorSummary} accessibilityRole="alert">
                <Text style={styles.errorTitle}>Revisa los datos antes de continuar</Text>
                {errors.map((error) => (
                  <Text key={error} style={styles.errorItem}>• {error}</Text>
                ))}
              </View>
            )}

            <View style={[styles.submitPanel, compact && styles.submitPanelCompact]}>
              <View style={styles.submitCopy}>
                <Text style={styles.submitTitle}>CUENTA PENDIENTE DE VERIFICACIÓN</Text>
                <Text style={styles.submitText}>
                  Crear la cuenta no inicia sesión ni concede permisos operativos. Recibirás un enlace de verificación en tu correo.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Crear cuenta"
                disabled={submitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#06101a" />
                ) : (
                  <Text style={styles.submitButtonText}>CREAR CUENTA →</Text>
                )}
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" onPress={onLogin} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>¿Ya tienes una cuenta? Iniciar sesión</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function validateRegistrationDraft(draft: RegistrationDraft): string[] {
  const errors: string[] = [];
  if (!draft.firstNames.trim()) errors.push("Ingresa tus nombres.");
  if (!draft.lastNames.trim()) errors.push("Ingresa tus apellidos.");
  if (!draft.email.trim()) {
    errors.push("Ingresa tu correo electrónico.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.push("El correo electrónico no tiene un formato válido.");
  }
  // CHG-100: antes solo se exigía un mínimo de 7 dígitos, así que un
  // número de 25 pasaba igual. Ahora usa la misma regla E.164 que los
  // formularios de reporte.
  if (draft.phone.trim() && !isValidPhone(draft.phone)) {
    errors.push(PHONE_FORMAT_MESSAGE);
  }
  // CHG-185: departamento y municipio se eligen del catálogo oficial
  // del DANE. Se valida también aquí, y no solo en la lista, porque el
  // borrador puede llegar de otra parte y porque un municipio válido
  // deja de serlo al cambiar de departamento.
  if (!draft.department.trim()) {
    errors.push("Elige tu departamento de la lista.");
  } else if (!isKnownDepartment(draft.department)) {
    errors.push("Elige un departamento de la lista oficial.");
  }
  if (!draft.municipality.trim()) {
    errors.push("Elige tu municipio de la lista.");
  } else if (!isKnownMunicipality(draft.department, draft.municipality)) {
    errors.push(
      "Elige un municipio de la lista oficial del departamento elegido.",
    );
  }
  if (
    draft.requestedAccountType === "organization_representative" &&
    !draft.organizationName.trim()
  ) {
    errors.push("Ingresa el nombre de la organización que representas.");
  }
  // CHG-077: profesión y registro del sector salud van juntos.
  const healthProfession = draft.healthProfession.trim();
  const healthLicense = draft.healthLicenseNumber.trim();
  if (
    (healthProfession && !healthLicense) ||
    (healthLicense && !healthProfession)
  ) {
    errors.push(
      "Para el sector salud declara la profesión y el registro profesional juntos.",
    );
  }
  if (draft.healthInstitution.trim() && !healthProfession) {
    errors.push(
      "La institución de salud requiere declarar profesión y registro.",
    );
  }
  if (!hasStrongPassword(draft.password)) {
    errors.push("La contraseña debe cumplir los cinco requisitos de seguridad.");
  }
  if (draft.password !== draft.confirmPassword) {
    errors.push("Las contraseñas no coinciden.");
  }
  if (!draft.termsAccepted) errors.push("Debes aceptar los términos de uso.");
  if (!draft.privacyAccepted) errors.push("Debes aceptar el tratamiento de datos.");
  if (!draft.accuracyConfirmed) errors.push("Debes confirmar la exactitud de la información.");
  return errors;
}

export function toRegistrationInput(
  draft: RegistrationDraft,
): AccountRegistrationInput {
  return {
    firstNames: draft.firstNames.trim(),
    lastNames: draft.lastNames.trim(),
    email: draft.email.trim().toLocaleLowerCase("es-CO"),
    // CHG-114: sin separadores al final, que el servicio rechaza.
    phone: sanitizePhone(draft.phone) || null,
    department: draft.department.trim(),
    municipality: draft.municipality.trim(),
    requestedAccountType: draft.requestedAccountType,
    organizationName: draft.organizationName.trim() || null,
    organizationRole: draft.organizationRole.trim() || null,
    healthProfession: draft.healthProfession.trim() || null,
    healthLicenseNumber: draft.healthLicenseNumber.trim() || null,
    healthInstitution: draft.healthInstitution.trim() || null,
    password: draft.password,
    termsAccepted: true,
    privacyAccepted: true,
    accuracyConfirmed: true,
  };
}

export function hasStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function AuthHeader({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver a la portada" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backText}>VOLVER</Text>
      </Pressable>
      <View style={styles.headerStatus}>
        <View style={styles.statusDot} />
        <Text style={styles.headerStatusText}>{label}</Text>
      </View>
    </View>
  );
}

function FormSection({ code, title, description, children }: { code: string; title: string; description: string; children: ReactNode }) {
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

function FieldGrid({ children }: { children: ReactNode }) {
  return <View style={styles.fieldGrid}>{children}</View>;
}

function FormField({
  label,
  hint,
  ...inputProps
}: {
  label: string;
  hint?: string;
  value: string;
  maxLength: number;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholder="Escribe aquí"
        placeholderTextColor="#4b586d"
        style={styles.fieldInput}
        {...inputProps}
      />
    </View>
  );
}

function PasswordField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordShell}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          maxLength={128}
          onChangeText={onChangeText}
          placeholder="12 caracteres o más"
          placeholderTextColor="#4b586d"
          secureTextEntry={!visible}
          style={styles.passwordInput}
          value={value}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${visible ? "Ocultar" : "Mostrar"} ${label.toLocaleLowerCase("es-CO")}`}
          onPress={() => setVisible((current) => !current)}
          style={styles.passwordToggle}
        >
          <Text style={styles.passwordToggleText}>{visible ? "OCULTAR" : "MOSTRAR"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    [password.length >= 12 && password.length <= 128, "12–128 caracteres"],
    [/[A-Z]/.test(password), "Una mayúscula"],
    [/[a-z]/.test(password), "Una minúscula"],
    [/\d/.test(password), "Un número"],
    [/[^A-Za-z0-9]/.test(password), "Un símbolo"],
  ] as const;
  return (
    <View style={styles.requirements} accessibilityLabel="Requisitos de contraseña">
      {requirements.map(([met, label]) => (
        <View key={label} style={styles.requirement}>
          <Text style={[styles.requirementMark, met && styles.requirementMet]}>{met ? "✓" : "○"}</Text>
          <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function AccountTypeOption({ value, title, description, selected, onPress }: { value: RequestedAccountType; title: string; description: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.accountType, selected && styles.accountTypeSelected, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioCore} />}</View>
      <Text style={[styles.accountTypeTitle, selected && styles.accountTypeTitleSelected]}>{title}</Text>
      <Text style={styles.accountTypeDescription}>{description}</Text>
      <Text style={styles.accountTypeCode}>{value.toLocaleUpperCase("es-CO")}</Text>
    </Pressable>
  );
}

function ConsentCheckbox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.consent, checked && styles.consentChecked, pressed && styles.pressed]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkmark}>{checked ? "✓" : ""}</Text></View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function PrivacyNotice() {
  return (
    <View style={styles.privacyNotice} accessibilityRole="alert">
      <Text style={styles.privacyIcon}>◇</Text>
      <View style={styles.privacyCopy}>
        <Text style={styles.privacyTitle}>DATOS PRIVADOS · PERFIL NO PÚBLICO</Text>
        <Text style={styles.privacyText}>
          Nombres, contacto y ubicación se usan únicamente para gestionar y verificar tu cuenta. Nunca aparecen en el mapa ni en búsquedas públicas.
        </Text>
      </View>
    </View>
  );
}

function RegistrationConfirmation({ receipt, onBack, onLogin }: { receipt: AccountRegistrationReceipt; onBack: () => void; onLogin: () => void }) {
  return (
    <LinearGradient colors={["#071119", colors.canvas]} style={[styles.root, styles.confirmationRoot]}>
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationIcon}><Text style={styles.confirmationMark}>✓</Text></View>
        <Text style={styles.overline}>REGISTRATION / RECEIVED</Text>
        <Text style={styles.confirmationTitle} accessibilityRole="header">Verifica tu correo</Text>
        <Text style={styles.confirmationText}>
          Enviamos un enlace a {receipt.emailMasked}. La cuenta todavía no tiene sesión ni permisos operativos.
        </Text>
        <View style={styles.receiptStatus}>
          <Text style={styles.receiptLabel}>ESTADO</Text>
          <Text style={styles.receiptValue}>VERIFICACIÓN REQUERIDA</Text>
          <Text style={styles.receiptRole}>ROL ASIGNADO · {receipt.assignedRole.toLocaleUpperCase("es-CO")}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onLogin} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>IR A INICIAR SESIÓN</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>Volver a la portada</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { width: "100%", maxWidth: 1380, minHeight: 76, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingRight: 12 },
  backArrow: { color: colors.cyan, fontSize: 24 },
  backText: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.alive },
  headerStatusText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 8, letterSpacing: 0.7 },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", gap: 16, paddingHorizontal: 24, paddingTop: 58, paddingBottom: 80 },
  contentCompact: { paddingHorizontal: 10, paddingTop: 36 },
  intro: { marginBottom: 10 },
  overline: { marginBottom: 8, color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 62, fontWeight: "800", letterSpacing: -3.2, lineHeight: 66 },
  titleCompact: { fontSize: 40, letterSpacing: -2, lineHeight: 44 },
  introText: { maxWidth: 790, marginTop: 16, color: colors.inkSoft, fontSize: 14, lineHeight: 23 },
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
  // CHG-116: la regla vive en components/fieldGrid.ts; era la
  // misma copiada en los tres formularios y en los tres
  // desbordaba por la derecha.
  fieldGrid: fieldGridLayout.grid,
  field: fieldGridLayout.field,
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldHint: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8 },
  fieldHelp: { color: colors.inkDim, fontSize: 9, lineHeight: 15 },
  fieldInput: { minHeight: 49, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, color: colors.ink, backgroundColor: "rgba(5,9,17,0.72)", fontSize: 12 },
  passwordShell: { minHeight: 49, flexDirection: "row", alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(137,166,207,0.22)", borderRadius: 8, backgroundColor: "rgba(5,9,17,0.72)" },
  passwordInput: { minWidth: 0, flex: 1, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, fontSize: 12 },
  passwordToggle: { alignSelf: "stretch", justifyContent: "center", paddingHorizontal: 12 },
  passwordToggleText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 0.6 },
  requirements: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  requirement: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 20 },
  requirementMark: { color: colors.inkDim, fontSize: 11 },
  requirementMet: { color: colors.alive },
  requirementText: { color: colors.inkDim, fontSize: 8 },
  requirementTextMet: { color: colors.alive },
  accountTypeGrid: { flexDirection: "row", gap: 10 },
  accountTypeGridCompact: { flexDirection: "column" },
  accountType: { minWidth: 0, flex: 1, minHeight: 150, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.panelSoft },
  accountTypeSelected: { borderColor: "rgba(81,229,255,0.55)", backgroundColor: "rgba(81,229,255,0.08)" },
  radio: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.inkDim, borderRadius: 9 },
  radioSelected: { borderColor: colors.cyan },
  radioCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
  accountTypeTitle: { marginTop: 13, color: colors.ink, fontSize: 15, fontWeight: "700" },
  accountTypeTitleSelected: { color: colors.cyan },
  accountTypeDescription: { marginTop: 5, color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
  accountTypeCode: { marginTop: "auto", paddingTop: 10, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.7 },
  roleNotice: { padding: 13, borderLeftWidth: 2, borderLeftColor: colors.missing, backgroundColor: "rgba(255,207,102,0.05)" },
  roleNoticeTitle: { color: colors.missing, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  roleNoticeText: { marginTop: 4, color: "#afa17f", fontSize: 9, lineHeight: 15 },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  consentChecked: { borderColor: "rgba(67,231,173,0.32)", backgroundColor: "rgba(67,231,173,0.05)" },
  checkbox: { width: 22, height: 22, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.inkDim, borderRadius: 5 },
  checkboxChecked: { borderColor: colors.alive, backgroundColor: colors.alive },
  checkmark: { color: "#07101b", fontSize: 13, fontWeight: "900" },
  consentText: { minWidth: 0, flex: 1, color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  errorSummary: { gap: 5, padding: 17, borderWidth: 1, borderColor: "rgba(255,103,136,0.36)", borderRadius: 10, backgroundColor: "rgba(255,103,136,0.08)" },
  errorTitle: { marginBottom: 3, color: colors.reported, fontSize: 13, fontWeight: "800" },
  errorItem: { color: "#e6a3b2", fontSize: 10, lineHeight: 16 },
  submitPanel: { flexDirection: "row", alignItems: "center", gap: 18, padding: 22, borderWidth: 1, borderColor: "rgba(81,229,255,0.25)", borderRadius: 14, backgroundColor: "rgba(81,229,255,0.05)" },
  submitPanelCompact: { flexDirection: "column", alignItems: "stretch" },
  submitCopy: { minWidth: 0, flex: 1 },
  submitTitle: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  submitText: { maxWidth: 680, marginTop: 5, color: colors.inkSoft, fontSize: 10, lineHeight: 17 },
  submitButton: { minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 23, borderRadius: 8, backgroundColor: colors.cyan },
  submitButtonText: { color: "#06101a", fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textAlign: "center" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
  loginLink: { alignSelf: "center", padding: 12 },
  loginLinkText: { color: colors.cyan, fontSize: 11, fontWeight: "700" },
  confirmationRoot: { alignItems: "center", justifyContent: "center", padding: 20 },
  confirmationCard: { width: "100%", maxWidth: 620, alignItems: "center", gap: 12, padding: 36, borderWidth: 1, borderColor: "rgba(67,231,173,0.28)", borderRadius: 16, backgroundColor: colors.panel },
  confirmationIcon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", marginBottom: 5, borderRadius: 31, backgroundColor: colors.alive },
  confirmationMark: { color: "#07101b", fontSize: 28, fontWeight: "900" },
  confirmationTitle: { color: colors.ink, fontSize: 34, fontWeight: "800", letterSpacing: -1.5, textAlign: "center" },
  confirmationText: { color: colors.inkSoft, fontSize: 12, lineHeight: 20, textAlign: "center" },
  receiptStatus: { width: "100%", alignItems: "center", gap: 7, marginVertical: 8, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  receiptLabel: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8, letterSpacing: 0.8 },
  receiptValue: { color: colors.missing, fontFamily: fontFamilies.mono, fontSize: 15, fontWeight: "800", textAlign: "center" },
  receiptRole: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 8, letterSpacing: 0.6 },
  secondaryLink: { padding: 8 },
  secondaryLinkText: { color: colors.inkSoft, fontSize: 10 },
});
