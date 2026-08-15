import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { colors } from "../../theme";
import { MissingPersonReportForm } from "./MissingPersonReportForm";
import { MAX_PHOTO_BYTES, validateAndMergePhotos } from "./photoValidation";
import type { SelectedPhoto } from "./reportTypes";

const validPhoto: SelectedPhoto = {
  uri: "file:///foto-valentina.jpg",
  name: "foto-valentina.jpg",
  size: 2 * 1024 * 1024,
  mimeType: "image/jpeg",
};

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("Reporte de persona perdida", () => {
  // CHG-078 — Con sesión activa el formulario deja de tratar al
  // usuario como anónimo: sin botones de registro/inicio de sesión y
  // con confirmación de que el reporte quedará asociado a la cuenta.
  it("reconoce la sesión activa y confirma la asociación a la cuenta", async () => {
    const sessionSource = {
      getCurrentAccount: jest.fn().mockResolvedValue({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        displayName: "Laura Gómez",
        email: "laura@example.com",
        assignedRole: "user" as const,
        status: "active" as const,
        sessionExpiresAt: "2026-08-16T10:00:00Z",
      }),
    };
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        onRegister={jest.fn()}
        onLogin={jest.fn()}
        sessionSource={sessionSource}
      />,
    );

    expect(
      await screen.findByText("SESIÓN ACTIVA · REPORTANDO CON TU CUENTA"),
    ).toBeTruthy();
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
    expect(sessionSource.getCurrentAccount).toHaveBeenCalledTimes(1);
  });

  it("sin sesión conserva los accesos de registro e inicio de sesión", async () => {
    const sessionSource = {
      getCurrentAccount: jest
        .fn()
        .mockRejectedValue(new Error("Tu sesión está ausente.")),
    };
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        onRegister={jest.fn()}
        onLogin={jest.fn()}
        sessionSource={sessionSource}
      />,
    );

    expect(
      await screen.findByRole("button", {
        name: "Registrarme para reportar con cuenta",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByText("SESIÓN ACTIVA · REPORTANDO CON TU CUENTA"),
    ).toBeNull();
  });

  // CHG-083 — Precarga editable, resaltado inline y salida a portada.
  it("precarga (editable) los datos del reportante desde la sesión", async () => {
    const sessionSource = {
      getCurrentAccount: jest.fn().mockResolvedValue({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        displayName: "Laura Gómez",
        email: "laura@example.com",
        phone: "+57 3001234567",
        assignedRole: "user" as const,
        status: "active" as const,
        sessionExpiresAt: "2026-08-16T10:00:00Z",
      }),
    };
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        sessionSource={sessionSource}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText("Nombre completo *").props.value,
      ).toBe("Laura Gómez"),
    );
    expect(screen.getByLabelText("Correo privado").props.value).toBe(
      "laura@example.com",
    );
    expect(screen.getByLabelText("Teléfono privado").props.value).toBe(
      "+57 3001234567",
    );

    // Sigue siendo editable para este reporte.
    fireEvent.changeText(
      screen.getByLabelText("Nombre completo *"),
      "Otra Persona",
    );
    expect(
      screen.getByLabelText("Nombre completo *").props.value,
    ).toBe("Otra Persona");
  });

  it("resalta los campos con error al intentar publicar", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Publicar reporte" }));

    // El banner general se conserva…
    expect(screen.getByText("Revisa el reporte antes de continuar")).toBeTruthy();
    expect(
      screen.getByText(/al menos un teléfono o correo de contacto privado/),
    ).toBeTruthy();
    // …y además el par teléfono/correo queda resaltado en rojo.
    const phoneStyle = StyleSheet.flatten(
      screen.getByLabelText("Teléfono privado").props.style,
    );
    const emailStyle = StyleSheet.flatten(
      screen.getByLabelText("Correo privado").props.style,
    );
    expect(phoneStyle.borderColor).toBe(colors.reported);
    expect(emailStyle.borderColor).toBe(colors.reported);
    // Un campo opcional sin error no se resalta.
    const aliasStyle = StyleSheet.flatten(
      screen.getByLabelText("Alias o nombre conocido").props.style,
    );
    expect(aliasStyle.borderColor).not.toBe(colors.reported);
  });

  it("explica formatos, límites y privacidad", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    expect(screen.getByRole("header", { name: "Reportar persona perdida" })).toBeTruthy();
    expect(screen.getByText(/JPEG \(\.jpg, \.jpeg\), PNG/)).toBeTruthy();
    expect(screen.getByText(/Máximo 3 fotos/)).toBeTruthy();
    expect(screen.getAllByText(/DATOS PRIVADOS/).length).toBeGreaterThan(0);
  });

  it("lista las fotos seleccionadas y permite retirarlas", async () => {
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        pickPhotos={async () => [validPhoto]}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Seleccionar una o varias fotografías" }),
    );

    expect(await screen.findByText("foto-valentina.jpg")).toBeTruthy();
    expect(screen.getByText("image/jpeg · 2.00 MiB")).toBeTruthy();
    fireEvent.press(
      screen.getByRole("button", { name: "Quitar fotografía foto-valentina.jpg" }),
    );
    expect(screen.queryByText("foto-valentina.jpg")).toBeNull();
  });

  it("rechaza formatos y cantidades inválidas sin borrar la selección válida", () => {
    const wrongType = validateAndMergePhotos([validPhoto], [
      { uri: "file:///archivo.gif", name: "archivo.gif", size: 20, mimeType: "image/gif" },
    ]);
    expect(wrongType.photos).toEqual([validPhoto]);
    expect(wrongType.errors[0]).toMatch(/formato no está permitido/);

    // CHG-071: las fotos grandes ya no se rechazan al seleccionarlas —
    // se comprimen automáticamente antes de guardarse.
    const oversized = validateAndMergePhotos([], [
      { ...validPhoto, name: "grande.jpg", size: MAX_PHOTO_BYTES + 1 },
    ]);
    expect(oversized.photos).toHaveLength(1);
    expect(oversized.errors).toHaveLength(0);

    const tooMany = validateAndMergePhotos([validPhoto], Array(3).fill(validPhoto));
    expect(tooMany.photos).toEqual([validPhoto]);
    expect(tooMany.errors[0]).toMatch(/máximo 3/);
  });

  it("impide publicar un formulario incompleto", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Publicar reporte" }));

    expect(screen.getByText("Revisa el reporte antes de continuar")).toBeTruthy();
    expect(screen.getByText(/Ingresa los nombres/)).toBeTruthy();
    expect(screen.getByText(/Adjunta al menos una fotografía/)).toBeTruthy();
    expect(screen.getByText(/aceptar las dos confirmaciones/)).toBeTruthy();
  });

  // CHG-075: el reporte se publica de inmediato al enviarse.
  it("publica un reporte válido inmediatamente", async () => {
    const submitReport = jest.fn().mockResolvedValue({
      publicCaseCode: "DEMO-987654",
      status: "published",
      receivedAt: "2026-08-12T20:00:00.000Z",
    });
    const onHome = jest.fn();
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        onHome={onHome}
        pickPhotos={async () => [validPhoto]}
        submitReport={submitReport}
      />,
    );

    const values: Array<[string, string]> = [
      ["Nombres *", "Valentina"],
      ["Apellidos *", "Rojas"],
      ["Departamento *", "Cundinamarca"],
      ["Municipio *", "Soacha"],
      ["Dirección *", "Parque central"],
      ["Vestimenta *", "Chaqueta amarilla"],
      ["Circunstancias de la desaparición *", "Se perdió contacto durante la evacuación"],
      ["Nombre completo *", "Ana Rojas"],
      ["Relación con la persona *", "Hermana"],
      ["Teléfono privado", "3001234567"],
    ];
    values.forEach(([label, value]) => fireEvent.changeText(screen.getByLabelText(label), value));

    // CHG-088: la fecha se elige en el calendario estándar.
    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de la última visualización" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Año 2026" }));
    fireEvent.press(screen.getByRole("button", { name: "Mes AGO de 2026" }));
    fireEvent.press(screen.getByRole("button", { name: "Día 11" }));

    fireEvent.press(screen.getByRole("button", { name: "Seleccionar una o varias fotografías" }));
    await screen.findByText("foto-valentina.jpg");
    fireEvent.press(screen.getByRole("checkbox", { name: "Confirmo que la información es veraz según mi conocimiento." }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Confirmo que tengo autorización para compartir estas fotografías." }));
    fireEvent.press(screen.getByRole("button", { name: "Publicar reporte" }));

    expect(await screen.findByRole("header", { name: "Reporte publicado" })).toBeTruthy();
    expect(screen.getByText("DEMO-987654")).toBeTruthy();
    expect(screen.getByText("PUBLICADO")).toBeTruthy();
    expect(submitReport).toHaveBeenCalledTimes(1);

    // CHG-083: VOLVER A LA PORTADA navega a la ruta principal.
    fireEvent.press(
      screen.getByRole("button", { name: "Volver a la portada" }),
    );
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});

