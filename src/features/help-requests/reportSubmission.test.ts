// CHG-130 — El contrato viaja siempre en horas: los días se convierten
// al armar el payload; las coordenadas siguen siendo opcionales
// (CHG-127) y la instantánea del reportante solo viaja si existe.

import {
  buildHelpRequestPayload,
  resolveDraftCoordinates,
} from "./reportSubmission";
import type { HelpRequestDraft } from "./types";

const draft: HelpRequestDraft = {
  description: "Una familia quedó aislada y necesita agua y cobijas.",
  address: "Vereda El Salado, Piedecuesta",
  latitude: "6.98710",
  longitude: "-73.04980",
  durationValue: "12",
  durationUnit: "hours",
  notificationRadiusKm: "5",
  truthConfirmed: true,
};

describe("buildHelpRequestPayload (CHG-130)", () => {
  it("en horas envía el valor tal cual", () => {
    expect(buildHelpRequestPayload(draft).durationHours).toBe(12);
  });

  it("en días convierte a horas (2 días = 48 horas)", () => {
    expect(
      buildHelpRequestPayload({
        ...draft,
        durationValue: "2",
        durationUnit: "days",
      }).durationHours,
    ).toBe(48);
  });

  it("30 días llegan al tope del contrato (720 horas)", () => {
    expect(
      buildHelpRequestPayload({
        ...draft,
        durationValue: "30",
        durationUnit: "days",
      }).durationHours,
    ).toBe(720);
  });

  it("sin coordenadas el payload no las incluye (CHG-127)", () => {
    const payload = buildHelpRequestPayload({
      ...draft,
      latitude: "",
      longitude: "",
    });
    expect(payload.latitude).toBeUndefined();
    expect(payload.longitude).toBeUndefined();
  });

  // CHG-131: el radio viaja solo con coordenadas; sin punto se omite
  // (el backend lo rechazaría) y vacío significa sin aviso.
  it("incluye el radio de aviso solo cuando hay coordenadas", () => {
    expect(buildHelpRequestPayload(draft).notificationRadiusKm).toBe(5);
    expect(
      buildHelpRequestPayload({ ...draft, latitude: "", longitude: "" })
        .notificationRadiusKm,
    ).toBeUndefined();
    expect(
      buildHelpRequestPayload({ ...draft, notificationRadiusKm: "" })
        .notificationRadiusKm,
    ).toBeUndefined();
  });
});

// CHG-132 — A nadie se le piden latitudes: si la persona escribió solo
// la dirección, las coordenadas se resuelven solas desde ese texto al
// publicar; si el geocodificador falla, la solicitud viaja igual.
describe("resolveDraftCoordinates (CHG-132)", () => {
  const addressOnly: HelpRequestDraft = {
    ...draft,
    latitude: "",
    longitude: "",
  };

  it("resuelve las coordenadas desde la dirección escrita", async () => {
    const geocode = jest.fn().mockResolvedValue([
      { label: "Vereda El Salado", latitude: 6.98712, longitude: -73.04985 },
    ]);
    const resolved = await resolveDraftCoordinates(addressOnly, geocode);
    expect(geocode).toHaveBeenCalledWith(
      "Vereda El Salado, Piedecuesta, Colombia",
    );
    expect(resolved.latitude).toBe("6.98712");
    expect(resolved.longitude).toBe("-73.04985");
    // Con coordenadas resueltas, el radio de aviso sí viaja.
    expect(buildHelpRequestPayload(resolved).notificationRadiusKm).toBe(5);
    // La dirección sigue siendo el texto que escribió la persona.
    expect(resolved.address).toBe(addressOnly.address);
  });

  it("con punto ya fijado no geocodifica nada", async () => {
    const geocode = jest.fn();
    const resolved = await resolveDraftCoordinates(draft, geocode);
    expect(resolved).toBe(draft);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("si el geocodificador falla o no encuentra, la solicitud sigue igual", async () => {
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
