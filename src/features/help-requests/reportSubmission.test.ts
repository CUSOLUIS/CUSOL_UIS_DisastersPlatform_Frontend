// CHG-130 — El contrato viaja siempre en horas: los días se convierten
// al armar el payload; las coordenadas siguen siendo opcionales
// (CHG-127) y la instantánea del reportante solo viaja si existe.

import { buildHelpRequestPayload } from "./reportSubmission";
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
