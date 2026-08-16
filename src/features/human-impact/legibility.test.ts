/**
 * CHG-108 — Ningún texto de la portada baja del piso legible.
 *
 * CHG-090 fijó ese piso en 11 px y migró los estilos que el informe de
 * QA señalaba; CHG-098 hizo lo propio con el panel del mapa. Esta
 * prueba lee los propios archivos para que la regla no dependa de que
 * alguien recuerde aplicarla al añadir un estilo nuevo.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { font, minLegibleFontSize } from "../../typography";

const RAIZ = join(__dirname, "..", "..");

const PANTALLAS_DE_PORTADA = [
  "features/human-impact/HumanImpactDashboard.tsx",
  "features/humanitarian-directory/HumanitarianSearchPanel.tsx",
  "features/missing-persons/MissingPersonCommandCenter.tsx",
  "features/operational-map/OperationalMapPanel.tsx",
];

function tamañosLiterales(archivo: string): number[] {
  const fuente = readFileSync(join(RAIZ, archivo), "utf8");
  return [...fuente.matchAll(/fontSize:\s*(\d+)\s*[,}]/g)].map((m) =>
    Number.parseInt(m[1], 10),
  );
}

describe.each(PANTALLAS_DE_PORTADA)("%s", (archivo) => {
  it("no declara ningún tamaño por debajo del piso legible", () => {
    const ilegibles = tamañosLiterales(archivo).filter(
      (size) => size < minLegibleFontSize,
    );

    expect(ilegibles).toEqual([]);
  });
});

it("el piso se aplica aunque alguien escriba un tamaño menor", () => {
  // font() es la vía correcta: sube al piso por sí sola.
  expect(font(6)).toBeGreaterThanOrEqual(minLegibleFontSize);
  expect(font(10)).toBeGreaterThanOrEqual(minLegibleFontSize);
});
