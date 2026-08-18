import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  AidLocationForm,
  collectAidLocationIssues,
  initialAidLocationDraft,
} from "./AidLocationForm";
import { buildAidLocationPayload } from "./reportSubmission";
import { resetVisitorPresenceForTests } from "../operational-map/visitorPresence";
import type { AidLocationParentCandidate, AidLocationReceipt } from "./types";

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

// CHG-161: acopio local y punto de distribución exigen sesión, así que
// sus flujos se prueban con una cuenta activa.
const authenticatedSession = {
  getCurrentAccount: () =>
    Promise.resolve({
      id: "99999999-9999-4999-8999-999999999909",
      displayName: "Sara Angarita",
      email: "sara@example.org",
      assignedRole: "user" as const,
      status: "active" as const,
      sessionExpiresAt: "2026-08-19T00:00:00Z",
    }),
};

const validDraft = {
  ...initialAidLocationDraft,
  name: "Acopio Solidario Norte",
  address: "Calle 45 #27-30",
  municipality: "Bucaramanga",
  department: "Santander",
  truthConfirmed: true,
};

const RECEIVER_CANDIDATE: AidLocationParentCandidate = {
  id: "11111111-1111-4111-8111-111111111101",
  name: "Receptor Metropolitano",
  address: "Km 3 vía Girón",
  municipality: "Bucaramanga",
  department: "Santander",
  operationalStatus: "open",
};

describe("collectAidLocationIssues (CHG-153)", () => {
  it("acepta un borrador completo de un tipo independiente", () => {
    expect(collectAidLocationIssues("collection_center", validDraft)).toEqual(
      [],
    );
    expect(collectAidLocationIssues("receiver_center", validDraft)).toEqual(
      [],
    );
  });

  it("exige nombre, ciudad, dirección y confirmación", () => {
    const fields = collectAidLocationIssues(
      "collection_center",
      initialAidLocationDraft,
    ).map((issue) => issue.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "name",
        "municipality",
        "department",
        "address",
        "truthConfirmed",
      ]),
    );
  });

  it("exige el centro asociado solo en los tipos dependientes (§6)", () => {
    const dependentFields = (kind: "collection_point" | "distribution_point") =>
      collectAidLocationIssues(kind, validDraft).map((issue) => issue.field);
    expect(dependentFields("collection_point")).toEqual(["parentId"]);
    expect(dependentFields("distribution_point")).toEqual(["parentId"]);

    const withParent = { ...validDraft, parentId: RECEIVER_CANDIDATE.id };
    expect(
      collectAidLocationIssues("distribution_point", withParent),
    ).toEqual([]);
  });
});

describe("buildAidLocationPayload (CHG-153)", () => {
  it("envía el contrato mínimo y omite los opcionales vacíos", () => {
    expect(buildAidLocationPayload("collection_center", validDraft)).toEqual({
      kind: "collection_center",
      name: "Acopio Solidario Norte",
      address: "Calle 45 #27-30",
      municipality: "Bucaramanga",
      department: "Santander",
    });
  });

  it("incluye coordenadas solo en pareja y el centro asociado", () => {
    const payload = buildAidLocationPayload("distribution_point", {
      ...validDraft,
      latitude: "7.11930",
      longitude: "-73.12270",
      schedule: "L-V 8am-5pm",
      parentId: RECEIVER_CANDIDATE.id,
    });
    expect(payload).toMatchObject({
      kind: "distribution_point",
      latitude: 7.1193,
      longitude: -73.1227,
      schedule: "L-V 8am-5pm",
      parentId: RECEIVER_CANDIDATE.id,
    });

    const halfPair = buildAidLocationPayload("collection_center", {
      ...validDraft,
      latitude: "7.11930",
    });
    expect(halfPair.latitude).toBeUndefined();
    expect(halfPair.longitude).toBeUndefined();
  });
});

