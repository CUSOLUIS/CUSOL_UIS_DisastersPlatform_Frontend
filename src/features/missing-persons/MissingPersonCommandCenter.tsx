import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import {
  reportActionCatalog,
  type ReportActionCopy,
} from "../reporting/reportActionCatalog";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import type {
  MissingPersonPublicRecord,
  MissingPersonSearchDataSource,
} from "./types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; items: MissingPersonPublicRecord[]; total: number }
  | { status: "error"; message: string };

interface MissingPersonSearchPanelProps {
  dataSource: MissingPersonSearchDataSource;
  compact: boolean;
}

interface ReportActionsProps {
  onReportMissingPerson: () => void;
  onReportUnverifiedBuilding: () => void;
  onRegisterCollectionCenter: () => void;
  onRegisterDonationPoint: () => void;
  onOfferCommunityMeals: () => void;
  onOfferTemporaryShelter: () => void;
  compact: boolean;
}

type ReportActionColumns = 1 | 2 | 3 | 6;

const reportActionIconColor = "#174d59";

const lastSeenFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export function MissingPersonSearchPanel({
  dataSource,
  compact,
}: MissingPersonSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const delay = globalThis.setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const response = await dataSource.search(trimmedQuery, controller.signal);
        setState({ status: "success", items: response.items, total: response.total });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "No fue posible realizar la búsqueda.",
        });
      }
    }, dataSource.transport === "api" ? 350 : 0);

    return () => {
      controller.abort();
      globalThis.clearTimeout(delay);
    };
  }, [dataSource, trimmedQuery]);

  return (
    <View testID="person-search-panel" style={styles.searchPanel}>
      <View style={[styles.searchHeading, compact && styles.searchHeadingCompact]}>
        <View style={styles.searchHeadingCopy}>
          <Text style={styles.overline}>SEARCH / PUBLIC CASES</Text>
          <Text style={styles.searchTitle} accessibilityRole="header">
            Buscar una persona
          </Text>
          <Text style={styles.searchDescription}>
            Busca por nombre, alias, código, edad, municipio, zona, vestimenta o rasgos físicos.
          </Text>
        </View>
        <View style={styles.publicBadge}>
          <View style={styles.publicDot} />
          <Text style={styles.publicText}>SOLO DATOS PÚBLICOS</Text>
        </View>
      </View>

      <View style={styles.inputShell}>
        <SearchIcon />
        <TextInput
          accessibilityLabel="Buscar persona desaparecida por cualquier dato público"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Ej. Valentina, Vale, Bogotá, chaqueta amarilla o DEMO-MP-1047"
          placeholderTextColor="#536078"
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
            onPress={() => setQuery("")}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        )}
      </View>

      <SearchFeedback state={state} query={trimmedQuery} />
    </View>
  );
}

export function ReportActions({
  compact,
  onReportMissingPerson,
  onReportUnverifiedBuilding,
  onRegisterCollectionCenter,
  onRegisterDonationPoint,
  onOfferCommunityMeals,
  onOfferTemporaryShelter,
}: ReportActionsProps) {
  const { width } = useWindowDimensions();
  const columns = getReportActionColumns(width);

  return (
    <View
      testID="report-actions"
      accessibilityLabel="Acciones de reporte y ayuda"
      style={styles.reportActions}
    >
      <ReportAction
        testID="report-missing-person-action"
        action={reportActionCatalog["missing-person"]}
        icon={<PersonAlertIcon />}
        compact={compact}
        columns={columns}
        onPress={onReportMissingPerson}
      />
      <ReportAction
        testID="report-unverified-building-action"
        action={reportActionCatalog["unverified-building"]}
        icon={<BuildingSearchIcon />}
        compact={compact}
        columns={columns}
        onPress={onReportUnverifiedBuilding}
      />
      <ReportAction
        testID="register-collection-center-action"
        action={reportActionCatalog["collection-center"]}
        icon={<CollectionCenterIcon />}
        compact={compact}
        columns={columns}
        onPress={onRegisterCollectionCenter}
      />
      <ReportAction
        testID="register-donation-point-action"
        action={reportActionCatalog["donation-point"]}
        icon={<DonationPointIcon />}
        compact={compact}
        columns={columns}
        onPress={onRegisterDonationPoint}
      />
      <ReportAction
        testID="offer-community-meals-action"
        action={reportActionCatalog["community-meals"]}
        icon={<CommunityMealIcon />}
        compact={compact}
        columns={columns}
        onPress={onOfferCommunityMeals}
      />
      <ReportAction
        testID="offer-temporary-shelter-action"
        action={reportActionCatalog["temporary-shelter"]}
        icon={<TemporaryShelterIcon />}
        compact={compact}
        columns={columns}
        onPress={onOfferTemporaryShelter}
      />
    </View>
  );
}

