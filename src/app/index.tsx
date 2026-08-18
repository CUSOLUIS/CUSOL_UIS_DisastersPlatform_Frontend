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
      onRegisterCollectionCenter={() =>
        router.push("/registrar-centro-acopio-local")
      }
      onRegisterDonationPoint={() =>
        router.push("/registrar-punto-recoleccion")
      }
      onRegisterReceiverCenter={() =>
        router.push("/registrar-centro-acopio-receptor")
      }
      onRegisterDistributionPoint={() =>
        router.push("/registrar-punto-distribucion")
      }
      onRegisterMuleTransport={() => router.push("/registrar-mulera")}
      onRegisterBoatTransport={() => router.push("/registrar-lanchera")}
      onReportDamagedHome={() => router.push("/reportar-casita-partida")}
      onRequestHelp={() => router.push("/necesitamos-ayuda")}
      initialDirectorySearch={typeof buscar === "string" ? buscar : undefined}
    />
  );
}
