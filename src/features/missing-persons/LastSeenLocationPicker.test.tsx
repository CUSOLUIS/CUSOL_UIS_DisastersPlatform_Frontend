import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import type { GeographicCenter } from "../operational-map/webMercator";
import {
  resetVisitorPresenceForTests,
  setLastKnownVisitorLocation,
} from "../operational-map/visitorPresence";
import { LastSeenLocationPicker } from "./LastSeenLocationPicker";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  resetVisitorPresenceForTests();
});

function ControlledPicker({
  addressQuery,
  searchCandidates,
  onChangeSpy,
  locateVisitor,
  onAddressResolved,
  resolveAddress,
  autoLocateOnEntry,
  previewRadiusKm,
  locateMode,
}: {
  addressQuery: string;
  searchCandidates?: (query: string) => Promise<
    Array<{ label: string; latitude: number; longitude: number }>
  >;
  onChangeSpy?: jest.Mock;
  locateVisitor?: () => Promise<GeographicCenter>;
  onAddressResolved?: jest.Mock;
  resolveAddress?: jest.Mock;
  autoLocateOnEntry?: boolean;
  previewRadiusKm?: number | null;
  locateMode?: "marker" | "dot";
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
      autoLocateOnEntry={autoLocateOnEntry}
      previewRadiusKm={previewRadiusKm}
      locateMode={locateMode}
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

// CHG-130 — Al entrar a «Necesitamos ayuda» se intenta UNA vez obtener
// la ubicación; el rechazo no bloquea y los demás formularios no
// prellenan (autoLocateOnEntry es opt-in).
describe("Auto-ubicación al entrar (CHG-130)", () => {
  it("con autoLocateOnEntry pide la posición al montar y fija el punto", async () => {
    const onChangeSpy = jest.fn();
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1398, longitude: -73.1211 });

    render(
      <ControlledPicker
        addressQuery=""
        onChangeSpy={onChangeSpy}
        locateVisitor={locateVisitor}
        autoLocateOnEntry
      />,
    );

    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onChangeSpy).toHaveBeenCalledWith({
        latitude: 7.1398,
        longitude: -73.1211,
      }),
    );
  });

  it("con posición ya conocida la usa sin pedir permiso de nuevo", async () => {
    const onChangeSpy = jest.fn();
    const locateVisitor = jest.fn();
    setLastKnownVisitorLocation({ latitude: 6.98, longitude: -73.05 });

    render(
      <ControlledPicker
        addressQuery=""
        onChangeSpy={onChangeSpy}
        locateVisitor={locateVisitor}
        autoLocateOnEntry
      />,
    );

    await waitFor(() =>
      expect(onChangeSpy).toHaveBeenCalledWith({
        latitude: 6.98,
        longitude: -73.05,
      }),
    );
    expect(locateVisitor).not.toHaveBeenCalled();
  });

  it("si el permiso se niega no bloquea: queda el aviso y el flujo manual", async () => {
    const onChangeSpy = jest.fn();
    const locateVisitor = jest
      .fn()
      .mockRejectedValue(new Error("Permiso de ubicación denegado."));

    render(
      <ControlledPicker
        addressQuery=""
        onChangeSpy={onChangeSpy}
        locateVisitor={locateVisitor}
        autoLocateOnEntry
      />,
    );

    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Permiso de ubicación denegado."),
    ).toBeTruthy();
    expect(onChangeSpy).not.toHaveBeenCalled();
    // Un solo intento: no hay bucles de re-solicitud.
    expect(locateVisitor).toHaveBeenCalledTimes(1);
    // El flujo manual sigue disponible.
    expect(
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      }),
    ).toBeTruthy();
  });

  it("sin autoLocateOnEntry no pide nada al montar", () => {
    const locateVisitor = jest.fn();
    render(
      <ControlledPicker addressQuery="" locateVisitor={locateVisitor} />,
    );
    expect(locateVisitor).not.toHaveBeenCalled();
  });
});

// CHG-134 — La cobertura del radio de aviso se dibuja alrededor del
// muñequito a escala real (al acercar el mapa a nivel de calle).
describe("Cobertura del radio de aviso (CHG-134)", () => {
  it("dibuja el círculo al fijar el punto con radio definido", async () => {
    const searchCandidates = jest.fn(async () => [
      { label: "Parque García Rovira, Bucaramanga", latitude: 7.1148, longitude: -73.1268 },
    ]);
    render(
      <ControlledPicker
        addressQuery="Parque García Rovira, Bucaramanga"
        searchCandidates={searchCandidates}
        previewRadiusKm={5}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Cruzar la dirección escrita con el mapa" }),
    );
    fireEvent.press(await screen.findByTestId("address-candidate-0"));

    // Al elegir la candidata el zoom llega a nivel de calle (z17): el
    // círculo de 5 km cabe en el rango dibujable.
    expect(screen.getByTestId("picker-alert-radius")).toBeTruthy();
  });

  it("sin radio no hay círculo", async () => {
    const searchCandidates = jest.fn(async () => [
      { label: "Parque García Rovira, Bucaramanga", latitude: 7.1148, longitude: -73.1268 },
    ]);
    render(
      <ControlledPicker
        addressQuery="Parque García Rovira, Bucaramanga"
        searchCandidates={searchCandidates}
      />,
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Cruzar la dirección escrita con el mapa" }),
    );
    fireEvent.press(await screen.findByTestId("address-candidate-0"));
    expect(screen.queryByTestId("picker-alert-radius")).toBeNull();
  });
});

