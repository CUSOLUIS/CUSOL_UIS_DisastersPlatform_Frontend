import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../theme";

// CHG-089 — Selector de hora estándar de la plataforma, hermano del
// DatePickerField (CHG-088): disparador con "Elegir la hora" y
// desplegable hora (00–23) → minutos (bloques de 15). Produce "HH:MM"
// en formato 24 horas, el mismo que exigen las validaciones del
// frontend, el backend y el contrato.

const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const MINUTE_BLOCKS = ["00", "15", "30", "45"];

export interface TimePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  clearAccessibilityLabel?: string;
  testID?: string;
  // CHG-083: resaltado inline del campo con error.
  invalid?: boolean;
}

export function TimePickerField({
  label,
  value,
  onChange,
  accessibilityLabel,
  clearAccessibilityLabel,
  testID,
  invalid = false,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<string | null>(null);

  const pickMinutes = (minutes: string) => {
    if (hour === null) return;
    onChange(`${hour}:${minutes}`);
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
          setHour(null);
        }}
        style={[styles.fieldInput, invalid && styles.fieldInputInvalid]}
      >
        <View style={styles.selectValueRow}>
          <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
            {value || "Elegir la hora"}
          </Text>
          <Text style={styles.selectCaret}>{open ? "▴" : "🕐"}</Text>
        </View>
      </Pressable>
      {open && (
        <View style={styles.selectPanel} testID={testID}>
          {hour === null && (
            <>
              <Text style={styles.pickerStep}>ELIGE LA HORA</Text>
              <ScrollView
                style={styles.selectScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.pickerGrid}>
                  {HOURS.map((option) => (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={`Hora ${option}`}
                      onPress={() => setHour(option)}
                      style={styles.pickerCell}
                    >
                      <Text style={styles.pickerCellText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
          {hour !== null && (
            <>
              <Text style={styles.pickerStep}>
                ELIGE LOS MINUTOS · {hour}:__
              </Text>
              <View style={styles.pickerGrid}>
                {MINUTE_BLOCKS.map((minutes) => (
                  <Pressable
                    key={minutes}
                    accessibilityRole="button"
                    accessibilityLabel={`Minutos ${minutes} de las ${hour}`}
                    onPress={() => pickMinutes(minutes)}
                    style={styles.pickerCell}
                  >
                    <Text style={styles.pickerCellText}>
                      {hour}:{minutes}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {value !== "" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={clearAccessibilityLabel ?? "Borrar hora"}
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
              style={styles.selectOption}
            >
              <Text style={styles.selectClearText}>Borrar hora</Text>
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
  pickerStep: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pickerCell: {
    minWidth: 62,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.18)",
    borderRadius: 6,
  },
  pickerCellText: { color: colors.ink, fontSize: 12 },
});
