/**
 * CHG-055/064 — Ubicación del visitante con seguimiento en vivo.
 *
 * El helper mapea los errores del navegador a mensajes claros; el hook
 * centra una vez, sigue el movimiento mientras la página está abierta,
 * se reanuda solo con permiso recordado y se detiene si lo revocan; el
 * botón presenta estados sin romper el mapa.
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { LocateMeControl } from "./LocateMeControl";
import { useVisitorLocationTracking } from "./useVisitorLocationTracking";
import {
  requestVisitorLocation,
  watchVisitorLocation,
  type GeolocationPermissionState,
} from "./visitorLocation";

afterEach(cleanup);

const POSITION = { coords: { latitude: 7.13, longitude: -73.13 } };
const CENTER = { latitude: 7.13, longitude: -73.13 };

function geolocationResolving() {
  return {
    getCurrentPosition: (onSuccess: (p: typeof POSITION) => void) =>
      onSuccess(POSITION),
  };
}

function geolocationFailing(code: number) {
  return {
    getCurrentPosition: (
      _onSuccess: unknown,
      onError: (error: { code: number }) => void,
    ) => onError({ code }),
  };
}

describe("requestVisitorLocation", () => {
  it("entrega la coordenada del navegador", async () => {
    await expect(
      requestVisitorLocation(geolocationResolving()),
    ).resolves.toEqual(CENTER);
  });

  it("explica el permiso denegado", async () => {
    await expect(
      requestVisitorLocation(geolocationFailing(1)),
    ).rejects.toThrow(/Permiso de ubicación denegado/);
  });

  it("explica el tiempo agotado y la falta de señal", async () => {
    await expect(
      requestVisitorLocation(geolocationFailing(3)),
    ).rejects.toThrow(/tardó demasiado/);
    await expect(
      requestVisitorLocation(geolocationFailing(2)),
    ).rejects.toThrow(/No fue posible determinar/);
  });

  it("rechaza cuando el dispositivo no ofrece geolocalización", async () => {
    await expect(requestVisitorLocation(null)).rejects.toThrow(
      /no permite obtener la ubicación/,
    );
  });
});

describe("watchVisitorLocation", () => {
  it("emite actualizaciones, avisa la revocación y limpia el watch", () => {
    const callbacks: {
      success?: (p: typeof POSITION) => void;
      error?: (e: { code: number }) => void;
    } = {};
    const clearWatch = jest.fn();
    const geolocation = {
      getCurrentPosition: jest.fn(),
      watchPosition: (
        onSuccess: (p: typeof POSITION) => void,
        onError: (e: { code: number }) => void,
      ) => {
        callbacks.success = onSuccess;
        callbacks.error = onError;
        return 77;
      },
      clearWatch,
    };
    const onUpdate = jest.fn();
    const onRevoked = jest.fn();

    const stop = watchVisitorLocation(onUpdate, onRevoked, geolocation);
    callbacks.success?.(POSITION);
    expect(onUpdate).toHaveBeenCalledWith(CENTER);

    // Un fallo transitorio de señal no revoca el seguimiento.
    callbacks.error?.({ code: 2 });
    expect(onRevoked).not.toHaveBeenCalled();
    callbacks.error?.({ code: 1 });
    expect(onRevoked).toHaveBeenCalledTimes(1);

    stop();
    expect(clearWatch).toHaveBeenCalledWith(77);
  });
});

describe("useVisitorLocationTracking", () => {
  function trackingHarness({
    permission = "prompt",
    locate = jest.fn().mockResolvedValue(CENTER),
  }: {
    permission?: GeolocationPermissionState;
    locate?: jest.Mock;
  } = {}) {
    let watchUpdate: ((c: typeof CENTER) => void) | null = null;
    let watchRevoked: (() => void) | null = null;
    const stopWatch = jest.fn();
    const watch = jest.fn(
      (
        onUpdate: (c: typeof CENTER) => void,
        onRevoked?: () => void,
      ) => {
        watchUpdate = onUpdate;
        watchRevoked = onRevoked ?? null;
        return stopWatch;
      },
    );
    const onCenter = jest.fn();
    const hook = renderHook(() =>
      useVisitorLocationTracking({
        onCenter,
        locate,
        watch,
        permissionState: async () => permission,
      }),
    );
    return {
      hook,
      onCenter,
      locate,
      watch,
      stopWatch,
      update: (c: typeof CENTER) => watchUpdate?.(c),
      revoke: () => watchRevoked?.(),
    };
  }

  it("activa, centra una vez y sigue el movimiento sin recentrar", async () => {
    const harness = trackingHarness();

    await act(async () => {
      await harness.hook.result.current.activate();
    });

    expect(harness.hook.result.current.location).toEqual(CENTER);
    expect(harness.onCenter).toHaveBeenCalledTimes(1);
    expect(harness.watch).toHaveBeenCalledTimes(1);

    const moved = { latitude: 7.2, longitude: -73.2 };
    act(() => harness.update(moved));
    expect(harness.hook.result.current.location).toEqual(moved);
    // El mapa no se recentra con cada paso: solo el marcador se mueve.
    expect(harness.onCenter).toHaveBeenCalledTimes(1);
  });

  it("se reanuda solo cuando el navegador recuerda el permiso", async () => {
    const harness = trackingHarness({ permission: "granted" });

    await waitFor(() =>
      expect(harness.hook.result.current.location).toEqual(CENTER),
    );
    expect(harness.locate).toHaveBeenCalledTimes(1);
  });

  it("sin permiso recordado no dispara nada hasta pulsar el botón", async () => {
    const harness = trackingHarness({ permission: "prompt" });

    await act(async () => Promise.resolve());
    expect(harness.locate).not.toHaveBeenCalled();
    expect(harness.hook.result.current.location).toBeNull();
  });

  it("al revocar el permiso detiene el seguimiento y retira el marcador", async () => {
    const harness = trackingHarness();
    await act(async () => {
      await harness.hook.result.current.activate();
    });

    act(() => harness.revoke());

    expect(harness.stopWatch).toHaveBeenCalled();
    expect(harness.hook.result.current.location).toBeNull();
  });

  it("expone el error de ubicación sin romper el estado", async () => {
    const harness = trackingHarness({
      locate: jest
        .fn()
        .mockRejectedValue(new Error("Permiso de ubicación denegado.")),
    });

    await act(async () => {
      await harness.hook.result.current.activate();
    });

    expect(harness.hook.result.current.error).toMatch(/denegado/);
    expect(harness.hook.result.current.location).toBeNull();
  });
});

describe("LocateMeControl", () => {
  it("presenta el botón y delega la activación", () => {
    const onPress = jest.fn();
    render(
      <LocateMeControl
        available
        onPress={onPress}
        locating={false}
        error={null}
      />,
    );

    fireEvent.press(screen.getByTestId("locate-me-button"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("locate-me-error")).toBeNull();
  });

  it("muestra el error recibido", () => {
    render(
      <LocateMeControl
        available
        onPress={jest.fn()}
        locating={false}
        error="Permiso de ubicación denegado."
      />,
    );

    expect(screen.getByTestId("locate-me-error")).toBeTruthy();
  });

  it("sin geolocalización disponible no se ofrece", () => {
    render(
      <LocateMeControl
        available={false}
        onPress={jest.fn()}
        locating={false}
        error={null}
      />,
    );

    expect(screen.queryByTestId("locate-me-button")).toBeNull();
  });
});