// CHG-141 — Modo punto azul: el GPS ya no coloca el muñequito ni toca
// la dirección; muestra dónde cree el dispositivo que estás, y
// «COLOCAR MUÑEQUITO» convierte ese punto en el marcador exacto.
describe("Punto azul de ubicación actual (CHG-141)", () => {
  it("el GPS muestra el punto azul sin fijar muñequito ni dirección", async () => {
    const onChangeSpy = jest.fn();
    const onAddressResolved = jest.fn();
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1193, longitude: -73.1227 });

    render(
      <ControlledPicker
        addressQuery=""
        onChangeSpy={onChangeSpy}
        locateVisitor={locateVisitor}
        onAddressResolved={onAddressResolved}
        locateMode="dot"
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Centrar el mapa en mi ubicación actual",
      }),
    );

    expect(await screen.findByTestId("current-location-dot")).toBeTruthy();
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(onAddressResolved).not.toHaveBeenCalled();
    expect(screen.queryByTestId("last-seen-marker")).toBeNull();
  });

  it("COLOCAR MUÑEQUITO cae sobre el punto azul y este desaparece", async () => {
    const onChangeSpy = jest.fn();
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1193, longitude: -73.1227 });

    render(
      <ControlledPicker
        addressQuery=""
        onChangeSpy={onChangeSpy}
        locateVisitor={locateVisitor}
        locateMode="dot"
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Centrar el mapa en mi ubicación actual",
      }),
    );
    await screen.findByTestId("current-location-dot");

    fireEvent.press(
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      }),
    );

    expect(onChangeSpy).toHaveBeenCalledWith({
      latitude: 7.1193,
      longitude: -73.1227,
    });
    expect(screen.queryByTestId("current-location-dot")).toBeNull();
    expect(screen.getByTestId("last-seen-marker")).toBeTruthy();
  });
});

// CHG-141 — Feedback de la geocodificación inversa: «Obteniendo
// dirección…» mientras resuelve; el fallo conserva marcador y
// dirección con un aviso no invasivo.
describe("Feedback de la dirección (CHG-141)", () => {
  afterEach(() => jest.useRealTimers());

  it("muestra el estado de carga y lo retira al resolver", async () => {
    jest.useFakeTimers();
    let resolveAddressNow: (value: {
      label: string;
      municipality: string | null;
      department: string | null;
    }) => void = () => undefined;
    const resolveAddress = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAddressNow = resolve;
        }),
    );
    const onAddressResolved = jest.fn();

    render(
      <ControlledPicker
        addressQuery=""
        onAddressResolved={onAddressResolved}
        resolveAddress={resolveAddress as never}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Obteniendo dirección…")).toBeTruthy();

    await act(async () => {
      resolveAddressNow({
        label: "Carrera 27 # 10-25, Bucaramanga",
        municipality: null,
        department: null,
      });
      await Promise.resolve();
    });
    expect(screen.queryByText("Obteniendo dirección…")).toBeNull();
    expect(onAddressResolved).toHaveBeenCalled();
  });

  it("si la resolución falla, avisa sin borrar nada y sin bloquear", async () => {
    jest.useFakeTimers();
    const resolveAddress = jest
      .fn()
      .mockRejectedValue(new Error("proveedor caído"));

    render(
      <ControlledPicker
        addressQuery=""
        onAddressResolved={jest.fn()}
        resolveAddress={resolveAddress}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      }),
    );
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(
      screen.getByText(/No fue posible obtener la dirección de ese punto/),
    ).toBeTruthy();
    // El muñequito sigue puesto: nada se borra abruptamente.
    expect(screen.getByTestId("last-seen-marker")).toBeTruthy();
  });
});

// CHG-143 — Colocar el muñequito es una intención explícita: debe
// resolver la dirección SIEMPRE, aunque las coordenadas coincidan con
// las ya fijadas (recolocar en el mismo punto). Antes se necesitaban
// dos intentos porque el efecto dependía solo del cambio de coordenadas.
describe("Colocar muñequito resuelve siempre (CHG-143)", () => {
  afterEach(() => jest.useRealTimers());

  it("recolocar el GPS en el mismo punto vuelve a resolver la dirección", async () => {
    jest.useFakeTimers();
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1193, longitude: -73.1227 });
    const resolveAddress = jest.fn().mockResolvedValue({
      label: "Carrera 27 # 10-25, Bucaramanga",
      municipality: null,
      department: null,
    });
    const onAddressResolved = jest.fn();

    render(
      <ControlledPicker
        addressQuery=""
        locateMode="dot"
        locateVisitor={locateVisitor}
        onAddressResolved={onAddressResolved}
        resolveAddress={resolveAddress}
      />,
    );

    const locate = () =>
      screen.getByRole("button", {
        name: "Centrar el mapa en mi ubicación actual",
      });
    const place = () =>
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      });

    // Primer intento: círculo + un solo colocar.
    await act(async () => fireEvent.press(locate()));
    await act(async () => fireEvent.press(place()));
    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });
    expect(onAddressResolved).toHaveBeenCalledTimes(1);

    // Segundo intento sobre el MISMO punto: debe resolver de nuevo.
    await act(async () => fireEvent.press(locate()));
    await act(async () => fireEvent.press(place()));
    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });
    expect(onAddressResolved).toHaveBeenCalledTimes(2);
  });
});
