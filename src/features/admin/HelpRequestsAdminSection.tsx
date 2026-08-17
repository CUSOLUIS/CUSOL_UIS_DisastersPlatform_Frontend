// CHG-138 — Sección «07 · Solicitudes» de la consola: la
// superadministración ve TODO lo que llega de «Necesitamos ayuda»
// (activas y expiradas) y puede eliminar una a una o vaciar todas.
// Toda eliminación pasa por una confirmación explícita en dos pasos;
// el backend audita cada operación y limpia las fotografías.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import type { AdminDataSource, AdminHelpRequest } from "./types";

type SectionStatus = "loading" | "error" | "ready";

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

export function HelpRequestsAdminSection({
  dataSource,
}: {
  dataSource: AdminDataSource;
}) {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [items, setItems] = useState<AdminHelpRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const page = await dataSource.listHelpRequests();
      setItems(page.items);
      setTotal(page.total);
      setStatus("ready");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible consultar las solicitudes.",
      );
      setStatus("error");
    }
  }, [dataSource]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteOne = async (id: string, publicCode: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await dataSource.deleteHelpRequest(id);
      setNotice(`Solicitud ${publicCode} eliminada.`);
      setConfirmingId(null);
      await load();
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `No fue posible eliminar: ${error.message}`
          : "No fue posible eliminar la solicitud.",
      );
    } finally {
      setBusy(false);
    }
  };

  const purgeAll = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const receipt = await dataSource.purgeHelpRequests();
      setNotice(
        `Se eliminaron ${receipt.deleted} solicitudes; la base quedó vacía.`,
      );
      setConfirmingPurge(false);
      await load();
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `No fue posible vaciar: ${error.message}`
          : "No fue posible vaciar las solicitudes.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <View style={styles.inlineState} testID="admin-help-requests-loading">
        <ActivityIndicator color={colors.cyan} />
        <Text style={styles.inlineStateText}>
          Consultando solicitudes de ayuda…
        </Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.inlineError} accessibilityRole="alert">
        <Text style={styles.inlineErrorTitle}>
          Solicitudes no disponibles
        </Text>
        <Text style={styles.inlineErrorText}>{errorMessage}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>REINTENTAR</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="admin-help-requests-section">
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          {`SOLICITUDES «NECESITAMOS AYUDA» · ${total} EN BASE`}
        </Text>
        {total > 0 && !confirmingPurge && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vaciar todas las solicitudes"
            disabled={busy}
            onPress={() => setConfirmingPurge(true)}
            style={styles.dangerButton}
          >
            <Text style={styles.dangerButtonText}>VACIAR TODAS</Text>
          </Pressable>
        )}
      </View>

      {confirmingPurge && (
        <View style={styles.confirmPanel} accessibilityRole="alert">
          <Text style={styles.confirmTitle}>
            {`¿Eliminar las ${total} solicitudes y dejar la base limpia?`}
          </Text>
          <Text style={styles.confirmText}>
            Esta operación borra también las expiradas y sus fotografías,
            y no se puede deshacer. Quedará registrada en la auditoría.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmingPurge(false)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>CANCELAR</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirmar el vaciado de todas las solicitudes"
              disabled={busy}
              onPress={() => void purgeAll()}
              style={styles.dangerButton}
            >
              {busy ? (
                <ActivityIndicator color={colors.emergency} />
              ) : (
                <Text style={styles.dangerButtonText}>SÍ, VACIAR TODO</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {notice && (
        <Text style={styles.notice} accessibilityRole="alert">
          {notice}
        </Text>
      )}

      {items.length === 0 && (
        <Text style={styles.emptyText}>
          No hay solicitudes en la base: todo está limpio.
        </Text>
      )}

      {items.map((item) => (
        <View
          key={item.id}
          style={[styles.card, item.expired && styles.cardExpired]}
          testID={`admin-help-request-${item.publicCode}`}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.code}>{item.publicCode}</Text>
            <Text
              style={[
                styles.stateBadge,
                item.expired ? styles.stateExpired : styles.stateActive,
              ]}
            >
              {item.expired ? "EXPIRADA" : "ACTIVA"}
            </Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.meta}>{item.address}</Text>
          <Text style={styles.meta}>
            {`Creada ${formatStamp(item.createdAt)} · vence ${formatStamp(item.expiresAt)} · ${item.attendersCount} atendiendo` +
              (item.notificationRadiusKm
                ? ` · avisa a ${item.notificationRadiusKm} km`
                : "") +
              (item.hasPhoto ? " · con foto" : "")}
          </Text>

          {confirmingId === item.id ? (
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmingId(null)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>CANCELAR</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Confirmar la eliminación de ${item.publicCode}`}
                disabled={busy}
                onPress={() => void deleteOne(item.id, item.publicCode)}
                style={styles.dangerButton}
              >
                {busy ? (
                  <ActivityIndicator color={colors.emergency} />
                ) : (
                  <Text style={styles.dangerButtonText}>SÍ, ELIMINAR</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar la solicitud ${item.publicCode}`}
              disabled={busy}
              onPress={() => setConfirmingId(item.id)}
              style={styles.deleteLink}
            >
              <Text style={styles.dangerButtonText}>ELIMINAR</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  card: {
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "rgba(13,19,32,0.6)",
  },
  cardExpired: { opacity: 0.75 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  code: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  stateBadge: {
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    overflow: "hidden",
  },
  stateActive: {
    color: colors.emergency,
    borderColor: "rgba(255,77,94,0.5)",
    backgroundColor: "rgba(255,77,94,0.10)",
  },
  stateExpired: {
    color: colors.inkDim,
    borderColor: colors.line,
  },
  description: { color: colors.ink, fontSize: 12, lineHeight: 17 },
  meta: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  deleteLink: { alignSelf: "flex-start", paddingVertical: 4 },
  dangerButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.5)",
    borderRadius: 7,
    backgroundColor: "rgba(255,77,94,0.08)",
  },
  dangerButtonText: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  secondaryButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  secondaryButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
  },
  confirmPanel: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.4)",
    borderRadius: 9,
    backgroundColor: "rgba(255,77,94,0.06)",
  },
  confirmTitle: { color: colors.emergency, fontSize: 12, fontWeight: "800" },
  confirmText: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  notice: {
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  emptyText: {
    paddingVertical: 20,
    color: colors.inkDim,
    fontSize: 10,
    textAlign: "center",
  },
  inlineState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  inlineStateText: { color: colors.inkSoft, fontSize: 10 },
  inlineError: {
    alignItems: "flex-start",
    gap: 9,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255,103,136,0.34)",
    borderRadius: 9,
    backgroundColor: "rgba(255,103,136,0.07)",
  },
  inlineErrorTitle: {
    color: colors.reported,
    fontSize: 12,
    fontWeight: "800",
  },
  inlineErrorText: { color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
});
