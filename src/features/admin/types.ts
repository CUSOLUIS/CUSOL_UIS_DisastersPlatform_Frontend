import type { AccountRole, AuthenticatedAccount } from "../auth/types";

export type AdminSection =
  | "overview"
  | "submissions"
  | "accounts"
  | "audit"
  | "presence"
  // CHG-165: verificación y reactivación de Centros de Acopio Local.
  | "centerVerifications"
  | "system"
  // CHG-138: gestión de solicitudes «Necesitamos ayuda».
  | "helpRequests"
  // CHG-154: gestión de registros de personas (ocultar/editar).
  | "peopleRecords"
  // CHG-139: reinicio absoluto de la plataforma.
  | "reset";
export type AdminSubmissionKind =
  | "missing_person_report"
  | "unverified_building_report"
  | "person_status_report"
  | "aid_location_rating"
  | "collection_center_registration"
  | "collection_point_registration"
  // CHG-044: las ofertas comunitarias también viven en la bandeja.
  | "community_meal_offer"
  | "temporary_shelter_offer";
// CHG-159: temas de la bandeja (mismos ejes que el mapa público).
export type AdminSubmissionTheme = "personas" | "infraestructura" | "ayuda";
export type AdminModerationStatus =
  | "under_review"
  | "needs_information"
  | "accepted"
  | "rejected"
  | "archived";
export type AdminAction =
  | "accept"
  | "reject"
  | "request_changes"
  | "archive"
  | "restore"
  // CHG-159: borrado definitivo (solo desde archivado/rechazado).
  | "delete";
export type AdminAccountStatus =
  | "pending_verification"
  | "active"
  | "suspended";

export interface AdminCountByKind {
  kind: AdminSubmissionKind;
  count: number;
}

export interface AdminActivitySummary {
  id: string;
  action: string;
  resourceKind: string;
  occurredAt: string;
  result: "success" | "denied" | "failed";
}

export interface AdminOverview {
  underReview: number;
  needsInformation: number;
  acceptedToday: number;
  archived: number;
  activeAccounts: number;
  suspendedAccounts: number;
  oldestPendingAt: string | null;
  byKind: AdminCountByKind[];
  recentActivity: AdminActivitySummary[];
  generatedAt: string;
}

export interface AdminSubmissionSummary {
  id: string;
  kind: AdminSubmissionKind;
  trackingCode: string;
  title: string;
  locationLabel: string | null;
  status: AdminModerationStatus;
  sourceLabel: string;
  evidenceCount: number;
  receivedAt: string;
  updatedAt: string;
  version: number;
}

export interface AdminSubmissionPage {
  items: AdminSubmissionSummary[];
  total: number;
  limit: 10 | 25 | 50;
  offset: number;
  generatedAt: string;
}

export interface AdminField {
  key: string;
  label: string;
  displayValue: string;
  editValue: string | null;
  classification: "public" | "private" | "protected";
  editable: boolean;
  inputKind?:
    | "text"
    | "multiline"
    | "date"
    | "time"
    | "number"
    | "email"
    | "select";
  options?: string[];
}

export interface AdminEvidence {
  id: string;
  mediaType: string;
  sizeBytes: number;
  scanStatus: "safe" | "pending" | "rejected";
  createdAt: string;
}

export interface AdminSubmissionDetail extends AdminSubmissionSummary {
  fields: AdminField[];
  evidence: AdminEvidence[];
  availableActions: AdminAction[];
}

export interface AdminSubmissionFilters {
  q?: string;
  kind?: AdminSubmissionKind;
  // CHG-159: filtro por tema; un kind explícito manda sobre el tema.
  theme?: AdminSubmissionTheme;
  status?: AdminModerationStatus;
  receivedFrom?: string;
  receivedTo?: string;
  limit: 10 | 25 | 50;
  offset: number;
}

export interface AdminSubmissionEditInput {
  expectedVersion: number;
  reason: string;
  changes: Array<{ field: string; value: string | null }>;
}

export interface AdminDecisionInput {
  expectedVersion: number;
  action: "accept" | "reject" | "request_changes";
  reason: string;
}

export interface AdminVersionedReasonInput {
  expectedVersion: number;
  reason: string;
}

// CHG-159: recibo del borrado definitivo — la fila ya no existe.
export interface AdminSubmissionDeleteReceipt {
  id: string;
  auditEventId: string;
  deletedAt: string;
}

export interface AdminMutationReceipt {
  id: string;
  status: AdminModerationStatus;
  version: number;
  auditEventId: string;
  updatedAt: string;
}

export interface AdminEvidenceAccessGrant {
  url: string;
  expiresAt: string;
  auditEventId: string;
}

