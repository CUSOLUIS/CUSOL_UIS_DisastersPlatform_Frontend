// CHG-163 — El contrato viaja siempre en horas: los días se convierten
// al armar el payload; las coordenadas son opcionales (regla CHG-127)
// y el radio de aviso solo viaja con punto (regla CHG-131).

import {
  buildFoodOfferPayload,
  resolveDraftCoordinates,
} from "./reportSubmission";
import type { FoodOfferDraft } from "./types";

const draft: FoodOfferDraft = {
  description: "Sancocho comunitario para cuarenta personas al mediodía.",
  address: "Salón comunal La Cumbre, Floridablanca",
  latitude: "7.07120",
  longitude: "-73.08550",
  durationValue: "6",
  durationUnit: "hours",
  notificationRadiusKm: "5",
  truthConfirmed: true,
};

describe("buildFoodOfferPayload (CHG-163)", () => {
  it("en horas envía el valor tal cual", () => {
    expect(buildFoodOfferPayload(draft).durationHours).toBe(6);
  });

  it("en días convierte a horas (2 días = 48 horas)", () => {
    expect(
      buildFoodOfferPayload({
        ...draft,
        durationValue: "2",
        durationUnit: "days",
      }).durationHours,
    ).toBe(48);
  });

  it("30 días llegan al tope del contrato (720 horas)", () => {
    expect(
      buildFoodOfferPayload({
        ...draft,
        durationValue: "30",
        durationUnit: "days",
      }).durationHours,
    ).toBe(720);
  });

  it("sin coordenadas el payload no las incluye", () => {
    const payload = buildFoodOfferPayload({
      ...draft,
      latitude: "",
      longitude: "",
    });
    expect(payload.latitude).toBeUndefined();
    expect(payload.longitude).toBeUndefined();
  });

  it("incluye el radio de aviso solo cuando hay coordenadas", () => {
    expect(buildFoodOfferPayload(draft).notificationRadiusKm).toBe(5);
    expect(
      buildFoodOfferPayload({ ...draft, latitude: "", longitude: "" })
        .notificationRadiusKm,
    ).toBeUndefined();
    expect(
      buildFoodOfferPayload({ ...draft, notificationRadiusKm: "" })
        .notificationRadiusKm,
    ).toBeUndefined();
  });
});

// Patrón CHG-132 — A nadie se le piden latitudes: si la persona
// escribió solo la dirección, las coordenadas se resuelven solas al
// publicar; si el geocodificador falla, la oferta viaja igual.
describe("resolveDraftCoordinates (CHG-163)", () => {
  const addressOnly: FoodOfferDraft = {
    ...draft,
    latitude: "",
    longitude: "",
  };

  it("resuelve las coordenadas desde la dirección escrita", async () => {
    const geocode = jest.fn().mockResolvedValue([
      { label: "Salón comunal", latitude: 7.07123, longitude: -73.08551 },
    ]);
    const resolved = await resolveDraftCoordinates(addressOnly, geocode);
    expect(geocode).toHaveBeenCalledWith(
      "Salón comunal La Cumbre, Floridablanca, Colombia",
    );
    expect(resolved.latitude).toBe("7.07123");
    expect(resolved.longitude).toBe("-73.08551");
    // Con coordenadas resueltas, el radio de aviso sí viaja.
    expect(buildFoodOfferPayload(resolved).notificationRadiusKm).toBe(5);
    expect(resolved.address).toBe(addressOnly.address);
  });

  it("con punto ya fijado no geocodifica nada", async () => {
    const geocode = jest.fn();
    const resolved = await resolveDraftCoordinates(draft, geocode);
    expect(resolved).toBe(draft);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("si el geocodificador falla o no encuentra, la oferta sigue igual", async () => {
    const failing = jest.fn().mockRejectedValue(new Error("sin red"));
    await expect(
      resolveDraftCoordinates(addressOnly, failing),
    ).resolves.toBe(addressOnly);

    const empty = jest.fn().mockResolvedValue([]);
    await expect(
      resolveDraftCoordinates(addressOnly, empty),
    ).resolves.toBe(addressOnly);
  });
});
