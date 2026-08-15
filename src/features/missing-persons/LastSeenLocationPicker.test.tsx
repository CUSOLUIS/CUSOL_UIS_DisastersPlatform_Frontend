import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import type { GeographicCenter } from "../operational-map/webMercator";
import { LastSeenLocationPicker } from "./LastSeenLocationPicker";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

function ControlledPicker({
  addressQuery,
  searchCandidates,
  onChangeSpy,
  locateVisitor,
  onAddressResolved,
  resolveAddress,
}: {
  addressQuery: string;
  searchCandidates?: (query: string) => Promise<
    Array<{ label: string; latitude: number; longitude: number }>
  >;
  onChangeSpy?: jest.Mock;
  locateVisitor?: () => Promise<GeographicCenter>;
  onAddressResolved?: jest.Mock;
  resolveAddress?: jest.Mock;
}) {
  const [value, setValue] = useState<GeographicCenter | null>(null);
  return (
    <LastSeenLocationPicker
      addressQuery={addressQuery}
      value={value}
      onChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
      searchCandidates={searchCandidates}
      locateVisitor={locateVisitor}
      onAddressResolved={onAddressResolved}
      resolveAddress={resolveAddress}
    />
  );
}

describe("Selector de última ubicación", () => {
  it("cruza la dirección, lista coincidencias y fija el muñequito al elegir una", async () => {
    const onChangeSpy = jest.fn();
    const searchCandidates = jest.fn(async () => [
      { label: "Parque García Rovira, Bucaramanga", latitude: 7.1148, longitude: -73.1268 },
      { label: "Carrera 27, Bucaramanga", latitude: 7.12, longitude: -73.12 },
    ]);

    render(
      <ControlledPicker
        addressQuery="Parque García Rovira, Bucaramanga, Santander, Colombia"
        searchCandidates={searchCandidates}
        onChangeSpy={onChangeSpy}
      />,
    );

    expect(screen.getByText(/SIN PUNTO FIJADO/)).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "Cruzar la dirección escrita con el mapa" }),
    );

    expect(await screen.findByTestId("address-candidate-0")).toBeTruthy();
    expect(searchCandidates).toHaveBeenCalledWith(
      "Parque García Rovira, Bucaramanga, Santander, Colombia",
    );

    fireEvent.press(screen.getByTestId("address-candidate-0"));

    expect(onChangeSpy).toHaveBeenCalledWith({ latitude: 7.1148, longitude: -73.1268 });
    expect(await screen.findByTestId("last-seen-marker")).toBeTruthy();
    expect(screen.getByText(/LAT 7\.11480 · LON -73\.12680/)).toBeTruthy();
    // Al elegir la coincidencia el mapa acerca a nivel de calle y muestra teselas z17.
    expect(
      screen.getAllByTestId(/^picker-tile-17-/, { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
  });

  it("deshabilita el cruce sin dirección escrita y explica qué falta", () => {
    render(<ControlledPicker addressQuery="" />);

    const crossButton = screen.getByRole("button", {
      name: "Cruzar la dirección escrita con el mapa",
    });
    expect(crossButton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Escribe departamento, municipio y la dirección/)).toBeTruthy();
  });

  it("informa cuando no hay coincidencias y permite colocar el muñequito manualmente", async () => {
    const onChangeSpy = jest.fn();
    render(
      <ControlledPicker
        addressQuery="Vereda inexistente, Colombia"
        searchCandidates={async () => []}
        onChangeSpy={onChangeSpy}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Cruzar la dirección escrita con el mapa" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Sin coincidencias para la dirección escrita/)).toBeTruthy(),
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Colocar el muñequito en el centro del mapa" }),
    );
    expect(onChangeSpy).toHaveBeenCalledWith({ latitude: 4.65, longitude: -74.25 });
    expect(screen.getByTestId("last-seen-marker")).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "Quitar el punto fijado en el mapa" }),
    );
    expect(onChangeSpy).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId("last-seen-marker")).toBeNull();
  });

  it("muestra el error del servicio de direcciones", async () => {
    render(
      <ControlledPicker
        addressQuery="Bogotá, Colombia"
        searchCandidates={async () => {
          throw new Error("El servicio de direcciones no respondió. Intenta de nuevo.");
        }}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Cruzar la dirección escrita con el mapa" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/servicio de direcciones no respondió/)).toBeTruthy(),
    );
  });
});


