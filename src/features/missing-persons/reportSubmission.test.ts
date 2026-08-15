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
  // CHG-094: campos ampliados; con espacios alrededor para comprobar
  // el recorte, y algunos vacíos para comprobar que no viajan.
  tattooDescription: "  Tatuaje de ancla en el antebrazo  ",
  scarsDescription: "",
  prostheticsDescription: "  Prótesis auditiva derecha  ",
  piercingsAndMoles: "",
  mentalHealthCondition: "  Alzheimer inicial  ",
  vitalMedication: "  Insulina cada 8 horas  ",
  severeAllergies: "",
  belongingsDescription: "  Mochila azul con portátil  ",
  transportMode: "private_vehicle",
  vehicleDetails: "  Placa ABC123, Renault gris  ",
  companionsDescription: "",
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
  officialAuthorityName: "  Fiscalía General de la Nación  ",
  isReporterPhonePublic: true,
  isReporterEmailPublic: false,
  truthConfirmed: true,
  photoAuthorizationConfirmed: true,
};

const photo: SelectedPhoto = {
  uri: "blob:http://localhost/una-foto",
  name: "foto.jpg",
  size: 2048,
  mimeType: "image/jpeg",
};

// CHG-075: la constancia informa publicación inmediata.
const receipt = {
  id: "03c35941-e856-44ae-9815-0819180c23fb",
  publicCaseCode: "MP-2026-ABCDEF12",
  status: "published",
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
    // CHG-075: ya no existe el consentimiento de revisión previa.
    expect(payload).not.toHaveProperty("reviewAcknowledged");
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
      json: async () => ({ status: "published" }),
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

/**
 * CHG-094 — Campos ampliados: se recortan, los vacíos no viajan y el
 * consentimiento de contacto viaja siempre explícito.
 */
describe("campos ampliados del reporte (CHG-094)", () => {
  it("recorta los campos nuevos y omite los vacíos", () => {
    const payload = buildReportPayload(completeDraft);

    expect(payload.tattooDescription).toBe(
      "Tatuaje de ancla en el antebrazo",
    );
    expect(payload.prostheticsDescription).toBe(
      "Prótesis auditiva derecha",
    );
    expect(payload.mentalHealthCondition).toBe("Alzheimer inicial");
    expect(payload.vitalMedication).toBe("Insulina cada 8 horas");
    expect(payload.belongingsDescription).toBe(
      "Mochila azul con portátil",
    );
    expect(payload.transportMode).toBe("private_vehicle");
    expect(payload.vehicleDetails).toBe("Placa ABC123, Renault gris");
    expect(payload.officialAuthorityName).toBe(
      "Fiscalía General de la Nación",
    );

    // Vacíos: no viajan.
    expect(payload).not.toHaveProperty("scarsDescription");
    expect(payload).not.toHaveProperty("piercingsAndMoles");
    expect(payload).not.toHaveProperty("severeAllergies");
    expect(payload).not.toHaveProperty("companionsDescription");
  });

  it("envía el consentimiento de contacto siempre, también en falso", () => {
    const payload = buildReportPayload(completeDraft);

    expect(payload.isReporterPhonePublic).toBe(true);
    expect(payload.isReporterEmailPublic).toBe(false);
  });

  it("alinea las categorías de foto por posición y completa las no declaradas", () => {
    const payload = buildReportPayload(completeDraft, [
      { ...photo, category: "recent_face" },
      { ...photo, name: "cuerpo.jpg" },
      { ...photo, name: "marca.jpg", category: "distinctive_mark" },
    ]);

    expect(payload.photoCategories).toEqual([
      "recent_face",
      "other",
      "distinctive_mark",
    ]);
  });

  it("omite photoCategories si ninguna foto declara categoría", () => {
    const payload = buildReportPayload(completeDraft, [photo]);

    expect(payload).not.toHaveProperty("photoCategories");
  });
});