export interface AdminAccountSummary {
  id: string;
  displayName: string;
  email: string;
  assignedRole: AccountRole;
  status: AdminAccountStatus;
  activeSessions: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AdminAccountDetail extends AdminAccountSummary {
  department: string;
  municipality: string;
  requestedAccountType:
    | "citizen"
    | "volunteer"
    | "organization_representative";
  organizationName: string | null;
  organizationRole: string | null;
}

export interface AdminAccountPage {
  items: AdminAccountSummary[];
  total: number;
  limit: 10 | 25 | 50;
  offset: number;
  generatedAt: string;
}

export interface AdminAccountFilters {
  q?: string;
  role?: AccountRole;
  status?: AdminAccountStatus;
  limit: 10 | 25 | 50;
  offset: number;
}

export interface AdminAccountUpdateInput {
  expectedVersion: number;
  reason: string;
  assignedRole?: AccountRole;
  status?: AdminAccountStatus;
}

export interface AdminAuditEvent {
  id: string;
  actorAccountId: string;
  actorDisplayName: string;
  action: string;
  resourceKind: string;
  // CHG-139: null en actos globales (vaciados, reinicio).
  resourceId: string | null;
  result: "success" | "denied" | "failed";
  reasonSummary: string | null;
  occurredAt: string;
}

export interface AdminAuditPage {
  items: AdminAuditEvent[];
  total: number;
  limit: 10 | 25 | 50;
  offset: number;
  generatedAt: string;
}

// CHG-066: ubicación en vivo de usuarios registrados que aceptaron
// compartirla. Solo la consola super_admin puede consultarla y la
// cuenta jamás viaja: apenas el hecho de estar autenticado.
export interface AdminVisitorPresence {
  presenceId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  platform: "web" | "android" | "ios";
  authenticated: boolean;
  firstSeenAt: string;
  updatedAt: string;
}

export interface AdminVisitorPresencePage {
  items: AdminVisitorPresence[];
  total: number;
  windowMinutes: number;
  generatedAt: string;
}

// CHG-126: una muestra del sistema operativo del host del gateway.
export interface SystemMetricsSample {
  sampledAt: string;
  cpuPercent: number;
  // CHG-140: null cuando el host no expone sensores térmicos.
  cpuTemperatureCelsius: number | null;
  load1m: number;
  load5m: number;
  load15m: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryAvailableBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskFreeBytes: number;
  networkRxBytesPerSecond: number;
  networkTxBytesPerSecond: number;
  uptimeSeconds: number;
}

export interface AdminSystemMetrics {
  intervalSeconds: number;
  latest: SystemMetricsSample;
  series: SystemMetricsSample[];
  generatedAt: string;
}

// CHG-138 — Solicitud vista desde la consola (incluye expiradas).
export interface AdminHelpRequest {
  id: string;
  publicCode: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  notificationRadiusKm: number | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  attendersCount: number;
  // CHG-148: voluntarios anónimos con datos privados que ver.
  volunteersCount: number;
  hasPhoto: boolean;
}

export interface AdminHelpRequestPage {
  items: AdminHelpRequest[];
  total: number;
  generatedAt: string;
}

export interface AdminHelpRequestDeleteReceipt {
  deleted: number;
}

// CHG-148 — Voluntario anónimo visto por el super_admin (PII descifrada).
export interface AdminHelpRequestVolunteer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  hasPhoto: boolean;
  createdAt: string;
}

export interface AdminHelpRequestVolunteerPage {
  items: AdminHelpRequestVolunteer[];
  total: number;
  generatedAt: string;
}

// CHG-139 — Reinicio absoluto: la frase exacta que exige el gateway y
// el recibo con los conteos de ambos servicios.
export const PLATFORM_RESET_CONFIRMATION = "REINICIAR TODO";

export interface AdminPlatformResetReceipt {
  tablesCleared: number;
  accountsDeleted: number;
  generatedAt: string;
}

// CHG-154 — Registro de persona visto desde la consola: ocultamiento
// reversible (nada se borra; el borrado definitivo será otro apartado)
// y edición acotada por las reglas de integridad de estado.
export type AdminPersonStatus =
  | "missing"
  | "reported_deceased"
  | "confirmed_alive"
  | "confirmed_deceased";

export type AdminPeopleVisibility = "visible" | "hidden" | "all";

export interface AdminPersonRecord {
  id: string;
  displayName: string;
  status: AdminPersonStatus;
  location: string;
  relatedEvent: string;
  latitude: number | null;
  longitude: number | null;
  // Con caso ciudadano vinculado el estado lo derivan las novedades y
  // no se edita a mano.
  hasLinkedCase: boolean;
  source: { name: string; sourceType: string; url: string | null };
  createdAt: string;
  updatedAt: string;
  hiddenAt: string | null;
  hiddenBy: string | null;
}

export interface AdminPeoplePage {
  items: AdminPersonRecord[];
  total: number;
}

export interface AdminPeopleFilters {
  statuses?: AdminPersonStatus[];
  q?: string;
  visibility: AdminPeopleVisibility;
  limit: number;
  offset: number;
}

export interface AdminPersonUpdateInput {
  displayName?: string;
  location?: string;
  relatedEvent?: string;
  status?: AdminPersonStatus;
}

