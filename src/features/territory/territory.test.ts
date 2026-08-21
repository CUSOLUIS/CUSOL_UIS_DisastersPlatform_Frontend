import {
  DEPARTMENTS,
  MUNICIPALITIES_BY_DEPARTMENT,
  isKnownDepartment,
  isKnownMunicipality,
  municipalitiesOf,
  normalizeTerritoryName,
  resolveDepartment,
  resolveMunicipality,
  searchTerritory,
} from "./territory";

// CHG-185 — El catálogo tiene que estar completo: una lista cerrada a
// la que le falte un municipio no es una validación, es una persona que
// no puede crear su cuenta.
describe("catálogo de territorio (CHG-185)", () => {
  it("trae los 33 departamentos y los 1.122 municipios oficiales", () => {
    expect(DEPARTMENTS).toHaveLength(33);
    const total = DEPARTMENTS.reduce(
      (count, department) =>
        count + MUNICIPALITIES_BY_DEPARTMENT[department].length,
      0,
    );
    expect(total).toBe(1122);
  });

  it("cuadra con los conteos conocidos del DANE", () => {
    expect(municipalitiesOf("Antioquia")).toHaveLength(125);
    expect(municipalitiesOf("Boyacá")).toHaveLength(123);
    expect(municipalitiesOf("Cundinamarca")).toHaveLength(116);
    expect(municipalitiesOf("Santander")).toHaveLength(87);
    expect(municipalitiesOf("Bogotá, D.C.")).toEqual(["Bogotá, D.C."]);
  });

  it("no repite municipios dentro de un mismo departamento", () => {
    for (const department of DEPARTMENTS) {
      const municipalities = MUNICIPALITIES_BY_DEPARTMENT[department];
      expect(new Set(municipalities).size).toBe(municipalities.length);
    }
  });
});

describe("normalizeTerritoryName (CHG-185)", () => {
  it("ignora tildes, mayúsculas, signos y espacios de más", () => {
    expect(normalizeTerritoryName("  SAN JOSÉ  DE CÚCUTA ")).toBe(
      "san jose de cucuta",
    );
    expect(normalizeTerritoryName("Bogotá, D.C.")).toBe("bogota d c");
    expect(normalizeTerritoryName("Mirití - Paraná")).toBe("miriti parana");
  });
});

describe("resolución contra el catálogo (CHG-185)", () => {
  it("devuelve el nombre del catálogo aunque se escriba sin tildes", () => {
    expect(resolveDepartment("bolivar")).toBe("Bolívar");
    expect(resolveDepartment("NORTE DE SANTANDER")).toBe("Norte de Santander");
    expect(resolveMunicipality("Norte de Santander", "san jose de cucuta")).toBe(
      "San José de Cúcuta",
    );
  });

  it("rechaza lo que no está y la pareja de otro departamento", () => {
    expect(resolveDepartment("Santanderr")).toBeNull();
    expect(resolveDepartment("")).toBeNull();
    expect(isKnownDepartment("Santander")).toBe(true);
    expect(isKnownMunicipality("Santander", "Bucaramanga")).toBe(true);
    // Medellín existe, pero no en Santander.
    expect(isKnownMunicipality("Santander", "Medellín")).toBe(false);
    expect(isKnownMunicipality("", "Bucaramanga")).toBe(false);
  });

  it("acota los municipios al departamento elegido", () => {
    expect(municipalitiesOf("Quindío")).toContain("Armenia");
    expect(municipalitiesOf("Antioquia")).toContain("Armenia");
    expect(municipalitiesOf("Departamento inventado")).toEqual([]);
  });
});

describe("searchTerritory (CHG-185)", () => {
  it("ofrece primero los que empiezan por lo escrito", () => {
    const matches = searchTerritory(DEPARTMENTS, "bo");
    expect(matches.slice(0, 3)).toEqual([
      "Bogotá, D.C.",
      "Bolívar",
      "Boyacá",
    ]);
  });

  it("también encuentra por el medio del nombre", () => {
    expect(searchTerritory(DEPARTMENTS, "santander")).toEqual([
      "Santander",
      "Norte de Santander",
    ]);
  });

  it("busca sin tildes y devuelve todo cuando no hay texto", () => {
    // El DANE no registra «Cúcuta» suelto: la capital es «San José de
    // Cúcuta», y quien escribe «cucuta» tiene que encontrarla igual.
    expect(
      searchTerritory(municipalitiesOf("Norte de Santander"), "cucuta"),
    ).toEqual(["San José de Cúcuta"]);
    expect(searchTerritory(DEPARTMENTS, "   ")).toEqual(DEPARTMENTS);
    expect(searchTerritory(DEPARTMENTS, "zzz")).toEqual([]);
  });
});
