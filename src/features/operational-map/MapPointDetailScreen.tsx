import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { CollectionCenterCommunityPanel } from "../aid-locations/CollectionCenterCommunityPanel";
import {
  aidLocationCommunityDataSource,
  hasAidLocationCommunity,
  type AidLocationCommunityDataSource,
} from "../aid-locations/communityDataSource";
import { ratingSummaryLine } from "../aid-locations/ratingStars";
import { foodOfferCommunityDataSource } from "../food-offers/communityDataSource";
import { helpRequestCommunityDataSource } from "../help-requests/communityDataSource";
import {
  transportKindLabel,
  transportStatusLabel,
} from "../transports/types";
import {
  useSessionAccount,
  type SessionAccountSource,
} from "../auth/useSessionAccount";
import { CountdownLabel } from "../help-requests/CountdownLabel";
import { resolvePublicMediaUrl } from "../media/publicMediaUrl";
import { categoryMeta } from "./categoryMeta";
import { humanStatusMeta } from "./humanStatusMeta";
import {
  popupPrecisionLabels,
  popupVerificationLabels,
} from "./MapMarkerPopup";
import type { MapPointDetailPayload } from "./pointDetail";

// CHG-164 — Vista de información completa de un punto del mapa. Es
// pública: la ve igual un visitante anónimo que una cuenta registrada.
// Muestra todo lo público disponible del registro; nada más existe del
// otro lado (los datos privados nunca llegan al cliente).

const fullDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const countFormatter = new Intl.NumberFormat("es-CO");

const sourceTypeLabels = {
  official: "Fuente oficial",
  citizen: "Reporte ciudadano",
  sensor: "Sensor",
  integration: "Integración",
  ai_inference: "Inferencia de IA",
} as const;

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : fullDateFormatter.format(parsed);
}

function formatCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

interface DetailRow {
  label: string;
  value: string;
  url?: string;
}

interface DetailContent {
  accentColor: string;
  eyebrow: string;
  title: string;
  // CHG-166: la misma línea de estrellas del popup, solo para acopios
  // locales; null en el resto.
  ratingLine: string | null;
  description: string | null;
  rows: DetailRow[];
  expiresAt: string | null;
  photoUrl: string | null;
  note: string | null;
}

