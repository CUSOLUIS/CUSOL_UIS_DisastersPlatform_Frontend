import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { operationalMapDemoData } from "./demoData";
import { OsmWebMapCanvas } from "./OsmWebMapCanvas";
import { COLOMBIA_BOUNDS } from "./webMercator";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("Respaldo web OpenStreetMap", () => {
  it("muestra teselas reales, atribución, marcadores y selección", () => {
    const onSelect = jest.fn();
    render(
      <OsmWebMapCanvas
        compact={false}
        onSelect={onSelect}
        points={operationalMapDemoData.items}
        selectedId={operationalMapDemoData.items[0].id}
      />,
    );

    expect(screen.getByText("OPENSTREETMAP · SIN CLAVE")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Controles del mapa: arrastra con el mouse o con un dedo para desplazar; usa la rueda o el pellizco de dos dedos para acercar o alejar",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "Atribución de OpenStreetMap contributors",
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByTestId(/^osm-tile-/, { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(10);

    const point = operationalMapDemoData.items[1];
    fireEvent.press(screen.getByTestId(`map-marker-${point.id}`));
    expect(onSelect).toHaveBeenCalledWith(point.id);
  });

  it("mantiene zoom accesible y permite regresar al encuadre de Colombia", () => {
    render(
      <OsmWebMapCanvas
        compact={false}
        onSelect={jest.fn()}
        points={operationalMapDemoData.items}
        selectedId={null}
      />,
    );

    const zoomOut = screen.getByRole("button", { name: "Alejar mapa" });
    expect(zoomOut.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByRole("button", { name: "Acercar mapa" }));
    expect(
      screen.getByRole("button", { name: "Alejar mapa" }).props.accessibilityState.disabled,
    ).toBe(false);
    fireEvent.press(screen.getByRole("button", { name: "Alejar mapa" }));
    expect(
      screen.getByRole("button", { name: "Alejar mapa" }).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it("usa un zoom nacional más amplio en móvil y reporta el bbox completo", () => {
    const onViewportChange = jest.fn();
    render(
      <OsmWebMapCanvas
        compact
        onSelect={jest.fn()}
        onViewportChange={onViewportChange}
        points={operationalMapDemoData.items}
        selectedId={null}
      />,
    );

    expect(onViewportChange).toHaveBeenCalledWith({
      bounds: COLOMBIA_BOUNDS,
      zoom: 4,
    });
    expect(
      screen.getByRole("button", { name: "Alejar mapa" }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it("permite acercar hasta el nivel de edificaciones (zoom 19 de OSM)", () => {
    render(
      <OsmWebMapCanvas
        compact={false}
        onSelect={jest.fn()}
        points={operationalMapDemoData.items}
        selectedId={null}
      />,
    );

    const zoomIn = () =>
      screen.getByRole("button", { name: "Acercar mapa" });

    // Desde el encuadre nacional (zoom 5) hasta el máximo de OSM (19): 14 pasos.
    for (let step = 0; step < 14; step += 1) {
      expect(zoomIn().props.accessibilityState.disabled).toBe(false);
      fireEvent.press(zoomIn());
    }

    expect(zoomIn().props.accessibilityState.disabled).toBe(true);
    expect(
      screen.getAllByTestId(/^osm-tile-19-/, { includeHiddenElements: true })
        .length,
    ).toBeGreaterThan(0);
  });

  it("degrada al lienzo neutro y conserva los puntos si fallan las teselas", () => {
    render(
      <OsmWebMapCanvas
        compact={false}
        onSelect={jest.fn()}
        points={operationalMapDemoData.items}
        selectedId={null}
      />,
    );

    const firstTile = screen.getAllByTestId(/^osm-tile-/, {
      includeHiddenElements: true,
    })[0];
    fireEvent(firstTile, "error");

    expect(screen.getByText("LIENZO NEUTRO · SIN TESELAS")).toBeTruthy();
    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Acercar mapa" })).toBeTruthy();
  });
});

// CHG-057 — Transición suave de zoom sin lienzo negro.

it("conserva la vista anterior debajo mientras cargan las teselas del nuevo zoom", () => {
  render(
    <OsmWebMapCanvas
      compact={false}
      onSelect={jest.fn()}
      points={operationalMapDemoData.items}
      selectedId={null}
    />,
  );

  expect(
    screen.queryAllByTestId(/^osm-previous-tile-/, {
      includeHiddenElements: true,
    }),
  ).toHaveLength(0);

  fireEvent.press(screen.getByRole("button", { name: "Acercar mapa" }));

  // La capa de transición mantiene las teselas del zoom anterior (5)
  // debajo de las nuevas (6): jamás un lienzo negro esperando carga.
  expect(
    screen.getAllByTestId(/^osm-previous-tile-5-/, {
      includeHiddenElements: true,
    }).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByTestId(/^osm-tile-6-/, {
      includeHiddenElements: true,
    }).length,
  ).toBeGreaterThan(0);
});
