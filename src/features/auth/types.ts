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
  // CHG-077: datos opcionales del sector salud.
  healthProfession: string;
  healthLicenseNumber: string;
  healthInstitution: string;
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
  healthProfession: string | null;
  healthLicenseNumber: string | null;
  healthInstitution: string | null;
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
  // CHG-083: teléfono del perfil para precargar formularios.
  phone?: string | null;
  assignedRole: AccountRole;
  status: "active";
  sessionExpiresAt: string;
}

// CHG-051: verificar el correo activa la cuenta e inicia la sesión de
// bienvenida (el gateway materializa la cookie).
export interface EmailVerificationResult {
  status: "active";
  verifiedAt: string;
  account: AuthenticatedAccount;
}

export interface AuthDataSource {
  register(input: AccountRegistrationInput): Promise<AccountRegistrationReceipt>;
  login(input: AccountSessionInput): Promise<AuthenticatedAccount>;
  verifyEmail(token: string): Promise<EmailVerificationResult>;
  getCurrentAccount(signal?: AbortSignal): Promise<AuthenticatedAccount>;
  logout(): Promise<void>;
}
