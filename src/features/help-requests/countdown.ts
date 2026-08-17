// CHG-125 — Contador regresivo de vigencia. Es puramente visual
// (DEC-125-08): la autoridad de expiración es el backend, que deja de
// devolver la solicitud; aquí solo se traduce el tiempo restante.

export function formatCountdown(expiresAt: string, now: Date): string {
  const remainingMs = Date.parse(expiresAt) - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "EXPIRADA";
  }
  const totalMinutes = Math.floor(remainingMs / 60_000);
  if (totalMinutes < 1) {
    return "EXPIRA EN MENOS DE 1 MIN";
  }
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `EXPIRA EN ${days} D ${hours} H`;
  }
  if (hours > 0) {
    return `EXPIRA EN ${hours} H ${String(minutes).padStart(2, "0")} MIN`;
  }
  return `EXPIRA EN ${minutes} MIN`;
}

export function isExpired(expiresAt: string, now: Date): boolean {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now.getTime();
}
