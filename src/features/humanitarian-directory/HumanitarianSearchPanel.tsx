import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { LazyImage } from "../../components/LazyImage";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { font } from "../../typography";
import {
  CommunityContributionForm,
  type PickContributionPhotos,
} from "./CommunityContributionForm";
import { PersonNoveltyPanel } from "./PersonNoveltyPanel";
import type {
  AidLocationDirectoryCard,
  CommunityContributionDataSource,
  DirectoryFilter,
  FetchPersonNovelties,
  HumanitarianDirectoryDataSource,
  HumanitarianDirectoryItem,
  HumanitarianDirectoryKind,
  HumanitarianDirectorySearchResponse,
  MissingPersonDirectoryCard,
} from "./types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: HumanitarianDirectorySearchResponse }
  | { status: "error"; message: string };

const kindOptions: Array<{
  value: HumanitarianDirectoryKind;
  label: string;
  shortLabel: string;
}> = [
  { value: "missing_person", label: "Personas", shortLabel: "PERSONAS" },
  { value: "collection_center", label: "Centros de acopio", shortLabel: "ACOPIO" },
  { value: "collection_point", label: "Puntos de recolección", shortLabel: "RECOLECCIÓN" },
];

const filtersByKind: Record<
  HumanitarianDirectoryKind,
  Array<{ value: DirectoryFilter; label: string }>
> = {
  missing_person: [
    { value: "all", label: "Todas" },
    { value: "missing", label: "Desaparecidas" },
    { value: "found", label: "Encontradas" },
    { value: "deceased", label: "Fallecidas" },
  ],
  collection_center: [
    { value: "all", label: "Todos" },
    { value: "verified", label: "Verificados" },
    { value: "open", label: "Abiertos ahora" },
    { value: "rating_4", label: "4+ estrellas" },
  ],
  collection_point: [
    { value: "all", label: "Todos" },
    { value: "active", label: "Activos" },
    { value: "verified", label: "Verificados" },
    { value: "rating_4", label: "4+ estrellas" },
  ],
};

const kindLabels: Record<HumanitarianDirectoryKind, string> = {
  missing_person: "personas",
  collection_center: "centros de acopio",
  collection_point: "puntos de recolección",
};

const supplyLabels: Record<string, string> = {
  water: "Agua",
  food: "Alimentos",
  medicine: "Medicinas",
  clothing: "Ropa",
  tools: "Herramientas",
  shelter: "Refugio",
  other: "Otros",
};

const verificationLabels: Record<string, string> = {
  verified: "Verificado",
  under_review: "En revisión",
  unverified: "Sin verificar",
  rejected: "Rechazado",
};

const personStatusLabels: Record<string, string> = {
  missing: "Desaparecida",
  found: "Encontrada",
  deceased: "Fallecida",
};

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

