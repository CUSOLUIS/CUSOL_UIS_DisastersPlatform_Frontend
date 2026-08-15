import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import {
  initialUnverifiedBuildingDraft,
  UnverifiedBuildingReportForm,
  validateUnverifiedBuildingDraft,
} from "./UnverifiedBuildingReportForm";

const validPhoto: SelectedPhoto = {
  uri: "file:///edificio-frente.jpg",
  name: "edificio-frente.jpg",
  size: 3 * 1024 * 1024,
  mimeType: "image/jpeg",
};

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("CHG-035 · Reporte de edificio con búsqueda pendiente", () => {
  it("explica la semántica segura, privacidad y límites de evidencia", () => {
    render(<UnverifiedBuildingReportForm onBack={jest.fn()} />);

    expect(
      screen.getByRole("header", { name: "Reportar edificio sin verificar" }),
    ).toBeTruthy();
    expect(screen.getByText("OBSERVACIÓN, NO DIAGNÓSTICO")).toBeTruthy();
    expect(screen.getByText(/no confirma que haya personas dentro/i)).toBeTruthy();
    expect(screen.getAllByText(/privad/i).length).toBeGreaterThan(2);
    expect(screen.getByText(/Máximo 3 fotos/)).toBeTruthy();
  });

  it("lista una fotografía y permite retirarla", async () => {
    render(
      <UnverifiedBuildingReportForm
        onBack={jest.fn()}
        pickPhotos={async () => [validPhoto]}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Seleccionar fotografías del edificio",
      }),
    );
    expect(await screen.findByText("edificio-frente.jpg")).toBeTruthy();
    expect(screen.getByText("image/jpeg · 3.00 MiB")).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", {
        name: "Quitar fotografía edificio-frente.jpg",
      }),
    );
    expect(screen.queryByText("edificio-frente.jpg")).toBeNull();
  });

  it("impide enviar un formulario incompleto", () => {
    const submitReport = jest.fn();
    render(
      <UnverifiedBuildingReportForm
        onBack={jest.fn()}
        submitReport={submitReport}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Enviar reporte de edificio para revisión",
      }),
    );

    expect(screen.getByText("Revisa el reporte antes de continuar")).toBeTruthy();
    expect(screen.getByText(/nombre o referencia del edificio/)).toBeTruthy();
    expect(screen.getByText(/al menos un motivo/)).toBeTruthy();
    expect(screen.getByText(/al menos una fotografía/)).toBeTruthy();
    expect(submitReport).not.toHaveBeenCalled();
  });

  it("valida coordenadas emparejadas y fecha real; el evento ya no exige UUID", () => {
    const errors = validateUnverifiedBuildingDraft(
      {
        ...initialUnverifiedBuildingDraft,
        observedDate: "2026-02-30",
        latitude: "7.12",
        // CHG-092: texto libre — el backend lo resuelve o crea.
        relatedEventName: "Sismo en el Centro",
      },
      [validPhoto],
    );

    expect(errors).toContain(
      "La fecha de observación debe ser válida y usar AAAA-MM-DD.",
    );
    expect(errors).toContain(
      "Completa latitud y longitud juntas o deja ambas vacías.",
    );
    expect(
      errors.some((message) => message.includes("UUID")),
    ).toBe(false);
  });

  it("permite reportar una observación ocurrida hoy", () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const errors = validateUnverifiedBuildingDraft(
      { ...initialUnverifiedBuildingDraft, observedDate: today },
      [validPhoto],
    );

    expect(errors).not.toContain(
      "La fecha de observación no puede estar en el futuro.",
    );
  });

  it("envía un reporte válido y muestra comprobante sin afirmar publicación", async () => {
    const submitReport = jest.fn().mockResolvedValue({
      id: "6ef9f631-2461-4804-9b79-78b65d62d59f",
      publicTrackingCode: "BLD-2026-8X41QZ",
      status: "under_review",
      receivedAt: "2026-08-14T17:30:00Z",
    });
    render(
      <UnverifiedBuildingReportForm
        onBack={jest.fn()}
        pickPhotos={async () => [validPhoto]}
        submitReport={submitReport}
      />,
    );

    const fields: Array<[string, string]> = [
      ["Nombre o referencia del edificio *", "Torre norte, bloque B"],
      ["Departamento *", "Santander"],
      ["Municipio *", "Bucaramanga"],
      ["Barrio, vereda o sector *", "Centro"],
      ["Referencia para encontrar el lugar *", "Frente al parque principal"],
      [
        "Describe lo observado *",
        "El acceso principal está cubierto por escombros y no vi personal de búsqueda.",
      ],
      ["Nombre completo *", "Laura Méndez"],
      ["Relación o rol *", "Vecina"],
      ["Teléfono privado", "3001234567"],
    ];
    fields.forEach(([label, value]) =>
      fireEvent.changeText(screen.getByLabelText(label), value),
    );

    // CHG-088: la fecha se elige en el calendario estándar.
    fireEvent.press(
      screen.getByRole("button", { name: "Elegir fecha de observación" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Año 2026" }));
    fireEvent.press(screen.getByRole("button", { name: "Mes AGO de 2026" }));
    fireEvent.press(screen.getByRole("button", { name: "Día 13" }));
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Motivo pendiente: Acceso bloqueado",
      }),
    );
    fireEvent.press(
      screen.getByRole("button", {
        name: "Seleccionar fotografías del edificio",
      }),
    );
    await screen.findByText("edificio-frente.jpg");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: /información es veraz según mi conocimiento/,
      }),
    );
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: /puedo compartir estas fotografías/,
      }),
    );
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: /no creará automáticamente un marcador/,
      }),
    );
    fireEvent.press(
      screen.getByRole("button", {
        name: "Enviar reporte de edificio para revisión",
      }),
    );

    expect(
      await screen.findByRole("header", { name: "Reporte recibido" }),
    ).toBeTruthy();
    expect(screen.getByText("BLD-2026-8X41QZ")).toBeTruthy();
    expect(screen.getByText("EN REVISIÓN")).toBeTruthy();
    expect(screen.getByText(/No se creó un marcador/)).toBeTruthy();
    expect(submitReport).toHaveBeenCalledTimes(1);
  });
});