function buildContent(payload: MapPointDetailPayload): DetailContent {
  switch (payload.kind) {
    case "operational": {
      const { point } = payload;
      const meta = categoryMeta[point.category];
      const rows: DetailRow[] = [
        { label: "Ubicación", value: point.locationLabel },
      ];
      const coordinates = formatCoordinates(point.latitude, point.longitude);
      if (coordinates) {
        rows.push({ label: "Coordenadas", value: coordinates });
      }
      rows.push(
        {
          label: "Precisión",
          value: popupPrecisionLabels[point.coordinatePrecision],
        },
        {
          label: "Verificación",
          value: popupVerificationLabels[point.verificationStatus],
        },
        {
          label: "Fuente",
          value: `${point.source.name} · ${sourceTypeLabels[point.source.sourceType]}`,
          url: point.source.url ?? undefined,
        },
      );
      if (point.alertRadiusKm) {
        rows.push({
          label: "Radio de aviso",
          value: `${countFormatter.format(point.alertRadiusKm)} km a la redonda`,
        });
      }
      if (point.relatedDisasterId) {
        rows.push({
          label: "Evento relacionado",
          value: point.relatedDisasterId,
        });
      }
      rows.push({ label: "Actualizado", value: formatDate(point.updatedAt) });
      return {
        accentColor: meta.color,
        eyebrow: meta.shortLabel.toUpperCase(),
        title: point.title,
        // CHG-168: local y receptor comparten las reglas comunitarias.
        ratingLine: hasAidLocationCommunity(point.category)
          ? ratingSummaryLine(
              point.commentRatingAverage,
              point.commentRatingCount,
            )
          : null,
        description: point.description,
        rows,
        expiresAt: null,
        photoUrl: null,
        note: null,
      };
    }
    case "help_request": {
      const { request } = payload;
      const rows: DetailRow[] = [
        { label: "Dirección", value: request.address },
        { label: "Publicada", value: formatDate(request.createdAt) },
        { label: "Vigente hasta", value: formatDate(request.expiresAt) },
        {
          label: "Personas atendiendo",
          value: countFormatter.format(request.attendersCount),
        },
      ];
      const coordinates = formatCoordinates(request.latitude, request.longitude);
      if (coordinates) {
        rows.push({ label: "Coordenadas", value: coordinates });
      }
      if (request.notificationRadiusKm) {
        rows.push({
          label: "Radio de aviso",
          value: `${countFormatter.format(request.notificationRadiusKm)} km a la redonda`,
        });
      }
      return {
        accentColor: colors.emergency,
        eyebrow: "NECESITAMOS AYUDA · SOLICITUD VIGENTE",
        title: request.address,
        // CHG-180: la misma línea de estrellas que un centro de acopio.
        ratingLine: ratingSummaryLine(
          request.commentRatingAverage ?? null,
          request.commentRatingCount ?? 0,
        ),
        description: request.description,
        rows,
        expiresAt: request.expiresAt,
        photoUrl: resolvePublicMediaUrl(request.photoUrl),
        note: null,
      };
    }
    case "food_offer": {
      const { offer } = payload;
      const rows: DetailRow[] = [
        { label: "Dirección", value: offer.address },
        { label: "Publicada", value: formatDate(offer.createdAt) },
        { label: "Vigente hasta", value: formatDate(offer.expiresAt) },
      ];
      const coordinates = formatCoordinates(offer.latitude, offer.longitude);
      if (coordinates) {
        rows.push({ label: "Coordenadas", value: coordinates });
      }
      if (offer.notificationRadiusKm) {
        rows.push({
          label: "Radio de aviso",
          value: `${countFormatter.format(offer.notificationRadiusKm)} km a la redonda`,
        });
      }
      return {
        accentColor: categoryMeta.community_meal.color,
        eyebrow: "COMIDA COMUNITARIA · OFERTA VIGENTE",
        title: offer.address,
        // CHG-176: la misma línea de estrellas que un centro de acopio.
        ratingLine: ratingSummaryLine(
          offer.commentRatingAverage ?? null,
          offer.commentRatingCount ?? 0,
        ),
        description: offer.description,
        rows,
        expiresAt: offer.expiresAt,
        photoUrl: null,
        note: null,
      };
    }
    case "transport": {
      const { transport } = payload;
      const rows: DetailRow[] = [
        {
          label: "Estado",
          value:
            transportStatusLabel[transport.status] ??
            transport.status.toUpperCase(),
        },
        {
          label: "Sale de",
          value: `${transport.originName} · ${transport.originMunicipality}`,
        },
        {
          label: "Llega a",
          value: `${transport.destinationName} · ${transport.destinationMunicipality}`,
        },
      ];
      if (transport.departedAt) {
        rows.push({
          label: "Salió",
          value: formatDate(transport.departedAt),
        });
      }
      if (transport.arrivedAt) {
        rows.push({
          label: "Llegó",
          value: formatDate(transport.arrivedAt),
        });
      }
      if (transport.lastPositionAt) {
        rows.push({
          label: "Última posición",
          value: formatDate(transport.lastPositionAt),
        });
      }
      // §30: identificación VISIBLE del vehículo, jamás los datos del
      // conductor.
      // CHG-173: cada medio se identifica con lo suyo — la mulera con
      // sus placas, la lanchera con la matrícula y el nombre del casco.
      if (transport.tractorPlate) {
        rows.push({ label: "Placa", value: transport.tractorPlate });
      }
      if (transport.trailerPlate) {
        rows.push({
          label: "Placa del tráiler",
          value: transport.trailerPlate,
        });
      }
      if (transport.vesselName) {
        rows.push({ label: "Embarcación", value: transport.vesselName });
      }
      if (transport.vesselType) {
        rows.push({ label: "Tipo", value: transport.vesselType });
      }
      if (transport.vesselRegistration) {
        rows.push({
          label: "Matrícula",
          value: transport.vesselRegistration,
        });
      }
      rows.push({ label: "Registrado", value: formatDate(transport.createdAt) });
      return {
        accentColor: categoryMeta.humanitarian_transport.color,
        eyebrow: "TRANSPORTE DE INSUMOS EN RUTA",
        title: `${transportKindLabel[transport.kind]} en ruta`,
        ratingLine: null,
        description:
          transport.vehicleVisibleCharacteristics ??
          transport.suppliesSummary,
        rows,
        expiresAt: null,
        photoUrl: null,
        note: transport.suppliesSummary
          ? `Insumos que lleva: ${transport.suppliesSummary}`
          : null,
      };
    }
    case "human": {
      const { feature } = payload;
      const meta = humanStatusMeta[feature.status];
      const rows: DetailRow[] = [
        {
          label: "Precisión",
          value: popupPrecisionLabels[feature.coordinatePrecision],
        },
        {
          label: "Verificación",
          value: popupVerificationLabels[feature.verificationStatus],
        },
        {
          label: "Fuente",
          value: `${feature.source.name} · ${sourceTypeLabels[feature.source.sourceType]}`,
          url: feature.source.url ?? undefined,
        },
      ];
      const coordinates = formatCoordinates(feature.latitude, feature.longitude);
      if (coordinates) {
        rows.push({ label: "Coordenadas", value: coordinates });
      }
      rows.push({ label: "Actualizado", value: formatDate(feature.updatedAt) });
      return {
        accentColor: meta.color,
        eyebrow: "PUNTO PÚBLICO ANÓNIMO",
        title: meta.singular,
        ratingLine: null,
        description: null,
        rows,
        expiresAt: null,
        photoUrl: null,
        note: "Este punto es anónimo por diseño: la plataforma no publica datos personales de la persona. Para buscar o aportar novedades sobre alguien, usa el directorio humanitario de la portada.",
      };
    }
  }
}

