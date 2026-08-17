import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { HelpRequestsSection } from "./HelpRequestsSection";
import type { ActiveHelpRequest } from "./types";

afterEach(cleanup);

function futureIso(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const requests: ActiveHelpRequest[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    description: "Se necesita agua potable y cobijas para tres familias.",
    address: "Vereda El Salado, Piedecuesta",
    latitude: 6.9871,
    longitude: -73.0498,
    createdAt: "2026-08-16T10:00:00Z",
    expiresAt: futureIso(6),
    attendersCount: 2,
    attendedByMe: false,
    photoUrl: null,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    description: "Hacen falta manos para remover escombros livianos.",
    address: "Barrio La Cumbre, Floridablanca",
    latitude: 7.0703,
    longitude: -73.0862,
    createdAt: "2026-08-16T09:00:00Z",
    expiresAt: futureIso(24),
    attendersCount: 1,
    attendedByMe: true,
    photoUrl: null,
  },
];

const noop = () => undefined;

describe("HelpRequestsSection (CHG-125)", () => {
  it("muestra las solicitudes con contador, dirección y personas atendiendo", () => {
    render(
      <HelpRequestsSection
        items={requests}
        loading={false}
        errorMessage={null}
        isAuthenticated={false}
        attend={jest.fn()}
        onAttended={noop}
      />,
    );

    expect(screen.getByText("Vereda El Salado, Piedecuesta")).toBeTruthy();
    expect(screen.getByText("2 PERSONAS ATENDIENDO")).toBeTruthy();
    expect(screen.getByText("1 PERSONA ATENDIENDO")).toBeTruthy();
    expect(screen.getAllByText(/EXPIRA EN/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("2 VIGENTES")).toBeTruthy();
  });

  it("sin sesión invita a entrar y no ofrece el botón de atender", () => {
    render(
      <HelpRequestsSection
        items={requests}
        loading={false}
        errorMessage={null}
        isAuthenticated={false}
        attend={jest.fn()}
        onAttended={noop}
        onLogin={noop}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Atender solicitud en/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Iniciar sesión para atender solicitudes",
      }),
    ).toBeTruthy();
  });

  it("con sesión permite atender y refresca al confirmar", async () => {
    const attend = jest.fn().mockResolvedValue({
      id: requests[0].id,
      attendersCount: 3,
      attending: true,
    });
    const onAttended = jest.fn();
    render(
      <HelpRequestsSection
        items={requests}
        loading={false}
        errorMessage={null}
        isAuthenticated
        attend={attend}
        onAttended={onAttended}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: "Atender solicitud en Vereda El Salado, Piedecuesta",
      }),
    );

    await waitFor(() => expect(attend).toHaveBeenCalledWith(requests[0].id));
    await waitFor(() => expect(onAttended).toHaveBeenCalledTimes(1));
    // La solicitud ya atendida por la cuenta no repite el botón.
    expect(screen.getByText("✓ ESTÁS ATENDIENDO ESTA SOLICITUD")).toBeTruthy();
  });

  it("sin solicitudes vigentes lo dice en claro", () => {
    render(
      <HelpRequestsSection
        items={[]}
        loading={false}
        errorMessage={null}
        isAuthenticated={false}
        attend={jest.fn()}
        onAttended={noop}
      />,
    );
    expect(
      screen.getByText("No hay solicitudes de ayuda vigentes en este momento."),
    ).toBeTruthy();
  });
});
