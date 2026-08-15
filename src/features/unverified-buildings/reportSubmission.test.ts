import type { SelectedPhoto } from "../missing-persons/reportTypes";
import {
  buildBuildingReportPayload,
  createBuildingReportIdempotencyKey,
  submitUnverifiedBuildingReport,
} from "./reportSubmission";
import type { UnverifiedBuildingReportDraft } from "./reportTypes";

const completeDraft: UnverifiedBuildingReportDraft = {
  buildingReference: "  Torre norte ",
  buildingType: "mixed_use",
  department: "Santander",
  municipality: "Bucaramanga",
  sector: "Centro",
  locationReference: "Frente al parque",
  address: "Calle 10 # 12-30",
  latitude: "7.11935",
  longitude: "-73.12274",
  relatedEventId: "",
  relatedEventName: "",
  pendingReasonDetail: "",
  observedDate: "2026-08-13",
  observedTime: "14:20",
  searchStatus: "incomplete",
  occupancyReport: "unknown",
  pendingReasons: ["access_blocked", "debris"],
  observedConditions: ["visible_debris"],
  observationDescription: "El acceso está bloqueado por escombros visibles.",
  reporterName: "Laura Méndez",
  reporterRole: "Vecina",
  reporterOrganization: "",
  reporterPhone: "+57 3001234567",
  reporterEmail: "",
  officialReportNumber: "",
  truthConfirmed: true,
  photoAuthorizationConfirmed: true,
  reviewAcknowledged: true,
};

const photo: SelectedPhoto = {
  uri: "blob:http://localhost/edificio",
  name: "edificio.webp",
  size: 4096,
  mimeType: "image/webp",
};

const receipt = {
  id: "6ef9f631-2461-4804-9b79-78b65d62d59f",
  publicTrackingCode: "BLD-2026-8X41QZ",
  status: "under_review",
  receivedAt: "2026-08-14T17:30:00Z",
};

function mockNetwork(reportResponse: Partial<Response>) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === photo.uri) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob(["foto"], { type: "image/webp" }),
        } as Response;
      }
      return reportResponse as Response;
    });
}

afterEach(() => jest.restoreAllMocks());

describe("CHG-035 · Payload de edificio", () => {
  it("recorta texto, conserva enums/arreglos y convierte coordenadas", () => {
    const payload = buildBuildingReportPayload(completeDraft);

    expect(payload.buildingReference).toBe("Torre norte");
    expect(payload.pendingReasons).toEqual(["access_blocked", "debris"]);
    expect(payload.latitude).toBeCloseTo(7.11935);
    expect(payload.longitude).toBeCloseTo(-73.12274);
    expect(payload.reporterPhone).toBe("+57 3001234567");
    expect(payload).not.toHaveProperty("reporterEmail");
    expect(payload).not.toHaveProperty("relatedDisasterId");
    expect(payload).not.toHaveProperty("relatedEventName");
  });

  it("omite coordenadas cuando la pareja está incompleta", () => {
    const payload = buildBuildingReportPayload({
      ...completeDraft,
      longitude: "",
    });
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("longitude");
  });
});

describe("CHG-035 · Envío multipart", () => {
  it("usa la ruta contractual, multipart e Idempotency-Key", async () => {
    const fetchMock = mockNetwork({
      ok: true,
      status: 201,
      json: async () => receipt,
    });

    const result = await submitUnverifiedBuildingReport(completeDraft, [photo], {
      idempotencyKey: "building-key-test-123456",
      requestBaseUrl: "",
    });

    expect(result.publicTrackingCode).toBe("BLD-2026-8X41QZ");
    const reportCall = fetchMock.mock.calls.find(
      ([input]) => String(input) !== photo.uri,
    );
    expect(String(reportCall?.[0])).toBe(
      "/api/v1/unverified-building-reports",
    );
    const init = reportCall?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("building-key-test-123456");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("usa problem detail y rechaza constancias incompletas", async () => {
    mockNetwork({
      ok: false,
      status: 422,
      json: async () => ({ detail: "La fecha observada no es válida." }),
    });
    await expect(
      submitUnverifiedBuildingReport(completeDraft, [photo], {
        requestBaseUrl: "",
      }),
    ).rejects.toThrow("La fecha observada no es válida.");

    jest.restoreAllMocks();
    mockNetwork({
      ok: true,
      status: 201,
      json: async () => ({ status: "under_review" }),
    });
    await expect(
      submitUnverifiedBuildingReport(completeDraft, [photo], {
        requestBaseUrl: "",
      }),
    ).rejects.toThrow(/constancia incompleta/);
  });
});

describe("CHG-035 · Idempotencia", () => {
  it("genera una clave dentro del límite del contrato", () => {
    const key = createBuildingReportIdempotencyKey();
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(128);
  });
});

/**
 * CHG-092 — Evento relacionado creable: la selección viaja como id,
 * el texto libre como nombre, nunca ambos.
 */
describe("evento relacionado (CHG-092)", () => {
  it("la selección viaja como relatedDisasterId", () => {
    const payload = buildBuildingReportPayload({
      ...completeDraft,
      relatedEventId: "77777777-7777-4777-8777-777777777701",
      relatedEventName: "Sismo en el Centro",
    });

    expect(payload.relatedDisasterId).toBe(
      "77777777-7777-4777-8777-777777777701",
    );
    expect(payload).not.toHaveProperty("relatedEventName");
  });

  it("el texto libre viaja como relatedEventName", () => {
    const payload = buildBuildingReportPayload({
      ...completeDraft,
      relatedEventId: "",
      relatedEventName: "Vendaval en el barrio La Cumbre",
    });

    expect(payload.relatedEventName).toBe(
      "Vendaval en el barrio La Cumbre",
    );
    expect(payload).not.toHaveProperty("relatedDisasterId");
  });
});

/**
 * CHG-093 — El detalle del motivo "Otro" viaja solo cuando el motivo
 * sigue marcado.
 */
describe('detalle de "Otro motivo" (CHG-093)', () => {
  it("incluye el detalle con other marcado", () => {
    const payload = buildBuildingReportPayload({
      ...completeDraft,
      pendingReasons: ["access_blocked", "other"],
      pendingReasonDetail: "  Cierre por orden de la alcaldía  ",
    });

    expect(payload.pendingReasonDetail).toBe(
      "Cierre por orden de la alcaldía",
    );
  });

  it("omite el detalle si other no está marcado", () => {
    const payload = buildBuildingReportPayload({
      ...completeDraft,
      pendingReasons: ["access_blocked"],
      pendingReasonDetail: "Texto huérfano que no debe viajar",
    });

    expect(payload).not.toHaveProperty("pendingReasonDetail");
  });
});