export function MapPointDetailScreen({
  payload,
  onBack,
  communityDataSource,
  sessionSource,
}: {
  payload: MapPointDetailPayload | null;
  onBack: () => void;
  // CHG-165: inyectable en pruebas; por defecto usa el data source real.
  communityDataSource?: AidLocationCommunityDataSource;
  // CHG-170: inyectable en pruebas; por defecto consulta /auth/me.
  sessionSource?: SessionAccountSource;
}) {
  // CHG-165: los acopios llevan comentarios y denuncias en su vista
  // completa; CHG-168 extiende el alcance del local al receptor.
  const collectionCenterId =
    payload?.kind === "operational" &&
    hasAidLocationCommunity(payload.point.category)
      ? payload.point.id
      : null;
  // CHG-176: la oferta de comida tiene la misma comunidad, con su
  // propia fuente de datos (mismas reglas, otro objetivo).
  const foodOfferId = payload?.kind === "food_offer" ? payload.offer.id : null;
  // CHG-180: la solicitud de ayuda tiene la misma comunidad, con su
  // propia fuente de datos (mismas reglas, otro objetivo).
  const helpRequestId =
    payload?.kind === "help_request" ? payload.request.id : null;
  const communityTargetId = collectionCenterId ?? foodOfferId ?? helpRequestId;
  const communityTargetLabel = foodOfferId
    ? "esta oferta de comida"
    : helpRequestId
      ? "esta solicitud de ayuda"
      : "este centro de acopio";
  // CHG-170: solo el super_admin ve ELIMINAR en la ficha del acopio
  // (ambos tipos); la barrera real es el backend. Dos pasos.
  const session = useSessionAccount(sessionSource);
  const isAdmin =
    session.status === "authenticated" &&
    session.account.assignedRole === "super_admin";
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dataSource =
    communityDataSource ??
    (foodOfferId
      ? foodOfferCommunityDataSource
      : helpRequestId
        ? helpRequestCommunityDataSource
        : aidLocationCommunityDataSource);

  const deleteCenter = async () => {
    if (!communityTargetId) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await dataSource.adminDeleteAidLocation(communityTargetId);
      // El punto ya no existe: la ficha vuelve al mapa.
      onBack();
    } catch (error: unknown) {
      setDeleteArmed(false);
      setDeleteError(
        error instanceof Error
          ? error.message
          : `No fue posible eliminar ${communityTargetLabel}.`,
      );
    } finally {
      setDeleteBusy(false);
    }
  };
  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver al mapa"
              onPress={onBack}
              style={styles.backButton}
            >
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backText}>VOLVER AL MAPA</Text>
            </Pressable>

            {payload === null ? (
              <View
                style={styles.card}
                accessibilityRole="alert"
                testID="map-point-detail-missing"
              >
                <Text style={styles.missingTitle}>
                  No hay información para mostrar
                </Text>
                <Text style={styles.missingText}>
                  Esta vista se abre desde el popup de un marcador del mapa.
                  Vuelve a la portada y toca un punto para ver su resumen y su
                  información completa.
                </Text>
              </View>
            ) : (
              <DetailCard content={buildContent(payload)} />
            )}

            {/* CHG-170: ELIMINAR el acopio, solo para super_admin. */}
            {communityTargetId && isAdmin && (
              <View style={styles.deleteBlock} testID="map-point-delete-block">
                {deleteError && (
                  <Text
                    accessibilityRole="alert"
                    style={styles.deleteError}
                  >
                    {deleteError}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    deleteArmed
                      ? `Confirmar la eliminación de ${communityTargetLabel}`
                      : `Eliminar ${communityTargetLabel}`
                  }
                  disabled={deleteBusy}
                  onPress={() => void deleteCenter()}
                  style={[
                    styles.deleteButton,
                    deleteArmed && styles.deleteButtonArmed,
                  ]}
                  testID="map-point-delete-center"
                >
                  {deleteBusy ? (
                    <ActivityIndicator color="#07101b" />
                  ) : (
                    <Text style={styles.deleteText}>
                      {deleteArmed ? "¿CONFIRMAR ELIMINACIÓN?" : "ELIMINAR"}
                    </Text>
                  )}
                </Pressable>
                <Text style={styles.deleteHint}>
                  Solo la superadministración ve esta opción: elimina
                  definitivamente {communityTargetLabel} (el acto queda
                  auditado).
                </Text>
              </View>
            )}

            {communityTargetId && (
              <CollectionCenterCommunityPanel
                locationId={communityTargetId}
                dataSource={dataSource}
                sessionSource={sessionSource}
                targetLabel={communityTargetLabel}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function DetailCard({ content }: { content: DetailContent }) {
  return (
    <View style={styles.card} testID="map-point-detail-screen">
      <View
        style={[styles.accent, { backgroundColor: content.accentColor }]}
      />
      <Text style={[styles.eyebrow, { color: content.accentColor }]}>
        {content.eyebrow}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {content.title}
      </Text>
      {/* CHG-166: la misma línea de estrellas del popup del mapa. */}
      {content.ratingLine && (
        <Text style={styles.ratingLine} testID="map-point-detail-rating">
          {content.ratingLine}
        </Text>
      )}
      {content.expiresAt && (
        <CountdownLabel
          expiresAt={content.expiresAt}
          style={[styles.countdown, { color: content.accentColor }]}
        />
      )}
      {content.description && (
        <Text style={styles.description}>{content.description}</Text>
      )}

      {content.photoUrl && (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Fotografía del lugar de la solicitud"
          resizeMode="cover"
          source={{ uri: content.photoUrl }}
          style={styles.photo}
          testID="map-point-detail-photo"
        />
      )}

      <View style={styles.rows}>
        {content.rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label.toUpperCase()}</Text>
            {row.url ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Abrir fuente: ${row.value}`}
                onPress={() => void Linking.openURL(row.url as string)}
              >
                <Text style={[styles.rowValue, styles.rowLink]}>
                  {row.value}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.rowValue}>{row.value}</Text>
            )}
          </View>
        ))}
      </View>

      {content.note && <Text style={styles.note}>{content.note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safeArea: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16 },
  content: {
    width: "100%",
    maxWidth: contentMaxWidth,
    alignSelf: "center",
    gap: 14,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  backArrow: { color: colors.cyan, fontSize: font(13), fontWeight: "800" },
  backText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  card: {
    position: "relative",
    gap: 8,
    overflow: "hidden",
    padding: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 12,
    backgroundColor: "rgba(7,12,22,0.94)",
  },
  accent: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3 },
  eyebrow: {
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: colors.ink,
    fontSize: font(20),
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  ratingLine: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: font(13),
  },
  // CHG-170: bloque de eliminación (solo super_admin).
  deleteBlock: { gap: 8 },
  deleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.emergency,
  },
  deleteButtonArmed: {
    borderWidth: 2,
    borderColor: colors.ink,
  },
  deleteText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  deleteError: {
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,77,94,0.4)",
    borderRadius: 8,
    color: colors.inkSoft,
    fontSize: font(12),
    lineHeight: 18,
  },
  deleteHint: { color: colors.inkDim, fontSize: font(11), lineHeight: 16 },
  countdown: {
    fontFamily: fontFamilies.mono,
    fontSize: font(12),
    fontWeight: "800",
  },
  description: {
    color: colors.inkSoft,
    fontSize: font(13),
    lineHeight: 20,
  },
  photo: {
    width: "100%",
    maxWidth: 460,
    height: 240,
    borderRadius: 10,
    backgroundColor: "rgba(13,20,33,0.8)",
  },
  rows: { marginTop: 6, gap: 9 },
  row: { gap: 2 },
  rowLabel: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    letterSpacing: 0.8,
  },
  rowValue: { color: colors.ink, fontSize: font(13), lineHeight: 19 },
  rowLink: { color: colors.cyan, textDecorationLine: "underline" },
  note: {
    marginTop: 6,
    color: colors.inkSoft,
    fontSize: font(11),
    lineHeight: 17,
  },
  missingTitle: { color: colors.ink, fontSize: font(16), fontWeight: "800" },
  missingText: {
    color: colors.inkSoft,
    fontSize: font(12),
    lineHeight: 19,
  },
});
