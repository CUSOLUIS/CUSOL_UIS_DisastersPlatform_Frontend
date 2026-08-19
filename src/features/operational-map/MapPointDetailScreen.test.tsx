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

// CHG-165 — Solo los Centros de Acopio Local llevan la sección de
// comentarios y denuncias; el resto de tipos no la muestra.
it("un centro de acopio local ofrece COMENTAR, DENUNCIAR y COMENTARIOS", async () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        point: { ...point, category: "collection_center" },
      }}
      onBack={jest.fn()}
    />,
  );

  expect(
    await screen.findByTestId("collection-center-community-panel"),
  ).toBeTruthy();
  expect(screen.getByTestId("center-comment-button")).toBeTruthy();
  expect(screen.getByTestId("center-report-button")).toBeTruthy();
});

// CHG-166 — La vista completa de un acopio local muestra la misma
// línea de estrellas del popup; sin calificaciones lo dice en
// palabras y las demás categorías no llevan la línea.
it("un acopio local muestra el promedio de estrellas de sus comentarios", async () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        point: {
          ...point,
          category: "collection_center",
          commentRatingAverage: 4.2,
          commentRatingCount: 8,
        },
      }}
      onBack={jest.fn()}
    />,
  );
  await screen.findByTestId("center-comments-average");

  expect(screen.getByTestId("map-point-detail-rating")).toBeTruthy();
  expect(screen.getByText("★★★★☆ 4,2 · 8 calificaciones")).toBeTruthy();
});

it("un acopio sin calificaciones dice que aún no tiene", async () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        // Sin campos de calificación: caso de backend viejo (CHG-137).
        point: { ...point, category: "collection_center" },
      }}
      onBack={jest.fn()}
    />,
  );
  await screen.findByTestId("center-comments-average");

  expect(
    screen.getByTestId("map-point-detail-rating").props.children,
  ).toBe("Sin calificaciones aún");
});

it("otros tipos de punto no llevan la sección comunitaria", () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        point: { ...point, category: "temporary_shelter" },
      }}
      onBack={jest.fn()}
    />,
  );

  expect(
    screen.queryByTestId("collection-center-community-panel"),
  ).toBeNull();
  expect(screen.queryByTestId("map-point-detail-rating")).toBeNull();
});

it("sin datos válidos explica la situación y VOLVER responde", () => {
  const onBack = jest.fn();
  render(<MapPointDetailScreen payload={null} onBack={onBack} />);

  expect(screen.getByTestId("map-point-detail-missing")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Volver al mapa"));
  expect(onBack).toHaveBeenCalledTimes(1);
});

// CHG-168 — El acopio receptor comparte las reglas del local: misma
// línea de estrellas y misma sección comunitaria en su vista completa.
it("un acopio receptor muestra promedio, COMENTAR y DENUNCIAR", async () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        point: {
          ...point,
          category: "receiver_center",
          commentRatingAverage: 3.5,
          commentRatingCount: 2,
        },
      }}
      onBack={jest.fn()}
    />,
  );
  await screen.findByTestId("center-comments-average");

  expect(screen.getByText("★★★★☆ 3,5 · 2 calificaciones")).toBeTruthy();
  expect(
    screen.getByTestId("collection-center-community-panel"),
  ).toBeTruthy();
  expect(screen.getByTestId("center-comment-button")).toBeTruthy();
  expect(screen.getByTestId("center-report-button")).toBeTruthy();
});