export interface AdminDataSource {
  transport: "api" | "demo";
  getCurrentAccount(signal?: AbortSignal): Promise<AuthenticatedAccount>;
  getOverview(signal?: AbortSignal): Promise<AdminOverview>;
  listSubmissions(
    filters: AdminSubmissionFilters,
    signal?: AbortSignal,
  ): Promise<AdminSubmissionPage>;
  getSubmission(
    id: string,
    signal?: AbortSignal,
  ): Promise<AdminSubmissionDetail>;
  updateSubmission(
    id: string,
    input: AdminSubmissionEditInput,
  ): Promise<AdminSubmissionDetail>;
  decideSubmission(
    id: string,
    input: AdminDecisionInput,
  ): Promise<AdminMutationReceipt>;
  archiveSubmission(
    id: string,
    input: AdminVersionedReasonInput,
  ): Promise<AdminMutationReceipt>;
  deleteSubmissionPermanently(
    id: string,
    input: AdminVersionedReasonInput,
  ): Promise<AdminSubmissionDeleteReceipt>;
  restoreSubmission(
    id: string,
    input: AdminVersionedReasonInput,
  ): Promise<AdminMutationReceipt>;
  grantEvidenceAccess(
    submissionId: string,
    evidenceId: string,
  ): Promise<AdminEvidenceAccessGrant>;
  listAccounts(
    filters: AdminAccountFilters,
    signal?: AbortSignal,
  ): Promise<AdminAccountPage>;
  getAccount(id: string, signal?: AbortSignal): Promise<AdminAccountDetail>;
  updateAccount(
    id: string,
    input: AdminAccountUpdateInput,
  ): Promise<AdminAccountDetail>;
  revokeAccountSessions(id: string, reason: string): Promise<void>;
  listAudit(
    filters: { q?: string; limit: 10 | 25 | 50; offset: number },
    signal?: AbortSignal,
  ): Promise<AdminAuditPage>;
  listVisitorPresence(
    signal?: AbortSignal,
  ): Promise<AdminVisitorPresencePage>;
  // CHG-126: métricas del sistema donde corre el gateway.
  getSystemMetrics(signal?: AbortSignal): Promise<AdminSystemMetrics>;
  // CHG-138: gestión de solicitudes de ayuda — ver TODO (activas y
  // expiradas), borrar una a una o vaciarlas por completo.
  listHelpRequests(signal?: AbortSignal): Promise<AdminHelpRequestPage>;
  // CHG-148: voluntarios anónimos de una solicitud (PII descifrada).
  listHelpRequestVolunteers(
    id: string,
    signal?: AbortSignal,
  ): Promise<AdminHelpRequestVolunteerPage>;
  deleteHelpRequest(id: string): Promise<AdminHelpRequestDeleteReceipt>;
  purgeHelpRequests(): Promise<AdminHelpRequestDeleteReceipt>;
  // CHG-154: registros de personas — listar (con ocultos), ocultar
  // (reversible), restaurar y editar.
  listPeople(
    filters: AdminPeopleFilters,
    signal?: AbortSignal,
  ): Promise<AdminPeoplePage>;
  updatePerson(
    id: string,
    input: AdminPersonUpdateInput,
  ): Promise<AdminPersonRecord>;
  hidePerson(id: string): Promise<AdminPersonRecord>;
  restorePerson(id: string): Promise<AdminPersonRecord>;
  // CHG-165: verificación y reactivación de Centros de Acopio Local.
  listCenterVerifications(
    signal?: AbortSignal,
  ): Promise<AdminCenterVerificationsPage>;
  decideCenterVerification(
    id: string,
    input: AdminCenterVerificationDecision,
  ): Promise<AdminCenterActionReceipt>;
  reactivateCenter(id: string): Promise<AdminCenterActionReceipt>;
  // CHG-139: reinicio absoluto (frase de confirmación obligatoria).
  resetPlatform(confirm: string): Promise<AdminPlatformResetReceipt>;
  logout(): Promise<void>;
}

// CHG-165 — Verificación de Centros de Acopio Local: la bandeja trae
// los pendientes de decisión y los deshabilitados por denuncias.
// Estado operativo y verificación son independientes.
export interface AdminCenterVerification {
  id: string;
  kind: string;
  name: string;
  locationLabel: string;
  municipality: string;
  department: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  schedule: string | null;
  contact: string | null;
  createdAt: string;
  createdByAccountId: string | null;
  verificationStatus: "unverified" | "under_review" | "verified" | "rejected";
  operationalStatus:
    | "open"
    | "closed"
    | "at_capacity"
    | "under_observation"
    | "inactive";
  disabledAt: string | null;
  verifiedAt: string | null;
  activeReportsCount: number;
}

export interface AdminCenterVerificationsPage {
  pending: AdminCenterVerification[];
  disabled: AdminCenterVerification[];
}

export interface AdminCenterVerificationDecision {
  decision: "approve" | "reject";
  reason?: string;
}

export interface AdminCenterActionReceipt {
  id: string;
  verificationStatus: AdminCenterVerification["verificationStatus"];
  operationalStatus: AdminCenterVerification["operationalStatus"];
  disabledAt: string | null;
  activeReportsCount: number;
}
