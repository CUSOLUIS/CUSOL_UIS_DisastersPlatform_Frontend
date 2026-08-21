// CHG-193 — Quién atiende MI solicitud. Vista privada de la dueña: el
// backend solo responde si la solicitud es suya, y de cada persona
// llega lo que esa persona consintió compartir (CHG-193 cambió
// DEC-148-01 hacia adelante; quien atendió bajo la promesa anterior
// figura sin un solo dato). El correo nunca llega aquí.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { resolvePublicMediaUrl } from "../media/publicMediaUrl";
import { helpRequestsDataSource } from "./dataSource";
import type {
  HelpRequestAttender,
  HelpRequestAttendersPage,
  HelpRequestsDataSource,
} from "./types";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const countFormatter = new Intl.NumberFormat("es-CO");

function formatJoined(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

export function kindLabel(attender: HelpRequestAttender): string {
  return attender.kind === "account"
    ? "ATIENDE CON CUENTA"
    : "SE OFRECIÓ SIN CUENTA";
}

// Quien no compartió sus datos igual cuenta: va en camino. Lo que no
// se puede es inventarle un nombre.
export function displayName(attender: HelpRequestAttender): string {
  if (attender.name && attender.name.trim().length > 0) {
    return attender.name;
  }
  return "Persona sin datos compartidos";
}

export function HelpRequestAttendersScreen({
  requestId,
  address,
  onBack,
  dataSource = helpRequestsDataSource,
}: {
  requestId: string | null;
  address?: string;
  onBack: () => void;
  dataSource?: HelpRequestsDataSource;
}) {
  const [page, setPage] = useState<HelpRequestAttendersPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HelpRequestAttender | null>(null);

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      setPage(await dataSource.listAttenders(requestId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible consultar quién atiende tu solicitud.",
      );
    } finally {
      setLoading(false);
    }
  }, [dataSource, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = page?.items ?? [];
  const photoUrl = selected ? resolvePublicMediaUrl(selected.photoUrl) : null;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a mi espacio"
              onPress={onBack}
              style={styles.backButton}
            >
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backText}>VOLVER A MI ESPACIO</Text>
            </Pressable>

            <View style={styles.card}>
              <Text style={styles.overline}>COMMUNITY / SOS</Text>
              <Text style={styles.title} accessibilityRole="header">
                Quién atiende tu solicitud
              </Text>
              {address ? (
                <Text style={styles.address}>{address}</Text>
              ) : null}
              <Text style={styles.lead}>
                Cada persona decide si comparte su nombre y su teléfono
                contigo. Quien no lo hizo igual va en camino: aparece en
                la lista, sin datos.
              </Text>
            </View>

            {requestId === null && (
              <Text style={styles.errorText} accessibilityRole="alert">
                No se indicó de qué solicitud. Vuelve a «Mi espacio» y
                entra otra vez.
              </Text>
            )}

            {loading && page === null && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.emergency} />
                <Text style={styles.loadingText}>
                  Consultando quién atiende…
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.card}>
                <Text style={styles.errorText} accessibilityRole="alert">
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar la consulta"
                  onPress={() => void load()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>REINTENTAR</Text>
                </Pressable>
              </View>
            )}

            {!loading && !error && items.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.emptyText}>
                  Todavía nadie ha marcado que atiende tu solicitud. En
                  cuanto alguien lo haga, aparecerá aquí.
                </Text>
              </View>
            )}

            {items.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.countLine}>
                  {items.length === 1
                    ? "1 PERSONA ATENDIENDO"
                    : `${countFormatter.format(items.length)} PERSONAS ATENDIENDO`}
                </Text>
                {items.map((attender) => (
                  <Pressable
                    key={attender.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver los detalles de ${displayName(attender)}`}
                    onPress={() => setSelected(attender)}
                    testID={`attender-row-${attender.id}`}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName}>
                        {displayName(attender)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {kindLabel(attender)} · {formatJoined(attender.joinedAt)}
                      </Text>
                    </View>
                    <Text style={styles.rowChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard} testID="attender-detail">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar los detalles"
              onPress={() => setSelected(null)}
              style={styles.detailClose}
            >
              <Text style={styles.detailCloseText}>✕</Text>
            </Pressable>
            {selected && (
              <ScrollView contentContainerStyle={styles.detailBody}>
                {photoUrl && (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.detailPhoto}
                    resizeMode="cover"
                    accessibilityLabel={`Fotografía de ${displayName(selected)}`}
                  />
                )}
                <Text style={styles.detailName} accessibilityRole="header">
                  {displayName(selected)}
                </Text>
                <Text style={styles.detailMeta}>
                  {kindLabel(selected)}
                </Text>
                <Text style={styles.detailMeta}>
                  SE OFRECIÓ EL {formatJoined(selected.joinedAt).toUpperCase()}
                </Text>
                {selected.phone ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Llamar a ${displayName(selected)}`}
                    onPress={() => {
                      void Linking.openURL(`tel:${selected.phone}`);
                    }}
                    style={({ pressed }) => [
                      styles.callButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.callButtonText}>
                      LLAMAR · {selected.phone}
                    </Text>
                  </Pressable>
                ) : null}
                {!selected.sharesContact && (
                  <Text style={styles.detailNote}>
                    Esta persona no compartió sus datos: se ofreció antes
                    de que la plataforma se lo preguntara, o no lo
                    aceptó. Su decisión se respeta.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16 },
  content: {
    width: "100%",
    maxWidth: contentMaxWidth,
    alignSelf: "center",
    gap: 14,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  backArrow: { color: colors.cyan, fontSize: font(13), fontWeight: "800" },
  backText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  card: {
    gap: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  overline: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: { color: colors.ink, fontSize: font(20), fontWeight: "800" },
  address: { color: colors.ink, fontSize: font(13), fontWeight: "700" },
  lead: { color: colors.inkSoft, fontSize: font(12), lineHeight: 18 },
  countLine: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { color: colors.ink, fontSize: font(14), fontWeight: "700" },
  rowMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(10),
    letterSpacing: 0.5,
  },
  rowChevron: { color: colors.cyan, fontSize: font(20), fontWeight: "800" },
  pressed: { opacity: 0.75 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  loadingText: { color: colors.inkSoft, fontSize: font(11) },
  emptyText: { color: colors.inkDim, fontSize: font(12), lineHeight: 18 },
  errorText: { color: colors.emergency, fontSize: font(12), lineHeight: 18 },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  secondaryButtonText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  detailBackdrop: {
    flex: 1,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3, 8, 16, 0.82)",
  },
  detailCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "86%",
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  detailClose: {
    alignSelf: "flex-end",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  detailCloseText: { color: colors.ink, fontSize: font(14), fontWeight: "800" },
  detailBody: { gap: 10, paddingTop: 6 },
  detailPhoto: {
    width: "100%",
    height: 190,
    borderRadius: 10,
    backgroundColor: colors.canvas,
  },
  detailName: { color: colors.ink, fontSize: font(18), fontWeight: "800" },
  detailMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(10),
    letterSpacing: 0.5,
  },
  callButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  callButtonText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  detailNote: { color: colors.inkSoft, fontSize: font(12), lineHeight: 18 },
});
