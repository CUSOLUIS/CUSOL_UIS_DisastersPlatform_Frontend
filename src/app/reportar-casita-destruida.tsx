import { useRouter } from "expo-router";
import { DamagedHomeForm } from "../features/damaged-homes/DamagedHomeForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-182 — «Mi casita destruida»: la familia publica cómo quedó su
// casa (solo con cuenta) y sale en el mapa con su ficha.
export default function ReportDamagedHomeRoute() {
  const router = useRouter();
  const safeBack = useSafeBack();

  return (
    <DamagedHomeForm
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
