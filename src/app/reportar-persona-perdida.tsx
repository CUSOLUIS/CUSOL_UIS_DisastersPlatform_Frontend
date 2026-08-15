import { useRouter } from "expo-router";
import { MissingPersonReportForm } from "../features/missing-persons/MissingPersonReportForm";

export default function ReportMissingPersonRoute() {
  const router = useRouter();

  return (
    <MissingPersonReportForm
      onBack={() => router.back()}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
