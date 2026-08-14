import {
  getPeopleRecordPageFromApi,
  validatePeopleRecordPage,
} from "./peopleRecordsDataSource";
import type {
  PeopleRecordPage,
  PeopleRecordsQuery,
  PersonRecord,
} from "./types";

const person: PersonRecord = {
  id: "55555555-5555-4555-8555-000000002000",
  displayName: "Persona demo 2000 — P.V.",
  status: "missing",
  location: "Bogotá, D.C.",
  relatedEvent: "Inundación en el norte de Bucaramanga",
  source: {
    name: "Reporte ciudadano — plataforma CUSOL",
    sourceType: "citizen",
    url: null,
  },
  createdAt: "2026-08-13T04:00:00Z",
};

const query: PeopleRecordsQuery = {
  limit: 10,
  offset: 20,
  statuses: ["missing", "reported_deceased"],
  q: "bogota",
};

function page(overrides: Partial<PeopleRecordPage> = {}): PeopleRecordPage {
  const limit = overrides.limit ?? 10;
  const offset = overrides.offset ?? 20;
  const total = overrides.total ?? 300;
  const itemCount = Math.max(0, Math.min(limit, total - offset));
  return {
    items: Array.from({ length: itemCount }, (_, index) => ({
      ...person,
      id: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`,
    })),
    total,
    limit,
    offset,
    generatedAt: "2026-08-13T22:28:08Z",
    ...overrides,
  };
}

function okResponse(body: PeopleRecordPage): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

describe("Fuente paginada de personas", () => {
  it("envía página, búsqueda y estados repetidos al endpoint real", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okResponse(page()));

    const result = await getPeopleRecordPageFromApi(query, undefined, "");

    expect(result.total).toBe(300);
    expect(result.items).toHaveLength(10);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/v1/people/records");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("q")).toBe("bogota");
    expect(url.searchParams.getAll("statuses")).toEqual([
      "missing",
      "reported_deceased",
    ]);
  });

  it("adapta 5 y 20 filas visuales a los tamaños admitidos por la API", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okResponse(page({ limit: 10, offset: 0 })))
      .mockResolvedValueOnce(okResponse(page({ limit: 25, offset: 20 })));

    const fiveRows = await getPeopleRecordPageFromApi(
      { limit: 5, offset: 0, statuses: [] },
      undefined,
      "",
    );
    const twentyRows = await getPeopleRecordPageFromApi(
      { limit: 20, offset: 20, statuses: [] },
      undefined,
      "",
    );

    expect(fiveRows.limit).toBe(5);
    expect(fiveRows.items).toHaveLength(5);
    expect(twentyRows.limit).toBe(20);
    expect(twentyRows.items).toHaveLength(20);
    expect(new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost").searchParams.get("limit"))
      .toBe("10");
    expect(new URL(String(fetchMock.mock.calls[1]?.[0]), "http://localhost").searchParams.get("limit"))
      .toBe("25");
    expect(new URL(String(fetchMock.mock.calls[1]?.[0]), "http://localhost").searchParams.get("offset"))
      .toBe("20");
  });

  it("rechaza páginas incompletas, offsets cambiados y estados ajenos al filtro", () => {
    expect(() =>
      validatePeopleRecordPage(page({ items: [person] }), query),
    ).toThrow(/página de personas inconsistente/);

    expect(() =>
      validatePeopleRecordPage(page({ offset: 0 }), query),
    ).toThrow(/página de personas inconsistente/);

    expect(() =>
      validatePeopleRecordPage(
        page({
          items: Array.from({ length: 10 }, (_, index) => ({
            ...person,
            id: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`,
            status: "confirmed_alive",
          })),
        }),
        query,
      ),
    ).toThrow(/ignoró el filtro de estado/);
  });

  it("acepta una última página parcial y una consulta sin resultados", () => {
    expect(
      validatePeopleRecordPage(
        page({ items: [person, { ...person, id: "last" }], total: 22 }),
        query,
      ).items,
    ).toHaveLength(2);

    const emptyQuery = { ...query, offset: 0 };
    expect(
      validatePeopleRecordPage(
        page({ items: [], total: 0, offset: 0 }),
        emptyQuery,
      ).total,
    ).toBe(0);
  });
});
