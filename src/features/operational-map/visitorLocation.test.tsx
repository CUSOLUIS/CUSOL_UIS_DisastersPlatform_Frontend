/**
 * CHG-055 — Ubicación actual del visitante en el mapa.
 *
 * El helper mapea los errores del navegador a mensajes claros y el
 * botón entrega la coordenada al lienzo o muestra el error sin romper
 * nada; con permiso denegado el mapa sigue funcionando igual.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LocateMeControl } from "./LocateMeControl";
import {
  requestVisitorLocation,
  VisitorLocationError,
} from "./visitorLocation";

afterEach(cleanup);

const POSITION = { coords: { latitude: 7.13, longitude: -73.13 } };

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
    ).resolves.toEqual({ latitude: 7.13, longitude: -73.13 });
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

describe("LocateMeControl", () => {
  it("entrega la coordenada al lienzo al presionar", async () => {
    const onLocated = jest.fn();
    render(
      <LocateMeControl
        onLocated={onLocated}
        locate={() =>
          Promise.resolve({ latitude: 7.13, longitude: -73.13 })
        }
      />,
    );

    fireEvent.press(screen.getByTestId("locate-me-button"));

    await waitFor(() =>
      expect(onLocated).toHaveBeenCalledWith({
        latitude: 7.13,
        longitude: -73.13,
      }),
    );
    expect(screen.queryByTestId("locate-me-error")).toBeNull();
  });

  it("muestra el error sin entregar coordenada", async () => {
    const onLocated = jest.fn();
    render(
      <LocateMeControl
        onLocated={onLocated}
        locate={() =>
          Promise.reject(
            new VisitorLocationError(
              "Permiso de ubicación denegado. Habilítalo en tu navegador.",
            ),
          )
        }
      />,
    );

    fireEvent.press(screen.getByTestId("locate-me-button"));

    expect(
      await screen.findByText(/Permiso de ubicación denegado/),
    ).toBeTruthy();
    expect(onLocated).not.toHaveBeenCalled();
  });
});
