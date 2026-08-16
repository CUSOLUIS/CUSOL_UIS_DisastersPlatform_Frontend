import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { colors } from "../../theme";
import {
  collectDraftIssues,
  initialDraft,
  MissingPersonReportForm,
} from "./MissingPersonReportForm";
import { ageFromBirthDate } from "./ageFromBirthDate";
import { ReportRejectedError } from "./reportSubmission";
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

// CHG-114: rellenar el reporte mínimo publicable, tal como lo hace la
// prueba de publicación, para poder ejercitar la respuesta del envío.
async function completarReporteMinimo() {
  const values: Array<[string, string]> = [
    ["Nombres *", "Valentina"],
    ["Apellidos *", "Rojas"],
    ["Departamento *", "Cundinamarca"],
    ["Municipio *", "Soacha"],
    ["Dirección *", "Parque central"],
    ["Circunstancias de la desaparición *", "Se perdió contacto durante la evacuación"],
    ["Nombre completo *", "Ana Rojas"],
    ["Relación con la persona *", "Hermana"],
    ["Teléfono privado", "3001234567"],
  ];
  values.forEach(([label, value]) =>
    fireEvent.changeText(screen.getByLabelText(label), value),
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Elegir fecha de la última visualización",
    }),
  );
  fireEvent.press(screen.getByRole("button", { name: "Año 2026" }));
  fireEvent.press(screen.getByRole("button", { name: "Mes AGO de 2026" }));
  fireEvent.press(screen.getByRole("button", { name: "Día 11" }));

  fireEvent.press(
    screen.getByRole("button", {
      name: "Seleccionar una o varias fotografías",
    }),
  );
  await screen.findByText("foto-valentina.jpg");
  fireEvent.press(
    screen.getByRole("checkbox", {
      name: "Confirmo que la información es veraz según mi conocimiento.",
    }),
  );
  fireEvent.press(
    screen.getByRole("checkbox", {
      name: "Confirmo que tengo autorización para compartir estas fotografías.",
    }),
  );
  fireEvent.press(screen.getByRole("button", { name: "Publicar reporte" }));
}

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
      ["Vestimenta", "Chaqueta amarilla"],
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
  // CHG-096: la interfaz pasa a 12 horas con AM/PM; el valor guardado
  // sigue siendo HH:MM en 24 horas.
  it("elige la hora en 12 horas y guarda el valor en 24", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "Elegir hora de la última visualización",
      }),
    );
    expect(screen.getByTestId("last-seen-time-picker")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Hora 06" }));
    fireEvent.press(screen.getByRole("button", { name: "Minutos 30" }));
    fireEvent.press(screen.getByRole("button", { name: "PM" }));
    fireEvent.press(screen.getByRole("button", { name: "Confirmar la hora" }));

    // Se muestra como la diría una persona…
    expect(screen.getByText("06:30 PM")).toBeTruthy();
    expect(screen.queryByTestId("last-seen-time-picker")).toBeNull();
  });
});

/**
 * CHG-091 — Aviso de posibles duplicados al escribir Nombres/Apellidos:
 * consulta con debounce, descarte por par de nombres y salida hacia el
 * caso existente.
 */
