import { useEffect, useState } from "react";
import { authDataSource } from "./dataSource";
import type { AuthenticatedAccount } from "./types";

// CHG-078 — Estado de sesión consultable desde cualquier vista (las
// rutas de reporte no pasan por `App`, que guarda su propio estado).
// `resolving` permite no parpadear los accesos de registro mientras
// la consulta a /api/v1/auth/me está en vuelo.
export type SessionAccountState =
  | { status: "resolving"; account: null }
  | { status: "anonymous"; account: null }
  | { status: "authenticated"; account: AuthenticatedAccount };

export type SessionAccountSource = Pick<
  typeof authDataSource,
  "getCurrentAccount"
>;

export function useSessionAccount(
  source: SessionAccountSource = authDataSource,
): SessionAccountState {
  const [state, setState] = useState<SessionAccountState>({
    status: "resolving",
    account: null,
  });

  useEffect(() => {
    let mounted = true;
    source
      .getCurrentAccount()
      .then((account) => {
        if (mounted) setState({ status: "authenticated", account });
      })
      .catch(() => {
        // Sin sesión (401), sin red o sin base URL: el flujo anónimo
        // sigue disponible y jamás se bloquea la vista.
        if (mounted) setState({ status: "anonymous", account: null });
      });
    return () => {
      mounted = false;
    };
  }, [source]);

  return state;
}
