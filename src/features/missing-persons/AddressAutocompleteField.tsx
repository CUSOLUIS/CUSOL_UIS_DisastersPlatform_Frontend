// CHG-141 — Campo de dirección con sugerencias mientras se escribe.
// La dirección escrita basta por sí sola (string); las sugerencias son
// una ayuda: al elegir una, su texto completo sustituye lo escrito.
// Debounce real (una consulta por pausa de escritura, nunca por
// tecla), solo la última consulta puede pintar resultados, y los
// fallos del geocodificador son silenciosos: jamás bloquean el
// formulario. Mismo proveedor de siempre (Nominatim, CHG-086).

import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  searchAddressCandidates,
  type AddressCandidate,
} from "./geocoding";

const SUGGEST_DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 4;

export function AddressAutocompleteField({
  label,
  hint,
  invalid = false,
  value,
  onChangeText,
  onSelectCandidate,
  searchCandidates = searchAddressCandidates,
  placeholder = "Escribe aquí",
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onSelectCandidate?: (candidate: AddressCandidate) => void;
  searchCandidates?: (query: string) => Promise<AddressCandidate[]>;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressCandidate[]>([]);
  const [open, setOpen] = useState(false);
  // Al elegir una sugerencia el campo cambia; esa escritura "nuestra"
  // no debe reabrir el desplegable.
  const skipNextQueryRef = useRef(false);
  // Solo la última consulta viva puede pintar resultados.
  const queryVersionRef = useRef(0);

  useEffect(() => {
    if (skipNextQueryRef.current) {
      skipNextQueryRef.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const version = ++queryVersionRef.current;
    const timer = setTimeout(() => {
      searchCandidates(`${query}, Colombia`)
        .then((results) => {
          if (queryVersionRef.current !== version) {
            return;
          }
          setSuggestions(results.slice(0, 5));
          setOpen(results.length > 0);
        })
        .catch(() => {
          // Mejor esfuerzo: sin proveedor no hay sugerencias, pero el
          // texto escrito sigue siendo válido por sí solo.
          if (queryVersionRef.current === version) {
            setSuggestions([]);
            setOpen(false);
          }
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, searchCandidates]);

  const selectCandidate = (candidate: AddressCandidate) => {
    skipNextQueryRef.current = true;
    queryVersionRef.current += 1;
    onChangeText(candidate.label);
    onSelectCandidate?.(candidate);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text
          style={[styles.fieldLabel, invalid && styles.fieldLabelInvalid]}
        >
          {label}
        </Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor="#4b586d"
        value={value}
        onChangeText={onChangeText}
        style={[styles.fieldInput, invalid && styles.fieldInputInvalid]}
      />
      {open && suggestions.length > 0 && (
        <View
          style={styles.suggestions}
          testID="address-suggestions"
          accessibilityLabel="Sugerencias de dirección"
        >
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>SUGERENCIAS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar sugerencias de dirección"
              onPress={() => setOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {suggestions.map((candidate, index) => (
            <Pressable
              key={`${candidate.latitude}-${candidate.longitude}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Usar dirección sugerida: ${candidate.label}`}
              onPress={() => selectCandidate(candidate)}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && styles.pressed,
              ]}
              testID={`address-suggestion-${index}`}
            >
              <Text style={styles.suggestionText}>{candidate.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// Estilos espejo del FormField del reporte (mismo lenguaje visual).
const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldLabelInvalid: { color: colors.reported },
  fieldHint: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
  },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: 12,
  },
  fieldInputInvalid: {
    borderColor: colors.reported,
    backgroundColor: "rgba(255,103,136,0.06)",
  },
  suggestions: {
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.22)",
    borderRadius: 8,
    backgroundColor: "rgba(5,9,17,0.92)",
    padding: 6,
    gap: 4,
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  suggestionsTitle: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.9,
  },
  closeButton: { paddingHorizontal: 8, paddingVertical: 4 },
  closeText: { color: colors.inkDim, fontSize: 11 },
  suggestion: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: "rgba(81,229,255,0.06)",
  },
  suggestionText: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
