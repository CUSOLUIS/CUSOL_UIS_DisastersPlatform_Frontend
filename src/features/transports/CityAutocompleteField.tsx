import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import {
  filterCities,
  normalizeSearchText,
  type TransportCity,
} from "./cityCatalog";

// CHG-171 §6-§9 — Selector/autocomplete de ciudades de Colombia: la
// persona escribe («buc» acerca a «Bucaramanga», con o sin tildes) y
// SOLO una opción del catálogo cuenta como ciudad seleccionada; el
// texto libre nunca se guarda. El mismo componente sirve para origen
// y destino (§18).

export function CityAutocompleteField({
  label,
  hint,
  cities,
  value,
  invalid = false,
  testIDPrefix,
  onSelect,
  onClear,
}: {
  label: string;
  hint?: string;
  cities: TransportCity[];
  // Nombre oficial de la ciudad seleccionada, o "" sin selección.
  value: string;
  invalid?: boolean;
  testIDPrefix: string;
  onSelect: (city: TransportCity) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => filterCities(cities, query),
    [cities, query],
  );

  const handleChange = (text: string) => {
    setQuery(text);
    setOpen(true);
    // §23/§65: escribir de nuevo invalida la selección anterior (y el
    // formulario descartará el centro que ya no corresponde).
    if (value && normalizeSearchText(text) !== normalizeSearchText(value)) {
      onClear();
    }
  };

  const handleSelect = (city: TransportCity) => {
    setQuery(city.name);
    setOpen(false);
    onSelect(city);
  };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, invalid && styles.labelInvalid]}>
          {label}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint="Escribe para buscar y elige una ciudad de la lista"
        placeholder="Escribe para buscar la ciudad"
        placeholderTextColor="#4b586d"
        value={value || query}
        onChangeText={handleChange}
        onFocus={() => setOpen(true)}
        autoCorrect={false}
        style={[styles.input, invalid && styles.inputInvalid]}
        testID={`${testIDPrefix}-input`}
      />
      {value !== "" && (
        <Text style={styles.selected} testID={`${testIDPrefix}-selected`}>
          Ciudad seleccionada: {value}
        </Text>
      )}
      {open && value === "" && (
        <View
          style={styles.options}
          accessibilityRole="menu"
          testID={`${testIDPrefix}-options`}
        >
          {options.length === 0 && (
            <Text style={styles.empty}>
              Ninguna ciudad del catálogo coincide con lo escrito.
            </Text>
          )}
          {options.map((city) => (
            <Pressable
              key={`${city.name}-${city.department}`}
              accessibilityRole="menuitem"
              accessibilityLabel={`${city.name}, ${city.department}`}
              onPress={() => handleSelect(city)}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              testID={`${testIDPrefix}-option-${normalizeSearchText(city.name).replace(/\s+/g, "-")}-${normalizeSearchText(city.department).replace(/\s+/g, "-")}`}
            >
              <Text style={styles.optionName}>{city.name}</Text>
              <Text style={styles.optionDepartment}>{city.department}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: { color: colors.inkSoft, fontSize: font(10), fontWeight: "700" },
  labelInvalid: { color: colors.reported },
  hint: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(8),
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: font(12),
  },
  inputInvalid: {
    borderColor: colors.reported,
    backgroundColor: "rgba(255,103,136,0.06)",
  },
  selected: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    letterSpacing: 0.4,
  },
  options: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: "rgba(9,13,24,0.98)",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(137,166,207,0.10)",
  },
  optionPressed: { backgroundColor: "rgba(81,229,255,0.08)" },
  optionName: { color: colors.ink, fontSize: font(12), fontWeight: "600" },
  optionDepartment: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
  },
  empty: {
    padding: 12,
    color: colors.inkDim,
    fontSize: font(10),
    lineHeight: 16,
  },
});
