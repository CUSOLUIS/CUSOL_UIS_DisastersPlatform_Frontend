import { useRouter } from "expo-router";
import { FoodOfferForm } from "../features/food-offers/FoodOfferForm";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-163 — Ruta pública de la oferta «Ofrecer comida».
export default function OfferFoodRoute() {
  const router = useRouter();
  // CHG-079: VOLVER funciona también tras recarga o URL directa.
  const safeBack = useSafeBack();

  return (
    <FoodOfferForm
      onBack={safeBack}
      onHome={() => router.replace("/")}
      onRegister={() => router.push("/registrarse")}
      onLogin={() => router.push("/iniciar-sesion")}
    />
  );
}
