// CHG-107 — Calidad mínima del texto que aporta la comunidad.
//
// El mínimo de caracteres lo cumplían treinta letras iguales, así que
// se podía contaminar el expediente de una persona desaparecida con
// texto basura. Estas reglas no juzgan el contenido —eso es del equipo
// de revisión—, solo descartan lo que evidentemente no es una
// descripción escrita por alguien.
//
// Son las mismas que aplica el backend: aquí para avisar antes de
// enviar, allí para que valgan de verdad.

// Cuatro letras iguales seguidas no aparecen en español; tres sí, en
// interjecciones ("holaaa"), así que el corte va en cuatro.
export const MAX_REPEATED_CHARACTERS = 4;
export const MIN_DISTINCT_WORDS = 5;
export const MAX_WORD_LENGTH = 40;

export function hasExcessiveRepetition(value: string): boolean {
  let repetidos = 1;
  let anterior = "";
  for (const char of value) {
    if (char === anterior && char.trim() !== "") {
      repetidos += 1;
      if (repetidos > MAX_REPEATED_CHARACTERS) {
        return true;
      }
    } else {
      repetidos = 1;
      anterior = char;
    }
  }
  return false;
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function distinctWords(value: string): number {
  const encontradas = new Set(
    (stripAccents(value).match(/[a-zA-ZñÑ]{2,}/g) ?? []).map(
      (word) => word.toLocaleLowerCase("es-CO"),
    ),
  );
  return encontradas.size;
}

export function hasOverlongWord(value: string): boolean {
  return value
    .split(/\s+/)
    .some((fragmento) => fragmento.length > MAX_WORD_LENGTH);
}

/** Devuelve el motivo del rechazo, o `null` si el texto sirve. */
export function communityTextIssue(value: string): string | null {
  const texto = value.trim();

  if (hasExcessiveRepetition(texto)) {
    return "El texto repite un mismo carácter demasiadas veces; describe lo que observaste.";
  }

  if (hasOverlongWord(texto)) {
    return "El texto tiene una secuencia sin espacios demasiado larga; describe lo que observaste.";
  }

  if (distinctWords(texto) < MIN_DISTINCT_WORDS) {
    return `Describe lo que observaste con al menos ${MIN_DISTINCT_WORDS} palabras distintas.`;
  }

  return null;
}
