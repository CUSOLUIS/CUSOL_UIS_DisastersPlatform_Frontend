import type { HumanStatus, SourceType } from "../human-impact/types";

export const operationalMapCategories = [
  "missing_person",
  "collection_center",
  "collection_point",
  "rubble_reviewed",
  "rubble_pending",
  "building_pending",
  "community_meal",
  "temporary_shelter",
  // CHG-069: alertas ciudadanas de voluntariado.
  "volunteers_needed",
  // CHG-125: solicitudes «Necesitamos ayuda» vigentes (fusionadas en
  // cliente, DEC-125-10; nunca vienen del overview del backend).
  "help_request",
] as const;

export type OperationalMapCategory = (typeof operationalMapCategories)[number];

// CHG-049: los puntos de recolección y las ofertas comunitarias tienen
// su categoría lista; sus marcadores aparecerán cuando la moderación
// publique ubicaciones (las ofertas siguen bloqueadas por DEC-021).
export const operationalResponseCategories = [
  "collection_center",
  "collection_point",
  "rubble_reviewed",
  "rubble_pending",
  "building_pending",
  "community_meal",
  "temporary_shelter",
  "volunteers_needed",
  "help_request",
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
  // CHG-134: radio de aviso (km) de una solicitud «Necesitamos ayuda»;
  // los lienzos lo dibujan como círculo a escala. Solo lo traen los
  // puntos de la categoría help_request (no viene del overview).
  alertRadiusKm?: number;
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
  collectionPoint: number;
  rubbleReviewed: number;
  rubblePending: number;
  buildingPending: number;
  communityMeal: number;
  temporaryShelter: number;
  volunteersNeeded: number;
  // CHG-125: cuenta de solicitudes de ayuda vigentes fusionadas en
  // cliente; el backend no la envía y se normaliza a 0.
  helpRequests: number;
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
  // CHG-099: desglose por estado de quienes no se pueden dibujar; la
  // capa lo suma para mostrar el total y coincidir con las cifras.
  unmappedStatusCounts: HumanMapStatusCounts;
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
  // CHG-049: alto del lienzo ajustado al viewport para que toda la
  // sección del mapa quepa en una pantalla.
  canvasMinHeight?: number;
  humanFeatures?: HumanMapFeature[];
  selectedHumanFeatureId?: string | null;
  onSelectHumanFeature?: (featureId: string) => void;
  onViewportChange?: (viewport: HumanMapViewport) => void;
}
