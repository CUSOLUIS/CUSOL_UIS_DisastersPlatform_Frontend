import { useEffect, useState } from "react";

// CHG-082 — Aviso interno de "hay registros nuevos": la sonda de la
// señal de cambios lo publica y cada módulo de la portada suscrito
// refresca de inmediato (sin perder su sondeo de respaldo de 30 s).

type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyDataRefresh(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToDataRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Contador que crece con cada aviso; se agrega a las dependencias del
// efecto de carga de cada módulo para disparar su refetch.
export function useDataRefreshTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(
    () => subscribeToDataRefresh(() => setTick((count) => count + 1)),
    [],
  );
  return tick;
}
