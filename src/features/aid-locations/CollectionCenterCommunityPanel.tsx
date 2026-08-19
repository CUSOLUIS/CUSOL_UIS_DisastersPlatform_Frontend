import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import {
  useSessionAccount,
  type SessionAccountSource,
} from "../auth/useSessionAccount";
import { communityTextIssue } from "../humanitarian-directory/textQuality";
import {
  aidLocationCommunityDataSource,
  aidLocationReportCategories,
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  REPORT_MAX_LENGTH,
  REPORT_MIN_LENGTH,
  type AidLocationComment,
  type AidLocationCommunityDataSource,
  type AidLocationReportCategory,
} from "./communityDataSource";
import { ratingSummaryLine, starGlyphs } from "./ratingStars";

// CHG-165 — En la vista completa de un Centro de Acopio Local
// (/detalle-punto, CHG-164): COMENTAR y DENUNCIAR para cualquiera
// (anónimo o con cuenta), y la sección COMENTARIOS con los más
// recientes primero. Las reglas viven en el backend; aquí solo se
// valida lo mismo antes de enviar para dar mensajes inmediatos.

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function formatStamp(iso: string): string {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? iso : dateFormatter.format(value);
}

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      items: AidLocationComment[];
      total: number;
      // CHG-166: promedio de estrellas junto al título COMENTARIOS.
      ratingAverage: number | null;
      ratingCount: number;
    };

// CHG-166: valores del selector de estrellas del formulario.
const ratingChoices = [1, 2, 3, 4, 5] as const;

type OpenForm = "none" | "comment" | "report";

