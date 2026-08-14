import { useRouter } from "expo-router";
import { LoginForm } from "../features/auth/LoginForm";

export default function LoginRoute() {
  const router = useRouter();

  return (
    <LoginForm
      onBack={() => router.replace("/")}
      onRegister={() => router.replace("/registrarse")}
      onAuthenticated={(account) =>
        router.replace(
          account.assignedRole === "super_admin" ? "/administracion" : "/",
        )
      }
    />
  );
}
