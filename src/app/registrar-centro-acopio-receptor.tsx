import { useRouter } from "expo-router";
import { AidLocationForm } from "../features/aid-locations/AidLocationForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-153 — Alta pública de un centro de acopio receptor
// (independiente; recibe cargamentos y redistribuye).
export default function RegisterReceiverCenterRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <AidLocationForm
      kind="receiver_center"
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
