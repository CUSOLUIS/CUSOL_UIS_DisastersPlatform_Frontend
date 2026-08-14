afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
});

function loadApiDataSource() {
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.cusol.test";
  let dataSource:
    | typeof import("./dataSource").apiAdminDataSource
    | undefined;
  jest.isolateModules(() => {
    dataSource = jest.requireActual<typeof import("./dataSource")>(
      "./dataSource",
    ).apiAdminDataSource;
  });
  if (!dataSource) throw new Error("No fue posible cargar el adaptador admin.");
  return dataSource;
}

describe("CHG-036 · transporte administrativo", () => {
  it("envía versión y motivo de archivo en JSON, nunca en la URL", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "10000000-0000-4000-8000-000000000001",
        status: "archived",
        version: 4,
        auditEventId: "20000000-0000-4000-8000-000000000001",
        updatedAt: "2026-08-14T20:00:00Z",
      }),
    } as Response);
    const dataSource = loadApiDataSource();

    await dataSource.archiveSubmission(
      "10000000-0000-4000-8000-000000000001",
      { expectedVersion: 3, reason: "Evidencia inconsistente y duplicada" },
    );

    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.cusol.test/api/v1/admin/submissions/10000000-0000-4000-8000-000000000001",
    );
    expect(request?.method).toBe("DELETE");
    expect(request?.credentials).toBe("include");
    expect(JSON.parse(String(request?.body))).toEqual({
      expectedVersion: 3,
      reason: "Evidencia inconsistente y duplicada",
    });
  });

  it("serializa filtros de fecha antes de paginar la bandeja", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
        generatedAt: "2026-08-14T20:00:00Z",
      }),
    } as Response);
    const dataSource = loadApiDataSource();

    await dataSource.listSubmissions({
      q: "torre",
      kind: "unverified_building_report",
      status: "under_review",
      receivedFrom: "2026-08-13T00:00:00.000Z",
      receivedTo: "2026-08-14T23:59:59.999Z",
      limit: 25,
      offset: 0,
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/v1/admin/submissions");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: "torre",
      kind: "unverified_building_report",
      status: "under_review",
      receivedFrom: "2026-08-13T00:00:00.000Z",
      receivedTo: "2026-08-14T23:59:59.999Z",
      limit: "25",
      offset: "0",
    });
  });
});
