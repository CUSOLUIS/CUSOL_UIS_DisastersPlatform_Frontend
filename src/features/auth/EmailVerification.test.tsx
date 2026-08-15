/**
 * CHG-051 — Destino del enlace de verificación de correo.
 *
 * Verificar consume el token, muestra la bienvenida con la sesión ya
 * iniciada y ofrece entrar; los enlaces rotos o vencidos explican el
 * problema y llevan a iniciar sesión.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { EmailVerification } from "./EmailVerification";
import type { EmailVerificationResult } from "./types";

afterEach(cleanup);

const RESULT: EmailVerificationResult = {
  status: "active",
  verifiedAt: "2026-08-15T12:00:00Z",
  account: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    displayName: "Ana Rojas",
    email: "ana.rojas@example.com",
    assignedRole: "user",
    status: "active",
    sessionExpiresAt: "2026-08-16T12:00:00Z",
  },
};

it("verifica el token, saluda con la sesión iniciada y permite entrar", async () => {
  const verify = jest.fn().mockResolvedValue(RESULT);
  const onEnter = jest.fn();

  render(
    <EmailVerification
      token="token-valido-0123456789"
      verify={verify}
      onEnter={onEnter}
      onLogin={jest.fn()}
    />,
  );

  expect(
    await screen.findByRole("header", { name: "Correo confirmado" }),
  ).toBeTruthy();
  expect(verify).toHaveBeenCalledWith("token-valido-0123456789");
  expect(screen.getByText(/Bienvenido, Ana Rojas/)).toBeTruthy();
  expect(screen.getByText(/sesión ya está iniciada/)).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", { name: "Entrar a la plataforma" }),
  );
  expect(onEnter).toHaveBeenCalledTimes(1);
});

it("explica el error de un token inválido y lleva a iniciar sesión", async () => {
  const verify = jest
    .fn()
    .mockRejectedValue(
      new Error("El enlace de verificación es inválido, venció o ya fue utilizado."),
    );
  const onLogin = jest.fn();

  render(
    <EmailVerification
      token="token-vencido-0123456789"
      verify={verify}
      onEnter={jest.fn()}
      onLogin={onLogin}
    />,
  );

  expect(
    await screen.findByRole("header", {
      name: "No pudimos verificar el correo",
    }),
  ).toBeTruthy();
  expect(
    screen.getByText(/inválido, venció o ya fue utilizado/),
  ).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Ir a iniciar sesión" }));
  expect(onLogin).toHaveBeenCalledTimes(1);
});

it("sin token no consulta el servidor y explica el enlace incompleto", () => {
  const verify = jest.fn();

  render(
    <EmailVerification
      token={null}
      verify={verify}
      onEnter={jest.fn()}
      onLogin={jest.fn()}
    />,
  );

  expect(
    screen.getByRole("header", { name: "No pudimos verificar el correo" }),
  ).toBeTruthy();
  expect(screen.getByText(/no incluye un token/)).toBeTruthy();
  expect(verify).not.toHaveBeenCalled();
});
