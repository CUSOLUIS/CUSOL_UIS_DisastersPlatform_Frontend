import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LocationConsentGate } from "../components/LocationConsentGate";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      {/* CHG-066: en la app instalada, aceptar compartir la ubicación
          mientras la app está en uso es obligatorio antes de continuar.
          En la web el portón no aplica. */}
      <LocationConsentGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        />
      </LocationConsentGate>
    </>
  );
}
