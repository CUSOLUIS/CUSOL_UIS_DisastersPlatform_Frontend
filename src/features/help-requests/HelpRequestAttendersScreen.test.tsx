/**
 * CHG-193 — Quién atiende MI solicitud: la lista, el detalle de cada
 * persona y el respeto por quien no compartió sus datos.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { HelpRequestAttendersScreen } from "./HelpRequestAttendersScreen";
import type { HelpRequestsDataSource } from "./types";

afterEach(cleanup);

function dataSourceWith(items: unknown[]): HelpRequestsDataSource {
  return {
    transport: "demo",
    listActive: jest.fn(),
    attend: jest.fn(),
    listAttenders: jest.fn().mockResolvedValue({
      items,
      total: items.length,
      generatedAt: "2026-08-21T12:00:00Z",
    }),
  } as unknown as HelpRequestsDataSource;
}

const CON_DATOS = {
  id: "aaaa1111-1111-4111-8111-111111111111",
  kind: "volunteer" as const,
  joinedAt: "2026-08-21T15:30:00Z",
  sharesContact: true,
  name: "Ana Voluntaria",
  phone: "3001234567",
  photoUrl: null,
};

const SIN_DATOS = {
  id: "bbbb2222-2222-4222-8222-222222222222",
  kind: "account" as const,
  joinedAt: "2026-08-21T14:00:00Z",
  sharesContact: false,
  name: null,
  phone: null,
  photoUrl: null,
};

it("lista a quienes atienden y abre el detalle de cada persona", async () => {
  render(
    <HelpRequestAttendersScreen
      requestId="5e5b182f-5538-4e1f-87f0-e62a34e40c01"
      address="Calle 33, Bucaramanga"
      onBack={jest.fn()}
      dataSource={dataSourceWith([CON_DATOS, SIN_DATOS])}
    />,
  );

  expect(await screen.findByText("2 PERSONAS ATENDIENDO")).toBeTruthy();
  expect(screen.getByText("Ana Voluntaria")).toBeTruthy();

  fireEvent.press(screen.getByTestId(`attender-row-${CON_DATOS.id}`));

  expect(await screen.findByTestId("attender-detail")).toBeTruthy();
  expect(screen.getByText("LLAMAR · 3001234567")).toBeTruthy();
});

it("quien no compartió sus datos figura, sin nombre inventado y con la razón", async () => {
  render(
    <HelpRequestAttendersScreen
      requestId="5e5b182f-5538-4e1f-87f0-e62a34e40c01"
      onBack={jest.fn()}
      dataSource={dataSourceWith([SIN_DATOS])}
    />,
  );

  fireEvent.press(await screen.findByTestId(`attender-row-${SIN_DATOS.id}`));

  expect(
    await screen.findByText(/no compartió sus datos/),
  ).toBeTruthy();
  expect(screen.queryByText(/LLAMAR/)).toBeNull();
});

it("sin nadie atendiendo lo dice, sin dar por rota la pantalla", async () => {
  render(
    <HelpRequestAttendersScreen
      requestId="5e5b182f-5538-4e1f-87f0-e62a34e40c01"
      onBack={jest.fn()}
      dataSource={dataSourceWith([])}
    />,
  );

  expect(
    await screen.findByText(/Todavía nadie ha marcado que atiende/),
  ).toBeTruthy();
});

it("un fallo de la consulta se explica y se puede reintentar", async () => {
  const dataSource = dataSourceWith([]);
  (dataSource.listAttenders as jest.Mock)
    .mockRejectedValueOnce(new Error("La solicitud no existe o no es tuya."))
    .mockResolvedValueOnce({
      items: [CON_DATOS],
      total: 1,
      generatedAt: "2026-08-21T12:00:00Z",
    });

  render(
    <HelpRequestAttendersScreen
      requestId="5e5b182f-5538-4e1f-87f0-e62a34e40c01"
      onBack={jest.fn()}
      dataSource={dataSource}
    />,
  );

  expect(
    await screen.findByText("La solicitud no existe o no es tuya."),
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", { name: "Reintentar la consulta" }),
  );

  await waitFor(() => expect(screen.getByText("Ana Voluntaria")).toBeTruthy());
});
