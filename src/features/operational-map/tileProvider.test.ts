/**
 * CHG-109 — El mapa pedía teselas a los servidores voluntarios de OSM,
 * cuya política no admite aplicaciones. Desde el bloqueo devolvían una
 * imagen "Access blocked" con HTTP 200, así que se pintaba como si
 * fuera el mapa y ningún manejador de error se enteraba.
 */

import {
  probeTileUrl,
  tileProvider,
  tileUrl,
  type TileProvider,
} from "./tileProvider";

const PROVEEDOR_DE_PRUEBA: TileProvider = {
  urlTemplate: "https://{s}.ejemplo.test/{z}/{x}/{y}.png",
  subdomains: ["a", "b"],
  attribution: "© Alguien",
  attributionUrl: "https://ejemplo.test/attributions",
};

it("no vuelve a los servidores voluntarios de OSM", () => {
  // Esta es la lección del incidente: ese host bloquea aplicaciones.
  expect(tileProvider.urlTemplate).not.toContain("tile.openstreetmap.org");
  expect(probeTileUrl()).not.toContain("tile.openstreetmap.org");
});

it("compone la URL sustituyendo zoom, columna y fila", () => {
  // El subdominio sale de (x + y) % nº de subdominios: 9+14 = 23 → "b".
  expect(tileUrl(5, 9, 14, PROVEEDOR_DE_PRUEBA)).toBe(
    "https://b.ejemplo.test/5/9/14.png",
  );
});

it("reparte las teselas entre los subdominios de forma estable", () => {
  const primera = tileUrl(5, 9, 14, PROVEEDOR_DE_PRUEBA);
  const otra = tileUrl(5, 10, 14, PROVEEDOR_DE_PRUEBA);

  expect(primera).toContain("//b.");
  expect(otra).toContain("//a.");
  // Estable: la misma tesela siempre sale del mismo subdominio.
  expect(tileUrl(5, 9, 14, PROVEEDOR_DE_PRUEBA)).toBe(primera);
});

it("funciona con un proveedor sin subdominios", () => {
  const propio: TileProvider = {
    urlTemplate: "https://mapas.propios.test/{z}/{x}/{y}.png",
    subdomains: [],
    attribution: "© Propio",
    attributionUrl: "https://mapas.propios.test",
  };

  expect(tileUrl(3, 1, 2, propio)).toBe(
    "https://mapas.propios.test/3/1/2.png",
  );
});

it("declara la atribución que el proveedor exige", () => {
  // Usar teselas derivadas de OSM obliga a citar a sus colaboradores.
  expect(tileProvider.attribution).toMatch(/OpenStreetMap/i);
  expect(tileProvider.attributionUrl).toMatch(/^https:\/\//);
});

it("el sondeo apunta a una tesela que siempre existe", () => {
  expect(probeTileUrl(PROVEEDOR_DE_PRUEBA)).toBe(
    "https://a.ejemplo.test/0/0/0.png",
  );
});
