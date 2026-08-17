import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { formatCountdown } from "./countdown";

// CHG-125 — Etiqueta del contador regresivo con tick de un segundo.
// Solo pinta; cuando la solicitud expira de verdad, el backend deja de
// devolverla y el poll de 30 s la retira de la vista (DEC-125-02).
export function CountdownLabel({
  expiresAt,
  style,
}: {
  expiresAt: string;
  style?: StyleProp<TextStyle>;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), 1_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  return (
    <Text style={style} accessibilityLabel={`Vigencia: ${formatCountdown(expiresAt, now)}`}>
      {formatCountdown(expiresAt, now)}
    </Text>
  );
}
