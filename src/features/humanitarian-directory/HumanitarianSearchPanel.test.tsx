import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { HumanitarianSearchPanel } from "./HumanitarianSearchPanel";
import { humanitarianDirectoryDataSource } from "./dataSource";
import type {
  CommunityContributionDataSource,
} from "./types";
import type { SelectedPhoto } from "../missing-persons/reportTypes";

const validPhoto: SelectedPhoto = {
  uri: "file:///evidencia.jpg",
  name: "evidencia.jpg",
  size: 512_000,
  mimeType: "image/jpeg",
};

const submit = jest.fn(
  async () => ({
    id: "a771ca1e-9fc0-48e0-aa1c-23864540f724",
    status: "under_review" as const,
    actorKind: "authenticated" as const,
    receivedAt: "2026-08-14T10:00:00.000Z",
  }),
);

const contributionDataSource: CommunityContributionDataSource = {
  transport: "fixture",
  getActorKind: async () => "authenticated",
  submit,
};

afterEach(() => {
  cleanup();
  submit.mockClear();
});

describe("Directorio humanitario", () => {
  it("amplía textos y controles para que el buscador sea legible", () => {
    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={humanitarianDirectoryDataSource}
        contributionDataSource={contributionDataSource}
      />,
    );

    const panelStyle = StyleSheet.flatten(
      screen.getByTestId("person-search-panel").props.style,
    );
    const titleStyle = StyleSheet.flatten(
      screen.getByRole("header", { name: "Buscar y verificar" }).props.style,
    );
    const tabStyle = StyleSheet.flatten(
      screen.getByRole("tab", { name: "Buscar personas" }).props.style,
    );
    const inputStyle = StyleSheet.flatten(
      screen.getByLabelText(
        "Buscar persona desaparecida por cualquier dato público",
      ).props.style,
    );
    const buttonStyle = StyleSheet.flatten(
      screen.getByRole("button", { name: "Buscar personas" }).props.style,
    );
    const filterStyle = StyleSheet.flatten(
      screen.getByRole("button", { name: "Filtrar por Todas" }).props.style,
    );
    const hintStyle = StyleSheet.flatten(
      screen.getByText(
        "Las coincidencias se abrirán en una ventana independiente.",
      ).props.style,
    );

    expect(panelStyle.padding).toBeGreaterThanOrEqual(22);
    expect(titleStyle.fontSize).toBeGreaterThanOrEqual(30);
    expect(tabStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(inputStyle.fontSize).toBeGreaterThanOrEqual(14);
    expect(buttonStyle.minHeight).toBeGreaterThanOrEqual(58);
    expect(filterStyle.minHeight).toBeGreaterThanOrEqual(36);
    expect(hintStyle.fontSize).toBeGreaterThanOrEqual(10);
  });

  it("mantiene tres opciones y abre las coincidencias fuera del buscador", async () => {
    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={humanitarianDirectoryDataSource}
        contributionDataSource={contributionDataSource}
      />,
    );

    expect(screen.getByRole("tab", { name: "Buscar personas" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Buscar centros de acopio" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Buscar puntos de recolección" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filtrar por Desaparecidas" })).toBeTruthy();

    fireEvent.changeText(
      screen.getByLabelText("Buscar persona desaparecida por cualquier dato público"),
      "bogota",
    );
    expect(screen.queryByText("Valentina Rojas")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Buscar personas" }));

    expect(
      await screen.findByLabelText("Ventana de resultados del directorio humanitario"),
    ).toBeTruthy();
    expect(await screen.findByText("Valentina Rojas")).toBeTruthy();
    expect(screen.getByText("DEMO-MP-1047")).toBeTruthy();
  });

  it("muestra centros en tarjetas con estrellas y recibe una valoración", async () => {
    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={humanitarianDirectoryDataSource}
        contributionDataSource={contributionDataSource}
      />,
    );

    fireEvent.press(screen.getByRole("tab", { name: "Buscar centros de acopio" }));
    expect(screen.getByRole("button", { name: "Filtrar por Abiertos ahora" })).toBeTruthy();
    fireEvent.changeText(
      screen.getByLabelText("Buscar centros de acopio por nombre o ubicación"),
      "bogota",
    );
    fireEvent.press(screen.getByRole("button", { name: "Buscar centros de acopio" }));

    expect(await screen.findByText("Centro de acopio Norte")).toBeTruthy();
    expect(screen.getByLabelText(/4.6 de 5 estrellas, 38 valoraciones/)).toBeTruthy();
    fireEvent.press(
      screen.getByRole("button", {
        name: "Puntuar veracidad de Centro de acopio Norte",
      }),
    );

    expect(await screen.findByRole("header", { name: "Centro de acopio Norte" })).toBeTruthy();
    fireEvent.press(screen.getByRole("radio", { name: "5 estrellas" }));
    fireEvent.changeText(
      screen.getByLabelText("Descripción de la evidencia"),
      "El lugar estaba abierto y recibió alimentos durante la mañana.",
    );
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Confirmo que este aporte es veraz según mi conocimiento.",
      }),
    );
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Entiendo que mi aporte será visible en las novedades públicas de este registro.",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Enviar aporte para revisión" }));

    expect(await screen.findByRole("header", { name: "Novedad recibida" })).toBeTruthy();
    expect(screen.getByText("APORTE CON CUENTA")).toBeTruthy();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "aid_location_rating",
        rating: 5,
        targetId: "de5129a2-a6a5-44aa-9831-722a5890c320",
      }),
      "authenticated",
    );
  });

  it("exige texto y foto antes de recibir una novedad de persona", async () => {
    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={humanitarianDirectoryDataSource}
        contributionDataSource={contributionDataSource}
        pickPhotos={async () => [validPhoto]}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Buscar persona desaparecida por cualquier dato público"),
      "valentina",
    );
    fireEvent.press(screen.getByRole("button", { name: "Buscar personas" }));
    fireEvent.press(
      await screen.findByRole("button", {
        name: "Reportar novedad sobre Valentina Rojas",
      }),
    );

    fireEvent.changeText(
      screen.getByLabelText("Descripción de la evidencia"),
      "La persona fue vista a salvo con su familia en un albergue local.",
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Adjuntar fotografías de evidencia" }),
    );
    expect(await screen.findByText("evidencia.jpg")).toBeTruthy();
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Confirmo que este aporte es veraz según mi conocimiento.",
      }),
    );
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Entiendo que mi aporte será visible en las novedades públicas de este registro.",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Enviar aporte para revisión" }));

    expect(await screen.findByRole("header", { name: "Novedad recibida" })).toBeTruthy();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "missing_person_status",
        claimedOutcome: "found",
        photos: [validPhoto],
      }),
      "authenticated",
    );
  });

  // CHG-077 — Al abrir la tarjeta se ven las novedades de terceros.
  it("muestra las novedades de la persona al abrir su tarjeta", async () => {
    const fetchNovelties = jest.fn(async (personId: string) => ({
      personId,
      publicStatus: "found" as const,
      items: [
        {
          id: "novelty-1",
          claimedOutcome: "found" as const,
          evidenceDescription: "La vi en el albergue del colegio central.",
          locationDescription: "Albergue del colegio central",
          occurredAt: "2026-08-14T10:00:00Z",
          receivedAt: "2026-08-14T11:00:00Z",
          reporterKind: "health_sector" as const,
          moderationStatus: "under_review" as const,
        },
      ],
      total: 1,
    }));
    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={humanitarianDirectoryDataSource}
        contributionDataSource={contributionDataSource}
        fetchNovelties={fetchNovelties}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Buscar persona desaparecida por cualquier dato público"),
      "valentina",
    );
    fireEvent.press(screen.getByRole("button", { name: "Buscar personas" }));
    fireEvent.press(
      await screen.findByRole("button", {
        name: "Ver novedades de Valentina Rojas",
      }),
    );

    expect(
      await screen.findByText("La vi en el albergue del colegio central."),
    ).toBeTruthy();
    expect(screen.getByText("SECTOR SALUD")).toBeTruthy();
    expect(screen.getByText("ESTADO ACTUAL · ENCONTRADA")).toBeTruthy();
    expect(screen.getByText(/5 o más\s+personas reportan el mismo desenlace/)).toBeTruthy();
    expect(fetchNovelties).toHaveBeenCalledTimes(1);

    // Desde el detalle se puede reportar una novedad propia.
    fireEvent.press(
      screen.getByRole("button", { name: "Reportar novedad sobre Valentina Rojas" }),
    );
    expect(
      await screen.findByRole("header", { name: "Aportar evidencia" }),
    ).toBeTruthy();
  });
});