// CHG-073 — Listas cerradas y mini agenda: sin texto libre en sexo,
// nacionalidad, tipo de documento ni fecha de nacimiento.
describe("Listas cerradas del formulario de persona", () => {
  it("permite elegir sexo, nacionalidad y tipo de documento solo de las listas", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Sexo: Mujer" }));

    fireEvent.press(screen.getByRole("button", { name: "Nacionalidad" }));
    fireEvent.changeText(
      screen.getByLabelText("Buscar nacionalidad"),
      "colomb",
    );
    fireEvent.press(await screen.findByRole("button", { name: "Colombiana" }));
    expect(screen.getByText("Colombiana")).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "Tipo de documento · privado" }),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Cédula de ciudadanía" }),
    );
    expect(screen.getByText("Cédula de ciudadanía")).toBeTruthy();
  });

  it("la fecha de nacimiento se elige en la mini agenda (año, mes y día)", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de nacimiento" }),
    );
    expect(screen.getByTestId("birth-date-calendar")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Año 1990" }));
    fireEvent.press(screen.getByRole("button", { name: "Mes MAY de 1990" }));
    fireEvent.press(screen.getByRole("button", { name: "Día 20" }));

    expect(screen.getByText("1990-05-20")).toBeTruthy();
    expect(screen.queryByTestId("birth-date-calendar")).toBeNull();
  });
});

// CHG-089 — La hora se elige en el selector estándar (24 h, bloques
// de 15 minutos), sin texto libre.
describe("Selector de hora estándar", () => {
  it("elige la hora en bloques y produce HH:MM", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "Elegir hora de la última visualización",
      }),
    );
    expect(screen.getByTestId("last-seen-time-picker")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Hora 18" }));
    fireEvent.press(
      screen.getByRole("button", { name: "Minutos 30 de las 18" }),
    );

    expect(screen.getByText("18:30")).toBeTruthy();
    expect(screen.queryByTestId("last-seen-time-picker")).toBeNull();
  });
});