export function shouldStackReportActions(width: number): boolean {
  return getReportActionColumns(width) === 1;
}

export function getReportActionColumns(width: number): ReportActionColumns {
  // CHG-090 (QA): máximo 3 columnas — grid 3x2 en escritorio para dar
  // respiración y mayor área de clic; nunca 6 tarjetas comprimidas.
  if (width < 620) {
    return 1;
  }

  if (width < 1080) {
    return 2;
  }

  return 3;
}

function ReportAction({
  action,
  columns,
  compact,
  icon,
  onPress,
  testID,
}: {
  action: ReportActionCopy;
  columns: ReportActionColumns;
  compact: boolean;
  icon: ReactNode;
  onPress: () => void;
  testID: string;
}) {
  const dense = columns === 3 || columns === 6;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={action.title}
      accessibilityHint={action.hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reportAction,
        columns === 6 && styles.reportActionSixColumns,
        columns === 3 && styles.reportActionThreeColumns,
        columns === 2 && styles.reportActionTwoColumns,
        columns === 1 && styles.reportActionSingleColumn,
        pressed && styles.pressed,
      ]}
    >
      <View
        testID={`${testID}-surface`}
        style={[
          styles.reportActionSurface,
          dense && styles.reportActionDense,
          compact && styles.reportActionCompact,
        ]}
      >
        <View
          testID={`${testID}-rail`}
          pointerEvents="none"
          style={styles.reportActionRail}
        />
        <View
          style={[
            styles.reportActionIcon,
            dense && styles.reportActionIconDense,
            compact && styles.reportActionIconCompact,
          ]}
        >
          {icon}
        </View>
        <View style={[styles.reportActionCopy, dense && styles.reportActionCopyDense]}>
          {/* CHG-090 (QA): categoría e ícono grande con título claro. El
              propósito no se pinta aquí — espera en la leyenda del
              formulario, ya sin la prisa de la portada. */}
          <Text
            style={[
              styles.reportActionCode,
              dense && styles.reportActionCodeDense,
            ]}
          >
            {action.category}
          </Text>
          <Text
            style={[
              styles.reportActionTitle,
              dense && styles.reportActionTitleDense,
              compact && styles.reportActionTitleCompact,
            ]}
          >
            {action.title}
          </Text>
        </View>
        <View style={[styles.reportActionEnd, dense && styles.reportActionEndDense]}>
          <Text style={styles.reportActionArrow}>→</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SearchFeedback({ state, query }: { state: SearchState; query: string }) {
  if (state.status === "idle") {
    return (
      <Text style={styles.hint}>
        {query.length === 1
          ? "Escribe al menos 2 caracteres para buscar."
          : "Los datos privados del reportante nunca se incluyen en esta búsqueda."}
      </Text>
    );
  }

  if (state.status === "loading") {
    return (
      <View style={styles.feedbackRow} accessibilityLabel="Buscando personas">
        <ActivityIndicator color={colors.cyan} size="small" />
        <Text style={styles.hint}>Buscando coincidencias públicas…</Text>
      </View>
    );
  }

  if (state.status === "error") {
    return <Text style={styles.error} accessibilityRole="alert">{state.message}</Text>;
  }

  if (state.items.length === 0) {
    return (
      <View style={styles.empty} accessibilityRole="alert">
        <Text style={styles.emptyTitle}>Sin coincidencias públicas</Text>
        <Text style={styles.hint}>
          Verifica la escritura o intenta con otra zona, prenda o rasgo físico.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.results}>
      <Text style={styles.resultsCount}>
        {state.total} {state.total === 1 ? "COINCIDENCIA" : "COINCIDENCIAS"}
      </Text>
      {state.items.map((record) => <SearchResult key={record.id} record={record} />)}
    </View>
  );
}

