/**
 * CHG-105 — La API entrega la fotografía como ruta relativa. En web el
 * navegador la resuelve sola, pero en la app instalada no hay origen:
 * sin base absoluta la imagen no carga y la ficha vuelve a mostrar el
 * marcador genérico, que es justo el síntoma reportado.
 */

import { resolvePublicMediaUrl } from "./publicMediaUrl";

const RUTA = "/api/v1/public/missing-persons/abc-123/photo";

it("compone la URL absoluta con la base de la API", () => {
  expect(resolvePublicMediaUrl(RUTA, "https://api.test")).toBe(
    "https://api.test/api/v1/public/missing-persons/abc-123/photo",
  );
});

it("en web, con base vacía, deja la ruta tal cual", () => {
  // El navegador la resuelve contra el origen de la página.
  expect(resolvePublicMediaUrl(RUTA, "")).toBe(RUTA);
});

it("respeta una URL que ya viene absoluta", () => {
  const absoluta = "https://cdn.test/foto.jpg";
  expect(resolvePublicMediaUrl(absoluta, "https://api.test")).toBe(
    absoluta,
  );
});

it("sin recurso no hay URL", () => {
  expect(resolvePublicMediaUrl(null, "https://api.test")).toBeNull();
  expect(resolvePublicMediaUrl(undefined, "https://api.test")).toBeNull();
  expect(resolvePublicMediaUrl("", "https://api.test")).toBeNull();
});

it("sin base para resolver devuelve null en vez de una imagen rota", () => {
  // Es el caso de la app instalada sin EXPO_PUBLIC_API_BASE_URL: mejor
  // el marcador de posición que un hueco roto.
  expect(resolvePublicMediaUrl(RUTA, undefined)).toBeNull();
});

it("no duplica la barra si la ruta no la trae", () => {
  expect(
    resolvePublicMediaUrl("api/v1/x/photo", "https://api.test"),
  ).toBe("https://api.test/api/v1/x/photo");
});
