import { useRouter } from "expo-router";
import { AidLocationForm } from "../features/aid-locations/AidLocationForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-153 — Alta pública de un punto de recolección (depende de un
// centro de acopio local de su ciudad).
export default function RegisterCollectionPointRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <AidLocationForm
      kind="collection_point"
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
