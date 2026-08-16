/**
 * CHG-115 — La edad se deriva de la fecha de nacimiento. El caso que
 * originó el cambio: `2004-11-23` capturado junto a `Edad aproximada
 * 12`, dos campos sueltos contradiciéndose en el expediente.
 */

import { ageFromBirthDate } from "./ageFromBirthDate";

describe("Edad a partir de la fecha de nacimiento", () => {
  it("cuenta el día, no solo el año", () => {
    const hoy = new Date(2026, 7, 16); // 16 de agosto de 2026

    expect(ageFromBirthDate("2004-11-23", hoy)).toBe(21);
  });

  it("no cumple años hasta que llega el día", () => {
    expect(ageFromBirthDate("2004-11-23", new Date(2026, 10, 22))).toBe(21);
    expect(ageFromBirthDate("2004-11-23", new Date(2026, 10, 23))).toBe(22);
  });

  it("resuelve el 29 de febrero en años sin ese día", () => {
    expect(ageFromBirthDate("2004-02-29", new Date(2026, 1, 28))).toBe(21);
    expect(ageFromBirthDate("2004-02-29", new Date(2026, 2, 1))).toBe(22);
  });

  it("cuenta cero el mismo día del nacimiento", () => {
    expect(ageFromBirthDate("2026-08-16", new Date(2026, 7, 16))).toBe(0);
  });

  it("descarta lo que no es una fecha utilizable", () => {
    expect(ageFromBirthDate("", new Date(2026, 7, 16))).toBeNull();
    expect(ageFromBirthDate("23-11-2004", new Date(2026, 7, 16))).toBeNull();
    // Día inexistente: el calendario no lo ofrece, un borrador sí.
    expect(ageFromBirthDate("2005-02-29", new Date(2026, 7, 16))).toBeNull();
    // Futura.
    expect(ageFromBirthDate("2026-08-17", new Date(2026, 7, 16))).toBeNull();
  });
});
