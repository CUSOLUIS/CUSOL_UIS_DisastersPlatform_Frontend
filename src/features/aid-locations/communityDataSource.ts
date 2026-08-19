import { Platform } from "react-native";
import { createIdempotencyKey } from "../missing-persons/reportSubmission";

// CHG-165 — Comentarios y denuncias de un Centro de Acopio Local desde
// la vista completa (/detalle-punto, CHG-164). Los comentarios se leen
// y publican por un canal único con cuenta opcional (la cookie, si
// existe, identifica al autor); la denuncia usa el canal public/me que
// dejó CHG-153, eligiendo según la sesión activa.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export interface AidLocationComment {
  id: string;
  // null → se muestra «Anónimo» (§5-B); nunca datos privados.
  authorDisplayName: string | null;
  actorKind: "anonymous" | "authenticated";
  content: string;
  // CHG-166: 1-5; null en comentarios anteriores a la mejora.
  rating: number | null;
  createdAt: string;
}

export interface AidLocationCommentsPage {
  items: AidLocationComment[];
  total: number;
  // CHG-166: promedio (1 decimal) sobre los que calificaron; un
  // backend viejo no envía los campos (quedan undefined) y se muestra
  // «Sin calificaciones aún».
  ratingAverage?: number | null;
  ratingCount?: number;
}

export type AidLocationReportCategory =
  | "no_existe"
  | "informacion_falsa"
  | "funcionamiento_irregular"
  | "seguridad"
  | "otro";

// Motivos del selector de denuncia (§10); espejo del contrato.
export const aidLocationReportCategories: Array<{
  value: AidLocationReportCategory;
  label: string;
}> = [
  { value: "no_existe", label: "El punto no existe" },
  { value: "informacion_falsa", label: "Información falsa o engañosa" },
  {
    value: "funcionamiento_irregular",
    label: "Funciona mal o está abandonado",
  },
  { value: "seguridad", label: "Situación de seguridad" },
  { value: "otro", label: "Otro motivo" },
];

export interface AidLocationReportDraft {
  category: AidLocationReportCategory;
  reason: string;
}

export interface AidLocationReportReceipt {
  locationId: string;
  reportsCount: number;
  underObservation: boolean;
  disabled: boolean;
}

// Mismos límites que valida el backend.
export const COMMENT_MIN_LENGTH = 5;
export const COMMENT_MAX_LENGTH = 1000;
export const REPORT_MIN_LENGTH = 3;
export const REPORT_MAX_LENGTH = 1000;

export interface AidLocationCommunityDataSource {
  transport: "api" | "demo";
  listComments(
    locationId: string,
    signal?: AbortSignal,
  ): Promise<AidLocationCommentsPage>;
  createComment(
    locationId: string,
    content: string,
    // CHG-166: calificación 1-5 obligatoria en comentarios nuevos.
    rating: number,
  ): Promise<AidLocationComment>;
  reportCenter(
    locationId: string,
    draft: AidLocationReportDraft,
  ): Promise<AidLocationReportReceipt>;
}

export class AidLocationCommunityApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AidLocationCommunityApiError";
    this.status = status;
  }
}

async function readProblemDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
    ) {
      return (body as { detail: string }).detail;
    }
  } catch {
    // Cuerpo ilegible: se usa el mensaje genérico.
  }
  return null;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (apiBaseUrl === undefined) {
    throw new AidLocationCommunityApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar la API.",
      0,
    );
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    // La cookie de sesión, si existe, identifica al autor; sin ella el
    // canal sigue siendo válido como anónimo.
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await readProblemDetail(response);
    throw new AidLocationCommunityApiError(
      detail ?? "La operación no está disponible en este momento.",
      response.status,
    );
  }
  return (await response.json()) as T;
}

// La denuncia conserva el canal public/me de CHG-153: con sesión va
// por /me (denunciante = cuenta); sin sesión por /public (huella).
async function hasActiveSession(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

const apiCommunityDataSource: AidLocationCommunityDataSource = {
  transport: "api",
  listComments: (locationId, signal) =>
    apiRequest<AidLocationCommentsPage>(
      `/api/v1/aid-locations/${locationId}/comments`,
      { signal },
    ),
  createComment: (locationId, content, rating) =>
    apiRequest<AidLocationComment>(
      `/api/v1/aid-locations/${locationId}/comments`,
      {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({ content, rating }),
      },
    ),
  reportCenter: async (locationId, draft) => {
    const audience = (await hasActiveSession()) ? "me" : "public";
    return apiRequest<AidLocationReportReceipt>(
      `/api/v1/${audience}/aid-locations/${locationId}/reports`,
      {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({
          category: draft.category,
          reason: draft.reason,
        }),
      },
    );
  },
};

// --- modo demostración (jest y ambientes sin API) ---------------------

function buildDemoComments(): AidLocationComment[] {
  return [
    {
      id: "demo-comment-1",
      authorDisplayName: "María Gómez",
      actorKind: "authenticated",
      content: "Hay disponibilidad para recibir ropa y alimentos.",
      rating: 5,
      createdAt: "2026-08-19T01:14:00Z",
    },
    {
      id: "demo-comment-2",
      authorDisplayName: null,
      actorKind: "anonymous",
      content: "El punto continúa abierto.",
      rating: 4,
      createdAt: "2026-08-19T00:52:00Z",
    },
  ];
}

const demoComments = new Map<string, AidLocationComment[]>();
const demoReports = new Map<string, number>();

function demoCommentsFor(locationId: string): AidLocationComment[] {
  const existing = demoComments.get(locationId);
  if (existing) return existing;
  const seeded = buildDemoComments();
  demoComments.set(locationId, seeded);
  return seeded;
}

const demoCommunityDataSource: AidLocationCommunityDataSource = {
  transport: "demo",
  async listComments(locationId) {
    const items = [...demoCommentsFor(locationId)].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    // CHG-166: mismo promedio server-side que calcula el backend.
    const rated = items.filter((comment) => comment.rating !== null);
    const ratingAverage =
      rated.length === 0
        ? null
        : Math.round(
            (rated.reduce((sum, comment) => sum + (comment.rating ?? 0), 0) /
              rated.length) *
              10,
          ) / 10;
    return {
      items,
      total: items.length,
      ratingAverage,
      ratingCount: rated.length,
    };
  },
  async createComment(locationId, content, rating) {
    const items = demoCommentsFor(locationId);
    const comment: AidLocationComment = {
      id: `demo-comment-${items.length + 1}-${locationId.slice(0, 4)}`,
      authorDisplayName: null,
      actorKind: "anonymous",
      content,
      rating,
      // Posterior a los sembrados para conservar el orden DESC.
      createdAt: new Date(
        Date.parse("2026-08-19T02:00:00Z") + items.length * 60_000,
      ).toISOString(),
    };
    items.push(comment);
    return comment;
  },
  async reportCenter(locationId) {
    const count = (demoReports.get(locationId) ?? 0) + 1;
    demoReports.set(locationId, count);
    return {
      locationId,
      reportsCount: count,
      underObservation: count >= 10,
      disabled: count >= 20,
    };
  },
};

const requestedMode = process.env.EXPO_PUBLIC_AID_LOCATION_COMMUNITY_DATA_MODE;
export const aidLocationCommunityDataSource =
  requestedMode === "demo"
    ? demoCommunityDataSource
    : apiCommunityDataSource;

export { apiCommunityDataSource, demoCommunityDataSource };
