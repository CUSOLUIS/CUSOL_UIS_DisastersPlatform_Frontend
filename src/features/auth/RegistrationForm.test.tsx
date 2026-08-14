import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { RegistrationForm, validateRegistrationDraft } from "./RegistrationForm";
import type { RegistrationDraft } from "./types";

afterEach(cleanup);

const strongDraft: RegistrationDraft = {
  firstNames: "Laura",
  lastNames: "Gómez",
  email: "laura@example.com",
  phone: "+57 300 123 4567",
  department: "Santander",
  municipality: "Bucaramanga",
  requestedAccountType: "citizen",
  organizationName: "",
  organizationRole: "",
  password: "ClaveSegura#2026",
  confirmPassword: "ClaveSegura#2026",
  termsAccepted: true,
  privacyAccepted: true,
  accuracyConfirmed: true,
};

describe("RegistrationForm", () => {
  it("valida identidad, organización, seguridad y consentimientos", () => {
    expect(
      validateRegistrationDraft({
        ...strongDraft,
        requestedAccountType: "organization_representative",
        organizationName: "",
        password: "debil",
        confirmPassword: "otra",
        termsAccepted: false,
        privacyAccepted: false,
        accuracyConfirmed: false,
      }),
    ).toEqual(
      expect.arrayContaining([
        "Ingresa el nombre de la organización que representas.",
        "La contraseña debe cumplir los cinco requisitos de seguridad.",
        "Las contraseñas no coinciden.",
        "Debes aceptar los términos de uso.",
        "Debes aceptar el tratamiento de datos.",
        "Debes confirmar la exactitud de la información.",
      ]),
    );
  });

  it("presenta un formulario detallado sin pedir datos innecesarios", () => {
    render(<RegistrationForm onBack={jest.fn()} onLogin={jest.fn()} />);

    expect(screen.getByRole("header", { name: "Crea tu cuenta" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Identidad" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Contacto y ubicación" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Cómo deseas participar" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Seguridad" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Consentimientos" })).toBeTruthy();
    expect(screen.queryByLabelText("Número de documento")).toBeNull();
    expect(screen.queryByLabelText("Fecha de nacimiento")).toBeNull();
    expect(screen.queryByLabelText("Dirección residencial")).toBeNull();
  });

  it("envía el payload contractual sin la confirmación y muestra verificación", async () => {
    const registerAccount = jest.fn().mockResolvedValue({
      requestId: "d7ad12e1-5e18-47c4-b3f2-5a2a57d0c8ef",
      status: "email_verification_required",
      emailMasked: "l***a@example.com",
      verificationExpiresAt: "2026-08-14T12:00:00Z",
      assignedRole: "user",
      createdAt: "2026-08-13T12:00:00Z",
    });
    render(
      <RegistrationForm
        onBack={jest.fn()}
        onLogin={jest.fn()}
        registerAccount={registerAccount}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Nombres *"), "  Laura ");
    fireEvent.changeText(screen.getByLabelText("Apellidos *"), " Gómez ");
    fireEvent.changeText(screen.getByLabelText("Correo electrónico *"), "LAURA@EXAMPLE.COM");
    fireEvent.changeText(screen.getByLabelText("Teléfono privado"), "+57 300 123 4567");
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "Santander");
    fireEvent.changeText(screen.getByLabelText("Municipio *"), "Bucaramanga");
    fireEvent.press(screen.getByRole("radio", { name: "Organización" }));
    fireEvent.changeText(screen.getByLabelText("Nombre de la organización *"), "Fundación Ayuda");
    fireEvent.changeText(screen.getByLabelText("Función o cargo"), "Coordinadora");
    fireEvent.changeText(screen.getByLabelText("Contraseña *"), "ClaveSegura#2026");
    fireEvent.changeText(screen.getByLabelText("Confirmar contraseña *"), "ClaveSegura#2026");
    fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos de uso de la plataforma." }));
    fireEvent.press(screen.getByRole("checkbox", { name: /Acepto el tratamiento privado/ }));
    fireEvent.press(screen.getByRole("checkbox", { name: /Confirmo que la información suministrada/ }));
    fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(registerAccount).toHaveBeenCalledTimes(1));
    const payload = registerAccount.mock.calls[0][0];
    expect(payload).toMatchObject({
      firstNames: "Laura",
      lastNames: "Gómez",
      email: "laura@example.com",
      requestedAccountType: "organization_representative",
      organizationName: "Fundación Ayuda",
      termsAccepted: true,
      privacyAccepted: true,
      accuracyConfirmed: true,
    });
    expect(payload).not.toHaveProperty("confirmPassword");
    expect(payload).not.toHaveProperty("assignedRole");
    expect(await screen.findByRole("header", { name: "Verifica tu correo" })).toBeTruthy();
    expect(screen.getByText(/l\*\*\*a@example.com/)).toBeTruthy();
    expect(screen.getByText(/VERIFICACIÓN REQUERIDA/)).toBeTruthy();
  });

  it("no invoca el backend con el formulario vacío", () => {
    const registerAccount = jest.fn();
    render(
      <RegistrationForm
        onBack={jest.fn()}
        onLogin={jest.fn()}
        registerAccount={registerAccount}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(registerAccount).not.toHaveBeenCalled();
    expect(screen.getByText("Revisa los datos antes de continuar")).toBeTruthy();
    expect(screen.getByText("• Ingresa tus nombres.")).toBeTruthy();
  });
});
