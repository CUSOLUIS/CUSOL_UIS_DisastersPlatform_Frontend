import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CrashGuard } from "../components/CrashGuard";
import { AppUpdateGate } from "../features/app-update/AppUpdateGate";
import { LocationConsentGate } from "../components/LocationConsentGate";
import { WebFormControlStyles } from "../components/WebFormControlStyles";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      {/* CHG-076: foco y autofill de los inputs con el lenguaje de
          diseño en web; en nativo no hace nada. */}
      <WebFormControlStyles />
      {/* CHG-074: barrera de errores — ningún error de render debe
          cerrar la app abruptamente. */}
      <CrashGuard>
        {/* CHG-128: la app instalada verifica contra el VPS que sea la
            última versión publicada; si hay una más nueva, bloquea y
            exige descargarla antes de cualquier otra cosa. */}
        <AppUpdateGate>
          {/* CHG-066: en la app instalada, aceptar compartir la
              ubicación mientras la app está en uso es obligatorio antes
              de continuar. En la web el portón no aplica. */}
          <LocationConsentGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.canvas },
              }}
            />
          </LocationConsentGate>
        </AppUpdateGate>
      </CrashGuard>
    </>
  );
}