export function HumanitarianSearchPanel({
  compact,
  contributionDataSource,
  dataSource,
  pickPhotos,
  fetchNovelties,
}: {
  compact: boolean;
  contributionDataSource: CommunityContributionDataSource;
  dataSource: HumanitarianDirectoryDataSource;
  pickPhotos?: PickContributionPhotos;
  // CHG-077: inyectable en pruebas; por defecto usa la API real.
  fetchNovelties?: FetchPersonNovelties;
}) {
  const [kind, setKind] = useState<HumanitarianDirectoryKind>("missing_person");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [query, setQuery] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [windowVisible, setWindowVisible] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  // CHG-061: total de coincidencias visible en el panel; los
  // resultados siguen abriéndose solo en la ventana independiente.
  const [matchTotal, setMatchTotal] = useState<number | null>(null);
  const [contributionTarget, setContributionTarget] =
    useState<HumanitarianDirectoryItem | null>(null);
  // CHG-077: persona cuyo detalle de novedades está abierto.
  const [detailTarget, setDetailTarget] =
    useState<MissingPersonDirectoryCard | null>(null);

  const activeFilter = filtersByKind[kind].find((option) => option.value === filter);

  const changeKind = (nextKind: HumanitarianDirectoryKind) => {
    setKind(nextKind);
    setFilter("all");
    setInlineError(null);
  };

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setMatchTotal(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      dataSource
        .search({ kind, query: trimmedQuery, filter })
        .then((response) => {
          if (!cancelled) setMatchTotal(response.total);
        })
        .catch(() => {
          if (!cancelled) setMatchTotal(null);
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dataSource, filter, kind, query]);

  const search = async () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setInlineError("Escribe al menos 2 caracteres para buscar.");
      return;
    }

    setInlineError(null);
    setContributionTarget(null);
    setDetailTarget(null);
    setWindowVisible(true);
    setSearchState({ status: "loading" });

    try {
      const response = await dataSource.search({ kind, query: trimmedQuery, filter });
      setSearchState({ status: "success", response });
    } catch (error: unknown) {
      setSearchState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible consultar el directorio.",
      });
    }
  };

  const closeWindow = () => {
    setWindowVisible(false);
    setContributionTarget(null);
    setDetailTarget(null);
  };

  return (
    <View testID="person-search-panel" style={styles.panel}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.overline}>DIRECTORIO / AYUDA HUMANITARIA</Text>
          <Text style={styles.title} accessibilityRole="header">
            Buscar y verificar
          </Text>
          <Text style={styles.description}>
            Personas y lugares de ayuda en un solo módulo público.
          </Text>
        </View>
        <View style={styles.publicBadge}>
          <View style={styles.publicDot} />
          <Text style={styles.publicText}>DATOS PÚBLICOS</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kindOptions}
        accessibilityLabel="Tipo de búsqueda humanitaria"
      >
        {kindOptions.map((option) => {
          const selected = option.value === kind;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={`Buscar ${option.label.toLocaleLowerCase("es-CO")}`}
              accessibilityState={{ selected }}
              onPress={() => changeKind(option.value)}
              style={[styles.kindOption, selected && styles.kindOptionSelected]}
            >
              <Text style={[styles.kindOptionText, selected && styles.kindOptionTextSelected]}>
                {compact ? option.shortLabel : option.label.toLocaleUpperCase("es-CO")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.searchRow, compact && styles.searchRowCompact]}>
        <View style={styles.inputShell}>
          <SearchIcon />
          <TextInput
            accessibilityLabel={
              kind === "missing_person"
                ? "Buscar persona desaparecida por cualquier dato público"
                : `Buscar ${kindLabels[kind]} por nombre o ubicación`
            }
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            placeholder={placeholderForKind(kind)}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Buscar ${kindLabels[kind]}`}
          onPress={() => void search()}
          style={styles.searchButton}
        >
          <Text style={styles.searchButtonText}>RESULTADOS</Text>
          <Text style={styles.searchButtonArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.filterLine}>
        <Text style={styles.filterLabel}>FILTROS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityLabel={`Filtros de ${kindLabels[kind]}`}
        >
          {filtersByKind[kind].map((option) => {
            const selected = filter === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por ${option.label}`}
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.value)}
                style={[styles.filter, selected && styles.filterSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Text
        style={[styles.hint, inlineError && styles.inlineError]}
        accessibilityRole={inlineError ? "alert" : undefined}
        testID="match-count-hint"
      >
        {inlineError ??
          (matchTotal !== null
            ? `${matchTotal} ${matchTotal === 1 ? "coincidencia" : "coincidencias"} — se abrirán en una ventana independiente.`
            : "Las coincidencias se abrirán en una ventana independiente.")}
      </Text>

      <Modal
        visible={windowVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeWindow}
      >
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalToolbar}>
            <View style={styles.modalToolbarCopy}>
              <Text style={styles.overline}>RESULTADOS / DIRECTORIO PÚBLICO</Text>
              <Text style={styles.modalTitle} accessibilityRole="header">
                {contributionTarget
                  ? "Aportar evidencia"
                  : detailTarget
                    ? "Novedades de la persona"
                    : `Coincidencias de ${kindLabels[kind]}`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar ventana de resultados"
              onPress={closeWindow}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>CERRAR ×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel="Ventana de resultados del directorio humanitario"
          >
            {contributionTarget ? (
              <CommunityContributionForm
                target={contributionTarget}
                dataSource={contributionDataSource}
                pickPhotos={pickPhotos}
                onBack={() => setContributionTarget(null)}
              />
            ) : detailTarget ? (
              <PersonNoveltyPanel
                person={detailTarget}
                onBack={() => setDetailTarget(null)}
                onContribute={() => setContributionTarget(detailTarget)}
                fetchNovelties={fetchNovelties}
              />
            ) : (
              <SearchResults
                state={searchState}
                kind={kind}
                query={query.trim()}
                filterLabel={activeFilter?.label ?? "Todos"}
                onContribute={setContributionTarget}
                onOpenDetail={setDetailTarget}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function SearchResults({
  filterLabel,
  kind,
  onContribute,
  onOpenDetail,
  query,
  state,
}: {
  filterLabel: string;
  kind: HumanitarianDirectoryKind;
  onContribute: (item: HumanitarianDirectoryItem) => void;
  onOpenDetail: (item: MissingPersonDirectoryCard) => void;
  query: string;
  state: SearchState;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <View style={styles.statePanel} accessibilityLabel="Buscando coincidencias">
        <ActivityIndicator size="large" color={colors.cyan} />
        <Text style={styles.stateTitle}>Buscando coincidencias públicas…</Text>
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={styles.statePanel} accessibilityRole="alert">
        <Text style={styles.errorTitle}>No pudimos consultar el directorio</Text>
        <Text style={styles.stateText}>{state.message}</Text>
      </View>
    );
  }

  const { response } = state;
  return (
    <View style={styles.results}>
      <View style={styles.resultsSummary}>
        <View style={styles.resultsSummaryCopy}>
          <Text style={styles.resultsCount}>
            {response.total} {response.total === 1 ? "COINCIDENCIA" : "COINCIDENCIAS"}
          </Text>
          <Text style={styles.resultsQuery}>“{query}” · {filterLabel}</Text>
        </View>
        <Text style={styles.resultsNotice}>
          Verifica fuente, vigencia y estado antes de actuar.
        </Text>
      </View>

      {response.items.length === 0 ? (
        <View style={styles.empty} accessibilityRole="alert">
          <Text style={styles.emptyTitle}>Sin coincidencias públicas</Text>
          <Text style={styles.stateText}>
            Prueba otra escritura, ubicación o filtro para {kindLabels[kind]}.
          </Text>
        </View>
      ) : (
        <View style={styles.cardGrid}>
          {response.items.map((item) =>
            item.kind === "missing_person" ? (
              <PersonCard
                key={item.id}
                item={item}
                onContribute={() => onContribute(item)}
                onOpenDetail={() => onOpenDetail(item)}
              />
            ) : (
              <AidLocationCard key={item.id} item={item} onContribute={() => onContribute(item)} />
            ),
          )}
        </View>
      )}
    </View>
  );
}

function PersonCard({
  item,
  onContribute,
  onOpenDetail,
}: {
  item: MissingPersonDirectoryCard;
  onContribute: () => void;
  onOpenDetail: () => void;
}) {
  return (
    <View testID={`directory-person-card-${item.id}`} style={styles.card}>
      <View style={styles.cardTop}>
        {/* CHG-090 (QA): la foto solo se descarga cuando la tarjeta se
            acerca a la pantalla; hasta entonces ocupa su lugar el mismo
            ícono de las personas sin fotografía. */}
        {item.publicPhotoUrl ? (
          <LazyImage
            containerStyle={styles.personAvatar}
            placeholder={<PersonIcon />}
            accessibilityLabel={`Fotografía pública autorizada de ${item.displayName}`}
            source={{ uri: item.publicPhotoUrl }}
            resizeMode="cover"
            style={styles.personPhoto}
          />
        ) : (
          <View style={styles.personAvatar}>
            <PersonIcon />
          </View>
        )}
        <View style={styles.cardTopCopy}>
          <View style={styles.cardMetaRow}>
            <Text style={styles.caseCode}>{item.publicCaseCode}</Text>
            <Text style={[styles.statusBadge, item.status === "missing" && styles.statusMissing]}>
              {personStatusLabels[item.status]}
            </Text>
            {item.dataClassification === "demonstrative" && <Text style={styles.demoBadge}>DEMO</Text>}
          </View>
          <Text style={styles.cardTitle}>{item.displayName}</Text>
          <Text style={styles.cardSubtitle}>
            {item.approximateAge === null ? "Edad sin confirmar" : `${item.approximateAge} años`}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardLabel}>ÚLTIMA ZONA PÚBLICA</Text>
        <Text style={styles.cardValue}>{item.lastSeenArea}</Text>
        <Text style={styles.cardDetail}>{item.municipality}, {item.department}</Text>
        <Text style={styles.cardUpdated}>
          FUENTE · {item.source.name} · VIGENCIA · {dateFormatter.format(new Date(item.updatedAt))}
        </Text>
      </View>
      {/* CHG-077: al abrir la tarjeta se ven las novedades que otras
          personas reportaron (qué dicen quienes la encontraron). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver novedades de ${item.displayName}`}
        onPress={onOpenDetail}
        style={[styles.cardAction, styles.cardActionSecondary]}
      >
        <Text style={styles.cardActionText}>VER NOVEDADES E INFORMACIÓN</Text>
        <Text style={styles.cardActionArrow}>→</Text>
      </Pressable>
      {item.status === "missing" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reportar novedad sobre ${item.displayName}`}
          onPress={onContribute}
          style={styles.cardAction}
        >
          <Text style={styles.cardActionText}>REPORTAR ENCONTRADA O FALLECIDA</Text>
          <Text style={styles.cardActionArrow}>→</Text>
        </Pressable>
      )}
    </View>
  );
}

function AidLocationCard({ item, onContribute }: { item: AidLocationDirectoryCard; onContribute: () => void }) {
  const availability =
    item.openNow === true
      ? "Abierto ahora"
      : item.availabilityStatus === "active"
        ? "Activo · horario no confirmado"
        : item.availabilityStatus === "inactive"
          ? "Inactivo"
          : "Disponibilidad sin confirmar";

  return (
    <View testID={`directory-aid-card-${item.id}`} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.aidAvatar}><AidIcon point={item.kind === "collection_point"} /></View>
        <View style={styles.cardTopCopy}>
          <View style={styles.cardMetaRow}>
            <Text style={styles.kindBadge}>
              {item.kind === "collection_center" ? "CENTRO DE ACOPIO" : "PUNTO DE RECOLECCIÓN"}
            </Text>
            {item.dataClassification === "demonstrative" && <Text style={styles.demoBadge}>DEMO</Text>}
          </View>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.locationLabel}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.aidStatusLine}>
          <Text style={styles.verificationText}>{verificationLabels[item.verificationStatus]}</Text>
          <Text style={styles.availabilityText}>{availability}</Text>
        </View>
        <Text style={styles.cardDetail}>{item.municipality}, {item.department}</Text>
        <View style={styles.supplyTags}>
          {item.acceptedSupplies.map((supply) => (
            <Text key={supply} style={styles.supplyTag}>{supplyLabels[supply] ?? supply}</Text>
          ))}
        </View>
        <StarDisplay rating={item.averageRating} count={item.ratingsCount} />
        <Text style={styles.cardUpdated}>
          FUENTE · {item.source.name} · {dateFormatter.format(new Date(item.updatedAt))}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Puntuar veracidad de ${item.name}`}
        onPress={onContribute}
        style={styles.cardAction}
      >
        <Text style={styles.cardActionText}>PUNTUAR VERACIDAD DEL LUGAR</Text>
        <Text style={styles.cardActionArrow}>→</Text>
      </Pressable>
    </View>
  );
}

function StarDisplay({ rating, count }: { rating: number | null; count: number }) {
  const rounded = rating === null ? 0 : Math.round(rating);
  return (
    <View style={styles.ratingRow} accessibilityLabel={rating === null ? "Sin valoraciones aceptadas" : `${rating.toFixed(1)} de 5 estrellas, ${count} valoraciones aceptadas`}>
      <Text style={styles.ratingStars}>
        {[1, 2, 3, 4, 5].map((star) => (star <= rounded ? "★" : "☆")).join("")}
      </Text>
      <Text style={styles.ratingText}>
        {rating === null ? "Sin valoraciones" : `${rating.toFixed(1)} · ${count}`}
      </Text>
    </View>
  );
}

function placeholderForKind(kind: HumanitarianDirectoryKind): string {
  if (kind === "missing_person") return "Nombre, código, municipio o última zona";
  if (kind === "collection_center") return "Nombre, municipio o insumo recibido";
  return "Nombre, barrio, municipio o ayuda aceptada";
}

function SearchIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
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

function AidIcon({ point }: { point: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      {point ? (
        <>
          <Path d="M14 26s7-7 7-14A7 7 0 0 0 7 12c0 7 7 14 7 14Z" fill="none" stroke={colors.cyan} strokeWidth={1.5} />
          <Circle cx="14" cy="12" r="2.5" fill="none" stroke={colors.cyan} strokeWidth={1.5} />
        </>
      ) : (
        <Path d="m3 11 11-6 11 6M5 10v14h18V10M9 24V14h10v10M14 2v6M11 5h6" fill="none" stroke={colors.cyan} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14, padding: 22, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.panel },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  headingCopy: { minWidth: 0, flex: 1 },
  overline: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.1 },
  title: { marginTop: 4, color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9 },
  description: { marginTop: 4, color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  publicBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(67,231,173,0.25)", borderRadius: 7 },
  publicDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.alive },
  publicText: { color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  kindOptions: { gap: 7 },
  kindOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.018)" },
  kindOptionSelected: { borderColor: colors.cyan, backgroundColor: "rgba(81,229,255,0.10)" },
  kindOptionText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  kindOptionTextSelected: { color: colors.cyan },
  searchRow: { flexDirection: "row", gap: 10 },
  searchRowCompact: { flexDirection: "column" },
  inputShell: { minHeight: 58, flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(81,229,255,0.28)", borderRadius: 10, backgroundColor: "rgba(5,9,17,0.82)" },
  input: { minWidth: 0, flex: 1, paddingVertical: 14, color: colors.ink, fontSize: 14, lineHeight: 20 },
  clearButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "rgba(137,166,207,0.10)" },
  clearText: { color: colors.inkSoft, fontSize: 24, lineHeight: 25 },
  searchButton: { minHeight: 58, minWidth: 118, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.cyan },
  searchButtonText: { color: "#07101b", fontFamily: fontFamilies.mono, fontSize: 15, fontWeight: "900", letterSpacing: 0.9 },
  searchButtonArrow: { color: "#07101b", fontSize: 22 },
  filterLine: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10 },
  // CHG-090 (QA): tipografía por la escala legible, no en píxeles sueltos.
  filterLabel: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(8), fontWeight: "800", letterSpacing: 0.8 },
  filters: { gap: 7 },
  // CHG-090 (QA): área táctil mínima de 44dp en los filtros.
  filter: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 999 },
  filterSelected: { borderColor: "rgba(81,229,255,0.5)", backgroundColor: "rgba(81,229,255,0.07)" },
  filterText: { color: colors.inkDim, fontSize: font(12), fontWeight: "700" },
  filterTextSelected: { color: colors.cyan },
  hint: { color: colors.inkDim, fontSize: 10, lineHeight: 16 },
  inlineError: { color: colors.reported },
  modalRoot: { flex: 1, backgroundColor: colors.canvas },
  modalToolbar: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "rgba(7,12,21,0.98)" },
  modalToolbarCopy: { minWidth: 0, flex: 1 },
  modalTitle: { marginTop: 4, color: colors.ink, fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  closeButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7 },
  closeButtonText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "900" },
  modalScroll: { flex: 1 },
  modalContent: { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", flexGrow: 1, padding: 24 },
  statePanel: { minHeight: 420, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  stateTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  stateText: { maxWidth: 540, color: colors.inkSoft, fontSize: 12, lineHeight: 19, textAlign: "center" },
  errorTitle: { color: colors.reported, fontSize: 20, fontWeight: "800" },
  results: { gap: 18 },
  resultsSummary: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  resultsSummaryCopy: { gap: 4 },
  resultsCount: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  resultsQuery: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  resultsNotice: { maxWidth: 380, color: colors.inkDim, fontSize: 9, lineHeight: 15 },
  empty: { minHeight: 320, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 14 },
  card: { minWidth: 300, flexGrow: 1, flexBasis: "47%", overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel },
  cardTop: { flexDirection: "row", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  personAvatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,207,102,0.26)", borderRadius: 24, backgroundColor: "rgba(255,207,102,0.06)" },
  personPhoto: { width: "100%", height: "100%", borderRadius: 24 },
  aidAvatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(81,229,255,0.26)", borderRadius: 10, backgroundColor: "rgba(81,229,255,0.05)" },
  cardTopCopy: { minWidth: 0, flex: 1 },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  caseCode: { color: colors.missing, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900" },
  kindBadge: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900" },
  statusBadge: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 4 },
  statusMissing: { color: colors.missing, borderColor: "rgba(255,207,102,0.3)" },
  demoBadge: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 6, fontWeight: "800", paddingHorizontal: 5, paddingVertical: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 4 },
  cardTitle: { marginTop: 5, color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  cardSubtitle: { marginTop: 3, color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  cardBody: { flex: 1, gap: 7, padding: 16 },
  cardLabel: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 6, fontWeight: "800", letterSpacing: 0.8 },
  cardValue: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  cardDetail: { color: colors.inkSoft, fontSize: 10, lineHeight: 16 },
  cardUpdated: { marginTop: 4, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 6, lineHeight: 11 },
  aidStatusLine: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  verificationText: { color: colors.alive, fontSize: 9, fontWeight: "800" },
  availabilityText: { color: colors.inkSoft, fontSize: 9 },
  supplyTags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  supplyTag: { color: colors.inkSoft, fontSize: 8, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 999 },
  ratingRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  ratingStars: { color: colors.missing, fontSize: 18, letterSpacing: 1 },
  ratingText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" },
  cardAction: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: "rgba(81,229,255,0.035)" },
  cardActionSecondary: { backgroundColor: "transparent" },
  cardActionText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  cardActionArrow: { color: colors.cyan, fontSize: 16 },
});
