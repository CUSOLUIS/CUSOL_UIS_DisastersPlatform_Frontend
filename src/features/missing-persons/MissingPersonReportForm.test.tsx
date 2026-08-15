import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
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

  it("impide preparar un formulario incompleto", () => {
    render(<MissingPersonReportForm onBack={jest.fn()} />);

    fireEvent.press(screen.getByRole("button", { name: "Enviar reporte para revisión" }));

    expect(screen.getByText("Revisa el reporte antes de continuar")).toBeTruthy();
    expect(screen.getByText(/Ingresa los nombres/)).toBeTruthy();
    expect(screen.getByText(/Adjunta al menos una fotografía/)).toBeTruthy();
    expect(screen.getByText(/aceptar las tres confirmaciones/)).toBeTruthy();
  });

  it("prepara un reporte válido con estado en revisión sin publicarlo", async () => {
    const submitReport = jest.fn().mockResolvedValue({
      publicCaseCode: "DEMO-987654",
      status: "under_review",
      receivedAt: "2026-08-12T20:00:00.000Z",
    });
    render(
      <MissingPersonReportForm
        onBack={jest.fn()}
        pickPhotos={async () => [validPhoto]}
        submitReport={submitReport}
      />,
    );

    const values: Array<[string, string]> = [
      ["Nombres *", "Valentina"],
      ["Apellidos *", "Rojas"],
      ["Fecha *", "2026-08-11"],
      ["Departamento *", "Cundinamarca"],
      ["Municipio *", "Soacha"],
      ["Zona o lugar de referencia *", "Parque central"],
      ["Vestimenta *", "Chaqueta amarilla"],
      ["Circunstancias de la desaparición *", "Se perdió contacto durante la evacuación"],
      ["Nombre completo *", "Ana Rojas"],
      ["Relación con la persona *", "Hermana"],
      ["Teléfono privado", "3001234567"],
    ];
    values.forEach(([label, value]) => fireEvent.changeText(screen.getByLabelText(label), value));

    fireEvent.press(screen.getByRole("button", { name: "Seleccionar una o varias fotografías" }));
    await screen.findByText("foto-valentina.jpg");
    fireEvent.press(screen.getByRole("checkbox", { name: "Confirmo que la información es veraz según mi conocimiento." }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Confirmo que tengo autorización para compartir estas fotografías." }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Entiendo que el reporte será revisado y no se publicará automáticamente." }));
    fireEvent.press(screen.getByRole("button", { name: "Enviar reporte para revisión" }));

    expect(await screen.findByRole("header", { name: "Reporte preparado" })).toBeTruthy();
    expect(screen.getByText("DEMO-987654")).toBeTruthy();
    expect(screen.getByText("EN REVISIÓN")).toBeTruthy();
    expect(submitReport).toHaveBeenCalledTimes(1);
  });
});
