// CHG-165 — Sección «06 · Verificaciones» de la consola: los Centros
// de Acopio Local pendientes de verificación (aprobar/rechazar) y los
// deshabilitados por denuncias (reactivar, con confirmación y reinicio
// del ciclo). Solo super_admin; el backend audita cada decisión y es
// quien aplica las reglas — aquí solo se refleja su estado.

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
import type {
  AdminCenterVerification,
  AdminDataSource,
} from "./types";

type SectionStatus = "loading" | "error" | "ready";

const verificationLabels: Record<
  AdminCenterVerification["verificationStatus"],
  string
> = {
  unverified: "Sin verificar",
  under_review: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
};

const operationalLabels: Record<
  AdminCenterVerification["operationalStatus"],
  string
> = {
  open: "ABIERTO",
  closed: "CERRADO",
  at_capacity: "CAPACIDAD COMPLETA",
  under_observation: "EN OBSERVACIÓN",
  inactive: "DESHABILITADO",
};

// CHG-168: la bandeja trae locales y receptores; cada ficha nombra su
// tipo real (un kind desconocido cae al genérico sin romper la vista).
const centerKindLabels: Record<string, string> = {
  collection_center: "Centro de Acopio Local",
  receiver_center: "Centro de acopio receptor",
};

function centerKindLabel(kind: string): string {
  return centerKindLabels[kind] ?? "Centro de acopio";
}

