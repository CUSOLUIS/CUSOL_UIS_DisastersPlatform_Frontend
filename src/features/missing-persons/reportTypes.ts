// CHG-094: categoría declarada por quien reporta; viaja como arreglo
// paralelo `photoCategories` alineado por posición con las fotos.
export type PhotoCategory =
  | "recent_face"
  | "full_body"
  | "distinctive_mark"
  | "other";

export interface SelectedPhoto {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  category?: PhotoCategory;
}

export interface PhotoValidationResult {
  photos: SelectedPhoto[];
  errors: string[];
}

export interface MissingPersonReportReceipt {
  publicCaseCode: string;
  // CHG-075: la publicación es inmediata al crear el reporte.
  status: "published";
  receivedAt: string;
}

export interface MissingPersonReportDraft {
  firstNames: string;
  lastNames: string;
  aliases: string;
  birthDate: string;
  approximateAge: string;
  genderIdentity: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  heightCm: string;
  build: string;
  skinTone: string;
  hairDescription: string;
  eyeDescription: string;
  distinctiveMarks: string;
  medicalInformation: string;
  // CHG-094 — Identificación física detallada.
  tattooDescription: string;
  scarsDescription: string;
  prostheticsDescription: string;
  piercingsAndMoles: string;
  // CHG-094 — Alertas médicas (el backend las guarda cifradas).
  mentalHealthCondition: string;
  vitalMedication: string;
  severeAllergies: string;
  // CHG-094 — Contexto del desplazamiento.
  belongingsDescription: string;
  transportMode: TransportMode | "";
  vehicleDetails: string;
  companionsDescription: string;
  lastSeenDate: string;
  lastSeenTime: string;
  department: string;
  municipality: string;
  lastSeenArea: string;
  lastSeenLatitude: string;
  lastSeenLongitude: string;
  clothingDescription: string;
  circumstances: string;
  additionalDescription: string;
  reporterName: string;
  reporterRelationship: string;
  reporterPhone: string;
  reporterEmail: string;
  officialReportNumber: string;
  // CHG-094 — Entidad donde se interpuso la denuncia.
  officialAuthorityName: string;
  // CHG-094 — Consentimiento para compartir el contacto con quienes
  // aporten información. El backend lo registra; hoy no publica el
  // dato en la tarjeta pública.
  isReporterPhonePublic: boolean;
  isReporterEmailPublic: boolean;
  truthConfirmed: boolean;
  photoAuthorizationConfirmed: boolean;
}

// CHG-094 — Medio de transporte al momento de la desaparición.
export type TransportMode =
  | "on_foot"
  | "bicycle"
  | "public_transport"
  | "private_vehicle"
  | "other";

// CHG-094 — Avistamiento georreferenciado aportado por un tercero.
// Preparación del contrato: el flujo de novedades existente
// (`MissingPersonStatusContribution`) todavía no lleva coordenadas ni
// contacto del observador; ese endpoint queda como deuda declarada.
export interface SightingReportDraft {
  publicCaseCode: string;
  sightingDate: string;
  sightingTime: string;
  department: string;
  municipality: string;
  sightingArea: string;
  latitude: string;
  longitude: string;
  description: string;
  observerPhone: string;
  observerEmail: string;
}
