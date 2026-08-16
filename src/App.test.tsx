import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { App } from "./App";
import {
  CUSOL_INSTAGRAM_URL,
  getDashboardEntryMinHeight,
  getBrandLinkScale,
  getLiveRecordsMinHeight,
  getSectionScrollDestination,
  PROMETEO_INSTAGRAM_URL,
  shouldCenterEntryContent,
  shouldStackPriorityLayout,
} from "./features/human-impact/HumanImpactDashboard";
import { humanImpactDemoData } from "./features/human-impact/demoData";
import {
  getReportActionColumns,
  shouldStackReportActions,
} from "./features/missing-persons/MissingPersonCommandCenter";
import { getPeopleRecordDemoPage } from "./features/human-impact/peopleRecordsDataSource";
import type {
  HumanImpactDataSource,
  PeopleRecordsDataSource,
} from "./features/human-impact/types";
import { filterPublicRecords } from "./features/missing-persons/dataSource";
import { missingPersonDemoData } from "./features/missing-persons/demoData";
import {
  normalizeOperationalMapOverview,
  validatePublicOverview,
} from "./features/operational-map/dataSource";
import { operationalMapDemoData } from "./features/operational-map/demoData";
import { getHumanMapDemoOverview } from "./features/operational-map/humanMapDemoData";
import { minLegibleFontSize } from "./typography";
import type {
  HumanMapDataSource,
  HumanMapQuery,
  OperationalMapDataSource,
} from "./features/operational-map/types";

const demoDataSource: HumanImpactDataSource = {
  transport: "fixture",
  dataKind: "demonstrative",
  getOverview: async () => humanImpactDemoData,
};

const demoMapDataSource: OperationalMapDataSource = {
  transport: "fixture",
  initialOverview: operationalMapDemoData,
  getOverview: async () => operationalMapDemoData,
};

