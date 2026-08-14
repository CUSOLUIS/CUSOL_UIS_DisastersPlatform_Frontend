import {
  buildReportPayload,
  createIdempotencyKey,
  submitMissingPersonReport,
} from "./reportSubmission";
import type {
  MissingPersonReportDraft,
  SelectedPhoto,
} from "./reportTypes";

const completeDraft: MissingPersonReportDraft = {
  firstNames: "  María Fernanda ",
  lastNames: "Rojas Peña",
  aliases: "Mafe",
  birthDate: "",
  approximateAge: "34",
  genderIdentity: "",
  nationality: "",
  documentType: "",
  documentNumber: "",
  heightCm: "162",
  build: "",
  skinTone: "",
  hairDescription: "",
  eyeDescription: "",
  distinctiveMarks: "",
  medicalInformation: "",
  lastSeenDate: "2026-08-10",
  lastSeenTime: "",
  department: "Santander",
  municipality: "Bucaramanga",
  lastSeenArea: "Parque principal",
  lastSeenLatitude: "7.1193",
  lastSeenLongitude: "-73.1227",
  clothingDescription: "Camisa azul",
  circumstances: "Salió hacia el parque y no regresó.",
  additionalDescription: "",
  reporterName: "Carlos Rojas",
  reporterRelationship: "Hermano",
  reporterPhone: "+57 3001234567",
  reporterEmail: "",
  officialReportNumber: "",
  truthConfirmed: true,
  photoAuthorizationConfirmed: true,
  reviewAcknowledged: true,
};

const photo: SelectedPhoto = {
  uri: "blob:http://localhost/una-foto",
  name: "foto.jpg",
  size: 2048,
  mimeType: "image/jpeg",
};

const receipt = {
  id: "03c35941-e856-44ae-9815-0819180c23fb",
  publicCaseCode: "MP-2026-ABCDEF12",
  status: "under_review",
  receivedAt: "2026-08-14T05:00:00Z",
};

function mockNetwork(reportResponse: Partial<Response>) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === photo.uri) {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob(["foto"], { type: "image/jpeg" }),
        } as Response;
      }
      return reportResponse as Response;
    });
}

afterEach(() => jest.restoreAllMocks());

describe("Payload del reporte de persona perdida", () => {
  it("recorta obligatorios, omite opcionales vacíos y convierte números", () => {
    const payload = buildReportPayload(completeDraft);

    expect(payload.firstNames).toBe("María Fernanda");
    expect(payload.approximateAge).toBe(34);
    expect(payload.heightCm).toBe(162);
    expect(payload.lastSeenLatitude).toBeCloseTo(7.1193);
    expect(payload.lastSeenLongitude).toBeCloseTo(-73.1227);
    expect(payload.reporterPhone).toBe("+57 3001234567");
    expect(payload.truthConfirmed).toBe(true);
    expect(payload).not.toHaveProperty("birthDate");
    expect(payload).not.toHaveProperty("reporterEmail");
    expect(payload).not.toHaveProperty("confirmPassword");
  });

  it("descarta una coordenada solitaria y edades ilegibles", () => {
    const payload = buildReportPayload({
      ...completeDraft,
      approximateAge: "no sé",
      lastSeenLongitude: "",
    });

    expect(payload).not.toHaveProperty("approximateAge");
    expect(payload).not.toHaveProperty("lastSeenLatitude");
    expect(payload).not.toHaveProperty("lastSeenLongitude");
  });
});

describe("Envío del reporte a la API real", () => {
  it("envía multipart con Idempotency-Key y devuelve la constancia", async () => {
    const fetchMock = mockNetwork({
      ok: true,
      status: 201,
      json: async () => receipt,
    });

    const result = await submitMissingPersonReport(completeDraft, [photo], {
      idempotencyKey: "clave-idempotente-de-prueba",
      requestBaseUrl: "",
    });

    expect(result.publicCaseCode).toBe("MP-2026-ABCDEF12");
    const reportCall = fetchMock.mock.calls.find(
      ([input]) => String(input) !== photo.uri,
    );
    expect(String(reportCall?.[0])).toBe("/api/v1/missing-person-reports");
    const init = reportCall?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("clave-idempotente-de-prueba");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("prefiere el detalle problem+json y cae al mensaje por estado", async () => {
    mockNetwork({
      ok: false,
      status: 413,
      json: async () => ({
        detail: "El envío supera el máximo total permitido.",
      }),
    });
    await expect(
      submitMissingPersonReport(completeDraft, [photo], { requestBaseUrl: "" }),
    ).rejects.toThrow("El envío supera el máximo total permitido.");

    jest.restoreAllMocks();
    mockNetwork({
      ok: false,
      status: 429,
      json: async () => {
        throw new Error("sin cuerpo");
      },
    });
    await expect(
      submitMissingPersonReport(completeDraft, [photo], { requestBaseUrl: "" }),
    ).rejects.toThrow(/demasiados envíos seguidos/);
  });

  it("rechaza constancias incompletas", async () => {
    mockNetwork({
      ok: true,
      status: 201,
      json: async () => ({ status: "under_review" }),
    });
    await expect(
      submitMissingPersonReport(completeDraft, [photo], { requestBaseUrl: "" }),
    ).rejects.toThrow(/constancia incompleta/);
  });
});

describe("Clave de idempotencia", () => {
  it("genera claves con la longitud exigida por el gateway", () => {
    const key = createIdempotencyKey();
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(createIdempotencyKey()).not.toBe(key);
  });
});
