// CHG-153 — Los cuatro tipos de puntos logísticos humanitarios y el
// texto único de sus formularios de alta (leyenda corta y aviso
// contextual del contrato técnico). Un solo origen: el formulario, la
// constancia y el mapa no pueden contradecirse.

export type AidLocationKind =
  | "collection_point"
  | "collection_center"
  | "receiver_center"
  | "distribution_point";

export type AidLocationOperationalStatus =
  | "open"
  | "closed"
  | "at_capacity"
  | "under_observation"
  | "inactive";

// Punto dependiente -> tipo del centro padre que exige (espejo del
// backend; el servicio revalida siempre).
export const AID_LOCATION_PARENT_KIND: Partial<
  Record<AidLocationKind, AidLocationKind>
> = {
  collection_point: "collection_center",
  distribution_point: "receiver_center",
};

// CHG-161 — Tipos cuya alta exige sesión: el acopio local y el punto de
// distribución, igual que los transportes. El portón se pinta en el
// formulario y desde la F2 lo refuerza el servidor (gateway 401 +
// disaster-service `AID_LOCATION_KINDS_REQUIRING_ACCOUNT`), así que
// saltarse la pantalla no sirve de nada.
export const AID_LOCATION_REQUIRES_SESSION: Record<AidLocationKind, boolean> = {
  collection_point: false,
  collection_center: true,
  receiver_center: false,
  distribution_point: true,
};

export const aidLocationSessionExplanation: Partial<
  Record<AidLocationKind, string>
> = {
  collection_center:
    "Inscribir un centro de acopio local exige iniciar sesión: la logística humanitaria necesita una persona responsable con cuenta.",
  distribution_point:
    "Registrar un punto de distribución exige iniciar sesión: la logística humanitaria necesita una persona responsable con cuenta.",
};

// Espejo de `AidLocationInput` del contrato.
export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 180;
export const MIN_ADDRESS_LENGTH = 3;
export const MAX_ADDRESS_LENGTH = 300;
export const MAX_CITY_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_SCHEDULE_LENGTH = 200;
export const MAX_CONTACT_LENGTH = 200;

export interface AidLocationDraft {
  name: string;
  address: string;
  municipality: string;
  department: string;
  latitude: string;
  longitude: string;
  schedule: string;
  contact: string;
  description: string;
  parentId: string;
  truthConfirmed: boolean;
}

export interface AidLocationReceipt {
  id: string;
  kind: AidLocationKind;
  operationalStatus: AidLocationOperationalStatus;
  createdAt: string;
}

export interface AidLocationParentCandidate {
  id: string;
  name: string;
  address: string;
  municipality: string;
  department: string;
  operationalStatus: AidLocationOperationalStatus;
}

export interface AidLocationFormCopy {
  kind: AidLocationKind;
  overline: string;
  title: string;
  // Leyenda corta del contrato: qué es este punto para la ciudadanía.
  legend: string;
  // Aviso contextual del contrato: qué debe saber quien acude.
  contextNotice: string;
  intro: string;
  // Solo tipos dependientes: cómo se llama el centro que exigen y qué
  // decir cuando la ciudad aún no tiene ninguno (§6 del contrato).
  parentLabel?: string;
  missingParentMessage?: string;
}

export const aidLocationFormCopy: Record<AidLocationKind, AidLocationFormCopy> =
  {
    collection_point: {
      kind: "collection_point",
      overline: "LOGÍSTICA / PUNTO DE RECOLECCIÓN",
      title: "Registrar punto de recolección",
      legend: "Aquí puedes entregar donaciones.",
      contextNotice:
        "Consulta qué elementos se están recibiendo antes de desplazarte. No lleves productos no solicitados.",
      intro:
        "Registra un punto donde ciudadanos, empresas y comunidades pueden entregar donaciones. Las ayudas reunidas se envían después a un centro de acopio local.",
      parentLabel: "Centro de acopio local asociado",
      missingParentMessage:
        "No es posible registrar un punto de recolección en esta ciudad porque todavía no existe un Centro de acopio local disponible al cual asociarlo.",
    },
    collection_center: {
      kind: "collection_center",
      overline: "LOGÍSTICA / CENTRO DE ACOPIO LOCAL",
      title: "Inscribir centro de acopio local",
      legend: "Recibe, clasifica y prepara ayudas para su envío.",
      contextNotice:
        "Punto destinado principalmente a clasificación y logística. Verifica antes de acudir si recibe donaciones directamente del público.",
      intro:
        "Registra un centro que consolida las ayudas locales: recepción, registro, clasificación, almacenamiento, embalaje y despacho hacia otros puntos.",
    },
    receiver_center: {
      kind: "receiver_center",
      overline: "LOGÍSTICA / CENTRO DE ACOPIO RECEPTOR",
      title: "Inscribir centro de acopio receptor",
      legend: "Recibe grandes cargamentos de ayuda y los redistribuye.",
      contextNotice:
        "Centro destinado a recibir cargamentos y coordinar redistribución. El acceso puede estar restringido a personal autorizado y vehículos logísticos.",
      intro:
        "Registra un centro que recibe cargamentos de otras ciudades, organizaciones y convoyes humanitarios, los consolida y los redistribuye hacia las zonas afectadas.",
    },
    distribution_point: {
      kind: "distribution_point",
      overline: "LOGÍSTICA / PUNTO DE DISTRIBUCIÓN",
      title: "Registrar punto de distribución",
      legend: "Aquí las personas afectadas pueden recibir ayudas.",
      contextNotice:
        "Dirigido a población afectada. Consulta disponibilidad, horarios y requisitos antes de desplazarte.",
      intro:
        "Registra un punto que entrega directamente a la población afectada alimentos, agua, kits de higiene y otros elementos de primera necesidad.",
      parentLabel: "Centro de acopio receptor asociado",
      missingParentMessage:
        "No es posible registrar un punto de distribución en esta ciudad porque todavía no existe un Centro de acopio receptor disponible al cual asociarlo.",
    },
  };

// Nombre humano de cada tipo, para constancias y mensajes.
export const aidLocationKindLabel: Record<AidLocationKind, string> = {
  collection_point: "Punto de recolección",
  collection_center: "Centro de acopio local",
  receiver_center: "Centro de acopio receptor",
  distribution_point: "Punto de distribución",
};
