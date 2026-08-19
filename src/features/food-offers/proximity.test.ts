// CHG-163 — Proximidad de las ofertas de comida (patrón CHG-131): la
// oferta define su radio; el dispositivo dentro del radio recibe el
// aviso. Sin posición o sin radio no hay nada que medir.

import { nearbyFoodOffers } from "./proximity";
import type { ActiveFoodOffer } from "./types";

// Posición de referencia: Bucaramanga (Parque Santander).
const bucaramanga = { latitude: 7.11935, longitude: -73.12274 };

function offer(overrides: Partial<ActiveFoodOffer>): ActiveFoodOffer {
  return {
    id: "d4000000-0000-4000-8000-000000000001",
    description: "Arroz con pollo para compartir hoy.",
    address: "Carrera 27 # 30-15, Bucaramanga",
    latitude: 7.12,
    longitude: -73.12,
    notificationRadiusKm: 5,
    createdAt: "2026-08-19T10:00:00Z",
    expiresAt: "2026-08-19T16:00:00Z",
    ...overrides,
  };
}

describe("nearbyFoodOffers (CHG-163)", () => {
  it("incluye la oferta cuando el dispositivo está dentro de SU radio", () => {
    // Floridablanca está a ~6 km de Bucaramanga: con radio 10 avisa.
    const florida = offer({
      latitude: 7.0703,
      longitude: -73.0862,
      notificationRadiusKm: 10,
    });
    const nearby = nearbyFoodOffers([florida], bucaramanga);
    expect(nearby).toHaveLength(1);
    expect(nearby[0].distanceKm).toBeGreaterThan(3);
    expect(nearby[0].distanceKm).toBeLessThan(10);
  });

  it("excluye la oferta cuando el dispositivo queda fuera del radio", () => {
    const florida = offer({
      latitude: 7.0703,
      longitude: -73.0862,
      notificationRadiusKm: 2,
    });
    expect(nearbyFoodOffers([florida], bucaramanga)).toHaveLength(0);
  });

  it("ignora ofertas sin coordenadas o sin radio y ordena por cercanía", () => {
    const cercana = offer({ id: "d4000000-0000-4000-8000-000000000002" });
    const lejana = offer({
      id: "d4000000-0000-4000-8000-000000000003",
      latitude: 7.0703,
      longitude: -73.0862,
      notificationRadiusKm: 50,
    });
    const sinPunto = offer({
      id: "d4000000-0000-4000-8000-000000000004",
      latitude: null,
      longitude: null,
      notificationRadiusKm: null,
    });
    const sinRadio = offer({
      id: "d4000000-0000-4000-8000-000000000005",
      notificationRadiusKm: null,
    });
    const nearby = nearbyFoodOffers(
      [lejana, sinPunto, sinRadio, cercana],
      bucaramanga,
    );
    expect(nearby.map((entry) => entry.offer.id)).toEqual([
      cercana.id,
      lejana.id,
    ]);
  });

  it("sin posición del dispositivo no avisa nada", () => {
    expect(nearbyFoodOffers([offer({})], null)).toEqual([]);
  });
});
