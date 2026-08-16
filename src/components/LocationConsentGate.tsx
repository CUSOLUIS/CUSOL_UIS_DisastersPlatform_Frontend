// CHG-066: consentimiento obligatorio de ubicación en la app instalada.
// Al abrir la app (Android/iOS) toda persona debe aceptar que, mientras
// la app esté en uso, su ubicación se comparte con la plataforma. La
// posición en vivo solo llega al dashboard super_admin cuando hay
// sesión de usuario registrado (el gateway rechaza al anónimo); para
// los anónimos la única huella es la instantánea cifrada adjunta a los
// reportes que envíen. En la web no aplica este portón: allí el flujo
// sigue siendo el botón de ubicación del mapa.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../theme";
import {
  detectRuntimeContext,
  rulesForRuntime,
} from "../platform/runtimeContext";
import {
  reportVisitorPresence,
  setLastKnownVisitorLocation,
} from "../features/operational-map/visitorPresence";

export interface LocationWatchSubscription {
  remove(): void;
}

export interface LocationWatcher {
  // CHG-110: estado actual del permiso, sin pedirlo. Es lo que permite
  // saber si el aviso ya se aceptó en una sesión anterior.
  getPermissionStatus?(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  watch(
    onSample: (sample: {
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
    }) => void,
  ): Promise<LocationWatchSubscription>;
}

async function loadExpoLocationWatcher(): Promise<LocationWatcher> {
  const location = await import("expo-location");
  return {
    async getPermissionStatus() {
      // Consulta sin abrir el diálogo del sistema.
      const response = await location.getForegroundPermissionsAsync();
      return response.granted;
    },
    async requestPermission() {
      const response = await location.requestForegroundPermissionsAsync();
      return response.granted;
    },
    async watch(onSample) {
      return location.watchPositionAsync(
        {
          accuracy: location.Accuracy.Balanced,
          timeInterval: 30_000,
          distanceInterval: 25,
        },
        (position) =>
          onSample({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy ?? undefined,
          }),
      );
    },
  };
}

// CHG-110: "checking" es el estado inicial mientras se consulta el
// permiso. Antes se arrancaba en "consent", así que el aviso aparecía
// en cada apertura aunque el permiso llevara meses concedido.
type GateStatus =
  | "checking"
  | "consent"
  | "requesting"
  | "denied"
  | "ready";

export function LocationConsentGate({
  children,
  watcher,
  platformOs = Platform.OS,
}: {
  children: React.ReactNode;
  watcher?: () => Promise<LocationWatcher>;
  platformOs?: typeof Platform.OS;
}) {
  // CHG-067: la obligatoriedad del portón es una regla por contexto de
  // ejecución (solo la app instalada la exige).
  const gateRequired = rulesForRuntime(
    detectRuntimeContext(platformOs),
  ).requireLocationConsentGate;
  const [status, setStatus] = useState<GateStatus>(
    gateRequired ? "checking" : "ready",
  );
  const subscriptionRef = useRef<LocationWatchSubscription | null>(null);
  const mountedRef = useRef(true);
  const loadWatcher = watcher ?? loadExpoLocationWatcher;

  useEffect(
    () => () => {
      mountedRef.current = false;
      subscriptionRef.current?.remove();
    },
    [],
  );

  const startWatching = useCallback(
    async (active: LocationWatcher) => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = await active.watch((sample) => {
        const center = {
          latitude: sample.latitude,
          longitude: sample.longitude,
        };
        setLastKnownVisitorLocation(center);
        void reportVisitorPresence(center, {
          accuracyMeters: sample.accuracyMeters,
        });
      });
      if (mountedRef.current) setStatus("ready");
    },
    [],
  );

  // CHG-110: al abrir la app se consulta el permiso vigente antes de
  // decidir. El permiso del sistema es la persistencia: si sigue
  // concedido, el aviso ya se aceptó y no se vuelve a mostrar; si el
  // usuario lo revocó desde los ajustes, reaparece. Una bandera propia
  // podría contradecir al sistema y dejar la app bloqueada o pidiendo
  // permisos que ya no tiene.
  useEffect(() => {
    if (!gateRequired) return;
    let cancelled = false;

    const resolveInitialStatus = async () => {
      try {
        const active = await loadWatcher();
        const alreadyGranted = await active.getPermissionStatus?.();
        if (cancelled || !mountedRef.current) return;
        if (alreadyGranted) {
          await startWatching(active);
          return;
        }
        setStatus("consent");
      } catch {
        // Sin proveedor de ubicación disponible no se bloquea el uso.
        if (!cancelled && mountedRef.current) setStatus("ready");
      }
    };

    void resolveInitialStatus();
    return () => {
      cancelled = true;
    };
  }, [gateRequired, loadWatcher, startWatching]);

  const accept = useCallback(async () => {
    setStatus("requesting");
    try {
      const active = await loadWatcher();
      const granted = await active.requestPermission();
      if (!granted) {
        if (mountedRef.current) setStatus("denied");
        return;
      }
      await startWatching(active);
    } catch {
      // Sin proveedor de ubicación disponible no se bloquea el uso.
      if (mountedRef.current) setStatus("ready");
    }
  }, [loadWatcher, startWatching]);

  if (status === "ready") return <>{children}</>;

  // CHG-110: mientras se resuelve el permiso no se pinta el aviso, que
  // era lo que hacía parpadear el consentimiento a quien ya lo dio.
  if (status === "checking") {
    return (
      <View style={styles.root} testID="location-consent-checking">
        <ActivityIndicator size="large" color={colors.cyan} />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="location-consent-gate">
      <View style={styles.card}>
        <Text style={styles.overline}>CUSOL · DESASTRES COLOMBIA</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Ubicación mientras usas la app
        </Text>
        <Text style={styles.body}>
          Para coordinar la respuesta a emergencias, esta app comparte tu
          ubicación con la plataforma mientras está en uso. La posición en
          vivo solo es visible para la superadministración de CUSOL; si
          envías un reporte, se adjunta la coordenada del momento, siempre
          cifrada.
        </Text>
        {status === "denied" && (
          <Text style={styles.denied}>
            El permiso de ubicación es necesario para usar la app.
            Concédelo en la configuración del sistema o inténtalo de
            nuevo.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aceptar y compartir ubicación"
          disabled={status === "requesting"}
          onPress={() => void accept()}
          style={styles.acceptButton}
        >
          {status === "requesting" ? (
            <ActivityIndicator size="small" color={colors.canvas} />
          ) : (
            <Text style={styles.acceptText}>ACEPTAR Y CONTINUAR</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "700",
  },
  body: {
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  denied: {
    color: colors.reported,
    fontSize: 14,
    lineHeight: 20,
  },
  acceptButton: {
    marginTop: 6,
    backgroundColor: colors.cyan,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  acceptText: {
    color: colors.canvas,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
});
