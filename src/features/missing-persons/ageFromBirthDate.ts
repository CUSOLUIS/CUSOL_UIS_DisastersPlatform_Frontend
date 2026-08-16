/**
 * CHG-115 — Edad a partir de la fecha de nacimiento.
 *
 * La captura que originó el cambio mostraba `2004-11-23` junto a
 * `Edad aproximada 12`: dos campos sueltos describiendo el mismo hecho
 * y contradiciéndose. La edad filtra y prioriza una búsqueda (menor de
 * edad, adulto mayor), así que aquí no vale restar años a ojo: no se
 * cumplen años hasta que llega el día.
 */

// Tope del modelo del servicio y del CHECK de la base.
export const MAX_APPROXIMATE_AGE = 120;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Edad cumplida en `today`, o `null` si la fecha no es utilizable
 * (formato inesperado, inexistente o futura).
 */
export function ageFromBirthDate(
  birthDate: string,
  today: Date = new Date(),
): number | null {
  if (!ISO_DATE.test(birthDate)) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  // El calendario del formulario no ofrece días inexistentes, pero un
  // borrador restaurado o un cliente futuro sí podrían traerlos.
  const nacimiento = new Date(year, month - 1, day);
  if (
    nacimiento.getFullYear() !== year ||
    nacimiento.getMonth() !== month - 1 ||
    nacimiento.getDate() !== day
  ) {
    return null;
  }

  const hoy = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (nacimiento.getTime() > hoy.getTime()) {
    return null;
  }

  // Se descuenta el año en curso mientras no haya llegado el día del
  // cumpleaños: quien nació un 23 de noviembre tiene un año menos
  // hasta ese 23, no desde el 1 de enero.
  const cumplido =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() >= nacimiento.getDate());

  return hoy.getFullYear() - nacimiento.getFullYear() - (cumplido ? 0 : 1);
}
