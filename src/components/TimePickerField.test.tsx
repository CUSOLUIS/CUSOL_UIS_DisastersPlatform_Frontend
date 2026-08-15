/**
 * CHG-096 — El selector pasa a 12 horas con AM/PM y minutos editables,
 * pero sigue entregando "HH:MM" en 24 horas, que es lo que exigen las
 * validaciones del frontend, el backend y el contrato.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  HOURS_12,
  TimePickerField,
  formatTimeForDisplay,
  from24Hour,
  sanitizeMinutes,
  to24Hour,
} from "./TimePickerField";

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

describe("conversión de 12 a 24 horas", () => {
  it("resuelve las dos esquinas del formato: 12 AM y 12 PM", () => {
    // Medianoche y mediodía son donde este formato suele fallar.
    expect(to24Hour("12", "00", "AM")).toBe("00:00");
    expect(to24Hour("12", "30", "PM")).toBe("12:30");
  });

  it("convierte las horas corrientes de la tarde", () => {
    expect(to24Hour("01", "05", "PM")).toBe("13:05");
    expect(to24Hour("03", "25", "PM")).toBe("15:25");
    expect(to24Hour("11", "59", "PM")).toBe("23:59");
  });

  it("deja intactas las horas de la mañana", () => {
    expect(to24Hour("01", "05", "AM")).toBe("01:05");
    expect(to24Hour("11", "45", "AM")).toBe("11:45");
  });

  it("siempre produce un valor que pasa la validación de 24 horas", () => {
    for (const hour of HOURS_12) {
      for (const meridiem of ["AM", "PM"] as const) {
        expect(to24Hour(hour, "07", meridiem)).toMatch(TIME_24H);
      }
    }
  });

  it("da la vuelta completa sin perder información", () => {
    for (const value of ["00:00", "09:15", "12:30", "15:25", "23:59"]) {
      const parts = from24Hour(value);
      expect(parts).not.toBeNull();
      expect(
        to24Hour(parts!.hour12, parts!.minutes, parts!.meridiem),
      ).toBe(value);
    }
  });

  it("rechaza valores que no son 24 horas válidas", () => {
    expect(from24Hour("24:00")).toBeNull();
    expect(from24Hour("12:60")).toBeNull();
    expect(from24Hour("3:25 PM")).toBeNull();
    expect(from24Hour("")).toBeNull();
  });
});

describe("presentación y minutos escritos a mano", () => {
  it("muestra la hora como la diría una persona", () => {
    expect(formatTimeForDisplay("15:25")).toBe("03:25 PM");
    expect(formatTimeForDisplay("00:10")).toBe("12:10 AM");
    expect(formatTimeForDisplay("12:00")).toBe("12:00 PM");
  });

  it("acota los minutos escritos a dos dígitos y a 59", () => {
    expect(sanitizeMinutes("7")).toBe("7");
    expect(sanitizeMinutes("42")).toBe("42");
    expect(sanitizeMinutes("99")).toBe("59");
    expect(sanitizeMinutes("4a2")).toBe("42");
    expect(sanitizeMinutes("")).toBe("");
  });
});

describe("interacción del selector", () => {
  function open(onChange = jest.fn(), value = "") {
    render(
      <TimePickerField
        label="Hora aproximada"
        accessibilityLabel="Elegir la hora"
        testID="time-picker"
        value={value}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByLabelText("Elegir la hora"));
    return onChange;
  }

  it("ofrece solo las horas de 01 a 12", () => {
    open();

    expect(screen.getByLabelText("Hora 01")).toBeTruthy();
    expect(screen.getByLabelText("Hora 12")).toBeTruthy();
    // El formato de 24 horas ya no se muestra.
    expect(screen.queryByLabelText("Hora 00")).toBeNull();
    expect(screen.queryByLabelText("Hora 13")).toBeNull();
    expect(screen.queryByLabelText("Hora 23")).toBeNull();
  });

  it("elegir hora emite de una vez, en 24 horas", () => {
    const onChange = open();

    fireEvent.press(screen.getByLabelText("Hora 03"));

    expect(onChange).toHaveBeenCalledWith("03:00");
  });

  it("cambiar a PM reconvierte la hora ya elegida", () => {
    const onChange = open();

    fireEvent.press(screen.getByLabelText("Hora 03"));
    fireEvent.press(screen.getByLabelText("PM"));

    expect(onChange).toHaveBeenLastCalledWith("15:00");
  });

  it("acepta un minuto exacto escrito a mano", () => {
    const onChange = open();

    fireEvent.press(screen.getByLabelText("Hora 03"));
    fireEvent.press(screen.getByLabelText("PM"));
    fireEvent.changeText(screen.getByLabelText("Minutos exactos"), "42");

    expect(onChange).toHaveBeenLastCalledWith("15:42");
  });

  it("los bloques sugeridos siguen funcionando", () => {
    const onChange = open();

    fireEvent.press(screen.getByLabelText("Hora 09"));
    fireEvent.press(screen.getByLabelText("Minutos 30"));

    expect(onChange).toHaveBeenLastCalledWith("09:30");
  });

  it("al reabrir parte de la hora ya guardada", () => {
    open(jest.fn(), "15:25");

    // 15:25 se muestra como 03:25 PM: hora, minutos y meridiano
    // aparecen ya seleccionados.
    expect(
      screen.getByLabelText("Hora 03").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByLabelText("PM").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByLabelText("Minutos exactos").props.value,
    ).toBe("25");
  });

  it("el disparador muestra la hora en 12 horas", () => {
    render(
      <TimePickerField
        label="Hora aproximada"
        accessibilityLabel="Elegir la hora"
        value="15:25"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText("03:25 PM")).toBeTruthy();
  });
});
