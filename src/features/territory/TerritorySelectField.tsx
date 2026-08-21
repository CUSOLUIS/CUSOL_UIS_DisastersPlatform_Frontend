import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fieldGridLayout } from "../../components/fieldGrid";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { searchTerritory } from "./territory";

// CHG-185 — Campo de territorio: lista cerrada que se busca
// escribiendo. Escribir filtra, no inventa: el valor solo se guarda al
// tocar una opción del catálogo, así que un municipio mal escrito deja
// de poder llegar a la cuenta.
//
// Dos estados, como el autocompletado creable de CHG-092: sin elegir
// se ve la caja de búsqueda con sus opciones; ya elegido se ve el
// nombre con el botón de cambiarlo. Nunca conviven un texto escrito y
// un valor guardado distintos, que es de donde salen los formularios
// que muestran una cosa y envían otra.
//
// Todo se resuelve con componentes de React Native, sin `<select>` del
// navegador: el mismo campo tiene que funcionar en la web y en el APK.

// Cuántas opciones se dibujan a la vez. Con 1.122 municipios, pintarlos
// todos cuelga la lista; el resto se alcanza escribiendo.
export const MAX_VISIBLE_OPTIONS = 8;

interface TerritorySelectFieldProps {
  label: string;
  // Nombre en minúscula para las etiquetas de accesibilidad
  // («Elegir el departamento Santander»).
  name: string;
  value: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  hint?: string;
  placeholder?: string;
  // El municipio no se puede elegir antes que el departamento.
  disabled?: boolean;
  disabledHint?: string;
  invalid?: boolean;
}

export function TerritorySelectField({
  label,
  name,
  value,
  options,
  onSelect,
  hint,
  placeholder = "Escribe para buscar",
  disabled = false,
  disabledHint,
  invalid = false,
}: TerritorySelectFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(
    () => searchTerritory(options, query),
    [options, query],
  );
  const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
  const hidden = matches.length - visible.length;

  const labelRow = (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );

  if (value) {
    return (
      <View style={styles.field}>
        {labelRow}
        <View
          style={styles.chip}
          accessibilityLabel={`${label}: ${value}`}
        >
          <Text style={styles.chipText} numberOfLines={2}>
            {value}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cambiar ${name}`}
            onPress={() => {
              onSelect("");
              setQuery("");
              setOpen(true);
            }}
            style={({ pressed }) => [styles.change, pressed && styles.pressed]}
          >
            <Text style={styles.changeText}>CAMBIAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (disabled) {
    return (
      <View style={styles.field}>
        {labelRow}
        <View
          style={[styles.input, styles.inputDisabled]}
          accessibilityLabel={`${label} no disponible`}
          accessibilityState={{ disabled: true }}
        >
          <Text style={styles.disabledText}>
            {disabledHint ?? "No disponible todavía"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      {labelRow}
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor="#4b586d"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        style={[styles.input, invalid && styles.inputInvalid]}
      />
      {open && (
        <View
          accessibilityLabel={`Opciones de ${name}`}
          style={styles.options}
        >
          {visible.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={`Elegir el ${name} ${option}`}
              onPress={() => {
                onSelect(option);
                setQuery("");
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.optionText} numberOfLines={2}>
                {option}
              </Text>
            </Pressable>
          ))}
          {visible.length === 0 && (
            <Text style={styles.empty}>
              Ningún {name} del catálogo coincide con «{query.trim()}».
              Revisa cómo lo escribiste.
            </Text>
          )}
          {hidden > 0 && (
            <Text style={styles.more}>
              y {hidden} más — sigue escribiendo para acotar
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // CHG-116: la rejilla manda el ancho; el campo nunca se desborda.
  field: fieldGridLayout.field,
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: { color: colors.inkSoft, fontSize: font(11), fontWeight: "700" },
  hint: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
  },
  input: {
    minHeight: 49,
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: font(12),
  },
  inputInvalid: { borderColor: colors.reported },
  inputDisabled: { backgroundColor: "rgba(5,9,17,0.42)" },
  disabledText: { color: colors.inkDim, fontSize: font(12) },
  options: {
    gap: 3,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.28)",
    borderRadius: 9,
    backgroundColor: colors.panel,
  },
  option: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
  },
  optionText: { color: colors.ink, fontSize: font(13), fontWeight: "600" },
  empty: {
    color: colors.inkSoft,
    fontSize: font(12),
    lineHeight: 19,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  more: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  chip: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 13,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.4)",
    borderRadius: 8,
    backgroundColor: "rgba(81,229,255,0.07)",
  },
  chipText: {
    flex: 1,
    color: colors.cyan,
    fontSize: font(12),
    fontWeight: "700",
  },
  change: {
    minHeight: 44,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  changeText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  pressed: { opacity: 0.72 },
});
