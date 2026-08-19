// CHG-166 — Estrellas 1-5 de los comentarios de un Centro de Acopio
// Local. Glifos y línea de resumen compartidos por el popup del mapa
// (CHG-164), la vista completa y el panel de comentarios (CHG-165).

const averageFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** «★★★★☆» — llenas al entero más cercano, siempre 5 glifos. */
export function starGlyphs(value: number): string {
  const filled = Math.min(5, Math.max(0, Math.round(value)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

/**
 * «★★★★☆ 4,2 · 8 calificaciones», o «Sin calificaciones aún» cuando
 * nadie ha calificado (también con un backend viejo que no envía los
 * campos, CHG-137).
 */
export function ratingSummaryLine(
  average: number | null | undefined,
  count: number | null | undefined,
): string {
  if (average == null || !count || count <= 0) {
    return "Sin calificaciones aún";
  }
  const suffix = count === 1 ? "1 calificación" : `${count} calificaciones`;
  return `${starGlyphs(average)} ${averageFormatter.format(average)} · ${suffix}`;
}
