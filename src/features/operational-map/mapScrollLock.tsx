// CHG-155 — Bloqueo del scroll padre mientras el gesto nace en un
// mapa. En la APK el ScrollView nativo intercepta el arrastre VERTICAL
// antes de que el responder del mapa lo reclame (lo horizontal no
// compite): el mapa paneaba a los lados pero no arriba/abajo. La
// pantalla que contiene el mapa crea el controlador y pasa su
// `scrollEnabled` al ScrollView; el lienzo bloquea al primer toque y
// desbloquea al soltar. Bloquear alrededor de un tap es inocuo, y en
// web cubre además los toques que nacen en controles del mapa.

import { createContext, useContext, useMemo, useState } from "react";

export interface MapScrollLock {
  lock: () => void;
  unlock: () => void;
}

// Noop por defecto: un mapa fuera de una pantalla cableada no rompe.
const MapScrollLockContext = createContext<MapScrollLock>({
  lock: () => undefined,
  unlock: () => undefined,
});

export const MapScrollLockProvider = MapScrollLockContext.Provider;

export function useMapScrollLock(): MapScrollLock {
  return useContext(MapScrollLockContext);
}

export function useMapScrollLockController(): {
  scrollEnabled: boolean;
  scrollLock: MapScrollLock;
} {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollLock = useMemo(
    () => ({
      lock: () => setScrollEnabled(false),
      unlock: () => setScrollEnabled(true),
    }),
    [],
  );
  return { scrollEnabled, scrollLock };
}