function SearchResult({ record }: { record: MissingPersonPublicRecord }) {
  return (
    <View style={styles.result} testID={`missing-person-result-${record.id}`}>
      <View style={styles.avatar}><PersonIcon /></View>
      <View style={styles.resultMain}>
        <View style={styles.resultTopline}>
          <Text style={styles.caseCode}>{record.publicCaseCode}</Text>
          {record.dataClassification === "demonstrative" && (
            <Text style={styles.demoBadge}>DEMO</Text>
          )}
        </View>
        <Text style={styles.resultName}>{record.displayName}</Text>
        <Text style={styles.resultMeta}>
          {record.approximateAge === null ? "Edad sin confirmar" : `${record.approximateAge} años`}
          {record.aliases.length > 0 ? ` · Alias: ${record.aliases.join(", ")}` : ""}
        </Text>
        <Text style={styles.resultLocation}>
          {record.lastSeenArea} · {record.municipality}, {record.department}
        </Text>
        <Text style={styles.resultDetail}>Vestimenta: {record.clothingDescription ?? "Sin dato público"}</Text>
        <Text style={styles.resultDetail}>Rasgos: {record.physicalDescription ?? "Sin dato público"}</Text>
      </View>
      <Text style={styles.lastSeen}>
        VISTA POR ÚLTIMA VEZ{`\n`}{lastSeenFormatter.format(new Date(record.lastSeenAt))}
      </Text>
    </View>
  );
}

function PersonAlertIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 32 32">
      <Circle cx="13" cy="9" r="5" fill="none" stroke={reportActionIconColor} strokeWidth={2} />
      <Path d="M4 27c1.2-6.2 4.2-9.2 9-9.2s7.8 3 9 9.2M25 5v9M25 18v.2" fill="none" stroke={reportActionIconColor} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function BuildingSearchIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34">
      <Path d="M5 29V6h15v23M20 12h6v17M3 29h25" fill="none" stroke={reportActionIconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="9" y="10" width="3" height="3" rx="0.5" fill={reportActionIconColor} />
      <Rect x="15" y="10" width="3" height="3" rx="0.5" fill={reportActionIconColor} />
      <Rect x="9" y="17" width="3" height="3" rx="0.5" fill={reportActionIconColor} />
      <Rect x="15" y="17" width="3" height="3" rx="0.5" fill={reportActionIconColor} />
      <Circle cx="27" cy="7" r="4.5" fill="none" stroke={reportActionIconColor} strokeWidth={2} />
      <Path d="m30.3 10.3 3 3" fill="none" stroke={reportActionIconColor} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CollectionCenterIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36">
      <Path
        d="M3.5 14 18 6l14.5 8M5.5 13.5V31h25V13.5M10 31V18h16v13"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 23h16M18 18v13"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M18 2.8v6.4M14.8 6h6.4"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function DonationPointIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36">
      <Path
        d="M18 33s10-9.5 10-18A10 10 0 0 0 8 15c0 8.5 10 18 10 18Z"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="m12.5 15.5 5.5-3 5.5 3-5.5 3-5.5-3ZM12.5 15.5v5.8l5.5 3 5.5-3v-5.8M18 18.5v5.8"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CommunityMealIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36">
      <Path
        d="M7 19h22c0 6.1-4.9 11-11 11S7 25.1 7 19ZM5 19h26M13 14c-2.2-2-1.6-4.2.2-6M20 14c-2.2-2-1.6-4.2.2-6M27 14c-2.2-2-1.6-4.2.2-6"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 30h14"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TemporaryShelterIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36">
      <Path
        d="m4 17 14-11 14 11M7 15.5V31h22V15.5M11 26v-7h5.5c2 0 3.5 1.6 3.5 3.5V26M11 22.5h9M11 19v7M25 19v7M9 26h18"
        fill="none"
        stroke={reportActionIconColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke={colors.cyan} strokeWidth={1.6} />
      <Path d="m15.5 15.5 5 5" fill="none" stroke={colors.cyan} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function PersonIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Circle cx="14" cy="8" r="4" fill="none" stroke={colors.missing} strokeWidth={1.4} />
      <Path d="M6 25c.8-6 3.5-9 8-9s7.2 3 8 9" fill="none" stroke={colors.missing} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  searchPanel: { gap: 14, padding: 22, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.panel },
  searchHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  searchHeadingCompact: { flexDirection: "column" },
  searchHeadingCopy: { minWidth: 0, flex: 1 },
  overline: { marginBottom: 5, color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 1.2 },
  searchTitle: { color: colors.ink, fontSize: 26, fontWeight: "700", letterSpacing: -0.8 },
  searchDescription: { maxWidth: 760, marginTop: 5, color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  publicBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(67,231,173,0.25)", borderRadius: 6, backgroundColor: "rgba(67,231,173,0.06)" },
  publicDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.alive },
  publicText: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 0.8 },
  inputShell: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(81,229,255,0.28)", borderRadius: 10, backgroundColor: "rgba(5,9,17,0.82)" },
  input: { minWidth: 0, flex: 1, paddingVertical: 15, color: colors.ink, fontSize: 14 },
  clearButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(137,166,207,0.10)" },
  clearText: { color: colors.inkSoft, fontSize: 24, lineHeight: 25 },
  hint: { color: colors.inkDim, fontSize: font(11), lineHeight: 17 },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  error: { color: colors.reported, fontSize: 11, lineHeight: 18 },
  empty: { gap: 4, paddingVertical: 8 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  results: { gap: 8 },
  resultsCount: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 1 },
  result: { flexDirection: "row", alignItems: "flex-start", gap: 13, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.panelSoft },
  avatar: { width: 46, height: 46, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,207,102,0.24)", borderRadius: 23, backgroundColor: "rgba(255,207,102,0.06)" },
  resultMain: { minWidth: 0, flex: 1 },
  resultTopline: { flexDirection: "row", alignItems: "center", gap: 7 },
  caseCode: { color: colors.missing, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "800", letterSpacing: 0.7 },
  demoBadge: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11), borderWidth: 1, borderColor: colors.line, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  resultName: { marginTop: 4, color: colors.ink, fontSize: 17, fontWeight: "700" },
  resultMeta: { marginTop: 3, color: colors.inkSoft, fontSize: font(11) },
  resultLocation: { marginTop: 8, color: colors.cyan, fontSize: font(11), fontWeight: "600" },
  resultDetail: { marginTop: 3, color: colors.inkDim, fontSize: font(11), lineHeight: 16 },
  lastSeen: { maxWidth: 180, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11), lineHeight: 16, textAlign: "right" },
  reportActions: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 12,
  },
  reportAction: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    overflow: "hidden",
    borderRadius: 16,
  },
  reportActionSixColumns: { flexBasis: "15%" },
  reportActionThreeColumns: { flexBasis: "31%" },
  reportActionTwoColumns: { flexBasis: "48%" },
  reportActionSingleColumn: { width: "100%", flexBasis: "100%" },
  reportActionSurface: {
    minHeight: 180,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    overflow: "hidden",
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#f5f8f7",
    borderRadius: 16,
    backgroundColor: "#e3e9e8",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  reportActionRail: {
    position: "absolute",
    top: 18,
    bottom: 18,
    left: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: "#1b7787",
  },
  reportActionDense: {
    minHeight: 150,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  reportActionCompact: {
    minHeight: 160,
    gap: 14,
    paddingHorizontal: 17,
    paddingVertical: 20,
  },
  reportActionIcon: {
    width: 68,
    height: 68,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(23,77,89,0.24)",
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.48)",
  },
  reportActionIconDense: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  reportActionIconCompact: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  reportActionArrow: {
    color: "#174d59",
    fontSize: 30,
    fontWeight: "300",
  },
  reportActionCopy: {
    minWidth: 0,
    flex: 1,
  },
  reportActionCopyDense: {
    width: "100%",
    paddingRight: 10,
  },
  // CHG-090 (QA): la categoria vuelve a la tarjeta, ya en la escala
  // legible y con mas contraste sobre la superficie clara.
  reportActionCode: {
    color: "#2f4a52",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  reportActionCodeDense: {
    fontSize: font(11),
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  reportActionTitle: {
    marginTop: 5,
    color: "#10232f",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1.2,
    lineHeight: 34,
  },
  reportActionTitleCompact: {
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  reportActionTitleDense: {
    marginTop: 4,
    fontSize: 21,
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  reportActionEnd: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  reportActionEndDense: {
    position: "absolute",
    top: 12,
    right: 12,
    alignSelf: "auto",
  },
});