// CHG-061 — Contador de coincidencias visible sin mostrar resultados.

it("muestra el total de coincidencias en la pista y renombra el botón", async () => {
  jest.useFakeTimers();
  const search = jest.fn(async () => ({
    items: [],
    total: 7,
    limit: 20,
    offset: 0,
    query: "maria",
    kind: "missing_person" as const,
    generatedAt: "2026-08-15T12:00:00.000Z",
  }));

  render(
    <HumanitarianSearchPanel
      compact={false}
      dataSource={{ transport: "fixture", search }}
      contributionDataSource={contributionDataSource}
    />,
  );

  expect(screen.getByText("RESULTADOS")).toBeTruthy();
  expect(
    screen.getByText("Las coincidencias se abrirán en una ventana independiente."),
  ).toBeTruthy();

  fireEvent.changeText(
    screen.getByLabelText(
      "Buscar persona desaparecida por cualquier dato público",
    ),
    "maria",
  );
  await act(async () => {
    jest.advanceTimersByTime(500);
    await Promise.resolve();
  });

  expect(search).toHaveBeenCalledWith({
    kind: "missing_person",
    query: "maria",
    filter: "all",
  });
  expect(
    screen.getByText(/7 coincidencias — se abrirán en una ventana/),
  ).toBeTruthy();
  jest.useRealTimers();
});

