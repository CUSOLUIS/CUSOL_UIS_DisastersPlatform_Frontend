import { Platform } from "react-native";
import type {
  AccountRegistrationInput,
  AccountRegistrationReceipt,
  AccountSessionInput,
  AuthDataSource,
  AuthenticatedAccount,
  EmailVerificationResult,
} from "./types";

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl = configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

async function readProblem(response: Response, fallback: string): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: unknown };
    return typeof problem.detail === "string" ? problem.detail : fallback;
  } catch {
    return fallback;
  }
}

async function register(
  input: AccountRegistrationInput,
): Promise<AccountRegistrationReceipt> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para registrar desde un dispositivo móvil.",
    );
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/auth/registrations`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readProblem(
        response,
        `El registro respondió con estado ${response.status}.`,
      ),
    );
  }

  return (await response.json()) as AccountRegistrationReceipt;
}

async function login(input: AccountSessionInput): Promise<AuthenticatedAccount> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para iniciar sesión desde un dispositivo móvil.",
    );
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/auth/sessions`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Correo o contraseña incorrectos."
        : await readProblem(
            response,
            `El inicio de sesión respondió con estado ${response.status}.`,
          ),
    );
  }

  return (await response.json()) as AuthenticatedAccount;
}

async function verifyEmail(token: string): Promise<EmailVerificationResult> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para verificar el correo desde un dispositivo móvil.",
    );
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/auth/email-verifications`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? "El enlace de verificación es inválido, venció o ya fue utilizado."
        : await readProblem(
            response,
            `La verificación respondió con estado ${response.status}.`,
          ),
    );
  }

  return (await response.json()) as EmailVerificationResult;
}

async function getCurrentAccount(
  signal?: AbortSignal,
): Promise<AuthenticatedAccount> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar la sesión desde un dispositivo móvil.",
    );
  }
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Tu sesión está ausente, venció o fue revocada."
        : await readProblem(
            response,
            `La consulta de sesión respondió con estado ${response.status}.`,
          ),
    );
  }
  return (await response.json()) as AuthenticatedAccount;
}

async function logout(): Promise<void> {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_BASE_URL para cerrar sesión desde un dispositivo móvil.",
    );
  }
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/sessions/current`, {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      await readProblem(
        response,
        `El cierre de sesión respondió con estado ${response.status}.`,
      ),
    );
  }
}

export const authDataSource: AuthDataSource = {
  register,
  login,
  verifyEmail,
  getCurrentAccount,
  logout,
};
