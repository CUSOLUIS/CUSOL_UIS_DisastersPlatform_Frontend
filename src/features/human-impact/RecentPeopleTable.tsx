import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import type {
  HumanStatus,
  PeoplePageSize,
  PeopleRecordsDataSource,
  PersonRecord,
} from "./types";
import { peoplePageSizes } from "./types";
import { usePeopleRecordsPage } from "./usePeopleRecordsPage";

interface RecentPeopleTableProps {
  dataSource: PeopleRecordsDataSource;
  viewportMinHeight?: number;
}

const statusLabels: Record<HumanStatus, string> = {
  missing: "Desaparecido",
  reported_deceased: "Muerte reportada",
  confirmed_alive: "Confirmado vivo",
  confirmed_deceased: "Muerte confirmada",
};

const sourceLabels = {
  official: "Oficial",
  citizen: "Ciudadana",
  sensor: "Sensor",
  integration: "Integración",
  ai_inference: "Inferencia IA",
} as const;

const statusColors: Record<HumanStatus, string> = {
  missing: colors.missing,
  reported_deceased: colors.reported,
  confirmed_alive: colors.alive,
  confirmed_deceased: colors.deceased,
};

const filters: Array<{ value: HumanStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "missing", label: "Desaparecidos" },
  { value: "reported_deceased", label: "Muertos reportados" },
  { value: "confirmed_alive", label: "Confirmados vivos" },
  { value: "confirmed_deceased", label: "Muertos confirmados" },
];

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
const numberFormatter = new Intl.NumberFormat("es-CO");
const expandedPageSizes = peoplePageSizes.filter((size) => size !== 5);

