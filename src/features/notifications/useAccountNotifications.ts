import { useCallback, useEffect, useState } from "react";
import { adminDataSource } from "../admin/dataSource";
import type { AdminDataSource } from "../admin/types";
import { mySpaceDataSource } from "../my-space/dataSource";
import type { MySpaceDataSource } from "../my-space/types";
import {
  getSeenNotificationCount,
  setSeenNotificationCount,
} from "./notificationsStore";

// CHG-149 — Notificaciones no atendidas de la cuenta (decisión: AMBOS):
//   · novedades de terceros en los reportes propios (cualquier usuario);
//   · pendientes de la consola admin (solo super_admin).
// El contador rojo aparece cuando hay algo NUEVO frente a lo ya visto y
// se limpia al leer el mini-resumen (markRead).

export interface AccountNotifications {
  count: number;
  unread: boolean;
  ownNovelties: number;
  adminPending: number;
  markRead: () => void;
}

export function useAccountNotifications({
  account,
  isSuperAdmin,
  mySpace = mySpaceDataSource,
  admin = adminDataSource,
  refreshKey = 0,
}: {
  account: { id: string } | null | undefined;
  isSuperAdmin: boolean;
  mySpace?: MySpaceDataSource;
  admin?: AdminDataSource;
  refreshKey?: number;
}): AccountNotifications {
  const [ownNovelties, setOwnNovelties] = useState(0);
  const [adminPending, setAdminPending] = useState(0);
  const [seen, setSeen] = useState(0);

  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!accountId) {
      setOwnNovelties(0);
      setAdminPending(0);
      setSeen(0);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setSeen(getSeenNotificationCount(accountId));

    void (async () => {
      try {
        const reports = await mySpace.getMyReports(controller.signal);
        if (!cancelled) {
          setOwnNovelties(
            reports.items.reduce(
              (sum, report) => sum + report.novelties.length,
              0,
            ),
          );
        }
      } catch {
        // Mejor esfuerzo: sin datos no hay contador, nunca rompe la
        // portada.
        if (!cancelled) {
          setOwnNovelties(0);
        }
      }

      if (!isSuperAdmin) {
        if (!cancelled) {
          setAdminPending(0);
        }
        return;
      }
      try {
        const overview = await admin.getOverview(controller.signal);
        if (!cancelled) {
          setAdminPending(overview.underReview + overview.needsInformation);
        }
      } catch {
        if (!cancelled) {
          setAdminPending(0);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountId, isSuperAdmin, mySpace, admin, refreshKey]);

  const count = ownNovelties + adminPending;

  const markRead = useCallback(() => {
    if (!accountId) {
      return;
    }
    setSeenNotificationCount(accountId, count);
    setSeen(count);
  }, [accountId, count]);

  return {
    count,
    unread: count > seen,
    ownNovelties,
    adminPending,
    markRead,
  };
}
