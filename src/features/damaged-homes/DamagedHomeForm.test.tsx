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

// CHG-182: publicar exige cuenta, así que las pruebas del formulario
// entran con sesión; la anónima ahora sirve para probar el portón.
const accountSession = {
  getCurrentAccount: () =>
    Promise.resolve({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      displayName: "Familia Mosquera",
      email: "familia@cusol.local",
      assignedRole: "user" as const,
      status: "active" as const,
      sessionExpiresAt: "2099-01-01T00:00:00Z",
    }),
};

const validDraft = {
  ...initialDamagedHomeDraft,
  description: "El techo se vino abajo y la pared del patio quedó en el suelo.",
  municipality: "Mompós",
  department: "Bolívar",
  address: "Albarrada del medio #12-40",
  householdSize: "5",
  truthConfirmed: true,
};

describe("collectDamagedHomeIssues (CHG-162 / CHG-182)", () => {
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
      // CHG-182: cuántas personas viven en la casa.
      "householdSize",
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

describe("buildDamagedHomePayload (CHG-162 / CHG-182)", () => {
  it("envía el contrato mínimo y omite coordenadas incompletas", () => {
    expect(
      buildDamagedHomePayload({ ...validDraft, latitude: "9.24280" }),
    ).toEqual({
      description:
        "El techo se vino abajo y la pared del patio quedó en el suelo.",
      municipality: "Mompós",
      department: "Bolívar",
      address: "Albarrada del medio #12-40",
      // CHG-182: cuántas personas viven en la casa.
      householdSize: 5,
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

describe("DamagedHomeForm (CHG-182)", () => {
  it("publica la casita con cuenta y muestra la constancia", async () => {
    const receipt: DamagedHomeReceipt = {
      id: "44444444-4444-4444-8444-444444444404",
      createdAt: "2026-08-18T12:00:00Z",
    };
    const submitReport = jest.fn().mockResolvedValue(receipt);

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        submitReport={submitReport}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Qué sucedió y cómo quedó la casa *"),
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
    fireEvent.changeText(
      await screen.findByLabelText("Personas que viven en la casa *"),
      "5",
    );
    fireEvent.press(screen.getByLabelText("Publicar mi casita destruida"));

    await waitFor(() =>
      expect(screen.getByText("Tu casita quedó publicada")).toBeTruthy(),
    );
    expect(submitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "El techo se vino abajo y la pared del patio quedó en el suelo.",
        municipality: "Mompós",
      }),
      // CHG-162 (F2): las fotografías son opcionales y viajan aparte.
      [],
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("bloquea el envío incompleto con el resumen de errores", async () => {
    const submitReport = jest.fn();

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        submitReport={submitReport}
      />,
    );

    // Solo se llena una parte: el resto tiene que reclamarse.
    fireEvent.changeText(
      await screen.findByLabelText("Personas que viven en la casa *"),
      "5",
    );
    fireEvent.press(screen.getByLabelText("Publicar mi casita destruida"));
    expect(submitReport).not.toHaveBeenCalled();
    expect(
      screen.getByText("Revisa el informe antes de continuar"),
    ).toBeTruthy();
  });

  // CHG-160 (criterio 2 de CHG-162): el informe del hogar trae la misma
  // paridad de ubicación que los puntos logísticos — dirección que se
  // completa sola (CHG-156), «CRUZAR DIRECCIÓN», «COLOCAR MUÑEQUITO» y
  // el mapa (CHG-147/155).
  it("cumple la paridad de reglas de ubicación (CHG-160)", async () => {
    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        submitReport={jest.fn()}
      />,
    );

    expect(
      await screen.findByText(
        "Se completa sola al fijar el punto; siempre editable",
      ),
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

  // CHG-162 (F2): las fotos del daño acompañan al informe.
  it("adjunta fotografías del daño y las envía con el informe", async () => {
    const receipt: DamagedHomeReceipt = {
      id: "44444444-4444-4444-8444-444444444405",
      createdAt: "2026-08-18T12:00:00Z",
    };
    const submitReport = jest.fn().mockResolvedValue(receipt);
    const pickPhotos = jest.fn().mockResolvedValue([
      {
        uri: "file:///casita.jpg",
        name: "casita.jpg",
        size: 1024,
        mimeType: "image/jpeg",
      },
    ]);

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        pickPhotos={pickPhotos}
        submitReport={submitReport}
      />,
    );

    fireEvent.press(
      await screen.findByLabelText("Seleccionar fotografías del daño"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("selected-damaged-home-photo-0")).toBeTruthy(),
    );

    fireEvent.changeText(
      await screen.findByLabelText("Qué sucedió y cómo quedó la casa *"),
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
    fireEvent.changeText(
      screen.getByLabelText("Personas que viven en la casa *"),
      "5",
    );
    fireEvent.press(screen.getByLabelText("Publicar mi casita destruida"));

    await waitFor(() =>
      expect(screen.getByText("Tu casita quedó publicada")).toBeTruthy(),
    );
    expect(submitReport).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ name: "casita.jpg" })],
      expect.anything(),
    );
  });

  it("permite quitar una fotografía adjuntada", async () => {
    const pickPhotos = jest.fn().mockResolvedValue([
      {
        uri: "file:///casita.jpg",
        name: "casita.jpg",
        size: 1024,
        mimeType: "image/jpeg",
      },
    ]);

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        pickPhotos={pickPhotos}
        submitReport={jest.fn()}
      />,
    );

    fireEvent.press(
      await screen.findByLabelText("Seleccionar fotografías del daño"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("selected-damaged-home-photo-0")).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText("Quitar fotografía casita.jpg"));

    expect(screen.queryByTestId("selected-damaged-home-photo-0")).toBeNull();
  });

  // CHG-182 — Publicar exige cuenta: sin sesión no hay formulario.
  it("sin sesión muestra el portón y no deja publicar", async () => {
    const submitReport = jest.fn();

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={anonymousSession}
        submitReport={submitReport}
      />,
    );

    expect(await screen.findByTestId("session-gate")).toBeTruthy();
    expect(
      screen.queryByLabelText("Qué sucedió y cómo quedó la casa *"),
    ).toBeNull();
    expect(
      screen.queryByLabelText("Publicar mi casita destruida"),
    ).toBeNull();
    expect(submitReport).not.toHaveBeenCalled();
  });

  // CHG-182 — El medio de ayuda va completo o no va.
  it("exige el dato de transferencia al elegir un medio de ayuda", async () => {
    const submitReport = jest.fn();

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        submitReport={submitReport}
      />,
    );

    fireEvent.press(await screen.findByTestId("donation-channel-Nequi"));
    // Al elegir el canal aparece el campo del dato exacto.
    expect(await screen.findByLabelText("A dónde transferir *")).toBeTruthy();
    expect(
      screen.getByText(/no verifica este dato ni intermedia/i),
    ).toBeTruthy();
  });

  it("envía el medio de ayuda cuando está completo", async () => {
    const receipt: DamagedHomeReceipt = {
      id: "44444444-4444-4444-8444-444444444406",
      publicCode: "CASA-2026-ABCD1234",
      createdAt: "2026-08-20T12:00:00Z",
    };
    const submitReport = jest.fn().mockResolvedValue(receipt);

    render(
      <DamagedHomeForm
        onBack={jest.fn()}
        sessionSource={accountSession}
        submitReport={submitReport}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Qué sucedió y cómo quedó la casa *"),
      "El río se llevó la cocina y una habitación completa.",
    );
    fireEvent.changeText(screen.getByLabelText("Municipio *"), "Quibdó");
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "Chocó");
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Barrio Niño Jesús, calle 3",
    );
    fireEvent.changeText(
      screen.getByLabelText("Personas que viven en la casa *"),
      "5",
    );
    fireEvent.press(screen.getByTestId("donation-channel-Nequi"));
    fireEvent.changeText(
      await screen.findByLabelText("A dónde transferir *"),
      "3001234567",
    );
    fireEvent.press(
      screen.getByLabelText(
        "Confirmo que el hogar está en las condiciones descritas y la información es real.",
      ),
    );
    fireEvent.press(screen.getByLabelText("Publicar mi casita destruida"));

    await waitFor(() =>
      expect(screen.getByText("Tu casita quedó publicada")).toBeTruthy(),
    );
    expect(submitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        householdSize: "5",
        donationChannel: "Nequi",
        donationReference: "3001234567",
      }),
      [],
      expect.anything(),
    );
    // La constancia cita el código público de la publicación.
    expect(screen.getByText(/CASA-2026-ABCD1234/)).toBeTruthy();
  });
});
