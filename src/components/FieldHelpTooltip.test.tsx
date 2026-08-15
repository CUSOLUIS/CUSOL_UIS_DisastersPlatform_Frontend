/**
 * CHG-095 — Ayuda contextual junto a la etiqueta: el botón "?" abre y
 * cierra la explicación, y el texto viaja además en el hint accesible.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { FieldHelpTooltip } from "./FieldHelpTooltip";

const HELP =
  "Si existe un proceso, expediente o reporte oficial gestionado por entidades gubernamentales o de socorro para este incidente, ingresa aquí su código o número de radicado.";

it("abre y cierra la explicación al tocar el icono", () => {
  render(
    <FieldHelpTooltip label="Radicado o reporte oficial" help={HELP} />,
  );

  expect(screen.queryByTestId("field-help-popover")).toBeNull();

  const trigger = screen.getByRole("button", {
    name: "Qué es Radicado o reporte oficial",
  });
  fireEvent.press(trigger);
  expect(screen.getByTestId("field-help-popover")).toBeTruthy();
  expect(screen.getByText(HELP)).toBeTruthy();

  fireEvent.press(trigger);
  expect(screen.queryByTestId("field-help-popover")).toBeNull();
});

it("se abre al pasar el puntero y se cierra al salir", () => {
  render(
    <FieldHelpTooltip label="Radicado o reporte oficial" help={HELP} />,
  );

  const trigger = screen.getByTestId("field-help-trigger");
  fireEvent(trigger, "hoverIn");
  expect(screen.getByTestId("field-help-popover")).toBeTruthy();

  fireEvent(trigger, "hoverOut");
  expect(screen.queryByTestId("field-help-popover")).toBeNull();
});

it("anuncia la explicación sin necesidad de abrirla", () => {
  render(
    <FieldHelpTooltip label="Radicado o reporte oficial" help={HELP} />,
  );

  // Un lector de pantalla recibe el texto en el hint del botón.
  expect(
    screen.getByTestId("field-help-trigger").props.accessibilityHint,
  ).toBe(HELP);
});
