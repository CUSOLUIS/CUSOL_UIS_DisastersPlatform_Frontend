import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { resetVisitorPresenceForTests } from "../operational-map/visitorPresence";
import {
  DamagedHomeForm,
  collectDamagedHomeIssues,
  initialDamagedHomeDraft,
} from "./DamagedHomeForm";
import { buildDamagedHomePayload } from "./reportSubmission";
import type { DamagedHomeReceipt } from "./types";

// El formulario dispara geocodificación inversa de mejor esfuerzo al
// fijar el punto; en pruebas no hay red y el fallo debe ser silencioso.
beforeEach(() => {
  jest
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("sin red en pruebas"));
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  resetVisitorPresenceForTests();
});

const anonymousSession = {
  getCurrentAccount: () => Promise.reject(new Error("sin sesión")),
};

const validDraft = {
  ...initialDamagedHomeDraft,
  description: "El techo se vino abajo y la pared del patio quedó en el suelo.",
  municipality: "Mompós",
  department: "Bolívar",
  address: "Albarrada del medio #12-40",
  truthConfirmed: true,
};

describe("collectDamagedHomeIssues (CHG-162)", () => {
  it("acepta un informe completo", () => {
    expect(collectDamagedHomeIssues(validDraft)).toEqual([]);
  });

  it("exige descripción, ciudad, dirección y confirmación", () => {
    const fields = collectDamagedHomeIssues(initialDamagedHomeDraft).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual([
      "description",
      "municipality",
      "department",
      "address",
      "truthConfirmed",
    ]);
  });

  it("rechaza la descripción demasiado corta y coordenadas fuera de rango", () => {
    const shortDescription = collectDamagedHomeIssues({
      ...validDraft,
      description: "Se cayó",
    }).map((issue) => issue.field);
    expect(shortDescription).toEqual(["description"]);

    const outOfRange = collectDamagedHomeIssues({
      ...validDraft,
      latitude: "97.5",
      longitude: "-73.1",
    }).map((issue) => issue.field);
    expect(outOfRange).toEqual(["location"]);
  });
});

describe("buildDamagedHomePayload (CHG-162)", () => {
  it("envía el contrato mínimo y omite coordenadas incompletas", () => {
    expect(
      buildDamagedHomePayload({ ...validDraft, latitude: "9.24280" }),
    ).toEqual({
      description:
        "El techo se vino abajo y la pared del patio quedó en el suelo.",
      municipality: "Mompós",
      department: "Bolívar",
      address: "Albarrada del medio #12-40",
    });
  });

  it("incluye las coordenadas cuando viajan en pareja", () => {
    expect(
      buildDamagedHomePayload({
        ...validDraft,
        latitude: "9.24280",
        longitude: "-74.42580",
      }),
    ).toMatchObject({ latitude: 9.2428, longitude: -74.4258 });
  });
});

describe("DamagedHomeForm (CHG-162)", () => {
  it("publica el informe de forma anónima y muestra la constancia", async () => {
    const receipt: DamagedHomeReceipt = {
      id: "44444444-4444-4444-8444-444444444404",
      createdAt: "2026-08-18T12:00:00Z",
    };
    const submitReport = jest.fn().mockResolvedValue(receipt);

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={anonymousSession}
        submitReport={submitReport}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Descripción del daño *"),
      "El techo se vino abajo y la pared del patio quedó en el suelo.",
    );
    fireEvent.changeText(screen.getByLabelText("Municipio *"), "Mompós");
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "Bolívar");
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Albarrada del medio #12-40",
    );
    fireEvent.press(
      screen.getByLabelText(
        "Confirmo que el hogar está en las condiciones descritas y la información es real.",
      ),
    );
    fireEvent.press(screen.getByLabelText("Publicar informe del hogar"));

    await waitFor(() =>
      expect(screen.getByText("Informe publicado")).toBeTruthy(),
    );
    expect(submitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "El techo se vino abajo y la pared del patio quedó en el suelo.",
        municipality: "Mompós",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("bloquea el envío incompleto con el resumen de errores", () => {
    const submitReport = jest.fn();

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={anonymousSession}
        submitReport={submitReport}
      />,
    );

    fireEvent.press(screen.getByLabelText("Publicar informe del hogar"));
    expect(submitReport).not.toHaveBeenCalled();
    expect(
      screen.getByText("Revisa el informe antes de continuar"),
    ).toBeTruthy();
  });

  // CHG-160 (criterio 2 de CHG-162): el informe del hogar trae la misma
  // paridad de ubicación que los puntos logísticos — dirección que se
  // completa sola (CHG-156), «CRUZAR DIRECCIÓN», «COLOCAR MUÑEQUITO» y
  // el mapa (CHG-147/155).
  it("cumple la paridad de reglas de ubicación (CHG-160)", () => {
    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={anonymousSession}
        submitReport={jest.fn()}
      />,
    );

    expect(
      screen.getByText("Se completa sola al fijar el punto; siempre editable"),
    ).toBeTruthy();
    expect(screen.getByText("UBICACIÓN EN EL MAPA · OPCIONAL")).toBeTruthy();
    expect(
      screen.getByLabelText("Cruzar la dirección escrita con el mapa"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Colocar el muñequito en el centro del mapa"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Municipio *")).toBeTruthy();
    expect(screen.getByLabelText("Departamento *")).toBeTruthy();
  });
});
