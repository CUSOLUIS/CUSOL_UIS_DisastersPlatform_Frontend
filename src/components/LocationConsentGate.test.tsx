import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  LocationConsentGate,
  type LocationWatcher,
} from "./LocationConsentGate";
import { resetVisitorPresenceForTests } from "../features/operational-map/visitorPresence";

function watcherStub(granted: boolean) {
  const watch = jest.fn(async () => ({ remove: jest.fn() }));
  const watcher: LocationWatcher = {
    requestPermission: jest.fn(async () => granted),
    watch,
  };
  return { watcher, watch };
}

describe("LocationConsentGate", () => {
  beforeEach(() => {
    resetVisitorPresenceForTests();
  });

  it("en web no exige consentimiento y muestra el contenido", () => {
    render(
      <LocationConsentGate platformOs="web">
        <Text>contenido</Text>
      </LocationConsentGate>,
    );
    expect(screen.getByText("contenido")).toBeTruthy();
    expect(screen.queryByTestId("location-consent-gate")).toBeNull();
  });

  it("en la app bloquea hasta aceptar y luego inicia el seguimiento", async () => {
    const { watcher, watch } = watcherStub(true);
    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    expect(screen.queryByText("contenido")).toBeNull();
    fireEvent.press(
      screen.getByLabelText("Aceptar y compartir ubicación"),
    );

    expect(await screen.findByText("contenido")).toBeTruthy();
    await waitFor(() => expect(watch).toHaveBeenCalledTimes(1));
  });

  it("si el sistema niega el permiso sigue bloqueada con aviso", async () => {
    const { watcher, watch } = watcherStub(false);
    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    fireEvent.press(
      screen.getByLabelText("Aceptar y compartir ubicación"),
    );

    expect(
      await screen.findByText(
        /El permiso de ubicación es necesario para usar la app/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("contenido")).toBeNull();
    expect(watch).not.toHaveBeenCalled();
  });
});
