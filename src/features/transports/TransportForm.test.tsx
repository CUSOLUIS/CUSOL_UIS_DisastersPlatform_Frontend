import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { AuthenticatedAccount } from "../auth/types";
import type { AidLocationParentCandidate } from "../aid-locations/types";
import {
  TransportForm,
  collectTransportIssues,
  initialTransportDraft,
} from "./TransportForm";
import { buildTransportPayload } from "./reportSubmission";
import type { TransportCity } from "./cityCatalog";
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

const CITIES: TransportCity[] = [
  { name: "Aratoca", department: "Santander" },
  { name: "Bucaramanga", department: "Santander" },
  { name: "Medellín", department: "Antioquia" },
  { name: "Mompós", department: "Bolívar" },
];

const loadCities = () => Promise.resolve(CITIES);

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

// CHG-171: el borrador válido incluye conductor y vehículo.
const validDraft = {
  ...initialTransportDraft,
  originMunicipality: "Bucaramanga",
  originLocationId: ORIGIN_CENTER.id,
  destinationMunicipality: "Mompós",
  destinationLocationId: DESTINATION_CENTER.id,
  driverFullName: "Pedro Antonio Rojas",
  driverDocumentType: "Cédula de ciudadanía" as const,
  driverDocumentNumber: "1098765432",
  driverPhone: "+57 300 123 4567",
  tractorPlate: "abc 123",
  trailerPlate: "R-99881",
  vehicleVisibleCharacteristics:
    "Tractocamión blanco con tráiler gris y franja azul.",
  truthConfirmed: true,
};

describe("collectTransportIssues (CHG-161/CHG-171)", () => {
  it("acepta un borrador completo", () => {
    expect(collectTransportIssues(validDraft)).toEqual([]);
  });

  it("exige ciudades, centros, conductor, vehículo y confirmación", () => {
    const fields = collectTransportIssues(initialTransportDraft).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual([
      "originMunicipality",
      "originLocationId",
      "destinationMunicipality",
      "destinationLocationId",
      "driverFullName",
      "driverDocumentType",
      "driverDocumentNumber",
      "driverPhone",
      "tractorPlate",
      "trailerPlate",
      "vehicleVisibleCharacteristics",
      "truthConfirmed",
    ]);
  });

  it("rechaza teléfonos y placas inválidos", () => {
    const fields = collectTransportIssues({
      ...validDraft,
      driverPhone: "abc",
      trailerPlate: "1",
    }).map((issue) => issue.field);
    expect(fields).toEqual(["driverPhone", "trailerPlate"]);
  });
});

