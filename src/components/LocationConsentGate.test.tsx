import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  LocationConsentGate,
  type LocationWatcher,
} from "./LocationConsentGate";
import { resetVisitorPresenceForTests } from "../features/operational-map/visitorPresence";

function watcherStub(
  granted: boolean,
  alreadyGranted = false,
  // CHG-129: por defecto el permiso nunca se ha pedido (primera
  // apertura); los casos de permiso retirado pasan undetermined=false.
  undetermined = !alreadyGranted,
) {
  const watch = jest.fn(async () => ({ remove: jest.fn() }));
  const requestPermission = jest.fn(async () => granted);
  const getPermissionState = jest.fn(async () => ({
    granted: alreadyGranted,
    undetermined,
  }));
  const watcher: LocationWatcher = {
    getPermissionState,
    requestPermission,
    watch,
  };
  return { watcher, watch, requestPermission, getPermissionState };
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
    // CHG-110: el aviso aparece tras comprobar el permiso vigente.
    fireEvent.press(
      await screen.findByLabelText("Aceptar y compartir ubicación"),
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
      await screen.findByLabelText("Aceptar y compartir ubicación"),
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

/**
 * CHG-110 — El aviso reaparecía en cada apertura aunque el permiso
 * llevara meses concedido: el portón arrancaba en "consent" sin
 * consultar nada. El permiso del sistema es la persistencia.
 */
describe("Permiso ya concedido (CHG-110)", () => {
  beforeEach(() => {
    resetVisitorPresenceForTests();
  });

  it("no vuelve a pedir consentimiento si el permiso sigue concedido", async () => {
    const { watcher, watch, requestPermission } = watcherStub(true, true);

    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    // Entra directo al flujo normal, sin mostrar el aviso...
    expect(await screen.findByText("contenido")).toBeTruthy();
    expect(screen.queryByTestId("location-consent-gate")).toBeNull();
    // ...y sin volver a abrir el diálogo del sistema.
    expect(requestPermission).not.toHaveBeenCalled();
    // El seguimiento arranca igual.
    await waitFor(() => expect(watch).toHaveBeenCalledTimes(1));
  });

  // CHG-129: el aviso propio se muestra una única vez (permiso nunca
  // pedido). Si el permiso existió y fue retirado (revocado en ajustes
  // o "solo esta vez"), se re-pide directo al sistema sin repetir el
  // aviso: esto era lo que hacía reaparecer la confirmación en cada
  // apertura de la APK.
  it("con el permiso retirado re-pide al sistema sin repetir el aviso", async () => {
    const { watcher, watch, requestPermission } = watcherStub(
      true,
      false,
      false,
    );

    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    // El sistema vuelve a conceder: entra directo, sin aviso propio.
    expect(await screen.findByText("contenido")).toBeTruthy();
    expect(screen.queryByTestId("location-consent-gate")).toBeNull();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(watch).toHaveBeenCalledTimes(1));
  });

  it("si el sistema vuelve a negarlo queda bloqueada con la guía", async () => {
    const { watcher, watch, requestPermission } = watcherStub(
      false,
      false,
      false,
    );

    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    expect(
      await screen.findByText(
        /El permiso de ubicación es necesario para usar la app/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("contenido")).toBeNull();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(watch).not.toHaveBeenCalled();
  });

  it("la primera vez (permiso nunca pedido) sí muestra el aviso", async () => {
    const { watcher, watch, requestPermission } = watcherStub(
      true,
      false,
      true,
    );

    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    expect(await screen.findByTestId("location-consent-gate")).toBeTruthy();
    expect(screen.queryByText("contenido")).toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(watch).not.toHaveBeenCalled();
  });

  it("mientras resuelve el permiso no parpadea el aviso", async () => {
    // Un watcher que tarda: es el instante en que antes se veía el
    // aviso a quien ya lo había aceptado.
    let resolver: (value: {
      granted: boolean;
      undetermined: boolean;
    }) => void = () => undefined;
    const watcher: LocationWatcher = {
      getPermissionState: () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
      requestPermission: jest.fn(async () => true),
      watch: jest.fn(async () => ({ remove: jest.fn() })),
    };

    render(
      <LocationConsentGate
        platformOs="android"
        watcher={async () => watcher}
      >
        <Text>contenido</Text>
      </LocationConsentGate>,
    );

    expect(
      await screen.findByTestId("location-consent-checking"),
    ).toBeTruthy();
    expect(screen.queryByTestId("location-consent-gate")).toBeNull();

    resolver({ granted: true, undetermined: false });
    expect(await screen.findByText("contenido")).toBeTruthy();
  });
});