/**
 * CHG-093 — "Otro motivo" despliega su campo de detalle: aparece al
 * marcar, se limpia y oculta al desmarcar, y es obligatorio al enviar.
 */
describe('Detalle de "Otro motivo" (CHG-093)', () => {
  it("aparece al marcar, y desmarcar lo oculta y limpia", async () => {
    render(<UnverifiedBuildingReportForm onBack={jest.fn()} />);

    expect(
      screen.queryByLabelText("¿Cuál es el otro motivo? *"),
    ).toBeNull();

    fireEvent.press(
      screen.getByRole("checkbox", { name: "Motivo pendiente: Otro motivo" }),
    );
    const detailField = await screen.findByLabelText(
      "¿Cuál es el otro motivo? *",
    );
    expect(detailField.props.placeholder).toBe(
      "Especifica el motivo por el cual sigue pendiente…",
    );

    fireEvent.changeText(detailField, "Cierre por orden de la alcaldía");

    // Desmarcar oculta el campo y limpia el valor.
    fireEvent.press(
      screen.getByRole("checkbox", { name: "Motivo pendiente: Otro motivo" }),
    );
    expect(
      screen.queryByLabelText("¿Cuál es el otro motivo? *"),
    ).toBeNull();

    // Re-marcar: el campo vuelve vacío.
    fireEvent.press(
      screen.getByRole("checkbox", { name: "Motivo pendiente: Otro motivo" }),
    );
    expect(
      (await screen.findByLabelText("¿Cuál es el otro motivo? *")).props
        .value,
    ).toBe("");
  });

  it("bloquea el envío si falta el detalle", () => {
    const errors = validateUnverifiedBuildingDraft(
      {
        ...initialUnverifiedBuildingDraft,
        pendingReasons: ["other"],
      },
      [validPhoto],
    );

    expect(errors).toContain(
      "Especifica el otro motivo por el cual la búsqueda sigue pendiente.",
    );

    const withDetail = validateUnverifiedBuildingDraft(
      {
        ...initialUnverifiedBuildingDraft,
        pendingReasons: ["other"],
        pendingReasonDetail: "Cierre por orden de la alcaldía",
      },
      [validPhoto],
    );
    expect(
      withDetail.some((message) => message.includes("otro motivo")),
    ).toBe(false);
  });
});
