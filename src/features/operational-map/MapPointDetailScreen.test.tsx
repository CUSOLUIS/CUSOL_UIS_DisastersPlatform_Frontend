import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
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

// CHG-170 — ELIMINAR el acopio desde su ficha: visible solo para el
// super_admin, en dos pasos, para ambos tipos de acopio.
import type { AidLocationCommunityDataSource } from "../aid-locations/communityDataSource";

function fakeCommunitySource(): AidLocationCommunityDataSource {
  return {
    transport: "demo",
    listComments: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      ratingAverage: null,
      ratingCount: 0,
    }),
    createComment: jest.fn(),
    reportCenter: jest.fn(),
    adminDeleteComment: jest.fn().mockResolvedValue(undefined),
    adminDeleteAidLocation: jest.fn().mockResolvedValue(undefined),
  };
}

function adminSessionSource() {
  return {
    getCurrentAccount: jest.fn().mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      displayName: "Admin CUSOL",
      email: "admin@cusol.local",
      assignedRole: "super_admin",
      status: "active",
      sessionExpiresAt: "2099-01-01T00:00:00Z",
    }),
  };
}

it.each(["collection_center", "receiver_center"] as const)(
  "el super_admin elimina un %s en dos pasos y vuelve al mapa",
  async (category) => {
    const onBack = jest.fn();
    const dataSource = fakeCommunitySource();
    render(
      <MapPointDetailScreen
        payload={{ kind: "operational", point: { ...point, category } }}
        onBack={onBack}
        communityDataSource={dataSource}
        sessionSource={adminSessionSource()}
      />,
    );
    const button = await screen.findByTestId("map-point-delete-center");

    // Primer toque: arma la confirmación sin llamar a la API.
    fireEvent.press(button);
    expect(screen.getByText("¿CONFIRMAR ELIMINACIÓN?")).toBeTruthy();
    expect(dataSource.adminDeleteAidLocation).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("map-point-delete-center"));
    await waitFor(() =>
      expect(dataSource.adminDeleteAidLocation).toHaveBeenCalledWith(
        point.id,
      ),
    );
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  },
);

it("sin sesión de super_admin la ficha no ofrece ELIMINAR", async () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        point: { ...point, category: "collection_center" },
      }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );
  await screen.findByTestId("center-comments-average");

  expect(screen.queryByTestId("map-point-delete-block")).toBeNull();
});

it("si el backend rechaza la eliminación, la ficha muestra el motivo y no navega", async () => {
  const onBack = jest.fn();
  const dataSource = fakeCommunitySource();
  (dataSource.adminDeleteAidLocation as jest.Mock).mockRejectedValue(
    new Error(
      "El acopio tiene transportes humanitarios registrados y no puede eliminarse mientras existan.",
    ),
  );
  render(
    <MapPointDetailScreen
      payload={{
        kind: "operational",
        point: { ...point, category: "receiver_center" },
      }}
      onBack={onBack}
      communityDataSource={dataSource}
      sessionSource={adminSessionSource()}
    />,
  );
  const button = await screen.findByTestId("map-point-delete-center");

  fireEvent.press(button);
  fireEvent.press(screen.getByTestId("map-point-delete-center"));

  await waitFor(() =>
    expect(
      screen.getByText(/transportes humanitarios registrados/i),
    ).toBeTruthy(),
  );
  expect(onBack).not.toHaveBeenCalled();
});

// CHG-171 — La ficha del viaje muestra la ruta, los tiempos y la
// identificación visible del vehículo; jamás datos del conductor.
it("la ficha de un viaje muestra ruta, placas y estado sin datos del conductor", () => {
  render(
    <MapPointDetailScreen
      payload={{
        kind: "transport",
        transport: {
          id: "tt000000-0000-4000-8000-000000000001",
          kind: "mule",
          status: "in_transit",
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
          vehicleVisibleCharacteristics:
            "Tractocamión blanco, franja azul",
          departedAt: "2026-08-19T12:10:00Z",
          arrivedAt: null,
          lastLatitude: 7.2,
          lastLongitude: -73.15,
          lastPositionAt: "2026-08-19T13:00:00Z",
          createdAt: "2026-08-19T11:00:00Z",
          trail: [],
        },
      }}
      onBack={jest.fn()}
    />,
  );

  expect(screen.getByText("TRANSPORTE DE INSUMOS EN RUTA")).toBeTruthy();
  expect(screen.getByText("La mulera en ruta")).toBeTruthy();
  expect(screen.getByText("EN CAMINO")).toBeTruthy();
  expect(screen.getByText(/Acopio La Feria/)).toBeTruthy();
  expect(screen.getByText("ABC123")).toBeTruthy();
  expect(screen.getByText("R99881")).toBeTruthy();
  expect(screen.getByText(/Insumos que lleva: Agua y mercados/)).toBeTruthy();
  // §30: nada del conductor en la vista pública.
  expect(screen.queryByText(/conductor/i)).toBeNull();
});

