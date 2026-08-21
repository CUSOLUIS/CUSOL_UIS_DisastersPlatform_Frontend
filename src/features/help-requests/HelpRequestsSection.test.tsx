import {
  act,
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
    notificationRadiusKm: null,
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
    notificationRadiusKm: null,
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

    // CHG-193: primero el aviso de qué se comparte; nada se registra
    // hasta confirmarlo.
    expect(attend).not.toHaveBeenCalled();
    expect(
      screen.getByTestId(`help-request-consent-${requests[0].id}`),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByRole("button", {
        name: "Confirmar que atiendes la solicitud en Vereda El Salado, Piedecuesta",
      }),
    );

    await waitFor(() =>
      expect(attend).toHaveBeenCalledWith(requests[0].id, true),
    );
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

// CHG-191 — Decidir si puedes acudir depende de qué tan lejos queda.
it("dice a qué distancia está cada solicitud cuando conoce la posición de quien mira", () => {
  render(
    <HelpRequestsSection
      items={requests}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      viewerLocation={{ latitude: 6.9971, longitude: -73.0498 }}
    />,
  );

  // 0,011° de latitud ≈ 1,1 km de la primera solicitud.
  expect(screen.getByText("A 1,1 KM DE TI")).toBeTruthy();
  expect(
    screen.getByTestId("help-request-distance-a1000000-0000-4000-8000-000000000002"),
  ).toBeTruthy();
});

it("no habla de distancia si no hay posición de quien mira", () => {
  render(
    <HelpRequestsSection
      items={requests}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
    />,
  );

  expect(screen.queryByText(/DE TI$/)).toBeNull();
  // La tarjeta sigue entera: dirección y acción intactas.
  expect(screen.getByText("Vereda El Salado, Piedecuesta")).toBeTruthy();
});

it("no inventa distancia para una solicitud que llegó solo con dirección", () => {
  render(
    <HelpRequestsSection
      items={[{ ...requests[0], latitude: null, longitude: null }]}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      viewerLocation={{ latitude: 6.9971, longitude: -73.0498 }}
    />,
  );

  expect(screen.queryByText(/DE TI$/)).toBeNull();
});

// CHG-193 — Para quien pidió ayuda, el dato que importa es cuánta gente
// viene, y poder mirar quién.
it("con solicitud propia la píldora cuenta quién atiende y ofrece VER MÁS", () => {
  const propia = { ...requests[0], createdByMe: true, attendersCount: 3 };
  const onOpenAttenders = jest.fn();
  render(
    <HelpRequestsSection
      items={[requests[1]]}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      ownRequests={[propia]}
      onOpenAttenders={onOpenAttenders}
    />,
  );

  expect(screen.getByText("3 PERSONAS ATIENDEN TU SOLICITUD")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("button", { name: "Ver quién atiende tu solicitud" }),
  );
  expect(onOpenAttenders).toHaveBeenCalledWith(propia);
});

it("sin solicitud propia la píldora sigue contando vigentes y no hay VER MÁS", () => {
  render(
    <HelpRequestsSection
      items={requests}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      onOpenAttenders={jest.fn()}
    />,
  );

  expect(screen.getByText("2 VIGENTES")).toBeTruthy();
  expect(screen.queryByTestId("help-request-own-see-more")).toBeNull();
});

it("cuando nadie atiende todavía, la píldora lo dice con todas las letras", () => {
  render(
    <HelpRequestsSection
      items={[]}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      ownRequests={[{ ...requests[0], createdByMe: true, attendersCount: 0 }]}
      onOpenAttenders={jest.fn()}
    />,
  );

  expect(screen.getByText("NADIE ATIENDE TU SOLICITUD AÚN")).toBeTruthy();
});


// CHG-196 — La dueña puede retirar su solicitud cuando la ayuda llegó.
// Va en dos pasos porque no se puede deshacer.
it("la dueña elimina su solicitud, pero solo tras confirmarlo", async () => {
  const propia = { ...requests[0], createdByMe: true, attendersCount: 3 };
  const onDeleteOwn = jest.fn().mockResolvedValue(undefined);
  render(
    <HelpRequestsSection
      items={[requests[1]]}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      ownRequests={[propia]}
      onDeleteOwn={onDeleteOwn}
    />,
  );

  // Primer toque: advierte, no borra.
  fireEvent.press(screen.getByTestId("help-request-own-delete"));
  expect(onDeleteOwn).not.toHaveBeenCalled();
  expect(screen.getByText(/No se puede deshacer/)).toBeTruthy();
  expect(screen.getByText(/quienes la estaban atendiendo/)).toBeTruthy();

  // Arrepentirse deja todo como estaba.
  fireEvent.press(screen.getByRole("button", { name: "Conservar mi solicitud" }));
  expect(onDeleteOwn).not.toHaveBeenCalled();

  // Segundo toque + confirmación: ahora sí.
  fireEvent.press(screen.getByTestId("help-request-own-delete"));
  await act(async () => {
    fireEvent.press(screen.getByTestId("help-request-own-delete-confirm"));
  });
  expect(onDeleteOwn).toHaveBeenCalledWith(propia.id);
});

it("si el borrado falla, lo dice y la solicitud sigue ahí", async () => {
  const propia = { ...requests[0], createdByMe: true };
  const onDeleteOwn = jest
    .fn()
    .mockRejectedValue(new Error("La solicitud no existe o no es tuya."));
  render(
    <HelpRequestsSection
      items={[requests[1]]}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      ownRequests={[propia]}
      onDeleteOwn={onDeleteOwn}
    />,
  );

  fireEvent.press(screen.getByTestId("help-request-own-delete"));
  await act(async () => {
    fireEvent.press(screen.getByTestId("help-request-own-delete-confirm"));
  });

  expect(screen.getByText("La solicitud no existe o no es tuya.")).toBeTruthy();
  expect(screen.getByTestId("help-request-own-delete")).toBeTruthy();
});

it("quien no tiene solicitud propia no ve ELIMINAR", () => {
  render(
    <HelpRequestsSection
      items={requests}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      onDeleteOwn={jest.fn()}
    />,
  );

  expect(screen.queryByTestId("help-request-own-delete")).toBeNull();
});

// CHG-198 — Quien ya aceptó atender necesita la ficha completa: va a
// acudir, no solo a mirar.
it("la solicitud que ya atiendes ofrece VER MÁS hacia su ficha", () => {
  const onOpenDetail = jest.fn();
  // En el juego de prueba, la segunda ya está atendida y la primera no.
  const atendida = requests[1];
  const sinAtender = requests[0];
  render(
    <HelpRequestsSection
      items={requests}
      loading={false}
      errorMessage={null}
      isAuthenticated
      attend={jest.fn()}
      onAttended={jest.fn()}
      onOpenDetail={onOpenDetail}
    />,
  );

  expect(screen.getByText("✓ ESTÁS ATENDIENDO ESTA SOLICITUD")).toBeTruthy();
  fireEvent.press(screen.getByTestId(`help-request-detail-${atendida.id}`));
  expect(onOpenDetail).toHaveBeenCalledWith(atendida);

  // La que todavía no atiende sigue como estaba: sin ficha, con acción.
  expect(
    screen.queryByTestId(`help-request-detail-${sinAtender.id}`),
  ).toBeNull();
});
