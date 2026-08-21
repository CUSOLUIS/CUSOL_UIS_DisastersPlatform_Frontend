// CHG-182 — «Mis casitas» en Mi espacio: el aviso de comentarios sin
// leer y el botón que los marca como leídos.

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { MyDamagedHomesSection } from "./MyDamagedHomesSection";
import type { DamagedHomesDataSource, MyDamagedHomesResponse } from "./types";

afterEach(cleanup);

const HOME_ID = "9a1b7c33-3333-4e5f-8a6b-000000000182";

function page(unread: number): MyDamagedHomesResponse {
  return {
    items: [
      {
        id: HOME_ID,
        publicCode: "CASA-2026-ABCD1234",
        description: "El río se llevó la cocina.",
        department: "Chocó",
        municipality: "Quibdó",
        address: "Barrio Niño Jesús, calle 3",
        latitude: 5.69,
        longitude: -76.66,
        householdSize: 5,
        donationChannel: "Nequi",
        donationReference: "3001234567",
        createdAt: "2026-08-20T10:00:00Z",
        updatedAt: "2026-08-20T10:00:00Z",
        photoUrls: [],
        commentRatingAverage: 4.5,
        commentRatingCount: 2,
        published: true,
        unreadComments: unread,
        commentsCount: 3,
      },
    ],
    total: 1,
    unreadTotal: unread,
  };
}

function fakeSource(): DamagedHomesDataSource {
  return {
    transport: "demo",
    listActive: jest.fn(),
    listMine: jest.fn(),
    markCommentsSeen: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

it("avisa cuántos comentarios nuevos tiene la casita", () => {
  render(
    <MyDamagedHomesSection page={page(3)} dataSource={fakeSource()} />,
  );

  expect(screen.getByTestId(`my-home-unread-${HOME_ID}`)).toHaveTextContent(
    /3 NUEVOS/,
  );
});

it("marcar como leídos avisa al backend y refresca", async () => {
  const dataSource = fakeSource();
  const onSeen = jest.fn();
  render(
    <MyDamagedHomesSection
      page={page(2)}
      dataSource={dataSource}
      onSeen={onSeen}
    />,
  );

  fireEvent.press(screen.getByTestId(`my-home-mark-seen-${HOME_ID}`));

  await waitFor(() =>
    expect(dataSource.markCommentsSeen).toHaveBeenCalledWith(HOME_ID),
  );
  await waitFor(() => expect(onSeen).toHaveBeenCalledTimes(1));
});

it("sin comentarios nuevos no ofrece marcarlos", () => {
  render(
    <MyDamagedHomesSection page={page(0)} dataSource={fakeSource()} />,
  );

  expect(screen.queryByTestId(`my-home-unread-${HOME_ID}`)).toBeNull();
  expect(screen.queryByTestId(`my-home-mark-seen-${HOME_ID}`)).toBeNull();
});

it("sin casitas lo dice, en vez de mostrar una lista vacía", () => {
  render(
    <MyDamagedHomesSection
      page={{ items: [], total: 0, unreadTotal: 0 }}
      dataSource={fakeSource()}
    />,
  );

  expect(screen.getByTestId("my-damaged-homes-empty")).toBeTruthy();
});


// CHG-202 — La dueña ve su publicación entera y puede retirarla. La
// casita no expira sola: sin este botón, la única salida era pedírselo
// al super_admin.
it("ofrece VER MÁS hacia la ficha de su propia casita", () => {
  const casitas = page(0);
  const onOpenDetail = jest.fn();
  render(
    <MyDamagedHomesSection
      page={casitas}
      dataSource={fakeSource()}
      onOpenDetail={onOpenDetail}
    />,
  );

  fireEvent.press(screen.getByTestId(`my-home-detail-${casitas.items[0].id}`));
  expect(onOpenDetail).toHaveBeenCalledWith(casitas.items[0]);
});

it("elimina la publicación solo tras confirmarlo, y recarga", async () => {
  const casitas = page(0);
  const dataSource = fakeSource();
  const onDeleted = jest.fn();
  render(
    <MyDamagedHomesSection
      page={casitas}
      dataSource={dataSource}
      onDeleted={onDeleted}
    />,
  );
  const id = casitas.items[0].id;

  // Primer toque: advierte, no borra.
  fireEvent.press(screen.getByTestId(`my-home-delete-${id}`));
  expect(dataSource.remove).not.toHaveBeenCalled();
  expect(screen.getByText(/No se puede deshacer/)).toBeTruthy();
  expect(screen.getByText(/comentarios que\s+te dejaron/)).toBeTruthy();

  // Arrepentirse no borra nada.
  fireEvent.press(
    screen.getByRole("button", { name: "Conservar mi publicación" }),
  );
  expect(dataSource.remove).not.toHaveBeenCalled();

  // Confirmar sí.
  fireEvent.press(screen.getByTestId(`my-home-delete-${id}`));
  await act(async () => {
    fireEvent.press(screen.getByTestId(`my-home-delete-confirm-${id}`));
  });
  expect(dataSource.remove).toHaveBeenCalledWith(id);
  expect(onDeleted).toHaveBeenCalled();
});
