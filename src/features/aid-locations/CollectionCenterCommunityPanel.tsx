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
  | { status: "ready"; items: AidLocationComment[]; total: number };

type OpenForm = "none" | "comment" | "report";

export function CollectionCenterCommunityPanel({
  locationId,
  dataSource = aidLocationCommunityDataSource,
}: {
  locationId: string;
  dataSource?: AidLocationCommunityDataSource;
}) {
  const [listState, setListState] = useState<ListState>({
    status: "loading",
  });
  const [openForm, setOpenForm] = useState<OpenForm>("none");
  const [commentDraft, setCommentDraft] = useState("");
  const [reportCategory, setReportCategory] =
    useState<AidLocationReportCategory | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const page = await dataSource.listComments(locationId);
      setListState({
        status: "ready",
        items: page.items,
        total: page.total,
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
    if (trimmed.length < COMMENT_MIN_LENGTH) {
      issues.push(
        `El comentario necesita al menos ${COMMENT_MIN_LENGTH} caracteres.`,
      );
    } else {
      const quality = communityTextIssue(trimmed, 2);
      if (quality) issues.push(quality);
    }
    setFormErrors(issues);
    if (issues.length > 0) return;
    setBusy(true);
    try {
      await dataSource.createComment(locationId, trimmed);
      setCommentDraft("");
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
          accessibilityLabel="Comentar este centro de acopio"
          onPress={() => switchForm("comment")}
          style={styles.commentButton}
          testID="center-comment-button"
        >
          <Text style={styles.commentButtonText}>COMENTAR</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Denunciar este centro de acopio"
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

      <Text style={styles.sectionTitle} accessibilityRole="header">
        COMENTARIOS
      </Text>

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
              <Text style={styles.commentAuthor}>
                {comment.authorDisplayName ?? "Anónimo"}
              </Text>
              <Text style={styles.commentDate}>
                {formatStamp(comment.createdAt)}
              </Text>
              <Text style={styles.commentContent}>{comment.content}</Text>
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
  sectionTitle: {
    marginTop: 6,
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: font(12),
    fontWeight: "800",
    letterSpacing: 1,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { color: colors.inkSoft, fontSize: font(12) },
  empty: { color: colors.inkDim, fontSize: font(12), lineHeight: 18 },
  comment: {
    gap: 2,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
