export type VerificationStatus =
  | "unverified"
  | "under_review"
  | "verified"
  | "rejected";

export interface SourceReference {
  name: string;
  sourceType:
    | "official"
    | "citizen"
    | "sensor"
    | "integration"
    | "ai_inference";
  url: string | null;
}

export interface DisasterEvent {
  id: string;
  title: string;
  description: string | null;
  disasterType: string;
  severity: string | null;
  verificationStatus: VerificationStatus;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string | null;
  updatedAt: string;
  source: SourceReference;
}

export interface DisasterEventList {
  items: DisasterEvent[];
  total: number;
  limit: number;
  offset: number;
}

export async function listDisasters(
  signal?: AbortSignal,
): Promise<DisasterEventList> {
  const response = await fetch("/api/v1/disasters", {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`La API respondió con estado ${response.status}`);
  }

  return (await response.json()) as DisasterEventList;
}