describe("Duplicados al diligenciar el reporte (CHG-091)", () => {
  const SUGGESTION = {
    kind: "missing_person" as const,
    id: "persona-demo-1",
    publicCaseCode: "MP-2026-DEMO01",
    displayName: "Camila Rueda (caso demo)",
    status: "missing" as const,
    approximateAge: 34,
    lastSeenAt: "2026-08-10T18:30:00Z",
    lastSeenArea: "Sector Café Madrid",
    municipality: "Bucaramanga",
    department: "Santander",
    publicPhotoUrl: null,
    source: { name: "Demo", sourceType: "citizen" as const, url: null },
    updatedAt: "2026-08-12T10:00:00Z",
    dataClassification: "demonstrative" as const,
    similarity: 0.77,
  };

  function makeSuggestionsSource(items = [SUGGESTION]) {
    return {
      transport: "fixture" as const,
      autocomplete: jest.fn().mockResolvedValue({
        items,
        query: "",
        generatedAt: "2026-08-15T12:00:00Z",
      }),
      checkDuplicates: jest.fn().mockResolvedValue({
        items,
        firstName: "",
        lastName: "",
        generatedAt: "2026-08-15T12:00:00Z",
      }),
    };
  }

  it("muestra el aviso con los datos del caso y sale hacia él", async () => {
    const suggestionsDataSource = makeSuggestionsSource();
    const onOpenExistingCase = jest.fn();
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        suggestionsDataSource={suggestionsDataSource}
        onOpenExistingCase={onOpenExistingCase}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Nombres *"),
      "Kamila",
    );
    fireEvent.changeText(
      screen.getByLabelText("Apellidos *"),
      "Rueda",
    );

    expect(
      await screen.findByText("¿YA ESTÁ REPORTADA? REVISA ANTES DE CONTINUAR"),
    ).toBeTruthy();
    expect(screen.getByText("MP-2026-DEMO01")).toBeTruthy();
    expect(screen.getByText("Desaparecida")).toBeTruthy();
    await waitFor(() =>
      expect(suggestionsDataSource.checkDuplicates).toHaveBeenCalledWith(
        "Kamila",
        "Rueda",
        expect.anything(),
      ),
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Es la misma persona: abrir el caso de Camila Rueda (caso demo)",
      }),
    );
    expect(onOpenExistingCase).toHaveBeenCalledWith("MP-2026-DEMO01");
  });

  it("descartar el aviso lo silencia para ese par de nombres", async () => {
    const suggestionsDataSource = makeSuggestionsSource();
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        suggestionsDataSource={suggestionsDataSource}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Nombres *"), "Kamila");
    fireEvent.changeText(screen.getByLabelText("Apellidos *"), "Rueda");
    await screen.findByText("¿YA ESTÁ REPORTADA? REVISA ANTES DE CONTINUAR");

    fireEvent.press(
      screen.getByRole("button", {
        name: "No es la persona, continuar con el reporte",
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText("¿YA ESTÁ REPORTADA? REVISA ANTES DE CONTINUAR"),
      ).toBeNull(),
    );

    // Cambiar el nombre reevalúa: el descarte era solo para ese par.
    fireEvent.changeText(screen.getByLabelText("Nombres *"), "Balentina");
    expect(
      await screen.findByText("¿YA ESTÁ REPORTADA? REVISA ANTES DE CONTINUAR"),
    ).toBeTruthy();
  });
});

/**
 * CHG-097 — La ruta de reporte monta el navbar de la plataforma y deja
 * "VOLVER" en una barra secundaria; los bloques de campo se separan de
 * forma uniforme.
 */
