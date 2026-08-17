// CHG-067 — Reglas diferenciadas por contexto de ejecución.

import {
  RUNTIME_RULES,
  detectRuntimeContext,
  rulesForRuntime,
} from "./runtimeContext";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const LAPTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("detectRuntimeContext", () => {
  it("la app instalada es native-app sin importar el user agent", () => {
    expect(detectRuntimeContext("android", LAPTOP_UA)).toBe("native-app");
    expect(detectRuntimeContext("ios", LAPTOP_UA)).toBe("native-app");
  });

  it("navegador en celular es mobile-web", () => {
    expect(detectRuntimeContext("web", IPHONE_UA)).toBe("mobile-web");
    expect(detectRuntimeContext("web", ANDROID_UA)).toBe("mobile-web");
  });

  it("navegador en portátil o escritorio es desktop-web", () => {
    expect(detectRuntimeContext("web", LAPTOP_UA)).toBe("desktop-web");
  });
});

describe("RUNTIME_RULES", () => {
  it("el anuncio de descarga solo aparece en celulares web", () => {
    expect(rulesForRuntime("mobile-web").showAppDownloadPromo).toBe(true);
    expect(rulesForRuntime("desktop-web").showAppDownloadPromo).toBe(false);
    expect(rulesForRuntime("native-app").showAppDownloadPromo).toBe(false);
  });

  it("el portón obligatorio de ubicación aplica solo en la app instalada", () => {
    expect(rulesForRuntime("native-app").requireLocationConsentGate).toBe(
      true,
    );
    expect(rulesForRuntime("mobile-web").requireLocationConsentGate).toBe(
      false,
    );
    expect(rulesForRuntime("desktop-web").requireLocationConsentGate).toBe(
      false,
    );
  });

  it("la última versión solo se exige en la app instalada (CHG-128)", () => {
    expect(rulesForRuntime("native-app").requireLatestAppVersion).toBe(true);
    expect(rulesForRuntime("mobile-web").requireLatestAppVersion).toBe(false);
    expect(rulesForRuntime("desktop-web").requireLatestAppVersion).toBe(
      false,
    );
  });

  it("cubre los tres contextos, ni uno más", () => {
    expect(Object.keys(RUNTIME_RULES).sort()).toEqual([
      "desktop-web",
      "mobile-web",
      "native-app",
    ]);
  });
});
