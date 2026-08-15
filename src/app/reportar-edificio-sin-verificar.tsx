import { useRouter } from "expo-router";
import { UnverifiedBuildingReportForm } from "../features/unverified-buildings/UnverifiedBuildingReportForm";
import { useSafeBack } from "../navigation/useSafeBack";

export default function ReportUnverifiedBuildingRoute() {
  const router = useRouter();
  // CHG-079: VOLVER funciona también tras recarga o URL directa.
  const safeBack = useSafeBack();

  return (
    <UnverifiedBuildingReportForm
      onBack={safeBack}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
