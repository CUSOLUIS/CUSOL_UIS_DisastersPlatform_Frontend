import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { CountdownLabel } from "../help-requests/CountdownLabel";
import type { ActiveHelpRequest } from "../help-requests/types";
import type { ActiveFoodOffer } from "../food-offers/types";
import type { ActiveDamagedHome } from "../damaged-homes/types";
import {
  transportKindLabel,
  transportStatusLabel,
  type ActiveTransport,
} from "../transports/types";
import { hasAidLocationCommunity } from "../aid-locations/communityDataSource";
import { ratingSummaryLine } from "../aid-locations/ratingStars";
import { categoryMeta } from "./categoryMeta";
import { humanStatusMeta } from "./humanStatusMeta";
import type { MapPointDetailPayload } from "./pointDetail";
import type { HumanMapFeature, OperationalMapPoint } from "./types";

// CHG-164 — Popup de resumen al tocar cualquier marcador del mapa:
// lo más básico del registro, «VER MÁS» hacia la vista completa y «X»
// para cerrar. Vale igual para visitantes anónimos y registrados; los
// clústeres humanos no ofrecen «VER MÁS» porque son grupos anónimos
// sin más información que su desglose.

export type MapMarkerPopupTarget =
  | { kind: "operational"; point: OperationalMapPoint }
  | { kind: "help_request"; request: ActiveHelpRequest }
  | { kind: "food_offer"; offer: ActiveFoodOffer }
  // CHG-182: casita destruida publicada por su familia.
  | { kind: "damaged_home"; home: ActiveDamagedHome }
  | { kind: "human"; feature: HumanMapFeature }
  // CHG-171: viaje de La Mulera/La Lanchera en curso.
  | { kind: "transport"; transport: ActiveTransport };

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const countFormatter = new Intl.NumberFormat("es-CO");

export const popupVerificationLabels = {
  unverified: "Sin verificar",
  under_review: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
} as const;

export const popupPrecisionLabels = {
  exact: "Coordenada exacta",
  approximate: "Zona aproximada",
  municipality: "Referencia municipal",
} as const;

/**
 * El registro que abriría «VER MÁS», o `null` cuando no hay vista
 * completa que ofrecer (clústeres anónimos).
 */
export function detailPayloadFromTarget(
  target: MapMarkerPopupTarget,
): MapPointDetailPayload | null {
  switch (target.kind) {
    case "operational":
      return { kind: "operational", point: target.point };
    case "help_request":
      return { kind: "help_request", request: target.request };
    case "food_offer":
      return { kind: "food_offer", offer: target.offer };
    case "damaged_home":
      return { kind: "damaged_home", home: target.home };
    case "human":
      return target.feature.kind === "point"
        ? { kind: "human", feature: target.feature }
        : null;
    case "transport":
      return { kind: "transport", transport: target.transport };
  }
}

interface PopupSummary {
  accentColor: string;
  eyebrow: string;
  title: string;
  // CHG-166: promedio de estrellas de un acopio local, encima del
  // resumen; null en las demás categorías.
  ratingLine: string | null;
  description: string | null;
  metaLines: string[];
  expiresAt: string | null;
}

