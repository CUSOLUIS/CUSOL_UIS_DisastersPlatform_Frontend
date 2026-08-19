// CHG-163 — Aviso de proximidad de las ofertas de comida en la app
// instalada (patrón CHG-131): cuando una oferta activa define radio de
// aviso y este dispositivo está dentro, aparece un banner sobre el
// dashboard. Solo en native-app (regla CHG-067): en la web no hay
// posición vigilada ni promesa de aviso. Cada oferta descartada no
// vuelve a avisar hasta que aparezca una nueva.

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
import { nearbyFoodOffers } from "./proximity";
import type { ActiveFoodOffer } from "./types";

// El verde lima de la categoría `community_meal` del mapa.
const MEAL_ACCENT = "#a3e635";

export function FoodOfferProximityAlert({
  items,
  platformOs = Platform.OS,
  // Inyectable en pruebas; por defecto la posición que mantiene el
  // portón de ubicación de la app (CHG-066).
  location = getLastKnownVisitorLocation(),
  style,
}: {
  items: ActiveFoodOffer[];
  platformOs?: typeof Platform.OS;
  location?: GeographicCenter | null;
  // Sin aviso el componente no monta NADA (ni un View vacío): los
  // layouts que cuentan hijos no deben notarlo.
  style?: StyleProp<ViewStyle>;
}) {
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // CHG-067: el aviso de proximidad existe solo en la app instalada
  // (misma regla que las solicitudes de ayuda).
  const alertsEnabled = rulesForRuntime(
    detectRuntimeContext(platformOs),
  ).showHelpRequestProximityAlerts;

  const nearby = useMemo(
    () =>
      alertsEnabled
        ? nearbyFoodOffers(items, location).filter(
            (entry) => !dismissedIds.has(entry.offer.id),
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
      testID="food-offer-proximity-alert"
      accessibilityRole="alert"
      style={[styles.banner, style]}
    >
      <View style={styles.textColumn}>
        <Text style={styles.overline}>
          {nearby.length > 1
            ? `COMIDA COMUNITARIA CERCA · ${nearby.length} OFERTAS`
            : `COMIDA COMUNITARIA · ${distanceLabel}`}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {nearest.offer.description}
        </Text>
        <Text style={styles.address}>{nearest.offer.address}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Descartar el aviso de comida cercana"
        onPress={() =>
          setDismissedIds(
            (current) =>
              new Set([
                ...current,
                ...nearby.map((entry) => entry.offer.id),
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
    borderColor: MEAL_ACCENT,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "rgba(163,230,53,0.10)",
  },
  textColumn: { flex: 1, gap: 4 },
  overline: {
    color: MEAL_ACCENT,
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
    borderColor: "rgba(163,230,53,0.5)",
  },
  dismissText: { color: MEAL_ACCENT, fontSize: 12 },
  pressed: { opacity: 0.72 },
});
