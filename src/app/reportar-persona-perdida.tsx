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
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
