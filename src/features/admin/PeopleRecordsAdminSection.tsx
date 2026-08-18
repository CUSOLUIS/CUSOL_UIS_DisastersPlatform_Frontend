// CHG-154 — Sección «Personas» de la consola: la superadministración
// ve los registros de personas (desaparecidas, confirmadas vivas y los
// demás estados), los busca con filtros, los EDITA y los OCULTA uno a
// uno. Ocultar NO borra: el registro desaparece de toda la plataforma
// (tabla, contadores, mapa, buscador y ficha) y queda en la vista de
// ocultos, que alimentará el futuro apartado de borrado definitivo.

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
  AdminDataSource,
  AdminPeopleVisibility,
  AdminPersonRecord,
  AdminPersonStatus,
  AdminPersonUpdateInput,
} from "./types";

const PAGE_SIZE = 25;

export const PERSON_STATUS_LABELS: Record<AdminPersonStatus, string> = {
  missing: "Desaparecida",
  reported_deceased: "Reporte de fallecimiento",
  confirmed_alive: "Confirmada viva",
  confirmed_deceased: "Fallecimiento confirmado",
};

const STATUS_TONES: Record<AdminPersonStatus, string> = {
  missing: colors.missing,
  reported_deceased: colors.reported,
  confirmed_alive: colors.alive,
  confirmed_deceased: colors.inkDim,
};

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

