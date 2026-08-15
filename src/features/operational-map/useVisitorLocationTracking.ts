import { useCallback, useEffect, useRef, useState } from "react";
import type { GeographicCenter } from "./webMercator";
import {
  getGeolocationPermissionState,
  requestVisitorLocation,
  watchVisitorLocation,
  type GeolocationPermissionState,
} from "./visitorLocation";
import {
  reportVisitorPresence,
  setLastKnownVisitorLocation,
} from "./visitorPresence";

// CHG-064: ubicación del visitante con seguimiento en vivo. Al activar
// (botón) se centra el mapa una vez y el marcador sigue moviéndose con
// la persona mientras la página esté abierta. Si el navegador recuerda
// el permiso concedido, el seguimiento se reanuda solo al volver; si lo
// olvidó o fue revocado, el botón vuelve a pedirlo.

// CHG-066: cada lectura actualiza la instantánea para reportes y, solo
// con sesión de usuario registrado, se comparte en vivo (throttle en el
// módulo de presencia; sin sesión el gateway la rechaza y se pausa).
function defaultShare(center: GeographicCenter) {
  setLastKnownVisitorLocation(center);
  void reportVisitorPresence(center);
}

interface UseVisitorLocationTrackingOptions {
  onCenter: (center: GeographicCenter) => void;
  locate?: () => Promise<GeographicCenter>;
  watch?: (
    onUpdate: (center: GeographicCenter) => void,
    onRevoked?: () => void,
  ) => () => void;
  permissionState?: () => Promise<GeolocationPermissionState>;
  share?: (center: GeographicCenter) => void;
}

export function useVisitorLocationTracking({
  onCenter,
  locate = requestVisitorLocation,
  watch = watchVisitorLocation,
  permissionState = getGeolocationPermissionState,
  share = defaultShare,
}: UseVisitorLocationTrackingOptions) {
  const [location, setLocation] = useState<GeographicCenter | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const onCenterRef = useRef(onCenter);
  const mountedRef = useRef(true);
  const autoResumedRef = useRef(false);
  onCenterRef.current = onCenter;

  useEffect(
    () => () => {
      mountedRef.current = false;
      stopWatchRef.current?.();
    },
    [],
  );

  const startWatch = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = watch(
      (updated) => {
        if (mountedRef.current) setLocation(updated);
        share(updated);
      },
      () => {
        // Permiso revocado: se detiene el seguimiento y desaparece el
        // marcador; el botón queda listo para pedirlo de nuevo.
        stopWatchRef.current?.();
        stopWatchRef.current = null;
        if (mountedRef.current) setLocation(null);
        setLastKnownVisitorLocation(null);
      },
    );
  }, [share, watch]);

  const activate = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const located = await locate();
      share(located);
      if (!mountedRef.current) return;
      setLocation(located);
      onCenterRef.current(located);
      startWatch();
    } catch (caught: unknown) {
      if (mountedRef.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No fue posible obtener tu ubicación.",
        );
      }
    } finally {
      if (mountedRef.current) setLocating(false);
    }
  }, [locate, share, startWatch]);

  useEffect(() => {
    if (autoResumedRef.current) return;
    autoResumedRef.current = true;
    let cancelled = false;
    void permissionState().then((state) => {
      // Reanudar SOLO con permiso ya concedido: jamás se dispara el
      // diálogo del navegador sin que la persona pulse el botón.
      if (!cancelled && state === "granted") {
        void activate();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activate, permissionState]);

  return { location, activate, locating, error };
}
