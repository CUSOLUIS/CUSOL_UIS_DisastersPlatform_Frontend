// CHG-067: contextos de ejecución diferenciados de la plataforma.
// Toda regla que dependa de DÓNDE corre la experiencia vive aquí, en un
// único mapa por contexto, para que los próximos cambios se apliquen al
// contexto correcto sin duplicar detecciones:
// - "mobile-web":  navegador en un celular o tableta.
// - "desktop-web": navegador en un portátil o escritorio.
// - "native-app":  la app instalada (APK Android / iOS).

import { Platform } from "react-native";

export type RuntimeContext = "mobile-web" | "desktop-web" | "native-app";

function isMobileBrowser(userAgent: string): boolean {
  const userAgentData = (
    globalThis.navigator as unknown as
      | { userAgentData?: { mobile?: boolean } }
      | undefined
  )?.userAgentData;
  if (typeof userAgentData?.mobile === "boolean") {
    return userAgentData.mobile;
  }
  return /Android|iPhone|iPad|iPod|Mobile|Mobi/i.test(userAgent);
}

export function detectRuntimeContext(
  platformOs: typeof Platform.OS = Platform.OS,
  userAgent: string = globalThis.navigator?.userAgent ?? "",
): RuntimeContext {
  if (platformOs !== "web") return "native-app";
  return isMobileBrowser(userAgent) ? "mobile-web" : "desktop-web";
}

export interface RuntimeRules {
  // CHG-067: el anuncio de descarga del APK solo aparece en celulares
  // web; instalarla es opcional (el anuncio se cierra o se ignora).
  showAppDownloadPromo: boolean;
  // CHG-066: el portón obligatorio de ubicación aplica solo en la app
  // instalada; en la web el flujo es el botón del mapa.
  requireLocationConsentGate: boolean;
  // CHG-128: la app instalada exige estar en la última versión
  // publicada en el VPS antes de funcionar; la web siempre está al día
  // por naturaleza.
  requireLatestAppVersion: boolean;
}

export const RUNTIME_RULES: Record<RuntimeContext, RuntimeRules> = {
  "mobile-web": {
    showAppDownloadPromo: true,
    requireLocationConsentGate: false,
    requireLatestAppVersion: false,
  },
  "desktop-web": {
    showAppDownloadPromo: false,
    requireLocationConsentGate: false,
    requireLatestAppVersion: false,
  },
  "native-app": {
    showAppDownloadPromo: false,
    requireLocationConsentGate: true,
    requireLatestAppVersion: true,
  },
};

export function rulesForRuntime(context: RuntimeContext): RuntimeRules {
  return RUNTIME_RULES[context];
}

export function currentRuntimeRules(): RuntimeRules {
  return rulesForRuntime(detectRuntimeContext());
}
