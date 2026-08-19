import { decodeMapPointDetail, encodeMapPointDetail } from "./pointDetail";
import type { MapPointDetailPayload } from "./pointDetail";
import { normalizeOperationalMapOverview } from "./dataSource";
import { operationalMapDemoData } from "./demoData";
import type { HumanMapPoint } from "./types";

// CHG-164 — El registro del «VER MÁS» viaja serializado en la URL de
// /detalle-punto; ida y vuelta sin pérdidas, y nulo ante basura.

const point = normalizeOperationalMapOverview(operationalMapDemoData).items[0];

const humanFeature: HumanMapPoint = {
  kind: "point",
  id: "hp-1",
  status: "missing",
  latitude: 6.9,
  longitude: -73.1,
  coordinatePrecision: "approximate",
  verificationStatus: "under_review",
  source: { name: "Reporte ciudadano", sourceType: "citizen", url: null },
  updatedAt: "2026-08-18T12:00:00Z",
};

it("codifica y decodifica un punto operativo sin pérdidas", () => {
  const payload: MapPointDetailPayload = { kind: "operational", point };
  expect(decodeMapPointDetail(encodeMapPointDetail(payload))).toEqual(payload);
});

it("codifica y decodifica un punto humano anónimo", () => {
  const payload: MapPointDetailPayload = {
    kind: "human",
    feature: humanFeature,
  };
  expect(decodeMapPointDetail(encodeMapPointDetail(payload))).toEqual(payload);
});

it("codifica y decodifica solicitudes y ofertas vigentes", () => {
  const request = {
    id: "r1",
    description: "Necesitamos agua potable.",
    address: "Barrio Girardot, Bucaramanga",
    latitude: 7.12,
    longitude: -73.12,
    notificationRadiusKm: 5,
    createdAt: "2026-08-19T00:00:00Z",
    expiresAt: "2026-08-19T12:00:00Z",
    attendersCount: 2,
    attendedByMe: false,
    photoUrl: null,
  };
  const offer = {
    id: "o1",
    description: "Olla comunitaria de almuerzo.",
    address: "Cancha del barrio",
    latitude: 7.11,
    longitude: -73.13,
    notificationRadiusKm: null,
    createdAt: "2026-08-19T00:00:00Z",
    expiresAt: "2026-08-19T18:00:00Z",
  };
  expect(
    decodeMapPointDetail(
      encodeMapPointDetail({ kind: "help_request", request }),
    ),
  ).toEqual({ kind: "help_request", request });
  expect(
    decodeMapPointDetail(encodeMapPointDetail({ kind: "food_offer", offer })),
  ).toEqual({ kind: "food_offer", offer });
});

it("devuelve null ante parámetro ausente, corrupto o manipulado", () => {
  expect(decodeMapPointDetail(null)).toBeNull();
  expect(decodeMapPointDetail(undefined)).toBeNull();
  expect(decodeMapPointDetail("")).toBeNull();
  expect(decodeMapPointDetail("{recortado")).toBeNull();
  expect(decodeMapPointDetail('"texto"')).toBeNull();
  expect(decodeMapPointDetail('{"kind":"otro"}')).toBeNull();
  expect(decodeMapPointDetail('{"kind":"operational","point":{}}')).toBeNull();
  // Un clúster no tiene vista completa: jamás debe decodificar.
  expect(
    decodeMapPointDetail(
      JSON.stringify({ kind: "human", feature: { kind: "cluster", id: "c" } }),
    ),
  ).toBeNull();
});
