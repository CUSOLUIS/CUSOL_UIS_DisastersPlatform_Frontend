import { useRouter } from "expo-router";
import { DamagedHomeForm } from "../features/damaged-homes/DamagedHomeForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-162 — «Mi casita partida»: informe de un hogar en muy malas
// condiciones; también sale en el mapa.
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
