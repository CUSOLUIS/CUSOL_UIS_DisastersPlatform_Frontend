import type { AccountRole, AuthenticatedAccount } from "../auth/types";

export type AdminSection = "overview" | "submissions" | "accounts" | "audit";
export type AdminSubmissionKind =
  | "missing_person_report"
  | "unverified_building_report"
  | "person_status_report"
  | "aid_location_rating"
  | "collection_center_registration"
  | "collection_point_registration";
export type AdminModerationStatus =
  | "under_review"
  | "needs_information"
  | "accepted"
  | "rejected"
  | "archived";
export type AdminAction =
  | "accept"
  | "reject"
  | "request_changes"
  | "archive"
  | "restore";
export type AdminAccountStatus =
  | "pending_verification"
  | "active"
  | "suspended";

export interface AdminCountByKind {
  kind: AdminSubmissionKind;
  count: number;
}

export interface AdminActivitySummary {
  id: string;
  action: string;
  resourceKind: string;
  occurredAt: string;
  result: "success" | "denied" | "failed";
}

export interface AdminOverview {
  underReview: number;
  needsInformation: number;
  acceptedToday: number;
  archived: number;
  activeAccounts: number;
  suspendedAccounts: number;
  oldestPendingAt: string | null;
  byKind: AdminCountByKind[];
  recentActivity: AdminActivitySummary[];
  generatedAt: string;
}

export interface AdminSubmissionSummary {
  id: string;
  kind: AdminSubmissionKind;
  trackingCode: string;
  title: string;
  locationLabel: string | null;
  status: AdminModerationStatus;
  sourceLabel: string;
  evidenceCount: number;
  receivedAt: string;
  updatedAt: string;
  version: number;
}

export interface AdminSubmissionPage {
  items: AdminSubmissionSummary[];
  total: number;
  limit: 10 | 25 | 50;
  offset: number;
  generatedAt: string;
}

export interface AdminField {
  key: string;
  label: string;
  displayValue: string;
  editValue: string | null;
  classification: "public" | "private" | "protected";
  editable: boolean;
  inputKind?:
    | "text"
    | "multiline"
    | "date"
    | "time"
    | "number"
    | "email"
    | "select";
  options?: string[];
}

export interface AdminEvidence {
  id: string;
  mediaType: string;
  sizeBytes: number;
  scanStatus: "safe" | "pending" | "rejected";
  createdAt: string;
}

export interface AdminSubmissionDetail extends AdminSubmissionSummary {
  fields: AdminField[];
  evidence: AdminEvidence[];
  availableActions: AdminAction[];
}

export interface AdminSubmissionFilters {
  q?: string;
  kind?: AdminSubmissionKind;
  status?: AdminModerationStatus;
  receivedFrom?: string;
  receivedTo?: string;
  limit: 10 | 25 | 50;
  offset: number;
}

export interface AdminSubmissionEditInput {
  expectedVersion: number;
  reason: string;
  changes: Array<{ field: string; value: string | null }>;
}

export interface AdminDecisionInput {
  expectedVersion: number;
  action: "accept" | "reject" | "request_changes";
  reason: string;
}

export interface AdminVersionedReasonInput {
  expectedVersion: number;
  reason: string;
}

export interface AdminMutationReceipt {
  id: string;
  status: AdminModerationStatus;
  version: number;
  auditEventId: string;
  updatedAt: string;
}

export interface AdminEvidenceAccessGrant {
  url: string;
  expiresAt: string;
  auditEventId: string;
}

export interface AdminAccountSummary {
  id: string;
  displayName: string;
  email: string;
  assignedRole: AccountRole;
  status: AdminAccountStatus;
  activeSessions: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AdminAccountDetail extends AdminAccountSummary {
  department: string;
  municipality: string;
  requestedAccountType:
    | "citizen"
    | "volunteer"
    | "organization_representative";
  organizationName: string | null;
  organizationRole: string | null;
}

export interface AdminAccountPage {
  items: AdminAccountSummary[];
  total: number;
  limit: 10 | 25 | 50;
  offset: number;
  generatedAt: string;
}

export interface AdminAccountFilters {
  q?: string;
  role?: AccountRole;
  status?: AdminAccountStatus;
  limit: 10 | 25 | 50;
  offset: number;
}

export interface AdminAccountUpdateInput {
  expectedVersion: number;
  reason: string;
  assignedRole?: AccountRole;
  status?: AdminAccountStatus;
}

export interface AdminAuditEvent {
  id: string;
  actorAccountId: string;
  actorDisplayName: string;
  action: string;
  resourceKind: string;
  resourceId: string;
  result: "success" | "denied" | "failed";
  reasonSummary: string | null;
  occurredAt: string;
}

export interface AdminAuditPage {
  items: AdminAuditEvent[];
  total: number;
  limit: 10 | 25 | 50;
  offset: number;
  generatedAt: string;
}

export interface AdminDataSource {
  transport: "api" | "demo";
  getCurrentAccount(signal?: AbortSignal): Promise<AuthenticatedAccount>;
  getOverview(signal?: AbortSignal): Promise<AdminOverview>;
  listSubmissions(
    filters: AdminSubmissionFilters,
    signal?: AbortSignal,
  ): Promise<AdminSubmissionPage>;
  getSubmission(
    id: string,
    signal?: AbortSignal,
  ): Promise<AdminSubmissionDetail>;
  updateSubmission(
    id: string,
    input: AdminSubmissionEditInput,
  ): Promise<AdminSubmissionDetail>;
  decideSubmission(
    id: string,
    input: AdminDecisionInput,
  ): Promise<AdminMutationReceipt>;
  archiveSubmission(
    id: string,
    input: AdminVersionedReasonInput,
  ): Promise<AdminMutationReceipt>;
  restoreSubmission(
    id: string,
    input: AdminVersionedReasonInput,
  ): Promise<AdminMutationReceipt>;
  grantEvidenceAccess(
    submissionId: string,
    evidenceId: string,
  ): Promise<AdminEvidenceAccessGrant>;
  listAccounts(
    filters: AdminAccountFilters,
    signal?: AbortSignal,
  ): Promise<AdminAccountPage>;
  getAccount(id: string, signal?: AbortSignal): Promise<AdminAccountDetail>;
  updateAccount(
    id: string,
    input: AdminAccountUpdateInput,
  ): Promise<AdminAccountDetail>;
  revokeAccountSessions(id: string, reason: string): Promise<void>;
  listAudit(
    filters: { q?: string; limit: 10 | 25 | 50; offset: number },
    signal?: AbortSignal,
  ): Promise<AdminAuditPage>;
  logout(): Promise<void>;
}
