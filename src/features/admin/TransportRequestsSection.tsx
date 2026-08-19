// CHG-174 — Sección «11 · Solicitudes de transporte»: las Muleras y
// Lancheras que eligieron un centro del que esta cuenta es responsable.
// Aceptar significa «acepto que este transporte use mi centro»; NO es
// todavía la aceptación de ruta, que vive en la sección 12.
//
// El backend decide quién puede ver y decidir cada solicitud: aquí solo
// se refleja su respuesta.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  routeAcceptanceDataSource,
  type CenterTransportRequest,
  type RouteAcceptanceDataSource,
} from "../transports/routeAcceptance";
// CHG-179: un solo origen para los nombres de cada medio.
import { transportDriverCopy, transportKindLabel } from "../transports/types";

type SectionStatus = "loading" | "error" | "ready";

const statusLabels: Record<CenterTransportRequest["status"], string> = {
  pending: "PENDIENTE",
  accepted: "ACEPTADA",
  declined: "DECLINADA",
};

const roleLabels: Record<CenterTransportRequest["centerRole"], string> = {
  local: "Centro de acopio local (origen)",
  reception: "Centro de acopio receptor (destino)",
};


function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function TransportRequestsSection({
  dataSource = routeAcceptanceDataSource,
  onMutated,
}: {
  dataSource?: RouteAcceptanceDataSource;
  onMutated?: () => void;
}) {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [items, setItems] = useState<CenterTransportRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<CenterTransportRequest | null>(null);
  // §17: declinar exige confirmación explícita.
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(await dataSource.listRequests());
      setStatus("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar las solicitudes.",
      );
      setStatus("error");
    }
  }, [dataSource]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    request: CenterTransportRequest,
    decision: "accept" | "decline",
  ) => {
    setWorking(true);
    setError(null);
    try {
      await dataSource.decideRequest(request.id, decision);
      setNotice(
        decision === "accept"
          ? `Aceptaste la solicitud de ${transportKindLabel[request.transportKind].toLowerCase()}. La ruta se define en «12 · Aceptación de ruta».`
          : "Declinaste la solicitud: esta ruta no puede continuar con tu centro.",
      );
      setDetail(null);
      setConfirmingDecline(false);
      await load();
      onMutated?.();
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "No fue posible registrar la decisión.",
      );
    } finally {
      setWorking(false);
    }
  };

  const pending = items.filter((item) => item.status === "pending");
  const processed = items.filter((item) => item.status !== "pending");

  return (
    <View style={styles.section} testID="admin-transport-requests-section">
      <View>
        <Text style={styles.overline}>11 · SOLICITUDES DE TRANSPORTE</Text>
        <Text style={styles.title} accessibilityRole="header">
          Aceptación de solicitudes
        </Text>
        <Text style={styles.description}>
          Cada transporte registrado avisa a su centro de origen y a su
          centro de destino. Aceptar aquí significa que autorizas el uso de
          tu centro; la ruta se confirma después, con código, en la sección
          12.
        </Text>
      </View>

      {notice && (
        <Text style={styles.notice} accessibilityRole="alert">
          {notice}
        </Text>
      )}
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {status === "loading" && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.cardMeta}>Cargando solicitudes…</Text>
        </View>
      )}

      {status !== "loading" && (
        <>
          <Text style={styles.groupTitle}>
            PENDIENTES ({pending.length})
          </Text>
          {pending.length === 0 && (
            <Text style={styles.empty}>
              No hay solicitudes pendientes de decisión.
            </Text>
          )}
          {pending.map((item) => (
            <RequestCard
              key={item.id}
              request={item}
              onViewMore={() => {
                setDetail(item);
                setConfirmingDecline(false);
              }}
            />
          ))}

          {processed.length > 0 && (
            <>
              <Text style={styles.groupTitle}>
                YA PROCESADAS ({processed.length})
              </Text>
              {processed.map((item) => (
                <RequestCard
                  key={item.id}
                  request={item}
                  onViewMore={() => {
                    setDetail(item);
                    setConfirmingDecline(false);
                  }}
                />
              ))}
            </>
          )}
        </>
      )}

      <Modal
        visible={detail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard} testID="transport-request-detail">
            {detail && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} accessibilityRole="header">
                    {transportKindLabel[detail.transportKind]}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar detalle"
                    onPress={() => setDetail(null)}
                  >
                    <Text style={styles.close}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalScroll}>
                  <DetailBlock title="TRANSPORTE">
                    <DetailRow
                      label="Sale de"
                      value={`${detail.originCenterName} · ${detail.originMunicipality}`}
                    />
                    <DetailRow
                      label="Llega a"
                      value={`${detail.destinationCenterName} · ${detail.destinationMunicipality}`}
                    />
                    <DetailRow
                      label="Suministros"
                      value={detail.suppliesSummary ?? "Sin detallar"}
                    />
                    <DetailRow
                      label="Registrado"
                      value={formatDate(detail.transportCreatedAt)}
                    />
                    <DetailRow
                      label="Tu centro"
                      value={roleLabels[detail.centerRole]}
                    />
                  </DetailBlock>

                  {/* §12-§13: vista autorizada. Estos datos no se
                      publican en el mapa ni en ninguna ficha pública. */}
                  <DetailBlock
                    title={transportDriverCopy[
                      detail.transportKind
                    ].driverNoun.toUpperCase()}
                  >
                    <DetailRow
                      label="Nombre"
                      value={detail.driverFullName ?? "—"}
                    />
                    <DetailRow
                      label="Documento"
                      value={
                        detail.driverDocumentType && detail.driverDocumentNumber
                          ? `${detail.driverDocumentType} ${detail.driverDocumentNumber}`
                          : "—"
                      }
                    />
                    <DetailRow
                      label="Contacto"
                      value={detail.driverPhone ?? "—"}
                    />
                  </DetailBlock>

                  <DetailBlock title="VEHÍCULO">
                    {detail.transportKind === "mule" ? (
                      <>
                        <DetailRow
                          label="Placa"
                          value={detail.tractorPlate ?? "—"}
                        />
                        <DetailRow
                          label="Placa del tráiler"
                          value={detail.trailerPlate ?? "—"}
                        />
                      </>
                    ) : (
                      <>
                        <DetailRow
                          label="Embarcación"
                          value={detail.vesselName ?? "—"}
                        />
                        <DetailRow
                          label="Tipo"
                          value={detail.vesselType ?? "—"}
                        />
                        <DetailRow
                          label="Matrícula"
                          value={detail.vesselRegistration ?? "—"}
                        />
                      </>
                    )}
                    <DetailRow
                      label="Características"
                      value={detail.vehicleVisibleCharacteristics ?? "—"}
                    />
                  </DetailBlock>

                  {detail.status === "pending" ? (
                    confirmingDecline ? (
                      <View style={styles.confirmBox}>
                        <Text style={styles.confirmText}>
                          ¿Desea declinar esta solicitud de transporte? La
                          ruta no podrá continuar con tu centro.
                        </Text>
                        <View style={styles.actionsRow}>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setConfirmingDecline(false)}
                            style={styles.secondaryButton}
                          >
                            <Text style={styles.secondaryText}>CANCELAR</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Confirmar que se declina la solicitud"
                            disabled={working}
                            onPress={() => void decide(detail, "decline")}
                            style={[styles.primaryButton, styles.dangerButton]}
                            testID="confirm-decline-request"
                          >
                            <Text style={styles.primaryText}>DECLINAR</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.actionsRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Declinar la solicitud"
                          onPress={() => setConfirmingDecline(true)}
                          style={[
                            styles.secondaryButton,
                            styles.dangerBorder,
                          ]}
                          testID="decline-request"
                        >
                          <Text
                            style={[styles.secondaryText, styles.dangerText]}
                          >
                            DECLINAR
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Aceptar la solicitud"
                          disabled={working}
                          onPress={() => void decide(detail, "accept")}
                          style={styles.primaryButton}
                          testID="accept-request"
                        >
                          <Text style={styles.primaryText}>ACEPTAR</Text>
                        </Pressable>
                      </View>
                    )
                  ) : (
                    // §66-§67: una solicitud procesada no vuelve a
                    // ofrecer los botones.
                    <Text style={styles.decidedText}>
                      {statusLabels[detail.status]}
                      {detail.decidedAt
                        ? ` · ${formatDate(detail.decidedAt)}`
                        : ""}
                    </Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RequestCard({
  request,
  onViewMore,
}: {
  request: CenterTransportRequest;
  onViewMore: () => void;
}) {
  return (
    <View style={styles.card} testID={`transport-request-${request.id}`}>
      <Text style={styles.cardTitle}>
        {transportKindLabel[request.transportKind]} · {request.centerName}
      </Text>
      <Text style={styles.cardMeta}>
        {request.originMunicipality} → {request.destinationMunicipality}
      </Text>
      {/* §10: el resumen no expone a quien conduce o pilota; eso vive
          en VER MÁS. */}
      <Text style={styles.cardMeta}>
        {request.transportKind === "mule"
          ? `Placa ${request.tractorPlate ?? "—"}`
          : `Embarcación ${request.vesselName ?? "—"}`}
      </Text>
      <Text style={styles.cardMeta}>
        Solicitada {formatDate(request.requestedAt)}
      </Text>
      <Text style={styles.cardStatus}>{statusLabels[request.status]}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver más de la solicitud de ${request.centerName}`}
        onPress={onViewMore}
        style={styles.secondaryButton}
        testID={`view-more-${request.id}`}
      >
        <Text style={styles.secondaryText}>VER MÁS</Text>
      </Pressable>
    </View>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailBlockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  description: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  notice: { color: colors.cyan, fontSize: 12, lineHeight: 18 },
  error: { color: colors.emergency, fontSize: 12, lineHeight: 18 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupTitle: {
    marginTop: 6,
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  empty: { color: colors.inkDim, fontSize: 12 },
  card: {
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "rgba(13,20,33,0.8)",
  },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  cardMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
  },
  cardStatus: {
    marginTop: 2,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  primaryButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  primaryText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  secondaryButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  secondaryText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  dangerButton: { backgroundColor: colors.emergency },
  dangerBorder: { borderColor: "rgba(255,77,94,0.5)" },
  dangerText: { color: colors.emergency },
  confirmBox: {
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.4)",
    borderRadius: 8,
  },
  confirmText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  decidedText: {
    marginTop: 10,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(3,6,12,0.82)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "86%",
    padding: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 12,
    backgroundColor: "rgba(7,12,22,0.98)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  close: { color: colors.inkSoft, fontSize: 18 },
  modalScroll: { marginTop: 10 },
  detailBlock: { gap: 4, marginBottom: 12 },
  detailBlockTitle: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  detailLabel: {
    minWidth: 110,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
  },
  detailValue: { flexShrink: 1, color: colors.ink, fontSize: 12 },
});
