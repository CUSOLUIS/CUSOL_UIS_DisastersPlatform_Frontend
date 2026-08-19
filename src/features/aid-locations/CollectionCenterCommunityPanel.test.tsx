// CHG-165 — Comentarios y denuncias de un Centro de Acopio Local en su
// vista completa: comenta cualquiera (con cuenta o «Anónimo»), los más
// recientes van primero, y la denuncia exige motivo y descripción.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { CollectionCenterCommunityPanel } from "./CollectionCenterCommunityPanel";
import type {
  AidLocationComment,
  AidLocationCommunityDataSource,
} from "./communityDataSource";

afterEach(cleanup);

const LOCATION_ID = "cc000000-0000-4000-8000-000000000001";

const comments: AidLocationComment[] = [
  {
    id: "c-2",
    authorDisplayName: "María Gómez",
    actorKind: "authenticated",
    content: "Hay disponibilidad para recibir ropa y alimentos.",
    rating: 5,
    createdAt: "2026-08-19T01:14:00Z",
  },
  {
    // CHG-166: comentario anterior a las estrellas, sin calificación.
    id: "c-1",
    authorDisplayName: null,
    actorKind: "anonymous",
    content: "El punto continúa abierto.",
    rating: null,
    createdAt: "2026-08-19T00:52:00Z",
  },
];

function fakeDataSource(
  overrides: Partial<AidLocationCommunityDataSource> = {},
): AidLocationCommunityDataSource {
  return {
    transport: "demo",
    listComments: jest.fn().mockResolvedValue({
      items: comments,
      total: comments.length,
      ratingAverage: 5,
      ratingCount: 1,
    }),
    createComment: jest.fn().mockResolvedValue(comments[0]),
    reportCenter: jest.fn().mockResolvedValue({
      locationId: LOCATION_ID,
      reportsCount: 1,
      underObservation: false,
      disabled: false,
    }),
    ...overrides,
  };
}

it("muestra los comentarios del más reciente al más antiguo, con Anónimo", async () => {
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={fakeDataSource()}
    />,
  );

  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );
  expect(screen.getByText("María Gómez")).toBeTruthy();
  expect(screen.getByText("Anónimo")).toBeTruthy();
  expect(screen.getByText("COMENTARIOS")).toBeTruthy();
  // CHG-166: promedio junto al título y estrellas por comentario; los
  // comentarios previos a la mejora no muestran estrellas.
  expect(
    screen.getByTestId("center-comments-average").props.children,
  ).toBe("★★★★★ 5,0 · 1 calificación");
  expect(screen.getByTestId("center-comment-rating-c-2")).toBeTruthy();
  expect(screen.queryByTestId("center-comment-rating-c-1")).toBeNull();
});

// CHG-166 — Publicar exige elegir una calificación de 1 a 5 estrellas.
it("no publica sin calificación y avisa en local", async () => {
  const dataSource = fakeDataSource();
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("center-comment-button"));
  fireEvent.changeText(
    screen.getByLabelText("Texto del comentario"),
    "El punto atiende con normalidad.",
  );
  fireEvent.press(screen.getByTestId("center-comment-publish"));

  await waitFor(() =>
    expect(
      screen.getByText("Elige una calificación de 1 a 5 estrellas."),
    ).toBeTruthy(),
  );
  expect(dataSource.createComment).not.toHaveBeenCalled();
});

it("COMENTAR publica el texto y recarga la lista", async () => {
  const dataSource = fakeDataSource();
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("center-comment-button"));
  // CHG-166: la calificación por estrellas acompaña al texto.
  fireEvent.press(screen.getByTestId("center-comment-star-4"));
  fireEvent.changeText(
    screen.getByLabelText("Texto del comentario"),
    "Acabo de entregar varias cajas en este punto.",
  );
  fireEvent.press(screen.getByTestId("center-comment-publish"));

  await waitFor(() =>
    expect(dataSource.createComment).toHaveBeenCalledWith(
      LOCATION_ID,
      "Acabo de entregar varias cajas en este punto.",
      4,
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-community-notice")).toBeTruthy(),
  );
  expect(dataSource.listComments).toHaveBeenCalledTimes(2);
});

it("rechaza en local un comentario ilegible sin llamar a la API", async () => {
  const dataSource = fakeDataSource();
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("center-comment-button"));
  fireEvent.changeText(
    screen.getByLabelText("Texto del comentario"),
    "aaaaaaaaaaaaaaaaaa",
  );
  fireEvent.press(screen.getByTestId("center-comment-publish"));

  await waitFor(() =>
    expect(
      screen.getByText(/repite un mismo carácter demasiadas veces/i),
    ).toBeTruthy(),
  );
  expect(dataSource.createComment).not.toHaveBeenCalled();
});

it("DENUNCIAR exige motivo y descripción antes de enviar", async () => {
  const dataSource = fakeDataSource();
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("center-report-button"));
  fireEvent.press(screen.getByTestId("center-report-send"));

  await waitFor(() =>
    expect(screen.getByText("Elige el motivo de la denuncia.")).toBeTruthy(),
  );
  expect(
    screen.getByText("Describe la situación que estás denunciando."),
  ).toBeTruthy();
  expect(dataSource.reportCenter).not.toHaveBeenCalled();
});

it("envía la denuncia con el motivo elegido y confirma el registro", async () => {
  const dataSource = fakeDataSource();
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("center-report-button"));
  fireEvent.press(screen.getByLabelText("El punto no existe"));
  fireEvent.changeText(
    screen.getByLabelText("Descripción de la denuncia"),
    "Fui al lugar y no existe tal centro.",
  );
  fireEvent.press(screen.getByTestId("center-report-send"));

  await waitFor(() =>
    expect(dataSource.reportCenter).toHaveBeenCalledWith(LOCATION_ID, {
      category: "no_existe",
      reason: "Fui al lugar y no existe tal centro.",
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-community-notice")).toBeTruthy(),
  );
});

it("cuando la denuncia deshabilita el centro lo explica", async () => {
  const dataSource = fakeDataSource({
    reportCenter: jest.fn().mockResolvedValue({
      locationId: LOCATION_ID,
      reportsCount: 20,
      underObservation: false,
      disabled: true,
    }),
  });
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );

  fireEvent.press(screen.getByTestId("center-report-button"));
  fireEvent.press(screen.getByLabelText("Otro motivo"));
  fireEvent.changeText(
    screen.getByLabelText("Descripción de la denuncia"),
    "El punto lleva días sin atender a nadie.",
  );
  fireEvent.press(screen.getByTestId("center-report-send"));

  await waitFor(() =>
    expect(screen.getByText(/quedó deshabilitado/i)).toBeTruthy(),
  );
});