describe("AidLocationForm (CHG-153)", () => {
  it("publica un centro de acopio receptor y muestra la constancia", async () => {
    const receipt: AidLocationReceipt = {
      id: "22222222-2222-4222-8222-222222222202",
      kind: "receiver_center",
      operationalStatus: "open",
      createdAt: "2026-08-18T12:00:00Z",
    };
    const submitLocation = jest.fn().mockResolvedValue(receipt);

    render(
      <AidLocationForm
        kind="receiver_center"
        onBack={jest.fn()}
        sessionSource={anonymousSession}
        submitLocation={submitLocation}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Nombre del punto *"),
      "Receptor Metropolitano",
    );
    fireEvent.changeText(
      screen.getByLabelText("Municipio *"),
      "Bucaramanga",
    );
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "Santander");
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Km 3 vía Girón",
    );
    fireEvent.press(
      screen.getByLabelText(
        "Confirmo que el punto existe y la información es real.",
      ),
    );
    fireEvent.press(
      screen.getByLabelText("Publicar centro de acopio receptor"),
    );

    await waitFor(() =>
      expect(screen.getByText("Punto registrado")).toBeTruthy(),
    );
    expect(submitLocation).toHaveBeenCalledWith(
      "receiver_center",
      expect.objectContaining({
        name: "Receptor Metropolitano",
        municipality: "Bucaramanga",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(screen.getByText("Centro de acopio receptor")).toBeTruthy();
  });

  it("ofrece los centros de la ciudad y bloquea sin selección", async () => {
    const loadParentCandidates = jest
      .fn()
      .mockResolvedValue([RECEIVER_CANDIDATE]);
    const submitLocation = jest.fn();

    render(
      <AidLocationForm
        kind="distribution_point"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        submitLocation={submitLocation}
        loadParentCandidates={loadParentCandidates}
      />,
    );

    // CHG-161: el formulario aparece cuando la sesión queda resuelta.
    fireEvent.changeText(
      await screen.findByLabelText("Municipio *"),
      "Bucaramanga",
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId(`parent-candidate-${RECEIVER_CANDIDATE.id}`),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(loadParentCandidates).toHaveBeenCalledWith(
      "distribution_point",
      "Bucaramanga",
      expect.anything(),
    );

    // Sin centro elegido el envío se bloquea con el aviso del campo.
    fireEvent.changeText(
      screen.getByLabelText("Nombre del punto *"),
      "Entrega Barrio Kennedy",
    );
    fireEvent.changeText(screen.getByLabelText("Departamento *"), "Santander");
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Cra 20 #10-55",
    );
    fireEvent.press(
      screen.getByLabelText(
        "Confirmo que el punto existe y la información es real.",
      ),
    );
    fireEvent.press(screen.getByLabelText("Publicar punto de distribución"));
    expect(submitLocation).not.toHaveBeenCalled();
    expect(
      screen.getByText("Elige el centro al que estará asociado este punto."),
    ).toBeTruthy();

    // Con el centro elegido, el envío viaja con su id.
    fireEvent.press(
      screen.getByTestId(`parent-candidate-${RECEIVER_CANDIDATE.id}`),
    );
    submitLocation.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333303",
      kind: "distribution_point",
      operationalStatus: "open",
      createdAt: "2026-08-18T12:00:00Z",
    });
    fireEvent.press(screen.getByLabelText("Publicar punto de distribución"));
    await waitFor(() =>
      expect(screen.getByText("Punto registrado")).toBeTruthy(),
    );
    expect(submitLocation).toHaveBeenCalledWith(
      "distribution_point",
      expect.objectContaining({ parentId: RECEIVER_CANDIDATE.id }),
      expect.anything(),
    );
  });

  it("avisa cuando la ciudad no tiene centro receptor disponible (§6)", async () => {
    const loadParentCandidates = jest.fn().mockResolvedValue([]);

    render(
      <AidLocationForm
        kind="distribution_point"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        loadParentCandidates={loadParentCandidates}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Municipio *"),
      "Aratoca",
    );
    await waitFor(
      () =>
        expect(
          screen.getByText(
            /todavía no existe un Centro de acopio receptor disponible/i,
          ),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
  });
});

// CHG-160 — Paridad de reglas de mapa y autocompletado entre los 4
// tipos logísticos: el centro de acopio receptor (y todos los demás)
// deben ofrecer exactamente las mismas herramientas de ubicación que
// el centro de acopio local — dirección que se completa sola al fijar
// el punto (CHG-156), «CRUZAR DIRECCIÓN», «COLOCAR MUÑEQUITO» y el
// mapa (CHG-147/155). Si alguien condiciona la sección por tipo, este
// test lo delata.
describe("paridad de ubicación entre los 4 tipos (CHG-160)", () => {
  const kinds = [
    "collection_center",
    "receiver_center",
    "collection_point",
    "distribution_point",
  ] as const;

  it.each(kinds)("el formulario de %s trae las reglas de mapa y autocompletado", async (kind) => {
    // CHG-161: con sesión activa para atravesar el portón de los tipos
    // que ahora la exigen — la paridad de ubicación es la misma.
    render(
      <AidLocationForm
        kind={kind}
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        submitLocation={jest.fn()}
        loadParentCandidates={jest.fn().mockResolvedValue([])}
      />,
    );

    // Dirección autocompletable desde el muñequito (CHG-156).
    expect(
      await screen.findByText(
        "Se completa sola al fijar el punto; siempre editable",
      ),
    ).toBeTruthy();
    // Mapa con las mismas acciones del acopio local.
    expect(screen.getByText("UBICACIÓN EN EL MAPA · OPCIONAL")).toBeTruthy();
    expect(
      screen.getByLabelText("Cruzar la dirección escrita con el mapa"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Colocar el muñequito en el centro del mapa"),
    ).toBeTruthy();
    // Municipio y departamento propios, donde cae el autocompletado.
    expect(screen.getByLabelText("Municipio *")).toBeTruthy();
    expect(screen.getByLabelText("Departamento *")).toBeTruthy();
  });
});

// CHG-161 (criterio 3) — El acopio local y el punto de distribución
// exigen sesión: sin cuenta el formulario explica y ofrece registrarse
// o iniciar sesión, y el botón de publicar ni siquiera existe. Los
// otros dos tipos siguen abiertos al registro anónimo.
describe("portón de sesión de la logística (CHG-161)", () => {
  it.each(["collection_center", "distribution_point"] as const)(
    "sin sesión el alta de %s queda detrás del portón",
    async (kind) => {
      render(
        <AidLocationForm
          kind={kind}
          onBack={jest.fn()}
          onRegister={jest.fn()}
          onLogin={jest.fn()}
          sessionSource={anonymousSession}
          submitLocation={jest.fn()}
          loadParentCandidates={jest.fn().mockResolvedValue([])}
        />,
      );

      expect(await screen.findByTestId("session-gate")).toBeTruthy();
      expect(
        screen.getByLabelText("Registrarme para continuar"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("Iniciar sesión para continuar"),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Nombre del punto *")).toBeNull();
    },
  );

  it.each(["collection_point", "receiver_center"] as const)(
    "el alta de %s sigue disponible sin sesión",
    async (kind) => {
      render(
        <AidLocationForm
          kind={kind}
          onBack={jest.fn()}
          sessionSource={anonymousSession}
          submitLocation={jest.fn()}
          loadParentCandidates={jest.fn().mockResolvedValue([])}
        />,
      );

      expect(await screen.findByLabelText("Nombre del punto *")).toBeTruthy();
      expect(screen.queryByTestId("session-gate")).toBeNull();
    },
  );
});
