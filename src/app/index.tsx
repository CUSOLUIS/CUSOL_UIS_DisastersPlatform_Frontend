import { useLocalSearchParams, useRouter } from "expo-router";
import { App } from "../App";

export default function HomeRoute() {
  const router = useRouter();
  // CHG-091: ?buscar=<texto> aterriza directo en la búsqueda del
  // directorio (lo usa "Es la misma persona" del aviso de duplicados).
  const { buscar } = useLocalSearchParams<{ buscar?: string }>();

  return (
    <App
      onLogin={() => router.push("/iniciar-sesion")}
      onRegister={() => router.push("/registrarse")}
      onAbout={() => router.push("/quienes-somos")}
      onOpenAdmin={() => router.push("/administracion")}
      onReportMissingPerson={() => router.push("/reportar-persona-perdida")}
      onReportUnverifiedBuilding={() =>
        router.push("/reportar-edificio-sin-verificar")
      }
      onRequestHelp={() => router.push("/necesitamos-ayuda")}
      initialDirectorySearch={typeof buscar === "string" ? buscar : undefined}
    />
  );
}
