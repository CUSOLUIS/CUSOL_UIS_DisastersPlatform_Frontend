// CHG-131 — Distancias y filtro de proximidad de las solicitudes.

import { distanceKm, nearbyHelpRequests } from "./proximity";
import type { ActiveHelpRequest } from "./types";

function request(overrides: Partial<ActiveHelpRequest>): ActiveHelpRequest {
  return {
    id: "a1000000-0000-4000-8000-000000000001",
    description: "Se necesita agua potable y cobijas.",
    address: "Vereda El Salado, Piedecuesta",
    latitude: 7.1193,
    longitude: -73.1227,
    notificationRadiusKm: 10,
    createdAt: "2026-08-17T10:00:00Z",
    expiresAt: "2026-08-18T10:00:00Z",
    attendersCount: 0,
    attendedByMe: false,
    photoUrl: null,
    ...overrides,
  };
}

describe("distanceKm (CHG-131)", () => {
  it("mide distancias reales (Bucaramanga ↔ Floridablanca ≈ 7-9 km)", () => {
    const bucaramanga = { latitude: 7.1193, longitude: -73.1227 };
    const floridablanca = { latitude: 7.0621, longitude: -73.0864 };
    const d = distanceKm(bucaramanga, floridablanca);
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(10);
  });

  it("la distancia a sí mismo es cero", () => {
    const point = { latitude: 7.1193, longitude: -73.1227 };
    expect(distanceKm(point, point)).toBe(0);
  });
});

describe("nearbyHelpRequests (CHG-131)", () => {
  const nearLocation = { latitude: 7.12, longitude: -73.12 };

  it("incluye la solicitud cuando la posición cae dentro de SU radio", () => {
    const nearby = nearbyHelpRequests([request({})], nearLocation);
    expect(nearby).toHaveLength(1);
    expect(nearby[0].distanceKm).toBeLessThan(1);
  });

  it("excluye la solicitud cuando la posición queda fuera del radio", () => {
    const bogota = { latitude: 4.711, longitude: -74.0721 };
    expect(nearbyHelpRequests([request({})], bogota)).toHaveLength(0);
  });

  it("ignora solicitudes sin radio o sin coordenadas y sin posición propia", () => {
    expect(
      nearbyHelpRequests(
        [request({ notificationRadiusKm: null })],
        nearLocation,
      ),
    ).toHaveLength(0);
    expect(
      nearbyHelpRequests(
        [request({ latitude: null, longitude: null })],
        nearLocation,
      ),
    ).toHaveLength(0);
    expect(nearbyHelpRequests([request({})], null)).toHaveLength(0);
  });

  it("ordena de la más cercana a la más lejana", () => {
    const cercana = request({ id: "a1000000-0000-4000-8000-000000000002" });
    const lejana = request({
      id: "a1000000-0000-4000-8000-000000000003",
      latitude: 7.0621,
      longitude: -73.0864,
      notificationRadiusKm: 100,
    });
    const nearby = nearbyHelpRequests([lejana, cercana], nearLocation);
    expect(nearby.map((entry) => entry.request.id)).toEqual([
      cercana.id,
      lejana.id,
    ]);
  });
});