const demoHumanMapDataSource: HumanMapDataSource = {
  transport: "fixture",
  initialOverview: getHumanMapDemoOverview({
    bounds: { west: -82, south: -4.5, east: -66.5, north: 13.5 },
    zoom: 5,
    statuses: [
      "missing",
      "reported_deceased",
      "confirmed_alive",
      "confirmed_deceased",
    ],
  }),
  getOverview: async (query) => getHumanMapDemoOverview(query),
};

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("App universal", () => {
  it("muestra el logotipo de CUSOL UIS sin un fondo adicional (CHG-014)", async () => {
    render(<App dataSource={demoDataSource} />);

    const logo = await screen.findByTestId("cusol-brand-logo", {
      includeHiddenElements: true,
    });
    const logoStyle = StyleSheet.flatten(logo.props.style);

    expect(logo.props.resizeMode).toBe("contain");
    expect(logo.props.source).toBeTruthy();
    expect([60, 68]).toContain(logoStyle.width);
    expect(logoStyle.height).toBe(logoStyle.width);
    expect(logoStyle.backgroundColor).toBeUndefined();
    expect(logoStyle.borderWidth).toBeUndefined();
  });

  it("presenta la identidad conjunta CUSOL y Prometeo sin recortar la marca", async () => {
    render(<App dataSource={demoDataSource} />);

    const lockup = await screen.findByTestId("brand-lockup");
    const logoFrame = screen.getByTestId("brand-logo-frame");
    const prometeoCircle = screen.getByTestId("prometeo-brand-circle");
    const prometeoLogo = screen.getByTestId("prometeo-brand-logo", {
      includeHiddenElements: true,
    });
    const circleStyle = StyleSheet.flatten(prometeoCircle.props.style);
    const logoStyle = StyleSheet.flatten(prometeoLogo.props.style);

    expect(lockup.props.accessibilityLabel).toBeUndefined();
    const frameStyle = StyleSheet.flatten(logoFrame.props.style);
    expect(frameStyle.borderRadius).toBeGreaterThan(0);
    expect(frameStyle.borderWidth).toBe(1);
    expect(frameStyle.backgroundColor).toBe("rgba(8, 13, 22, 0.72)");
    expect(screen.queryByTestId("brand-partnership-connector")).toBeNull();
    expect(screen.queryByTestId("brand-title-rail")).toBeNull();
    expect(circleStyle.backgroundColor).toBe("#ffffff");
    expect(circleStyle.borderRadius).toBeGreaterThanOrEqual(circleStyle.width / 2);
    expect(prometeoLogo.props.resizeMode).toBe("contain");
    expect(prometeoLogo.props.source).toBeTruthy();
    expect(logoStyle.width).toBe("100%");
    // CHG-123: el nombre visible es "Cusol Disaster App".
    const toolTitle = within(lockup).getByText("CUSOL DISASTER APP");
    // CHG-118: la leyenda acompaña al título dentro del bloque de
    // marca, legible (no por debajo del piso de la portada).
    const motto = within(lockup).getByText("SOLO EL PUEBLO SALVA AL PUEBLO");
    expect(StyleSheet.flatten(motto.props.style).fontSize).toBeGreaterThanOrEqual(
      minLegibleFontSize,
    );
    expect(StyleSheet.flatten(toolTitle.props.style).marginTop).toBeGreaterThan(0);
    expect(screen.queryByText("DISASTER INTELLIGENCE SYSTEM")).toBeNull();
  });

  it("los accesos de sesión no se recortan en pantallas compactas (CHG-122)", async () => {
    render(<App dataSource={demoDataSource} />);

    // jest-expo renderiza a 750 px de ancho, es decir en modo compacto.
    const primaryRow = await screen.findByTestId("header-primary-row");
    const authActions = screen.getByTestId("header-auth-actions");
    const rowStyle = StyleSheet.flatten(primaryRow.props.style);
    const actionsStyle = StyleSheet.flatten(authActions.props.style);

    // La fila envuelve y el bloque de accesos puede ocupar la fila
    // envuelta entera manteniendo la alineación a la derecha, así que
    // los botones bajan completos en vez de salirse del viewport.
    expect(rowStyle.flexWrap).toBe("wrap");
    expect(actionsStyle.flexGrow).toBe(1);
    expect(actionsStyle.justifyContent).toBe("flex-end");
    expect(
      within(authActions).getByRole("button", { name: "Iniciar sesión" }),
    ).toBeTruthy();
    expect(
      within(authActions).getByRole("button", { name: "Registrarse" }),
    ).toBeTruthy();
  });

  it("abre los Instagram de CUSOL y Prometeo con la misma interacción", async () => {
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<App dataSource={demoDataSource} />);

    const cusolLink = await screen.findByRole("link", {
      name: "CUSOL UIS en Instagram",
    });
    const prometeoLink = screen.getByRole("link", {
      name: "Prometeo UIS en Instagram",
    });

    expect(cusolLink.props.accessibilityHint).toMatch(/aplicación externa/i);
    expect(prometeoLink.props.accessibilityHint).toMatch(/aplicación externa/i);
    expect(screen.getByTestId("cusol-brand-link-motion")).toBeTruthy();
    expect(screen.getByTestId("prometeo-brand-link-motion")).toBeTruthy();
    expect(
      getBrandLinkScale({
        focused: false,
        hovered: true,
        pressed: false,
        reducedMotion: false,
      }),
    ).toBe(1.07);
    expect(
      getBrandLinkScale({
        focused: true,
        hovered: false,
        pressed: false,
        reducedMotion: false,
      }),
    ).toBe(1.07);
    expect(
      getBrandLinkScale({
        focused: false,
        hovered: true,
        pressed: false,
        reducedMotion: true,
      }),
    ).toBe(1);

    fireEvent(cusolLink, "hoverIn");
    fireEvent(cusolLink, "hoverOut");
    fireEvent(prometeoLink, "focus");
    fireEvent(prometeoLink, "blur");
    fireEvent.press(cusolLink);
    fireEvent.press(prometeoLink);

    expect(openUrl).toHaveBeenNthCalledWith(1, CUSOL_INSTAGRAM_URL);
    expect(openUrl).toHaveBeenNthCalledWith(2, PROMETEO_INSTAGRAM_URL);
  });

  it("reemplaza la telemetría del encabezado por acceso y registro", async () => {
    const onLogin = jest.fn();
    const onRegister = jest.fn();
    render(
      <App
        dataSource={demoDataSource}
        onLogin={onLogin}
        onRegister={onRegister}
      />,
    );

    const loginButton = await screen.findByRole("button", {
      name: "Iniciar sesión",
    });
    const registerButton = screen.getByRole("button", { name: "Registrarse" });

    expect(screen.queryByText("API CONECTADA · DATOS DEMO")).toBeNull();
    expect(screen.queryByText(/^Corte:/)).toBeNull();
    fireEvent.press(loginButton);
    fireEvent.press(registerButton);
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("navega al mapa, identidad, cifras y transmisión desde el encabezado", async () => {
    const onAbout = jest.fn();
    render(<App dataSource={demoDataSource} onAbout={onAbout} />);

    // CHG-090: en pantallas angostas la navegación vive en el menú
    // hamburguesa; se abre antes de usar los enlaces.
    fireEvent.press(
      await screen.findByRole("button", { name: "Abrir menú de navegación" }),
    );
    const mapLink = await screen.findByRole("link", { name: "ver mapa" });
    expect(screen.getByRole("link", { name: "inicio" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "quiénes somos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "cifras y datos" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "transmisión en vivo" }),
    ).toBeTruthy();
    const mapLinkStyle = StyleSheet.flatten(mapLink.props.style);
    const mapLinkTextStyle = StyleSheet.flatten(
      within(mapLink).getByText("VER MAPA").props.style,
    );

    expect(screen.queryByText("SYS.01")).toBeNull();
    expect(screen.queryByText("HUMAN IMPACT")).toBeNull();
    expect(mapLinkStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(mapLinkStyle.paddingHorizontal).toBeGreaterThanOrEqual(13);
    expect(mapLinkTextStyle.fontSize).toBeGreaterThanOrEqual(10);
    expect(screen.getByTestId("dashboard-operational-map")).toBeTruthy();
    const dataSection = screen.getByTestId("dashboard-data-and-figures");
    expect(within(dataSection).getByTestId("human-impact-summary")).toBeTruthy();
    expect(
      within(dataSection).getByTestId("human-impact-distribution-panel"),
    ).toBeTruthy();
    expect(screen.queryByTestId("dashboard-data-module-body")).toBeNull();
    expect(within(dataSection).queryByText("DATOS DEMOSTRATIVOS")).toBeNull();
    expect(within(dataSection).getByText("ESCENARIO DE PRUEBA")).toBeTruthy();
    expect(screen.getByTestId("dashboard-live-transmission")).toBeTruthy();

    // CHG-090: cada navegación cierra el menú; se reabre entre usos.
    const openMenu = () =>
      fireEvent.press(
        screen.getByRole("button", { name: "Abrir menú de navegación" }),
      );
    fireEvent.press(mapLink);
    openMenu();
    fireEvent.press(screen.getByRole("link", { name: "cifras y datos" }));
    openMenu();
    fireEvent.press(
      screen.getByRole("link", { name: "transmisión en vivo" }),
    );
    openMenu();
    fireEvent.press(screen.getByRole("link", { name: "quiénes somos" }));

    expect(onAbout).toHaveBeenCalledTimes(1);
  });

  it("prioriza situación, muestra la búsqueda y debajo las seis acciones", async () => {
    const onReportPerson = jest.fn();
    const onReportBuilding = jest.fn();
    const onRegisterCenter = jest.fn();
    const onRegisterPoint = jest.fn();
    const onOfferMeals = jest.fn();
    const onOfferShelter = jest.fn();
    render(
      <App
        dataSource={demoDataSource}
        onReportMissingPerson={onReportPerson}
        onReportUnverifiedBuilding={onReportBuilding}
        onRegisterCollectionCenter={onRegisterCenter}
        onRegisterDonationPoint={onRegisterPoint}
        onOfferCommunityMeals={onOfferMeals}
        onOfferTemporaryShelter={onOfferShelter}
      />,
    );

    const priorityLayout = await screen.findByTestId("dashboard-priority-layout");
    const missionIntro = screen.getByTestId("situation-human-priority");
    const priorityOrder = priorityLayout.children.flatMap((child) =>
      typeof child === "string" ? [] : [child.props.testID],
    );
    expect(priorityOrder).toEqual([
      "situation-human-priority",
      "person-search-priority",
    ]);
    expect(within(missionIntro).getByText("Misión")).toBeTruthy();
    expect(within(missionIntro).getByText("Humanitaria")).toBeTruthy();
    expect(
      within(missionIntro).getByText("CENTRO DIGITAL DE AYUDA Y MONITOREO"),
    ).toBeTruthy();
    expect(within(missionIntro).queryByText("CENTRO NACIONAL DE MONITOREO")).toBeNull();
    expect(
      within(missionIntro).getByText(
        /unimos datos verificables y reportes ciudadanos para localizar personas, coordinar ayudas y monitorear la respuesta humanitaria/i,
      ),
    ).toBeTruthy();
    expect(
      within(missionIntro).queryByText(/un panorama consolidado/i),
    ).toBeNull();
    expect(within(missionIntro).queryByText("Situación")).toBeNull();
    expect(within(missionIntro).queryByText("humana")).toBeNull();

    const mainContent = screen.getByTestId("dashboard-main-content");
    const mainOrder = mainContent.children.flatMap((child) =>
      typeof child === "string" ? [] : [child.props.testID],
    );
    expect(mainOrder.slice(0, 2)).toEqual([
      "dashboard-entry-hero",
      "dashboard-operational-map",
    ]);

    const entryHero = screen.getByTestId("dashboard-entry-hero");
    const entryOrder = entryHero.children.flatMap((child) =>
      typeof child === "string" ? [] : [child.props.testID],
    );
    expect(entryOrder[0]).toBe("dashboard-priority-layout");
    expect(screen.getByTestId("dashboard-scroll-cue")).toBeTruthy();

    expect(shouldStackPriorityLayout(1380)).toBe(false);
    expect(shouldStackPriorityLayout(1079)).toBe(true);
    expect(shouldCenterEntryContent(1380)).toBe(true);
    expect(shouldCenterEntryContent(1079)).toBe(false);
    // CHG-118: el encabezado creció 17 px con la leyenda, así que la
    // portada de entrada reserva esos 17 px menos de pantalla.
    expect(getDashboardEntryMinHeight(900, false)).toBe(759);
    expect(getDashboardEntryMinHeight(900, false, true)).toBe(717);
    expect(getDashboardEntryMinHeight(900, true)).toBe(723);
    expect(getLiveRecordsMinHeight(900, 124)).toBe(720);
    expect(getLiveRecordsMinHeight(100, 160)).toBe(0);
    expect(
      getSectionScrollDestination({
        currentScroll: 1600,
        headerHeight: 124,
        pageY: 500,
        spacingBelowHeader: 0,
      }),
    ).toBe(1976);
    expect(
      getSectionScrollDestination({
        currentScroll: 0,
        headerHeight: 160,
        pageY: 80,
        spacingBelowHeader: 16,
      }),
    ).toBe(0);
    expect(shouldStackReportActions(620)).toBe(false);
    expect(shouldStackReportActions(619)).toBe(true);
    // CHG-090 (QA): máximo 3 columnas — grid 3x2 en escritorio.
    expect(getReportActionColumns(1380)).toBe(3);
    expect(getReportActionColumns(1280)).toBe(3);
    expect(getReportActionColumns(1279)).toBe(3);
    expect(getReportActionColumns(1080)).toBe(3);
    expect(getReportActionColumns(1079)).toBe(2);
    expect(getReportActionColumns(900)).toBe(2);
    expect(getReportActionColumns(619)).toBe(1);

    const reportActions = screen.getByTestId("report-actions");
    expect(screen.getByTestId("person-search-panel")).toBeTruthy();
    expect(within(priorityLayout).queryByTestId("report-actions")).toBeNull();
    const reportOrder = reportActions.children.flatMap((child) =>
      typeof child === "string" ? [] : [child.props.testID],
    );
    expect(reportOrder).toEqual([
      "report-missing-person-action",
      "report-unverified-building-action",
      "register-collection-center-action",
      "register-donation-point-action",
      "offer-community-meals-action",
      "offer-temporary-shelter-action",
    ]);

    const reportButton = await screen.findByRole("button", {
      name: "Reportar persona perdida",
    });
    const buildingButton = screen.getByRole("button", {
      name: "Reportar edificio sin verificar",
    });
    const centerButton = screen.getByRole("button", {
      name: "Inscribir centro de acopio",
    });
    const donationPointButton = screen.getByRole("button", {
      name: "Registrar punto de recolección",
    });
    const communityMealsButton = screen.getByRole("button", {
      name: "Ofrecer comida comunitaria",
    });
    const temporaryShelterButton = screen.getByRole("button", {
      name: "Ofrecer alojamiento temporal",
    });
    const actionTestIds = [
      "report-missing-person-action",
      "report-unverified-building-action",
      "register-collection-center-action",
      "register-donation-point-action",
      "offer-community-meals-action",
      "offer-temporary-shelter-action",
    ];
    const reportSurfaceStyles = actionTestIds.map((testID) =>
      StyleSheet.flatten(screen.getByTestId(`${testID}-surface`).props.style),
    );
    const reportSurfaceStyle = reportSurfaceStyles[0];
    expect(reportSurfaceStyle.minHeight).toBeGreaterThanOrEqual(160);
    expect(reportSurfaceStyle.minHeight).toBeLessThan(196);
    expect(reportSurfaceStyles.map(({ backgroundColor }) => backgroundColor)).toEqual([
      "#e3e9e8",
      "#e3e9e8",
      "#e3e9e8",
      "#e3e9e8",
      "#e3e9e8",
      "#e3e9e8",
    ]);
    actionTestIds.forEach((testID) => {
      const railStyle = StyleSheet.flatten(
        screen.getByTestId(`${testID}-rail`).props.style,
      );
      expect(railStyle).toMatchObject({
        left: 0,
        width: 4,
        backgroundColor: "#1b7787",
      });
    });
    expect(
      StyleSheet.flatten(screen.getByText("Reportar persona perdida").props.style),
    ).toMatchObject({ color: "#10232f" });
    expect(
      screen.getByLabelText("Buscar persona desaparecida por cualquier dato público"),
    ).toBeTruthy();
    expect(buildingButton.props.accessibilityHint).toMatch(/no se puede descartar presencia humana/i);
    expect(centerButton.props.accessibilityHint).toMatch(/recibe, clasifica y almacena ayudas/i);
    expect(donationPointButton.props.accessibilityHint).toMatch(/entrega que reúne ayudas/i);
    expect(communityMealsButton.props.accessibilityHint).toMatch(/preparas alimentos/i);
    expect(temporaryShelterButton.props.accessibilityHint).toMatch(/espacio disponible/i);
    // CHG-090 (QA): la tarjeta conserva categoría y título, pero ya no
    // pinta el propósito: ese texto espera en la leyenda del formulario.
    expect(screen.queryByText(/recibe y administra ayudas/i)).toBeNull();
    expect(
      screen.queryByText(/clasifica y almacena ayudas/i),
    ).toBeNull();
    expect(screen.getByText("AYUDA · RECEPCIÓN Y ALMACENAMIENTO")).toBeTruthy();
    expect(screen.getByText("AYUDA · ENTREGA COMUNITARIA")).toBeTruthy();
    expect(screen.getByText("AYUDA · ALIMENTACIÓN SOLIDARIA")).toBeTruthy();
    expect(screen.getByText("AYUDA · ALOJAMIENTO SOLIDARIO")).toBeTruthy();
    expect(screen.getByText("PERSONA · REPORTE CIUDADANO")).toBeTruthy();
    expect(screen.getByText("EDIFICIO · BÚSQUEDA PENDIENTE")).toBeTruthy();
    expect(screen.getByText("Inscribir centro de acopio")).toBeTruthy();
    expect(screen.getByText("Registrar punto de recolección")).toBeTruthy();
    expect(screen.getByText("Ofrecer comida comunitaria")).toBeTruthy();
    expect(screen.getByText("Ofrecer alojamiento temporal")).toBeTruthy();
    const showMoreButton = screen.getByRole("button", {
      name: "Ver más contenido",
    });
    expect(
      screen.getByTestId("dashboard-scroll-cue-scan", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    fireEvent.press(showMoreButton);
    fireEvent.press(reportButton);
    fireEvent.press(buildingButton);
    fireEvent.press(centerButton);
    fireEvent.press(donationPointButton);
    fireEvent.press(communityMealsButton);
    fireEvent.press(temporaryShelterButton);
    expect(onReportPerson).toHaveBeenCalledTimes(1);
    expect(onReportBuilding).toHaveBeenCalledTimes(1);
    expect(onRegisterCenter).toHaveBeenCalledTimes(1);
    expect(onRegisterPoint).toHaveBeenCalledTimes(1);
    expect(onOfferMeals).toHaveBeenCalledTimes(1);
    expect(onOfferShelter).toHaveBeenCalledTimes(1);
  });

  it("busca por cualquier atributo público sin depender de tildes", async () => {
    render(<App dataSource={demoDataSource} />);

    const search = await screen.findByLabelText(
      "Buscar persona desaparecida por cualquier dato público",
    );
    fireEvent.changeText(search, "bogota");
    expect(screen.queryByText("Valentina Rojas")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Buscar personas" }));

    expect(await screen.findByText("Valentina Rojas")).toBeTruthy();
    expect(screen.getByText("DEMO-MP-1047")).toBeTruthy();
    expect(screen.queryByText("Mateo Cárdenas")).toBeNull();
  });

  it("filtra la proyección autorizada por cada clase de dato público", () => {
    [
      "Valentina",
      "Vale",
      "DEMO-MP-1047",
      "22",
      "Bogota",
      "La Esperanza",
      "chaqueta amarilla",
      "cabello negro",
      "lunar visible",
    ].forEach((query) => {
      expect(filterPublicRecords(missingPersonDemoData, query)[0]?.publicCaseCode).toBe(
        "DEMO-MP-1047",
      );
    });
  });

  it("orienta consultas cortas y búsquedas sin coincidencias", async () => {
    render(<App dataSource={demoDataSource} />);

    const search = await screen.findByLabelText(
      "Buscar persona desaparecida por cualquier dato público",
    );
    fireEvent.changeText(search, "x");
    fireEvent.press(screen.getByRole("button", { name: "Buscar personas" }));
    expect(screen.getByText("Escribe al menos 2 caracteres para buscar.")).toBeTruthy();

    fireEvent.changeText(search, "dato inexistente");
    fireEvent.press(screen.getByRole("button", { name: "Buscar personas" }));
    expect(await screen.findByText("Sin coincidencias públicas")).toBeTruthy();
  });

  it("prioriza desaparecidos y muestra los cuatro estados", async () => {
    render(<App dataSource={demoDataSource} />);

    await screen.findByRole("header", { name: "Desaparecidos" });
    expect(screen.getAllByText("1.284").length).toBeGreaterThan(0);
    expect(screen.getByRole("header", { name: "Desaparecidos" })).toBeTruthy();
    expect(screen.getAllByText("Muertos reportados").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmados vivos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Muertos confirmados").length).toBeGreaterThan(0);
    expect(screen.queryByText("DATOS DEMOSTRATIVOS")).toBeNull();
    expect(screen.getByText("ESCENARIO DE PRUEBA")).toBeTruthy();
  });

  it("presenta una gráfica circular con alternativa accesible", async () => {
    render(<App dataSource={demoDataSource} />);

    const chart = await screen.findByRole("image", {
      name: /Distribución de 2.608 registros/,
    });

    expect(chart.props.accessibilityLabel).toMatch(/Desaparecidos: 1.284/);
    expect(chart.props.accessibilityLabel).toMatch(/Confirmados vivos: 745/);
  });

  it("resume cinco registros y abre una ventana ampliada al elegir más filas", async () => {
    const getPage = jest.fn(getPeopleRecordDemoPage);
    render(
      <App
        dataSource={demoDataSource}
        peopleRecordsDataSource={{ transport: "fixture", getPage }}
      />,
    );

    await screen.findByText("Persona demo 1042");
    expect(screen.getAllByTestId(/^recent-record-/)).toHaveLength(5);
    expect(screen.getByText("Persona demo 1042")).toBeTruthy();
    expect(screen.getByText("Persona demo 1038")).toBeTruthy();
    expect(screen.queryByText("Persona demo 1037")).toBeNull();
    expect(screen.getByText("PÁGINA 1 DE 3")).toBeTruthy();
    expect(screen.getByText(/MOSTRANDO 1–5 DE 12/)).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Página siguiente" }));
    expect(await screen.findByText("Persona demo 1037")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByTestId(/^recent-record-/)).toHaveLength(5),
    );
    expect(screen.getByText(/MOSTRANDO 6–10 DE 12/)).toBeTruthy();
    expect(screen.getByText("PÁGINA 2 DE 3")).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "Abrir ventana con 20 filas por página" }),
    );
    await waitFor(() =>
      expect(getPage.mock.calls.at(-1)?.[0]).toMatchObject({
        limit: 20,
        offset: 0,
      }),
    );
    expect(
      screen.getByLabelText("Ventana ampliada de personas publicables"),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByTestId(/^recent-record-/)).toHaveLength(12),
    );
    expect(screen.getByText("PÁGINA 1 DE 1")).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "Cerrar ventana de personas" }),
    );
    await waitFor(() =>
      expect(getPage.mock.calls.at(-1)?.[0]).toMatchObject({
        limit: 5,
        offset: 0,
      }),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId(/^recent-record-/)).toHaveLength(5),
    );
  });

  it("presenta personas a alto de viewport y las separa del footer negro informativo", async () => {
    const onAbout = jest.fn();
    render(<App dataSource={demoDataSource} onAbout={onAbout} />);

    await screen.findByText("Persona demo 1042");
    const liveSection = screen.getByTestId("dashboard-live-transmission");
    const liveStyle = StyleSheet.flatten(liveSection.props.style);
    expect(liveStyle.minHeight).toBeGreaterThan(0);

    const table = screen.getByLabelText("Listado paginado de personas publicables");
    const tableStyle = StyleSheet.flatten(table.props.style);
    expect(tableStyle.minHeight).toBe(liveStyle.minHeight);

    const footer = screen.getByTestId("platform-footer");
    const footerStyle = StyleSheet.flatten(footer.props.style);
    expect(footerStyle.marginTop).toBeGreaterThanOrEqual(24);
    expect(footerStyle.backgroundColor).toBe("#010204");
    expect(within(footer).getByText("CUSOL DISASTER APP")).toBeTruthy();
    expect(
      within(footer).getByText(/verifica la fuente, la fecha y el estado antes de actuar/i),
    ).toBeTruthy();
    expect(
      within(footer).getByText(/no reemplaza los canales oficiales/i),
    ).toBeTruthy();

    fireEvent.press(within(footer).getByRole("link", { name: "Quiénes somos" }));
    expect(onAbout).toHaveBeenCalledTimes(1);
  });

  it("acepta una página con menos registros que el tamaño solicitado", async () => {
    const smallDataSource: HumanImpactDataSource = {
      transport: "api",
      dataKind: "demonstrative",
      getOverview: async () => ({
        ...humanImpactDemoData,
        recentPeople: humanImpactDemoData.recentPeople.slice(0, 3),
      }),
    };
    const smallPeopleSource: PeopleRecordsDataSource = {
      transport: "fixture",
      getPage: async (query) => ({
        items: humanImpactDemoData.recentPeople.slice(0, 3),
        total: 3,
        limit: query.limit,
        offset: query.offset,
        generatedAt: humanImpactDemoData.generatedAt,
      }),
    };

    render(
      <App
        dataSource={smallDataSource}
        peopleRecordsDataSource={smallPeopleSource}
      />,
    );

    await screen.findByText("Persona demo 1042");
    expect(screen.getAllByTestId(/^recent-record-/)).toHaveLength(3);
    expect(screen.getByText(/MOSTRANDO 1–3 DE 3/)).toBeTruthy();
  });

  it("muestra carga y vacío del listado sin afectar el resto del dashboard", async () => {
    let resolvePage: ((page: Awaited<ReturnType<typeof getPeopleRecordDemoPage>>) => void) | undefined;
    const emptyRecordsSource: PeopleRecordsDataSource = {
      transport: "fixture",
      getPage: jest.fn(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      ),
    };

    render(
      <App
        dataSource={demoDataSource}
        peopleRecordsDataSource={emptyRecordsSource}
      />,
    );

    expect(await screen.findByLabelText("Cargando personas publicables")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Desaparecidos" })).toBeTruthy();

    await act(async () => {
      resolvePage?.({
        items: [],
        total: 0,
        limit: 5,
        offset: 0,
        generatedAt: humanImpactDemoData.generatedAt,
      });
      await Promise.resolve();
    });

    expect(
      await screen.findByText("No hay personas publicables que coincidan con la consulta."),
    ).toBeTruthy();
    expect(screen.getByText(/MOSTRANDO 0–0 DE 0/)).toBeTruthy();
    expect(screen.getByText("PÁGINA 1 DE 1")).toBeTruthy();
  });

  it("mantiene la clasificación demostrativa sin mostrar telemetría técnica", async () => {
    const apiSeedDataSource: HumanImpactDataSource = {
      transport: "api",
      dataKind: "demonstrative",
      getOverview: async () => humanImpactDemoData,
    };

    render(<App dataSource={apiSeedDataSource} />);

    expect(await screen.findByText("ESCENARIO DE PRUEBA")).toBeTruthy();
    expect(screen.queryByText("DATOS DEMOSTRATIVOS")).toBeNull();
    expect(screen.queryByText("API CONECTADA · DATOS DEMO")).toBeNull();
  });

  it("filtra dinámicamente los registros por búsqueda y estado", async () => {
    render(<App dataSource={demoDataSource} />);

    // CHG-048: la transmisión en vivo no ofrece búsqueda; la barra
    // vive únicamente en la ventana ampliada.
    await screen.findByText("Persona demo 1042");
    expect(
      screen.queryByLabelText("Buscar en todas las personas publicables"),
    ).toBeNull();
    fireEvent.press(
      screen.getByRole("button", { name: "Abrir ventana con 20 filas por página" }),
    );

    const search = await screen.findByLabelText(
      "Buscar en todas las personas publicables",
    );
    fireEvent.changeText(search, "Pueblo Rico");

    expect(await screen.findByText("Persona demo 1042")).toBeTruthy();
    expect(await screen.findByText(/MOSTRANDO 1–1 DE 1/)).toBeTruthy();

    fireEvent.changeText(search, "");
    fireEvent.press(
      screen.getByRole("button", { name: "Filtrar por Confirmados vivos" }),
    );

    expect(await screen.findByText(/MOSTRANDO 1–4 DE 4/)).toBeTruthy();
  });

  it("envía búsqueda, estado y tamaño al origen paginado y reinicia el offset", async () => {
    const getPage = jest.fn(getPeopleRecordDemoPage);
    const recordsSource: PeopleRecordsDataSource = {
      transport: "fixture",
      getPage,
    };
    render(
      <App
        dataSource={demoDataSource}
        peopleRecordsDataSource={recordsSource}
      />,
    );

    await waitFor(() => expect(getPage).toHaveBeenCalled());
    // CHG-048: la búsqueda solo existe tras abrir la ventana ampliada.
    fireEvent.press(
      screen.getByRole("button", { name: "Abrir ventana con 20 filas por página" }),
    );
    await waitFor(() =>
      expect(getPage.mock.calls.at(-1)?.[0]).toMatchObject({
        limit: 20,
        offset: 0,
      }),
    );

    const search = screen.getByLabelText(
      "Buscar en todas las personas publicables",
    );
    fireEvent.changeText(search, "Mocoa");
    await waitFor(() => expect(getPage.mock.calls.at(-1)?.[0].q).toBe("Mocoa"));

    fireEvent.press(screen.getByRole("button", { name: "Filtrar por Desaparecidos" }));
    await waitFor(() =>
      expect(getPage.mock.calls.at(-1)?.[0]).toMatchObject({
        offset: 0,
        statuses: ["missing"],
        q: "Mocoa",
      }),
    );
  });

  it("mantiene el dashboard si falla inicialmente solo el listado paginado", async () => {
    const unavailableRecordsSource: PeopleRecordsDataSource = {
      transport: "fixture",
      getPage: jest.fn().mockRejectedValue(new Error("Paginación no disponible")),
    };

    render(
      <App
        dataSource={demoDataSource}
        peopleRecordsDataSource={unavailableRecordsSource}
      />,
    );

    expect(await screen.findByRole("header", { name: "Desaparecidos" })).toBeTruthy();
    expect(await screen.findByText("No pudimos cargar las personas")).toBeTruthy();
    expect(screen.getByText("Paginación no disponible")).toBeTruthy();
  });

  it("conserva la página y la marca desactualizada si falla el polling", async () => {
    const firstPage = await getPeopleRecordDemoPage({
      limit: 5,
      offset: 0,
      statuses: [],
    });
    jest.useFakeTimers();
    const updatingRecordsSource: PeopleRecordsDataSource = {
      transport: "api",
      getPage: jest
        .fn()
        .mockResolvedValueOnce(firstPage)
        .mockRejectedValueOnce(new Error("Fallo de actualización paginada")),
    };

    render(
      <App
        dataSource={demoDataSource}
        mapDataSource={demoMapDataSource}
        humanMapDataSource={demoHumanMapDataSource}
        peopleRecordsDataSource={updatingRecordsSource}
      />,
    );
    expect(await screen.findByText("Persona demo 1042")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(screen.getByText("DESACTUALIZADO")).toBeTruthy();
    expect(screen.getByText(/Se conserva el último resultado válido/)).toBeTruthy();
    expect(screen.getByText("Persona demo 1042")).toBeTruthy();
  });

  it("muestra un estado de error si no existe un resultado previo", async () => {
    const unavailableSource: HumanImpactDataSource = {
      transport: "api",
      dataKind: "demonstrative",
      getOverview: jest
        .fn()
        .mockRejectedValue(new Error("Servicio temporalmente no disponible")),
    };

    render(<App dataSource={unavailableSource} />);

    expect(
      await screen.findByRole("header", { name: "No pudimos cargar la situación" }),
    ).toBeTruthy();
    expect(screen.getByText("Servicio temporalmente no disponible")).toBeTruthy();
  });

  it("conserva el último resultado si falla una actualización automática", async () => {
    jest.useFakeTimers();
    const updatingSource: HumanImpactDataSource = {
      transport: "api",
      dataKind: "demonstrative",
      getOverview: jest
        .fn()
        .mockResolvedValueOnce(humanImpactDemoData)
        .mockRejectedValueOnce(new Error("Fallo de actualización")),
    };

    render(<App dataSource={updatingSource} />);

    await act(async () => Promise.resolve());
    expect(screen.getAllByText("1.284").length).toBeGreaterThan(0);

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(screen.getAllByText("1.284").length).toBeGreaterThan(0);
    expect(screen.getByText(/No fue posible actualizar los datos/)).toBeTruthy();
  });

  it("separa personas de las categorías de respuesta e infraestructura", async () => {
    render(<App dataSource={demoDataSource} mapDataSource={demoMapDataSource} />);

    expect(await screen.findByText("DATOS DEMO")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Mapa operativo" })).toBeTruthy();
    expect(screen.getByText("Situación humana")).toBeTruthy();
    expect(screen.getByText("2.012 PERSONAS EN MAPA · 14 FEATURES")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Filtrar mapa por Desaparecidos" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Filtrar mapa por Centros de acopio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filtrar mapa por Escombros revisados" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filtrar mapa por Escombros pendientes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filtrar mapa por Edificios sin revisar" })).toBeTruthy();
    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(8);
    expect(screen.getByLabelText("Leyenda de respuesta e infraestructura")).toBeTruthy();
    expect(
      screen.getByText("Estas cifras son ubicaciones operativas, no personas."),
    ).toBeTruthy();
    operationalMapDemoData.items
      .filter((point) => point.category === "missing_person")
      .forEach((point) => {
        expect(screen.queryByTestId(`map-marker-${point.id}`)).toBeNull();
      });
    expect(
      screen.getAllByTestId("building-marker-icon", { includeHiddenElements: true }),
      // CHG-049: chip de edificios + 2 marcadores demo + chip de
      // alojamiento temporal (también con icono de edificio).
    ).toHaveLength(4);
  });

  it("representa las 2.012 personas distribuidas por Colombia en clusters trazables", async () => {
    render(
      <App
        dataSource={demoDataSource}
        mapDataSource={demoMapDataSource}
        humanMapDataSource={demoHumanMapDataSource}
      />,
    );

    expect(
      await screen.findByText("2.012 PERSONAS EN MAPA · 14 FEATURES"),
    ).toBeTruthy();
    expect(screen.getAllByTestId(/^human-map-feature-/)).toHaveLength(14);

    fireEvent.press(
      screen.getByRole("button", {
        name: /Grupo de 650 personas.*seleccionar para acercar/,
      }),
    );
    expect(await screen.findByText("650 personas")).toBeTruthy();
    expect(screen.getByTestId("human-map-cluster-detail")).toBeTruthy();
    await act(async () => Promise.resolve());
  });

  it("vuelve a consultar la capa humana al cambiar zoom y filtros", async () => {
    const getOverview = jest.fn(async (query: HumanMapQuery) =>
      getHumanMapDemoOverview(query),
    );
    const reactiveHumanMapSource: HumanMapDataSource = {
      transport: "fixture",
      getOverview,
    };

    render(
      <App
        dataSource={demoDataSource}
        mapDataSource={demoMapDataSource}
        humanMapDataSource={reactiveHumanMapSource}
      />,
    );

    await waitFor(() => expect(getOverview).toHaveBeenCalled());
    expect(getOverview.mock.calls.at(-1)?.[0].zoom).toBe(5);

    fireEvent.press(screen.getByRole("button", { name: "Acercar mapa" }));
    await waitFor(() =>
      expect(getOverview.mock.calls.some(([query]) => query.zoom === 7)).toBe(true),
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Filtrar capa humana por Desaparecidas",
      }),
    );
    await waitFor(() =>
      expect(
        getOverview.mock.calls.at(-1)?.[0].statuses.includes("missing"),
      ).toBe(false),
    );
    expect(
      await screen.findByText("1.407 PERSONAS EN MAPA · 12 FEATURES"),
    ).toBeTruthy();
  });

  it("mantiene filtros y mapa sobre el mismo subconjunto sin listado inferior", async () => {
    render(<App dataSource={demoDataSource} mapDataSource={demoMapDataSource} />);

    await waitFor(() =>
      expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(8),
    );
    // CHG-049: el bloque "UBICACIONES OPERATIVAS" y el detalle inferior
    // se retiraron; el mapa y sus filtros son la única superficie.
    expect(screen.queryByText(/UBICACIONES OPERATIVAS/)).toBeNull();
    expect(
      screen.queryByText("Activa una categoría para consultar sus ubicaciones."),
    ).toBeNull();

    fireEvent.press(
      screen.getByRole("button", { name: "Filtrar mapa por Centros de acopio" }),
    );

    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(6);
  });

  it("expone las categorías comunitarias nuevas como filtros del mapa", async () => {
    render(<App dataSource={demoDataSource} mapDataSource={demoMapDataSource} />);

    expect(
      await screen.findByRole("button", {
        name: "Filtrar mapa por Puntos de recolección",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Filtrar mapa por Comida comunitaria" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Filtrar mapa por Alojamiento temporal",
      }),
    ).toBeTruthy();
  });

  it("filtra únicamente los edificios sin revisar y permite seleccionarlos", async () => {
    render(<App dataSource={demoDataSource} mapDataSource={demoMapDataSource} />);

    const buildingFilter = await screen.findByRole("button", {
      name: "Filtrar mapa por Edificios sin revisar",
    });
    fireEvent.press(buildingFilter);
    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(6);

    fireEvent.press(buildingFilter);
    const buildingMarker = screen.getByRole("button", {
      name: "Edificios sin revisar: Edificio comunitario demo 01, Floridablanca, Santander",
    });
    fireEvent.press(buildingMarker);
    expect(buildingMarker.props.accessibilityState.selected).toBe(true);
  });

  it("ofrece controles de zoom accesibles y conserva el encuadre nacional al alejar", async () => {
    render(<App dataSource={demoDataSource} mapDataSource={demoMapDataSource} />);

    const zoomIn = await screen.findByRole("button", { name: "Acercar mapa" });
    const zoomOut = screen.getByRole("button", { name: "Alejar mapa" });
    expect(zoomOut.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(zoomIn);
    expect(screen.getByRole("button", { name: "Alejar mapa" }).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByRole("button", { name: "Alejar mapa" }));
    expect(screen.getByRole("button", { name: "Alejar mapa" }).props.accessibilityState.disabled).toBe(true);
  });

  it("marca como seleccionado el punto elegido sin panel de detalle inferior", async () => {
    render(<App dataSource={demoDataSource} mapDataSource={demoMapDataSource} />);

    const marker = await screen.findByRole("button", {
      name: "Centros de acopio: Centro de acopio Norte, Bogotá, Distrito Capital",
    });
    fireEvent.press(marker);

    // CHG-049: el panel de detalle inferior se retiró; la selección
    // vive en el propio marcador.
    expect(marker.props.accessibilityState.selected).toBe(true);
    expect(screen.queryByTestId("operational-map-detail")).toBeNull();
  });

  it("mantiene el dashboard humano si falla solo el mapa", async () => {
    const unavailableMapSource: OperationalMapDataSource = {
      transport: "api",
      getOverview: jest.fn().mockRejectedValue(new Error("Servicio geográfico no disponible")),
    };

    render(<App dataSource={demoDataSource} mapDataSource={unavailableMapSource} />);

    expect(await screen.findByRole("header", { name: "Desaparecidos" })).toBeTruthy();
    expect(await screen.findByText("Mapa temporalmente no disponible")).toBeTruthy();
    expect(screen.getByText("Servicio geográfico no disponible")).toBeTruthy();
  });

  it("conserva el último mapa y lo marca desactualizado si falla el polling", async () => {
    jest.useFakeTimers();
    const updatingMapSource: OperationalMapDataSource = {
      transport: "api",
      getOverview: jest
        .fn()
        .mockResolvedValueOnce(operationalMapDemoData)
        .mockRejectedValueOnce(new Error("Fallo de actualización geográfica")),
    };

    render(<App dataSource={demoDataSource} mapDataSource={updatingMapSource} />);
    await act(async () => Promise.resolve());
    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(8);

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(screen.getByText("DESACTUALIZADO")).toBeTruthy();
    expect(screen.getAllByTestId(/^map-marker-/)).toHaveLength(8);
  });

  it("no inventa puntos operativos aunque la capa humana sí tenga clusters", async () => {
    const emptyMapSource: OperationalMapDataSource = {
      transport: "api",
      getOverview: async () => ({
        summary: {
          missingPerson: 0,
          collectionCenter: 0,
          collectionPoint: 0,
          rubbleReviewed: 0,
          rubblePending: 0,
          buildingPending: 0,
          communityMeal: 0,
          temporaryShelter: 0,
          volunteersNeeded: 0,
        },
        items: [],
        generatedAt: "2026-08-12T18:30:00.000Z",
        dataClassification: "operational",
      }),
    };

    render(<App dataSource={demoDataSource} mapDataSource={emptyMapSource} />);

    await waitFor(() =>
      expect(screen.getAllByTestId(/^human-map-feature-/)).toHaveLength(14),
    );
    expect(screen.queryAllByTestId(/^map-marker-/)).toHaveLength(0);
    expect(screen.queryByText("SIN PUNTOS VISIBLES")).toBeNull();
  });

  it("bloquea coordenadas exactas públicas de desaparecidos", () => {
    const missingPoint = operationalMapDemoData.items.find(
      (point) => point.category === "missing_person",
    );

    expect(missingPoint).toBeDefined();
    expect(() =>
      validatePublicOverview({
        ...operationalMapDemoData,
        items: [
          {
            ...missingPoint!,
            coordinatePrecision: "exact",
          },
        ],
      }),
    ).toThrow(/ubicación exacta de desaparecidos/);
  });

  it("no inyecta edificios sintéticos: la API real es la única fuente", () => {
    const pointsWithoutBuildings = operationalMapDemoData.items.filter(
      (point) => point.category !== "building_pending",
    );
    const legacySummary = {
      missingPerson: 2,
      collectionCenter: 2,
      rubbleReviewed: 2,
      rubblePending: 2,
    };

    const demonstrative = normalizeOperationalMapOverview({
      ...operationalMapDemoData,
      summary: legacySummary,
      items: pointsWithoutBuildings,
    });
    expect(demonstrative.summary.buildingPending).toBe(0);
    expect(
      demonstrative.items.filter((point) => point.category === "building_pending"),
    ).toHaveLength(0);
    expect(demonstrative.items).toHaveLength(8);

    const withBuildings = normalizeOperationalMapOverview({
      ...operationalMapDemoData,
      summary: legacySummary,
    });
    expect(withBuildings.summary.buildingPending).toBe(2);
    expect(withBuildings.items).toHaveLength(10);
  });
});

// CHG-051 — Sesión visible en el encabezado con cierre.

describe("Sesión en el encabezado", () => {
  const sessionAccount = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    displayName: "Ana Rojas",
    email: "ana.rojas@example.com",
    assignedRole: "user" as const,
    status: "active" as const,
    sessionExpiresAt: "2100-01-01T00:00:00Z",
  };

  const authSourceWithSession = (logout = jest.fn()) => ({
    register: jest.fn(),
    login: jest.fn(),
    verifyEmail: jest.fn(),
    getCurrentAccount: jest.fn().mockResolvedValue(sessionAccount),
    logout,
  });

  it("muestra la cuenta activa y reemplaza los accesos de autenticación", async () => {
    render(
      <App dataSource={demoDataSource} authSource={authSourceWithSession()} />,
    );

    expect(await screen.findByTestId("session-account-chip")).toBeTruthy();
    expect(screen.getByText("ANA ROJAS")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Iniciar sesión" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Registrarse" }),
    ).toBeNull();
  });

  // CHG-069 — El chip de sesión despliega "Mi espacio" bajo el nombre.
  it("despliega Mi espacio bajo el nombre y abre el panel", async () => {
    render(
      <App dataSource={demoDataSource} authSource={authSourceWithSession()} />,
    );

    const chip = await screen.findByTestId("session-account-chip");
    expect(screen.queryByTestId("session-account-menu")).toBeNull();

    fireEvent.press(chip);
    expect(screen.getByTestId("session-account-menu")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Abrir Mi espacio" }));
    expect(await screen.findByTestId("my-space-panel")).toBeTruthy();
    expect(
      await screen.findByRole("header", { name: "Mi espacio" }),
    ).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Cerrar Mi espacio" }));
    await waitFor(() =>
      expect(screen.queryByTestId("my-space-panel")).toBeNull(),
    );
  });

  it("cierra la sesión y restaura iniciar sesión y registro", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    render(
      <App
        dataSource={demoDataSource}
        authSource={authSourceWithSession(logout)}
      />,
    );

    fireEvent.press(
      await screen.findByRole("button", { name: "Cerrar sesión" }),
    );

    expect(logout).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: "Iniciar sesión" }),
    ).toBeTruthy();
    expect(screen.queryByTestId("session-account-chip")).toBeNull();
  });

  it("sin sesión el encabezado conserva los accesos de autenticación", async () => {
    const authSource = {
      register: jest.fn(),
      login: jest.fn(),
      verifyEmail: jest.fn(),
      getCurrentAccount: jest
        .fn()
        .mockRejectedValue(new Error("Tu sesión está ausente.")),
      logout: jest.fn(),
    };
    render(<App dataSource={demoDataSource} authSource={authSource} />);

    expect(
      await screen.findByRole("button", { name: "Iniciar sesión" }),
    ).toBeTruthy();
    expect(screen.queryByTestId("session-account-chip")).toBeNull();
  });
});
