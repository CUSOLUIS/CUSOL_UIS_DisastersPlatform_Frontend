import { useRouter } from "expo-router";
import { AidLocationForm } from "../features/aid-locations/AidLocationForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-153 — Alta pública de un punto de distribución (depende de un
// centro de acopio receptor de su ciudad).
export default function RegisterDistributionPointRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <AidLocationForm
      kind="distribution_point"
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
