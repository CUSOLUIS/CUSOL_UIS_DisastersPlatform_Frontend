import { useRouter } from "expo-router";
import { HelpRequestForm } from "../features/help-requests/HelpRequestForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-125 — Ruta pública de la solicitud «Necesitamos ayuda».
export default function RequestHelpRoute() {
  const router = useRouter();
  // CHG-079: VOLVER funciona también tras recarga o URL directa.
  const safeBack = useSafeBack();

  return (
    <HelpRequestForm
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
