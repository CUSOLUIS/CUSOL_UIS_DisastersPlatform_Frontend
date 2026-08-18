import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { AuthenticatedAccount } from "../auth/types";
import type { AidLocationParentCandidate } from "../aid-locations/types";
import {
  TransportForm,
  collectTransportIssues,
  initialTransportDraft,
} from "./TransportForm";
import { buildTransportPayload } from "./reportSubmission";
import type { TransportReceipt } from "./types";

// El navbar consulta la sesión; en pruebas no hay red y el fallo debe
// ser silencioso.
beforeEach(() => {
  jest
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("sin red en pruebas"));
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const anonymousSession = {
  getCurrentAccount: () => Promise.reject(new Error("sin sesión")),
};

const ACCOUNT: AuthenticatedAccount = {
  id: "99999999-9999-4999-8999-999999999909",
  displayName: "Sara Angarita",
  email: "sara@example.org",
  assignedRole: "user",
  status: "active",
  sessionExpiresAt: "2026-08-19T00:00:00Z",
};

const authenticatedSession = {
  getCurrentAccount: () => Promise.resolve(ACCOUNT),
};

const ORIGIN_CENTER: AidLocationParentCandidate = {
  id: "11111111-1111-4111-8111-111111111101",
  name: "Acopio Local Norte",
  address: "Calle 45 #27-30",
  municipality: "Bucaramanga",
  department: "Santander",
  operationalStatus: "open",
};

const DESTINATION_CENTER: AidLocationParentCandidate = {
  id: "22222222-2222-4222-8222-222222222202",
  name: "Receptor Mompós",
  address: "Albarrada del medio",
  municipality: "Mompós",
  department: "Bolívar",
  operationalStatus: "open",
};

const validDraft = {
  ...initialTransportDraft,
  originMunicipality: "Bucaramanga",
  originLocationId: ORIGIN_CENTER.id,
  destinationMunicipality: "Mompós",
  destinationLocationId: DESTINATION_CENTER.id,
  truthConfirmed: true,
};

describe("collectTransportIssues (CHG-161)", () => {
  it("acepta un borrador completo", () => {
    expect(collectTransportIssues(validDraft)).toEqual([]);
  });

  it("exige ciudades, centros de ambos lados y confirmación", () => {
    const fields = collectTransportIssues(initialTransportDraft).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual([
      "originMunicipality",
      "originLocationId",
      "destinationMunicipality",
      "destinationLocationId",
      "truthConfirmed",
    ]);
  });
});

describe("buildTransportPayload (CHG-161)", () => {
  it("envía el contrato mínimo y omite el resumen vacío", () => {
    expect(buildTransportPayload("mule", validDraft)).toEqual({
      kind: "mule",
      originMunicipality: "Bucaramanga",
      destinationMunicipality: "Mompós",
      originLocationId: ORIGIN_CENTER.id,
      destinationLocationId: DESTINATION_CENTER.id,
    });
  });

  it("incluye el resumen de insumos cuando existe", () => {
    const payload = buildTransportPayload("boat", {
      ...validDraft,
      suppliesSummary: "  40 mercados y 12 kits de aseo  ",
    });
    expect(payload.kind).toBe("boat");
    expect(payload.suppliesSummary).toBe("40 mercados y 12 kits de aseo");
  });
});

describe("TransportForm (CHG-161)", () => {
  it("sin sesión explica, ofrece registrarse o iniciar sesión y nunca envía", async () => {
    const submitTransportReport = jest.fn();
    render(
      <TransportForm
        kind="mule"
        onBack={jest.fn()}
        onRegister={jest.fn()}
        onLogin={jest.fn()}
        sessionSource={anonymousSession}
        submitTransportReport={submitTransportReport}
        loadCenterCandidates={jest.fn().mockResolvedValue([])}
      />,
    );

    expect(await screen.findByTestId("session-gate")).toBeTruthy();
    expect(
      screen.getByLabelText("Registrarme para continuar"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Iniciar sesión para continuar"),
    ).toBeTruthy();
    // El botón de publicar ni siquiera existe: es imposible enviar.
    expect(screen.queryByLabelText("Registrar la mulera")).toBeNull();
    expect(submitTransportReport).not.toHaveBeenCalled();
  });

  it("con sesión lista los centros de cada ciudad, exige elegir ambos y publica con constancia", async () => {
    const loadCenterCandidates = jest.fn(
      (side: "origin" | "destination") =>
        Promise.resolve(
          side === "origin" ? [ORIGIN_CENTER] : [DESTINATION_CENTER],
        ),
    );
    const receipt: TransportReceipt = {
      id: "33333333-3333-4333-8333-333333333303",
      kind: "mule",
      status: "registered",
      originLocationId: ORIGIN_CENTER.id,
      destinationLocationId: DESTINATION_CENTER.id,
      createdAt: "2026-08-18T12:00:00Z",
    };
    const submitTransportReport = jest.fn().mockResolvedValue(receipt);

    render(
      <TransportForm
        kind="mule"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        submitTransportReport={submitTransportReport}
        loadCenterCandidates={loadCenterCandidates}
      />,
    );

    // La ciudad de cada lado dispara su propia consulta de centros.
    fireEvent.changeText(
      await screen.findByLabelText("Ciudad de origen *"),
      "Bucaramanga",
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId(`origin-center-${ORIGIN_CENTER.id}`),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(loadCenterCandidates).toHaveBeenCalledWith(
      "origin",
      "Bucaramanga",
      expect.anything(),
    );

    fireEvent.changeText(
      screen.getByLabelText("Ciudad de destino *"),
      "Mompós",
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId(`destination-center-${DESTINATION_CENTER.id}`),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(loadCenterCandidates).toHaveBeenCalledWith(
      "destination",
      "Mompós",
      expect.anything(),
    );

    // Sin elegir los centros el envío se bloquea con sus avisos.
    fireEvent.press(
      screen.getByLabelText("Confirmo que la mula y su viaje son reales."),
    );
    fireEvent.press(screen.getByLabelText("Registrar la mulera"));
    expect(submitTransportReport).not.toHaveBeenCalled();
    expect(
      screen.getByText("Elige el centro de acopio local de origen."),
    ).toBeTruthy();

    // Con ambos centros elegidos, el registro viaja y deja constancia.
    fireEvent.press(screen.getByTestId(`origin-center-${ORIGIN_CENTER.id}`));
    fireEvent.press(
      screen.getByTestId(`destination-center-${DESTINATION_CENTER.id}`),
    );
    fireEvent.press(screen.getByLabelText("Registrar la mulera"));
    await waitFor(() =>
      expect(screen.getByText("Transporte registrado")).toBeTruthy(),
    );
    expect(submitTransportReport).toHaveBeenCalledWith(
      "mule",
      expect.objectContaining({
        originMunicipality: "Bucaramanga",
        originLocationId: ORIGIN_CENTER.id,
        destinationMunicipality: "Mompós",
        destinationLocationId: DESTINATION_CENTER.id,
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(screen.getByText("La mulera")).toBeTruthy();
    expect(screen.getByText("REGISTRADO")).toBeTruthy();
  });

  it("avisa cuando la ciudad de origen no tiene acopio local disponible", async () => {
    const loadCenterCandidates = jest.fn().mockResolvedValue([]);

    render(
      <TransportForm
        kind="boat"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        loadCenterCandidates={loadCenterCandidates}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Ciudad de origen *"),
      "Aratoca",
    );
    await waitFor(
      () =>
        expect(
          screen.getByText(
            /todavía no tiene un centro de acopio local publicado/i,
          ),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
  });
});
