/**
 * CHG-074 — En Android, react-native-maps exige Google Maps con API
 * key; sin la clave configurada, montar MapView tumba la app al abrir
 * (crash nativo). Sin clave, MapView JAMÁS se monta.
 *
 * CHG-121 — Que no haya clave ya no condena a Android al lienzo neutro:
 * el mapa real lo pinta el lienzo de teselas propio (CARTO, CHG-109),
 * construido solo con primitivas de React Native.
 */

import { render, screen } from "@testing-library/react-native";
import type { OperationalMapCanvasProps } from "./types";

const mockMapViewMounted = jest.fn();

jest.mock("react-native-maps", () => {
  const { View: RNView } = jest.requireActual("react-native");
  const MockMapView = () => {
    mockMapViewMounted();
    return <RNView testID="native-map-view">{null}</RNView>;
  };
  return {
    __esModule: true,
    default: MockMapView,
    Marker: RNView,
    UrlTile: RNView,
    PROVIDER_GOOGLE: "google",
  };
});

// El mock global de setup.ts reemplaza OperationalMapCanvas; aquí se
// prueba el archivo NATIVO real.
const { OperationalMapCanvas } = jest.requireActual<
  typeof import("./OperationalMapCanvas.native")
>("./OperationalMapCanvas.native");

function canvasProps(): OperationalMapCanvasProps {
  return {
    points: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        category: "missing_person",
        title: "Punto de prueba",
        locationLabel: "Bucaramanga",
        latitude: 7.12,
        longitude: -73.12,
        coordinatePrecision: "approximate",
        verificationStatus: "unverified",
        relatedDisasterId: null,
        description: null,
        source: { name: "Prueba", sourceType: "citizen", url: null },
        updatedAt: "2026-08-15T12:00:00Z",
      },
    ],
    selectedId: null,
    onSelect: jest.fn(),
  } as unknown as OperationalMapCanvasProps;
}

afterEach(() => {
  mockMapViewMounted.mockClear();
});

it("en Android sin clave de Google pinta teselas reales y no monta MapView", () => {
  render(<OperationalMapCanvas {...canvasProps()} platformOs="android" />);

  expect(mockMapViewMounted).not.toHaveBeenCalled();
  expect(screen.queryByTestId("native-map-view")).toBeNull();
  // CHG-121: el lienzo de teselas propio pinta el mapa real…
  expect(
    screen.getAllByTestId(/^osm-tile-/, { includeHiddenElements: true }).length,
  ).toBeGreaterThan(0);
  // …y dibuja los marcadores por su cuenta.
  expect(
    screen.getByTestId("map-marker-10000000-0000-4000-8000-000000000001"),
  ).toBeTruthy();
});

it("en iOS sí puede montar el mapa nativo (Apple Maps no exige clave)", () => {
  render(<OperationalMapCanvas {...canvasProps()} platformOs="ios" />);

  expect(mockMapViewMounted).toHaveBeenCalled();
});
