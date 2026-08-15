/**
 * CHG-106 — La plataforma cubre desde 2026: una última visualización
 * anterior no puede registrarse. El calendario ya no ofrece esos años,
 * pero la regla vive aparte para que un envío armado a mano tampoco la
 * esquive.
 */

import {
  PLATFORM_FIRST_YEAR,
  isBeforePlatformCoverage,
} from "./platformCoverage";

it("rechaza fechas anteriores al primer año cubierto", () => {
  for (const fecha of ["2025-12-31", "2015-06-01", "1999-01-01"]) {
    expect(isBeforePlatformCoverage(fecha)).toBe(true);
  }
});

it("acepta el primer día cubierto y lo posterior", () => {
  expect(isBeforePlatformCoverage(`${PLATFORM_FIRST_YEAR}-01-01`)).toBe(
    false,
  );
  expect(isBeforePlatformCoverage("2026-08-15")).toBe(false);
  expect(isBeforePlatformCoverage("2027-03-01")).toBe(false);
});

it("no opina sobre lo que no es una fecha: eso lo valida otra regla", () => {
  for (const valor of ["", "  ", "15/08/2026", "2026-8-1", "abc"]) {
    expect(isBeforePlatformCoverage(valor)).toBe(false);
  }
});

it("tolera espacios alrededor", () => {
  expect(isBeforePlatformCoverage("  2025-01-01  ")).toBe(true);
});
