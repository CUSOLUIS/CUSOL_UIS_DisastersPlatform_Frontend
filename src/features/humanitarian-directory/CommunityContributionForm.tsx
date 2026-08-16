import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { communityTextIssue } from "./textQuality";
import {
  ALLOWED_PHOTO_HELP,
  ALLOWED_PHOTO_MIME_TYPES,
  validateAndMergePhotos,
} from "../missing-persons/photoValidation";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import type {
  CommunityContributionDataSource,
  CommunityContributionReceipt,
  ContributionActorKind,
  HumanitarianDirectoryItem,
} from "./types";

export type PickContributionPhotos = () => Promise<SelectedPhoto[]>;

const defaultPickPhotos: PickContributionPhotos = async () => {
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

export function CommunityContributionForm({
  dataSource,
  onBack,
  pickPhotos = defaultPickPhotos,
  target,
}: {
  dataSource: CommunityContributionDataSource;
  onBack: () => void;
  pickPhotos?: PickContributionPhotos;
  target: HumanitarianDirectoryItem;
}) {
  const isPerson = target.kind === "missing_person";
  const [actorKind, setActorKind] = useState<ContributionActorKind | null>(null);
  const [actorError, setActorError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"found" | "deceased">("found");
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [truthConfirmed, setTruthConfirmed] = useState(false);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectingPhotos, setSelectingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<CommunityContributionReceipt | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void dataSource
      .getActorKind(controller.signal)
      .then(setActorKind)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setActorError(
          error instanceof Error
            ? error.message
            : "No fue posible determinar la modalidad del aporte.",
        );
      });
    return () => controller.abort();
  }, [dataSource]);

  // CHG-071/CHG-077: el máximo real es 3 en todos los aportes (el
  // contrato y la validación de fotos comparten este límite).
  const maximumPhotos = 3;

  const selectPhotos = async () => {
    setSelectingPhotos(true);
    try {
      const incoming = await pickPhotos();
      if (photos.length + incoming.length > maximumPhotos) {
        setPhotoErrors([
          `Puedes adjuntar máximo ${maximumPhotos} fotografías en este aporte.`,
        ]);
        return;
      }
      const result = validateAndMergePhotos(photos, incoming);
      setPhotos(result.photos);
      setPhotoErrors(result.errors);
    } finally {
      setSelectingPhotos(false);
    }
  };

  const validate = (): string[] => {
    const validationErrors: string[] = [];
    const minimumLength = isPerson ? 30 : 20;
    if (description.trim().length < minimumLength) {
      validationErrors.push(
        `Describe la situación con al menos ${minimumLength} caracteres.`,
      );
    } else {
      // CHG-107: la longitud la cumplían treinta letras iguales.
      const issue = communityTextIssue(description);
      if (issue) {
        validationErrors.push(issue);
      }
    }
    if (isPerson && photos.length === 0) {
      validationErrors.push("Adjunta al menos una fotografía como evidencia privada.");
    }
    if (!isPerson && rating === 0) {
      validationErrors.push("Selecciona entre una y cinco estrellas.");
    }
    if (!truthConfirmed || !reviewAcknowledged) {
      validationErrors.push("Confirma la veracidad y que el aporte será revisado.");
    }
    if (actorKind === null) {
      validationErrors.push("Espera mientras se determina la modalidad del aporte.");
    }
    return validationErrors;
  };

  const submit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (validationErrors.length > 0 || actorKind === null) return;

    setSubmitting(true);
    try {
      const contribution = isPerson
        ? {
            kind: "missing_person_status" as const,
            targetId: target.id,
            claimedOutcome: outcome,
            evidenceDescription: description.trim(),
            photos,
            truthConfirmed: true as const,
            reviewAcknowledged: true as const,
          }
        : {
            kind: "aid_location_rating" as const,
            targetId: target.id,
            rating,
            evidenceDescription: description.trim(),
            photos,
            truthConfirmed: true as const,
            reviewAcknowledged: true as const,
          };

      setReceipt(await dataSource.submit(contribution, actorKind));
    } catch (error: unknown) {
      setErrors([
        error instanceof Error
          ? error.message
          : "No fue posible enviar el aporte para revisión.",
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <View style={styles.receipt} accessibilityRole="alert">
        <Text style={styles.overline}>APORTE / RECIBIDO</Text>
        <Text style={styles.receiptTitle} accessibilityRole="header">
          Novedad recibida
        </Text>
        <Text style={styles.receiptText}>
          La información y las pruebas se recibieron de forma privada. El
          estado público cambia cuando 5 o más personas reportan lo mismo, de
          inmediato si reporta alguien del sector salud, o cuando el equipo lo
          verifica. Tu aporte ya es visible en las novedades de la persona.
        </Text>
        <View style={styles.receiptMeta}>
          <Text style={styles.receiptCode}>{receipt.id}</Text>
          <Text style={styles.actorBadge}>
            {receipt.actorKind === "authenticated"
              ? "APORTE CON CUENTA"
              : "APORTE PÚBLICO"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a las coincidencias"
          onPress={onBack}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>VOLVER A RESULTADOS</Text>
        </Pressable>
      </View>
    );
  }

  const targetName =
    target.kind === "missing_person" ? target.displayName : target.name;

  return (
    <View style={styles.form} accessibilityLabel={`Aportar evidencia sobre ${targetName}`}>
      <View style={styles.formHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a las coincidencias"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← RESULTADOS</Text>
        </Pressable>
        <View style={styles.formHeaderCopy}>
          <Text style={styles.overline}>
            {isPerson ? "NOVEDAD DE PERSONA" : "VALORACIÓN DE VERACIDAD"}
          </Text>
          <Text style={styles.formTitle} accessibilityRole="header">
            {targetName}
          </Text>
        </View>
        <View style={styles.actorState}>
          {actorKind === null && !actorError ? (
            <ActivityIndicator size="small" color={colors.cyan} />
          ) : (
            <Text style={styles.actorText}>
              {actorError
                ? "MODALIDAD NO DISPONIBLE"
                : actorKind === "authenticated"
                  ? "CON SESIÓN"
                  : "APORTE PÚBLICO"}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.safetyNotice} accessibilityRole="alert">
        <Text style={styles.safetyTitle}>
          {isPerson
            ? "VERIFICACIÓN COMUNITARIA · FOTOS PRIVADAS"
            : "EVIDENCIA PRIVADA · REVISIÓN HUMANA"}
        </Text>
        <Text style={styles.safetyText}>
          {isPerson
            ? "Tu texto será visible en las novedades de la persona; las fotos quedan privadas. Si 5 o más personas reportan lo mismo, o si reporta el sector salud, el estado público cambia."
            : "Las estrellas expresan una experiencia ciudadana; no certifican oficialmente el lugar y solo afectan el promedio tras revisión."}
        </Text>
      </View>

      {isPerson ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>¿Qué situación observaste?</Text>
          <View style={styles.segmented}>
            {(["found", "deceased"] as const).map((value) => {
              const selected = outcome === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={value === "found" ? "Persona encontrada" : "Persona fallecida"}
                  accessibilityState={{ selected }}
                  onPress={() => setOutcome(value)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {value === "found" ? "ENCONTRADA" : "FALLECIDA"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Puntúa la veracidad del lugar</Text>
          <StarInput value={rating} onChange={setRating} />
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Describe la situación</Text>
        <TextInput
          accessibilityLabel="Descripción de la evidencia"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={isPerson ? 2000 : 1200}
          placeholder={
            isPerson
              ? "Explica cuándo, dónde y qué observaste. Evita datos innecesarios."
              : "Cuenta qué encontraste abierto, disponible o inconsistente."
          }
          placeholderTextColor={colors.inkDim}
          style={styles.textArea}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>
          {description.trim().length} / mínimo {isPerson ? 30 : 20}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.photoHeader}>
          <View style={styles.photoCopy}>
            <Text style={styles.fieldLabel}>
              Fotografías {isPerson ? "obligatorias" : "opcionales"}
            </Text>
            <Text style={styles.photoHelp}>
              {ALLOWED_PHOTO_HELP} Máximo {maximumPhotos}, 10 MiB por archivo.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adjuntar fotografías de evidencia"
            disabled={selectingPhotos}
            onPress={() => void selectPhotos()}
            style={styles.secondaryButton}
          >
            {selectingPhotos ? (
              <ActivityIndicator size="small" color={colors.cyan} />
            ) : (
              <Text style={styles.secondaryButtonText}>ADJUNTAR FOTOS</Text>
            )}
          </Pressable>
        </View>
        {photoErrors.map((error) => (
          <Text key={error} style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ))}
        {photos.map((photo) => (
          <View key={`${photo.uri}-${photo.name}`} style={styles.photoRow}>
            <Text style={styles.photoName}>{photo.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar fotografía ${photo.name}`}
              onPress={() => setPhotos((current) => current.filter((item) => item !== photo))}
              style={styles.removePhoto}
            >
              <Text style={styles.removePhotoText}>QUITAR</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Consent
        checked={truthConfirmed}
        label="Confirmo que este aporte es veraz según mi conocimiento."
        onPress={() => setTruthConfirmed((current) => !current)}
      />
      <Consent
        checked={reviewAcknowledged}
        label="Entiendo que mi aporte será visible en las novedades públicas de este registro."
        onPress={() => setReviewAcknowledged((current) => !current)}
      />

      {actorError && <Text style={styles.errorText}>{actorError}</Text>}
      {errors.length > 0 && (
        <View style={styles.errorSummary} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Revisa el aporte</Text>
          {errors.map((error) => <Text key={error} style={styles.errorText}>• {error}</Text>)}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar aporte para revisión"
        disabled={submitting || actorKind === null}
        onPress={() => void submit()}
        style={[styles.primaryButton, (submitting || actorKind === null) && styles.disabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#07101b" />
        ) : (
          <Text style={styles.primaryButtonText}>ENVIAR PARA REVISIÓN →</Text>
        )}
      </Pressable>
    </View>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${value} de 5 estrellas seleccionadas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityLabel={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
          accessibilityState={{ selected: value === star }}
          onPress={() => onChange(star)}
          style={styles.starButton}
        >
          <Text style={[styles.star, star <= value && styles.starFilled]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Consent({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.consent, checked && styles.consentChecked]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.checkmark}>{checked ? "✓" : ""}</Text>
      </View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  formHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  formHeaderCopy: { minWidth: 220, flex: 1 },
  overline: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 1.1 },
  formTitle: { marginTop: 4, color: colors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  backButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  backText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800" },
  actorState: { minHeight: 34, justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 6 },
  actorText: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 0.6 },
  safetyNotice: { gap: 5, padding: 14, borderLeftWidth: 3, borderLeftColor: colors.reported, backgroundColor: "rgba(255,103,136,0.06)" },
  safetyTitle: { color: colors.reported, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  safetyText: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  fieldGroup: { gap: 9 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { minHeight: 42, justifyContent: "center", paddingHorizontal: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  segmentSelected: { borderColor: colors.cyan, backgroundColor: "rgba(81,229,255,0.10)" },
  segmentText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800" },
  segmentTextSelected: { color: colors.cyan },
  textArea: { minHeight: 120, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: "rgba(5,9,17,0.78)", color: colors.ink, fontSize: 13, lineHeight: 20 },
  counter: { alignSelf: "flex-end", color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7 },
  photoHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  photoCopy: { minWidth: 220, flex: 1, gap: 4 },
  photoHelp: { color: colors.inkDim, fontSize: 9, lineHeight: 15 },
  photoRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  photoName: { minWidth: 0, flex: 1, color: colors.inkSoft, fontSize: 10 },
  removePhoto: { padding: 8 },
  removePhotoText: { color: colors.reported, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" },
  consent: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  consentChecked: { borderColor: "rgba(67,231,173,0.36)", backgroundColor: "rgba(67,231,173,0.05)" },
  checkbox: { width: 21, height: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 4 },
  checkboxChecked: { borderColor: colors.alive, backgroundColor: "rgba(67,231,173,0.13)" },
  checkmark: { color: colors.alive, fontSize: 13, fontWeight: "900" },
  consentText: { flex: 1, color: colors.inkSoft, fontSize: 10, lineHeight: 16 },
  stars: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  starButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  star: { color: "#465368", fontSize: 30 },
  starFilled: { color: colors.missing },
  secondaryButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 13, borderWidth: 1, borderColor: colors.cyan, borderRadius: 7 },
  secondaryButtonText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900" },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 8, backgroundColor: colors.cyan },
  primaryButtonText: { color: "#07101b", fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  disabled: { opacity: 0.45 },
  errorSummary: { gap: 5, padding: 13, borderWidth: 1, borderColor: "rgba(255,103,136,0.32)", borderRadius: 8 },
  errorTitle: { color: colors.reported, fontSize: 11, fontWeight: "800" },
  errorText: { color: colors.reported, fontSize: 10, lineHeight: 16 },
  receipt: { gap: 18, alignItems: "stretch", paddingVertical: 28 },
  receiptTitle: { color: colors.alive, fontSize: 38, fontWeight: "800", letterSpacing: -1.4 },
  receiptText: { maxWidth: 680, color: colors.inkSoft, fontSize: 13, lineHeight: 21 },
  receiptMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  receiptCode: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 9 },
  actorBadge: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(67,231,173,0.32)", borderRadius: 5 },
});
