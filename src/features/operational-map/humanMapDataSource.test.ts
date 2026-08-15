import {
  getHumanMapOverviewFromApi,
  validateHumanMapOverview,
} from "./humanMapDataSource";
import type { HumanMapOverview, HumanMapPoint } from "./types";

const anonymousPoint: HumanMapPoint = {
  kind: "point",
  id: "public-person-1",
  status: "confirmed_alive",
  latitude: 7.14034,
  longitude: -73.1149,
  coordinatePrecision: "approximate",
  verificationStatus: "verified",
  source: {
    name: "UNGRD",
    sourceType: "official",
    url: "https://www.gestiondelriesgo.gov.co",
  },
  updatedAt: "2026-08-10T20:51:00Z",
};

function page(
  overrides: Partial<HumanMapOverview> = {},
): HumanMapOverview {
  return {
    features: [],
    totalMatched: 3,
    totalMapped: 3,
    unmappedCount: 0,
  unmappedStatusCounts: {
    missing: 0,
    reportedDeceased: 0,
    confirmedAlive: 0,
    confirmedDeceased: 0,
    },
    returnedFeatures: 0,
    nextCursor: null,
    generatedAt: "2026-08-13T21:24:46Z",
    dataClassification: "demonstrative",
    ...overrides,
  };
}

function okResponse(body: HumanMapOverview): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Fuente API de clusters humanos", () => {
  it("envía bbox, zoom y estados repetidos, y reúne todas las páginas sin perder personas", async () => {
    const cluster = {
      kind: "cluster" as const,
      id: "z5:x38:y34",
      latitude: 7.0329,
      longitude: -73.0825,
      count: 2,
      statusCounts: {
        missing: 1,
        reportedDeceased: 0,
        confirmedAlive: 1,
        confirmedDeceased: 0,
      },
      bounds: {
        west: -73.12,
        south: 6.82,
        east: -73,
        north: 7.14,
      },
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        okResponse(
          page({
            features: [cluster],
            returnedFeatures: 1,
            nextCursor: "opaque-next",
          }),
        ),
      )
      .mockResolvedValueOnce(
        okResponse(
          page({
            features: [anonymousPoint],
            returnedFeatures: 1,
          }),
        ),
      );

    const result = await getHumanMapOverviewFromApi({
      bounds: { west: -79, south: -4.3, east: -66.8, north: 12.6 },
      zoom: 9.2,
      statuses: ["missing", "confirmed_alive"],
    }, undefined, "");

    expect(result.features).toEqual([cluster, anonymousPoint]);
    expect(result.returnedFeatures).toBe(2);
    expect(result.totalMapped).toBe(3);
    expect(result.nextCursor).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(firstUrl.pathname).toBe("/api/v1/people/map-overview");
    expect(firstUrl.searchParams.get("west")).toBe("-79");
    expect(firstUrl.searchParams.get("zoom")).toBe("9");
    expect(firstUrl.searchParams.get("limit")).toBe("500");
    expect(firstUrl.searchParams.getAll("statuses")).toEqual([
      "missing",
      "confirmed_alive",
    ]);

    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]), "http://localhost");
    expect(secondUrl.searchParams.get("cursor")).toBe("opaque-next");
  });

  it("rechaza totales, clusters y coordenadas públicas inconsistentes", () => {
    expect(() =>
      validateHumanMapOverview(
        page({ totalMatched: 4, totalMapped: 3, unmappedCount: 0 }),
      ),
    ).toThrow(/totales humanos inconsistentes/);

    expect(() =>
      validateHumanMapOverview(
        page({
          features: [
            {
              kind: "cluster",
              id: "bad-cluster",
              latitude: 7,
              longitude: -73,
              count: 3,
              statusCounts: {
                missing: 1,
                reportedDeceased: 0,
                confirmedAlive: 1,
                confirmedDeceased: 0,
              },
              bounds: { west: -74, south: 6, east: -72, north: 8 },
            },
          ],
          returnedFeatures: 1,
        }),
      ),
    ).toThrow(/cluster humano inconsistente/);

    expect(() =>
      validateHumanMapOverview(
        page({
          features: [
            {
              ...anonymousPoint,
              coordinatePrecision: "exact",
            } as unknown as HumanMapPoint,
          ],
          returnedFeatures: 1,
        }),
      ),
    ).toThrow(/ubicación humana exacta/);
  });
});
