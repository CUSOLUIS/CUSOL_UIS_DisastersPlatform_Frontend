import {
  DEPARTMENTS,
  MUNICIPALITIES_BY_DEPARTMENT,
} from "./colombiaTerritory";

// CHG-185 — Reglas del catálogo de territorio: comparar, buscar y
// resolver un nombre escrito contra el catálogo oficial del DANE.
//
// La comparación ignora tildes, mayúsculas, signos y espacios de más:
// quien escribe «bogota dc» o «MIRITI PARANA» está nombrando el mismo
// municipio que el catálogo escribe «Bogotá, D.C.» y «Mirití - Paraná».
// Es una lista cerrada para lo que se guarda, no para lo que se teclea.

export { DEPARTMENTS, MUNICIPALITIES_BY_DEPARTMENT };

export function normalizeTerritoryName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

// Los municipios del departamento elegido; lista vacía si el
// departamento no está en el catálogo (o todavía no se ha elegido).
export function municipalitiesOf(department: string): readonly string[] {
  const canonical = resolveDepartment(department);
  return canonical ? MUNICIPALITIES_BY_DEPARTMENT[canonical] : [];
}

// Devuelve el nombre tal como lo escribe el catálogo, o null si no
// pertenece a él.
export function resolveDepartment(value: string): string | null {
  const target = normalizeTerritoryName(value);
  if (!target) return null;
  return (
    DEPARTMENTS.find(
      (department) => normalizeTerritoryName(department) === target,
    ) ?? null
  );
}

export function resolveMunicipality(
  department: string,
  value: string,
): string | null {
  const target = normalizeTerritoryName(value);
  if (!target) return null;
  return (
    municipalitiesOf(department).find(
      (municipality) => normalizeTerritoryName(municipality) === target,
    ) ?? null
  );
}

export function isKnownDepartment(value: string): boolean {
  return resolveDepartment(value) !== null;
}

export function isKnownMunicipality(
  department: string,
  value: string,
): boolean {
  return resolveMunicipality(department, value) !== null;
}

// Filtrado para la lista desplegable: primero los que empiezan por lo
// escrito —«bo» ofrece Bolívar y Boyacá antes que Chocó—, después los
// que lo contienen en cualquier posición. Sin texto devuelve el
// catálogo entero en su orden alfabético.
export function searchTerritory(
  options: readonly string[],
  query: string,
): readonly string[] {
  const target = normalizeTerritoryName(query);
  if (!target) return options;

  const starts: string[] = [];
  const contains: string[] = [];
  for (const option of options) {
    const normalized = normalizeTerritoryName(option);
    if (normalized.startsWith(target)) {
      starts.push(option);
    } else if (normalized.includes(target)) {
      contains.push(option);
    }
  }
  return [...starts, ...contains];
}
