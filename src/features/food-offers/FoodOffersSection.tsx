import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { CountdownLabel } from "../help-requests/CountdownLabel";
import type { ActiveFoodOffer } from "./types";

const countFormatter = new Intl.NumberFormat("es-CO");

// El verde lima de la categoría `community_meal` del mapa.
const MEAL_ACCENT = "#a3e635";

export interface FoodOffersSectionProps {
  items: ActiveFoodOffer[];
  loading: boolean;
  errorMessage: string | null;
  // Sin marco propio: bloque dentro de otra sección (Mi espacio,
  // patrón DEC-125-09).
  embedded?: boolean;
  maxItems?: number;
  title?: string;
}

// CHG-163 — Ofertas «Ofrecer comida» vigentes: descripción, dirección
// y contador regresivo. La lista viene ya filtrada por vigencia desde
// el backend; aquí no se decide qué expira. Es el canal de
// notificación a las cuentas (patrón DEC-125-11): el listado activo
// alimenta Mi espacio con el pulso de la portada.
export function FoodOffersSection({
  items,
  loading,
  errorMessage,
  embedded = false,
  maxItems,
  title = "Ofertas de comida vigentes",
}: FoodOffersSectionProps) {
  const visibleItems =
    maxItems !== undefined ? items.slice(0, maxItems) : items;

  return (
    <View
      testID={embedded ? "food-offers-embedded" : "food-offers-section"}
      style={[styles.panel, embedded && styles.panelEmbedded]}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.overline}>COMIDA COMUNITARIA</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.lead}>
            Cada oferta expira sola al vencer su vigencia y desaparece de
            la plataforma. La dirección y el punto del mapa indican dónde
            se comparte la comida.
          </Text>
        </View>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>
            {countFormatter.format(items.length)}{" "}
            {items.length === 1 ? "VIGENTE" : "VIGENTES"}
          </Text>
        </View>
      </View>

      {loading && items.length === 0 && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={MEAL_ACCENT} />
          <Text style={styles.loadingText}>Consultando ofertas vigentes…</Text>
        </View>
      )}

      {errorMessage && items.length === 0 && !loading && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {errorMessage}
        </Text>
      )}

      {!loading && !errorMessage && items.length === 0 && (
        <Text style={styles.emptyText}>
          No hay ofertas de comida vigentes en este momento.
        </Text>
      )}

      {visibleItems.map((offer) => (
        <View
          key={offer.id}
          style={styles.item}
          testID={`food-offer-item-${offer.id}`}
        >
          <View style={styles.itemAccent} />
          <View style={styles.itemMain}>
            <CountdownLabel expiresAt={offer.expiresAt} style={styles.countdown} />
            <Text style={styles.itemAddress}>{offer.address}</Text>
            <Text style={styles.itemDescription}>{offer.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(163, 230, 53, 0.28)",
    borderRadius: 14,
    backgroundColor: "rgba(15, 22, 8, 0.55)",
  },
  panelEmbedded: {
    borderRadius: 10,
    padding: 12,
  },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headingCopy: { minWidth: 220, flex: 1 },
  overline: {
    marginBottom: 3,
    color: MEAL_ACCENT,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: font(20),
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  lead: {
    maxWidth: 720,
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: font(11),
    lineHeight: 17,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(163, 230, 53, 0.36)",
    borderRadius: 6,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: MEAL_ACCENT,
  },
  badgeText: {
    color: MEAL_ACCENT,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  loadingText: { color: colors.inkSoft, fontSize: font(11) },
  emptyText: { color: colors.inkDim, fontSize: font(12), lineHeight: 18 },
  errorText: { color: colors.reported, fontSize: font(11), lineHeight: 17 },
  item: {
    position: "relative",
    overflow: "hidden",
    padding: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.panelSoft,
  },
  itemAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: MEAL_ACCENT,
  },
  itemMain: { minWidth: 0, gap: 5 },
  countdown: {
    color: MEAL_ACCENT,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  itemAddress: { color: colors.ink, fontSize: font(14), fontWeight: "700" },
  itemDescription: {
    color: colors.inkSoft,
    fontSize: font(12),
    lineHeight: 18,
  },
});
