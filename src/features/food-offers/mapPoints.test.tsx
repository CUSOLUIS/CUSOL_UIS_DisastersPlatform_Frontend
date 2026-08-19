import { cleanup, render, screen } from "@testing-library/react-native";
import { FallbackMapCanvas } from "../operational-map/FallbackMapCanvas";
import { normalizeOperationalMapOverview } from "../operational-map/dataSource";
import { operationalMapDemoData } from "../operational-map/demoData";
import {
  foodOfferIdFromPointId,
  foodOffersToMapPoints,
} from "./mapPoints";
import type { ActiveFoodOffer } from "./types";

afterEach(cleanup);

const offer: ActiveFoodOffer = {
  id: "c3000000-0000-4000-8000-000000000001",
  description: "Sancocho comunitario para cuarenta personas al mediodía.",
  address: "Salón comunal La Cumbre, Floridablanca",
  latitude: 7.0712,
  longitude: -73.0855,
  notificationRadiusKm: null,
  createdAt: "2026-08-19T10:00:00Z",
  expiresAt: "2026-08-19T16:00:00Z",
};

describe("foodOffersToMapPoints (CHG-163)", () => {
  it("convierte la oferta en un punto community_meal con datos públicos", () => {
    const [point] = foodOffersToMapPoints([offer]);
    expect(point.category).toBe("community_meal");
    expect(point.id).toBe(`food_offer:${offer.id}`);
    expect(point.locationLabel).toBe(offer.address);
    expect(point.description).toBe(offer.description);
    expect(foodOfferIdFromPointId(point.id)).toBe(offer.id);
    expect(foodOfferIdFromPointId("otro-punto")).toBeNull();
  });

  // Patrón CHG-134: el radio de aviso llega al punto del mapa para
  // dibujarse a escala.
  it("proyecta el radio de aviso cuando la oferta lo define", () => {
    const [withRadius] = foodOffersToMapPoints([
      { ...offer, notificationRadiusKm: 8 },
    ]);
    expect(withRadius.alertRadiusKm).toBe(8);
    const [withoutRadius] = foodOffersToMapPoints([offer]);
    expect(withoutRadius.alertRadiusKm).toBeUndefined();
  });

  // Regla DEC-127-02: sin par de coordenadas no hay marcador; la
  // oferta sigue viva en Mi espacio.
  it("omite del mapa las ofertas que llegaron solo con dirección", () => {
    const addressOnly: ActiveFoodOffer = {
      ...offer,
      id: "c3000000-0000-4000-8000-000000000002",
      latitude: null,
      longitude: null,
    };
    const points = foodOffersToMapPoints([offer, addressOnly]);
    expect(points).toHaveLength(1);
    expect(points[0].id).toBe(`food_offer:${offer.id}`);
  });

  it("el resumen normalizado suma la oferta a la categoría community_meal", () => {
    const base = normalizeOperationalMapOverview(
      operationalMapDemoData,
    ).summary.communityMeal;
    const merged = normalizeOperationalMapOverview({
      ...operationalMapDemoData,
      items: [
        ...operationalMapDemoData.items,
        ...foodOffersToMapPoints([offer]),
      ],
    });
    expect(merged.summary.communityMeal).toBe(base + 1);
  });

  it("el lienzo dibuja el marcador de la oferta", () => {
    const [point] = foodOffersToMapPoints([offer]);
    render(
      <FallbackMapCanvas
        points={[point]}
        selectedId={null}
        onSelect={() => undefined}
        compact={false}
      />,
    );

    expect(screen.getByTestId(`map-marker-${point.id}`)).toBeTruthy();
  });
});
