// CHG-100 — Validación de teléfonos de contacto.
//
// El límite anterior (40 caracteres en el backend, ninguno en la
// interfaz) solo frenaba lo absurdo: un número de 25 dígitos se
// guardaba sin protestar y dejaba al equipo de verificación con un
// contacto inservible. Aquí se valida contra E.164, que es el estándar
// internacional: hasta 15 dígitos, sin ceros a la izquierda.
//
// La gente escribe los teléfonos con espacios, guiones y paréntesis
// ("+57 (300) 123-4567"), así que esos separadores se aceptan al
// escribir y se ignoran al validar: lo que se cuenta son los dígitos.

// Tope del input: deja escribir un E.164 completo con separadores
// ("+57 300 123 4567" son 17) sin permitir cadenas arbitrarias.
export const PHONE_MAX_INPUT_LENGTH = 25;

// E.164 admite hasta 15 dígitos. El mínimo cubre los fijos locales
// más cortos de la región.
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;

const SEPARATORS = /[\s().-]/g;

export function normalizePhone(value: string): string {
  return value.replace(SEPARATORS, "").trim();
}

export function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  if (normalized === "") {
    return false;
  }

  // Un "+" solo al principio; el resto, dígitos.
  if (!/^\+?\d+$/.test(normalized)) {
    return false;
  }

  // E.164 no admite que el número empiece en cero.
  const digits = normalized.replace("+", "");
  if (digits.startsWith("0")) {
    return false;
  }

  const total = digits.length;
  return total >= PHONE_MIN_DIGITS && total <= PHONE_MAX_DIGITS;
}

// Mensaje único: el mismo texto en los tres formularios que piden
// teléfono, para que el usuario no reciba explicaciones distintas del
// mismo problema.
export const PHONE_FORMAT_MESSAGE =
  `El teléfono debe tener entre ${PHONE_MIN_DIGITS} y ${PHONE_MAX_DIGITS} ` +
  "dígitos; puedes escribirlo con indicativo, espacios o guiones.";
