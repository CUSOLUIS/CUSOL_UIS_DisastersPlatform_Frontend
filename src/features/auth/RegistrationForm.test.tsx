import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { FIELD_BASIS } from "../../components/fieldGrid";
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
  healthProfession: "",
  healthLicenseNumber: "",
  healthInstitution: "",
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
    expect(screen.getByRole("header", { name: "Sector salud (opcional)" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Seguridad" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Consentimientos" })).toBeTruthy();
    expect(screen.queryByLabelText("Número de documento")).toBeNull();
    expect(screen.queryByLabelText("Fecha de nacimiento")).toBeNull();
    expect(screen.queryByLabelText("Dirección residencial")).toBeNull();
  });

  // CHG-116 — "Institución de salud" se salía del contenedor y quedaba
  // cortada contra el borde derecho en Android. Al reorganizar la
  // rejilla, los tres campos siguen escribiéndose y conservando su
  // valor: la maquetación no puede llevarse por delante el estado.
  it("conserva lo escrito en los tres campos del sector salud", () => {
    render(<RegistrationForm onBack={jest.fn()} onLogin={jest.fn()} />);

    const campos: Array<[string, string]> = [
      ["Profesión u ocupación en salud", "Médica general"],
      ["Registro o tarjeta profesional", "RM-123456"],
      ["Institución de salud", "Hospital Universitario de Santander"],
    ];

    campos.forEach(([etiqueta, valor]) =>
      fireEvent.changeText(screen.getByLabelText(etiqueta), valor),
    );

    campos.forEach(([etiqueta, valor]) =>
      expect(screen.getByLabelText(etiqueta).props.value).toBe(valor),
    );

    // Y el contenedor del campo lleva la regla que impide el
    // desbordamiento: base real y sin mínimo que fuerce el ancho.
    let nodo = screen.getByLabelText("Institución de salud").parent;
    let estilo: Record<string, unknown> = {};
    while (nodo && estilo.flexBasis === undefined) {
      estilo = StyleSheet.flatten(nodo.props.style) ?? {};
      nodo = nodo.parent;
    }
    expect(estilo.flexBasis).toBe(FIELD_BASIS);
    expect(estilo.minWidth).toBe(0);
  });

  // CHG-077: los datos del sector salud son opcionales pero van juntos.
  it("exige profesión y registro de salud como pareja", () => {
    expect(
      validateRegistrationDraft({
        ...strongDraft,
        healthProfession: "Médica general",
      }),
    ).toEqual(
      expect.arrayContaining([
        "Para el sector salud declara la profesión y el registro profesional juntos.",
      ]),
    );
    expect(
      validateRegistrationDraft({
        ...strongDraft,
        healthProfession: "Médica general",
        healthLicenseNumber: "RM-12345",
        healthInstitution: "Hospital Universitario",
      }),
    ).toEqual([]);
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
    // CHG-185: territorio por lista cerrada — escribir filtra, y el
    // valor se guarda al tocar la opción del catálogo.
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "santand");
    fireEvent.press(screen.getByLabelText("Elegir el departamento Santander"));
    fireEvent.changeText(screen.getByLabelText("Municipio *"), "bucaram");
    fireEvent.press(
      screen.getByLabelText("Elegir el municipio Bucaramanga"),
    );
    fireEvent.press(screen.getByRole("radio", { name: "Organización" }));
    fireEvent.changeText(screen.getByLabelText("Nombre de la organización *"), "Fundación Ayuda");
    fireEvent.changeText(screen.getByLabelText("Función o cargo"), "Coordinadora");
    fireEvent.changeText(screen.getByLabelText("Profesión u ocupación en salud"), "Médica general");
    fireEvent.changeText(screen.getByLabelText("Registro o tarjeta profesional"), "RM-12345");
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
      department: "Santander",
      municipality: "Bucaramanga",
      requestedAccountType: "organization_representative",
      organizationName: "Fundación Ayuda",
      healthProfession: "Médica general",
      healthLicenseNumber: "RM-12345",
      healthInstitution: null,
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

  // CHG-185 — Departamento y municipio salen del catálogo oficial.
  it("rechaza territorio que no está en el catálogo y la pareja imposible", () => {
    expect(
      validateRegistrationDraft({
        ...strongDraft,
        department: "Santanderr",
        municipality: "Bucaramanga",
      }),
    ).toEqual([
      "Elige un departamento de la lista oficial.",
      "Elige un municipio de la lista oficial del departamento elegido.",
    ]);

    expect(
      validateRegistrationDraft({
        ...strongDraft,
        department: "Santander",
        municipality: "Medellín",
      }),
    ).toEqual([
      "Elige un municipio de la lista oficial del departamento elegido.",
    ]);

    expect(
      validateRegistrationDraft({
        ...strongDraft,
        department: "",
        municipality: "",
      }),
    ).toEqual([
      "Elige tu departamento de la lista.",
      "Elige tu municipio de la lista.",
    ]);
  });

  it("no deja elegir municipio antes que departamento", () => {
    render(
      <RegistrationForm
        onBack={jest.fn()}
        onLogin={jest.fn()}
        registerAccount={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Municipio * no disponible")).toBeTruthy();
    expect(screen.getByText("Elige primero el departamento")).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Departamento *"), "quind");
    fireEvent.press(screen.getByLabelText("Elegir el departamento Quindío"));

    expect(screen.queryByLabelText("Municipio * no disponible")).toBeNull();
    expect(screen.getByLabelText("Municipio *")).toBeTruthy();
  });

  it("cambiar de departamento limpia el municipio elegido", () => {
    render(
      <RegistrationForm
        onBack={jest.fn()}
        onLogin={jest.fn()}
        registerAccount={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Departamento *"), "santand");
    fireEvent.press(screen.getByLabelText("Elegir el departamento Santander"));
    fireEvent.changeText(screen.getByLabelText("Municipio *"), "bucaram");
    fireEvent.press(screen.getByLabelText("Elegir el municipio Bucaramanga"));
    expect(screen.getByLabelText("Municipio *: Bucaramanga")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Cambiar departamento"));
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "antioq");
    fireEvent.press(screen.getByLabelText("Elegir el departamento Antioquia"));

    expect(screen.queryByLabelText("Municipio *: Bucaramanga")).toBeNull();
    // El municipio vuelve a pedirse, ahora entre los de Antioquia.
    fireEvent.changeText(screen.getByLabelText("Municipio *"), "bucaram");
    expect(
      screen.queryByLabelText("Elegir el municipio Bucaramanga"),
    ).toBeNull();
  });
});
