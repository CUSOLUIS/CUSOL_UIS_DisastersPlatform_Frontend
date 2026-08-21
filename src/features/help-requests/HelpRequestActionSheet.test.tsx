import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { HelpRequestActionSheet } from "./HelpRequestActionSheet";
import type { ActiveHelpRequest } from "./types";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const request: ActiveHelpRequest = {
  id: "11111111-1111-4111-8111-111111111111",
  description: "Necesitamos ayuda para remover escombros en el sector norte.",
  address: "Calle 45 # 12-30, Bucaramanga",
  latitude: 7.12,
  longitude: -73.12,
  notificationRadiusKm: null,
  createdAt: "2026-08-18T10:00:00Z",
  expiresAt: "2026-08-19T10:00:00Z",
  attendersCount: 2,
  attendedByMe: false,
  photoUrl: null,
};

describe("HelpRequestActionSheet (CHG-148)", () => {
  it("con cuenta, «atender» aumenta el contador y confirma", async () => {
    const attend = jest.fn().mockResolvedValue({
      id: request.id,
      attendersCount: 3,
      attending: true,
    });
    const onAttended = jest.fn();

    render(
      <HelpRequestActionSheet
        request={request}
        visible
        onClose={jest.fn()}
        isAuthenticated
        attend={attend}
        onAttended={onAttended}
      />,
    );

    expect(screen.getByText("2 PERSONAS ATENDIENDO")).toBeTruthy();

    await act(async () => {
      fireEvent.press(
        screen.getByRole("button", {
          name: "Atender esta solicitud y compartir mi nombre",
        }),
      );
    });

    // CHG-193: atender lleva el aviso aceptado (nombre y teléfono).
    expect(attend).toHaveBeenCalledWith(request.id, true);
    expect(onAttended).toHaveBeenCalled();
    expect(screen.getByText("3 PERSONAS ATENDIENDO")).toBeTruthy();
    expect(
      screen.getByText(/Quedaste registrado como atendiendo/),
    ).toBeTruthy();
  });

  it("sin cuenta, el formulario de voluntario exige nombre y registra", async () => {
    const submitVolunteer = jest.fn().mockResolvedValue({
      id: request.id,
      attendersCount: 3,
      attending: true,
    });

    render(
      <HelpRequestActionSheet
        request={request}
        visible
        onClose={jest.fn()}
        isAuthenticated={false}
        attend={jest.fn()}
        submitVolunteer={submitVolunteer}
      />,
    );

    // Sin nombre no envía.
    await act(async () => {
      fireEvent.press(
        screen.getByRole("button", {
          name: "Enviar mis datos como voluntario",
        }),
      );
    });
    expect(submitVolunteer).not.toHaveBeenCalled();
    expect(screen.getByText(/Escribe tu nombre/)).toBeTruthy();

    // Con nombre, registra y confirma.
    fireEvent.changeText(
      screen.getByLabelText("Tu nombre *"),
      "María Restrepo",
    );
    await act(async () => {
      fireEvent.press(
        screen.getByRole("button", {
          name: "Enviar mis datos como voluntario",
        }),
      );
    });

    expect(submitVolunteer).toHaveBeenCalledWith(
      request.id,
      expect.objectContaining({ name: "María Restrepo" }),
      [],
    );
    expect(screen.getByText(/Quedaste en la lista de voluntarios/)).toBeTruthy();
    expect(screen.getByText("3 PERSONAS ATENDIENDO")).toBeTruthy();
  });
});