// CHG-176 — La ficha de una oferta de comida gana lo mismo que la de un
// acopio: estrellas, panel comunitario y ELIMINAR para el super_admin.
const foodOffer = {
  id: "f1000000-0000-4000-8000-000000000176",
  description: "Olla comunitaria de almuerzo para 80 personas.",
  address: "Cancha del barrio La Feria",
  latitude: 7.11,
  longitude: -73.13,
  notificationRadiusKm: 3,
  createdAt: "2026-08-19T00:00:00Z",
  expiresAt: "2099-08-19T18:00:00Z",
  commentRatingAverage: 4.5,
  commentRatingCount: 8,
};

it("la ficha de una oferta de comida muestra su puntuación y su comunidad", async () => {
  render(
    <MapPointDetailScreen
      payload={{ kind: "food_offer", offer: foodOffer }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );

  expect(await screen.findByTestId("map-point-detail-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
  // Mismo panel que los acopios: comentar, denunciar y la lista.
  expect(
    await screen.findByTestId("collection-center-community-panel"),
  ).toBeTruthy();
  expect(screen.getByTestId("center-comment-button")).toBeTruthy();
  expect(screen.getByTestId("center-report-button")).toBeTruthy();
});

it("el super_admin elimina una oferta de comida en dos pasos", async () => {
  const onBack = jest.fn();
  const dataSource = fakeCommunitySource();
  render(
    <MapPointDetailScreen
      payload={{ kind: "food_offer", offer: foodOffer }}
      onBack={onBack}
      communityDataSource={dataSource}
      sessionSource={adminSessionSource()}
    />,
  );
  const button = await screen.findByTestId("map-point-delete-center");

  fireEvent.press(button);
  expect(dataSource.adminDeleteAidLocation).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("map-point-delete-center"));
  await waitFor(() =>
    // El borrado apunta a la oferta, no a un acopio.
    expect(dataSource.adminDeleteAidLocation).toHaveBeenCalledWith(
      foodOffer.id,
    ),
  );
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
});

it("sin super_admin la oferta no ofrece ELIMINAR", async () => {
  render(
    <MapPointDetailScreen
      payload={{ kind: "food_offer", offer: foodOffer }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );
  await screen.findByTestId("center-comments-average");

  expect(screen.queryByTestId("map-point-delete-block")).toBeNull();
});

// CHG-180 — La ficha de «Necesitamos ayuda» gana lo mismo que la de un
// acopio: estrellas, panel comunitario y ELIMINAR para el super_admin.
const helpRequestWithCommunity = {
  id: "77777777-7777-4777-8777-777777777180",
  description: "Necesitamos agua potable y cobijas para tres familias.",
  address: "Vereda El Salado, Piedecuesta",
  latitude: 6.98,
  longitude: -73.05,
  notificationRadiusKm: 10,
  createdAt: "2026-08-19T00:00:00Z",
  expiresAt: "2099-08-19T18:00:00Z",
  attendersCount: 2,
  attendedByMe: false,
  photoUrl: null,
  commentRatingAverage: 4.5,
  commentRatingCount: 8,
};

it("la ficha de una solicitud muestra su puntuación y su comunidad", async () => {
  render(
    <MapPointDetailScreen
      payload={{ kind: "help_request", request: helpRequestWithCommunity }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );

  expect(await screen.findByTestId("map-point-detail-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
  // Mismo panel que los acopios: comentar, denunciar y la lista.
  expect(
    await screen.findByTestId("collection-center-community-panel"),
  ).toBeTruthy();
  expect(screen.getByTestId("center-comment-button")).toBeTruthy();
  expect(screen.getByTestId("center-report-button")).toBeTruthy();
});

it("el super_admin elimina una solicitud en dos pasos", async () => {
  const onBack = jest.fn();
  const dataSource = fakeCommunitySource();
  render(
    <MapPointDetailScreen
      payload={{ kind: "help_request", request: helpRequestWithCommunity }}
      onBack={onBack}
      communityDataSource={dataSource}
      sessionSource={adminSessionSource()}
    />,
  );
  const button = await screen.findByTestId("map-point-delete-center");

  fireEvent.press(button);
  expect(dataSource.adminDeleteAidLocation).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("map-point-delete-center"));
  await waitFor(() =>
    // El borrado apunta a la solicitud, no a un acopio.
    expect(dataSource.adminDeleteAidLocation).toHaveBeenCalledWith(
      helpRequestWithCommunity.id,
    ),
  );
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
});

// CHG-182 — La ficha de la casita: personas, medio de ayuda con su
// advertencia, fotos y el panel comunitario completo.
const damagedHomeDetail = {
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
  // Absoluta a propósito: en pruebas no hay base de API configurada y
  // `resolvePublicMediaUrl` devolvería null con una ruta relativa.
  photoUrls: ["https://cusol.local/api/v1/public/damaged-homes/9a1b7c33/photos/1"],
  commentRatingAverage: 4.5,
  commentRatingCount: 8,
};

it("la ficha de la casita muestra personas, ayuda directa y comunidad", async () => {
  render(
    <MapPointDetailScreen
      payload={{ kind: "damaged_home", home: damagedHomeDetail }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );

  expect(await screen.findByTestId("map-point-detail-rating")).toHaveTextContent(
    /4,5 · 8 calificaciones/,
  );
  expect(screen.getByText("PERSONAS QUE VIVEN AQUÍ")).toBeTruthy();
  expect(screen.getByText("AYUDA DIRECTA · NEQUI")).toBeTruthy();
  expect(screen.getByText("3001234567")).toBeTruthy();
  // El medio de ayuda nunca aparece sin su advertencia.
  expect(
    screen.getByText(/no verifica este dato ni intermedia/i),
  ).toBeTruthy();
  expect(screen.getByTestId("map-point-detail-photo-0")).toBeTruthy();
  expect(
    await screen.findByTestId("collection-center-community-panel"),
  ).toBeTruthy();
  expect(screen.getByTestId("center-comment-button")).toBeTruthy();
  expect(screen.getByTestId("center-report-button")).toBeTruthy();
});

it("el super_admin elimina una casita en dos pasos", async () => {
  const onBack = jest.fn();
  const dataSource = fakeCommunitySource();
  render(
    <MapPointDetailScreen
      payload={{ kind: "damaged_home", home: damagedHomeDetail }}
      onBack={onBack}
      communityDataSource={dataSource}
      sessionSource={adminSessionSource()}
    />,
  );
  fireEvent.press(await screen.findByTestId("map-point-delete-center"));
  expect(dataSource.adminDeleteAidLocation).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("map-point-delete-center"));
  await waitFor(() =>
    expect(dataSource.adminDeleteAidLocation).toHaveBeenCalledWith(
      damagedHomeDetail.id,
    ),
  );
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
});



// CHG-201 — El vídeo de TikTok de la casita: lo ve cualquiera que abra
// la ficha, y se abre en TikTok (DEC-201-02).
it("la ficha ofrece el vídeo del daño y lo abre en TikTok", async () => {
  const openURL = jest
    .spyOn(Linking, "openURL")
    .mockResolvedValue(undefined as never);
  const enlace = "https://www.tiktok.com/@familia/video/7412345678901234567";

  render(
    <MapPointDetailScreen
      payload={{
        kind: "damaged_home",
        home: { ...damagedHomeDetail, videoUrl: enlace },
      }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );

  const boton = await screen.findByTestId("map-point-detail-video");
  expect(boton).toHaveTextContent(/VER EL VÍDEO EN TIKTOK/);
  fireEvent.press(boton);
  expect(openURL).toHaveBeenCalledWith(enlace);
  openURL.mockRestore();
});

it("una casita sin vídeo no dice nada al respecto", async () => {
  render(
    <MapPointDetailScreen
      payload={{ kind: "damaged_home", home: damagedHomeDetail }}
      onBack={jest.fn()}
      communityDataSource={fakeCommunitySource()}
    />,
  );

  await screen.findByTestId("map-point-detail-photo-0");
  expect(screen.queryByTestId("map-point-detail-video")).toBeNull();
});
