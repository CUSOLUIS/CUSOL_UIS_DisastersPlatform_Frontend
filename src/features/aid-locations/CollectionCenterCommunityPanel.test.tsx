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
    adminDeleteComment: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// CHG-167: sesión super_admin inyectada; la real consulta /auth/me.
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

function userSessionSource() {
  return {
    getCurrentAccount: jest.fn().mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      displayName: "Usuaria Normal",
      email: "user@cusol.local",
      assignedRole: "user",
      status: "active",
      sessionExpiresAt: "2099-01-01T00:00:00Z",
    }),
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

// CHG-167 — Solo super_admin ve la opción de borrar, a la derecha de
// cada comentario, y el borrado confirma en dos pasos.
it("un super_admin borra un comentario con confirmación en dos pasos", async () => {
  const dataSource = fakeDataSource();
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={dataSource}
      sessionSource={adminSessionSource()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-delete-c-2")).toBeTruthy(),
  );

  // Primer toque: arma la confirmación sin llamar a la API.
  fireEvent.press(screen.getByTestId("center-comment-delete-c-2"));
  expect(screen.getByText("¿CONFIRMAR?")).toBeTruthy();
  expect(dataSource.adminDeleteComment).not.toHaveBeenCalled();

  // Segundo toque: borra y recarga la lista.
  fireEvent.press(screen.getByTestId("center-comment-delete-c-2"));
  await waitFor(() =>
    expect(dataSource.adminDeleteComment).toHaveBeenCalledWith(
      LOCATION_ID,
      "c-2",
    ),
  );
  await waitFor(() =>
    expect(screen.getByText("El comentario fue borrado.")).toBeTruthy(),
  );
  expect(dataSource.listComments).toHaveBeenCalledTimes(2);
});

it("los anónimos no ven la opción de borrar", async () => {
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={fakeDataSource()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );
  expect(screen.queryByTestId("center-comment-delete-c-2")).toBeNull();
});

it("una cuenta sin rol administrativo tampoco ve la opción de borrar", async () => {
  render(
    <CollectionCenterCommunityPanel
      locationId={LOCATION_ID}
      dataSource={fakeDataSource()}
      sessionSource={userSessionSource()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("center-comment-c-2")).toBeTruthy(),
  );
  expect(screen.queryByTestId("center-comment-delete-c-2")).toBeNull();
});
