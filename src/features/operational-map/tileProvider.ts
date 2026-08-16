// CHG-109 — Proveedor de teselas del mapa.
//
// Las teselas se pedían a `tile.openstreetmap.org`, que son los
// servidores voluntarios de OSM. Su política de uso no admite
// aplicaciones y desde el bloqueo devuelven una imagen que dice
// "Access blocked" — con **HTTP 200**, así que el navegador la pinta
// como si fuera el mapa y ningún `onError` se entera.
//
// Sobre el `User-Agent`: no es una vía posible aquí. Es una cabecera
// prohibida para el código de página (la especificación de Fetch no
// deja fijarla) y las teselas se cargan como elementos de imagen, que
// siempre usan el del navegador. Añadirlo era imposible en web y, aun
// pudiendo, el bloqueo responde al patrón de uso, no a la
// identificación.
//
// Se cambia entonces de proveedor. Por defecto, los basemaps de CARTO:
// sirven teselas derivadas de datos de OSM, admiten aplicaciones y no
// exigen credenciales. La URL es configurable para migrar a un
// servicio con clave (Mapbox, Stadia, servidor propio) cambiando una
// variable de entorno, sin tocar código.

export interface TileProvider {
  /** Plantilla con {z}/{x}/{y}; {s} se sustituye por el subdominio. */
  urlTemplate: string;
  subdomains: string[];
  /** Texto legal que debe acompañar al mapa. */
  attribution: string;
  attributionUrl: string;
}

const CARTO_LIGHT: TileProvider = {
  urlTemplate:
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  attribution: "© OpenStreetMap contributors © CARTO",
  attributionUrl: "https://carto.com/attributions",
};

const configuredTemplate = process.env.EXPO_PUBLIC_MAP_TILE_URL?.trim();
// El tipo de `process.env` depende de los tipos que traiga el árbol de
// dependencias, así que el parámetro se anota: sin ello, en una
// instalación limpia `split` devuelve `any[]` y el compilador falla.
const configuredSubdomains: string[] | undefined =
  process.env.EXPO_PUBLIC_MAP_TILE_SUBDOMAINS?.split(",")
    .map((item: string) => item.trim())
    .filter((item: string) => item.length > 0);
const configuredAttribution =
  process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION?.trim();

export const tileProvider: TileProvider = configuredTemplate
  ? {
      urlTemplate: configuredTemplate,
      subdomains:
        configuredSubdomains && configuredSubdomains.length > 0
          ? configuredSubdomains
          : [],
      attribution: configuredAttribution || CARTO_LIGHT.attribution,
      attributionUrl: CARTO_LIGHT.attributionUrl,
    }
  : CARTO_LIGHT;

/** Reparte las teselas entre los subdominios de forma estable. */
export function tileUrl(
  zoom: number,
  x: number,
  y: number,
  provider: TileProvider = tileProvider,
): string {
  const { subdomains } = provider;
  const subdomain =
    subdomains.length > 0
      ? subdomains[Math.abs(x + y) % subdomains.length]
      : "";
  return provider.urlTemplate
    .replace("{s}", subdomain)
    .replace("{z}", String(zoom))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

/** Una tesela conocida, para sondear si el proveedor responde. */
export function probeTileUrl(
  provider: TileProvider = tileProvider,
): string {
  return tileUrl(0, 0, 0, provider);
}
