import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { GeographicCenter } from "../operational-map/webMercator";
import { TransportJourneyPanel } from "./TransportJourneyPanel";
import type { TransportJourneyReceipt, TransportReceipt } from "./types";

// CHG-171 (GPS) — La constancia se convierte en la pantalla del viaje:
// el GPS queda activo enviando posiciones y los botones marcan salida
// y llegada.

afterEach(cleanup);

const RECEIPT: TransportReceipt = {
  id: "33333333-3333-4333-8333-333333333303",
  kind: "mule",
  status: "registered",
  originLocationId: "11111111-1111-4111-8111-111111111101",
  destinationLocationId: "22222222-2222-4222-8222-222222222202",
  createdAt: "2026-08-19T12:00:00Z",
};

function journeyReceipt(
  status: TransportJourneyReceipt["status"],
): TransportJourneyReceipt {
  return {
    id: RECEIPT.id,
    status,
    departedAt: status === "registered" ? null : "2026-08-19T12:10:00Z",
    arrivedAt: status === "arrived" ? "2026-08-19T15:00:00Z" : null,
    lastPositionAt: null,
  };
}

it("activa el GPS al abrir y envía las posiciones del conductor", async () => {
  let emit: ((center: GeographicCenter) => void) | null = null;
  const stop = jest.fn();
  const watchLocation = jest.fn(
    (onUpdate: (center: GeographicCenter) => void) => {
      emit = onUpdate;
      return stop;
    },
  );
  const sendPosition = jest
    .fn()
    .mockResolvedValue(journeyReceipt("registered"));

  render(
    <TransportJourneyPanel
      receipt={RECEIPT}
      kind="mule"
      onHome={jest.fn()}
      watchLocation={watchLocation}
      sendPosition={sendPosition}
      positionIntervalMs={0}
    />,
  );

  expect(watchLocation).toHaveBeenCalledTimes(1);
  emit!({ latitude: 7.2, longitude: -73.15 });
  await waitFor(() =>
    expect(sendPosition).toHaveBeenCalledWith(RECEIPT.id, {
      latitude: 7.2,
      longitude: -73.15,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByTestId("journey-gps-line").props.children,
    ).toMatch(/última posición enviada/),
  );
});

it("INICIAR VIAJE y YA LLEGUÉ mueven el estado; al llegar el GPS se detiene", async () => {
  const stop = jest.fn();
  const watchLocation = jest.fn(() => stop);
  const startJourney = jest
    .fn()
    .mockResolvedValue(journeyReceipt("in_transit"));
  const arriveJourney = jest
    .fn()
    .mockResolvedValue(journeyReceipt("arrived"));

  render(
    <TransportJourneyPanel
      receipt={RECEIPT}
      kind="mule"
      onHome={jest.fn()}
      watchLocation={watchLocation}
      startJourney={startJourney}
      arriveJourney={arriveJourney}
      sendPosition={jest.fn().mockResolvedValue(journeyReceipt("in_transit"))}
    />,
  );

  fireEvent.press(screen.getByTestId("journey-start"));
  await waitFor(() =>
    expect(screen.getByTestId("journey-status").props.children).toBe(
      "EN CAMINO",
    ),
  );
  expect(startJourney).toHaveBeenCalledWith(RECEIPT.id);

  fireEvent.press(screen.getByTestId("journey-arrive"));
  await waitFor(() =>
    expect(screen.getByTestId("journey-status").props.children).toBe(
      "LLEGÓ",
    ),
  );
  expect(arriveJourney).toHaveBeenCalledWith(RECEIPT.id);
  expect(screen.getByTestId("journey-arrived-note")).toBeTruthy();
  // Al llegar, el efecto del GPS se limpia.
  await waitFor(() => expect(stop).toHaveBeenCalled());
});

it("si el backend rechaza el hito, el error se muestra y el estado no cambia", async () => {
  const startJourney = jest
    .fn()
    .mockRejectedValue(
      new Error("El viaje no admite esta acción en su estado actual."),
    );

  render(
    <TransportJourneyPanel
      receipt={RECEIPT}
      kind="mule"
      onHome={jest.fn()}
      watchLocation={jest.fn(() => jest.fn())}
      startJourney={startJourney}
      sendPosition={jest.fn().mockResolvedValue(journeyReceipt("registered"))}
    />,
  );

  fireEvent.press(screen.getByTestId("journey-start"));
  await waitFor(() =>
    expect(screen.getByTestId("journey-error")).toBeTruthy(),
  );
  expect(screen.getByTestId("journey-status").props.children).toBe(
    "REGISTRADO",
  );
});

it("si el permiso de ubicación se revoca, lo explica", async () => {
  let revoke: (() => void) | undefined;
  const watchLocation = jest.fn(
    (
      _onUpdate: (center: GeographicCenter) => void,
      onRevoked?: () => void,
    ) => {
      revoke = onRevoked;
      return jest.fn();
    },
  );

  render(
    <TransportJourneyPanel
      receipt={RECEIPT}
      kind="mule"
      onHome={jest.fn()}
      watchLocation={watchLocation}
      sendPosition={jest.fn().mockResolvedValue(journeyReceipt("registered"))}
    />,
  );

  revoke?.();
  await waitFor(() =>
    expect(
      screen.getByTestId("journey-gps-line").props.children,
    ).toMatch(/permiso de ubicación fue revocado/i),
  );
});

// CHG-174 — Aceptación de ruta desde el panel de quien conduce: validar
// y aceptar son dos pasos, y el segundo es explícito.
describe("Aceptación de ruta en el panel del viaje (CHG-174)", () => {
  const receipt = {
    id: "tr-1",
    kind: "mule" as const,
    status: "registered" as const,
    originLocationId: "origen-1",
    destinationLocationId: "destino-1",
    createdAt: "2026-08-19T14:00:00Z",
  };

  const renderPanel = (overrides: {
    validateCode?: jest.Mock;
    acceptRoute?: jest.Mock;
  }) => {
    const validateCode =
      overrides.validateCode ??
      jest.fn().mockResolvedValue({
        transportId: "tr-1",
        validated: true,
        originCenterName: "Acopio La Feria",
        destinationCenterName: "Receptor Mompós",
      });
    const acceptRoute =
      overrides.acceptRoute ??
      jest.fn().mockResolvedValue({
        transportId: "tr-1",
        status: "accepted",
        muleAcceptedAt: "2026-08-19T17:00:00Z",
      });
    render(
      <TransportJourneyPanel
        receipt={receipt}
        kind="mule"
        onHome={jest.fn()}
        watchLocation={() => () => {}}
        validateCode={validateCode as never}
        acceptRoute={acceptRoute as never}
      />,
    );
    return { validateCode, acceptRoute };
  };

  it("validar el código NO acepta la ruta: solo habilita ACEPTAR", async () => {
    const { validateCode, acceptRoute } = renderPanel({});

    fireEvent.changeText(
      screen.getByTestId("route-code-input-01"),
      "rt-2026-abcd1234",
    );
    fireEvent.press(screen.getByTestId("route-code-validate-01"));

    await waitFor(() =>
      // El código viaja normalizado en mayúsculas.
      expect(validateCode).toHaveBeenCalledWith("tr-1", "RT-2026-ABCD1234"),
    );
    expect(await screen.findByTestId("route-code-validated-01")).toBeTruthy();
    // §41: la ruta sigue sin aceptarse hasta el segundo toque.
    expect(acceptRoute).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("route-accept-01"));
    await waitFor(() => expect(acceptRoute).toHaveBeenCalled());
    expect(await screen.findByTestId("route-acceptance-done-01")).toBeTruthy();
  });

  it("un código inválido se explica sin habilitar la aceptación", async () => {
    const { acceptRoute } = renderPanel({
      validateCode: jest
        .fn()
        .mockRejectedValue(
          new Error("El código ingresado no es válido para esta ruta."),
        ),
    });

    fireEvent.changeText(screen.getByTestId("route-code-input-01"), "XXXXXX");
    fireEvent.press(screen.getByTestId("route-code-validate-01"));

    expect(await screen.findByTestId("route-code-error-01")).toHaveTextContent(
      /no es válido para esta ruta/,
    );
    expect(screen.queryByTestId("route-accept-01")).toBeNull();
    expect(acceptRoute).not.toHaveBeenCalled();
  });
});
