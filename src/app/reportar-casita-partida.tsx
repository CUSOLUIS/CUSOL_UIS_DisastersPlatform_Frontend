import { Redirect } from "expo-router";

// CHG-182 — «Mi casita partida» pasó a llamarse «Mi casita destruida».
// La ruta anterior se conserva como redirección: hay enlaces
// publicados y bundles viejos que todavía la usan (CHG-137).
export default function LegacyDamagedHomeRoute() {
  return <Redirect href="/reportar-casita-destruida" />;
}
