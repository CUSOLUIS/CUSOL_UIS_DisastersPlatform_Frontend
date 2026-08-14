import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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
}: {
  addressQuery: string;
  searchCandidates?: (query: string) => Promise<
    Array<{ label: string; latitude: number; longitude: number }>
  >;
  onChangeSpy?: jest.Mock;
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
    expect(screen.getByText(/Escribe departamento, municipio y zona/)).toBeTruthy();
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
