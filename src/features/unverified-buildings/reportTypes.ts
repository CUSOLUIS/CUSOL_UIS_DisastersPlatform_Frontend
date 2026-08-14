export type BuildingType =
  | "residential"
  | "commercial"
  | "institutional"
  | "industrial"
  | "mixed_use"
  | "other";

export type BuildingSearchStatus =
  | "not_started"
  | "interrupted"
  | "incomplete"
  | "unknown";

export type BuildingOccupancyReport =
  | "unknown"
  | "possibly_occupied"
  | "reported_empty";

export type BuildingPendingReason =
  | "access_blocked"
  | "structural_risk_observed"
  | "debris"
  | "fire_or_smoke"
  | "flooding"
  | "no_response_team"
  | "communication_loss"
  | "evacuation"
  | "other";

export type BuildingObservedCondition =
  | "obstructed_access"
  | "visible_debris"
  | "fire_or_smoke"
  | "flooding"
  | "visible_cracks"
  | "partial_collapse_observed"
  | "total_collapse_observed"
  | "other";

export interface UnverifiedBuildingReportDraft {
  buildingReference: string;
  buildingType: BuildingType;
  department: string;
  municipality: string;
  sector: string;
  locationReference: string;
  address: string;
  latitude: string;
  longitude: string;
  relatedDisasterId: string;
  observedDate: string;
  observedTime: string;
  searchStatus: BuildingSearchStatus;
  occupancyReport: BuildingOccupancyReport;
  pendingReasons: BuildingPendingReason[];
  observedConditions: BuildingObservedCondition[];
  observationDescription: string;
  reporterName: string;
  reporterRole: string;
  reporterOrganization: string;
  reporterPhone: string;
  reporterEmail: string;
  officialReportNumber: string;
  truthConfirmed: boolean;
  photoAuthorizationConfirmed: boolean;
  reviewAcknowledged: boolean;
}

export interface UnverifiedBuildingReportReceipt {
  id: string;
  publicTrackingCode: string;
  status: "under_review";
  receivedAt: string;
}
