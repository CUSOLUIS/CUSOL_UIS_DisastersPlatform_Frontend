// CHG-138 — Sección «08 · Solicitudes» de la consola (renumerada por
// CHG-165): la
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
import type {
  AdminDataSource,
  AdminHelpRequest,
  AdminHelpRequestVolunteer,
} from "./types";

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
  // CHG-148: voluntarios anónimos por solicitud, cargados a demanda.
  const [volunteers, setVolunteers] = useState<
    Record<string, AdminHelpRequestVolunteer[]>
  >({});
  const [volunteersBusy, setVolunteersBusy] = useState<string | null>(null);
  const [volunteersError, setVolunteersError] = useState<string | null>(null);

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

  const toggleVolunteers = async (id: string) => {
    setVolunteersError(null);
    if (volunteers[id]) {
      setVolunteers((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    setVolunteersBusy(id);
    try {
      const page = await dataSource.listHelpRequestVolunteers(id);
      setVolunteers((current) => ({ ...current, [id]: page.items }));
    } catch (error: unknown) {
      setVolunteersError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar los voluntarios.",
      );
    } finally {
      setVolunteersBusy(null);
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
              (item.volunteersCount > 0
                ? ` · ${item.volunteersCount} voluntario${item.volunteersCount === 1 ? "" : "s"} anónimo${item.volunteersCount === 1 ? "" : "s"}`
                : "") +
              (item.notificationRadiusKm
                ? ` · avisa a ${item.notificationRadiusKm} km`
                : "") +
              (item.hasPhoto ? " · con foto" : "")}
          </Text>

          {/* CHG-148: la PII de los voluntarios anónimos, solo aquí. */}
          {item.volunteersCount > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${volunteers[item.id] ? "Ocultar" : "Ver"} los voluntarios de ${item.publicCode}`}
              disabled={volunteersBusy === item.id}
              onPress={() => void toggleVolunteers(item.id)}
              style={styles.volunteersToggle}
            >
              {volunteersBusy === item.id ? (
                <ActivityIndicator color={colors.cyan} />
              ) : (
                <Text style={styles.volunteersToggleText}>
                  {volunteers[item.id]
                    ? "OCULTAR VOLUNTARIOS"
                    : `VER ${item.volunteersCount} VOLUNTARIO${item.volunteersCount === 1 ? "" : "S"} (PRIVADO)`}
                </Text>
              )}
            </Pressable>
          )}
          {volunteers[item.id] && (
            <View style={styles.volunteersList}>
              {volunteersError && (
                <Text style={styles.volunteersError}>{volunteersError}</Text>
              )}
              {volunteers[item.id].map((volunteer) => (
                <VolunteerRow key={volunteer.id} volunteer={volunteer} />
              ))}
            </View>
          )}

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

// CHG-148 — Una fila de voluntario anónimo con su PII descifrada. Este
// dato solo se ve aquí, en la consola del super_admin.
function VolunteerRow({
  volunteer,
}: {
  volunteer: AdminHelpRequestVolunteer;
}) {
  const contact = [volunteer.phone, volunteer.email]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.volunteerRow} testID={`volunteer-${volunteer.id}`}>
      <Text style={styles.volunteerName}>{volunteer.name}</Text>
      {contact.length > 0 && (
        <Text style={styles.volunteerContact}>{contact}</Text>
      )}
      {volunteer.hasPhoto && (
        <Text style={styles.volunteerPhotoTag}>adjuntó foto</Text>
      )}
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
  // CHG-148: acceso y lista de voluntarios (PII, solo super_admin).
  volunteersToggle: { alignSelf: "flex-start", paddingVertical: 4 },
  volunteersToggleText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  volunteersList: {
    gap: 6,
    marginTop: 2,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(81,229,255,0.3)",
  },
  volunteersError: { color: colors.emergency, fontSize: 10 },
  volunteerRow: { gap: 1 },
  volunteerName: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  volunteerContact: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
  },
  volunteerPhotoTag: { color: colors.inkDim, fontSize: 9 },
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
