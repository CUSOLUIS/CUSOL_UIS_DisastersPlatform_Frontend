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
        screen.getByRole("button", { name: "Atender esta solicitud" }),
      );
    });

    expect(attend).toHaveBeenCalledWith(request.id);
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
