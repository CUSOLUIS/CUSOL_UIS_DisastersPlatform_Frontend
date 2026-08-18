import { useRouter } from "expo-router";
import { TransportForm } from "../features/transports/TransportForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-161 — «La lanchera»: transporte de insumos por lancha entre un
// centro de acopio local y un centro de acopio receptor.
export default function RegisterBoatTransportRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <TransportForm
      kind="boat"
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
