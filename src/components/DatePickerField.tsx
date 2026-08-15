import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../theme";

// CHG-088 — Selector de fecha estándar de la plataforma, extraído de
// la "mini agenda" del reporte de persona (CHG-073): disparador con
// "Elegir en el calendario" y desplegable año → mes → día en
// cuadrícula. Cualquier campo de fecha de los formularios debe usar
// este componente (nada de texto libre AAAA-MM-DD ni pickers
// heterogéneos).

const MONTH_LABELS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Etiquetas de accesibilidad del disparador y del borrado.
  accessibilityLabel: string;
  clearAccessibilityLabel?: string;
  testID?: string;
  minYear?: number;
  maxYear?: number;
  // CHG-083: resaltado inline del campo con error.
  invalid?: boolean;
}

export function DatePickerField({
  label,
  value,
  onChange,
  accessibilityLabel,
  clearAccessibilityLabel,
  testID,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  invalid = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const years: number[] = [];
  for (let item = maxYear; item >= minYear; item -= 1) {
    years.push(item);
  }
  const pickDay = (day: number) => {
    if (year === null || month === null) return;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(iso);
    setOpen(false);
  };
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, invalid && styles.fieldLabelInvalid]}>
          {label}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((current) => !current);
          setYear(null);
          setMonth(null);
        }}
        style={[styles.fieldInput, invalid && styles.fieldInputInvalid]}
      >
        <View style={styles.selectValueRow}>
          <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
            {value || "Elegir en el calendario"}
          </Text>
          <Text style={styles.selectCaret}>{open ? "▴" : "📅"}</Text>
        </View>
      </Pressable>
      {open && (
        <View style={styles.selectPanel} testID={testID}>
          {year === null && (
            <>
              <Text style={styles.calendarStep}>ELIGE EL AÑO</Text>
              <ScrollView
                style={styles.selectScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.calendarGrid}>
                  {years.map((option) => (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={`Año ${option}`}
                      onPress={() => setYear(option)}
                      style={styles.calendarCell}
                    >
                      <Text style={styles.calendarCellText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
          {year !== null && month === null && (
            <>
              <Text style={styles.calendarStep}>ELIGE EL MES · {year}</Text>
              <View style={styles.calendarGrid}>
                {MONTH_LABELS.map((labelText, index) => (
                  <Pressable
                    key={labelText}
                    accessibilityRole="button"
                    accessibilityLabel={`Mes ${labelText} de ${year}`}
                    onPress={() => setMonth(index)}
                    style={styles.calendarCell}
                  >
                    <Text style={styles.calendarCellText}>{labelText}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {year !== null && month !== null && (
            <>
              <Text style={styles.calendarStep}>
                ELIGE EL DÍA · {MONTH_LABELS[month]} {year}
              </Text>
              <View style={styles.calendarGrid}>
                {Array.from(
                  { length: daysInMonth(year, month) },
                  (_, index) => index + 1,
                ).map((day) => (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`Día ${day}`}
                    onPress={() => pickDay(day)}
                    style={styles.calendarCellSmall}
                  >
                    <Text style={styles.calendarCellText}>{day}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {value !== "" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={clearAccessibilityLabel ?? "Borrar fecha"}
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
              style={styles.selectOption}
            >
              <Text style={styles.selectClearText}>Borrar fecha</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minWidth: 250, flex: 1, gap: 7 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  fieldLabelInvalid: { color: colors.reported },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    backgroundColor: "rgba(5,9,17,0.72)",
    justifyContent: "center",
  },
  fieldInputInvalid: {
    borderColor: colors.reported,
    backgroundColor: "rgba(255,103,136,0.06)",
  },
  selectValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectValue: { color: colors.ink, fontSize: 12, flexShrink: 1 },
  selectPlaceholder: { color: "#4b586d", fontSize: 12 },
  selectCaret: { color: colors.inkDim, fontSize: 12 },
  selectPanel: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.28)",
    borderRadius: 8,
    backgroundColor: "rgba(7,11,20,0.98)",
    padding: 8,
    gap: 8,
  },
  selectScroll: { maxHeight: 210 },
  selectOption: { paddingVertical: 9, paddingHorizontal: 6 },
  selectClearText: {
    color: colors.reported,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  calendarStep: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  calendarCell: {
    minWidth: 62,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.18)",
    borderRadius: 6,
  },
  calendarCellSmall: {
    minWidth: 40,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.18)",
    borderRadius: 6,
  },
  calendarCellText: { color: colors.ink, fontSize: 12 },
});
