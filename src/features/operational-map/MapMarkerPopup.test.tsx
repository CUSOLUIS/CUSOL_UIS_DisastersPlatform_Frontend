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

// CHG-176 — La oferta de comida se califica como un centro de acopio,
// así que su tarjeta del mapa muestra la puntuación.
it("el popup de una oferta calificada muestra su línea de estrellas", async () => {
  renderPanel({
    foodOffers: [
      { ...offer, commentRatingAverage: 4.5, commentRatingCount: 8 },
    ],
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-food_offer:${offer.id}`),
  );

  expect(screen.getByTestId("map-marker-popup-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
});

it("una oferta sin calificar lo dice, en vez de callar", async () => {
  renderPanel({ foodOffers: [offer] });

  fireEvent.press(
    await screen.findByTestId(`map-marker-food_offer:${offer.id}`),
  );

  expect(screen.getByTestId("map-marker-popup-rating")).toHaveTextContent(
    /Sin calificaciones/,
  );
});

// CHG-177 — Tocar la oferta ya no abre además una banda bajo el
// dashboard: todo se explica en el popup.
it("tocar una oferta no inserta la banda inferior del dashboard", async () => {
  renderPanel({ foodOffers: [offer] });

  fireEvent.press(
    await screen.findByTestId(`map-marker-food_offer:${offer.id}`),
  );

  expect(screen.getByTestId("map-marker-popup")).toBeTruthy();
  expect(screen.queryByTestId("food-offer-map-detail")).toBeNull();
});

// CHG-180 — La solicitud de «Necesitamos ayuda» se califica como un
// centro de acopio, así que su tarjeta del mapa muestra la puntuación
// por los dos caminos: el popup genérico y la ventana de acción.
it("el popup de una solicitud calificada muestra su línea de estrellas", async () => {
  renderPanel({
    helpRequests: [
      { ...request, commentRatingAverage: 4.5, commentRatingCount: 8 },
    ],
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.getByTestId("map-marker-popup-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
});

it("una solicitud sin calificar lo dice, en vez de callar", async () => {
  renderPanel({ helpRequests: [request] });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.getByTestId("map-marker-popup-rating")).toHaveTextContent(
    /Sin calificaciones/,
  );
});

it("la ventana de acción de la solicitud también muestra la puntuación", async () => {
  renderPanel({
    helpRequests: [
      { ...request, commentRatingAverage: 3.5, commentRatingCount: 2 },
    ],
    helpRequestActions: { isAuthenticated: false, attend: jest.fn() },
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.getByTestId("action-sheet-rating")).toHaveTextContent(
    /3,5 · 2 calificaciones/,
  );
});

// CHG-181 la añadió, CHG-199 le quitó las estrellas y CHG-200 la retiró
// entera: tocar el marcador ya no dibuja nada bajo el mapa, porque la
// ventana de acción dice lo mismo donde el usuario acaba de tocar.
it("tocar la solicitud no dibuja ninguna banda bajo el mapa", async () => {
  const onOpenPointDetail = jest.fn();
  const calificada = {
    ...request,
    commentRatingAverage: 4.5,
    commentRatingCount: 8,
  };
  renderPanel({
    helpRequests: [calificada],
    helpRequestActions: { isAuthenticated: false, attend: jest.fn() },
    onOpenPointDetail,
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.queryByTestId("help-request-map-detail")).toBeNull();

  // Lo que el usuario ve es la ventana, con su información y su paso a
  // la ficha: no se perdió nada por el camino.
  expect(screen.getByTestId("help-request-action-sheet")).toBeTruthy();
  expect(screen.getByTestId("action-sheet-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
  fireEvent.press(screen.getByTestId("action-sheet-view-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "help_request",
    request: calificada,
  });
});

// CHG-194 — Quien creó la solicitud no ve «VER MÁS» en ninguna de las
// superficies que abre un click en el mapa: ni la banda de detalle ni el
// popup genérico. La ficha pública es para los demás.
it("la solicitud propia no ofrece la ficha pública ni atenderla", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({
    helpRequests: [{ ...request, createdByMe: true }],
    helpRequestActions: { isAuthenticated: true, attend: jest.fn() },
    onOpenPointDetail,
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  // CHG-200: ya no hay banda que comprobar; la ventana es la superficie.
  expect(screen.queryByTestId("help-request-map-detail")).toBeNull();
  expect(screen.getByTestId("help-request-action-sheet")).toBeTruthy();
  expect(screen.queryByTestId("action-sheet-view-more")).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: "Atender esta solicitud y compartir mi nombre",
    }),
  ).toBeNull();
  expect(onOpenPointDetail).not.toHaveBeenCalled();
});

it("el popup genérico de la solicitud propia tampoco ofrece VER MÁS", async () => {
  renderPanel({
    helpRequests: [{ ...request, createdByMe: true }],
    onOpenPointDetail: jest.fn(),
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.getByTestId("map-marker-popup")).toBeTruthy();
  expect(screen.queryByTestId("map-marker-popup-more")).toBeNull();
});

// CHG-195 — El VER MÁS de la dueña cambia de destino, no desaparece:
// en el mapa la lleva a quiénes la atienden, igual que la píldora de
// «Mi espacio».
it("el VER MÁS de la dueña lleva a quiénes atienden", async () => {
  const onOpenAttenders = jest.fn();
  const onOpenPointDetail = jest.fn();
  const propia = { ...request, createdByMe: true };
  renderPanel({
    helpRequests: [propia],
    helpRequestActions: {
      isAuthenticated: true,
      attend: jest.fn(),
      onOpenAttenders,
    },
    onOpenPointDetail,
  });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  // La ventana de acción ofrece su VER MÁS propio.
  fireEvent.press(screen.getByTestId("action-sheet-view-attenders"));
  expect(onOpenAttenders).toHaveBeenCalledWith(propia);

  // Nunca la ficha pública, y CHG-200: sin banda bajo el mapa.
  expect(onOpenAttenders).toHaveBeenCalledTimes(1);
  expect(onOpenPointDetail).not.toHaveBeenCalled();
  expect(screen.queryByTestId("help-request-map-detail")).toBeNull();
});

// CHG-200 — Sin acciones cableadas el click abre el popup del marcador,
// que sí conserva su puntuación: lo que se retiró fue la banda, no la
// calificación de todas las superficies.
it("sin acciones, el click abre el popup completo y ninguna banda", async () => {
  renderPanel({ helpRequests: [request], onOpenPointDetail: jest.fn() });

  fireEvent.press(
    await screen.findByTestId(`map-marker-help_request:${request.id}`),
  );

  expect(screen.queryByTestId("help-request-map-detail")).toBeNull();
  expect(screen.getByTestId("map-marker-popup")).toBeTruthy();
  expect(screen.getByTestId("map-marker-popup-rating")).toHaveTextContent(
    /Sin calificaciones/,
  );
  expect(screen.getByTestId("map-marker-popup-more")).toBeTruthy();
});

// CHG-182 — La casita destruida se toca en el mapa como cualquier otro
// punto: leyenda resumen con su puntuación y VER MÁS hacia la ficha.
const damagedHome = {
  id: "9a1b7c33-3333-4e5f-8a6b-000000000182",
  publicCode: "CASA-2026-ABCD1234",
  description: "El río se llevó la cocina y una habitación.",
  department: "Chocó",
  municipality: "Quibdó",
  address: "Barrio Niño Jesús, calle 3",
  latitude: 5.6919,
  longitude: -76.6583,
  householdSize: 5,
  donationChannel: "Nequi" as const,
  donationReference: "3001234567",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T10:00:00Z",
  photoUrls: [],
  commentRatingAverage: 4.5,
  commentRatingCount: 8,
};

it("el popup de una casita muestra estrellas, personas y VER MÁS", async () => {
  const onOpenPointDetail = jest.fn();
  renderPanel({ damagedHomes: [damagedHome], onOpenPointDetail });

  fireEvent.press(
    await screen.findByTestId(`map-marker-damaged_home:${damagedHome.id}`),
  );

  expect(screen.getByTestId("map-marker-popup-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
  expect(screen.getByText(/5 personas viven aquí/)).toBeTruthy();

  fireEvent.press(screen.getByTestId("map-marker-popup-more"));
  expect(onOpenPointDetail).toHaveBeenCalledWith({
    kind: "damaged_home",
    home: damagedHome,
  });
});

