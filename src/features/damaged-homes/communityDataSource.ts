import { Platform } from "react-native";
import { createIdempotencyKey } from "../missing-persons/reportSubmission";
import type {
  AidLocationComment,
  AidLocationCommentsPage,
  AidLocationCommunityDataSource,
  AidLocationReportDraft,
  AidLocationReportReceipt,
} from "../aid-locations/communityDataSource";

/**
 * CHG-182 — La comunidad de «Mi casita destruida».
 *
 * Implementa la MISMA interfaz que la de los centros de acopio (y que
 * las de ofertas de comida y solicitudes de ayuda), así que la ficha
 * reutiliza el panel tal cual: estrellas, comentarios, denuncia y
 * borrado administrativo. Solo cambian las rutas y, en el borrado del
 * objetivo, lo que se borra es la publicación entera con sus fotos.
 */

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class DamagedHomeCommunityApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DamagedHomeCommunityApiError";
    this.status = status;
  }
}

async function readProblemDetail(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: string };
    if (problem?.detail) return problem.detail;
  } catch {
    // problem+json ilegible: se conserva el mensaje genérico.
  }
  return fallback;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl ?? ""}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new DamagedHomeCommunityApiError(
      await readProblemDetail(
        response,
        "No fue posible completar la operación.",
      ),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// La denuncia tiene dos audiencias: con cuenta cuenta como esa cuenta,
// sin cuenta cuenta por huella. Igual que en los acopios.
async function hasActiveSession(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl ?? ""}/api/v1/auth/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const apiDamagedHomeCommunityDataSource: AidLocationCommunityDataSource =
  {
    transport: "api",
    listComments: (homeId, signal) =>
      apiRequest<AidLocationCommentsPage>(
        `/api/v1/damaged-homes/${homeId}/comments`,
        { signal },
      ),
    createComment: (homeId, content, rating) =>
      apiRequest<AidLocationComment>(
        `/api/v1/damaged-homes/${homeId}/comments`,
        {
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey() },
          body: JSON.stringify({ content, rating }),
        },
      ),
    reportCenter: async (homeId, draft: AidLocationReportDraft) => {
      const audience = (await hasActiveSession()) ? "me" : "public";
      return apiRequest<AidLocationReportReceipt>(
        `/api/v1/${audience}/damaged-homes/${homeId}/reports`,
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
    adminDeleteComment: async (homeId, commentId) => {
      await apiRequest<{ deleted: number }>(
        `/api/v1/admin/damaged-homes/${homeId}/comments/${commentId}`,
        { method: "DELETE" },
      );
    },
    // Aquí «el objetivo» es la publicación entera: comentarios,
    // denuncias y fotos caen con ella en backend.
    adminDeleteAidLocation: async (homeId) => {
      await apiRequest<{ deleted: number }>(
        `/api/v1/admin/damaged-homes/${homeId}`,
        { method: "DELETE" },
      );
    },
  };

// --- modo demostración (jest y ambientes sin API) ---------------------

const demoComments = new Map<string, AidLocationComment[]>();
const demoReports = new Map<string, number>();

export const demoDamagedHomeCommunityDataSource: AidLocationCommunityDataSource =
  {
    transport: "demo",
    listComments: async (homeId) => {
      const items = demoComments.get(homeId) ?? [];
      const rated = items.filter((item) => item.rating !== null);
      return {
        items,
        total: items.length,
        ratingAverage: rated.length
          ? Math.round(
              (rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) /
                rated.length) *
                10,
            ) / 10
          : null,
        ratingCount: rated.length,
      };
    },
    createComment: async (homeId, content, rating) => {
      const comment: AidLocationComment = {
        id: `demo-${Date.now()}`,
        authorDisplayName: null,
        actorKind: "anonymous",
        content,
        rating,
        createdAt: new Date().toISOString(),
      };
      demoComments.set(homeId, [comment, ...(demoComments.get(homeId) ?? [])]);
      return comment;
    },
    reportCenter: async (homeId) => {
      const count = (demoReports.get(homeId) ?? 0) + 1;
      demoReports.set(homeId, count);
      return {
        damagedHomeId: homeId,
        reportsCount: count,
        underObservation: count >= 10 && count < 20,
        disabled: count >= 20,
      } as unknown as AidLocationReportReceipt;
    },
    adminDeleteComment: async (homeId, commentId) => {
      demoComments.set(
        homeId,
        (demoComments.get(homeId) ?? []).filter(
          (comment) => comment.id !== commentId,
        ),
      );
    },
    adminDeleteAidLocation: async (homeId) => {
      demoComments.delete(homeId);
      demoReports.delete(homeId);
    },
  };

export const damagedHomeCommunityDataSource: AidLocationCommunityDataSource =
  process.env.EXPO_PUBLIC_DAMAGED_HOMES_DATA_MODE === "demo"
    ? demoDamagedHomeCommunityDataSource
    : apiDamagedHomeCommunityDataSource;