export function CollectionCenterCommunityPanel({
  locationId,
  dataSource = aidLocationCommunityDataSource,
  sessionSource,
  // CHG-176: el panel sirve para cualquier cosa comentable; solo cambia
  // cómo se la nombra al lector de pantalla.
  targetLabel = "este centro de acopio",
}: {
  locationId: string;
  dataSource?: AidLocationCommunityDataSource;
  // CHG-167: inyectable en pruebas; por defecto consulta /auth/me.
  sessionSource?: SessionAccountSource;
  targetLabel?: string;
}) {
  const [listState, setListState] = useState<ListState>({
    status: "loading",
  });
  const [openForm, setOpenForm] = useState<OpenForm>("none");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentRating, setCommentRating] = useState<number | null>(null);
  const [reportCategory, setReportCategory] =
    useState<AidLocationReportCategory | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // CHG-167: sesión para mostrar el borrado solo a super_admin (la
  // barrera real es el backend); el borrado confirma en dos pasos.
  const session = useSessionAccount(sessionSource);
  const isAdmin =
    session.status === "authenticated" &&
    session.account.assignedRole === "super_admin";
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const page = await dataSource.listComments(locationId);
      setListState({
        status: "ready",
        items: page.items,
        total: page.total,
        ratingAverage: page.ratingAverage ?? null,
        ratingCount: page.ratingCount ?? 0,
      });
    } catch (error: unknown) {
      setListState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los comentarios.",
      });
    }
  }, [dataSource, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchForm = (form: OpenForm) => {
    setOpenForm((current) => (current === form ? "none" : form));
    setFormErrors([]);
    setNotice(null);
  };

  const publishComment = async () => {
    const trimmed = commentDraft.trim();
    const issues: string[] = [];
    // CHG-166: la calificación es obligatoria, como en el backend.
    if (commentRating === null) {
      issues.push("Elige una calificación de 1 a 5 estrellas.");
    }
    if (trimmed.length < COMMENT_MIN_LENGTH) {
      issues.push(
        `El comentario necesita al menos ${COMMENT_MIN_LENGTH} caracteres.`,
      );
    } else {
      const quality = communityTextIssue(trimmed, 2);
      if (quality) issues.push(quality);
    }
    setFormErrors(issues);
    if (issues.length > 0 || commentRating === null) return;
    setBusy(true);
    try {
      await dataSource.createComment(locationId, trimmed, commentRating);
      setCommentDraft("");
      setCommentRating(null);
      setOpenForm("none");
      setNotice("Tu comentario quedó publicado.");
      await load();
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible publicar el comentario.",
      ]);
    } finally {
      setBusy(false);
    }
  };

  // CHG-167: primer toque arma la confirmación; el segundo borra.
  const deleteComment = async (commentId: string) => {
    if (armedDeleteId !== commentId) {
      setArmedDeleteId(commentId);
      return;
    }
    setArmedDeleteId(null);
    setBusy(true);
    try {
      await dataSource.adminDeleteComment(locationId, commentId);
      setNotice("El comentario fue borrado.");
      await load();
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible borrar el comentario.",
      ]);
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    const trimmed = reportReason.trim();
    const issues: string[] = [];
    if (!reportCategory) {
      issues.push("Elige el motivo de la denuncia.");
    }
    if (trimmed.length < REPORT_MIN_LENGTH) {
      issues.push("Describe la situación que estás denunciando.");
    }
    setFormErrors(issues);
    if (issues.length > 0 || !reportCategory) return;
    setBusy(true);
    try {
      const receipt = await dataSource.reportCenter(locationId, {
        category: reportCategory,
        reason: trimmed,
      });
      setReportCategory(null);
      setReportReason("");
      setOpenForm("none");
      setNotice(
        receipt.disabled
          ? "Tu denuncia quedó registrada. El centro alcanzó el umbral de denuncias y quedó deshabilitado: saldrá del mapa hasta que el equipo lo revise."
          : "Tu denuncia quedó registrada. Con suficientes denuncias el punto queda en observación y lo revisa el equipo.",
      );
      await load();
    } catch (error: unknown) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : "No fue posible registrar la denuncia.",
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel} testID="collection-center-community-panel">
      {/* §32: las acciones van después de la información del centro. */}
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comentar ${targetLabel}`}
          onPress={() => switchForm("comment")}
          style={styles.commentButton}
          testID="center-comment-button"
        >
          <Text style={styles.commentButtonText}>COMENTAR</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Denunciar ${targetLabel}`}
          onPress={() => switchForm("report")}
          style={styles.reportButton}
          testID="center-report-button"
        >
          <Text style={styles.reportButtonText}>DENUNCIAR</Text>
        </Pressable>
      </View>

      {notice && (
        <Text
          style={styles.notice}
          accessibilityRole="alert"
          testID="center-community-notice"
        >
          {notice}
        </Text>
      )}

      {formErrors.length > 0 && (
        <View accessibilityRole="alert" style={styles.errorSummary}>
          {formErrors.map((message) => (
            <Text key={message} style={styles.errorText}>
              {message}
            </Text>
          ))}
        </View>
      )}

      {openForm === "comment" && (
        <View style={styles.form} testID="center-comment-form">
          {/* CHG-166: calificación 1-5 obligatoria antes de publicar. */}
          <Text style={styles.formLabel}>Calificación</Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Calificación del centro de 1 a 5 estrellas"
            style={styles.starsRow}
          >
            {ratingChoices.map((value) => {
              const selected = commentRating !== null && value <= commentRating;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} de 5 estrellas`}
                  accessibilityState={{ selected: commentRating === value }}
                  onPress={() => setCommentRating(value)}
                  style={styles.starButton}
                  testID={`center-comment-star-${value}`}
                >
                  <Text
                    style={[styles.starGlyph, selected && styles.starSelected]}
                  >
                    {selected ? "★" : "☆"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.formLabel}>Comentario</Text>
          <TextInput
            accessibilityLabel="Texto del comentario"
            multiline
            maxLength={COMMENT_MAX_LENGTH}
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="Cuenta cómo está funcionando este punto"
            placeholderTextColor="#536074"
            style={styles.textArea}
          />
          <View style={styles.formActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar comentario"
              disabled={busy}
              onPress={() => switchForm("none")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>CANCELAR</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publicar comentario"
              disabled={busy}
              onPress={() => void publishComment()}
              style={styles.primaryButton}
              testID="center-comment-publish"
            >
              {busy ? (
                <ActivityIndicator color="#07101b" />
              ) : (
                <Text style={styles.primaryText}>PUBLICAR</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {openForm === "report" && (
        <View style={styles.form} testID="center-report-form">
          <Text style={styles.formLabel}>Motivo de la denuncia</Text>
          <View style={styles.categoryRow}>
            {aidLocationReportCategories.map((option) => {
              const selected = reportCategory === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  onPress={() => setReportCategory(option.value)}
                  style={[
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selected && styles.categoryTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.formLabel}>Descripción</Text>
          <TextInput
            accessibilityLabel="Descripción de la denuncia"
            multiline
            maxLength={REPORT_MAX_LENGTH}
            value={reportReason}
            onChangeText={setReportReason}
            placeholder="Describe qué está pasando con este punto"
            placeholderTextColor="#536074"
            style={styles.textArea}
          />
          <Text style={styles.privacyHint}>
            La descripción es privada: solo la ve el equipo que modera.
          </Text>
          <View style={styles.formActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar denuncia"
              disabled={busy}
              onPress={() => switchForm("none")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>CANCELAR</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar denuncia"
              disabled={busy}
              onPress={() => void sendReport()}
              style={[styles.primaryButton, styles.dangerButton]}
              testID="center-report-send"
            >
              {busy ? (
                <ActivityIndicator color="#07101b" />
              ) : (
                <Text style={styles.primaryText}>ENVIAR DENUNCIA</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          COMENTARIOS
        </Text>
        {/* CHG-166: promedio de estrellas de los comentarios. */}
        {listState.status === "ready" && (
          <Text
            style={styles.ratingSummary}
            testID="center-comments-average"
          >
            {ratingSummaryLine(listState.ratingAverage, listState.ratingCount)}
          </Text>
        )}
      </View>

      {listState.status === "loading" && (
        <View style={styles.loadingRow} testID="center-comments-loading">
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loadingText}>Cargando comentarios…</Text>
        </View>
      )}

      {listState.status === "error" && (
        <View accessibilityRole="alert" style={styles.errorSummary}>
          <Text style={styles.errorText}>{listState.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar comentarios"
            onPress={() => void load()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>REINTENTAR</Text>
          </Pressable>
        </View>
      )}

      {listState.status === "ready" && (
        <>
          {listState.items.length === 0 && (
            <Text style={styles.empty}>
              Aún no hay comentarios; sé la primera persona en contar cómo
              funciona este punto.
            </Text>
          )}
          {listState.items.map((comment) => (
            <View
              key={comment.id}
              style={styles.comment}
              testID={`center-comment-${comment.id}`}
            >
              <View style={styles.commentBody}>
                <Text style={styles.commentAuthor}>
                  {comment.authorDisplayName ?? "Anónimo"}
                </Text>
                {/* CHG-166: comentarios previos a la mejora no tienen
                    estrellas y no muestran nada. */}
                {comment.rating !== null && (
                  <Text
                    style={styles.commentStars}
                    accessibilityLabel={`Calificación: ${comment.rating} de 5 estrellas`}
                    testID={`center-comment-rating-${comment.id}`}
                  >
                    {starGlyphs(comment.rating)}
                  </Text>
                )}
                <Text style={styles.commentDate}>
                  {formatStamp(comment.createdAt)}
                </Text>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
              {/* CHG-167: solo super_admin ve el borrado, a la derecha
                  del comentario y con confirmación en dos pasos. */}
              {isAdmin && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    armedDeleteId === comment.id
                      ? "Confirmar el borrado del comentario"
                      : "Borrar este comentario"
                  }
                  disabled={busy}
                  onPress={() => void deleteComment(comment.id)}
                  style={[
                    styles.deleteButton,
                    armedDeleteId === comment.id &&
                      styles.deleteButtonArmed,
                  ]}
                  testID={`center-comment-delete-${comment.id}`}
                >
                  <Text style={styles.deleteText}>
                    {armedDeleteId === comment.id
                      ? "¿CONFIRMAR?"
                      : "BORRAR"}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 12,
    backgroundColor: "rgba(7,12,22,0.94)",
  },
  // §33: en pantallas angostas los botones se apilan sin desbordar.
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  commentButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  commentButtonText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  reportButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.emergency,
    borderRadius: 8,
  },
  reportButtonText: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  notice: {
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(94,240,153,0.4)",
    borderRadius: 8,
    color: colors.alive,
    fontSize: font(12),
    lineHeight: 18,
  },
  errorSummary: {
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.4)",
    borderRadius: 8,
  },
  errorText: { color: colors.inkSoft, fontSize: font(12), lineHeight: 18 },
  form: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "rgba(13,20,33,0.8)",
  },
  formLabel: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  textArea: {
    minHeight: 88,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ink,
    fontSize: font(13),
    textAlignVertical: "top",
  },
  privacyHint: { color: colors.inkDim, fontSize: font(11), lineHeight: 16 },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  primaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  dangerButton: { backgroundColor: colors.emergency },
  primaryText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  secondaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  secondaryText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: "rgba(13,20,33,0.8)",
  },
  categoryChipSelected: {
    borderColor: colors.emergency,
    backgroundColor: "rgba(255,77,94,0.10)",
  },
  categoryText: { color: colors.inkSoft, fontSize: font(12) },
  categoryTextSelected: { color: colors.emergency, fontWeight: "700" },
  sectionHeader: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: font(12),
    fontWeight: "800",
    letterSpacing: 1,
  },
  ratingSummary: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: font(12),
  },
  starsRow: { flexDirection: "row", gap: 4 },
  starButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  starGlyph: { color: colors.inkDim, fontSize: font(22) },
  starSelected: { color: colors.missing },
  commentStars: {
    color: colors.missing,
    fontSize: font(12),
    letterSpacing: 1,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { color: colors.inkSoft, fontSize: font(12) },
  empty: { color: colors.inkDim, fontSize: font(12), lineHeight: 18 },
  comment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  commentBody: { flex: 1, gap: 2 },
  deleteButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.emergency,
    borderRadius: 7,
  },
  deleteButtonArmed: { backgroundColor: "rgba(255,77,94,0.14)" },
  deleteText: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: font(10),
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  commentAuthor: { color: colors.ink, fontSize: font(13), fontWeight: "800" },
  commentDate: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
  },
  commentContent: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: font(13),
    lineHeight: 19,
  },
});
