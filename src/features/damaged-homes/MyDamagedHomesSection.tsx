import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import type { DamagedHomesDataSource, MyDamagedHomesResponse } from "./types";

const countFormatter = new Intl.NumberFormat("es-CO");

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

// CHG-182 — «Mis casitas» dentro de Mi espacio: cada publicación de la
// cuenta con su estado y, sobre todo, cuántos comentarios llegaron que
// su dueña todavía no ha leído. Ese es el aviso que pidió el usuario:
// aquí y por correo. Marcar como leídos es explícito —un botón— para
// que abrir la pestaña de refilón no borre el aviso.
export function MyDamagedHomesSection({
  page,
  dataSource,
  onSeen,
}: {
  page: MyDamagedHomesResponse | null;
  dataSource: DamagedHomesDataSource;
  onSeen?: () => void;
}) {
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markSeen = async (homeId: string) => {
    setWorking(homeId);
    setError(null);
    try {
      await dataSource.markCommentsSeen(homeId);
      onSeen?.();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible marcar los comentarios como leídos.",
      );
    } finally {
      setWorking(null);
    }
  };

  const items = page?.items ?? [];

  return (
    <View style={styles.panel} testID="my-damaged-homes-section">
      <View style={styles.heading}>
        <Text style={styles.overline}>HOGAR / MI CASITA DESTRUIDA</Text>
        <Text style={styles.title} accessibilityRole="header">
          Mis casitas publicadas
        </Text>
        <Text style={styles.lead}>
          Aquí llegan los comentarios de quienes quieren ayudarte. También
          te avisamos por correo cada vez que alguien comenta.
        </Text>
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {items.length === 0 && (
        <Text style={styles.empty} testID="my-damaged-homes-empty">
          Todavía no has publicado ninguna casita.
        </Text>
      )}

      {items.map((home) => (
        <View key={home.id} style={styles.card} testID={`my-home-${home.id}`}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {home.address}
            </Text>
            {home.unreadComments > 0 && (
              <View
                style={styles.unreadBadge}
                testID={`my-home-unread-${home.id}`}
              >
                <Text style={styles.unreadText}>
                  {countFormatter.format(home.unreadComments)}{" "}
                  {home.unreadComments === 1 ? "NUEVO" : "NUEVOS"}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cardMeta}>
            {home.publicCode ? `${home.publicCode} · ` : ""}
            Publicada {formatDate(home.createdAt)}
          </Text>
          <Text style={styles.cardMeta}>
            {home.published
              ? "Visible en el mapa"
              : "Retirada del mapa — la administración la está revisando"}
            {" · "}
            {countFormatter.format(home.commentsCount)}{" "}
            {home.commentsCount === 1 ? "comentario" : "comentarios"}
          </Text>
          {home.unreadComments > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Marcar como leídos los comentarios de ${home.address}`}
              disabled={working === home.id}
              onPress={() => void markSeen(home.id)}
              style={styles.seenButton}
              testID={`my-home-mark-seen-${home.id}`}
            >
              <Text style={styles.seenText}>
                {working === home.id ? "MARCANDO…" : "MARCAR COMO LEÍDOS"}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  heading: { gap: 4 },
  overline: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    letterSpacing: 0.9,
  },
  title: { color: colors.ink, fontSize: font(16), fontWeight: "800" },
  lead: { color: colors.inkSoft, fontSize: font(11), lineHeight: 17 },
  error: { color: colors.reported, fontSize: font(11) },
  empty: { color: colors.inkDim, fontSize: font(11) },
  card: {
    gap: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: colors.panelSoft,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: { flex: 1, color: colors.ink, fontSize: font(12), fontWeight: "700" },
  cardMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
  },
  unreadBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,103,136,0.16)",
    borderWidth: 1,
    borderColor: colors.reported,
  },
  unreadText: {
    color: colors.reported,
    fontFamily: fontFamilies.mono,
    fontSize: font(8),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  seenButton: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
  },
  seenText: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
});
