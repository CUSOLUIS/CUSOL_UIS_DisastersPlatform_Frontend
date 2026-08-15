// CHG-090 (QA): texto único de las seis acciones de la portada.
//
// La tarjeta pinta la categoría y el título; el propósito ya no se
// pinta ahí —saturaba la vista bajo estrés— sino en la leyenda del
// formulario al que lleva la acción, donde el usuario ya decidió y
// puede leer con calma. Tener un solo origen evita que la tarjeta y la
// leyenda se contradigan.

export type ReportActionId =
  | "missing-person"
  | "unverified-building"
  | "collection-center"
  | "donation-point"
  | "community-meals"
  | "temporary-shelter";

export interface ReportActionCopy {
  id: ReportActionId;
  // Categoría que agrupa la acción; se pinta sobre el título.
  category: string;
  title: string;
  // Qué se logra al entrar. Va en la leyenda del destino.
  purpose: string;
  // Mismo propósito redactado para lectores de pantalla, que lo
  // anuncian antes de que exista la pantalla siguiente.
  hint: string;
}

export const reportActionCatalog: Record<ReportActionId, ReportActionCopy> = {
  "missing-person": {
    id: "missing-person",
    category: "PERSONA · REPORTE CIUDADANO",
    title: "Reportar persona perdida",
    purpose:
      "Registra información y fotos de una persona desaparecida para iniciar su verificación.",
    hint: "Registra información y fotos de una persona desaparecida para iniciar su verificación",
  },
  "unverified-building": {
    id: "unverified-building",
    category: "EDIFICIO · BÚSQUEDA PENDIENTE",
    title: "Reportar edificio sin verificar",
    purpose:
      "Informa un edificio cuya búsqueda no ha terminado y donde aún no se puede descartar presencia humana.",
    hint: "Informa un edificio cuya búsqueda no ha terminado y donde aún no se puede descartar presencia humana",
  },
  "collection-center": {
    id: "collection-center",
    category: "AYUDA · RECEPCIÓN Y ALMACENAMIENTO",
    title: "Inscribir centro de acopio",
    purpose:
      "Registra un lugar que recibe, clasifica y almacena ayudas, y que será revisado antes de publicarse.",
    hint: "Registra un lugar que recibe, clasifica y almacena ayudas y que deberá ser revisado antes de publicarse",
  },
  "donation-point": {
    id: "donation-point",
    category: "AYUDA · ENTREGA COMUNITARIA",
    title: "Registrar punto de recolección",
    purpose:
      "Registra un punto comunitario de entrega que reúne ayudas para trasladarlas posteriormente.",
    hint: "Registra un punto comunitario de entrega que reúne ayudas para trasladarlas posteriormente",
  },
  "community-meals": {
    id: "community-meals",
    category: "AYUDA · ALIMENTACIÓN SOLIDARIA",
    title: "Ofrecer comida comunitaria",
    purpose:
      "Informa que preparas alimentos y deseas compartirlos con personas afectadas durante la emergencia.",
    hint: "Informa que preparas alimentos y deseas compartirlos con personas afectadas durante la emergencia",
  },
  "temporary-shelter": {
    id: "temporary-shelter",
    category: "AYUDA · ALOJAMIENTO SOLIDARIO",
    title: "Ofrecer alojamiento temporal",
    purpose:
      "Informa que tienes un espacio disponible para que personas afectadas puedan dormir temporalmente.",
    hint: "Informa que tienes un espacio disponible para que personas afectadas puedan dormir temporalmente",
  },
};
