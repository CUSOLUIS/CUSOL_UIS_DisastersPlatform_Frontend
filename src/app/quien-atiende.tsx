import { useLocalSearchParams } from "expo-router";
import { HelpRequestAttendersScreen } from "../features/help-requests/HelpRequestAttendersScreen";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-193 — «Ver más» de la píldora de «Mi espacio»: quién atiende la
// solicitud que publicó esta cuenta. La vista no decide nada por su
// cuenta: si la solicitud no es de quien mira, el backend responde lo
// mismo que si no existiera.
export default function HelpRequestAttendersRoute() {
  const { solicitud, direccion } = useLocalSearchParams<{
    solicitud?: string;
    direccion?: string;
  }>();
  const back = useSafeBack();

  return (
    <HelpRequestAttendersScreen
      requestId={typeof solicitud === "string" ? solicitud : null}
      address={typeof direccion === "string" ? direccion : undefined}
      onBack={back}
    />
  );
}
