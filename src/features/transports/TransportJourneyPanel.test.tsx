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
