export type RequestedAccountType =
  | "citizen"
  | "volunteer"
  | "organization_representative";

export type AccountRole = "user" | "moderator" | "super_admin";

export interface RegistrationDraft {
  firstNames: string;
  lastNames: string;
  email: string;
  phone: string;
  department: string;
  municipality: string;
  requestedAccountType: RequestedAccountType;
  organizationName: string;
  organizationRole: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  accuracyConfirmed: boolean;
}

export interface AccountRegistrationInput {
  firstNames: string;
  lastNames: string;
  email: string;
  phone: string | null;
  department: string;
  municipality: string;
  requestedAccountType: RequestedAccountType;
  organizationName: string | null;
  organizationRole: string | null;
  password: string;
  termsAccepted: true;
  privacyAccepted: true;
  accuracyConfirmed: true;
}

export interface AccountRegistrationReceipt {
  requestId: string;
  status: "email_verification_required";
  emailMasked: string;
  verificationExpiresAt: string;
  assignedRole: "user";
  createdAt: string;
}

export interface AccountSessionInput {
  email: string;
  password: string;
}

export interface AuthenticatedAccount {
  id: string;
  displayName: string;
  email: string;
  assignedRole: AccountRole;
  status: "active";
  sessionExpiresAt: string;
}

export interface AuthDataSource {
  register(input: AccountRegistrationInput): Promise<AccountRegistrationReceipt>;
  login(input: AccountSessionInput): Promise<AuthenticatedAccount>;
  getCurrentAccount(signal?: AbortSignal): Promise<AuthenticatedAccount>;
  logout(): Promise<void>;
}
