import { formatCountdown, isExpired } from "./countdown";

describe("formatCountdown (CHG-125)", () => {
  const now = new Date("2026-08-16T12:00:00Z");

  it("muestra días y horas cuando falta más de un día", () => {
    expect(formatCountdown("2026-08-18T15:30:00Z", now)).toBe(
      "EXPIRA EN 2 D 3 H",
    );
  });

  it("muestra horas y minutos con relleno de dos dígitos", () => {
    expect(formatCountdown("2026-08-16T14:05:00Z", now)).toBe(
      "EXPIRA EN 2 H 05 MIN",
    );
  });

  it("muestra solo minutos por debajo de una hora", () => {
    expect(formatCountdown("2026-08-16T12:38:00Z", now)).toBe(
      "EXPIRA EN 38 MIN",
    );
  });

  it("avisa cuando queda menos de un minuto", () => {
    expect(formatCountdown("2026-08-16T12:00:40Z", now)).toBe(
      "EXPIRA EN MENOS DE 1 MIN",
    );
  });

  it("marca como expirada una vigencia vencida o ilegible", () => {
    expect(formatCountdown("2026-08-16T11:59:59Z", now)).toBe("EXPIRADA");
    expect(formatCountdown("no-es-una-fecha", now)).toBe("EXPIRADA");
  });

  it("isExpired concuerda con el texto", () => {
    expect(isExpired("2026-08-16T11:00:00Z", now)).toBe(true);
    expect(isExpired("2026-08-16T13:00:00Z", now)).toBe(false);
  });
});
