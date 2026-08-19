// CHG-174 — La bandeja del centro: resumen, VER MÁS con los datos que
// permiten decidir, y las dos acciones (declinar exige confirmación).

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { TransportRequestsSection } from "./TransportRequestsSection";
import { RouteAcceptanceSection } from "./RouteAcceptanceSection";
import type {
  CenterTransportRequest,
  RouteAcceptanceDataSource,
  TransportRouteState,
} from "../transports/routeAcceptance";

afterEach(cleanup);

const REQUEST: CenterTransportRequest = {
  id: "req-1",
  transportId: "tr-1",
  centerId: "center-1",
  centerRole: "local",
  status: "pending",
  requestedAt: "2026-08-19T15:00:00Z",
  decidedAt: null,
  centerName: "Acopio La Feria",
  centerMunicipality: "Bucaramanga",
  transportKind: "mule",
  originCenterName: "Acopio La Feria",
  destinationCenterName: "Receptor Mompós",
  originMunicipality: "Bucaramanga",
  destinationMunicipality: "Mompós",
  suppliesSummary: "40 mercados",
  transportCreatedAt: "2026-08-19T14:00:00Z",
  driverFullName: "Pedro Antonio Rojas",
  driverDocumentType: "Cédula de ciudadanía",
  driverDocumentNumber: "1098765432",
  driverPhone: "+57 300 123 4567",
  tractorPlate: "ABC123",
  trailerPlate: "R99881",
  vesselRegistration: null,
  vesselName: null,
  vesselType: null,
  vehicleVisibleCharacteristics: "Blanco con franja azul",
};

function dataSource(
  overrides: Partial<RouteAcceptanceDataSource> = {},
): RouteAcceptanceDataSource {
  return {
    listRequests: jest.fn().mockResolvedValue([REQUEST]),
    decideRequest: jest.fn().mockResolvedValue({ status: "accepted" }),
    listRouteStates: jest.fn().mockResolvedValue([]),
    startRouteAcceptance: jest.fn(),
    startReceptionRouteAcceptance: jest.fn(),
    ...overrides,
  };
}

describe("Aceptación de solicitudes (CHG-174)", () => {
  it("el resumen no expone al conductor; VER MÁS sí lo muestra", async () => {
    render(<TransportRequestsSection dataSource={dataSource()} />);

    await screen.findByTestId("transport-request-req-1");
    // §10: la tarjeta resume sin datos sensibles.
    expect(screen.queryByText(/Pedro Antonio Rojas/)).toBeNull();

    fireEvent.press(screen.getByTestId("view-more-req-1"));

    // §12: el popup trae transporte, conductor y vehículo.
    expect(await screen.findByTestId("transport-request-detail")).toBeTruthy();
    expect(screen.getByText("Pedro Antonio Rojas")).toBeTruthy();
    expect(
      screen.getByText("Cédula de ciudadanía 1098765432"),
    ).toBeTruthy();
    expect(screen.getByText("ABC123")).toBeTruthy();
  });

  it("aceptar envía la decisión al backend", async () => {
    const source = dataSource();
    render(<TransportRequestsSection dataSource={source} />);
    await screen.findByTestId("transport-request-req-1");
    fireEvent.press(screen.getByTestId("view-more-req-1"));

    fireEvent.press(await screen.findByTestId("accept-request"));

    await waitFor(() =>
      expect(source.decideRequest).toHaveBeenCalledWith("req-1", "accept"),
    );
  });

  it("declinar exige confirmar antes de ejecutarse", async () => {
    const source = dataSource();
    render(<TransportRequestsSection dataSource={source} />);
    await screen.findByTestId("transport-request-req-1");
    fireEvent.press(screen.getByTestId("view-more-req-1"));

    fireEvent.press(await screen.findByTestId("decline-request"));
    // §17: el primer toque solo abre la pregunta.
    expect(source.decideRequest).not.toHaveBeenCalled();
    expect(
      screen.getByText(/¿Desea declinar esta solicitud/),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("confirm-decline-request"));
    await waitFor(() =>
      expect(source.decideRequest).toHaveBeenCalledWith("req-1", "decline"),
    );
  });

  it("una solicitud ya procesada no vuelve a ofrecer los botones", async () => {
    render(
      <TransportRequestsSection
        dataSource={dataSource({
          listRequests: jest
            .fn()
            .mockResolvedValue([
              { ...REQUEST, status: "accepted", decidedAt: "2026-08-19T16:00:00Z" },
            ]),
        })}
      />,
    );
    await screen.findByTestId("transport-request-req-1");
    fireEvent.press(screen.getByTestId("view-more-req-1"));

    await screen.findByTestId("transport-request-detail");
    expect(screen.queryByTestId("accept-request")).toBeNull();
    expect(screen.queryByTestId("decline-request")).toBeNull();
  });
});

