import type { SelectedPhoto } from "../missing-persons/reportTypes";
import type { SourceType } from "../human-impact/types";
import type { VerificationStatus } from "../operational-map/types";

export const humanitarianDirectoryKinds = [
  "missing_person",
  "collection_center",
  "collection_point",
] as const;

export type HumanitarianDirectoryKind =
  (typeof humanitarianDirectoryKinds)[number];

export type PublicPersonStatus = "missing" | "found" | "deceased";
export type AidLocationAvailability = "active" | "inactive" | "unknown";
export type AidSupplyCategory =
  | "water"
  | "food"
  | "medicine"
  | "clothing"
  | "tools"
  | "shelter"
  | "other";

export type DirectoryFilter =
  | "all"
  | "missing"
  | "found"
  | "deceased"
  | "verified"
  | "open"
  | "active"
  | "rating_4";

interface DirectoryCardBase {
  id: string;
  updatedAt: string;
  dataClassification: "demonstrative" | "operational";
}

export interface MissingPersonDirectoryCard extends DirectoryCardBase {
  kind: "missing_person";
  publicCaseCode: string;
  displayName: string;
  status: PublicPersonStatus;
  approximateAge: number | null;
  lastSeenAt: string;
  lastSeenArea: string;
  municipality: string;
  department: string;
  publicPhotoUrl: string | null;
  source: {
    name: string;
    sourceType: SourceType;
    url: string | null;
  };
}

export interface AidLocationDirectoryCard extends DirectoryCardBase {
  kind: "collection_center" | "collection_point";
  name: string;
  locationLabel: string;
  municipality: string;
  department: string;
  verificationStatus: VerificationStatus;
  availabilityStatus: AidLocationAvailability;
  openNow: boolean | null;
  acceptedSupplies: AidSupplyCategory[];
  averageRating: number | null;
  ratingsCount: number;
  source: {
    name: string;
    sourceType: SourceType;
    url: string | null;
  };
}

export type HumanitarianDirectoryItem =
  | MissingPersonDirectoryCard
  | AidLocationDirectoryCard;

export interface HumanitarianDirectoryQuery {
  kind: HumanitarianDirectoryKind;
  query: string;
  filter: DirectoryFilter;
  limit?: number;
  offset?: number;
}

export interface HumanitarianDirectorySearchResponse {
  items: HumanitarianDirectoryItem[];
  total: number;
  limit: number;
  offset: number;
  query: string;
  kind: HumanitarianDirectoryKind;
  generatedAt: string;
}

export interface HumanitarianDirectoryDataSource {
  transport: "fixture" | "api";
  search(
    query: HumanitarianDirectoryQuery,
    signal?: AbortSignal,
  ): Promise<HumanitarianDirectorySearchResponse>;
}

interface ContributionBase {
  targetId: string;
  evidenceDescription: string;
  photos: SelectedPhoto[];
  truthConfirmed: true;
  reviewAcknowledged: true;
}

export interface MissingPersonStatusContribution extends ContributionBase {
  kind: "missing_person_status";
  claimedOutcome: "found" | "deceased";
}

export interface AidLocationRatingContribution extends ContributionBase {
  kind: "aid_location_rating";
  rating: number;
}

export type CommunityContribution =
  | MissingPersonStatusContribution
  | AidLocationRatingContribution;

// CHG-124: `health_sector` es una sesión autenticada cuyo perfil de
// salud verificado hace que el desenlace declarado se aplique de
// inmediato (CHG-077) y que un fallecimiento quede como muerte
// CONFIRMADA; el formulario lo usa para mostrar el aviso.
export type ContributionActorKind =
  | "anonymous"
  | "authenticated"
  | "health_sector";

export interface CommunityContributionReceipt {
  id: string;
  status: "under_review";
  actorKind: ContributionActorKind;
  receivedAt: string;
}

export interface CommunityContributionDataSource {
  transport: "fixture" | "api";
  getActorKind(signal?: AbortSignal): Promise<ContributionActorKind>;
  submit(
    contribution: CommunityContribution,
    actorKind: ContributionActorKind,
    signal?: AbortSignal,
  ): Promise<CommunityContributionReceipt>;
}

// CHG-077 — Novedades públicas de una persona: qué dicen quienes la
// vieron, sin identidad del reportante ni fotografías.
export type PersonNoveltyReporterKind =
  | "anonymous"
  | "authenticated"
  | "health_sector";

export interface PersonStatusReportPublic {
  id: string;
  claimedOutcome: "found" | "deceased";
  evidenceDescription: string;
  locationDescription: string | null;
  occurredAt: string | null;
  receivedAt: string;
  reporterKind: PersonNoveltyReporterKind;
  moderationStatus: "under_review" | "accepted";
}

export interface PersonStatusReportsPage {
  personId: string;
  publicStatus: PublicPersonStatus;
  items: PersonStatusReportPublic[];
  total: number;
}

export type FetchPersonNovelties = (
  personId: string,
) => Promise<PersonStatusReportsPage>;
