// CHG-131 — El banner de proximidad avisa en la app instalada cuando
// este dispositivo cae dentro del radio de una solicitud activa.

import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { HelpRequestProximityAlert } from "./HelpRequestProximityAlert";
import type { ActiveHelpRequest } from "./types";

afterEach(cleanup);

const request: ActiveHelpRequest = {
  id: "a1000000-0000-4000-8000-000000000001",
  description: "Se necesita agua potable y cobijas para tres familias.",
  address: "Vereda El Salado, Piedecuesta",
  latitude: 7.1193,
  longitude: -73.1227,
  notificationRadiusKm: 10,
  createdAt: "2026-08-17T10:00:00Z",
  expiresAt: "2026-08-18T10:00:00Z",
  attendersCount: 0,
  attendedByMe: false,
  photoUrl: null,
};

const nearLocation = { latitude: 7.12, longitude: -73.12 };

describe("HelpRequestProximityAlert (CHG-131)", () => {
  it("avisa en la app instalada dentro del radio y se descarta", () => {
    render(
      <HelpRequestProximityAlert
        items={[request]}
        platformOs="android"
        location={nearLocation}
      />,
    );

    expect(screen.getByTestId("help-request-proximity-alert")).toBeTruthy();
    expect(screen.getByText(/NECESITAN AYUDA · A MENOS DE 1 KM/)).toBeTruthy();
    expect(
      screen.getByText("Se necesita agua potable y cobijas para tres familias."),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", {
        name: "Descartar el aviso de ayuda cercana",
      }),
    );
    expect(screen.queryByTestId("help-request-proximity-alert")).toBeNull();
  });

  it("no aparece fuera del radio ni sin posición conocida", () => {
    render(
      <HelpRequestProximityAlert
        items={[request]}
        platformOs="android"
        location={{ latitude: 4.711, longitude: -74.0721 }}
      />,
    );
    expect(screen.queryByTestId("help-request-proximity-alert")).toBeNull();

    render(
      <HelpRequestProximityAlert
        items={[request]}
        platformOs="android"
        location={null}
      />,
    );
    expect(screen.queryByTestId("help-request-proximity-alert")).toBeNull();
  });

  it("en la web no promete avisos (regla CHG-067)", () => {
    render(
      <HelpRequestProximityAlert
        items={[request]}
        platformOs="web"
        location={nearLocation}
      />,
    );
    expect(screen.queryByTestId("help-request-proximity-alert")).toBeNull();
  });
});
