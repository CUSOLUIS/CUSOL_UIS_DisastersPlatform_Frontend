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

// CHG-078 — Con sesión activa la leyenda deja de ofrecer registro e
// inicio de sesión y confirma la asociación del reporte a la cuenta.

const ACCOUNT = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  displayName: "Laura Gómez",
  email: "laura@example.com",
  assignedRole: "user" as const,
  status: "active" as const,
  sessionExpiresAt: "2026-08-16T10:00:00Z",
};

it("con sesión activa oculta los botones y confirma la asociación", () => {
  render(
    <ReportConsiderations
      considerations={CONSIDERATIONS}
      onRegister={jest.fn()}
      onLogin={jest.fn()}
      session={{ status: "authenticated", account: ACCOUNT }}
    />,
  );

  expect(
    screen.getByText("SESIÓN ACTIVA · REPORTANDO CON TU CUENTA"),
  ).toBeTruthy();
  expect(
    screen.getByText(/quedará asociado automáticamente a la cuenta\s+de Laura Gómez/),
  ).toBeTruthy();
  expect(
    screen.queryByText("REPORTAR CON CUENTA TIENE VENTAJAS"),
  ).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: "Registrarme para reportar con cuenta",
    }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: "Iniciar sesión para reportar con cuenta",
    }),
  ).toBeNull();
});

it("mientras la sesión se resuelve no muestra el bloque de cuenta", () => {
  render(
    <ReportConsiderations
      considerations={CONSIDERATIONS}
      onRegister={jest.fn()}
      onLogin={jest.fn()}
      session={{ status: "resolving", account: null }}
    />,
  );

  expect(
    screen.queryByText("REPORTAR CON CUENTA TIENE VENTAJAS"),
  ).toBeNull();
  expect(
    screen.queryByText("SESIÓN ACTIVA · REPORTANDO CON TU CUENTA"),
  ).toBeNull();
  // Las consideraciones del reporte siguen visibles.
  expect(screen.getByText("ANTES DE ENVIAR ESTE REPORTE")).toBeTruthy();
});

it("sin sesión conserva los accesos de registro e inicio de sesión", () => {
  render(
    <ReportConsiderations
      considerations={CONSIDERATIONS}
      onRegister={jest.fn()}
      onLogin={jest.fn()}
      session={{ status: "anonymous", account: null }}
    />,
  );

  expect(
    screen.getByRole("button", {
      name: "Registrarme para reportar con cuenta",
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", {
      name: "Iniciar sesión para reportar con cuenta",
    }),
  ).toBeTruthy();
});
