import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { MapPointDetailScreen } from "../features/operational-map/MapPointDetailScreen";
import { decodeMapPointDetail } from "../features/operational-map/pointDetail";
import { useSafeBack } from "../navigation/useSafeBack";

// CHG-164 — Vista pública «Ver más» de un marcador del mapa. El
// registro llega serializado en ?datos=; si falta o viene corrupto
// (recarga, URL manipulada), la pantalla lo explica y ofrece volver.
export default function MapPointDetailRoute() {
  const { datos } = useLocalSearchParams<{ datos?: string }>();
  const back = useSafeBack();
  const payload = useMemo(
    () => decodeMapPointDetail(typeof datos === "string" ? datos : null),
    [datos],
  );

  return <MapPointDetailScreen payload={payload} onBack={back} />;
}
