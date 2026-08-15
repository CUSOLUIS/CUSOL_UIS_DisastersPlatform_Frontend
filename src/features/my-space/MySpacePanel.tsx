// CHG-069 — "Mi espacio": desde el desplegable bajo el nombre de la
// sesión, la persona ve sus reportes (y las novedades de estado que
// OTRAS personas aportaron a sus casos) y puede activar alertas de que
// se necesitan voluntarios en un punto: dirección resuelta con el
// servicio de mapa (o su ubicación actual), descripción y marcador
// público inmediato en el mapa operativo.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  searchAddressCandidates,
  type AddressCandidate,
} from "../missing-persons/geocoding";
import { requestVisitorLocation } from "../operational-map/visitorLocation";
import { mySpaceDataSource } from "./dataSource";
import type {
  MySpaceDataSource,
  MyReportsPage,
  MyReportSummary,
  VolunteerAlertPage,
} from "./types";

const REPORT_KIND_LABELS: Record<MyReportSummary["kind"], string> = {
  missing_person_report: "Persona desaparecida",
  unverified_building_report: "Edificio sin verificar",
};

const STATUS_LABELS: Record<string, string> = {
  under_review: "En revisión",
  needs_information: "Requiere información",
  accepted: "Aceptado",
  rejected: "Rechazado",
  archived: "Archivado",
  verified: "Verificado",
  unverified: "Sin verificar",
};

