import { useRouter } from "expo-router";
import { UnverifiedBuildingReportForm } from "../features/unverified-buildings/UnverifiedBuildingReportForm";

export default function ReportUnverifiedBuildingRoute() {
  const router = useRouter();

  return (
    <UnverifiedBuildingReportForm
      onBack={() => router.back()}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
