// CHG-163 — El banner de proximidad avisa en la app instalada cuando
// este dispositivo cae dentro del radio de una oferta de comida activa
// (patrón CHG-131).

import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { FoodOfferProximityAlert } from "./FoodOfferProximityAlert";
import type { ActiveFoodOffer } from "./types";

afterEach(cleanup);

const offer: ActiveFoodOffer = {
  id: "e5000000-0000-4000-8000-000000000001",
  description: "Sancocho comunitario para cuarenta personas al mediodía.",
  address: "Salón comunal La Cumbre, Floridablanca",
  latitude: 7.1193,
  longitude: -73.1227,
  notificationRadiusKm: 10,
  createdAt: "2026-08-19T10:00:00Z",
  expiresAt: "2026-08-19T16:00:00Z",
};

const nearLocation = { latitude: 7.12, longitude: -73.12 };

describe("FoodOfferProximityAlert (CHG-163)", () => {
  it("avisa en la app instalada dentro del radio y se descarta", () => {
    render(
      <FoodOfferProximityAlert
        items={[offer]}
        platformOs="android"
        location={nearLocation}
      />,
    );

    expect(screen.getByTestId("food-offer-proximity-alert")).toBeTruthy();
    expect(
      screen.getByText(/COMIDA COMUNITARIA · A MENOS DE 1 KM/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Sancocho comunitario para cuarenta personas al mediodía.",
      ),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", {
        name: "Descartar el aviso de comida cercana",
      }),
    );
    expect(screen.queryByTestId("food-offer-proximity-alert")).toBeNull();
  });

  it("no aparece fuera del radio ni sin posición conocida", () => {
    render(
      <FoodOfferProximityAlert
        items={[offer]}
        platformOs="android"
        location={{ latitude: 4.711, longitude: -74.0721 }}
      />,
    );
    expect(screen.queryByTestId("food-offer-proximity-alert")).toBeNull();

    render(
      <FoodOfferProximityAlert
        items={[offer]}
        platformOs="android"
        location={null}
      />,
    );
    expect(screen.queryByTestId("food-offer-proximity-alert")).toBeNull();
  });

  it("en la web no promete avisos (regla CHG-067)", () => {
    render(
      <FoodOfferProximityAlert
        items={[offer]}
        platformOs="web"
        location={nearLocation}
      />,
    );
    expect(screen.queryByTestId("food-offer-proximity-alert")).toBeNull();
  });
});
