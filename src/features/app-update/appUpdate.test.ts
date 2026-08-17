// CHG-128 — Comparación de versión y lectura del manifiesto del VPS.

import {
  APP_DOWNLOAD_URL,
  APP_UPDATE_MANIFEST_URL,
  embeddedAppRevision,
  fetchLatestAppRevision,
  updateRequired,
} from "./appUpdate";
import { EMBEDDED_APP_REVISION } from "./appRevision";

describe("revisión embebida (CHG-128)", () => {
  it("en el repo el archivo generado es null y el portón queda inactivo", () => {
    // CI sobreescribe appRevision.ts con el sha del build; aquí (web,
    // desarrollo, pruebas) no hay revisión y el portón no actúa.
    expect(EMBEDDED_APP_REVISION).toBeNull();
    expect(embeddedAppRevision()).toBeNull();
  });

  it("la variable de entorno sirve de respaldo para builds manuales", () => {
    process.env.EXPO_PUBLIC_APP_REVISION = "  shaManual42  ";
    try {
      expect(embeddedAppRevision()).toBe("shaManual42");
    } finally {
      delete process.env.EXPO_PUBLIC_APP_REVISION;
    }
  });
});

describe("updateRequired (CHG-128)", () => {
  it("solo exige actualizar con confirmación positiva de otra revisión", () => {
    expect(updateRequired("aaa", "bbb")).toBe(true);
    expect(updateRequired("aaa", "aaa")).toBe(false);
    // DEC-128-03: sin dato de un lado u otro, falla abierta.
    expect(updateRequired(null, "bbb")).toBe(false);
    expect(updateRequired("aaa", null)).toBe(false);
    expect(updateRequired(null, null)).toBe(false);
  });
});

describe("fetchLatestAppRevision (CHG-128)", () => {
  it("lee la revisión del manifiesto publicado junto al APK", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ revision: "  abc123  " }),
    });
    await expect(fetchLatestAppRevision(fetchFn as never)).resolves.toBe(
      "abc123",
    );
    expect(fetchFn.mock.calls[0][0]).toBe(APP_UPDATE_MANIFEST_URL);
  });

  it("devuelve null ante HTML del SPA, error HTTP o red caída", async () => {
    // Hasta el primer push el VPS responde el index.html del SPA.
    const htmlFallback = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await expect(
      fetchLatestAppRevision(htmlFallback as never),
    ).resolves.toBeNull();

    const httpError = jest.fn().mockResolvedValue({ ok: false });
    await expect(
      fetchLatestAppRevision(httpError as never),
    ).resolves.toBeNull();

    const offline = jest.fn().mockRejectedValue(new Error("sin red"));
    await expect(fetchLatestAppRevision(offline as never)).resolves.toBeNull();

    const sinRevision = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ otraCosa: 1 }),
    });
    await expect(
      fetchLatestAppRevision(sinRevision as never),
    ).resolves.toBeNull();
  });

  it("la descarga y el manifiesto viven en /descargas del mismo host", () => {
    expect(APP_DOWNLOAD_URL).toMatch(/\/descargas\/cusol-disasters\.apk$/);
    expect(APP_UPDATE_MANIFEST_URL).toMatch(
      /\/descargas\/cusol-disasters\.version\.json$/,
    );
  });
});
