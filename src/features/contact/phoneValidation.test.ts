/**
 * CHG-100 — El teléfono de contacto se valida contra E.164. El caso
 * que originó el cambio: 25 dígitos pasaban el límite de 40 del
 * backend y se guardaban como contacto inservible.
 */

import {
  PHONE_MAX_DIGITS,
  PHONE_MAX_INPUT_LENGTH,
  countPhoneDigits,
  isValidPhone,
  normalizePhone,
} from "./phoneValidation";

describe("teléfonos válidos", () => {
  it("acepta los formatos que la gente escribe de verdad", () => {
    for (const value of [
      "3001234567",
      "300 123 4567",
      "+57 300 123 4567",
      "+573001234567",
      "(607) 634-5678",
      "6076345678",
    ]) {
      expect(isValidPhone(value)).toBe(true);
    }
  });

  it("acepta el máximo de E.164 (15 dígitos)", () => {
    expect(countPhoneDigits("+123456789012345")).toBe(PHONE_MAX_DIGITS);
    expect(isValidPhone("+123456789012345")).toBe(true);
  });
});

describe("teléfonos inválidos", () => {
  it("rechaza el número del reporte: 25 y 44 dígitos", () => {
    // Este es el que llegó a producción sin que nada protestara.
    expect(isValidPhone("3345676543234565432356543")).toBe(false);
    expect(
      isValidPhone("334567654323456543235654323454323654354323452"),
    ).toBe(false);
  });

  it("rechaza lo que no es un teléfono", () => {
    for (const value of [
      "",
      "   ",
      "12345",
      "abcdefghij",
      "300-ABC-4567",
      "+",
      "++573001234567",
      "3001234567+",
    ]) {
      expect(isValidPhone(value)).toBe(false);
    }
  });

  it("rechaza el cero inicial, que E.164 no admite", () => {
    expect(isValidPhone("0300123456")).toBe(false);
    expect(isValidPhone("+0300123456")).toBe(false);
  });
});

describe("normalización", () => {
  it("ignora separadores para contar dígitos", () => {
    expect(normalizePhone("+57 (300) 123-4567")).toBe("+573001234567");
    expect(countPhoneDigits("+57 (300) 123-4567")).toBe(12);
  });

  it("el tope del input deja escribir un E.164 con separadores", () => {
    expect("+57 300 123 4567".length).toBeLessThanOrEqual(
      PHONE_MAX_INPUT_LENGTH,
    );
  });
});
