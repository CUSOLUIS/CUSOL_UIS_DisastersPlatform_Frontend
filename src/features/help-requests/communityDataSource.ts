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
 * CHG-180 — La comunidad de «Necesitamos ayuda».
 *
 * Implementa la MISMA interfaz que la de los centros de acopio (y que
 * la de las ofertas de comida, CHG-176), así que el panel comunitario
 * se reutiliza tal cual: estrellas, comentarios, denuncia y borrado
 * administrativo. Solo cambian las rutas y, en el borrado del objetivo,
 * lo que se borra es la solicitud entera —que ya tenía su endpoint
 * administrativo desde CHG-138—.
 */

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class HelpRequestCommunityApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HelpRequestCommunityApiError";
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
    throw new HelpRequestCommunityApiError(
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

export const apiHelpRequestCommunityDataSource: AidLocationCommunityDataSource =
  {
    transport: "api",
    listComments: (requestId, signal) =>
      apiRequest<AidLocationCommentsPage>(
        `/api/v1/help-requests/${requestId}/comments`,
        { signal },
      ),
    createComment: (requestId, content, rating) =>
      apiRequest<AidLocationComment>(
        `/api/v1/help-requests/${requestId}/comments`,
        {
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey() },
          body: JSON.stringify({ content, rating }),
        },
      ),
    reportCenter: async (requestId, draft: AidLocationReportDraft) => {
      const audience = (await hasActiveSession()) ? "me" : "public";
      return apiRequest<AidLocationReportReceipt>(
        `/api/v1/${audience}/help-requests/${requestId}/reports`,
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
    adminDeleteComment: async (requestId, commentId) => {
      await apiRequest<{ deleted: number }>(
        `/api/v1/admin/help-requests/${requestId}/comments/${commentId}`,
        { method: "DELETE" },
      );
    },
    // Aquí «el objetivo» es la solicitud entera: sus comentarios y
    // denuncias caen con ella en backend (CASCADE), como en los acopios.
    adminDeleteAidLocation: async (requestId) => {
      await apiRequest<{ deleted: number }>(
        `/api/v1/admin/help-requests/${requestId}`,
        { method: "DELETE" },
      );
    },
  };

// --- modo demostración (jest y ambientes sin API) ---------------------

const demoComments = new Map<string, AidLocationComment[]>();
const demoReports = new Map<string, number>();

export const demoHelpRequestCommunityDataSource: AidLocationCommunityDataSource =
  {
    transport: "demo",
    listComments: async (requestId) => {
      const items = demoComments.get(requestId) ?? [];
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
    createComment: async (requestId, content, rating) => {
      const comment: AidLocationComment = {
        id: `demo-${Date.now()}`,
        authorDisplayName: null,
        actorKind: "anonymous",
        content,
        rating,
        createdAt: new Date().toISOString(),
      };
      demoComments.set(requestId, [comment, ...(demoComments.get(requestId) ?? [])]);
      return comment;
    },
    reportCenter: async (requestId) => {
      const count = (demoReports.get(requestId) ?? 0) + 1;
      demoReports.set(requestId, count);
      return {
        helpRequestId: requestId,
        reportsCount: count,
        underObservation: count >= 10 && count < 20,
        disabled: count >= 20,
      } as unknown as AidLocationReportReceipt;
    },
    adminDeleteComment: async (requestId, commentId) => {
      demoComments.set(
        requestId,
        (demoComments.get(requestId) ?? []).filter(
          (comment) => comment.id !== commentId,
        ),
      );
    },
    adminDeleteAidLocation: async (requestId) => {
      demoComments.delete(requestId);
      demoReports.delete(requestId);
    },
  };

export const helpRequestCommunityDataSource: AidLocationCommunityDataSource =
  process.env.EXPO_PUBLIC_HELP_REQUESTS_DATA_MODE === "demo"
    ? demoHelpRequestCommunityDataSource
    : apiHelpRequestCommunityDataSource;
