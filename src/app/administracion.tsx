import { useRouter } from "expo-router";
import { AdminDashboard } from "../features/admin/AdminDashboard";

export default function AdministrationRoute() {
  const router = useRouter();

  return (
    <AdminDashboard
      onHome={() => router.replace("/")}
      onLogin={() => router.replace("/iniciar-sesion")}
    />
  );
}
