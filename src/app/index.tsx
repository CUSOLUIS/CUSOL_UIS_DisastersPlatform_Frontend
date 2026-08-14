import { useRouter } from "expo-router";
import { App } from "../App";

export default function HomeRoute() {
  const router = useRouter();

  return (
    <App
      onLogin={() => router.push("/iniciar-sesion")}
      onRegister={() => router.push("/registrarse")}
      onAbout={() => router.push("/quienes-somos")}
      onReportMissingPerson={() => router.push("/reportar-persona-perdida")}
      onReportUnverifiedBuilding={() =>
        router.push("/reportar-edificio-sin-verificar")
      }
    />
  );
}
