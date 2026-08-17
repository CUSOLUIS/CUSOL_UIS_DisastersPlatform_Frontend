// CHG-131 — Aviso de proximidad en la app instalada: cuando una
// solicitud activa define radio de aviso y este dispositivo está
// dentro, aparece un banner de emergencia sobre el dashboard. Solo en
// native-app (regla CHG-067): en la web no hay posición vigilada ni
// promesa de aviso. Cada solicitud descartada no vuelve a avisar hasta
// que aparezca una nueva.

import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  detectRuntimeContext,
  rulesForRuntime,
} from "../../platform/runtimeContext";
import { getLastKnownVisitorLocation } from "../operational-map/visitorPresence";
import type { GeographicCenter } from "../operational-map/webMercator";
import { nearbyHelpRequests } from "./proximity";
import type { ActiveHelpRequest } from "./types";

export function HelpRequestProximityAlert({
  items,
  platformOs = Platform.OS,
  // Inyectable en pruebas; por defecto la posición que mantiene el
  // portón de ubicación de la app (CHG-066).
  location = getLastKnownVisitorLocation(),
  style,
}: {
  items: ActiveHelpRequest[];
  platformOs?: typeof Platform.OS;
  location?: GeographicCenter | null;
  // Sin aviso el componente no monta NADA (ni un View vacío): los
  // layouts que cuentan hijos no deben notarlo.
  style?: StyleProp<ViewStyle>;
}) {
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // CHG-067: el aviso de proximidad existe solo en la app instalada.
  const alertsEnabled = rulesForRuntime(
    detectRuntimeContext(platformOs),
  ).showHelpRequestProximityAlerts;

  const nearby = useMemo(
    () =>
      alertsEnabled
        ? nearbyHelpRequests(items, location).filter(
            (entry) => !dismissedIds.has(entry.request.id),
          )
        : [],
    [alertsEnabled, items, location, dismissedIds],
  );

  if (nearby.length === 0) {
    return null;
  }

  const nearest = nearby[0];
  const distanceLabel =
    nearest.distanceKm < 1
      ? "A MENOS DE 1 KM DE TI"
      : `A ${nearest.distanceKm.toFixed(1)} KM DE TI`;

  return (
    <View
      testID="help-request-proximity-alert"
      accessibilityRole="alert"
      style={[styles.banner, style]}
    >
      <View style={styles.textColumn}>
        <Text style={styles.overline}>
          {nearby.length > 1
            ? `NECESITAN AYUDA CERCA · ${nearby.length} SOLICITUDES`
            : `NECESITAN AYUDA · ${distanceLabel}`}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {nearest.request.description}
        </Text>
        <Text style={styles.address}>{nearest.request.address}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Descartar el aviso de ayuda cercana"
        onPress={() =>
          setDismissedIds(
            (current) =>
              new Set([
                ...current,
                ...nearby.map((entry) => entry.request.id),
              ]),
          )
        }
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
      >
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.emergency,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "rgba(255,77,94,0.12)",
  },
  textColumn: { flex: 1, gap: 4 },
  overline: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  description: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  address: { color: colors.inkSoft, fontSize: 11 },
  dismiss: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.5)",
  },
  dismissText: { color: colors.emergency, fontSize: 12 },
  pressed: { opacity: 0.72 },
});
