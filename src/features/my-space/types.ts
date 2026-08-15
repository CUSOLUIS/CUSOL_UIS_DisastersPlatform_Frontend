// CHG-069 — "Mi espacio": reportes propios con novedades de terceros
// y alertas ciudadanas de voluntariado.

export interface MyReportNovelty {
  claimedOutcome: "found" | "deceased";
  moderationStatus:
    | "under_review"
    | "needs_information"
    | "accepted"
    | "rejected"
    | "archived";
  receivedAt: string;
}

export interface MyReportSummary {
  id: string;
  kind: "missing_person_report" | "unverified_building_report";
  referenceCode: string;
  title: string;
  status: string;
  receivedAt: string;
  novelties: MyReportNovelty[];
}

export interface MyReportsPage {
  items: MyReportSummary[];
  total: number;
  generatedAt: string;
}

export interface VolunteerAlert {
  id: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  status: "active" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerAlertPage {
  items: VolunteerAlert[];
  total: number;
  generatedAt: string;
}

export interface VolunteerAlertInput {
  description: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface MySpaceDataSource {
  transport: "api" | "demo";
  getMyReports(signal?: AbortSignal): Promise<MyReportsPage>;
  listVolunteerAlerts(signal?: AbortSignal): Promise<VolunteerAlertPage>;
  createVolunteerAlert(input: VolunteerAlertInput): Promise<VolunteerAlert>;
  resolveVolunteerAlert(id: string): Promise<VolunteerAlert>;
}
