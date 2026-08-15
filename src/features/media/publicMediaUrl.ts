import { Platform } from "react-native";

// CHG-105 — La API devuelve la fotografía pública como ruta relativa
// (`/api/v1/public/missing-persons/{id}/photo`). En web el navegador la
// resuelve contra el origen, pero en la app instalada no hay origen que
// valga: sin base absoluta, `Image` no carga nada y la ficha vuelve a
// caer en el marcador genérico. Aquí se compone la URL absoluta con la
// misma base que usan los data sources.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

/**
 * Devuelve una URL cargable por `Image`, o `null` si no hay recurso o
 * falta la base para resolverlo (en cuyo caso la vista usa su
 * marcador de posición, que es mejor que una imagen rota).
 */
export function resolvePublicMediaUrl(
  path: string | null | undefined,
  baseUrl: string | undefined = apiBaseUrl,
): string | null {
  if (!path) {
    return null;
  }

  // Una URL absoluta ya viene resuelta desde el backend.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (baseUrl === undefined) {
    return null;
  }

  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}
