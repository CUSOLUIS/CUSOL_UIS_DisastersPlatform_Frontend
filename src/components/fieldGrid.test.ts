/**
 * CHG-116 — "Institución de salud" quedaba cortada contra el borde
 * derecho en Android: la rejilla repartía por líneas con base 0 y
 * después inflaba cada campo con un mínimo de 250 px.
 */

import { FIELD_BASIS, fieldGridLayout } from "./fieldGrid";

describe("Rejilla de campos", () => {
  it("reparte por líneas con una base real, no con 0", () => {
    expect(fieldGridLayout.field.flexBasis).toBe(FIELD_BASIS);
    expect(fieldGridLayout.field.flexBasis).not.toBe(0);
  });

  it("ningún campo puede exigir más ancho del que hay", () => {
    // El defecto era exactamente este valor en 250: un contenedor más
    // estrecho que el mínimo dejaba el campo fuera de la pantalla.
    expect(fieldGridLayout.field.minWidth).toBe(0);
    expect(fieldGridLayout.field.flexShrink).toBe(1);
  });

  it("los campos crecen hasta llenar la línea", () => {
    expect(fieldGridLayout.field.flexGrow).toBe(1);
  });

  it("la rejilla envuelve en vez de desbordarse", () => {
    expect(fieldGridLayout.grid.flexDirection).toBe("row");
    expect(fieldGridLayout.grid.flexWrap).toBe("wrap");
  });

  it("un campo ancho ocupa la línea entera", () => {
    expect(fieldGridLayout.fieldWide.flexBasis).toBe("100%");
  });
});
