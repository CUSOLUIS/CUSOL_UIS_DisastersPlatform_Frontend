import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../theme";
import { font } from "../typography";

// CHG-089 — Selector de hora estándar de la plataforma, hermano del
// DatePickerField (CHG-088).
// CHG-096 — La interfaz pasa a 12 horas con AM/PM y minutos editables,
// que es como la gente dice la hora en voz alta. El valor que sale del
// componente sigue siendo "HH:MM" en 24 horas: ese formato lo exigen
// las validaciones del frontend, el backend y el contrato, así que la
// conversión vive aquí y no se filtra al resto del formulario.

export const HOURS_12 = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
export const MINUTE_BLOCKS = ["00", "15", "30", "45"];

export type Meridiem = "AM" | "PM";

// 12 AM es medianoche (00) y 12 PM es mediodía (12): las dos esquinas
// donde el formato de 12 horas suele equivocarse.
export function to24Hour(
  hour12: string,
  minutes: string,
  meridiem: Meridiem,
): string {
  const hour = Number.parseInt(hour12, 10);
  const normalizedHour = hour % 12;
  const finalHour = meridiem === "PM" ? normalizedHour + 12 : normalizedHour;
  return `${String(finalHour).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export function from24Hour(
  value: string,
): { hour12: string; minutes: string; meridiem: Meridiem } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const meridiem: Meridiem = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    hour12: String(hour12).padStart(2, "0"),
    minutes: match[2],
    meridiem,
  };
}

// Lo que ve el usuario: "03:25 PM". Un valor que no sea 24h válido se
// devuelve tal cual para no ocultar un dato inesperado.
export function formatTimeForDisplay(value: string): string {
  const parts = from24Hour(value);
  if (!parts) {
    return value;
  }
  return `${parts.hour12}:${parts.minutes} ${parts.meridiem}`;
}

// Minutos escritos a mano: solo dígitos, dos como máximo y nunca por
// encima de 59.
export function sanitizeMinutes(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 2);
  if (digits === "") {
    return "";
  }
  return String(Math.min(59, Number.parseInt(digits, 10)));
}

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
  const [hour12, setHour12] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("00");
  const [meridiem, setMeridiem] = useState<Meridiem>("AM");

  // Al abrir con una hora ya elegida, el panel arranca en ella en vez
  // de obligar a rehacer la selección.
  useEffect(() => {
    if (!open) {
      return;
    }
    const parts = from24Hour(value);
    if (parts) {
      setHour12(parts.hour12);
      setMinutes(parts.minutes);
      setMeridiem(parts.meridiem);
    } else {
      setHour12(null);
      setMinutes("00");
      setMeridiem("AM");
    }
  }, [open, value]);

  // Cada ajuste emite de inmediato: la hora queda elegida sin tener
  // que confirmar, y el panel sigue abierto para afinarla.
  const emit = (
    nextHour: string | null,
    nextMinutes: string,
    nextMeridiem: Meridiem,
  ) => {
    if (nextHour === null) {
      return;
    }
    onChange(to24Hour(nextHour, nextMinutes || "00", nextMeridiem));
  };

  const chooseHour = (option: string) => {
    setHour12(option);
    emit(option, minutes, meridiem);
  };

  const chooseMinutes = (option: string) => {
    setMinutes(option);
    emit(hour12, option, meridiem);
  };

  const editMinutes = (input: string) => {
    const sanitized = sanitizeMinutes(input);
    setMinutes(sanitized);
    // Un campo a medio escribir no debe emitir una hora incompleta.
    if (sanitized !== "") {
      emit(hour12, sanitized.padStart(2, "0"), meridiem);
    }
  };

  const chooseMeridiem = (next: Meridiem) => {
    setMeridiem(next);
    emit(hour12, minutes, next);
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
        onPress={() => setOpen((current) => !current)}
        style={[styles.fieldInput, invalid && styles.fieldInputInvalid]}
      >
        <View style={styles.selectValueRow}>
          <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
            {value ? formatTimeForDisplay(value) : "Elegir la hora"}
          </Text>
          <Text style={styles.selectCaret}>{open ? "▴" : "🕐"}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.selectPanel} testID={testID}>
          <Text style={styles.pickerStep}>ELIGE LA HORA</Text>
          <ScrollView
            style={styles.selectScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.pickerGrid}>
              {HOURS_12.map((option) => {
                const selected = option === hour12;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={`Hora ${option}`}
                    accessibilityState={{ selected }}
                    onPress={() => chooseHour(option)}
                    style={[
                      styles.pickerCell,
                      selected && styles.pickerCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerCellText,
                        selected && styles.pickerCellTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={styles.pickerStep}>MINUTOS</Text>
          <View style={styles.pickerGrid}>
            {MINUTE_BLOCKS.map((option) => {
              const selected = option === minutes.padStart(2, "0");
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Minutos ${option}`}
                  accessibilityState={{ selected }}
                  onPress={() => chooseMinutes(option)}
                  style={[
                    styles.pickerCell,
                    selected && styles.pickerCellSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerCellText,
                      selected && styles.pickerCellTextSelected,
                    ]}
                  >
                    :{option}
                  </Text>
                </Pressable>
              );
            })}
            {/* CHG-096: minuto exacto a mano, para cuando 00/15/30/45
                no alcanza. */}
            <TextInput
              accessibilityLabel="Minutos exactos"
              testID={testID ? `${testID}-minutes-input` : undefined}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="MM"
              placeholderTextColor="#4b586d"
              value={minutes}
              onChangeText={editMinutes}
              style={styles.minutesInput}
            />
          </View>

          <Text style={styles.pickerStep}>AM / PM</Text>
          <View style={styles.pickerGrid}>
            {(["AM", "PM"] as const).map((option) => {
              const selected = option === meridiem;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  accessibilityState={{ selected }}
                  onPress={() => chooseMeridiem(option)}
                  style={[
                    styles.meridiemCell,
                    selected && styles.pickerCellSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerCellText,
                      selected && styles.pickerCellTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.panelActions}>
            {value !== "" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={clearAccessibilityLabel ?? "Borrar hora"}
                onPress={() => {
                  onChange("");
                  setHour12(null);
                  setMinutes("00");
                  setMeridiem("AM");
                  setOpen(false);
                }}
                style={styles.selectOption}
              >
                <Text style={styles.selectClearText}>Borrar hora</Text>
              </Pressable>
            )}
            {hour12 !== null && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirmar la hora"
                onPress={() => setOpen(false)}
                style={styles.doneButton}
              >
                <Text style={styles.doneButtonText}>LISTO</Text>
              </Pressable>
            )}
          </View>
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
  fieldLabel: {
    color: colors.inkSoft,
    fontSize: font(11),
    fontWeight: "700",
  },
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
  selectValue: { color: colors.ink, fontSize: font(13), flexShrink: 1 },
  selectPlaceholder: { color: "#4b586d", fontSize: font(13) },
  selectCaret: { color: colors.inkDim, fontSize: font(12) },
  selectPanel: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.28)",
    borderRadius: 8,
    backgroundColor: "rgba(7,11,20,0.98)",
    padding: 8,
    gap: 8,
  },
  selectScroll: { maxHeight: 172 },
  selectOption: { paddingVertical: 9, paddingHorizontal: 6 },
  selectClearText: {
    color: colors.reported,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  pickerStep: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  pickerCell: {
    minWidth: 62,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.18)",
    borderRadius: 6,
  },
  pickerCellSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.12)",
  },
  pickerCellText: { color: colors.ink, fontSize: font(13) },
  pickerCellTextSelected: { color: colors.cyan, fontWeight: "700" },
  minutesInput: {
    minWidth: 62,
    minHeight: 44,
    paddingHorizontal: 10,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.3)",
    borderRadius: 6,
    color: colors.ink,
    fontSize: font(13),
  },
  meridiemCell: {
    minWidth: 84,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.18)",
    borderRadius: 6,
  },
  panelActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  doneButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  doneButtonText: {
    color: "#06101a",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.7,
  },
});
