// CHG-128 — La app instalada exige estar en la última versión.
// La revisión del build viaja embebida en el APK
// (EXPO_PUBLIC_APP_REVISION, el commit de main que lo compiló) y el
// workflow publica junto al APK el manifiesto con la revisión vigente.
// DEC-128-03: sin confirmación positiva de versión nueva la app
// continúa — bloquear por un fallo de red dejaría inservible una app
// de emergencias justo cuando más se necesita.

const productionBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://cusoldisasterplatform.com"
).replace(/\/$/, "");

export const APP_UPDATE_MANIFEST_URL = `${productionBaseUrl}/descargas/cusol-disasters.version.json`;
export const APP_DOWNLOAD_URL = `${productionBaseUrl}/descargas/cusol-disasters.apk`;

const FETCH_TIMEOUT_MS = 8_000;

// Solo los APK compilados por CI llevan revisión; web, desarrollo
// local y pruebas no, y en esos casos el portón queda inactivo.
export function embeddedAppRevision(): string | null {
  const revision = process.env.EXPO_PUBLIC_APP_REVISION?.trim();
  return revision ? revision : null;
}

export async function fetchLatestAppRevision(
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFn(APP_UPDATE_MANIFEST_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    // Hasta el primer push que publique el manifiesto, esta URL
    // devuelve el fallback HTML del SPA: el parse falla y se continúa.
    const manifest: unknown = await response.json();
    const revision = (manifest as { revision?: unknown })?.revision;
    return typeof revision === "string" && revision.trim()
      ? revision.trim()
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function updateRequired(
  embedded: string | null,
  latest: string | null,
): boolean {
  return embedded !== null && latest !== null && embedded !== latest;
}
