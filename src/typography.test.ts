import {
  clampFontScale,
  font,
  maxFontScale,
  minFontScale,
  minLegibleFontSize,
  scaled,
  userFontScale,
} from "./typography";

describe("escala tipográfica (CHG-090)", () => {
  it("acota el factor del usuario entre el diseño original y el máximo", () => {
    expect(clampFontScale(0.5)).toBe(minFontScale);
    expect(clampFontScale(1)).toBe(1);
    expect(clampFontScale(1.25)).toBe(1.25);
    expect(clampFontScale(9)).toBe(maxFontScale);
  });

  it("cae al factor neutro cuando la preferencia no es un número finito", () => {
    expect(clampFontScale(Number.NaN)).toBe(minFontScale);
    expect(clampFontScale(Number.POSITIVE_INFINITY)).toBe(minFontScale);
  });

  it("sube al piso legible los tamaños que el informe marcó ilegibles", () => {
    // 7 y 8 px eran los del encabezado, las viñetas y el pie.
    expect(font(7)).toBeGreaterThanOrEqual(minLegibleFontSize);
    expect(font(8)).toBeGreaterThanOrEqual(minLegibleFontSize);
    expect(font(10)).toBeGreaterThanOrEqual(minLegibleFontSize);
  });

  it("respeta los tamaños que ya superan el piso", () => {
    expect(font(17)).toBe(Math.round(17 * userFontScale));
    expect(font(44)).toBe(Math.round(44 * userFontScale));
  });

  it("escala las medidas de apoyo sin aplicarles el piso legible", () => {
    expect(scaled(4)).toBe(Math.round(4 * userFontScale));
    expect(scaled(21)).toBe(Math.round(21 * userFontScale));
  });
});
