import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import type { ActiveHelpRequest } from "../help-requests/types";
import type { ActiveFoodOffer } from "../food-offers/types";
import { normalizeOperationalMapOverview } from "./dataSource";
import { operationalMapDemoData } from "./demoData";
import { OperationalMapPanel } from "./OperationalMapPanel";
import type {
  HumanMapDataSource,
  HumanMapOverview,
  HumanMapPoint,
  OperationalMapDataSource,
} from "./types";

// CHG-164 — Popup de resumen al tocar cualquier marcador del mapa:
// lo básico, «VER MÁS» hacia /detalle-punto y «X» para cerrar; vale
// para visitantes anónimos y cuentas por igual.

afterEach(cleanup);

const overview = normalizeOperationalMapOverview(operationalMapDemoData);
const firstPoint = overview.items[0];

const mapSource: OperationalMapDataSource = {
  transport: "fixture",
  initialOverview: overview,
  getOverview: async () => overview,
};

const humanPoint: HumanMapPoint = {
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

const humanOverview: HumanMapOverview = {
  features: [
    humanPoint,
    {
      kind: "cluster",
      id: "cl-1",
      latitude: 4.6,
      longitude: -74.1,
      count: 12,
      statusCounts: {
        missing: 5,
        reportedDeceased: 2,
        confirmedAlive: 4,
        confirmedDeceased: 1,
      },
      bounds: { west: -75, south: 4, east: -73, north: 5 },
    },
  ],
  totalMatched: 13,
  totalMapped: 13,
  unmappedCount: 0,
  unmappedStatusCounts: {
    missing: 0,
    reportedDeceased: 0,
    confirmedAlive: 0,
    confirmedDeceased: 0,
  },
  returnedFeatures: 2,
  nextCursor: null,
  generatedAt: "2026-08-18T12:00:00Z",
  dataClassification: "demonstrative",
};

const humanSource: HumanMapDataSource = {
  transport: "fixture",
  initialOverview: humanOverview,
  getOverview: async () => humanOverview,
};

const request: ActiveHelpRequest = {
  id: "b2000000-0000-4000-8000-000000000001",
  description: "Se necesita ayuda para evacuar a dos adultos mayores.",
  address: "Vereda El Salado, Piedecuesta",
  latitude: 6.9871,
  longitude: -73.0498,
  notificationRadiusKm: null,
  createdAt: "2026-08-16T10:00:00Z",
  expiresAt: "2099-08-16T22:00:00Z",
  attendersCount: 2,
  attendedByMe: false,
  photoUrl: null,
};

const offer: ActiveFoodOffer = {
  id: "f1000000-0000-4000-8000-000000000001",
  description: "Olla comunitaria de almuerzo para 80 personas.",
  address: "Cancha del barrio La Feria",
  latitude: 7.11,
  longitude: -73.13,
  notificationRadiusKm: 3,
  createdAt: "2026-08-19T00:00:00Z",
  expiresAt: "2099-08-19T18:00:00Z",
};

function renderPanel(
  props: Partial<Parameters<typeof OperationalMapPanel>[0]> = {},
) {
  return render(
    <OperationalMapPanel
      dataSource={mapSource}
      humanDataSource={humanSource}
      compact={false}
      {...props}
    />,
  );
}

it("tocar un marcador operativo abre el popup con resumen, VER MÁS y cierre", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ onOpenPointDetail });

  expect(screen.queryByTestId("map-marker-popup")).toBeNull();
  fireEvent.press(await screen.findByTestId(`map-marker-${firstPoint.id}`));

  expect(screen.getByTestId("map-marker-popup")).toBeTruthy();
  expect(screen.getAllByText(firstPoint.title).length).toBeGreaterThan(0);

  fireEvent.press(screen.getByTestId("map-marker-popup-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "operational",
    point: firstPoint,
  });
  // «VER MÁS» navega y deja el popup cerrado.
  expect(screen.queryByTestId("map-marker-popup")).toBeNull();
});