export function PeopleRecordsAdminSection({
  dataSource,
  onMutated,
}: {
  dataSource: AdminDataSource;
  onMutated?: () => void;
}) {
  const [query, setQuery] = useState("");
  // El pedido pone el foco en desaparecidos y confirmados vivos; los
  // chips permiten ampliar a los otros estados.
  const [statuses, setStatuses] = useState<AdminPersonStatus[]>([
    "missing",
    "confirmed_alive",
  ]);
  const [visibility, setVisibility] =
    useState<AdminPeopleVisibility>("visible");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<AdminPersonRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingHideId, setConfirmingHideId] = useState<string | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<AdminPersonUpdateInput>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const page = await dataSource.listPeople({
        q: query.trim().length >= 2 ? query.trim() : undefined,
        statuses: statuses.length > 0 ? statuses : undefined,
        visibility,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(page.items);
      setTotal(page.total);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible consultar los registros de personas.",
      );
    } finally {
      setLoading(false);
    }
  }, [dataSource, query, statuses, visibility, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleStatus = (status: AdminPersonStatus) => {
    setOffset(0);
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  };

  const startEditing = (person: AdminPersonRecord) => {
    setEditingId(person.id);
    setConfirmingHideId(null);
    setNotice(null);
    setEdits({
      displayName: person.displayName,
      location: person.location,
      relatedEvent: person.relatedEvent,
      ...(person.hasLinkedCase ? {} : { status: person.status }),
    });
  };

  const saveEdits = async (person: AdminPersonRecord) => {
    const changes: AdminPersonUpdateInput = {};
    if (edits.displayName !== undefined && edits.displayName !== person.displayName) {
      changes.displayName = edits.displayName;
    }
    if (edits.location !== undefined && edits.location !== person.location) {
      changes.location = edits.location;
    }
    if (
      edits.relatedEvent !== undefined &&
      edits.relatedEvent !== person.relatedEvent
    ) {
      changes.relatedEvent = edits.relatedEvent;
    }
    if (edits.status !== undefined && edits.status !== person.status) {
      changes.status = edits.status;
    }
    if (Object.keys(changes).length === 0) {
      setNotice("No hay cambios para guardar.");
      return;
    }
    setBusyId(person.id);
    setNotice(null);
    try {
      await dataSource.updatePerson(person.id, changes);
      setNotice(`Registro de ${person.displayName} actualizado.`);
      setEditingId(null);
      await load();
      onMutated?.();
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `No fue posible guardar: ${error.message}`
          : "No fue posible guardar los cambios.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const hideOne = async (person: AdminPersonRecord) => {
    setBusyId(person.id);
    setNotice(null);
    try {
      await dataSource.hidePerson(person.id);
      setNotice(
        `${person.displayName} quedó invisible en la plataforma. El registro se conserva en la vista de ocultos.`,
      );
      setConfirmingHideId(null);
      await load();
      onMutated?.();
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `No fue posible ocultar: ${error.message}`
          : "No fue posible ocultar el registro.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const restoreOne = async (person: AdminPersonRecord) => {
    setBusyId(person.id);
    setNotice(null);
    try {
      await dataSource.restorePerson(person.id);
      setNotice(`${person.displayName} vuelve a ser visible.`);
      await load();
      onMutated?.();
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `No fue posible restaurar: ${error.message}`
          : "No fue posible restaurar el registro.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container} testID="admin-people-section">
      <View style={styles.filtersPanel}>
        <TextInput
          accessibilityLabel="Buscar registros de personas"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setOffset(0);
          }}
          placeholder="Nombre, ubicación, evento o fuente"
          placeholderTextColor="#536074"
          style={styles.searchInput}
        />
        <View style={styles.chipRow}>
          {(Object.keys(PERSON_STATUS_LABELS) as AdminPersonStatus[]).map(
            (status) => {
              const selected = statuses.includes(status);
              return (
                <Pressable
                  key={status}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Filtrar ${PERSON_STATUS_LABELS[status]}`}
                  onPress={() => toggleStatus(status)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {PERSON_STATUS_LABELS[status].toLocaleUpperCase("es-CO")}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
        <View style={styles.chipRow}>
          {(
            [
              { value: "visible", label: "VISIBLES" },
              { value: "hidden", label: "OCULTOS" },
              { value: "all", label: "TODOS" },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: visibility === option.value }}
              accessibilityLabel={`Ver registros ${option.label.toLocaleLowerCase("es-CO")}`}
              onPress={() => {
                setVisibility(option.value);
                setOffset(0);
              }}
              style={[
                styles.chip,
                visibility === option.value && styles.chipSelected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  visibility === option.value && styles.chipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.totalText}>
          {loading ? "CONSULTANDO…" : `${total} REGISTRO(S)`}
        </Text>
      </View>

      {notice && (
        <Text style={styles.notice} accessibilityRole="alert">
          {notice}
        </Text>
      )}

      {errorMessage && (
        <View style={styles.inlineError} accessibilityRole="alert">
          <Text style={styles.inlineErrorText}>{errorMessage}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>REINTENTAR</Text>
          </Pressable>
        </View>
      )}

      {loading && items.length === 0 && (
        <View style={styles.inlineState} testID="admin-people-loading">
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.inlineStateText}>
            Consultando registros de personas…
          </Text>
        </View>
      )}

      {!loading && !errorMessage && items.length === 0 && (
        <Text style={styles.emptyText}>
          {visibility === "hidden"
            ? "No hay registros ocultos."
            : "No hay registros para estos filtros."}
        </Text>
      )}

      {items.map((person) => (
        <View
          key={person.id}
          style={[styles.card, person.hiddenAt !== null && styles.cardHidden]}
          testID={`admin-person-${person.id}`}
        >
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.statusBadge,
                { color: STATUS_TONES[person.status] },
              ]}
            >
              {PERSON_STATUS_LABELS[person.status].toLocaleUpperCase("es-CO")}
            </Text>
            {person.hiddenAt !== null && (
              <Text style={styles.hiddenBadge}>OCULTO</Text>
            )}
          </View>
          <Text style={styles.personName}>{person.displayName}</Text>
          <Text style={styles.meta}>
            {person.location} · {person.relatedEvent}
          </Text>
          <Text style={styles.meta}>
            {`${person.source.name} · creado ${formatStamp(person.createdAt)}` +
              (person.hasLinkedCase ? " · con caso ciudadano" : "") +
              (person.hiddenAt !== null
                ? ` · oculto por ${person.hiddenBy ?? "administración"} el ${formatStamp(person.hiddenAt)}`
                : "")}
          </Text>

          {editingId === person.id ? (
            <View style={styles.editPanel}>
              <EditField
                label="Nombre público"
                value={edits.displayName ?? ""}
                onChange={(value) =>
                  setEdits((current) => ({ ...current, displayName: value }))
                }
              />
              <EditField
                label="Ubicación"
                value={edits.location ?? ""}
                onChange={(value) =>
                  setEdits((current) => ({ ...current, location: value }))
                }
              />
              <EditField
                label="Evento relacionado"
                value={edits.relatedEvent ?? ""}
                onChange={(value) =>
                  setEdits((current) => ({ ...current, relatedEvent: value }))
                }
              />
              {person.hasLinkedCase ? (
                <Text style={styles.statusLockedText}>
                  El estado de este registro lo derivan las novedades
                  verificadas de su caso; no se edita a mano.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {(
                    Object.keys(PERSON_STATUS_LABELS) as AdminPersonStatus[]
                  ).map((status) => (
                    <Pressable
                      key={status}
                      accessibilityRole="radio"
                      accessibilityState={{
                        selected: edits.status === status,
                      }}
                      accessibilityLabel={`Estado ${PERSON_STATUS_LABELS[status]}`}
                      onPress={() =>
                        setEdits((current) => ({ ...current, status }))
                      }
                      style={[
                        styles.chip,
                        edits.status === status && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          edits.status === status && styles.chipTextSelected,
                        ]}
                      >
                        {PERSON_STATUS_LABELS[status].toLocaleUpperCase(
                          "es-CO",
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditingId(null)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>CANCELAR</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Guardar cambios de ${person.displayName}`}
                  disabled={busyId === person.id}
                  onPress={() => void saveEdits(person)}
                  style={styles.primaryButton}
                >
                  {busyId === person.id ? (
                    <ActivityIndicator color="#07101b" />
                  ) : (
                    <Text style={styles.primaryButtonText}>GUARDAR</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : confirmingHideId === person.id ? (
            <View style={styles.confirmPanel} accessibilityRole="alert">
              <Text style={styles.confirmTitle}>
                {`¿Ocultar a ${person.displayName} de toda la plataforma?`}
              </Text>
              <Text style={styles.confirmText}>
                No se borra nada: el registro deja de verse en la tabla,
                las cifras, el mapa y el buscador, y queda en la vista de
                OCULTOS para restaurarlo o para el futuro borrado
                definitivo.
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingHideId(null)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>CANCELAR</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Confirmar ocultar a ${person.displayName}`}
                  disabled={busyId === person.id}
                  onPress={() => void hideOne(person)}
                  style={styles.dangerButton}
                >
                  {busyId === person.id ? (
                    <ActivityIndicator color={colors.emergency} />
                  ) : (
                    <Text style={styles.dangerButtonText}>SÍ, OCULTAR</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              {person.hiddenAt === null ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Editar el registro de ${person.displayName}`}
                    disabled={busyId !== null}
                    onPress={() => startEditing(person)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>EDITAR</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ocultar el registro de ${person.displayName}`}
                    disabled={busyId !== null}
                    onPress={() => {
                      setConfirmingHideId(person.id);
                      setEditingId(null);
                    }}
                    style={styles.dangerButton}
                  >
                    <Text style={styles.dangerButtonText}>OCULTAR</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restaurar el registro de ${person.displayName}`}
                  disabled={busyId !== null}
                  onPress={() => void restoreOne(person)}
                  style={styles.primaryButton}
                >
                  {busyId === person.id ? (
                    <ActivityIndicator color="#07101b" />
                  ) : (
                    <Text style={styles.primaryButtonText}>RESTAURAR</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>
      ))}

      {total > PAGE_SIZE && (
        <View style={styles.pagination}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
            disabled={offset === 0}
            onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            style={[
              styles.secondaryButton,
              offset === 0 && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>← ANTERIOR</Text>
          </Pressable>
          <Text style={styles.paginationText}>
            {`${offset + 1}-${Math.min(offset + PAGE_SIZE, total)} DE ${total}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Página siguiente"
            disabled={offset + PAGE_SIZE >= total}
            onPress={() => setOffset(offset + PAGE_SIZE)}
            style={[
              styles.secondaryButton,
              offset + PAGE_SIZE >= total && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>SIGUIENTE →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder="Escribe aquí"
        placeholderTextColor="#536074"
        style={styles.searchInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  filtersPanel: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "rgba(13,19,32,0.6)",
  },
  searchInput: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: 12,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.14)",
  },
  chipText: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  chipTextSelected: { color: colors.cyan },
  totalText: {
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
  cardHidden: { opacity: 0.8, borderColor: "rgba(255,181,71,0.4)" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusBadge: {
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  hiddenBadge: {
    color: "#e8c890",
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,181,71,0.45)",
    borderRadius: 5,
    overflow: "hidden",
  },
  personName: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  editPanel: {
    gap: 10,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  editField: { gap: 4 },
  editLabel: {
    color: colors.inkSoft,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statusLockedText: {
    color: colors.inkDim,
    fontSize: 9,
    lineHeight: 14,
    fontStyle: "italic",
  },
  primaryButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  primaryButtonText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
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
  buttonDisabled: { opacity: 0.4 },
  confirmPanel: {
    gap: 10,
    marginTop: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.4)",
    borderRadius: 9,
    backgroundColor: "rgba(255,77,94,0.06)",
  },
  confirmTitle: { color: colors.emergency, fontSize: 12, fontWeight: "800" },
  confirmText: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
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
  inlineErrorText: { color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paginationText: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.7,
  },
});
