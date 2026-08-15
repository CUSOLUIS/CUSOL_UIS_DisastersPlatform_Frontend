/**
 * CHG-053 — Leyenda superior de los formularios de reporte: lista las
 * consideraciones y explica las ventajas de reportar con cuenta
 * (notificaciones y prioridad sobre reportes anónimos).
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { ReportConsiderations } from "./ReportConsiderations";

afterEach(cleanup);

const CONSIDERATIONS = [
  "El equipo revisa cada reporte antes de publicar.",
  "Tus datos de contacto son privados.",
];

it("lista las consideraciones y las ventajas de reportar con cuenta", () => {
  render(<ReportConsiderations considerations={CONSIDERATIONS} />);

  expect(screen.getByText("ANTES DE ENVIAR ESTE REPORTE")).toBeTruthy();
  CONSIDERATIONS.forEach((item) => {
    expect(screen.getByText(item)).toBeTruthy();
  });
  expect(
    screen.getByText("REPORTAR CON CUENTA TIENE VENTAJAS"),
  ).toBeTruthy();
  expect(screen.getByText(/recibir\s+notificaciones sobre su avance/)).toBeTruthy();
  expect(
    screen.getByText(/mayor prioridad de revisión que los\s+anónimos/),
  ).toBeTruthy();
  // Sin callbacks no se ofrecen botones.
  expect(
    screen.queryByRole("button", {
      name: "Registrarme para reportar con cuenta",
    }),
  ).toBeNull();
});

it("ofrece registrarse e iniciar sesión cuando hay navegación", () => {
  const onRegister = jest.fn();
  const onLogin = jest.fn();
  render(
    <ReportConsiderations
      considerations={CONSIDERATIONS}
      onRegister={onRegister}
      onLogin={onLogin}
    />,
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Registrarme para reportar con cuenta",
    }),
  );
  fireEvent.press(
    screen.getByRole("button", {
      name: "Iniciar sesión para reportar con cuenta",
    }),
  );

  expect(onRegister).toHaveBeenCalledTimes(1);
  expect(onLogin).toHaveBeenCalledTimes(1);
});
