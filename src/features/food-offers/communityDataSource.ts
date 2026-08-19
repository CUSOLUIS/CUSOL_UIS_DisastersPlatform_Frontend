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
 * CHG-176 — La comunidad de las ofertas de «Ofrecer comida».
 *
 * Implementa la MISMA interfaz que la de los centros de acopio, así que
 * el panel comunitario se reutiliza tal cual: estrellas, comentarios,
 * denuncia y borrado administrativo. Solo cambian las rutas y, en el
 * borrado del objetivo, lo que se borra es la oferta.
 */

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class FoodOfferCommunityApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FoodOfferCommunityApiError";
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
    throw new FoodOfferCommunityApiError(
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

export const apiFoodOfferCommunityDataSource: AidLocationCommunityDataSource =
  {
    transport: "api",
    listComments: (offerId, signal) =>
      apiRequest<AidLocationCommentsPage>(
        `/api/v1/food-offers/${offerId}/comments`,
        { signal },
      ),
    createComment: (offerId, content, rating) =>
      apiRequest<AidLocationComment>(
        `/api/v1/food-offers/${offerId}/comments`,
        {
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey() },
          body: JSON.stringify({ content, rating }),
        },
      ),
    reportCenter: async (offerId, draft: AidLocationReportDraft) => {
      const audience = (await hasActiveSession()) ? "me" : "public";
      return apiRequest<AidLocationReportReceipt>(
        `/api/v1/${audience}/food-offers/${offerId}/reports`,
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
    adminDeleteComment: async (offerId, commentId) => {
      await apiRequest<{ deleted: number }>(
        `/api/v1/admin/food-offers/${offerId}/comments/${commentId}`,
        { method: "DELETE" },
      );
    },
    // Aquí «el objetivo» es la oferta entera: sus comentarios y
    // denuncias caen con ella en backend.
    adminDeleteAidLocation: async (offerId) => {
      await apiRequest<{ deleted: number }>(
        `/api/v1/admin/food-offers/${offerId}`,
        { method: "DELETE" },
      );
    },
  };

// --- modo demostración (jest y ambientes sin API) ---------------------

const demoComments = new Map<string, AidLocationComment[]>();
const demoReports = new Map<string, number>();

export const demoFoodOfferCommunityDataSource: AidLocationCommunityDataSource =
  {
    transport: "demo",
    listComments: async (offerId) => {
      const items = demoComments.get(offerId) ?? [];
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
    createComment: async (offerId, content, rating) => {
      const comment: AidLocationComment = {
        id: `demo-${Date.now()}`,
        authorDisplayName: null,
        actorKind: "anonymous",
        content,
        rating,
        createdAt: new Date().toISOString(),
      };
      demoComments.set(offerId, [comment, ...(demoComments.get(offerId) ?? [])]);
      return comment;
    },
    reportCenter: async (offerId) => {
      const count = (demoReports.get(offerId) ?? 0) + 1;
      demoReports.set(offerId, count);
      return {
        foodOfferId: offerId,
        reportsCount: count,
        underObservation: count >= 10 && count < 20,
        disabled: count >= 20,
      } as unknown as AidLocationReportReceipt;
    },
    adminDeleteComment: async (offerId, commentId) => {
      demoComments.set(
        offerId,
        (demoComments.get(offerId) ?? []).filter(
          (comment) => comment.id !== commentId,
        ),
      );
    },
    adminDeleteAidLocation: async (offerId) => {
      demoComments.delete(offerId);
      demoReports.delete(offerId);
    },
  };

export const foodOfferCommunityDataSource: AidLocationCommunityDataSource =
  process.env.EXPO_PUBLIC_FOOD_OFFERS_DATA_MODE === "demo"
    ? demoFoodOfferCommunityDataSource
    : apiFoodOfferCommunityDataSource;