describe("buildTransportPayload (CHG-161/CHG-171)", () => {
  it("envía el contrato completo con placas normalizadas", () => {
    expect(buildTransportPayload("mule", validDraft)).toEqual({
      kind: "mule",
      originMunicipality: "Bucaramanga",
      destinationMunicipality: "Mompós",
      originLocationId: ORIGIN_CENTER.id,
      destinationLocationId: DESTINATION_CENTER.id,
      driverFullName: "Pedro Antonio Rojas",
      driverDocumentType: "Cédula de ciudadanía",
      driverDocumentNumber: "1098765432",
      driverPhone: "+57 300 123 4567",
      // §32-33: mayúsculas y sin espacios/guiones.
      tractorPlate: "ABC123",
      trailerPlate: "R99881",
      vehicleVisibleCharacteristics:
        "Tractocamión blanco con tráiler gris y franja azul.",
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

// Elige una ciudad escribiendo en el autocomplete y tocando la opción.
async function pickCity(
  side: "origin" | "destination",
  typed: string,
  optionTestID: string,
) {
  fireEvent.changeText(
    screen.getByTestId(`${side}-city-input`),
    typed,
  );
  fireEvent.press(await screen.findByTestId(optionTestID));
}

describe("TransportForm (CHG-161/CHG-171)", () => {
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
        loadCities={loadCities}
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

  it("la búsqueda de ciudad funciona sin tildes y solo acepta el catálogo", async () => {
    render(
      <TransportForm
        kind="mule"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        loadCenterCandidates={jest.fn().mockResolvedValue([])}
        loadCities={loadCities}
      />,
    );
    await screen.findByTestId("origin-city-input");

    // TEST 2 del contrato: «mompos» encuentra «Mompós».
    fireEvent.changeText(
      screen.getByTestId("origin-city-input"),
      "mompos",
    );
    expect(
      await screen.findByTestId("origin-city-option-mompos-bolivar"),
    ).toBeTruthy();
    // Texto arbitrario: ninguna opción y ninguna ciudad seleccionada.
    fireEvent.changeText(
      screen.getByTestId("origin-city-input"),
      "Bucara",
    );
    expect(screen.queryByTestId("origin-city-selected")).toBeNull();
  });

  it("con sesión: popup por lado, conductor, vehículo y constancia con viaje GPS", async () => {
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
        loadCities={loadCities}
      />,
    );

    // §10: la ciudad muestra el conteo y el botón, no la lista suelta.
    await screen.findByTestId("origin-city-input");
    await pickCity(
      "origin",
      "buc",
      "origin-city-option-bucaramanga-santander",
    );
    await waitFor(
      () =>
        expect(screen.getByTestId("origin-center-count")).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(loadCenterCandidates).toHaveBeenCalledWith(
      "origin",
      "Bucaramanga",
      expect.anything(),
    );
    expect(
      screen.queryByTestId(`origin-picker-item-${ORIGIN_CENTER.id}`),
    ).toBeNull();

    // §12-§15: el popup lista, busca y selecciona; al elegir se cierra
    // y el formulario muestra el centro con CAMBIAR CENTRO.
    fireEvent.press(screen.getByTestId("origin-view-centers"));
    expect(
      await screen.findByTestId(`origin-picker-item-${ORIGIN_CENTER.id}`),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByTestId(`origin-picker-select-${ORIGIN_CENTER.id}`),
    );
    expect(
      await screen.findByTestId("origin-selected-center"),
    ).toBeTruthy();
    expect(screen.getByTestId("origin-change-center")).toBeTruthy();

    await pickCity(
      "destination",
      "mompos",
      "destination-city-option-mompos-bolivar",
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId("destination-view-centers"),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    fireEvent.press(screen.getByTestId("destination-view-centers"));
    fireEvent.press(
      await screen.findByTestId(
        `destination-picker-select-${DESTINATION_CENTER.id}`,
      ),
    );

    // §25-§35: conductor (con el aviso del GPS) y vehículo.
    expect(
      screen.getByText(/DEBE ser la persona que conduce/i),
    ).toBeTruthy();
    fireEvent.changeText(
      screen.getByLabelText("Nombre completo *"),
      "Pedro Antonio Rojas",
    );
    fireEvent.press(screen.getByTestId("driver-document-Cédula de ciudadanía"));
    fireEvent.changeText(
      screen.getByLabelText("Número de documento *"),
      "1098765432",
    );
    fireEvent.changeText(
      screen.getByLabelText("Número de contacto *"),
      "+57 300 123 4567",
    );
    fireEvent.changeText(
      screen.getByLabelText("Placa del tractocamión *"),
      "abc123",
    );
    fireEvent.changeText(
      screen.getByLabelText("Placa del tráiler *"),
      "R99881",
    );
    fireEvent.changeText(
      screen.getByLabelText("Características visibles del vehículo *"),
      "Tractocamión blanco con franja azul.",
    );

    fireEvent.press(
      screen.getByLabelText("Confirmo que la mula y su viaje son reales."),
    );
    fireEvent.press(screen.getByLabelText("Registrar la mulera"));
    await waitFor(() =>
      expect(screen.getByTestId("transport-journey-panel")).toBeTruthy(),
    );
    expect(submitTransportReport).toHaveBeenCalledWith(
      "mule",
      expect.objectContaining({
        originMunicipality: "Bucaramanga",
        originLocationId: ORIGIN_CENTER.id,
        destinationMunicipality: "Mompós",
        destinationLocationId: DESTINATION_CENTER.id,
        driverFullName: "Pedro Antonio Rojas",
        tractorPlate: "ABC123",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    // CHG-171 (GPS): la constancia ES la pantalla del viaje.
    expect(screen.getByText("Transporte registrado")).toBeTruthy();
    expect(screen.getByTestId("journey-status")).toBeTruthy();
    expect(screen.getByTestId("journey-start")).toBeTruthy();
  });

  it("avisa cuando la ciudad de origen no tiene acopio local disponible", async () => {
    const loadCenterCandidates = jest.fn().mockResolvedValue([]);

    render(
      <TransportForm
        kind="boat"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        loadCenterCandidates={loadCenterCandidates}
        loadCities={loadCities}
      />,
    );

    await screen.findByTestId("origin-city-input");
    await pickCity(
      "origin",
      "arat",
      "origin-city-option-aratoca-santander",
    );
    await waitFor(
      () =>
        expect(
          screen.getByText(/0 Centros de Acopio Local disponibles/i),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
  });
});

// CHG-172: los campos del conductor y del vehículo colgaban directos de
// la columna de la sección llevando el `flexBasis` de la rejilla, que en
// el eje vertical reserva altura vacía bajo cada input.
describe("Campos sin altura fantasma (CHG-172)", () => {
  const renderForm = async () => {
    render(
      <TransportForm
        kind="mule"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        loadCenterCandidates={jest.fn().mockResolvedValue([])}
        loadCities={loadCities}
      />,
    );
    await screen.findByTestId("origin-city-input");
  };

  it.each([
    ["field-driver-name"],
    ["field-vehicle-characteristics"],
  ])("el campo suelto %s ocupa el ancho sin flexBasis", async (testID) => {
    await renderForm();

    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);

    expect(style.flexBasis).toBeUndefined();
    expect(style.flexGrow).toBeUndefined();
    expect(style.alignSelf).toBe("stretch");
  });

  it.each([
    ["field-driver-document"],
    ["field-tractor-plate"],
  ])("el campo %s de la rejilla conserva su base horizontal", async (testID) => {
    await renderForm();

    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);

    expect(style.flexBasis).toBe(250);
  });
});

// CHG-173: la lanchera se identifica con matrícula, nombre y tipo de
// embarcación, no con placas prestadas del tractocamión.
const validBoatDraft = {
  ...initialTransportDraft,
  originMunicipality: "Bucaramanga",
  originLocationId: ORIGIN_CENTER.id,
  destinationMunicipality: "Mompós",
  destinationLocationId: DESTINATION_CENTER.id,
  driverFullName: "Rosa Elena Payares",
  driverDocumentType: "Cédula de ciudadanía" as const,
  driverDocumentNumber: "1098765432",
  driverPhone: "+57 300 123 4567",
  vesselRegistration: "cp-05-1234",
  vesselName: "La Golondrina",
  vesselType: "Chalupa" as const,
  vehicleVisibleCharacteristics:
    "Chalupa blanca con techo azul y franja amarilla.",
  truthConfirmed: true,
};

describe("La lanchera con identidad propia (CHG-173)", () => {
  it("acepta un borrador de lanchera sin placas de camión", () => {
    expect(collectTransportIssues(validBoatDraft, "boat")).toEqual([]);
  });

  it("exige matrícula, nombre y tipo de embarcación, nunca placas", () => {
    const fields = collectTransportIssues(initialTransportDraft, "boat").map(
      (issue) => issue.field,
    );

    expect(fields).toEqual([
      "originMunicipality",
      "originLocationId",
      "destinationMunicipality",
      "destinationLocationId",
      "driverFullName",
      "driverDocumentType",
      "driverDocumentNumber",
      "driverPhone",
      "vesselRegistration",
      "vesselName",
      "vesselType",
      "vehicleVisibleCharacteristics",
      "truthConfirmed",
    ]);
    expect(fields).not.toContain("tractorPlate");
    expect(fields).not.toContain("trailerPlate");
  });

  it("habla de quien pilota y de la embarcación en los errores", () => {
    const messages = collectTransportIssues(initialTransportDraft, "boat").map(
      (issue) => issue.message,
    );

    expect(messages.join(" ")).toContain("quien pilota");
    expect(messages.join(" ")).toContain("de la embarcación");
    expect(messages.join(" ")).not.toContain("conduce");
  });

  it("envía la identidad de la embarcación y ninguna placa", () => {
    const payload = buildTransportPayload("boat", validBoatDraft);

    // La matrícula se normaliza como una placa, con el rango fluvial.
    expect(payload.vesselRegistration).toBe("CP051234");
    expect(payload.vesselName).toBe("La Golondrina");
    expect(payload.vesselType).toBe("Chalupa");
    expect(payload.tractorPlate).toBeUndefined();
    expect(payload.trailerPlate).toBeUndefined();
  });

  it("la mulera sigue enviando sus dos placas y nada de embarcación", () => {
    const payload = buildTransportPayload("mule", validDraft);

    expect(payload.tractorPlate).toBe("ABC123");
    expect(payload.trailerPlate).toBe("R99881");
    expect(payload.vesselRegistration).toBeUndefined();
    expect(payload.vesselName).toBeUndefined();
    expect(payload.vesselType).toBeUndefined();
  });

  it("en pantalla pide los campos de la lancha y el resto del flujo de la mulera", async () => {
    render(
      <TransportForm
        kind="boat"
        onBack={jest.fn()}
        sessionSource={authenticatedSession}
        loadCenterCandidates={jest.fn().mockResolvedValue([])}
        loadCities={loadCities}
      />,
    );
    await screen.findByTestId("origin-city-input");

    expect(screen.getByTestId("field-vessel-registration")).toBeTruthy();
    expect(screen.getByTestId("field-vessel-name")).toBeTruthy();
    expect(screen.getByTestId("vessel-type-Chalupa")).toBeTruthy();
    expect(screen.queryByTestId("field-tractor-plate")).toBeNull();
    // Lo demás de la mulera sigue ahí, adaptado: quien pilota y el
    // aviso del GPS.
    expect(screen.getByText("Datos de quien pilota")).toBeTruthy();
    expect(screen.getByText(/el GPS de este teléfono se activará/i)).toBeTruthy();
  });
});