function formatStamp(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return iso;
  }
  return value.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CenterVerificationsSection({
  dataSource,
  onMutated,
}: {
  dataSource: AdminDataSource;
  onMutated?: () => void;
}) {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [pending, setPending] = useState<AdminCenterVerification[]>([]);
  const [disabled, setDisabled] = useState<AdminCenterVerification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Decisión en dos pasos: qué acción está esperando confirmación.
  const [confirming, setConfirming] = useState<{
    id: string;
    action: "approve" | "reject" | "reactivate";
  } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const page = await dataSource.listCenterVerifications();
      setPending(page.pending);
      setDisabled(page.disabled);
      setStatus("ready");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible consultar las verificaciones.",
      );
      setStatus("error");
    }
  }, [dataSource]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (center: AdminCenterVerification) => {
    if (!confirming) return;
    setBusy(true);
    setNotice(null);
    try {
      if (confirming.action === "reactivate") {
        await dataSource.reactivateCenter(center.id);
        setNotice(
          `${center.name} fue reactivado; el ciclo de denuncias vuelve a 0 y el centro vuelve al mapa.`,
        );
      } else {
        await dataSource.decideCenterVerification(center.id, {
          decision: confirming.action,
          reason: reason.trim() || undefined,
        });
        setNotice(
          confirming.action === "approve"
            ? `${center.name} quedó VERIFICADO; el público lo verá como «Verificado».`
            : `${center.name} quedó RECHAZADO; el público lo seguirá viendo como «Sin verificar».`,
        );
      }
      setConfirming(null);
      setReason("");
      await load();
      onMutated?.();
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible completar la acción.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section} testID="admin-center-verifications-section">
      <View>
        <Text style={styles.overline}>06 · VERIFICACIONES</Text>
        {/* CHG-168: la bandeja cubre acopios locales y receptores. */}
        <Text style={styles.title} accessibilityRole="header">
          Centros de acopio (local y receptor)
        </Text>
        <Text style={styles.description}>
          La creación de un centro no implica aprobación: nace «Sin
          verificar» hasta que la superadministración decida. Aquí también
          se reactivan los centros deshabilitados por denuncias.
        </Text>
      </View>

      {notice && (
        <Text style={styles.notice} accessibilityRole="alert">
          {notice}
        </Text>
      )}

      {status === "loading" && (
        <View style={styles.loading} testID="admin-center-verifications-loading">
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loadingText}>Consultando centros…</Text>
        </View>
      )}

      {status === "error" && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar verificaciones"
            onPress={() => void load()}
            style={styles.retry}
          >
            <Text style={styles.retryText}>REINTENTAR</Text>
          </Pressable>
        </View>
      )}

      {status === "ready" && (
        <>
          <Text style={styles.groupTitle}>
            PENDIENTES DE VERIFICACIÓN · {pending.length}
          </Text>
          {pending.length === 0 && (
            <Text style={styles.empty}>
              No hay solicitudes de verificación pendientes.
            </Text>
          )}
          {pending.map((center) => (
            <CenterCard key={center.id} center={center}>
              {confirming?.id === center.id &&
              confirming.action !== "reactivate" ? (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>
                    {confirming.action === "approve"
                      ? `¿Aprobar la verificación de ${center.name}? El público lo verá como «Verificado».`
                      : `¿Rechazar la verificación de ${center.name}? Seguirá mostrándose «Sin verificar».`}
                  </Text>
                  <TextInput
                    accessibilityLabel="Motivo de la decisión"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Motivo (opcional, queda auditado)"
                    placeholderTextColor="#536074"
                    style={styles.reasonInput}
                  />
                  <View style={styles.actionsRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar decisión"
                      disabled={busy}
                      onPress={() => {
                        setConfirming(null);
                        setReason("");
                      }}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryText}>CANCELAR</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Confirmar ${confirming.action === "approve" ? "aprobación" : "rechazo"} de ${center.name}`}
                      disabled={busy}
                      onPress={() => void runAction(center)}
                      style={[
                        styles.primaryButton,
                        confirming.action === "reject" && styles.dangerButton,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator color="#07101b" />
                      ) : (
                        <Text style={styles.primaryText}>
                          {confirming.action === "approve"
                            ? "CONFIRMAR APROBACIÓN"
                            : "CONFIRMAR RECHAZO"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.actionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Aprobar verificación de ${center.name}`}
                    disabled={busy}
                    onPress={() =>
                      setConfirming({ id: center.id, action: "approve" })
                    }
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryText}>APROBAR</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Rechazar verificación de ${center.name}`}
                    disabled={busy}
                    onPress={() =>
                      setConfirming({ id: center.id, action: "reject" })
                    }
                    style={[styles.secondaryButton, styles.dangerBorder]}
                  >
                    <Text style={[styles.secondaryText, styles.dangerText]}>
                      RECHAZAR
                    </Text>
                  </Pressable>
                </View>
              )}
            </CenterCard>
          ))}

          <Text style={styles.groupTitle}>
            DESHABILITADOS POR DENUNCIAS · {disabled.length}
          </Text>
          {disabled.length === 0 && (
            <Text style={styles.empty}>
              Ningún centro está deshabilitado por denuncias.
            </Text>
          )}
          {disabled.map((center) => (
            <CenterCard key={center.id} center={center}>
              {confirming?.id === center.id &&
              confirming.action === "reactivate" ? (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>
                    ¿Desea reactivar este {centerKindLabel(center.kind)}?
                    Al reactivarlo, el contador de denuncias
                    correspondiente al ciclo actual será reiniciado (el
                    histórico se conserva) y el centro volverá al mapa.
                  </Text>
                  <View style={styles.actionsRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar reactivación"
                      disabled={busy}
                      onPress={() => setConfirming(null)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryText}>CANCELAR</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Confirmar reactivación de ${center.name}`}
                      disabled={busy}
                      onPress={() => void runAction(center)}
                      style={styles.primaryButton}
                      testID={`admin-center-reactivate-confirm-${center.id}`}
                    >
                      {busy ? (
                        <ActivityIndicator color="#07101b" />
                      ) : (
                        <Text style={styles.primaryText}>REACTIVAR</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reactivar centro ${center.name}`}
                  disabled={busy}
                  onPress={() =>
                    setConfirming({ id: center.id, action: "reactivate" })
                  }
                  style={[styles.primaryButton, styles.reactivateButton]}
                >
                  <Text style={styles.primaryText}>REACTIVAR CENTRO</Text>
                </Pressable>
              )}
            </CenterCard>
          ))}
        </>
      )}
    </View>
  );
}

function CenterCard({
  center,
  children,
}: {
  center: AdminCenterVerification;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card} testID={`admin-center-${center.id}`}>
      <Text style={styles.cardTitle}>{center.name}</Text>
      <Text style={styles.cardMeta}>
        {centerKindLabel(center.kind)} · {center.municipality},{" "}
        {center.department}
      </Text>
      <Text style={styles.cardMeta}>{center.locationLabel}</Text>
      {center.latitude !== null && center.longitude !== null && (
        <Text style={styles.cardMeta}>
          {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
        </Text>
      )}
      {center.description && (
        <Text style={styles.cardDescription}>{center.description}</Text>
      )}
      <Text style={styles.cardMeta}>
        {center.createdByAccountId
          ? `Registrado con cuenta ${center.createdByAccountId.slice(0, 8)}…`
          : "Registro anónimo"}{" "}
        · {formatStamp(center.createdAt)}
      </Text>
      <Text style={styles.cardStatus}>
        {verificationLabels[center.verificationStatus]} ·{" "}
        {operationalLabels[center.operationalStatus]} ·{" "}
        {center.activeReportsCount} denuncia(s) del ciclo
        {center.disabledAt
          ? ` · Deshabilitado ${formatStamp(center.disabledAt)}`
          : ""}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  description: {
    maxWidth: 720,
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  notice: {
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(94,240,153,0.4)",
    borderRadius: 8,
    color: colors.alive,
    fontSize: 12,
    lineHeight: 18,
  },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  loadingText: { color: colors.inkSoft, fontSize: 12 },
  errorBox: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.4)",
    borderRadius: 8,
  },
  errorText: { color: colors.inkSoft, fontSize: 12 },
  retry: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 6,
  },
  retryText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
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
  cardDescription: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
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
  reactivateButton: { alignSelf: "flex-start", marginTop: 6 },
  primaryText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  secondaryButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.3)",
    borderRadius: 8,
  },
  confirmText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  reasonInput: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    color: colors.ink,
    fontSize: 12,
  },
});
