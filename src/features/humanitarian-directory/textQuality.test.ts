/**
 * CHG-107 — El mínimo de caracteres lo cumplían treinta letras
 * iguales, así que se podía llenar el expediente de una persona
 * desaparecida con texto basura. Mismas reglas que el backend.
 */

import {
  communityTextIssue,
  distinctWords,
  hasExcessiveRepetition,
  hasOverlongWord,
} from "./textQuality";

const DESCRIPCION_REAL =
  "La vi caminando cerca del parque principal sobre la calle " +
  "veinticuatro, vestía chaqueta azul y llevaba una mochila.";

it("una descripción real pasa sin objeciones", () => {
  expect(communityTextIssue(DESCRIPCION_REAL)).toBeNull();
});

it("rechaza el spam que cumplía el mínimo de longitud", () => {
  // 30 caracteres: exactamente lo que exigía la regla anterior.
  const basura = "a".repeat(30);
  expect(hasExcessiveRepetition(basura)).toBe(true);
  expect(communityTextIssue(basura)).toMatch(/repite un mismo carácter/);
});

it("respeta la escritura real con repeticiones cortas", () => {
  // "holaaa" o "noooo" son lenguaje, no spam.
  expect(hasExcessiveRepetition("holaaa, nooo la he visto por alli")).toBe(
    false,
  );
});

it("una sola palabra repetida no describe nada", () => {
  expect(communityTextIssue("casa casa casa casa casa casa")).toMatch(
    /palabras distintas/,
  );
});

it("cuenta palabras distintas ignorando tildes y mayúsculas", () => {
  expect(distinctWords("Casa casa CASA")).toBe(1);
  expect(distinctWords("perro gato loro pez ave")).toBe(5);
});

it("rechaza una cadena pegada demasiado larga", () => {
  expect(hasOverlongWord("x".repeat(45))).toBe(true);
});