const OUTCOME_LABELS: Record<string, string> = {
  found: "Encontrada",
  deceased: "Fallecida",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

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

function messageOf(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "No fue posible completar la operación.";
}

export function MySpacePanel({
  visible,
  onClose,
  dataSource = mySpaceDataSource,
  geocode = searchAddressCandidates,
  locate = requestVisitorLocation,
}: {
  visible: boolean;
  onClose: () => void;
  dataSource?: MySpaceDataSource;
  geocode?: (query: string) => Promise<AddressCandidate[]>;
  locate?: () => Promise<{ latitude: number; longitude: number }>;
}) {
  const [section, setSection] = useState<"reports" | "volunteers">("reports");
  const [reports, setReports] = useState<MyReportsPage | null>(null);
  const [alerts, setAlerts] = useState<VolunteerAlertPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsPage, alertsPage] = await Promise.all([
        dataSource.getMyReports(),
        dataSource.listVolunteerAlerts(),
      ]);
      setReports(reportsPage);
      setAlerts(alertsPage);
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="my-space-panel">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.overline}>CUENTA / PANEL PERSONAL</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Mi espacio
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar Mi espacio"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.tabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "reports" }}
              accessibilityLabel="Mis reportes"
              onPress={() => setSection("reports")}
              style={[styles.tab, section === "reports" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  section === "reports" && styles.tabTextActive,
                ]}
              >
                MIS REPORTES
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: section === "volunteers" }}
              accessibilityLabel="Voluntarios"
              onPress={() => setSection("volunteers")}
              style={[styles.tab, section === "volunteers" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  section === "volunteers" && styles.tabTextActive,
                ]}
              >
                VOLUNTARIOS
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar Mi espacio"
                  onPress={() => void load()}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>REINTENTAR</Text>
                </Pressable>
              </View>
            )}
            {loading && !reports && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.cyan} />
                <Text style={styles.loadingText}>Cargando tu espacio…</Text>
              </View>
            )}

            {section === "reports" && reports && (
              <MyReportsSection page={reports} />
            )}
            {section === "volunteers" && (
              <VolunteersSection
                alerts={alerts}
                dataSource={dataSource}
                geocode={geocode}
                locate={locate}
                onChanged={() => void load()}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MyReportsSection({ page }: { page: MyReportsPage }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLead}>
        Tus reportes y su estado. Si otras personas añaden una novedad de
        estado sobre un caso tuyo, aparece aquí.
      </Text>
      {page.items.map((report) => (
        <View key={report.id} style={styles.itemCard}>
          <View style={styles.itemTop}>
            <Text style={styles.itemKind}>
              {REPORT_KIND_LABELS[report.kind]}
            </Text>
            <Text style={styles.itemStatus}>{statusLabel(report.status)}</Text>
          </View>
          <Text style={styles.itemTitle}>{report.title}</Text>
          <Text style={styles.itemMeta}>
            {report.referenceCode} · {formatDate(report.receivedAt)}
          </Text>
          {report.novelties.length > 0 && (
            <View style={styles.noveltyBox}>
              <Text style={styles.noveltyTitle}>
                NOVEDADES DE OTRAS PERSONAS ({report.novelties.length})
              </Text>
              {report.novelties.map((novelty, index) => (
                <Text key={index} style={styles.noveltyText}>
                  Reportada como{" "}
                  {OUTCOME_LABELS[novelty.claimedOutcome] ??
                    novelty.claimedOutcome}{" "}
                  · {statusLabel(novelty.moderationStatus)} ·{" "}
                  {formatDate(novelty.receivedAt)}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
      {page.items.length === 0 && (
        <Text style={styles.emptyText}>
          Todavía no has enviado reportes con esta cuenta.
        </Text>
      )}
    </View>
  );
}

function VolunteersSection({
  alerts,
  dataSource,
  geocode,
  locate,
  onChanged,
}: {
  alerts: VolunteerAlertPage | null;
  dataSource: MySpaceDataSource;
  geocode: (query: string) => Promise<AddressCandidate[]>;
  locate: () => Promise<{ latitude: number; longitude: number }>;
  onChanged: () => void;
}) {
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const [candidates, setCandidates] = useState<AddressCandidate[]>([]);
  const [locating, setLocating] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findAddress = async () => {
    setLocating(true);
    setError(null);
    setCandidates([]);
    try {
      const found = await geocode(address);
      if (found.length === 0) {
        setError(
          "No se encontró la dirección. Ajusta el texto (incluye municipio) e intenta de nuevo.",
        );
      } else {
        setCandidates(found);
      }
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLocating(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const located = await locate();
      setCoordinates({
        latitude: located.latitude,
        longitude: located.longitude,
        label: "Tu ubicación actual",
      });
      setCandidates([]);
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (description.trim().length < 10) {
      setError("Describe la necesidad con al menos 10 caracteres.");
      return;
    }
    if (address.trim().length < 5) {
      setError("Escribe la dirección del punto donde se necesita gente.");
      return;
    }
    if (!coordinates) {
      setError(
        "Ubica el punto primero: busca la dirección en el mapa o usa tu ubicación actual.",
      );
      return;
    }
    setWorking(true);
    try {
      await dataSource.createVolunteerAlert({
        description: description.trim(),
        address: address.trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      setNotice(
        "Alerta activada: el punto ya aparece en el mapa operativo como “Se necesitan voluntarios”.",
      );
      setDescription("");
      setAddress("");
      setCoordinates(null);
      onChanged();
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setWorking(false);
    }
  };

  const resolve = async (id: string) => {
    setError(null);
    try {
      await dataSource.resolveVolunteerAlert(id);
      onChanged();
    } catch (caught: unknown) {
      setError(messageOf(caught));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLead}>
        Activa una alerta pública de que se necesita gente en un punto:
        aparece de inmediato en el mapa operativo para que quienes puedan
        ayudar acudan.
      </Text>

      <Text style={styles.fieldLabel}>DIRECCIÓN DEL PUNTO</Text>
      <TextInput
        accessibilityLabel="Dirección donde se necesitan voluntarios"
        value={address}
        onChangeText={(value) => {
          setAddress(value);
          setCoordinates(null);
        }}
        placeholder="Calle, número y municipio"
        placeholderTextColor="#536074"
        style={styles.input}
      />
      <View style={styles.locateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar dirección en el mapa"
          disabled={locating}
          onPress={() => void findAddress()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {locating ? "BUSCANDO…" : "UBICAR EN EL MAPA"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usar mi ubicación actual"
          disabled={locating}
          onPress={() => void useMyLocation()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>MI UBICACIÓN</Text>
        </Pressable>
      </View>

      {candidates.length > 0 && (
        <View style={styles.candidateList}>
          {candidates.map((candidate, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${candidate.label}`}
              onPress={() => {
                setCoordinates({
                  latitude: candidate.latitude,
                  longitude: candidate.longitude,
                  label: candidate.label,
                });
                setCandidates([]);
              }}
              style={styles.candidateItem}
            >
              <Text style={styles.candidateText}>{candidate.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {coordinates && (
        <View style={styles.coordinateBox} testID="volunteer-coordinates">
          <Text style={styles.coordinateText}>
            Punto elegido: {coordinates.label} (
            {coordinates.latitude.toFixed(5)},{" "}
            {coordinates.longitude.toFixed(5)})
          </Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>DESCRIPCIÓN DE LA NECESIDAD</Text>
      <TextInput
        accessibilityLabel="Descripción de la necesidad de voluntarios"
        value={description}
        onChangeText={setDescription}
        placeholder="Qué se necesita hacer, cuánta gente y desde cuándo"
        placeholderTextColor="#536074"
        multiline
        style={[styles.input, styles.inputMultiline]}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
      {notice && <Text style={styles.noticeText}>{notice}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Activar alerta de voluntarios"
        disabled={working}
        onPress={() => void submit()}
        style={styles.primaryButton}
      >
        {working ? (
          <ActivityIndicator size="small" color={colors.canvas} />
        ) : (
          <Text style={styles.primaryButtonText}>
            ACTIVAR ALERTA DE VOLUNTARIOS
          </Text>
        )}
      </Pressable>

      <Text style={styles.subheading}>TUS ALERTAS</Text>
      {alerts?.items.map((alert) => (
        <View key={alert.id} style={styles.itemCard}>
          <View style={styles.itemTop}>
            <Text style={styles.itemKind}>
              {alert.status === "active" ? "ACTIVA" : "RESUELTA"}
            </Text>
            <Text style={styles.itemMeta}>{formatDate(alert.createdAt)}</Text>
          </View>
          <Text style={styles.itemTitle}>{alert.address}</Text>
          <Text style={styles.itemBody}>{alert.description}</Text>
          {alert.status === "active" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Marcar resuelta la alerta de ${alert.address}`}
              onPress={() => void resolve(alert.id)}
              style={styles.resolveButton}
            >
              <Text style={styles.resolveButtonText}>
                YA NO SE NECESITA · MARCAR RESUELTA
              </Text>
            </Pressable>
          )}
        </View>
      ))}
      {alerts?.items.length === 0 && (
        <Text style={styles.emptyText}>No has activado alertas todavía.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 6, 12, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
  },
  closeText: { color: colors.ink, fontSize: 20, lineHeight: 22 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  tabActive: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81, 229, 255, 0.08)",
  },
  tabText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  tabTextActive: { color: colors.cyan },
  scrollContent: { gap: 12, paddingBottom: 8 },
  section: { gap: 10 },
  sectionLead: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  itemCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.panelSoft,
    padding: 14,
    gap: 6,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  itemKind: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  itemStatus: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  itemTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  itemBody: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  itemMeta: { color: colors.inkDim, fontSize: 11 },
  noveltyBox: {
    marginTop: 4,
    borderLeftWidth: 2,
    borderLeftColor: colors.missing,
    paddingLeft: 10,
    gap: 3,
  },
  noveltyTitle: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  noveltyText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  emptyText: { color: colors.inkDim, fontSize: 13 },
  fieldLabel: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "rgba(5, 9, 17, 0.65)",
  },
  inputMultiline: { minHeight: 84, textAlignVertical: "top" },
  locateRow: { flexDirection: "row", gap: 8 },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  candidateList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  candidateItem: {
    padding: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  candidateText: { color: colors.ink, fontSize: 13 },
  coordinateBox: {
    borderWidth: 1,
    borderColor: "rgba(67, 231, 173, 0.4)",
    backgroundColor: "rgba(67, 231, 173, 0.07)",
    borderRadius: 10,
    padding: 10,
  },
  coordinateText: { color: colors.alive, fontSize: 12, lineHeight: 18 },
  errorBox: { gap: 8 },
  errorText: { color: colors.reported, fontSize: 13, lineHeight: 19 },
  noticeText: { color: colors.alive, fontSize: 13, lineHeight: 19 },
  retryButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: colors.inkSoft, fontSize: 13 },
  primaryButton: {
    marginTop: 4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.cyan,
  },
  primaryButtonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  subheading: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  resolveButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(67, 231, 173, 0.5)",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resolveButtonText: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
