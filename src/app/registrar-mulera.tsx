import { useRouter } from "expo-router";
import { TransportForm } from "../features/transports/TransportForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-161 — «La mulera»: transporte de insumos por tierra entre un
// centro de acopio local y un centro de acopio receptor.
export default function RegisterMuleTransportRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <TransportForm
      kind="mule"
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
