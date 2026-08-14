import type { HumanStatus, SourceType } from "../human-impact/types";

export const operationalMapCategories = [
  "missing_person",
  "collection_center",
  "rubble_reviewed",
  "rubble_pending",
  "building_pending",
] as const;

export type OperationalMapCategory = (typeof operationalMapCategories)[number];

export const operationalResponseCategories = [
  "collection_center",
  "rubble_reviewed",
  "rubble_pending",
  "building_pending",
] as const satisfies readonly OperationalMapCategory[];

export type CoordinatePrecision = "exact" | "approximate" | "municipality";
export type VerificationStatus =
  | "unverified"
  | "under_review"
  | "verified"
  | "rejected";

export interface OperationalMapPoint {
  id: string;
  category: OperationalMapCategory;
  title: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  coordinatePrecision: CoordinatePrecision;
  verificationStatus: VerificationStatus;
  relatedDisasterId: string | null;
  description: string | null;
  source: {
    name: string;
    sourceType: SourceType;
    url: string | null;
  };
  updatedAt: string;
}

export interface OperationalMapSummary {
  missingPerson: number;
  collectionCenter: number;
  rubbleReviewed: number;
  rubblePending: number;
  buildingPending: number;
}

export interface OperationalMapOverview {
  summary: OperationalMapSummary;
  items: OperationalMapPoint[];
  generatedAt: string;
  dataClassification: "demonstrative" | "operational";
}

export interface OperationalMapDataSource {
  transport: "fixture" | "api";
  initialOverview?: OperationalMapOverview;
  getOverview: (signal?: AbortSignal) => Promise<OperationalMapOverview>;
}

export const humanMapStatuses = [
  "missing",
  "reported_deceased",
  "confirmed_alive",
  "confirmed_deceased",
] as const satisfies readonly HumanStatus[];

export interface HumanMapStatusCounts {
  missing: number;
  reportedDeceased: number;
  confirmedAlive: number;
  confirmedDeceased: number;
}

export interface HumanMapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface HumanMapCluster {
  kind: "cluster";
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  statusCounts: HumanMapStatusCounts;
  bounds: HumanMapBounds;
}

export interface HumanMapPoint {
  kind: "point";
  id: string;
  status: HumanStatus;
  latitude: number;
  longitude: number;
  coordinatePrecision: Exclude<CoordinatePrecision, "exact">;
  verificationStatus: VerificationStatus;
  source: {
    name: string;
    sourceType: SourceType;
    url: string | null;
  };
  updatedAt: string;
}

export type HumanMapFeature = HumanMapCluster | HumanMapPoint;

export interface HumanMapOverview {
  features: HumanMapFeature[];
  totalMatched: number;
  totalMapped: number;
  unmappedCount: number;
  returnedFeatures: number;
  nextCursor: string | null;
  generatedAt: string;
  dataClassification: "demonstrative" | "operational";
}

export interface HumanMapViewport {
  bounds: HumanMapBounds;
  zoom: number;
}

export interface HumanMapQuery extends HumanMapViewport {
  statuses: HumanStatus[];
}

export interface HumanMapDataSource {
  transport: "fixture" | "api";
  initialOverview?: HumanMapOverview;
  getOverview: (
    query: HumanMapQuery,
    signal?: AbortSignal,
  ) => Promise<HumanMapOverview>;
}

export interface OperationalMapCanvasProps {
  points: OperationalMapPoint[];
  selectedId: string | null;
  onSelect: (pointId: string) => void;
  compact: boolean;
  humanFeatures?: HumanMapFeature[];
  selectedHumanFeatureId?: string | null;
  onSelectHumanFeature?: (featureId: string) => void;
  onViewportChange?: (viewport: HumanMapViewport) => void;
}
