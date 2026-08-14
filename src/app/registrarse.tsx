import { useRouter } from "expo-router";
import { RegistrationForm } from "../features/auth/RegistrationForm";

export default function RegisterRoute() {
  const router = useRouter();

  return (
    <RegistrationForm
      onBack={() => router.replace("/")}
      onLogin={() => router.replace("/iniciar-sesion")}
    />
  );
}
