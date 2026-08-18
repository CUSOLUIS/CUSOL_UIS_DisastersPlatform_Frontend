// CHG-149 — Estado «visto» del contador de notificaciones, por cuenta.
//
// Guarda cuántas notificaciones no atendidas ya vio la persona, para
// que el contador rojo solo aparezca cuando llega algo NUEVO y se
// limpie tras leer el mini-resumen. En web persiste en localStorage;
// en nativo (sin AsyncStorage en el proyecto) queda en memoria de la
// sesión, mismo patrón que `visitorPresence`.

const memory = new Map<string, number>();

function storage(): Storage | null {
  try {
    return (
      (globalThis as unknown as { localStorage?: Storage }).localStorage ??
      null
    );
  } catch {
    return null;
  }
}

function key(accountId: string): string {
  return `cusol.notifications.seen.${accountId}`;
}

export function getSeenNotificationCount(accountId: string): number {
  const store = storage();
  if (store) {
    const raw = store.getItem(key(accountId));
    const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return memory.get(accountId) ?? 0;
}

export function setSeenNotificationCount(
  accountId: string,
  count: number,
): void {
  const store = storage();
  if (store) {
    store.setItem(key(accountId), String(count));
    return;
  }
  memory.set(accountId, count);
}

// Para pruebas: limpia el estado en memoria.
export function resetNotificationsStoreForTests(): void {
  memory.clear();
}
