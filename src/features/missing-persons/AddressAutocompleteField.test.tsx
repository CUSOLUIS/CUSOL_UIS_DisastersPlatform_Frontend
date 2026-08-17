// CHG-141 — Sugerencias de dirección mientras se escribe: debounce
// real, solo la última consulta pinta, fallos silenciosos y la
// selección sustituye el texto por la dirección completa.

import { cleanup, fireEvent, render, screen, act } from "@testing-library/react-native";
import { useState } from "react";
import { AddressAutocompleteField } from "./AddressAutocompleteField";
import type { AddressCandidate } from "./geocoding";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

const candidate: AddressCandidate = {
  label: "Parque San Pío, Cra. 33, Bucaramanga, Santander, Colombia",
  latitude: 7.1148,
  longitude: -73.1268,
};

function Controlled({
  searchCandidates,
  onSelectCandidate,
}: {
  searchCandidates: (query: string) => Promise<AddressCandidate[]>;
  onSelectCandidate?: jest.Mock;
}) {
  const [value, setValue] = useState("");
  return (
    <AddressAutocompleteField
      label="Dirección *"
      value={value}
      onChangeText={setValue}
      searchCandidates={searchCandidates}
      onSelectCandidate={onSelectCandidate}
    />
  );
}

describe("AddressAutocompleteField (CHG-141)", () => {
  it("sugiere con debounce y elegir sustituye el texto completo", async () => {
    jest.useFakeTimers();
    const searchCandidates = jest.fn(async () => [candidate]);
    render(<Controlled searchCandidates={searchCandidates} />);

    const input = screen.getByLabelText("Dirección *");
    fireEvent.changeText(input, "parque san pio");
    // Antes del debounce no hay consulta.
    expect(searchCandidates).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(450);
      await Promise.resolve();
    });

    expect(searchCandidates).toHaveBeenCalledTimes(1);
    expect(searchCandidates).toHaveBeenCalledWith(
      "parque san pio, Colombia",
    );
    fireEvent.press(
      screen.getByLabelText(
        `Usar dirección sugerida: ${candidate.label}`,
      ),
    );
    expect(input.props.value).toBe(candidate.label);
    // El desplegable se cierra y el reemplazo no re-consulta.
    expect(screen.queryByTestId("address-suggestions")).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(searchCandidates).toHaveBeenCalledTimes(1);
  });

  it("escribir seguido reinicia el contador: una sola consulta", async () => {
    jest.useFakeTimers();
    const searchCandidates = jest.fn(async () => [candidate]);
    render(<Controlled searchCandidates={searchCandidates} />);

    const input = screen.getByLabelText("Dirección *");
    fireEvent.changeText(input, "parque");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.changeText(input, "parque san");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.changeText(input, "parque san pio");
    await act(async () => {
      jest.advanceTimersByTime(450);
      await Promise.resolve();
    });

    expect(searchCandidates).toHaveBeenCalledTimes(1);
    expect(searchCandidates).toHaveBeenCalledWith(
      "parque san pio, Colombia",
    );
  });

  it("una respuesta vieja no pisa a la consulta vigente", async () => {
    jest.useFakeTimers();
    let resolveOld: (value: AddressCandidate[]) => void = () => undefined;
    const searchCandidates = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AddressCandidate[]>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue([candidate]);
    render(<Controlled searchCandidates={searchCandidates} />);

    const input = screen.getByLabelText("Dirección *");
    fireEvent.changeText(input, "parque viejo");
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    fireEvent.changeText(input, "parque san pio");
    await act(async () => {
      jest.advanceTimersByTime(450);
      await Promise.resolve();
    });
    expect(
      screen.getByLabelText(`Usar dirección sugerida: ${candidate.label}`),
    ).toBeTruthy();

    // La consulta vieja responde tarde con otra cosa: se ignora.
    await act(async () => {
      resolveOld([{ label: "Lugar viejo", latitude: 1, longitude: 1 }]);
      await Promise.resolve();
    });
    expect(screen.queryByLabelText("Usar dirección sugerida: Lugar viejo")).toBeNull();
    expect(
      screen.getByLabelText(`Usar dirección sugerida: ${candidate.label}`),
    ).toBeTruthy();
  });

  it("el fallo del proveedor es silencioso: sin sugerencias, sin bloqueo", async () => {
    jest.useFakeTimers();
    const failing = jest.fn().mockRejectedValue(new Error("sin red"));
    render(<Controlled searchCandidates={failing} />);

    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "parque san pio",
    );
    await act(async () => {
      jest.advanceTimersByTime(450);
      await Promise.resolve();
    });
    expect(screen.queryByTestId("address-suggestions")).toBeNull();
  });

  it("el desplegable se puede cerrar sin elegir nada", async () => {
    jest.useFakeTimers();
    const working = jest.fn(async () => [candidate]);
    render(<Controlled searchCandidates={working} />);

    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "parque san pio",
    );
    await act(async () => {
      jest.advanceTimersByTime(450);
      await Promise.resolve();
    });
    fireEvent.press(
      screen.getByLabelText("Cerrar sugerencias de dirección"),
    );
    expect(screen.queryByTestId("address-suggestions")).toBeNull();
  });
});
