// CHG-166 — La línea de estrellas redondea al entero más cercano,
// formatea el promedio con coma decimal (es-CO) y distingue singular,
// plural y ausencia de calificaciones.

import { ratingSummaryLine, starGlyphs } from "./ratingStars";

it("pinta las estrellas llenas al entero más cercano", () => {
  expect(starGlyphs(4.2)).toBe("★★★★☆");
  expect(starGlyphs(4.5)).toBe("★★★★★");
  expect(starGlyphs(1)).toBe("★☆☆☆☆");
});

it("resume promedio y cantidad con coma decimal", () => {
  expect(ratingSummaryLine(4.2, 8)).toBe("★★★★☆ 4,2 · 8 calificaciones");
  expect(ratingSummaryLine(5, 1)).toBe("★★★★★ 5,0 · 1 calificación");
});

it("sin calificaciones (o backend viejo) lo dice en palabras", () => {
  expect(ratingSummaryLine(null, 0)).toBe("Sin calificaciones aún");
  expect(ratingSummaryLine(undefined, undefined)).toBe(
    "Sin calificaciones aún",
  );
});
