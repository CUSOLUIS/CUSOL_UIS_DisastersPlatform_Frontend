import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { LazyImage } from "../../components/LazyImage";
import { resolvePublicMediaUrl } from "../media/publicMediaUrl";
import { fetchPersonNovelties } from "./dataSource";
import type {
  FetchPersonNovelties,
  MissingPersonDirectoryCard,
  PersonStatusReportPublic,
  PersonStatusReportsPage,
} from "./types";

// CHG-077 — Al abrir la tarjeta de una persona se ven las novedades
// reportadas por terceros: qué dicen quienes la encontraron, cuándo y
// de qué tipo de reportante vienen. El estado público cambia solo:
// 5+ coincidencias comunitarias, sector salud o decisión del equipo.

const outcomeLabels: Record<"found" | "deceased", string> = {
  found: "LA REPORTAN ENCONTRADA",
  deceased: "LA REPORTAN FALLECIDA",
};

const reporterLabels = {
  anonymous: "REPORTE ANÓNIMO",
  authenticated: "REPORTE CON CUENTA",
  health_sector: "SECTOR SALUD",
} as const;

const statusLabels = {
  missing: "DESAPARECIDA",
  found: "ENCONTRADA",
  deceased: "FALLECIDA",
} as const;

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

// CHG-151: la fecha de última visualización se muestra sin hora.
const dayFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

type PanelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; page: PersonStatusReportsPage };

export function PersonNoveltyPanel({
  person,
  onBack,
  onContribute,
  fetchNovelties = fetchPersonNovelties,
}: {
  person: MissingPersonDirectoryCard;
  onBack: () => void;
  onContribute: () => void;
  fetchNovelties?: FetchPersonNovelties;
}) {
  const [state, setState] = useState<PanelState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchNovelties(person.id)
      .then((page) => {
        if (!cancelled) setState({ status: "success", page });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "No fue posible consultar las novedades.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchNovelties, person.id]);

  const publicStatus =
    state.status === "success" ? state.page.publicStatus : person.status;

  return (
    <View
      style={styles.panel}
      accessibilityLabel={`Novedades sobre ${person.displayName}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver a los resultados"
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← VOLVER A RESULTADOS</Text>
      </Pressable>

      {/* CHG-151: ficha pública — foto y datos NO sensibles (los datos
          sensibles nunca salen en esta proyección). */}
      <View style={styles.header}>
        <View style={styles.identity}>
          {resolvePublicMediaUrl(person.publicPhotoUrl) ? (
            <LazyImage
              containerStyle={styles.avatar}
              placeholder={<AvatarFallback name={person.displayName} />}
              accessibilityLabel={`Fotografía pública autorizada de ${person.displayName}`}
              source={{
                uri: resolvePublicMediaUrl(person.publicPhotoUrl)!,
              }}
              resizeMode="cover"
              style={styles.avatarPhoto}
            />
          ) : (
            <View style={styles.avatar}>
              <AvatarFallback name={person.displayName} />
            </View>
          )}
          <View style={styles.identityCopy}>
            <Text style={styles.overline}>{person.publicCaseCode}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {person.displayName}
            </Text>
            <Text style={styles.statusBadge}>
              ESTADO ACTUAL · {statusLabels[publicStatus]}
            </Text>
          </View>
        </View>

        <View style={styles.fichaGrid}>
          <FichaField
            label="EDAD APROXIMADA"
            value={
              person.approximateAge === null
                ? "Sin confirmar"
                : `${person.approximateAge} años`
            }
          />
          <FichaField label="ÚLTIMA ZONA PÚBLICA" value={person.lastSeenArea} />
          <FichaField
            label="MUNICIPIO / DEPARTAMENTO"
            value={`${person.municipality}, ${person.department}`}
          />
          <FichaField
            label="VISTA POR ÚLTIMA VEZ"
            value={dayFormatter.format(new Date(person.lastSeenAt))}
          />
          <FichaField label="FUENTE" value={person.source.name} />
        </View>

        <Text style={styles.rulesText}>
          El estado público cambia automáticamente cuando 5 o más
          personas reportan el mismo desenlace, de inmediato si reporta
          alguien del sector salud, y siempre que el equipo lo decida.
        </Text>
      </View>

      {state.status === "loading" && (
        <View style={styles.statePanel} accessibilityLabel="Cargando novedades">
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.stateText}>Cargando novedades…</Text>
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.statePanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Novedades no disponibles</Text>
          <Text style={styles.stateText}>{state.message}</Text>
        </View>
      )}

      {state.status === "success" && (
        <>
          <Text style={styles.countLine}>
            {state.page.total === 0
              ? "AÚN NO HAY NOVEDADES DE TERCEROS"
              : `${state.page.total} ${
                  state.page.total === 1 ? "NOVEDAD" : "NOVEDADES"
                } DE TERCEROS`}
          </Text>
          {state.page.items.map((item) => (
            <NoveltyCard key={item.id} item={item} />
          ))}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reportar novedad sobre ${person.displayName}`}
        onPress={onContribute}
        style={styles.contributeButton}
      >
        <Text style={styles.contributeText}>
          REPORTAR ENCONTRADA O FALLECIDA →
        </Text>
      </Pressable>
    </View>
  );
}

// CHG-151: dato público etiquetado dentro de la ficha.
function FichaField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fichaField}>
      <Text style={styles.fichaLabel}>{label}</Text>
      <Text style={styles.fichaValue}>{value}</Text>
    </View>
  );
}