const BASE_STATE: TransportRouteState = {
  transportId: "tr-1",
  transportKind: "mule",
  transportCreatedAt: "2026-08-19T14:00:00Z",
  originCenterName: "Acopio La Feria",
  destinationCenterName: "Receptor Mompós",
  originMunicipality: "Bucaramanga",
  destinationMunicipality: "Mompós",
  localStatus: "accepted",
  receptionStatus: "pending",
  routeStatus: null,
  confirmationCode: null,
  localAcceptedAt: null,
  muleCodeValidatedAt: null,
  muleAcceptedAt: null,
  // CHG-175: etapa 2 sin empezar.
  receptionConfirmationCode: null,
  receptionStartedAt: null,
  receptionMuleCodeValidatedAt: null,
  receptionMuleAcceptedAt: null,
  routeAcceptedAt: null,
  isLocalSteward: true,
  isReceptionSteward: true,
};

describe("Definición y aceptación de ruta (CHG-174)", () => {
  it("con el receptor pendiente no se puede aceptar la ruta", async () => {
    const source = dataSource({
      listRouteStates: jest.fn().mockResolvedValue([BASE_STATE]),
    });
    render(<RouteAcceptanceSection dataSource={source} />);

    await screen.findByTestId("route-state-tr-1");
    expect(
      screen.getByText(/Esperando aceptación del Centro de Acopio Receptor/),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("accept-route-tr-1"));
    // §23: la acción no se dispara mientras falte una aceptación.
    expect(source.startRouteAcceptance).not.toHaveBeenCalled();
  });

  it("con ambos aceptados pide el código al backend", async () => {
    const source = dataSource({
      listRouteStates: jest
        .fn()
        .mockResolvedValue([{ ...BASE_STATE, receptionStatus: "accepted" }]),
    });
    render(<RouteAcceptanceSection dataSource={source} />);

    await screen.findByTestId("route-state-tr-1");
    fireEvent.press(screen.getByTestId("accept-route-tr-1"));

    await waitFor(() =>
      expect(source.startRouteAcceptance).toHaveBeenCalledWith("tr-1"),
    );
  });

  it("muestra el código emitido y luego el alcance real de lo aceptado", async () => {
    const emitido = {
      ...BASE_STATE,
      receptionStatus: "accepted" as const,
      routeStatus: "code_issued" as const,
      confirmationCode: "RT-2026-ABCD1234",
    };
    const { unmount } = render(
      <RouteAcceptanceSection
        dataSource={dataSource({
          listRouteStates: jest.fn().mockResolvedValue([emitido]),
        })}
      />,
    );
    expect(await screen.findByTestId("route-code-tr-1")).toHaveTextContent(
      "RT-2026-ABCD1234",
    );
    unmount();

    render(
      <RouteAcceptanceSection
        dataSource={dataSource({
          listRouteStates: jest.fn().mockResolvedValue([
            {
              ...emitido,
              routeStatus: "accepted" as const,
              muleAcceptedAt: "2026-08-19T17:00:00Z",
            },
          ]),
        })}
      />,
    );
    // §74: nunca se anuncia la ruta completa, solo lo pactado con el
    // local — y CHG-175 lo deja explícito por etapas.
    expect(await screen.findByTestId("route-global-tr-1")).toHaveTextContent(
      /pendiente de completar las dos aceptaciones/,
    );
  });
});

