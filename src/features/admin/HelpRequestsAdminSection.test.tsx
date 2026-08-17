// CHG-138 — La consola ve todo lo que llega de «Necesitamos ayuda» y
// lo elimina una a una o vacía la base, siempre con confirmación.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { HelpRequestsAdminSection } from "./HelpRequestsAdminSection";
import type { AdminDataSource, AdminHelpRequest } from "./types";

afterEach(cleanup);

const activeRequest: AdminHelpRequest = {
  id: "5d3f9a10-1111-4c2d-9e3f-000000000001",
  publicCode: "HR-2026-AAAA1111",
  description: "Necesitamos agua potable y cobijas para tres familias.",
  address: "Vereda El Salado, Piedecuesta",
  latitude: 6.9871,
  longitude: -73.0498,
  notificationRadiusKm: 10,
  createdAt: "2026-08-17T10:00:00Z",
  expiresAt: "2026-08-18T10:00:00Z",
  expired: false,
  attendersCount: 2,
  hasPhoto: false,
};

const expiredRequest: AdminHelpRequest = {
  ...activeRequest,
  id: "5d3f9a10-1111-4c2d-9e3f-000000000002",
  publicCode: "HR-2026-BBBB2222",
  expired: true,
  attendersCount: 0,
  notificationRadiusKm: null,
};

function sectionDataSource(
  items: AdminHelpRequest[] = [activeRequest, expiredRequest],
) {
  const state = { items: [...items] };
  const listHelpRequests = jest.fn(async () => ({
    items: [...state.items],
    total: state.items.length,
    generatedAt: "2026-08-17T12:00:00Z",
  }));
  const deleteHelpRequest = jest.fn(async (id: string) => {
    state.items = state.items.filter((item) => item.id !== id);
    return { deleted: 1 };
  });
  const purgeHelpRequests = jest.fn(async () => {
    const deleted = state.items.length;
    state.items = [];
    return { deleted };
  });
  const dataSource = {
    listHelpRequests,
    deleteHelpRequest,
    purgeHelpRequests,
  } as unknown as AdminDataSource;
  return { dataSource, listHelpRequests, deleteHelpRequest, purgeHelpRequests };
}

describe("HelpRequestsAdminSection (CHG-138)", () => {
  it("lista todo lo que llega, con estado activa/expirada", async () => {
    const { dataSource } = sectionDataSource();
    render(<HelpRequestsAdminSection dataSource={dataSource} />);

    expect(
      await screen.findByText(/SOLICITUDES «NECESITAMOS AYUDA» · 2 EN BASE/),
    ).toBeTruthy();
    expect(screen.getByText("HR-2026-AAAA1111")).toBeTruthy();
    expect(screen.getByText("HR-2026-BBBB2222")).toBeTruthy();
    expect(screen.getByText("ACTIVA")).toBeTruthy();
    expect(screen.getByText("EXPIRADA")).toBeTruthy();
    expect(screen.getByText(/avisa a 10 km/)).toBeTruthy();
  });

  it("elimina una a una con confirmación y recarga", async () => {
    const { dataSource, deleteHelpRequest, listHelpRequests } =
      sectionDataSource();
    render(<HelpRequestsAdminSection dataSource={dataSource} />);

    fireEvent.press(
      await screen.findByLabelText(
        "Eliminar la solicitud HR-2026-AAAA1111",
      ),
    );
    fireEvent.press(
      screen.getByLabelText(
        "Confirmar la eliminación de HR-2026-AAAA1111",
      ),
    );

    await waitFor(() =>
      expect(deleteHelpRequest).toHaveBeenCalledWith(activeRequest.id),
    );
    expect(
      await screen.findByText("Solicitud HR-2026-AAAA1111 eliminada."),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("HR-2026-AAAA1111")).toBeNull(),
    );
    expect(listHelpRequests).toHaveBeenCalledTimes(2);
  });

  it("vacía la base completa con confirmación explícita", async () => {
    const { dataSource, purgeHelpRequests } = sectionDataSource();
    render(<HelpRequestsAdminSection dataSource={dataSource} />);

    fireEvent.press(
      await screen.findByLabelText("Vaciar todas las solicitudes"),
    );
    expect(
      screen.getByText(/¿Eliminar las 2 solicitudes y dejar la base limpia\?/),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText(
        "Confirmar el vaciado de todas las solicitudes",
      ),
    );

    await waitFor(() => expect(purgeHelpRequests).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(
        "Se eliminaron 2 solicitudes; la base quedó vacía.",
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        "No hay solicitudes en la base: todo está limpio.",
      ),
    ).toBeTruthy();
  });

  it("cancelar la confirmación no borra nada", async () => {
    const { dataSource, deleteHelpRequest } = sectionDataSource();
    render(<HelpRequestsAdminSection dataSource={dataSource} />);

    fireEvent.press(
      await screen.findByLabelText(
        "Eliminar la solicitud HR-2026-AAAA1111",
      ),
    );
    fireEvent.press(screen.getByText("CANCELAR"));
    expect(deleteHelpRequest).not.toHaveBeenCalled();
    expect(screen.getByText("HR-2026-AAAA1111")).toBeTruthy();
  });

  it("degrada con error y reintento", async () => {
    const listHelpRequests = jest
      .fn()
      .mockRejectedValueOnce(new Error("Servicio no disponible"))
      .mockResolvedValue({
        items: [],
        total: 0,
        generatedAt: "2026-08-17T12:00:00Z",
      });
    const dataSource = {
      listHelpRequests,
    } as unknown as AdminDataSource;
    render(<HelpRequestsAdminSection dataSource={dataSource} />);

    expect(
      await screen.findByText("Solicitudes no disponibles"),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("REINTENTAR"));
    expect(
      await screen.findByText(
        "No hay solicitudes en la base: todo está limpio.",
      ),
    ).toBeTruthy();
  });
});
