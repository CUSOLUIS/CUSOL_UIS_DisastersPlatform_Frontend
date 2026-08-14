export type HumanStatus =
  | "missing"
  | "reported_deceased"
  | "confirmed_alive"
  | "confirmed_deceased";

export type SourceType =
  | "official"
  | "citizen"
  | "sensor"
  | "integration"
  | "ai_inference";

export interface HumanImpactSummary {
  missing: number;
  reportedDeceased: number;
  confirmedAlive: number;
  confirmedDeceased: number;
}

export interface PersonRecord {
  id: string;
  displayName: string;
  status: HumanStatus;
  location: string;
  relatedEvent: string;
  source: {
    name: string;
    sourceType: SourceType;
    url: string | null;
  };
  createdAt: string;
}

export interface HumanImpactOverview {
  summary: HumanImpactSummary;
  recentPeople: PersonRecord[];
  generatedAt: string;
}

export interface HumanImpactDataSource {
  transport: "fixture" | "api";
  dataKind: "demonstrative" | "operational";
  getOverview: (signal?: AbortSignal) => Promise<HumanImpactOverview>;
}

export const peoplePageSizes = [5, 10, 20, 50] as const;
export type PeoplePageSize = (typeof peoplePageSizes)[number];

export interface PeopleRecordsQuery {
  limit: PeoplePageSize;
  offset: number;
  statuses: HumanStatus[];
  q?: string;
}

export interface PeopleRecordPage {
  items: PersonRecord[];
  total: number;
  limit: number;
  offset: number;
  generatedAt: string;
}

export interface PeopleRecordsDataSource {
  transport: "fixture" | "api";
  getPage: (
    query: PeopleRecordsQuery,
    signal?: AbortSignal,
  ) => Promise<PeopleRecordPage>;
}