export function RecentPeopleTable({
  dataSource,
  viewportMinHeight,
}: RecentPeopleTableProps) {
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const [query, setQuery] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [status, setStatus] = useState<HumanStatus | "all">("all");
  const [pageSize, setPageSize] = useState<PeoplePageSize>(5);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const viewportSized = !compact && !expanded && viewportMinHeight !== undefined;

  useEffect(() => {
    if (dataSource.transport !== "api") return undefined;

    const normalizedQuery = query.trim();
    const timer = globalThis.setTimeout(() => {
      setServerQuery(normalizedQuery.length >= 2 ? normalizedQuery : "");
      setPage(1);
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [dataSource.transport, query]);

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    if (dataSource.transport === "fixture") {
      const normalizedQuery = nextQuery.trim();
      setServerQuery(normalizedQuery.length >= 2 ? normalizedQuery : "");
      setPage(1);
    }
  };

  const pageQuery = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      statuses: status === "all" ? [] : [status],
      q: serverQuery || undefined,
    }),
    [page, pageSize, serverQuery, status],
  );
  const { loadState, retry } = usePeopleRecordsPage({
    dataSource,
    query: pageQuery,
  });
  const data = loadState.status === "success" ? loadState.data : null;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const visiblePeople = data?.items.slice(0, pageSize) ?? [];
  const firstVisible = data && data.total > 0 ? data.offset + 1 : 0;
  const lastVisible = data ? data.offset + visiblePeople.length : 0;

  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const selectStatus = (nextStatus: HumanStatus | "all") => {
    setStatus(nextStatus);
    setPage(1);
  };

  const selectPageSize = (nextSize: PeoplePageSize) => {
    setPageSize(nextSize);
    setPage(1);
    if (nextSize !== 5) setExpanded(true);
  };

  const closeExpanded = () => {
    setExpanded(false);
    setPageSize(5);
    setPage(1);
  };

  const selectablePageSizes = expanded ? expandedPageSizes : peoplePageSizes;
  const panel = (
    <View
      style={[
        styles.section,
        viewportSized && styles.sectionViewport,
        !expanded && viewportMinHeight !== undefined && { minHeight: viewportMinHeight },
        expanded && styles.sectionExpanded,
      ]}
      accessibilityLabel={
        expanded
          ? "Listado ampliado de personas publicables"
          : "Listado paginado de personas publicables"
      }
    >
      <Text style={styles.panelCode}>
        {expanded ? "EXPANDED VIEW / PUBLIC RECORDS" : "DATA STREAM / PUBLIC RECORDS"}
      </Text>
      <View
        style={[
          styles.heading,
          viewportSized && styles.headingViewport,
          compact && styles.headingCompact,
        ]}
      >
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>REGISTROS PUBLICABLES</Text>
          <Text
            style={[styles.title, viewportSized && styles.titleViewport]}
            accessibilityRole="header"
          >
            Personas agregadas
          </Text>
          <Text style={[styles.description, viewportSized && styles.descriptionViewport]}>
            Consulta paginada de todas las personas publicables, ordenadas por incorporación.
          </Text>
        </View>

        <TextInput
          accessibilityLabel="Buscar en todas las personas publicables"
          value={query}
          onChangeText={updateQuery}
          maxLength={100}
          placeholder="Buscar persona o lugar"
          placeholderTextColor={colors.inkDim}
          style={[
            styles.search,
            viewportSized && styles.searchViewport,
            compact && styles.searchCompact,
          ]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // El ScrollView trae flexGrow: 1 por defecto; sin esto absorbe
        // el alto sobrante de la sección y estira los chips (CHG-045).
        style={styles.filtersScroll}
        contentContainerStyle={[
          styles.filters,
          viewportSized && styles.filtersViewport,
        ]}
        accessibilityLabel="Filtros por estado"
      >
        {filters.map((filter) => {
          const active = filter.value === status;
          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por ${filter.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => selectStatus(filter.value)}
              style={({ pressed }) => [
                styles.filter,
                viewportSized && styles.filterViewport,
                active && styles.filterActive,
                pressed && styles.filterPressed,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  viewportSized && styles.filterTextViewport,
                  active && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {query.trim().length === 1 && (
        <Text style={styles.queryHint}>Escribe al menos 2 caracteres para buscar.</Text>
      )}

      <View style={[styles.resultLine, viewportSized && styles.resultLineViewport]}>
        <Text
          style={[styles.resultCount, viewportSized && styles.resultCountViewport]}
          accessibilityLiveRegion="polite"
        >
          {data
            ? `MOSTRANDO ${numberFormatter.format(firstVisible)}–${numberFormatter.format(lastVisible)} DE ${numberFormatter.format(data.total)} REGISTROS PUBLICABLES`
            : "CONSULTANDO REGISTROS PUBLICABLES"}
        </Text>
        {loadState.status === "success" && (
          <Text style={styles.syncState}>
            {loadState.stale
              ? "DESACTUALIZADO"
              : loadState.refreshing
                ? "ACTUALIZANDO"
                : "SINCRONIZADO"}
          </Text>
        )}
      </View>

      <View testID="recent-records" style={styles.records}>
        {!compact && loadState.status === "success" && (
          <View
            style={[
              styles.row,
              viewportSized && styles.rowViewport,
              styles.headerRow,
              viewportSized && styles.headerRowViewport,
            ]}
            accessibilityRole="header"
          >
            <Text style={[styles.headerCell, styles.personColumn]}>PERSONA</Text>
            <Text style={[styles.headerCell, styles.statusColumn]}>ESTADO</Text>
            <Text style={[styles.headerCell, styles.locationColumn]}>UBICACIÓN</Text>
            <Text style={[styles.headerCell, styles.eventColumn]}>EVENTO</Text>
            <Text style={[styles.headerCell, styles.sourceColumn]}>FUENTE</Text>
            <Text style={[styles.headerCell, styles.dateColumn]}>AGREGADO</Text>
          </View>
        )}

        {loadState.status === "loading" && (
          <View style={styles.loading} accessibilityLabel="Cargando personas publicables">
            <ActivityIndicator color={colors.cyan} />
            <Text style={styles.loadingText}>Consultando la página…</Text>
          </View>
        )}

        {loadState.status === "error" && (
          <View style={styles.error} accessibilityRole="alert">
            <Text style={styles.errorTitle}>No pudimos cargar las personas</Text>
            <Text style={styles.errorText}>{loadState.message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reintentar listado de personas"
              onPress={retry}
              style={styles.retry}
            >
              <Text style={styles.retryText}>REINTENTAR</Text>
            </Pressable>
          </View>
        )}

        {loadState.status === "success" && visiblePeople.map((person) =>
          compact ? (
            <PersonCard key={person.id} person={person} />
          ) : (
            <PersonRow key={person.id} person={person} roomy={viewportSized} />
          ),
        )}

        {loadState.status === "success" && visiblePeople.length === 0 && (
          <>
            {/* CHG-045: filas de espera para que la tabla recién
                estrenada no se vea vacía; son decorativas y el aviso
                accesible sigue siendo el texto de abajo. */}
            {!compact &&
              Array.from({ length: 5 }, (_, index) => (
                <View
                  key={`placeholder-${index}`}
                  testID={`recent-record-placeholder-${index + 1}`}
                  style={[styles.row, viewportSized && styles.rowViewport]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View style={styles.personColumn}>
                    <View style={[styles.placeholderBar, styles.placeholderBarWide]} />
                    <View style={[styles.placeholderBar, styles.placeholderBarNarrow]} />
                  </View>
                  <View style={styles.statusColumn}>
                    <View style={[styles.placeholderBar, styles.placeholderBarNarrow]} />
                  </View>
                  <View style={styles.locationColumn}>
                    <View style={styles.placeholderBar} />
                  </View>
                  <View style={styles.eventColumn}>
                    <View style={styles.placeholderBar} />
                  </View>
                  <View style={styles.sourceColumn}>
                    <View style={[styles.placeholderBar, styles.placeholderBarWide]} />
                  </View>
                  <View style={styles.dateColumn}>
                    <View style={[styles.placeholderBar, styles.placeholderBarNarrow]} />
                  </View>
                </View>
              ))}
            <Text style={styles.empty} accessibilityRole="alert">
              No hay personas publicables que coincidan con la consulta.
            </Text>
          </>
        )}
      </View>

      {loadState.status === "success" && (
        <>
          {loadState.stale && (
            <Text style={styles.staleNotice} accessibilityRole="alert">
              No fue posible actualizar esta página. Se conserva el último resultado válido.
              {loadState.warning ? ` ${loadState.warning}` : ""}
            </Text>
          )}
          <View
            style={[
              styles.pagination,
              viewportSized && styles.paginationViewport,
              compact && styles.paginationCompact,
            ]}
          >
            <View style={styles.pageSizes} accessibilityLabel="Filas por página">
              <Text style={styles.paginationLabel}>MOSTRAR</Text>
              {selectablePageSizes.map((size) => {
                const active = pageSize === size;
                const opensExpandedView = !expanded && size !== 5;
                return (
                  <Pressable
                    key={size}
                    accessibilityRole="button"
                    accessibilityLabel={
                      opensExpandedView
                        ? `Abrir ventana con ${size} filas por página`
                        : `Mostrar ${size} filas por página`
                    }
                    accessibilityState={{ selected: active }}
                    onPress={() => selectPageSize(size)}
                    style={[
                      styles.pageSize,
                      viewportSized && styles.pageSizeViewport,
                      active && styles.pageSizeActive,
                    ]}
                  >
                    <Text style={[styles.pageSizeText, active && styles.pageSizeTextActive]}>
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={styles.paginationLabel}>POR PÁGINA</Text>
            </View>

            <View style={styles.pageNavigation}>
              <PageButton
                disabled={page <= 1}
                label="Página anterior"
                roomy={viewportSized}
                text="← ANTERIOR"
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Text style={styles.pageIndicator} accessibilityLiveRegion="polite">
                PÁGINA {numberFormatter.format(page)} DE {numberFormatter.format(totalPages)}
              </Text>
              <PageButton
                disabled={page >= totalPages}
                label="Página siguiente"
                roomy={viewportSized}
                text="SIGUIENTE →"
                onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );

  if (!expanded) return panel;

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeExpanded}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible
    >
      <View
        style={styles.modalRoot}
        accessibilityViewIsModal
        accessibilityLabel="Ventana ampliada de personas publicables"
      >
        <View style={[styles.modalToolbar, compact && styles.modalToolbarCompact]}>
          <View style={styles.modalHeading}>
            <Text style={styles.modalEyebrow}>CONSULTA AMPLIADA</Text>
            <Text style={styles.modalTitle} accessibilityRole="header">
              Todos los registros publicables
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar ventana de personas"
            onPress={closeExpanded}
            style={({ pressed }) => [
              styles.modalClose,
              pressed && styles.modalClosePressed,
            ]}
          >
            <Text style={styles.modalCloseText}>CERRAR ×</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={[styles.modalContent, compact && styles.modalContentCompact]}
          showsVerticalScrollIndicator
        >
          {panel}
        </ScrollView>
      </View>
    </Modal>
  );
}

function PageButton({
  disabled,
  label,
  onPress,
  roomy = false,
  text,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  roomy?: boolean;
  text: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.pageButton,
        roomy && styles.pageButtonViewport,
        disabled && styles.pageButtonDisabled,
      ]}
    >
      <Text style={[styles.pageButtonText, disabled && styles.pageButtonTextDisabled]}>
        {text}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: HumanStatus }) {
  return (
    <View style={styles.statusBadge}>
      <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
      <Text style={styles.statusText}>{statusLabels[status]}</Text>
    </View>
  );
}

function PersonRow({ person, roomy }: { person: PersonRecord; roomy: boolean }) {
  return (
    <View
      testID={`recent-record-${person.id}`}
      style={[styles.row, roomy && styles.rowViewport]}
      accessibilityLabel={`${person.displayName}, ${statusLabels[person.status]}, ${person.location}`}
    >
      <View style={styles.personColumn}>
        <Text style={[styles.primaryText, roomy && styles.primaryTextViewport]}>
          {person.displayName}
        </Text>
        <Text style={[styles.secondaryText, roomy && styles.secondaryTextViewport]}>
          ID {person.id.slice(0, 8).toUpperCase()}
        </Text>
      </View>
      <View style={styles.statusColumn}><StatusBadge status={person.status} /></View>
      <Text
        style={[styles.bodyText, roomy && styles.bodyTextViewport, styles.locationColumn]}
      >
        {person.location}
      </Text>
      <Text style={[styles.bodyText, roomy && styles.bodyTextViewport, styles.eventColumn]}>
        {person.relatedEvent}
      </Text>
      <View style={styles.sourceColumn}>
        <Text style={[styles.primaryText, roomy && styles.primaryTextViewport]}>
          {person.source.name}
        </Text>
        <Text style={[styles.secondaryText, roomy && styles.secondaryTextViewport]}>
          {sourceLabels[person.source.sourceType]}
        </Text>
      </View>
      <Text style={[styles.bodyText, roomy && styles.bodyTextViewport, styles.dateColumn]}>
        {dateFormatter.format(new Date(person.createdAt))}
      </Text>
    </View>
  );
}

function PersonCard({ person }: { person: PersonRecord }) {
  return (
    <View
      testID={`recent-record-${person.id}`}
      style={styles.card}
      accessibilityLabel={`${person.displayName}, ${statusLabels[person.status]}, ${person.location}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIdentity}>
          <Text style={styles.primaryText}>{person.displayName}</Text>
          <Text style={styles.secondaryText}>ID {person.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <StatusBadge status={person.status} />
      </View>
      <View style={styles.cardGrid}>
        <CardField label="UBICACIÓN" value={person.location} />
        <CardField label="AGREGADO" value={dateFormatter.format(new Date(person.createdAt))} />
        <CardField label="EVENTO" value={person.relatedEvent} wide />
        <CardField
          label="FUENTE"
          value={`${person.source.name} · ${sourceLabels[person.source.sourceType]}`}
          wide
        />
      </View>
    </View>
  );
}

function CardField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.cardField, wide && styles.cardFieldWide]}>
      <Text style={styles.cardFieldLabel}>{label}</Text>
      <Text style={styles.cardFieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  modalToolbar: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(8, 14, 25, 0.98)",
  },
  modalToolbarCompact: {
    minHeight: 70,
    paddingHorizontal: 18,
  },
  modalHeading: {
    flex: 1,
  },
  modalEyebrow: {
    marginBottom: 4,
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  modalClose: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
    backgroundColor: "rgba(81, 229, 255, 0.05)",
  },
  modalClosePressed: {
    opacity: 0.72,
  },
  modalCloseText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    width: "100%",
    maxWidth: 1500,
    alignSelf: "center",
    padding: 28,
  },
  modalContentCompact: {
    padding: 12,
  },
  section: {
    position: "relative",
    overflow: "hidden",
    padding: 30,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  sectionExpanded: {
    borderColor: colors.lineStrong,
  },
  sectionViewport: {
    justifyContent: "space-between",
    paddingHorizontal: 38,
    paddingVertical: 36,
  },
  panelCode: {
    position: "absolute",
    top: 18,
    right: 22,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 28,
    paddingTop: 6,
  },
  headingCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  headingViewport: {
    gap: 36,
    paddingTop: 10,
  },
  headingCopy: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: 10,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: {
    marginBottom: 9,
    color: colors.ink,
    fontSize: 38,
    fontWeight: "500",
    letterSpacing: -1.8,
  },
  titleViewport: {
    fontSize: 44,
    letterSpacing: -2.2,
  },
  description: {
    maxWidth: 500,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  descriptionViewport: {
    maxWidth: 570,
    fontSize: 14,
    lineHeight: 23,
  },
  search: {
    width: 310,
    height: 46,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5, 10, 19, 0.76)",
    fontSize: 13,
  },
  searchCompact: {
    width: "100%",
  },
  searchViewport: {
    width: 360,
    height: 52,
    paddingHorizontal: 17,
    fontSize: 14,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filters: {
    alignItems: "center",
    gap: 8,
    paddingTop: 22,
    paddingBottom: 4,
  },
  filtersViewport: {
    gap: 10,
    paddingTop: 26,
    paddingBottom: 6,
  },
  filter: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.018)",
  },
  filterViewport: {
    minHeight: 42,
    paddingHorizontal: 17,
  },
  filterActive: {
    borderColor: "rgba(81, 229, 255, 0.46)",
    backgroundColor: "rgba(81, 229, 255, 0.10)",
  },
  filterPressed: {
    opacity: 0.7,
  },
  filterText: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  filterTextViewport: {
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.cyan,
  },
  queryHint: {
    marginTop: 10,
    color: colors.missing,
    fontSize: 10,
  },
  resultLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 20,
    marginBottom: 9,
  },
  resultLineViewport: {
    marginTop: 24,
    marginBottom: 12,
  },
  resultCount: {
    flex: 1,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  resultCountViewport: {
    fontSize: 10,
  },
  syncState: {
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  records: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.inkSoft,
    fontSize: 11,
  },
  error: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  errorTitle: {
    color: colors.reported,
    fontSize: 14,
    fontWeight: "800",
  },
  errorText: {
    maxWidth: 520,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  retry: {
    marginTop: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 6,
  },
  retryText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
  },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(127, 153, 188, 0.10)",
  },
  rowViewport: {
    minHeight: 84,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  headerRow: {
    minHeight: 46,
  },
  headerRowViewport: {
    minHeight: 50,
  },
  headerCell: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  personColumn: { flex: 1.25, minWidth: 130 },
  statusColumn: { flex: 1.15, minWidth: 138 },
  locationColumn: { flex: 1.15, minWidth: 125 },
  eventColumn: { flex: 1.45, minWidth: 150 },
  sourceColumn: { flex: 1.2, minWidth: 130 },
  dateColumn: { width: 94 },
  primaryText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryTextViewport: {
    fontSize: 13,
  },
  secondaryText: {
    marginTop: 4,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
  },
  secondaryTextViewport: {
    fontSize: 9,
  },
  bodyText: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 17,
  },
  bodyTextViewport: {
    fontSize: 12,
    lineHeight: 19,
  },
  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.025)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: "#c2ccda",
    fontSize: 10,
    fontWeight: "700",
  },
  card: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.018)",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(127, 153, 188, 0.10)",
  },
  cardIdentity: {
    flex: 1,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 14,
  },
  cardField: {
    width: "47%",
  },
  cardFieldWide: {
    width: "100%",
  },
  cardFieldLabel: {
    marginBottom: 4,
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  cardFieldValue: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 17,
  },
  empty: {
    paddingVertical: 40,
    color: colors.inkSoft,
    textAlign: "center",
  },
  // CHG-045: barras tenues del estado de espera de la tabla vacía.
  placeholderBar: {
    height: 8,
    maxWidth: 150,
    alignSelf: "stretch",
    marginVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  placeholderBarWide: {
    maxWidth: 190,
  },
  placeholderBarNarrow: {
    maxWidth: 90,
  },
  staleNotice: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 207, 102, 0.28)",
    borderRadius: 7,
    color: colors.inkSoft,
    backgroundColor: "rgba(255, 207, 102, 0.06)",
    fontSize: 10,
    lineHeight: 16,
  },
  pagination: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 18,
  },
  paginationViewport: {
    paddingTop: 22,
  },
  paginationCompact: {
    alignItems: "stretch",
  },
  pageSizes: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  paginationLabel: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  pageSize: {
    minWidth: 38,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.018)",
  },
  pageSizeViewport: {
    minWidth: 42,
    minHeight: 38,
  },
  pageSizeActive: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81, 229, 255, 0.10)",
  },
  pageSizeText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    fontWeight: "800",
  },
  pageSizeTextActive: {
    color: colors.cyan,
  },
  pageNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 9,
  },
  pageIndicator: {
    minWidth: 112,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
  },
  pageButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 6,
    backgroundColor: "rgba(81, 229, 255, 0.06)",
  },
  pageButtonViewport: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  pageButtonDisabled: {
    borderColor: colors.line,
    backgroundColor: "transparent",
  },
  pageButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    fontWeight: "800",
  },
  pageButtonTextDisabled: {
    color: colors.inkDim,
  },
});
