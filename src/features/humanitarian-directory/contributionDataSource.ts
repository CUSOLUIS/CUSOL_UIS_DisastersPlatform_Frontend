import { Platform } from "react-native";
import { createIdempotencyKey } from "../missing-persons/reportSubmission";
import type { SelectedPhoto } from "../missing-persons/reportTypes";
import type {
  CommunityContribution,
  CommunityContributionDataSource,
  CommunityContributionReceipt,
  ContributionActorKind,
} from "./types";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

const contributionTransport =
  process.env.EXPO_PUBLIC_COMMUNITY_CONTRIBUTION_DATA_MODE === "demo"
    ? "fixture"
    : "api";

async function getActorKindFromApi(
  signal?: AbortSignal,
): Promise<ContributionActorKind> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para identificar la sesión activa.",
    );
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });

  if (response.status === 401) return "anonymous";
  if (!response.ok) {
    throw new Error(
      `No fue posible comprobar la sesión (estado ${response.status}).`,
    );
  }
  return "authenticated";
}

async function appendPhoto(body: FormData, photo: SelectedPhoto) {
  const type = photo.mimeType ?? "image/jpeg";
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    body.append(
      "photos",
      blob.type ? blob : new Blob([blob], { type }),
      photo.name,
    );
    return;
  }

  body.append("photos", {
    uri: photo.uri,
    name: photo.name,
    type,
  } as unknown as Blob);
}

function serializePayload(contribution: CommunityContribution): string {
  if (contribution.kind === "missing_person_status") {
    return JSON.stringify({
      claimedOutcome: contribution.claimedOutcome,
      evidenceDescription: contribution.evidenceDescription.trim(),
      truthConfirmed: contribution.truthConfirmed,
      reviewAcknowledged: contribution.reviewAcknowledged,
    });
  }

  return JSON.stringify({
    rating: contribution.rating,
    evidenceDescription: contribution.evidenceDescription.trim(),
    truthConfirmed: contribution.truthConfirmed,
    reviewAcknowledged: contribution.reviewAcknowledged,
  });
}

async function readProblemDetail(response: Response): Promise<string | null> {
  try {
    const problem = (await response.json()) as { detail?: unknown };
    return typeof problem.detail === "string" ? problem.detail : null;
  } catch {
    return null;
  }
}

export function contributionEndpoint(
  contribution: CommunityContribution,
  actorKind: ContributionActorKind,
): string {
  const audience = actorKind === "authenticated" ? "me" : "public";
  return contribution.kind === "missing_person_status"
    ? `/api/v1/${audience}/missing-persons/${contribution.targetId}/status-reports`
    : `/api/v1/${audience}/aid-locations/${contribution.targetId}/ratings`;
}

async function submitToApi(
  contribution: CommunityContribution,
  actorKind: ContributionActorKind,
  signal?: AbortSignal,
): Promise<CommunityContributionReceipt> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para enviar evidencia desde un dispositivo móvil.",
    );
  }

  const body = new FormData();
  const serializedPayload = serializePayload(contribution);
  if (Platform.OS === "web") {
    body.append(
      "payload",
      new Blob([serializedPayload], { type: "application/json" }),
    );
  } else {
    body.append("payload", serializedPayload);
  }

  for (const photo of contribution.photos) {
    await appendPhoto(body, photo);
  }

  const response = await fetch(
    `${apiBaseUrl}${contributionEndpoint(contribution, actorKind)}`,
    {
      method: "POST",
      credentials: actorKind === "authenticated" ? "include" : "omit",
      headers: {
        Accept: "application/json",
        "Idempotency-Key": createIdempotencyKey(),
      },
      body,
      signal,
    },
  );

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? "La sesión venció. Vuelve a iniciar sesión o elige aportar públicamente."
        : response.status === 404
          ? "El servicio de aportes todavía no está disponible en el backend."
          : `El aporte respondió con estado ${response.status}.`;

    const detail = await readProblemDetail(response);
    throw new Error(detail ?? fallback);
  }

  const receipt = (await response.json()) as CommunityContributionReceipt;
  if (
    !receipt.id ||
    receipt.status !== "under_review" ||
    receipt.actorKind !== actorKind ||
    !receipt.receivedAt
  ) {
    throw new Error("La API devolvió una constancia de aporte incompleta.");
  }
  return receipt;
}

async function submitFixture(
  _contribution: CommunityContribution,
  actorKind: ContributionActorKind,
): Promise<CommunityContributionReceipt> {
  return {
    id: `demo-${Date.now().toString(36)}`,
    status: "under_review",
    actorKind,
    receivedAt: new Date().toISOString(),
  };
}

export const communityContributionDataSource: CommunityContributionDataSource = {
  transport: contributionTransport,
  getActorKind:
    contributionTransport === "fixture"
      ? async () => "anonymous"
      : getActorKindFromApi,
  submit: contributionTransport === "fixture" ? submitFixture : submitToApi,
};
