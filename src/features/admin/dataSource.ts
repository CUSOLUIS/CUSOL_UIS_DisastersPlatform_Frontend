import { Platform } from "react-native";
import { authDataSource } from "../auth/dataSource";
import { PLATFORM_RESET_CONFIRMATION } from "./types";
import type {
  AdminAccountDetail,
  AdminAccountPage,
  AdminAuditEvent,
  AdminAuditPage,
  AdminDataSource,
  AdminHelpRequest,
  AdminHelpRequestDeleteReceipt,
  AdminHelpRequestPage,
  AdminPlatformResetReceipt,
  AdminSystemMetrics,
  AdminVisitorPresencePage,
  AdminEvidenceAccessGrant,
  AdminMutationReceipt,
  AdminOverview,
  AdminSubmissionDetail,
  AdminSubmissionPage,
  SystemMetricsSample,
} from "./types";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function readProblem(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail
      ? body.detail
      : fallback;
  } catch {
    return fallback;
  }
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (apiBaseUrl === undefined) {
    throw new AdminApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para administrar desde un dispositivo móvil.",
      503,
    );
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new AdminApiError(
      await readProblem(
        response,
        `La operación administrativa respondió con estado ${response.status}.`,
      ),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function queryString<T extends object>(values: T) {
  const query = new URLSearchParams();
  Object.entries(values as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

const apiAdminDataSource: AdminDataSource = {
  transport: "api",
  getCurrentAccount: authDataSource.getCurrentAccount,
  getOverview: (signal) =>
    apiRequest<AdminOverview>("/api/v1/admin/overview", { signal }),
  listSubmissions: (filters, signal) =>
    apiRequest<AdminSubmissionPage>(
      `/api/v1/admin/submissions${queryString(filters)}`,
      { signal },
    ),
  getSubmission: (id, signal) =>
    apiRequest<AdminSubmissionDetail>(`/api/v1/admin/submissions/${id}`, {
      signal,
    }),
  updateSubmission: (id, input) =>
    apiRequest<AdminSubmissionDetail>(`/api/v1/admin/submissions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  decideSubmission: (id, input) =>
    apiRequest<AdminMutationReceipt>(
      `/api/v1/admin/submissions/${id}/decisions`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  archiveSubmission: (id, input) =>
    apiRequest<AdminMutationReceipt>(
      `/api/v1/admin/submissions/${id}`,
      { method: "DELETE", body: JSON.stringify(input) },
    ),
  restoreSubmission: (id, input) =>
    apiRequest<AdminMutationReceipt>(
      `/api/v1/admin/submissions/${id}/restore`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  grantEvidenceAccess: (submissionId, evidenceId) =>
    apiRequest<AdminEvidenceAccessGrant>(
      `/api/v1/admin/submissions/${submissionId}/evidence/${evidenceId}/access-grants`,
      { method: "POST" },
    ),
  listAccounts: (filters, signal) =>
    apiRequest<AdminAccountPage>(
      `/api/v1/admin/accounts${queryString(filters)}`,
      { signal },
    ),
  getAccount: (id, signal) =>
    apiRequest<AdminAccountDetail>(`/api/v1/admin/accounts/${id}`, { signal }),
  updateAccount: (id, input) =>
    apiRequest<AdminAccountDetail>(`/api/v1/admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  revokeAccountSessions: (id, reason) =>
    apiRequest<void>(`/api/v1/admin/accounts/${id}/sessions`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
  listAudit: (filters, signal) =>
    apiRequest<AdminAuditPage>(
      `/api/v1/admin/audit-events${queryString(filters)}`,
      { signal },
    ),
  // CHG-066: presencia en vivo de usuarios registrados; el gateway solo
  // responde a sesiones super_admin.
  listVisitorPresence: (signal) =>
    apiRequest<AdminVisitorPresencePage>(
      "/api/v1/admin/visitor-presence",
      { signal },
    ),
  // CHG-126: métricas del sistema del host del gateway (el VPS).
  getSystemMetrics: (signal) =>
    apiRequest<AdminSystemMetrics>("/api/v1/admin/system-metrics", {
      signal,
    }),
  // CHG-138: gestión de solicitudes de ayuda.
  listHelpRequests: (signal) =>
    apiRequest<AdminHelpRequestPage>(
      "/api/v1/admin/help-requests?limit=200",
      { signal },
    ),
  deleteHelpRequest: (id) =>
    apiRequest<AdminHelpRequestDeleteReceipt>(
      `/api/v1/admin/help-requests/${id}`,
      { method: "DELETE" },
    ),
  purgeHelpRequests: () =>
    apiRequest<AdminHelpRequestDeleteReceipt>(
      "/api/v1/admin/help-requests",
      { method: "DELETE" },
    ),
  // CHG-139: reinicio absoluto de la plataforma.
  resetPlatform: (confirm) =>
    apiRequest<AdminPlatformResetReceipt>(
      "/api/v1/admin/platform-reset",
      { method: "POST", body: JSON.stringify({ confirm }) },
    ),
  logout: authDataSource.logout,
};

// CHG-138 — Solicitudes demo (una activa y una expirada) mutables,
// para ensayar el borrado uno a uno y el vaciado sin backend.
const demoHelpRequests: AdminHelpRequest[] = [
  {
    id: "5d3f9a10-1111-4c2d-9e3f-000000000001",
    publicCode: "HR-2026-DEMO0001",
    description:
      "Una familia quedó aislada por la creciente y necesita agua potable y ayuda para evacuar.",
    address: "Vereda El Salado, Piedecuesta, Santander",
    latitude: 6.9871,
    longitude: -73.0498,
    notificationRadiusKm: 10,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    expired: false,
    attendersCount: 2,
    hasPhoto: false,
  },
  {
    id: "5d3f9a10-1111-4c2d-9e3f-000000000002",
    publicCode: "HR-2026-DEMO0002",
    description:
      "Se necesitaban manos para remover escombros livianos en tres viviendas.",
    address: "Barrio La Cumbre, Floridablanca, Santander",
    latitude: 7.0703,
    longitude: -73.0862,
    notificationRadiusKm: null,
    createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    expiresAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    expired: true,
    attendersCount: 5,
    hasPhoto: false,
  },
];

const demoSubmissions: AdminSubmissionDetail[] = [
  {
    id: "bd6b621c-622e-4b85-934b-322213606722",
    kind: "unverified_building_report",
    trackingCode: "BR-2026-F24E2460",
    title: "Prueba técnica CHG-035 · no moderar",
    locationLabel: "Bucaramanga, Santander",
    status: "under_review",
    sourceLabel: "Reporte ciudadano · entorno local",
    evidenceCount: 1,
    receivedAt: "2026-08-14T19:51:39Z",
    updatedAt: "2026-08-14T19:51:39Z",
    version: 1,
    fields: [
      {
        key: "buildingReference",
        label: "Referencia del edificio",
        displayValue: "Prueba técnica CHG-035 - no moderar",
        editValue: "Prueba técnica CHG-035 - no moderar",
        classification: "private",
        editable: true,
        inputKind: "text",
      },
      {
        key: "locationReference",
        label: "Referencia de ubicación",
        displayValue: "Registro sintético para validar integración",
        editValue: "Registro sintético para validar integración",
        classification: "protected",
        editable: true,
        inputKind: "multiline",
      },
      {
        key: "reporterEmail",
        label: "Correo del reportante",
        displayValue: "i***@cusol.invalid",
        editValue: null,
        classification: "protected",
        editable: false,
        inputKind: "email",
      },
    ],
    evidence: [
      {
        id: "e7a1f11d-1f15-4f7f-9304-035000000001",
        mediaType: "image/png",
        sizeBytes: 230400,
        scanStatus: "safe",
        createdAt: "2026-08-14T19:51:39Z",
      },
    ],
    availableActions: ["accept", "reject", "request_changes", "archive"],
  },
  {
    id: "51000000-0000-4000-8000-000000000001",
    kind: "missing_person_report",
    trackingCode: "MP-2026-A1D4",
    title: "Reporte privado · caso en revisión",
    locationLabel: "Piedecuesta, Santander",
    status: "needs_information",
    sourceLabel: "Familiar reportante",
    evidenceCount: 2,
    receivedAt: "2026-08-14T17:20:00Z",
    updatedAt: "2026-08-14T18:05:00Z",
    version: 2,
    fields: [
      {
        key: "displayName",
        label: "Nombre autorizado",
        displayValue: "Persona demostrativa",
        editValue: "Persona demostrativa",
        classification: "private",
        editable: true,
        inputKind: "text",
      },
      {
        key: "circumstances",
        label: "Circunstancias",
        displayValue: "Información sintética pendiente de ampliación.",
        editValue: "Información sintética pendiente de ampliación.",
        classification: "protected",
        editable: true,
        inputKind: "multiline",
      },
    ],
    evidence: [],
    availableActions: ["accept", "reject", "request_changes", "archive"],
  },
  {
    id: "52000000-0000-4000-8000-000000000002",
    kind: "aid_location_rating",
    trackingCode: "RT-2026-442",
    title: "Valoración · Centro de acopio Campus UIS",
    locationLabel: "Bucaramanga, Santander",
    status: "accepted",
    sourceLabel: "Cuenta registrada",
    evidenceCount: 0,
    receivedAt: "2026-08-14T15:10:00Z",
    updatedAt: "2026-08-14T16:00:00Z",
    version: 3,
    fields: [
      {
        key: "rating",
        label: "Puntuación",
        displayValue: "5",
        editValue: "5",
        classification: "public",
        editable: true,
        inputKind: "number",
      },
      {
        key: "evidenceDescription",
        label: "Descripción",
        displayValue: "Lugar abierto y recepción confirmada en prueba demo.",
        editValue: "Lugar abierto y recepción confirmada en prueba demo.",
        classification: "private",
        editable: true,
        inputKind: "multiline",
      },
    ],
    evidence: [],
    availableActions: ["archive"],
  },
  {
    id: "53000000-0000-4000-8000-000000000003",
    kind: "person_status_report",
    trackingCode: "ST-2026-117",
    title: "Novedad ciudadana de localización",
    locationLabel: "Lebrija, Santander",
    status: "archived",
    sourceLabel: "Visitante anónimo",
    evidenceCount: 1,
    receivedAt: "2026-08-13T21:30:00Z",
    updatedAt: "2026-08-14T09:00:00Z",
    version: 2,
    fields: [],
    evidence: [],
    availableActions: ["restore"],
  },
];

const demoAccounts: AdminAccountDetail[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    displayName: "Administrador CUSOL",
    email: "admin@cusol.local",
    assignedRole: "super_admin",
    status: "active",
    activeSessions: 1,
    department: "Santander",
    municipality: "Bucaramanga",
    requestedAccountType: "citizen",
    organizationName: null,
    organizationRole: null,
    createdAt: "2026-08-14T20:00:00Z",
    updatedAt: "2026-08-14T20:00:00Z",
    version: 1,
  },
  {
    id: "a2000000-0000-4000-8000-000000000002",
    displayName: "Cuenta demostrativa de voluntariado",
    email: "voluntario.demo@cusol.invalid",
    assignedRole: "user",
    status: "active",
    activeSessions: 2,
    department: "Santander",
    municipality: "Girón",
    requestedAccountType: "volunteer",
    organizationName: null,
    organizationRole: null,
    createdAt: "2026-08-14T14:00:00Z",
    updatedAt: "2026-08-14T14:00:00Z",
    version: 1,
  },
  {
    id: "a3000000-0000-4000-8000-000000000003",
    displayName: "Representante demostrativo",
    email: "organizacion.demo@cusol.invalid",
    assignedRole: "moderator",
    status: "suspended",
    activeSessions: 0,
    department: "Cundinamarca",
    municipality: "Bogotá",
    requestedAccountType: "organization_representative",
    organizationName: "Organización demostrativa",
    organizationRole: "Coordinación",
    createdAt: "2026-08-13T14:00:00Z",
    updatedAt: "2026-08-14T10:00:00Z",
    version: 2,
  },
];

const demoAudit: AdminAuditEvent[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    actorAccountId: demoAccounts[0].id,
    actorDisplayName: "Administrador CUSOL",
    action: "admin_bootstrapped",
    resourceKind: "account",
    resourceId: demoAccounts[0].id,
    result: "success",
    reasonSummary: "Bootstrap local seguro",
    occurredAt: "2026-08-14T20:00:00Z",
  },
  {
    id: "d2000000-0000-4000-8000-000000000002",
    actorAccountId: demoAccounts[0].id,
    actorDisplayName: "Administrador CUSOL",
    action: "submission_reviewed",
    resourceKind: "aid_location_rating",
    resourceId: demoSubmissions[2].id,
    result: "success",
    reasonSummary: "Evidencia demostrativa consistente",
    occurredAt: "2026-08-14T16:00:00Z",
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function audit(action: string, resourceKind: string, resourceId: string, reason: string) {
  demoAudit.unshift({
    id: `demo-audit-${Date.now()}-${demoAudit.length}`,
    actorAccountId: demoAccounts[0].id,
    actorDisplayName: "Administrador CUSOL",
    action,
    resourceKind,
    resourceId,
    result: "success",
    reasonSummary: reason,
    occurredAt: nowIso(),
  });
}

function findSubmission(id: string) {
  const item = demoSubmissions.find((candidate) => candidate.id === id);
  if (!item) throw new AdminApiError("El expediente no existe.", 404);
  return item;
}

function mutationReceipt(item: AdminSubmissionDetail): AdminMutationReceipt {
  return {
    id: item.id,
    status: item.status,
    version: item.version,
    auditEventId: demoAudit[0]?.id ?? "demo-audit",
    updatedAt: item.updatedAt,
  };
}

function assertVersion(actual: number, expected: number) {
  if (actual !== expected) {
    throw new AdminApiError(
      "El registro cambió desde que lo abriste. Actualiza el detalle.",
      409,
    );
  }
}

export const demoAdminDataSource: AdminDataSource = {
  transport: "demo",
  getCurrentAccount: authDataSource.getCurrentAccount,
  async getOverview() {
    return clone({
      underReview: demoSubmissions.filter((item) => item.status === "under_review")
        .length,
      needsInformation: demoSubmissions.filter(
        (item) => item.status === "needs_information",
      ).length,
      acceptedToday: demoSubmissions.filter((item) => item.status === "accepted")
        .length,
      archived: demoSubmissions.filter((item) => item.status === "archived").length,
      activeAccounts: demoAccounts.filter((item) => item.status === "active").length,
      suspendedAccounts: demoAccounts.filter((item) => item.status === "suspended")
        .length,
      oldestPendingAt: demoSubmissions
        .filter((item) => item.status === "under_review")
        .map((item) => item.receivedAt)
        .sort()[0] ?? null,
      byKind: Array.from(new Set(demoSubmissions.map((item) => item.kind))).map(
        (kind) => ({
          kind,
          count: demoSubmissions.filter((item) => item.kind === kind).length,
        }),
      ),
      recentActivity: demoAudit.slice(0, 5).map((item) => ({
        id: item.id,
        action: item.action,
        resourceKind: item.resourceKind,
        occurredAt: item.occurredAt,
        result: item.result,
      })),
      generatedAt: nowIso(),
    });
  },
  async listSubmissions(filters) {
    const query = filters.q?.trim().toLocaleLowerCase("es-CO");
    const filtered = demoSubmissions.filter((item) => {
      if (filters.kind && item.kind !== filters.kind) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.receivedFrom && item.receivedAt < filters.receivedFrom)
        return false;
      if (filters.receivedTo && item.receivedAt > filters.receivedTo) return false;
      if (
        query &&
        !`${item.trackingCode} ${item.title} ${item.locationLabel ?? ""}`
          .toLocaleLowerCase("es-CO")
          .includes(query)
      )
        return false;
      return true;
    });
    const ordered = filtered.sort(
      (left, right) =>
        right.receivedAt.localeCompare(left.receivedAt) ||
        right.id.localeCompare(left.id),
    );
    return clone({
      items: ordered.slice(filters.offset, filters.offset + filters.limit),
      total: filtered.length,
      limit: filters.limit,
      offset: filters.offset,
      generatedAt: nowIso(),
    });
  },
  async getSubmission(id) {
    return clone(findSubmission(id));
  },
  async updateSubmission(id, input) {
    const item = findSubmission(id);
    assertVersion(item.version, input.expectedVersion);
    input.changes.forEach((change) => {
      const field = item.fields.find((candidate) => candidate.key === change.field);
      if (!field?.editable) {
        throw new AdminApiError("El campo no está autorizado para edición.", 422);
      }
      field.editValue = change.value;
      field.displayValue = change.value ?? "—";
    });
    item.version += 1;
    item.updatedAt = nowIso();
    audit("submission_updated", item.kind, item.id, input.reason);
    return clone(item);
  },
  async decideSubmission(id, input) {
    const item = findSubmission(id);
    assertVersion(item.version, input.expectedVersion);
    item.status =
      input.action === "accept"
        ? "accepted"
        : input.action === "reject"
          ? "rejected"
          : "needs_information";
    item.version += 1;
    item.updatedAt = nowIso();
    audit(`submission_${input.action}`, item.kind, item.id, input.reason);
    return clone(mutationReceipt(item));
  },
  async archiveSubmission(id, input) {
    const item = findSubmission(id);
    assertVersion(item.version, input.expectedVersion);
    item.status = "archived";
    item.availableActions = ["restore"];
    item.version += 1;
    item.updatedAt = nowIso();
    audit("submission_archived", item.kind, item.id, input.reason);
    return clone(mutationReceipt(item));
  },
  async restoreSubmission(id, input) {
    const item = findSubmission(id);
    assertVersion(item.version, input.expectedVersion);
    item.status = "under_review";
    item.availableActions = ["accept", "reject", "request_changes", "archive"];
    item.version += 1;
    item.updatedAt = nowIso();
    audit("submission_restored", item.kind, item.id, input.reason);
    return clone(mutationReceipt(item));
  },
  async grantEvidenceAccess(submissionId, evidenceId) {
    const item = findSubmission(submissionId);
    if (!item.evidence.some((evidence) => evidence.id === evidenceId)) {
      throw new AdminApiError("La evidencia no existe.", 404);
    }
    audit("evidence_access_granted", item.kind, item.id, "Acceso temporal demo");
    return {
      url: "https://example.invalid/evidencia-demo-no-disponible",
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      auditEventId: demoAudit[0].id,
    };
  },
  async listAccounts(filters) {
    const query = filters.q?.trim().toLocaleLowerCase("es-CO");
    const filtered = demoAccounts.filter((item) => {
      if (filters.role && item.assignedRole !== filters.role) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (
        query &&
        !`${item.displayName} ${item.email}`
          .toLocaleLowerCase("es-CO")
          .includes(query)
      )
        return false;
      return true;
    });
    return clone({
      items: filtered.slice(filters.offset, filters.offset + filters.limit),
      total: filtered.length,
      limit: filters.limit,
      offset: filters.offset,
      generatedAt: nowIso(),
    });
  },
  async getAccount(id) {
    const account = demoAccounts.find((item) => item.id === id);
    if (!account) throw new AdminApiError("La cuenta no existe.", 404);
    return clone(account);
  },
  async updateAccount(id, input) {
    const account = demoAccounts.find((item) => item.id === id);
    if (!account) throw new AdminApiError("La cuenta no existe.", 404);
    assertVersion(account.version, input.expectedVersion);
    if (account.assignedRole === "super_admin" && account.id === demoAccounts[0].id) {
      if (input.assignedRole && input.assignedRole !== "super_admin") {
        throw new AdminApiError("No puedes degradar al último superadministrador.", 409);
      }
      if (input.status === "suspended") {
        throw new AdminApiError("No puedes suspender al último superadministrador.", 409);
      }
    }
    if (input.assignedRole) account.assignedRole = input.assignedRole;
    if (input.status) account.status = input.status;
    account.version += 1;
    account.updatedAt = nowIso();
    audit("account_updated", "account", account.id, input.reason);
    return clone(account);
  },
  async revokeAccountSessions(id, reason) {
    const account = demoAccounts.find((item) => item.id === id);
    if (!account) throw new AdminApiError("La cuenta no existe.", 404);
    account.activeSessions = 0;
    account.version += 1;
    account.updatedAt = nowIso();
    audit("account_sessions_revoked", "account", account.id, reason);
  },
  async listAudit(filters) {
    const query = filters.q?.trim().toLocaleLowerCase("es-CO");
    const filtered = demoAudit.filter(
      (item) =>
        !query ||
        `${item.actorDisplayName} ${item.action} ${item.resourceKind} ${item.reasonSummary ?? ""}`
          .toLocaleLowerCase("es-CO")
          .includes(query),
    );
    return clone({
      items: filtered.slice(filters.offset, filters.offset + filters.limit),
      total: filtered.length,
      limit: filters.limit,
      offset: filters.offset,
      generatedAt: nowIso(),
    });
  },
  async listVisitorPresence() {
    return clone({
      items: [
        {
          presenceId: "5c0d5f2e-95a7-4a52-8f43-1d5cf0a2b901",
          latitude: 7.1193,
          longitude: -73.1227,
          accuracyMeters: 18,
          platform: "web" as const,
          authenticated: true,
          firstSeenAt: nowIso(),
          updatedAt: nowIso(),
        },
        {
          presenceId: "0d9a51fe-3f60-4d1a-9a0f-64f2caf40912",
          latitude: 7.0651,
          longitude: -73.1049,
          accuracyMeters: 32,
          platform: "android" as const,
          authenticated: true,
          firstSeenAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
      total: 2,
      windowMinutes: 30,
      generatedAt: nowIso(),
    });
  },
  // CHG-126: serie sintética con ondas suaves para trabajar sin
  // backend; cada llamada mueve la ventana como lo haría el gateway.
  async getSystemMetrics() {
    const intervalSeconds = 5;
    const points = 180;
    const memoryTotal = 8 * 1024 ** 3;
    const diskTotal = 160 * 1024 ** 3;
    const now = Date.now();
    const series: SystemMetricsSample[] = Array.from(
      { length: points },
      (_, index) => {
        const at = now - (points - 1 - index) * intervalSeconds * 1000;
        const phase = at / 60_000;
        const wave = (offset: number) =>
          (Math.sin(phase + offset) + 1) / 2;
        const memoryUsed = Math.round(
          memoryTotal * (0.42 + 0.18 * wave(0.7)),
        );
        const diskUsed = Math.round(diskTotal * 0.63);
        return {
          sampledAt: new Date(at).toISOString(),
          cpuPercent: Math.round((12 + 55 * wave(0)) * 100) / 100,
          cpuTemperatureCelsius: Math.round((46 + 12 * wave(0.9)) * 10) / 10,
          load1m: Math.round((0.4 + 1.8 * wave(0.3)) * 100) / 100,
          load5m: 0.9,
          load15m: 0.7,
          memoryTotalBytes: memoryTotal,
          memoryUsedBytes: memoryUsed,
          memoryAvailableBytes: memoryTotal - memoryUsed,
          swapTotalBytes: 2 * 1024 ** 3,
          swapUsedBytes: Math.round(0.2 * 1024 ** 3),
          diskTotalBytes: diskTotal,
          diskUsedBytes: diskUsed,
          diskFreeBytes: diskTotal - diskUsed,
          networkRxBytesPerSecond: Math.round(30_000 + 220_000 * wave(1.6)),
          networkTxBytesPerSecond: Math.round(12_000 + 80_000 * wave(2.4)),
          uptimeSeconds: 86_400 * 12 + Math.floor(at / 1000) % 86_400,
        };
      },
    );
    return clone({
      intervalSeconds,
      latest: series[series.length - 1],
      series,
      generatedAt: nowIso(),
    });
  },
  // CHG-138: solicitudes demo mutables para ensayar el borrado.
  async listHelpRequests() {
    return clone({
      items: demoHelpRequests,
      total: demoHelpRequests.length,
      generatedAt: nowIso(),
    });
  },
  async deleteHelpRequest(id) {
    const index = demoHelpRequests.findIndex((item) => item.id === id);
    if (index >= 0) {
      demoHelpRequests.splice(index, 1);
    }
    return { deleted: index >= 0 ? 1 : 0 };
  },
  async purgeHelpRequests() {
    const deleted = demoHelpRequests.length;
    demoHelpRequests.length = 0;
    return { deleted };
  },
  // CHG-139: en demo el reinicio vacía las colecciones sintéticas.
  async resetPlatform(confirm) {
    if (confirm !== PLATFORM_RESET_CONFIRMATION) {
      throw new Error("Escribe la frase de confirmación exacta.");
    }
    demoHelpRequests.length = 0;
    demoSubmissions.length = 0;
    return {
      tablesCleared: 21,
      accountsDeleted: 6,
      generatedAt: nowIso(),
    };
  },
  logout: authDataSource.logout,
};

const requestedMode = process.env.EXPO_PUBLIC_ADMIN_DATA_MODE;
export const adminDataSource =
  requestedMode === "api" ? apiAdminDataSource : demoAdminDataSource;

export { apiAdminDataSource };