// CHG-151: avatar de reemplazo cuando no hay foto pública autorizada.
function AvatarFallback({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("es-CO") || "?";
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

function NoveltyCard({ item }: { item: PersonStatusReportPublic }) {
  return (
    <View style={styles.novelty} testID={`person-novelty-${item.id}`}>
      <View style={styles.noveltyHeader}>
        <Text
          style={[
            styles.outcome,
            item.claimedOutcome === "deceased" && styles.outcomeDeceased,
          ]}
        >
          {outcomeLabels[item.claimedOutcome]}
        </Text>
        <Text
          style={[
            styles.reporterBadge,
            item.reporterKind === "health_sector" && styles.healthBadge,
          ]}
        >
          {reporterLabels[item.reporterKind]}
        </Text>
        {item.moderationStatus === "accepted" && (
          <Text style={styles.acceptedBadge}>VERIFICADA POR EL EQUIPO</Text>
        )}
      </View>
      <Text style={styles.evidence}>{item.evidenceDescription}</Text>
      {item.locationDescription && (
        <Text style={styles.detailLine}>
          LUGAR · {item.locationDescription}
        </Text>
      )}
      <Text style={styles.detailLine}>
        {item.occurredAt
          ? `OCURRIÓ · ${dateFormatter.format(new Date(item.occurredAt))} · `
          : ""}
        RECIBIDA · {dateFormatter.format(new Date(item.receivedAt))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  backButton: { alignSelf: "flex-start", paddingVertical: 8 },
  backText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  header: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  identityCopy: { flex: 1, minWidth: 0, gap: 6 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: { width: "100%", height: "100%" },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.inkSoft, fontSize: 26, fontWeight: "800" },
  fichaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  fichaField: { minWidth: 130, flexGrow: 1, flexBasis: 130, gap: 2 },
  fichaLabel: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  fichaValue: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  overline: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  statusBadge: {
    alignSelf: "flex-start",
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  rulesText: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  statePanel: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
  },
  stateText: { color: colors.inkSoft, fontSize: 13 },
  errorTitle: { color: colors.reported, fontSize: 15, fontWeight: "700" },
  countLine: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  novelty: {
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  noveltyHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  outcome: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  outcomeDeceased: { color: colors.deceased },
  reporterBadge: {
    color: colors.inkDim,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  healthBadge: { color: colors.cyan, borderColor: colors.lineStrong },
  acceptedBadge: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  evidence: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  detailLine: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  contributeButton: {
    backgroundColor: colors.cyan,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  contributeText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
