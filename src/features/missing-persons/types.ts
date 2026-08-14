export interface MissingPersonPublicRecord {
  id: string;
  publicCaseCode: string;
  displayName: string;
  aliases: string[];
  approximateAge: number | null;
  lastSeenAt: string;
  lastSeenArea: string;
  municipality: string;
  department: string;
  clothingDescription: string | null;
  physicalDescription: string | null;
  distinctiveMarks: string | null;
  publicPhotoUrl: string | null;
  mapPointId: string | null;
  updatedAt: string;
  dataClassification: "demonstrative" | "operational";
}

export interface MissingPersonSearchResponse {
  items: MissingPersonPublicRecord[];
  total: number;
  query: string;
}

export interface MissingPersonSearchDataSource {
  transport: "fixture" | "api";
  search: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<MissingPersonSearchResponse>;
}
