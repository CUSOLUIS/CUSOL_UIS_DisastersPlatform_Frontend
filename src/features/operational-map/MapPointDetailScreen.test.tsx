import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { MapPointDetailScreen } from "./MapPointDetailScreen";
import { normalizeOperationalMapOverview } from "./dataSource";
import { operationalMapDemoData } from "./demoData";
import type { HumanMapPoint } from "./types";

// CHG-164 — Vista pública de información completa de un punto del
// mapa: muestra todo lo público disponible del registro y, sin datos
// válidos (recarga, URL manipulada), explica y ofrece volver.

afterEach(cleanup);

const point = normalizeOperationalMapOverview(operationalMapDemoData).items[0];

it("muestra la información completa de un punto operativo", () => {
  render(
    <MapPointDetailScreen
      payload={{ kind: "operational", point }}
      onBack={jest.fn()}
    />,
  );

  expect(screen.getByTestId("map-point-detail-screen")).toBeTruthy();
  expect(screen.getByText(point.title)).toBeTruthy();
  expect(screen.getByText(point.locationLabel)).toBeTruthy();
  expect(screen.getByText("PRECISIÓN")).toBeTruthy();
  expect(screen.getByText("VERIFICACIÓN")).toBeTruthy();
  expect(screen.getByText("FUENTE")).toBeTruthy();
  expect(screen.getByText("ACTUALIZADO")).toBeTruthy();
});

it("muestra la solicitud de ayuda completa con vigencia y atenciones", () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "help_request",
        request: {
          id: "r1",
          description: "Necesitamos agua potable y frazadas.",
          address: "Barrio Girardot, Bucaramanga",
          latitude: 7.12,
          longitude: -73.12,
          notificationRadiusKm: 5,
          createdAt: "2026-08-19T00:00:00Z",
          expiresAt: "2099-08-19T12:00:00Z",
          attendersCount: 2,
          attendedByMe: false,
          photoUrl: null,
        },
      }}
      onBack={jest.fn()}
    />,
  );

  expect(
    screen.getByText("NECESITAMOS AYUDA · SOLICITUD VIGENTE"),
  ).toBeTruthy();
  expect(
    screen.getByText("Necesitamos agua potable y frazadas."),
  ).toBeTruthy();
  expect(screen.getByText("PERSONAS ATENDIENDO")).toBeTruthy();
  expect(screen.getByText("RADIO DE AVISO")).toBeTruthy();
  expect(screen.getByText("VIGENTE HASTA")).toBeTruthy();
});

it("muestra el punto humano anónimo con su nota de privacidad", () => {
  const feature: HumanMapPoint = {
    kind: "point",
    id: "hp-1",
    status: "missing",
    latitude: 6.9,
    longitude: -73.1,
    coordinatePrecision: "approximate",
    verificationStatus: "under_review",
    source: { name: "Reporte ciudadano", sourceType: "citizen", url: null },
    updatedAt: "2026-08-18T12:00:00Z",
  };
  render(
    <MapPointDetailScreen
      payload={{ kind: "human", feature }}
      onBack={jest.fn()}
    />,
  );

  expect(screen.getByText("PUNTO PÚBLICO ANÓNIMO")).toBeTruthy();
  expect(screen.getByText("Persona desaparecida")).toBeTruthy();
  expect(screen.getByText(/anónimo por diseño/i)).toBeTruthy();
});

it("sin datos válidos explica la situación y VOLVER responde", () => {
  const onBack = jest.fn();
  render(<MapPointDetailScreen payload={null} onBack={onBack} />);

  expect(screen.getByTestId("map-point-detail-missing")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Volver al mapa"));
  expect(onBack).toHaveBeenCalledTimes(1);
});
