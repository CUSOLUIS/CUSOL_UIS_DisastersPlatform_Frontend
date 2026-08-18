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
  // CHG-153: los dos tipos logísticos nuevos (acopio receptor y
  // punto de distribución).
  | "receiver-center"
  | "distribution-point"
  | "community-meals"
  | "temporary-shelter"
  // CHG-125: solicitud pública de ayuda de emergencia.
  | "help-request";

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
  // CHG-153: la logística son 4 tipos; los textos siguen las leyendas
  // del contrato («aquí puedes entregar» / «recibe y clasifica» /
  // «recibe cargamentos» / «aquí puedes recibir»).
  "collection-center": {
    id: "collection-center",
    category: "LOGÍSTICA · CLASIFICACIÓN Y DESPACHO",
    title: "Inscribir centro de acopio local",
    purpose:
      "Registra un centro que recibe, clasifica, almacena y prepara ayudas para su envío a otros puntos.",
    hint: "Registra un centro que recibe, clasifica, almacena y prepara ayudas para su envío a otros puntos",
  },
  "donation-point": {
    id: "donation-point",
    category: "LOGÍSTICA · ENTREGA DE DONACIONES",
    title: "Registrar punto de recolección",
    purpose:
      "Registra un punto donde la comunidad puede entregar donaciones que luego viajan a un centro de acopio local.",
    hint: "Registra un punto donde la comunidad puede entregar donaciones que luego viajan a un centro de acopio local",
  },
  "receiver-center": {
    id: "receiver-center",
    category: "LOGÍSTICA · CARGAMENTOS Y REDISTRIBUCIÓN",
    title: "Inscribir centro de acopio receptor",
    purpose:
      "Registra un centro que recibe grandes cargamentos de ayuda y los redistribuye hacia las zonas afectadas.",
    hint: "Registra un centro que recibe grandes cargamentos de ayuda y los redistribuye hacia las zonas afectadas",
  },
  "distribution-point": {
    id: "distribution-point",
    category: "LOGÍSTICA · ENTREGA A AFECTADOS",
    title: "Registrar punto de distribución",
    purpose:
      "Registra un punto donde las personas afectadas pueden recibir alimentos, agua y elementos de primera necesidad.",
    hint: "Registra un punto donde las personas afectadas pueden recibir alimentos, agua y elementos de primera necesidad",
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
  // CHG-125: la solicitud es pública, admite anónimos y expira sola.
  // CHG-133: la leyenda dice para qué sirve el módulo — remoción de
  // escombros y búsqueda de personas.
  "help-request": {
    id: "help-request",
    category: "AYUDA · EMERGENCIA ACTIVA",
    title: "Necesitamos ayuda",
    purpose:
      "Publica una solicitud urgente para que la comunidad acuda a remover escombros y ayudar a buscar personas mientras esté vigente.",
    hint: "Publica una solicitud urgente para que la comunidad acuda a remover escombros y ayudar a buscar personas mientras esté vigente",
  },
};
