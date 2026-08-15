import { useRouter } from "expo-router";

// CHG-079 — Tras una recarga (F5) o un acceso directo por URL la ruta
// arranca con la pila de navegación vacía: `router.back()` sería un
// no-op y dejaría el botón VOLVER muerto. Si no hay a dónde volver,
// se reemplaza hacia la portada (replace, no push: sin entradas
// fantasma en el historial).
export function useSafeBack(): () => void {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };
}
