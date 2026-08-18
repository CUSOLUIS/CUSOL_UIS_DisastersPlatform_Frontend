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
        sessionSource={anonymousSession}
        submitLocation={submitLocation}
        loadParentCandidates={loadParentCandidates}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Municipio *"),
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
        sessionSource={anonymousSession}
        loadParentCandidates={loadParentCandidates}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Municipio *"), "Aratoca");
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
