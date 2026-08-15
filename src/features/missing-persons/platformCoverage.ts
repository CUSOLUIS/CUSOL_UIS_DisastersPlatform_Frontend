// CHG-106 — Primer año que cubre la plataforma.
//
// La operación arrancó en 2026, así que una desaparición registrada
// aquí no puede ser anterior: ofrecer años previos en el calendario
// solo daba lugar a elegir 2015 por descuido y dejar el caso con una
// fecha que nadie puede verificar.
//
// Vive en una constante y no en un literal suelto para que el día que
// la cobertura cambie se ajuste en un sitio, y para que el porqué
// quede junto al valor.
export const PLATFORM_FIRST_YEAR = 2026;

export const LAST_SEEN_YEAR_MESSAGE =
  `La fecha de última visualización no puede ser anterior a ` +
  `${PLATFORM_FIRST_YEAR}, que es el primer año que cubre la plataforma.`;

export function isBeforePlatformCoverage(isoDate: string): boolean {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(isoDate.trim());
  if (!match) {
    // El formato lo valida otra regla; aquí no se opina.
    return false;
  }
  return Number.parseInt(match[1], 10) < PLATFORM_FIRST_YEAR;
}