// CHG-080 — Fijar el muñequito con el GPS, como en el mapa de la
// portada (CHG-055).
describe("Mi ubicación en el selector", () => {
  it("fija el muñequito en la posición GPS al pulsar el botón", async () => {
    const onChangeSpy = jest.fn();
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1193, longitude: -73.1227 });

    render(
      <ControlledPicker
        addressQuery=""
        onChangeSpy={onChangeSpy}
        locateVisitor={locateVisitor}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Centrar el mapa en mi ubicación actual",
      }),
    );

    await waitFor(() =>
      expect(onChangeSpy).toHaveBeenCalledWith({
        latitude: 7.1193,
        longitude: -73.1227,
      }),
    );
    expect(locateVisitor).toHaveBeenCalledTimes(1);
  });

  it("muestra el error del GPS sin romper el selector", async () => {
    const locateVisitor = jest
      .fn()
      .mockRejectedValue(new Error("Permiso de ubicación denegado."));

    render(
      <ControlledPicker addressQuery="" locateVisitor={locateVisitor} />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Centrar el mapa en mi ubicación actual",
      }),
    );

    expect(
      await screen.findByText("Permiso de ubicación denegado."),
    ).toBeTruthy();
    expect(screen.getByText(/SIN PUNTO FIJADO/)).toBeTruthy();
  });
});

// CHG-086 — Fijar el muñequito autocompleta la dirección (editable).
describe("autocompletado de dirección desde el mapa", () => {
  afterEach(() => jest.useRealTimers());

  it("resuelve la dirección tras fijar la ubicación por GPS", async () => {
    jest.useFakeTimers();
    const onAddressResolved = jest.fn();
    const resolveAddress = jest.fn().mockResolvedValue({
      label: "Carrera 27, Bucaramanga, Santander, Colombia",
      municipality: "Bucaramanga",
      department: "Santander",
    });
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1193, longitude: -73.1227 });

    render(
      <ControlledPicker
        addressQuery=""
        locateVisitor={locateVisitor}
        onAddressResolved={onAddressResolved}
        resolveAddress={resolveAddress}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Centrar el mapa en mi ubicación actual",
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(resolveAddress).toHaveBeenCalledWith({
      latitude: 7.1193,
      longitude: -73.1227,
    });
    expect(onAddressResolved).toHaveBeenCalledWith({
      label: "Carrera 27, Bucaramanga, Santander, Colombia",
      municipality: "Bucaramanga",
      department: "Santander",
    });
  });

  it("la candidata elegida usa su propia dirección sin geocodificar de nuevo", async () => {
    const onAddressResolved = jest.fn();
    const resolveAddress = jest.fn();
    const searchCandidates = jest.fn(async () => [
      {
        label: "Parque García Rovira, Bucaramanga",
        latitude: 7.1148,
        longitude: -73.1268,
      },
    ]);

    render(
      <ControlledPicker
        addressQuery="Parque García Rovira, Bucaramanga, Santander, Colombia"
        searchCandidates={searchCandidates}
        onAddressResolved={onAddressResolved}
        resolveAddress={resolveAddress}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Cruzar la dirección escrita con el mapa",
      }),
    );
    fireEvent.press(await screen.findByTestId("address-candidate-0"));

    expect(onAddressResolved).toHaveBeenCalledWith({
      label: "Parque García Rovira, Bucaramanga",
      municipality: null,
      department: null,
    });
    expect(resolveAddress).not.toHaveBeenCalled();
  });
});