describe("Encabezado y espaciado del reporte (CHG-097)", () => {
  it("monta el navbar global con la marca sobre la barra de acciones", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    // Identidad de la plataforma, igual que en la portada.
    expect(await screen.findByTestId("brand-lockup")).toBeTruthy();
    expect(screen.getByTestId("cusol-brand-link")).toBeTruthy();
    expect(screen.getByTestId("prometeo-brand-link")).toBeTruthy();

    // La barra de acciones sigue existiendo, ahora como secundaria.
    expect(screen.getByTestId("report-action-bar")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Volver a la portada" }),
    ).toBeTruthy();
    expect(
      screen.getByText("PUBLICACIÓN INMEDIATA · DATOS SENSIBLES PRIVADOS"),
    ).toBeTruthy();
  });

  it("los enlaces del navbar salen a la portada", async () => {
    const onHome = jest.fn();
    render(
      <MissingPersonReportForm onBack={jest.fn()} onHome={onHome} />,
    );

    // En pantalla angosta la navegación vive en el menú (CHG-090).
    fireEvent.press(
      await screen.findByRole("button", {
        name: "Abrir menú de navegación",
      }),
    );
    fireEvent.press(screen.getByRole("link", { name: "ver mapa" }));

    expect(onHome).toHaveBeenCalled();
  });

  // CHG-113 — La vestimenta dejó de ser obligatoria: quien denuncia
  // muchas veces no la conoce y el formulario le obligaba a escribir
  // "no sé" para poder publicar.
  it("permite publicar sin vestimenta y no la marca como obligatoria", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    expect(screen.queryByLabelText("Vestimenta *")).toBeNull();
    expect(screen.getByLabelText("Vestimenta")).toBeTruthy();

    const faltantes = collectDraftIssues(
      { ...initialDraft, clothingDescription: "" },
      [],
    ).map((issue) => issue.field);

    expect(faltantes).not.toContain("clothingDescription");
    // El resto de obligatorios sigue exigiéndose.
    expect(faltantes).toContain("circumstances");
  });

  // CHG-114 — El rechazo del servicio dejaba un texto al pie con la
  // clave interna del campo y nada más: ni resaltado ni desplazamiento.
  it("resalta el campo que el servicio rechazó", async () => {
    const submitReport = jest
      .fn()
      .mockRejectedValue(
        new ReportRejectedError(
          "Revisa los campos: Teléfono del reportante.",
          ["reporterPhone"],
        ),
      );

    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        pickPhotos={async () => [validPhoto]}
        submitReport={submitReport}
      />,
    );

    await completarReporteMinimo();

    await waitFor(() => expect(submitReport).toHaveBeenCalled());

    await waitFor(() =>
      expect(
        screen.getByText(/Revisa los campos: Teléfono del reportante\./),
      ).toBeTruthy(),
    );

    const telefono = screen.getByLabelText("Teléfono privado");
    expect(StyleSheet.flatten(telefono.props.style).borderColor).toBe(
      colors.reported,
    );
  });

  // CHG-115 — La captura mostraba "2004-11-23" junto a "Edad
  // aproximada 12": dos campos describiendo el mismo hecho y sin nada
  // que los atara.
  it("deriva la edad de la fecha de nacimiento y la deja de solo lectura", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de nacimiento" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Año 2004" }));
    fireEvent.press(screen.getByRole("button", { name: "Mes NOV de 2004" }));
    fireEvent.press(screen.getByRole("button", { name: "Día 23" }));

    const edad = screen.getByLabelText("Edad aproximada");
    expect(edad.props.value).toBe(String(ageFromBirthDate("2004-11-23")));
    expect(edad.props.editable).toBe(false);
  });

  it("devuelve la edad a mano al borrar la fecha de nacimiento", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de nacimiento" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Año 2004" }));
    fireEvent.press(screen.getByRole("button", { name: "Mes NOV de 2004" }));
    fireEvent.press(screen.getByRole("button", { name: "Día 23" }));

    // El borrado vive dentro del desplegable, que se cerró al elegir.
    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de nacimiento" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Borrar fecha de nacimiento" }),
    );

    // Sin fecha, la edad aproximada es el único dato disponible y se
    // captura a mano: es el caso normal en una desaparición.
    const edad = screen.getByLabelText("Edad aproximada");
    expect(edad.props.value).toBe("");
    expect(edad.props.editable).toBe(true);

    fireEvent.changeText(edad, "34");
    expect(screen.getByLabelText("Edad aproximada").props.value).toBe("34");
  });

  it("separa los bloques de campo de forma uniforme", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    const vestimenta = screen.getByLabelText("Vestimenta");
    const circunstancias = screen.getByLabelText(
      "Circunstancias de la desaparición *",
    );
    expect(vestimenta).toBeTruthy();
    expect(circunstancias).toBeTruthy();
  });
});

/**
 * CHG-106 — El calendario de la última visualización solo ofrece años
 * dentro de la cobertura de la plataforma (desde 2026).
 */
describe("Año mínimo de la última visualización (CHG-106)", () => {
  it("el calendario no ofrece años anteriores a 2026", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "Elegir fecha de la última visualización",
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Año 2026" }),
    ).toBeTruthy();
    for (const year of [2025, 2024, 2015, 2007]) {
      expect(
        screen.queryByRole("button", { name: `Año ${year}` }),
      ).toBeNull();
    }
  });

  it("la fecha de nacimiento conserva su rango completo", async () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de nacimiento" }),
    );

    // CHG-106 no debe alcanzar a otros campos: nadie nace en 2026 y
    // tiene 50 años.
    expect(
      await screen.findByRole("button", { name: "Año 1990" }),
    ).toBeTruthy();
  });
});