/**
 * CHG-150 — «Buscar y verificar»: al escribir solo se muestra el número
 * de coincidencias; la lista desplegable ya no aparece bajo el input.
 * Las coincidencias se ven en la ventana de RESULTADOS (con ver ficha /
 * reportar novedad, cubierto por las pruebas de arriba).
 */
describe("Coincidencias sin desplegable (CHG-150)", () => {
  it("al escribir NO despliega la lista de coincidencias, solo el contador", async () => {
    jest.useFakeTimers();
    const search = jest.fn(async () => ({
      items: [],
      total: 3,
      limit: 20,
      offset: 0,
      query: "Kamila",
      kind: "missing_person" as const,
      generatedAt: "2026-08-18T12:00:00.000Z",
    }));

    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={{ transport: "fixture", search }}
        contributionDataSource={contributionDataSource}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText(
        "Buscar persona desaparecida por cualquier dato público",
      ),
      "Kamila",
    );
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    // CHG-150: nada de desplegable bajo el input; solo el número.
    expect(screen.queryByText("COINCIDENCIAS REGISTRADAS")).toBeNull();
    expect(
      screen.getByText(/3 coincidencias — se abrirán en una ventana/),
    ).toBeTruthy();
    jest.useRealTimers();
  });

  it("el deep link ?buscar= precarga el texto y abre los resultados", async () => {
    render(
      <HumanitarianSearchPanel
        compact={false}
        dataSource={humanitarianDirectoryDataSource}
        contributionDataSource={contributionDataSource}
        initialQuery="MP-2026-DEMO01"
      />,
    );

    expect(
      await screen.findByText("Coincidencias de personas"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Buscar persona desaparecida por cualquier dato público",
      ).props.value,
    ).toBe("MP-2026-DEMO01");
  });
});