// CHG-175 — Etapa 2: la sección muestra las dos relaciones, respeta el
// orden y entrega a cada centro solo su código.
describe("Etapa 2 · Mulera ↔ Centro Receptor (CHG-175)", () => {
  const etapa1Lista = {
    ...BASE_STATE,
    receptionStatus: "accepted" as const,
    routeStatus: "code_issued" as const,
    confirmationCode: "RT-2026-ABCD1234",
  };

  it("con la etapa 1 abierta, la 2 aparece bloqueada y sin botón", async () => {
    const source = dataSource({
      listRouteStates: jest.fn().mockResolvedValue([etapa1Lista]),
    });
    render(<RouteAcceptanceSection dataSource={source} />);

    await screen.findByTestId("route-state-tr-1");
    expect(screen.getByText(/🔒 No disponible todavía/)).toBeTruthy();
    expect(
      screen.queryByTestId("accept-reception-route-tr-1"),
    ).toBeNull();
    expect(
      screen.getByText(/pendiente de completar las dos aceptaciones/),
    ).toBeTruthy();
  });

  it("cerrada la etapa 1, el receptor puede pedir su propio código", async () => {
    const source = dataSource({
      listRouteStates: jest.fn().mockResolvedValue([
        {
          ...etapa1Lista,
          routeStatus: "accepted" as const,
          muleAcceptedAt: "2026-08-19T17:00:00Z",
          confirmationCode: null,
        },
      ]),
    });
    render(<RouteAcceptanceSection dataSource={source} />);

    await screen.findByTestId("route-state-tr-1");
    fireEvent.press(screen.getByTestId("accept-reception-route-tr-1"));

    await waitFor(() =>
      expect(source.startReceptionRouteAcceptance).toHaveBeenCalledWith(
        "tr-1",
      ),
    );
  });

  it("cada centro ve solo el código de su etapa", async () => {
    render(
      <RouteAcceptanceSection
        dataSource={dataSource({
          listRouteStates: jest.fn().mockResolvedValue([
            {
              ...etapa1Lista,
              routeStatus: "accepted" as const,
              muleAcceptedAt: "2026-08-19T17:00:00Z",
              // El backend ya enmascaró: este responsable es del
              // receptor, así que no recibe el código de la etapa 1.
              confirmationCode: null,
              receptionConfirmationCode: "RR-2026-9999ZZZZ",
              receptionStartedAt: "2026-08-19T18:00:00Z",
              isLocalSteward: false,
            },
          ]),
        })}
      />,
    );

    expect(
      await screen.findByTestId("reception-route-code-tr-1"),
    ).toHaveTextContent("RR-2026-9999ZZZZ");
    expect(screen.queryByTestId("route-code-tr-1")).toBeNull();
  });

  it("solo con las dos etapas completas se declara la ruta aceptada", async () => {
    render(
      <RouteAcceptanceSection
        dataSource={dataSource({
          listRouteStates: jest.fn().mockResolvedValue([
            {
              ...etapa1Lista,
              routeStatus: "accepted" as const,
              muleAcceptedAt: "2026-08-19T17:00:00Z",
              receptionStartedAt: "2026-08-19T18:00:00Z",
              receptionMuleAcceptedAt: "2026-08-19T18:30:00Z",
              routeAcceptedAt: "2026-08-19T18:30:00Z",
            },
          ]),
        })}
      />,
    );

    expect(await screen.findByTestId("route-global-tr-1")).toHaveTextContent(
      /RUTA ✓ ACEPTADA/,
    );
  });
});
