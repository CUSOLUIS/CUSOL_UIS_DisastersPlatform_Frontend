import { useRouter } from "expo-router";
import { AidLocationForm } from "../features/aid-locations/AidLocationForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-153 — Alta pública de un centro de acopio local (independiente).
export default function RegisterCollectionCenterRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <AidLocationForm
      kind="collection_center"
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