// CHG-194 — La solicitud propia no se atiende a sí misma (la regla de
// CHG-190, aplicada a la ventana que abre el mapa).
describe("HelpRequestActionSheet · solicitud propia (CHG-194)", () => {
  const propia: ActiveHelpRequest = { ...request, createdByMe: true };

  it("a quien la creó no le ofrece atender ni la ficha pública", () => {
    const attend = jest.fn();

    render(
      <HelpRequestActionSheet
        request={propia}
        visible
        onClose={jest.fn()}
        isAuthenticated
        attend={attend}
        onViewMore={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Atender esta solicitud y compartir mi nombre",
      }),
    ).toBeNull();
    // El aviso de CHG-193 solo tiene sentido si hay algo que atender.
    expect(screen.queryByText(/tu nombre y tu teléfono se comparten/i)).toBeNull();
    expect(screen.queryByTestId("action-sheet-view-more")).toBeNull();
    expect(attend).not.toHaveBeenCalled();
  });

  it("pero sigue mostrándole la información de su solicitud", () => {
    render(
      <HelpRequestActionSheet
        request={propia}
        visible
        onClose={jest.fn()}
        isAuthenticated
        attend={jest.fn()}
      />,
    );

    expect(screen.getByText(propia.address)).toBeTruthy();
    expect(screen.getByText(propia.description)).toBeTruthy();
    expect(screen.getByTestId("action-sheet-count")).toHaveTextContent(
      "2 PERSONAS ATENDIENDO",
    );
  });

  it("sin la marca (bundle viejo) se comporta como siempre", () => {
    render(
      <HelpRequestActionSheet
        request={request}
        visible
        onClose={jest.fn()}
        isAuthenticated
        attend={jest.fn()}
        onViewMore={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Atender esta solicitud y compartir mi nombre",
      }),
    ).toBeTruthy();
    expect(screen.getByTestId("action-sheet-view-more")).toBeTruthy();
  });

  // CHG-195 — El VER MÁS de la dueña no desaparece: cambia de destino.
  it("su «VER MÁS» abre quiénes la atienden, no la ficha pública", () => {
    const onViewMore = jest.fn();
    const onViewAttenders = jest.fn();

    render(
      <HelpRequestActionSheet
        request={propia}
        visible
        onClose={jest.fn()}
        isAuthenticated
        attend={jest.fn()}
        onViewMore={onViewMore}
        onViewAttenders={onViewAttenders}
      />,
    );

    // La ficha pública no se ofrece; el botón que hay es el suyo.
    expect(screen.queryByTestId("action-sheet-view-more")).toBeNull();
    const boton = screen.getByTestId("action-sheet-view-attenders");
    expect(boton).toHaveTextContent("VER MÁS");

    fireEvent.press(boton);
    expect(onViewAttenders).toHaveBeenCalled();
    expect(onViewMore).not.toHaveBeenCalled();

    // Y sigue sin poder atender su propia solicitud.
    expect(
      screen.queryByRole("button", {
        name: "Atender esta solicitud y compartir mi nombre",
      }),
    ).toBeNull();
  });
});

// CHG-197 — Quien ya atendió (desde «Mi espacio» o en una visita
// anterior) no vuelve a ver el botón al tocar el marcador en el mapa.
describe("HelpRequestActionSheet · ya atendida (CHG-197)", () => {
  const yaAtendida: ActiveHelpRequest = { ...request, attendedByMe: true };

  it("con la solicitud ya atendida no ofrece atenderla otra vez", () => {
    const attend = jest.fn();

    render(
      <HelpRequestActionSheet
        request={yaAtendida}
        visible
        onClose={jest.fn()}
        isAuthenticated
        attend={attend}
      />,
    );

    expect(
      screen.getByTestId("action-sheet-already-attending"),
    ).toHaveTextContent(/ESTÁS ATENDIENDO ESTA SOLICITUD/);
    expect(
      screen.queryByRole("button", {
        name: "Atender esta solicitud y compartir mi nombre",
      }),
    ).toBeNull();
    // El aviso de CHG-193 tampoco: ya se aceptó en su momento.
    expect(
      screen.queryByText(/tu nombre y tu teléfono se comparten/i),
    ).toBeNull();
    expect(attend).not.toHaveBeenCalled();
  });

  it("sin sesión la marca del servidor no manda: el voluntario sigue pudiendo ofrecerse", () => {
    render(
      <HelpRequestActionSheet
        request={yaAtendida}
        visible
        onClose={jest.fn()}
        isAuthenticated={false}
        attend={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("action-sheet-already-attending")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Enviar mis datos como voluntario" }),
    ).toBeTruthy();
  });
});