it("la X cierra el popup sin navegar", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ onOpenPointDetail });

  fireEvent.press(await screen.findByTestId(`map-marker-${firstPoint.id}`));
  fireEvent.press(screen.getByTestId("map-marker-popup-close"));

  expect(screen.queryByTestId("map-marker-popup")).toBeNull();
  expect(onOpenPointDetail).not.toHaveBeenCalled();
});

it("sin callback de detalle el popup resume y cierra, sin VER MÁS", async () => {
  renderPanel();

  fireEvent.press(await screen.findByTestId(`map-marker-${firstPoint.id}`));

  expect(screen.getByTestId("map-marker-popup")).toBeTruthy();
  expect(screen.queryByTestId("map-marker-popup-more")).toBeNull();
});

it("una oferta de comida abre su popup con vigencia y VER MÁS entrega la oferta", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ foodOffers: [offer], onOpenPointDetail });

  fireEvent.press(
    await screen.findByTestId(`map-marker-food_offer:${offer.id}`),
  );

  const popup = screen.getByTestId("map-marker-popup");
  // El texto también vive en la franja heredada de CHG-163: se busca
  // dentro del popup.
  expect(
    within(popup).getByText("COMIDA COMUNITARIA · OFERTA VIGENTE"),
  ).toBeTruthy();

  fireEvent.press(screen.getByTestId("map-marker-popup-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "food_offer",
    offer,
  });
});

it("una solicitud sin ventana de acción abre el popup genérico con la solicitud", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ helpRequests: [request], onOpenPointDetail });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.getByTestId("map-marker-popup")).toBeTruthy();
  fireEvent.press(screen.getByTestId("map-marker-popup-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "help_request",
    request,
  });
});

it("con acciones disponibles la solicitud abre su ventana CHG-148 con VER MÁS, no el popup", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({
    helpRequests: [request],
    helpRequestActions: { isAuthenticated: false, attend: jest.fn() },
    onOpenPointDetail,
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.queryByTestId("map-marker-popup")).toBeNull();
  expect(screen.getByTestId("help-request-action-sheet")).toBeTruthy();

  fireEvent.press(screen.getByTestId("action-sheet-view-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "help_request",
    request,
  });
});

it("un punto humano abre popup anónimo y VER MÁS entrega el punto", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ onOpenPointDetail });

  fireEvent.press(
    await screen.findByTestId(`human-map-feature-${humanPoint.id}`),
  );

  const popup = screen.getByTestId("map-marker-popup");
  expect(within(popup).getByText("PUNTO PÚBLICO ANÓNIMO")).toBeTruthy();

  fireEvent.press(screen.getByTestId("map-marker-popup-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "human",
    feature: humanPoint,
  });
});

// CHG-166 — El popup de un Centro de Acopio Local muestra el promedio
// de estrellas de sus comentarios encima del resumen.
it("un acopio local con calificaciones muestra su promedio en el popup", async () => {
  const center = overview.items.find(
    (item) => item.category === "collection_center",
  )!;
  const ratedOverview = {
    ...overview,
    items: overview.items.map((item) =>
      item.id === center.id
        ? { ...item, commentRatingAverage: 4.2, commentRatingCount: 8 }
        : item,
    ),
  };
  renderPanel({
    dataSource: {
      transport: "fixture",
      initialOverview: ratedOverview,
      getOverview: async () => ratedOverview,
    },
  });

  fireEvent.press(await screen.findByTestId(`map-marker-${center.id}`));

  const popup = screen.getByTestId("map-marker-popup");
  expect(
    within(popup).getByText("★★★★☆ 4,2 · 8 calificaciones"),
  ).toBeTruthy();
});

it("un acopio sin calificaciones lo dice; otras categorías no llevan la línea", async () => {
  const center = overview.items.find(
    (item) => item.category === "collection_center",
  )!;
  renderPanel();

  fireEvent.press(await screen.findByTestId(`map-marker-${center.id}`));
  expect(screen.getByText("Sin calificaciones aún")).toBeTruthy();
  fireEvent.press(screen.getByTestId("map-marker-popup-close"));

  fireEvent.press(await screen.findByTestId(`map-marker-${firstPoint.id}`));
  expect(screen.queryByTestId("map-marker-popup-rating")).toBeNull();
});

