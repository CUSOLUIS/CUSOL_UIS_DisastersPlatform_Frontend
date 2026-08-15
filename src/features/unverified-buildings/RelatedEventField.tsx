import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { normalizeSearchValue } from "../missing-persons/dataSource";
import {
  SUGGESTIONS_DEBOUNCE_MS,
  SUGGESTIONS_MIN_LENGTH,
} from "../person-suggestions/usePersonSuggestions";
import {
  relatedEventsDataSource,
  type DisasterEventSuggestion,
  type RelatedEventsDataSource,
} from "./relatedEvents";

// CHG-092 — "Evento relacionado" como autocompletado creable. Antes el
// campo pedía un UUID a mano; ahora se escribe el nombre: con 3+
// caracteres lista eventos existentes (difuso, backend), tocar uno lo
// fija como selección (chip con ✕), y si no existe la última opción es
// crearlo — o simplemente dejar el texto, que equivale a lo mismo.

const verificationLabels: Record<
  DisasterEventSuggestion["verificationStatus"],
  string
> = {
  verified: "Verificado",
  under_review: "En revisión",
  unverified: "Sin verificar",
  rejected: "Rechazado",
};

export function RelatedEventField({
  selectedEventId,
  eventName,
  onSelect,
  onNameChange,
  dataSource = relatedEventsDataSource,
}: {
  selectedEventId: string;
  eventName: string;
  onSelect: (eventId: string, title: string) => void;
  onNameChange: (name: string) => void;
  dataSource?: RelatedEventsDataSource;
}) {
  const [suggestions, setSuggestions] = useState<DisasterEventSuggestion[]>(
    [],
  );
  const [open, setOpen] = useState(false);
  const trimmed = eventName.trim();

  useEffect(() => {
    if (
      selectedEventId ||
      trimmed.length < SUGGESTIONS_MIN_LENGTH
    ) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(() => {
      dataSource
        .autocomplete(trimmed, controller.signal)
        .then((response) => {
          if (!cancelled) {
            setSuggestions(response.items);
            setOpen(true);
          }
        })
        .catch(() => {
          // Sin sugerencias no se bloquea nada: el texto escrito ya
          // vale como evento nuevo.
          if (!cancelled) {
            setSuggestions([]);
            setOpen(false);
          }
        });
    }, SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [dataSource, selectedEventId, trimmed]);

  const exactMatch = suggestions.some(
    (item) =>
      normalizeSearchValue(item.title) === normalizeSearchValue(trimmed),
  );

  if (selectedEventId) {
    return (
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Evento relacionado</Text>
          <Text style={styles.hint}>Nombre o selección de evento</Text>
        </View>
        <View
          testID="related-event-chip"
          accessibilityLabel={`Evento relacionado seleccionado: ${eventName}`}
          style={styles.chip}
        >
          <Text style={styles.chipText} numberOfLines={2}>
            {eventName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar el evento seleccionado"
            onPress={() => onSelect("", "")}
            style={({ pressed }) => [
              styles.chipClear,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.chipClearText}>✕</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Evento relacionado</Text>
        <Text style={styles.hint}>Nombre o selección de evento</Text>
      </View>
      <TextInput
        accessibilityLabel="Evento relacionado"
        placeholder="Ej. Sismo en el Centro, Inundación Barrio X"
        placeholderTextColor="#4b586d"
        value={eventName}
        onChangeText={onNameChange}
        style={styles.input}
      />
      {open && (trimmed.length >= SUGGESTIONS_MIN_LENGTH) && (
        <View testID="related-event-options" style={styles.options}>
          {suggestions.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar el evento ${item.title}`}
              onPress={() => {
                // onSelect fija id y título juntos; llamar también a
                // onNameChange borraría el id recién seleccionado.
                onSelect(item.id, item.title);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.optionTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.optionMeta}>
                {item.disasterType.toLocaleUpperCase("es-CO")} ·{" "}
                {verificationLabels[item.verificationStatus]}
              </Text>
            </Pressable>
          ))}
          {!exactMatch && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Crear nuevo evento: ${trimmed}`}
              onPress={() => setOpen(false)}
              style={({ pressed }) => [
                styles.option,
                styles.createOption,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.createText} numberOfLines={2}>
                + Crear nuevo evento: “{trimmed}”
              </Text>
              <Text style={styles.optionMeta}>
                Se registrará al enviar el reporte
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minWidth: 250, flex: 1, gap: 7 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  label: { color: colors.inkSoft, fontSize: font(11), fontWeight: "700" },
  hint: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11) },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: "rgba(10, 16, 28, 0.6)",
    color: colors.ink,
    fontSize: font(13),
  },
  options: {
    gap: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.28)",
    borderRadius: 9,
    backgroundColor: colors.panel,
  },
  option: {
    minHeight: 44,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
  },
  optionTitle: { color: colors.ink, fontSize: font(13), fontWeight: "700" },
  optionMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
  },
  createOption: {
    borderWidth: 1,
    borderColor: "rgba(67,231,173,0.35)",
    backgroundColor: "rgba(67,231,173,0.06)",
  },
  createText: { color: colors.alive, fontSize: font(13), fontWeight: "700" },
  chip: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.4)",
    borderRadius: 9,
    backgroundColor: "rgba(81,229,255,0.07)",
  },
  chipText: { flex: 1, color: colors.cyan, fontSize: font(13), fontWeight: "700" },
  chipClear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chipClearText: { color: colors.cyan, fontSize: font(14), fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