function summarize(target: MapMarkerPopupTarget): PopupSummary {
  switch (target.kind) {
    case "operational": {
      const meta = categoryMeta[target.point.category];
      return {
        accentColor: meta.color,
        eyebrow: meta.shortLabel.toUpperCase(),
        title: target.point.title,
        // CHG-168: local y receptor comparten las reglas comunitarias.
        ratingLine: hasAidLocationCommunity(target.point.category)
          ? ratingSummaryLine(
              target.point.commentRatingAverage,
              target.point.commentRatingCount,
            )
          : null,
        description: target.point.description,
        metaLines: [
          target.point.locationLabel,
          `${popupVerificationLabels[target.point.verificationStatus]} · Actualizado ${dateFormatter.format(new Date(target.point.updatedAt))}`,
        ],
        expiresAt: null,
      };
    }
    case "help_request":
      return {
        accentColor: colors.emergency,
        eyebrow: "NECESITAMOS AYUDA · SOLICITUD VIGENTE",
        // CHG-180: la solicitud también se califica, así que su tarjeta
        // muestra la puntuación como la de un centro de acopio.
        ratingLine: ratingSummaryLine(
          target.request.commentRatingAverage ?? null,
          target.request.commentRatingCount ?? 0,
        ),
        title: target.request.address,
        description: target.request.description,
        metaLines: [
          target.request.attendersCount === 1
            ? "1 persona atendiendo"
            : `${countFormatter.format(target.request.attendersCount)} personas atendiendo`,
        ],
        expiresAt: target.request.expiresAt,
      };
    case "food_offer":
      return {
        accentColor: categoryMeta.community_meal.color,
        eyebrow: "COMIDA COMUNITARIA · OFERTA VIGENTE",
        // CHG-176: la oferta también se califica, así que su tarjeta
        // muestra la puntuación como la de un centro de acopio.
        ratingLine: ratingSummaryLine(
          target.offer.commentRatingAverage ?? null,
          target.offer.commentRatingCount ?? 0,
        ),
        title: target.offer.address,
        description: target.offer.description,
        metaLines: [],
        expiresAt: target.offer.expiresAt,
      };
    case "damaged_home": {
      const { home } = target;
      const personas =
        home.householdSize === null
          ? null
          : home.householdSize === 1
            ? "1 persona vive aquí"
            : `${countFormatter.format(home.householdSize)} personas viven aquí`;
      return {
        accentColor: categoryMeta.damaged_home.color,
        eyebrow: "MI CASITA DESTRUIDA",
        // La misma línea de estrellas que un centro de acopio.
        ratingLine: ratingSummaryLine(
          home.commentRatingAverage ?? null,
          home.commentRatingCount ?? 0,
        ),
        title: home.address,
        description: home.description,
        metaLines: personas ? [personas] : [],
        expiresAt: null,
      };
    }
    case "transport": {
      const { transport } = target;
      const journeyLines = [
        `${transport.originName} (${transport.originMunicipality}) → ${transport.destinationName} (${transport.destinationMunicipality})`,
      ];
      if (transport.departedAt) {
        journeyLines.push(
          `Salió: ${dateFormatter.format(new Date(transport.departedAt))}`,
        );
      }
      if (transport.arrivedAt) {
        journeyLines.push(
          `Llegó: ${dateFormatter.format(new Date(transport.arrivedAt))}`,
        );
      }
      if (transport.lastPositionAt && !transport.arrivedAt) {
        journeyLines.push(
          `Última posición: ${dateFormatter.format(new Date(transport.lastPositionAt))}`,
        );
      }
      return {
        accentColor: categoryMeta.humanitarian_transport.color,
        eyebrow: `TRANSPORTE DE INSUMOS · ${transportStatusLabel[transport.status] ?? transport.status.toUpperCase()}`,
        ratingLine: null,
        title: `${transportKindLabel[transport.kind]} en ruta`,
        description: transport.suppliesSummary,
        metaLines: journeyLines,
        expiresAt: null,
      };
    }
    case "human": {
      if (target.feature.kind === "cluster") {
        const counts = target.feature.statusCounts;
        return {
          accentColor: colors.cyan,
          eyebrow: "GRUPO ANÓNIMO DE PERSONAS",
          ratingLine: null,
          title: `${countFormatter.format(target.feature.count)} personas`,
          description:
            "El mapa se acerca para dividir el grupo en sus puntos.",
          metaLines: [
            `${counts.missing} desaparecidas · ${counts.reportedDeceased} muertes reportadas · ${counts.confirmedAlive} confirmadas vivas · ${counts.confirmedDeceased} muertes confirmadas`,
          ],
          expiresAt: null,
        };
      }
      const meta = humanStatusMeta[target.feature.status];
      return {
        accentColor: meta.color,
        eyebrow: "PUNTO PÚBLICO ANÓNIMO",
        ratingLine: null,
        title: meta.singular,
        description: null,
        metaLines: [
          `${popupPrecisionLabels[target.feature.coordinatePrecision]} · ${popupVerificationLabels[target.feature.verificationStatus]}`,
          `${target.feature.source.name} · ${dateFormatter.format(new Date(target.feature.updatedAt))}`,
        ],
        expiresAt: null,
      };
    }
  }
}

export function MapMarkerPopup({
  target,
  onClose,
  onViewMore,
}: {
  target: MapMarkerPopupTarget;
  onClose: () => void;
  onViewMore?: (payload: MapPointDetailPayload) => void;
}) {
  const summary = summarize(target);
  const payload = detailPayloadFromTarget(target);

  return (
    <View
      style={styles.popup}
      testID="map-marker-popup"
      accessibilityLabel={`Resumen del punto: ${summary.title}`}
    >
      <View style={[styles.accent, { backgroundColor: summary.accentColor }]} />
      <View style={styles.header}>
        <Text
          style={[styles.eyebrow, { color: summary.accentColor }]}
          numberOfLines={2}
        >
          {summary.eyebrow}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar ventana de información"
          onPress={onClose}
          style={styles.close}
          testID="map-marker-popup-close"
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {summary.title}
      </Text>
      {/* CHG-166: promedio de estrellas del acopio, encima del resumen. */}
      {summary.ratingLine && (
        <Text style={styles.ratingLine} testID="map-marker-popup-rating">
          {summary.ratingLine}
        </Text>
      )}
      {summary.description && (
        <Text style={styles.description} numberOfLines={3}>
          {summary.description}
        </Text>
      )}
      {summary.metaLines.map((line) => (
        <Text key={line} style={styles.metaLine} numberOfLines={2}>
          {line}
        </Text>
      ))}
      {summary.expiresAt && (
        <CountdownLabel
          expiresAt={summary.expiresAt}
          style={[styles.metaLine, { color: summary.accentColor }]}
        />
      )}
      {payload && onViewMore && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver más información del punto"
          onPress={() => onViewMore(payload)}
          style={[styles.moreButton, { borderColor: summary.accentColor }]}
          testID="map-marker-popup-more"
        >
          <Text style={[styles.moreText, { color: summary.accentColor }]}>
            VER MÁS
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 8,
    maxWidth: 420,
    alignSelf: "center",
    gap: 5,
    overflow: "hidden",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
    backgroundColor: "rgba(7,12,22,0.96)",
  },
  accent: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  eyebrow: {
    flex: 1,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  close: {
    marginTop: -4,
    marginRight: -6,
    padding: 6,
    borderRadius: 6,
  },
  closeGlyph: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(13),
    fontWeight: "800",
  },
  title: { color: colors.ink, fontSize: font(14), fontWeight: "800" },
  ratingLine: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
  },
  description: {
    color: colors.inkSoft,
    fontSize: font(11),
    lineHeight: 17,
  },
  metaLine: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
  },
  moreButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 6,
  },
  moreText: {
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
