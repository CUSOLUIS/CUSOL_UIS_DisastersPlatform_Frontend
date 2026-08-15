import { useRouter } from "expo-router";
import { MissingPersonReportForm } from "../features/missing-persons/MissingPersonReportForm";
import { useSafeBack } from "../navigation/useSafeBack";

export default function ReportMissingPersonRoute() {
  const router = useRouter();
  // CHG-079: VOLVER funciona también tras recarga o URL directa.
  const safeBack = useSafeBack();

  return (
    <MissingPersonReportForm
      onBack={safeBack}
      // CHG-083: la constancia siempre sale hacia la portada.
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
      // CHG-091: "Es la misma persona" abandona el reporte y aterriza
      // en la búsqueda del caso existente para enriquecerlo.
      onOpenExistingCase={(publicCaseCode) =>
        router.replace({ pathname: "/", params: { buscar: publicCaseCode } })
      }
    />
  );
}