it("un clúster humano abre popup con el desglose pero sin VER MÁS", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ onOpenPointDetail });

  fireEvent.press(await screen.findByTestId("human-map-feature-cl-1"));

  const popup = screen.getByTestId("map-marker-popup");
  expect(within(popup).getByText("12 personas")).toBeTruthy();
  expect(screen.queryByTestId("map-marker-popup-more")).toBeNull();
});

// CHG-168 — El acopio receptor comparte las reglas del local: su popup
// también muestra el promedio de estrellas.
it("un acopio receptor con calificaciones muestra su promedio en el popup", async () => {
  const ratedOverview = {
    ...overview,
    items: overview.items.map((item, index) =>
      index === 0
        ? {
            ...item,
            category: "receiver_center" as const,
            commentRatingAverage: 3.5,
            commentRatingCount: 2,
          }
        : item,
    ),
  };
  renderPanel({
    dataSource: {
      transport: "fixture",
      initialOverview: ratedOverview,
      getOverview: async () => ratedOverview,
    },
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-${overview.items[0].id}`),
  );

  const popup = screen.getByTestId("map-marker-popup");
  expect(
    within(popup).getByText("★★★★☆ 3,5 · 2 calificaciones"),
  ).toBeTruthy();
});

// CHG-171 — El viaje de La Mulera se fusiona como marcador con rastro;
// su popup resume estado, ruta y tiempos, y VER MÁS entrega el viaje.
const activeTransport = {
  id: "tt000000-0000-4000-8000-000000000001",
  kind: "mule" as const,
  status: "in_transit" as const,
  originName: "Acopio La Feria",
  originMunicipality: "Bucaramanga",
  originLatitude: 7.11,
  originLongitude: -73.12,
  destinationName: "Receptor Santander",
  destinationMunicipality: "El Playón",
  destinationLatitude: 7.47,
  destinationLongitude: -73.2,
  suppliesSummary: "Agua y mercados",
  tractorPlate: "ABC123",
  trailerPlate: "R99881",
  vesselRegistration: null,
  vesselName: null,
  vesselType: null,
  vehicleVisibleCharacteristics: "Tractocamión blanco, franja azul",
  departedAt: "2026-08-19T12:10:00Z",
  arrivedAt: null,
  lastLatitude: 7.2,
  lastLongitude: -73.15,
  lastPositionAt: "2026-08-19T13:00:00Z",
  createdAt: "2026-08-19T11:00:00Z",
  trail: [
    { latitude: 7.11, longitude: -73.12, recordedAt: "2026-08-19T12:10:00Z" },
    { latitude: 7.2, longitude: -73.15, recordedAt: "2026-08-19T13:00:00Z" },
  ],
};

it("un viaje en curso abre popup con estado y ruta, pinta su rastro y VER MÁS lo entrega", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ transports: [activeTransport], onOpenPointDetail });

  fireEvent.press(
    await screen.findByTestId(`map-marker-transport:${activeTransport.id}`),
  );

  const popup = screen.getByTestId("map-marker-popup");
  expect(
    within(popup).getByText(/TRANSPORTE DE INSUMOS · EN CAMINO/),
  ).toBeTruthy();
  expect(
    within(popup).getByText(/Acopio La Feria \(Bucaramanga\)/),
  ).toBeTruthy();
  expect(within(popup).getByText(/Salió:/)).toBeTruthy();
  // El rastro del GPS se dibuja como puntos no interactivos.
  expect(
    screen.getByTestId(`map-trail-trail:${activeTransport.id}:0`),
  ).toBeTruthy();

  fireEvent.press(screen.getByTestId("map-marker-popup-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "transport",
    transport: activeTransport,
  });
});
