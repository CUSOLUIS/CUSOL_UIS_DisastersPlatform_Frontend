import { useLocalSearchParams, useRouter } from "expo-router";
import { EmailVerification } from "../features/auth/EmailVerification";

export default function EmailVerificationRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const resolvedToken = Array.isArray(token) ? token[0] : (token ?? null);

  return (
    <EmailVerification
      token={resolvedToken && resolvedToken.length > 0 ? resolvedToken : null}
      onEnter={() => router.replace("/")}
      onLogin={() => router.replace("/iniciar-sesion")}
    />
  );
}
