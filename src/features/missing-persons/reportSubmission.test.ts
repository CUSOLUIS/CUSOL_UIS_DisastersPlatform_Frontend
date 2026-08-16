import {
  ReportRejectedError,
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

  // CHG-113 — Quien reporta puede no saber con qué ropa salió la
  // persona: el campo viaja solo si tiene contenido, para que el
  // expediente quede sin dato en vez de con un "no sé" escrito.
  // CHG-114 — Un separador al final pasaba la validación local y lo
  // rechazaba el servicio, que exige terminar en dígito.
  it("limpia los separadores del final del teléfono", () => {
    const payload = buildReportPayload({
      ...completeDraft,
      reporterPhone: "+57 (300) 123-4567-",
    });

    expect(payload.reporterPhone).toBe("+57 (300) 123-4567");
  });

  it("omite la vestimenta cuando se deja en blanco", () => {
    const payload = buildReportPayload({
      ...completeDraft,
      clothingDescription: "   ",
    });

    expect(payload).not.toHaveProperty("clothingDescription");
  });

  it("envía la vestimenta recortada cuando sí se conoce", () => {
    const payload = buildReportPayload({
      ...completeDraft,
      clothingDescription: "  Chaqueta amarilla  ",
    });

    expect(payload.clothingDescription).toBe("Chaqueta amarilla");
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

/**
 * CHG-101 — Ante un 504 de despliegue el envío reintenta solo, con la
 * MISMA Idempotency-Key: eso es lo que impide que el reintento cree un
 * segundo reporte de la misma persona.
 */
describe("reintento ante una caída del backend (CHG-101)", () => {
  const receipt = {
    publicCaseCode: "MP-2026-AAAA1111",
    status: "published" as const,
    receivedAt: "2026-08-15T12:00:00Z",
  };

  function jsonResponse(body: unknown, status = 201) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
      headers: { get: () => "application/json" },
    } as unknown as Response;
  }

  it("supera el 504 y usa la misma llave en ambos intentos", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 504))
      .mockResolvedValueOnce(jsonResponse(receipt, 201));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitMissingPersonReport(completeDraft, [photo], {
      requestBaseUrl: "http://api.test",
      idempotencyKey: "clave-idempotente-0001",
      wait: async () => undefined,
    });

    expect(result.publicCaseCode).toBe("MP-2026-AAAA1111");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const llaves = fetchMock.mock.calls.map(
      (call) => call[1].headers["Idempotency-Key"],
    );
    // La misma llave en los dos intentos: sin esto, el reintento
    // crearía un segundo reporte.
    expect(llaves).toEqual([
      "clave-idempotente-0001",
      "clave-idempotente-0001",
    ]);
  });

  it("no reintenta un 422: el usuario debe corregir el formulario", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ detail: "Revisa los campos: reporterPhone." }, 422),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      submitMissingPersonReport(completeDraft, [photo], {
        requestBaseUrl: "http://api.test",
        idempotencyKey: "clave-idempotente-0002",
        wait: async () => undefined,
      }),
    ).rejects.toThrow(/reporterPhone/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // CHG-114 — El rechazo llega con las claves de los campos, que es lo
  // que permite al formulario resaltarlos y desplazarse hasta ellos.
  it("el rechazo del servicio conserva las claves de los campos", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          detail: "Revisa los campos: Teléfono del reportante.",
          fields: ["reporterPhone"],
        },
        422,
      ),
    ) as unknown as typeof fetch;

    const error = await submitMissingPersonReport(completeDraft, [photo], {
      requestBaseUrl: "http://api.test",
      idempotencyKey: "clave-idempotente-0003",
      wait: async () => undefined,
    }).catch((rejection: unknown) => rejection);

    expect(error).toBeInstanceOf(ReportRejectedError);
    expect((error as ReportRejectedError).fields).toEqual(["reporterPhone"]);
    expect((error as Error).message).toBe(
      "Revisa los campos: Teléfono del reportante.",
    );
  });

  // CHG-117 — El proxy cortaba las fotos en 1 MiB (su valor por
  // defecto) y el cliente traducía ese 413 a "máximo 10 MiB por foto":
  // quien reportaba leía que su foto de 2 MiB era demasiado grande.
  it("ante un 413 no culpa a quien reporta de pasarse del límite", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({}, 413)) as unknown as typeof fetch;

    const error = await submitMissingPersonReport(completeDraft, [photo], {
      requestBaseUrl: "http://api.test",
      idempotencyKey: "clave-idempotente-0005",
      wait: async () => undefined,
    }).catch((rejection: unknown) => rejection);

    expect((error as Error).message).toBe(
      "El servidor rechazó el envío por su tamaño. Intenta con menos fotografías o más livianas.",
    );
    expect((error as Error).message).not.toContain("10 MiB");
  });

  it("un rechazo sin claves no inventa ninguna", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ detail: "Datos inválidos." }, 422)) as
      unknown as typeof fetch;

    const error = await submitMissingPersonReport(completeDraft, [photo], {
      requestBaseUrl: "http://api.test",
      idempotencyKey: "clave-idempotente-0004",
      wait: async () => undefined,
    }).catch((rejection: unknown) => rejection);

    expect((error as ReportRejectedError).fields).toEqual([]);
  });

  it("si el backend sigue caído, el error llega tras agotar los intentos", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, 503));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      submitMissingPersonReport(completeDraft, [photo], {
        requestBaseUrl: "http://api.test",
        idempotencyKey: "clave-idempotente-0003",
        wait: async () => undefined,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
