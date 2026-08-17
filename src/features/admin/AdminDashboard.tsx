import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { AdminApiError, adminDataSource } from "./dataSource";
import { HelpRequestsAdminSection } from "./HelpRequestsAdminSection";
import { SystemMetricsSection } from "./SystemMetricsSection";
import type {
  AdminAccountDetail,
  AdminVisitorPresencePage,
  AdminAccountPage,
  AdminAccountStatus,
  AdminAction,
  AdminAuditPage,
  AdminDataSource,
  AdminModerationStatus,
  AdminOverview,
  AdminSection,
  AdminSubmissionDetail,
  AdminSubmissionKind,
  AdminSubmissionPage,
} from "./types";
import type { AccountRole, AuthenticatedAccount } from "../auth/types";

type AuthState =
  | { status: "checking" }
  | { status: "ready"; account: AuthenticatedAccount }
  | { status: "denied"; message: string }
  | { status: "error"; message: string };

const SECTION_OPTIONS: Array<{
  value: AdminSection;
  label: string;
  code: string;
}> = [
  { value: "overview", label: "Resumen", code: "01" },
  { value: "submissions", label: "Ingresos", code: "02" },
  { value: "accounts", label: "Cuentas", code: "03" },
  { value: "audit", label: "Auditoría", code: "04" },
  { value: "presence", label: "Ubicaciones", code: "05" },
  // CHG-126: métricas del sistema operativo del servidor.
  { value: "system", label: "Sistema", code: "06" },
  // CHG-138: gestión de solicitudes «Necesitamos ayuda».
  { value: "helpRequests", label: "Solicitudes", code: "07" },
];

const KIND_LABELS: Record<AdminSubmissionKind, string> = {
  missing_person_report: "Persona desaparecida",
  unverified_building_report: "Edificio pendiente",
  person_status_report: "Novedad de persona",
  aid_location_rating: "Valoración de ayuda",
  collection_center_registration: "Centro de acopio",
  collection_point_registration: "Punto de recolección",
};

const STATUS_LABELS: Record<AdminModerationStatus, string> = {
  under_review: "En revisión",
  needs_information: "Requiere información",
  accepted: "Aceptado",
  rejected: "Rechazado",
  archived: "Archivado",
};

const ROLE_LABELS: Record<AccountRole, string> = {
  user: "Usuario",
  moderator: "Moderador",
  super_admin: "Superadministrador",
};

const ACCOUNT_STATUS_LABELS: Record<AdminAccountStatus, string> = {
  pending_verification: "Verificación pendiente",
  active: "Activa",
  suspended: "Suspendida",
};

const ACTION_LABELS: Record<AdminAction, string> = {
  accept: "Aceptar",
  reject: "Rechazar",
  request_changes: "Solicitar información",
  archive: "Archivar",
  restore: "Restaurar",
};

interface AdminDashboardProps {
  dataSource?: AdminDataSource;
  onLogin: () => void;
  onHome: () => void;
}

function guardAdminDataSource(
  source: AdminDataSource,
  onAuthorizationFailure: (error: unknown) => void,
): AdminDataSource {
  const guarded = async <T,>(request: Promise<T>) => {
    try {
      return await request;
    } catch (error: unknown) {
      onAuthorizationFailure(error);
      throw error;
    }
  };
  return {
    ...source,
    getOverview: (signal) => guarded(source.getOverview(signal)),
    listSubmissions: (filters, signal) =>
      guarded(source.listSubmissions(filters, signal)),
    getSubmission: (id, signal) => guarded(source.getSubmission(id, signal)),
    updateSubmission: (id, input) =>
      guarded(source.updateSubmission(id, input)),
    decideSubmission: (id, input) =>
      guarded(source.decideSubmission(id, input)),
    archiveSubmission: (id, input) =>
      guarded(source.archiveSubmission(id, input)),
    restoreSubmission: (id, input) =>
      guarded(source.restoreSubmission(id, input)),
    grantEvidenceAccess: (submissionId, evidenceId) =>
      guarded(source.grantEvidenceAccess(submissionId, evidenceId)),
    listAccounts: (filters, signal) =>
      guarded(source.listAccounts(filters, signal)),
    getAccount: (id, signal) => guarded(source.getAccount(id, signal)),
    updateAccount: (id, input) => guarded(source.updateAccount(id, input)),
    revokeAccountSessions: (id, reason) =>
      guarded(source.revokeAccountSessions(id, reason)),
    listAudit: (filters, signal) =>
      guarded(source.listAudit(filters, signal)),
    listVisitorPresence: (signal) =>
      guarded(source.listVisitorPresence(signal)),
    getSystemMetrics: (signal) =>
      guarded(source.getSystemMetrics(signal)),
  };
}

export function AdminDashboard({
  dataSource = adminDataSource,
  onLogin,
  onHome,
}: AdminDashboardProps) {
  const { width } = useWindowDimensions();
  const compact = width < 840;
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
  const [section, setSection] = useState<AdminSection>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleAuthorizationFailure = useCallback((error: unknown) => {
    if (!(error instanceof AdminApiError)) return;
    if (error.status === 401) {
      setAuthState({
        status: "error",
        message: "Tu sesión administrativa venció o fue revocada.",
      });
    } else if (error.status === 403) {
      setAuthState({
        status: "denied",
        message: "El servidor retiró el permiso super_admin de esta sesión.",
      });
    }
  }, []);
  const protectedDataSource = useMemo(
    () => guardAdminDataSource(dataSource, handleAuthorizationFailure),
    [dataSource, handleAuthorizationFailure],
  );

  useEffect(() => {
    const controller = new AbortController();
    dataSource
      .getCurrentAccount(controller.signal)
      .then((account) => {
        if (account.assignedRole !== "super_admin") {
          setAuthState({
            status: "denied",
            message:
              "Tu cuenta tiene una sesión válida, pero no posee el rol super_admin.",
          });
          return;
        }
        setAuthState({ status: "ready", account });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible comprobar la sesión administrativa.";
        setAuthState({
          status: error instanceof AdminApiError && error.status === 403 ? "denied" : "error",
          message,
        });
      });
    return () => controller.abort();
  }, [dataSource]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      setOverview(await protectedDataSource.getOverview());
    } catch (error: unknown) {
      setOverviewError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el resumen administrativo.",
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [protectedDataSource]);

  useEffect(() => {
    if (authState.status === "ready") void loadOverview();
  }, [authState.status, loadOverview, refreshKey]);

  const refreshAll = () => setRefreshKey((current) => current + 1);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await dataSource.logout();
      onLogin();
    } catch (error: unknown) {
      setOverviewError(
        error instanceof Error ? error.message : "No fue posible cerrar la sesión.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  if (authState.status === "checking") {
    return <AdminGateState title="Comprobando sesión" message="Validando cuenta y rol con el servidor…" loading />;
  }
  if (authState.status === "denied") {
    return (
      <AdminGateState
        title="Acceso administrativo denegado"
        message={authState.message}
        primaryLabel="INICIAR CON OTRA CUENTA"
        onPrimary={onLogin}
        secondaryLabel="VOLVER A LA PORTADA"
        onSecondary={onHome}
      />
    );
  }
  if (authState.status === "error") {
    return (
      <AdminGateState
        title="Sesión administrativa requerida"
        message={authState.message}
        primaryLabel="IR A INICIAR SESIÓN"
        onPrimary={onLogin}
        secondaryLabel="VOLVER A LA PORTADA"
        onSecondary={onHome}
      />
    );
  }

  return (
    <LinearGradient colors={["#050811", colors.canvas, "#090b12"]} style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <AdminHeader
          account={authState.account}
          compact={compact}
          loggingOut={loggingOut}
          onHome={onHome}
          onLogout={() => void logout()}
        />
        <View style={[styles.shell, compact && styles.shellCompact]}>
          <AdminNavigation
            active={section}
            compact={compact}
            onSelect={setSection}
            transport={protectedDataSource.transport}
          />
          <ScrollView
            contentContainerStyle={styles.mainScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.main}
          >
            {section === "overview" && (
              <OverviewSection
                data={overview}
                error={overviewError}
                loading={overviewLoading}
                onNavigate={setSection}
                onRetry={() => void loadOverview()}
              />
            )}
            {section === "submissions" && (
              <SubmissionsSection
                dataSource={protectedDataSource}
                refreshKey={refreshKey}
                onMutated={refreshAll}
              />
            )}
            {section === "accounts" && (
              <AccountsSection
                currentAccountId={authState.account.id}
                dataSource={protectedDataSource}
                refreshKey={refreshKey}
                onMutated={refreshAll}
              />
            )}
            {section === "audit" && (
              <AuditSection dataSource={protectedDataSource} refreshKey={refreshKey} />
            )}
            {section === "presence" && (
              <PresenceSection dataSource={protectedDataSource} refreshKey={refreshKey} />
            )}
            {section === "system" && (
              <SystemMetricsSection
                dataSource={protectedDataSource}
                refreshKey={refreshKey}
              />
            )}
            {/* CHG-138: ver todo lo que llega de «Necesitamos ayuda» y
                eliminarlo una a una o vaciar la base. */}
            {section === "helpRequests" && (
              <HelpRequestsAdminSection dataSource={protectedDataSource} />
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function AdminHeader({
  account,
  compact,
  loggingOut,
  onHome,
  onLogout,
}: {
  account: AuthenticatedAccount;
  compact: boolean;
  loggingOut: boolean;
  onHome: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver a la plataforma pública" onPress={onHome} style={styles.brandButton}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
        <View>
          <Text style={styles.brandOverline}>CUSOL · CONTROL CENTER</Text>
          <Text style={styles.brandTitle}>Administración</Text>
        </View>
      </Pressable>
      <View style={styles.accountHeader}>
        {!compact && (
          <View style={styles.accountCopy}>
            <Text style={styles.accountName}>{account.displayName}</Text>
            <Text style={styles.accountRole}>SUPER_ADMIN · SESIÓN ACTIVA</Text>
          </View>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión administrativa" disabled={loggingOut} onPress={onLogout} style={styles.logoutButton}>
          {loggingOut ? <ActivityIndicator size="small" color={colors.reported} /> : <Text style={styles.logoutText}>CERRAR SESIÓN</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function AdminNavigation({
  active,
  compact,
  onSelect,
  transport,
}: {
  active: AdminSection;
  compact: boolean;
  onSelect: (section: AdminSection) => void;
  transport: "api" | "demo";
}) {
  return (
    <View style={[styles.navigation, compact && styles.navigationCompact]} accessibilityLabel="Navegación administrativa">
      <View style={[styles.navItems, compact && styles.navItemsCompact]}>
        {SECTION_OPTIONS.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.value === active }}
            onPress={() => onSelect(item.value)}
            style={({ pressed }) => [styles.navItem, compact && styles.navItemCompact, item.value === active && styles.navItemActive, pressed && styles.pressed]}
          >
            <Text style={[styles.navCode, item.value === active && styles.navCodeActive]}>{item.code}</Text>
            <Text style={[styles.navLabel, item.value === active && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.transportNotice, compact && styles.transportNoticeCompact]}>
        <View style={[styles.transportDot, transport === "api" ? styles.apiDot : styles.demoDot]} />
        <Text style={styles.transportText}>{transport === "api" ? "API ADMIN REAL" : "DATOS DEMOSTRATIVOS"}</Text>
      </View>
    </View>
  );
}

function SectionHeading({ code, title, description }: { code: string; title: string; description: string }) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.sectionOverline}>{code} / ADMINISTRATION</Text>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionLead}>{description}</Text>
    </View>
  );
}

function OverviewSection({
  data,
  error,
  loading,
  onNavigate,
  onRetry,
}: {
  data: AdminOverview | null;
  error: string | null;
  loading: boolean;
  onNavigate: (section: AdminSection) => void;
  onRetry: () => void;
}) {
  if (loading && !data) return <InlineLoading label="Cargando resumen administrativo" />;
  if (error && !data) return <InlineError message={error} onRetry={onRetry} />;
  if (!data) return null;
  const metrics = [
    { label: "En revisión", value: data.underReview, tone: colors.missing },
    { label: "Requieren información", value: data.needsInformation, tone: colors.building },
    { label: "Aceptados hoy", value: data.acceptedToday, tone: colors.alive },
    { label: "Archivados", value: data.archived, tone: colors.inkDim },
    { label: "Cuentas activas", value: data.activeAccounts, tone: colors.cyan },
    { label: "Cuentas suspendidas", value: data.suspendedAccounts, tone: colors.reported },
  ];
  return (
    <View style={styles.sectionContent}>
      <SectionHeading code="01" title="Panorama de control" description="Estado de la moderación, las cuentas y la actividad. Cada acción queda auditada." />
      {error && <InlineNotice message={error} tone="error" />}
      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <Pressable key={metric.label} accessibilityRole="button" onPress={() => onNavigate(metric.label.includes("Cuenta") ? "accounts" : "submissions")} style={styles.metricCard}>
            <View style={[styles.metricAccent, { backgroundColor: metric.tone }]} />
            <Text style={styles.metricValue}>{metric.value.toLocaleString("es-CO")}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.generatedAt}>RESUMEN GENERADO · {formatDateTime(data.generatedAt)}</Text>
      <View style={styles.dashboardColumns}>
        <Panel title="INGRESOS POR TIPO" meta={`${data.byKind.reduce((sum, item) => sum + item.count, 0)} TOTAL`}>
          {data.byKind.length === 0 ? <EmptyText text="No hay ingresos registrados." /> : data.byKind.map((item) => (
            <View key={item.kind} style={styles.countRow}>
              <Text style={styles.countLabel}>{KIND_LABELS[item.kind]}</Text>
              <Text style={styles.countValue}>{item.count}</Text>
            </View>
          ))}
        </Panel>
        <Panel title="ACTIVIDAD RECIENTE" meta={formatDateTime(data.generatedAt)}>
          {data.recentActivity.length === 0 ? <EmptyText text="Todavía no hay acciones administrativas." /> : data.recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityRow}>
              <View style={[styles.activityDot, activity.result === "success" ? styles.activitySuccess : styles.activityFailure]} />
              <View style={styles.activityCopy}>
                <Text style={styles.activityAction}>{humanize(activity.action)}</Text>
                <Text style={styles.activityMeta}>{humanize(activity.resourceKind)} · {formatDateTime(activity.occurredAt)}</Text>
              </View>
            </View>
          ))}
        </Panel>
      </View>
      <InlineNotice message="Eliminar significa archivar de forma reversible. No existe borrado físico ni acceso root desde esta consola." tone="safe" />
    </View>
  );
}

function SubmissionsSection({ dataSource, refreshKey, onMutated }: { dataSource: AdminDataSource; refreshKey: number; onMutated: () => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AdminSubmissionKind | undefined>();
  const [status, setStatus] = useState<AdminModerationStatus | undefined>();
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [page, setPage] = useState<AdminSubmissionPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminSubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(await dataSource.listSubmissions({ q: query.trim() || undefined, kind, status, receivedFrom: dateBoundary(receivedFrom, "start"), receivedTo: dateBoundary(receivedTo, "end"), limit: 25, offset }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar los ingresos.");
    } finally {
      setLoading(false);
    }
  }, [dataSource, kind, offset, query, receivedFrom, receivedTo, status]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try { setSelected(await dataSource.getSubmission(id)); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "No fue posible abrir el expediente."); }
    finally { setDetailLoading(false); }
  };

  return (
    <View style={styles.sectionContent}>
      <SectionHeading code="02" title="Ingresos de usuarios" description="Busca, revisa y modera cada expediente sin exponer datos privados en el listado." />
      <Panel title="FILTROS DE BANDEJA" meta={page ? `${page.total} COINCIDENCIAS` : "CONSULTANDO"}>
        <TextInput accessibilityLabel="Buscar ingresos" value={query} onChangeText={(value) => { setQuery(value); setOffset(0); }} placeholder="Código, título o ubicación" placeholderTextColor="#536074" style={styles.searchInput} />
        <FilterRow label="Tipo" value={kind} options={Object.keys(KIND_LABELS) as AdminSubmissionKind[]} labels={KIND_LABELS} onChange={(value) => { setKind(value); setOffset(0); }} />
        <FilterRow label="Estado" value={status} options={Object.keys(STATUS_LABELS) as AdminModerationStatus[]} labels={STATUS_LABELS} onChange={(value) => { setStatus(value); setOffset(0); }} />
        <View style={styles.dateFilters}><TextInput accessibilityLabel="Fecha inicial de ingresos" value={receivedFrom} onChangeText={(value) => { setReceivedFrom(value); setOffset(0); }} placeholder="Desde · AAAA-MM-DD" placeholderTextColor="#536074" inputMode="numeric" maxLength={10} style={[styles.searchInput, styles.dateInput]} /><TextInput accessibilityLabel="Fecha final de ingresos" value={receivedTo} onChangeText={(value) => { setReceivedTo(value); setOffset(0); }} placeholder="Hasta · AAAA-MM-DD" placeholderTextColor="#536074" inputMode="numeric" maxLength={10} style={[styles.searchInput, styles.dateInput]} /></View>
      </Panel>
      {error && <InlineError message={error} onRetry={() => void load()} />}
      {loading && !page ? <InlineLoading label="Cargando ingresos" /> : (
        <View style={styles.listPanel}>
          {page?.items.length === 0 && <EmptyText text="No hay ingresos para estos filtros." />}
          {page?.items.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir expediente ${item.trackingCode}`} onPress={() => void openDetail(item.id)} style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}>
              <View style={styles.recordTop}>
                <KindBadge kind={item.kind} />
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.recordTitle}>{item.title}</Text>
              <Text style={styles.recordCode}>{item.trackingCode} · V{item.version}</Text>
              <Text style={styles.recordMeta}>{item.locationLabel ?? "Ubicación no disponible"}</Text>
              <View style={styles.recordFooter}>
                <Text style={styles.recordFooterText}>{item.sourceLabel}</Text>
                <Text style={styles.recordFooterText}>{item.evidenceCount} evidencia(s) · {formatDateTime(item.receivedAt)}</Text>
              </View>
            </Pressable>
          ))}
          {page && <Pagination total={page.total} limit={page.limit} offset={page.offset} onChange={setOffset} />}
        </View>
      )}
      {detailLoading && <InlineLoading label="Abriendo expediente" />}
      <SubmissionDetailModal
        dataSource={dataSource}
        detail={selected}
        onClose={() => setSelected(null)}
        onChanged={async () => {
          if (selected) setSelected(await dataSource.getSubmission(selected.id));
          await load();
          onMutated();
        }}
      />
    </View>
  );
}

function SubmissionDetailModal({ dataSource, detail, onClose, onChanged }: { dataSource: AdminDataSource; detail: AdminSubmissionDetail | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null);

  useEffect(() => {
    setEdits(Object.fromEntries(detail?.fields.filter((field) => field.editable).map((field) => [field.key, field.editValue ?? ""]) ?? []));
    setReason(""); setError(null); setNotice(null); setPendingAction(null);
  }, [detail]);

  if (!detail) return null;
  const save = async () => {
    const changes = detail.fields.filter((field) => field.editable && (field.editValue ?? "") !== (edits[field.key] ?? "")).map((field) => ({ field: field.key, value: edits[field.key] || null }));
    if (changes.length === 0) { setError("No hay cambios para guardar."); return; }
    if (reason.trim().length < 10) { setError("Explica el motivo con al menos 10 caracteres."); return; }
    setWorking(true); setError(null);
    try { await dataSource.updateSubmission(detail.id, { expectedVersion: detail.version, reason: reason.trim(), changes }); setNotice("Cambios guardados y auditados."); await onChanged(); }
    catch (caught: unknown) { setError(messageOf(caught)); }
    finally { setWorking(false); }
  };
  const applyAction = async () => {
    if (!pendingAction) return;
    if (reason.trim().length < 10) { setError("Explica el motivo con al menos 10 caracteres."); return; }
    setWorking(true); setError(null);
    try {
      if (pendingAction === "archive") await dataSource.archiveSubmission(detail.id, { expectedVersion: detail.version, reason: reason.trim() });
      else if (pendingAction === "restore") await dataSource.restoreSubmission(detail.id, { expectedVersion: detail.version, reason: reason.trim() });
      else await dataSource.decideSubmission(detail.id, { expectedVersion: detail.version, action: pendingAction, reason: reason.trim() });
      setNotice(`${ACTION_LABELS[pendingAction]} aplicado y auditado.`); setPendingAction(null); await onChanged();
    } catch (caught: unknown) { setError(messageOf(caught)); }
    finally { setWorking(false); }
  };
  const accessEvidence = async (evidenceId: string) => {
    setWorking(true); setError(null);
    try {
      const grant = await dataSource.grantEvidenceAccess(detail.id, evidenceId);
      setNotice(`Acceso concedido hasta ${formatDateTime(grant.expiresAt)}.`);
      if (dataSource.transport === "api" && (await Linking.canOpenURL(grant.url))) await Linking.openURL(grant.url);
    } catch (caught: unknown) { setError(messageOf(caught)); }
    finally { setWorking(false); }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}><KindBadge kind={detail.kind} /><Text accessibilityRole="header" style={styles.modalTitle}>{detail.title}</Text><Text style={styles.recordCode}>{detail.trackingCode} · V{detail.version}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar expediente" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.detailMeta}><StatusBadge status={detail.status} /><Text style={styles.detailMetaText}>{detail.locationLabel ?? "Sin ubicación"} · {formatDateTime(detail.updatedAt)}</Text></View>
            <Text style={styles.detailSectionLabel}>CAMPOS DEL EXPEDIENTE</Text>
            <View style={styles.fieldList}>
              {detail.fields.length === 0 && <EmptyText text="Este expediente no expone campos en la demostración." />}
              {detail.fields.map((field) => (
                <View key={field.key} style={styles.adminField}>
                  <View style={styles.adminFieldHeader}><Text style={styles.adminFieldLabel}>{field.label}</Text><ClassificationBadge value={field.classification} /></View>
                  {field.editable ? <TextInput accessibilityLabel={`Editar ${field.label}`} value={edits[field.key] ?? ""} onChangeText={(value) => setEdits((current) => ({ ...current, [field.key]: value }))} multiline={field.inputKind === "multiline"} style={[styles.adminInput, field.inputKind === "multiline" && styles.adminInputMultiline]} /> : <Text style={styles.readonlyValue}>{field.displayValue || "—"}</Text>}
                </View>
              ))}
            </View>
            <Text style={styles.detailSectionLabel}>EVIDENCIA PRIVADA · ACCESO AUDITADO</Text>
            {detail.evidence.length === 0 ? <EmptyText text="No hay evidencia adjunta." /> : detail.evidence.map((evidence, index) => (
              <View key={evidence.id} style={styles.evidenceRow}><View><Text style={styles.evidenceTitle}>Evidencia {index + 1} · {evidence.mediaType}</Text><Text style={styles.evidenceMeta}>{formatBytes(evidence.sizeBytes)} · {evidence.scanStatus}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Solicitar acceso a evidencia ${index + 1}`} onPress={() => void accessEvidence(evidence.id)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>ACCESO 5 MIN</Text></Pressable></View>
            ))}
            <View style={styles.reasonField}><Text style={styles.adminFieldLabel}>Motivo obligatorio de edición o decisión</Text><TextInput accessibilityLabel="Motivo administrativo" value={reason} onChangeText={setReason} multiline placeholder="Describe por qué realizas este cambio (mínimo 10 caracteres)" placeholderTextColor="#536074" style={[styles.adminInput, styles.adminInputMultiline]} /></View>
            {error && <InlineNotice message={error} tone="error" />}{notice && <InlineNotice message={notice} tone="safe" />}
            <Pressable accessibilityRole="button" accessibilityLabel="Guardar cambios del expediente" disabled={working} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>GUARDAR CAMPOS EDITABLES</Text></Pressable>
            <View style={styles.actionGrid}>{detail.availableActions.map((action) => <Pressable key={action} accessibilityRole="button" accessibilityLabel={`${ACTION_LABELS[action]} expediente`} onPress={() => setPendingAction(action)} style={[styles.actionButton, action === "reject" || action === "archive" ? styles.dangerAction : styles.safeAction]}><Text style={styles.actionButtonText}>{ACTION_LABELS[action].toUpperCase()}</Text></Pressable>)}</View>
            {pendingAction && <View style={styles.confirmPanel}><Text style={styles.confirmTitle}>Confirmar: {ACTION_LABELS[pendingAction]}</Text><Text style={styles.confirmText}>La acción se enviará con la versión {detail.version}, el motivo escrito y una entrada de auditoría.</Text><View style={styles.confirmActions}><Pressable accessibilityRole="button" onPress={() => setPendingAction(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>CANCELAR</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Confirmar ${ACTION_LABELS[pendingAction]}`} disabled={working} onPress={() => void applyAction()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>CONFIRMAR</Text></Pressable></View></View>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AccountsSection({ currentAccountId, dataSource, refreshKey, onMutated }: { currentAccountId: string; dataSource: AdminDataSource; refreshKey: number; onMutated: () => void }) {
  const [query, setQuery] = useState(""); const [role, setRole] = useState<AccountRole | undefined>(); const [status, setStatus] = useState<AdminAccountStatus | undefined>();
  const [page, setPage] = useState<AdminAccountPage | null>(null); const [offset, setOffset] = useState(0); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [selected, setSelected] = useState<AdminAccountDetail | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setPage(await dataSource.listAccounts({ q: query.trim() || undefined, role, status, limit: 25, offset })); } catch (caught: unknown) { setError(messageOf(caught)); } finally { setLoading(false); } }, [dataSource, offset, query, role, status]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const open = async (id: string) => { setLoading(true); try { setSelected(await dataSource.getAccount(id)); } catch (caught: unknown) { setError(messageOf(caught)); } finally { setLoading(false); } };
  return <View style={styles.sectionContent}><SectionHeading code="03" title="Cuentas y permisos" description="Administra roles, estados y sesiones sin acceder a contraseñas, hashes o tokens." /><Panel title="FILTROS DE CUENTAS" meta={page ? `${page.total} CUENTAS` : "CONSULTANDO"}><TextInput accessibilityLabel="Buscar cuentas" value={query} onChangeText={(value) => { setQuery(value); setOffset(0); }} placeholder="Nombre o correo" placeholderTextColor="#536074" style={styles.searchInput} /><FilterRow label="Rol" value={role} options={["user", "moderator", "super_admin"]} labels={ROLE_LABELS} onChange={(value) => { setRole(value); setOffset(0); }} /><FilterRow label="Estado" value={status} options={["pending_verification", "active", "suspended"]} labels={ACCOUNT_STATUS_LABELS} onChange={(value) => { setStatus(value); setOffset(0); }} /></Panel>{error && <InlineError message={error} onRetry={() => void load()} />}{loading && !page ? <InlineLoading label="Cargando cuentas" /> : <View style={styles.listPanel}>{page?.items.map((account) => <Pressable key={account.id} accessibilityRole="button" accessibilityLabel={`Administrar cuenta ${account.displayName}`} onPress={() => void open(account.id)} style={styles.accountCard}><View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>{initials(account.displayName)}</Text></View><View style={styles.accountCardCopy}><Text style={styles.recordTitle}>{account.displayName}</Text><Text style={styles.accountEmail}>{account.email}</Text><Text style={styles.recordFooterText}>{ROLE_LABELS[account.assignedRole]} · {ACCOUNT_STATUS_LABELS[account.status]} · {account.activeSessions} sesión(es)</Text></View><Text style={styles.openArrow}>→</Text></Pressable>)}{page?.items.length === 0 && <EmptyText text="No hay cuentas para estos filtros." />}{page && <Pagination total={page.total} limit={page.limit} offset={page.offset} onChange={setOffset} />}</View>}<AccountDetailModal currentAccountId={currentAccountId} dataSource={dataSource} detail={selected} onClose={() => setSelected(null)} onChanged={async () => { if (selected) setSelected(await dataSource.getAccount(selected.id)); await load(); onMutated(); }} /></View>;
}

function AccountDetailModal({ currentAccountId, dataSource, detail, onClose, onChanged }: { currentAccountId: string; dataSource: AdminDataSource; detail: AdminAccountDetail | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [role, setRole] = useState<AccountRole>("user"); const [status, setStatus] = useState<AdminAccountStatus>("active"); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [working, setWorking] = useState(false); const [confirmRevoke, setConfirmRevoke] = useState(false);
  useEffect(() => { if (detail) { setRole(detail.assignedRole); setStatus(detail.status); setReason(""); setError(null); setNotice(null); setConfirmRevoke(false); } }, [detail]);
  if (!detail) return null;
  const save = async () => { if (reason.trim().length < 10) { setError("Explica el motivo con al menos 10 caracteres."); return; } const input = { expectedVersion: detail.version, reason: reason.trim(), ...(role !== detail.assignedRole ? { assignedRole: role } : {}), ...(status !== detail.status ? { status } : {}) }; if (!("assignedRole" in input) && !("status" in input)) { setError("No hay cambios de rol o estado."); return; } setWorking(true); setError(null); try { await dataSource.updateAccount(detail.id, input); setNotice("Cuenta actualizada y auditada."); await onChanged(); } catch (caught: unknown) { setError(messageOf(caught)); } finally { setWorking(false); } };
  const revoke = async () => { if (reason.trim().length < 10) { setError("Explica el motivo con al menos 10 caracteres."); return; } setWorking(true); try { await dataSource.revokeAccountSessions(detail.id, reason.trim()); setNotice("Sesiones revocadas."); setConfirmRevoke(false); await onChanged(); } catch (caught: unknown) { setError(messageOf(caught)); } finally { setWorking(false); } };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCardSmall}><View style={styles.modalHeader}><View><Text style={styles.sectionOverline}>ACCOUNT / V{detail.version}</Text><Text accessibilityRole="header" style={styles.modalTitle}>{detail.displayName}</Text><Text style={styles.accountEmail}>{detail.email}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar cuenta" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.accountFacts}><Fact label="Ubicación" value={`${detail.municipality}, ${detail.department}`} /><Fact label="Participación" value={humanize(detail.requestedAccountType)} /><Fact label="Sesiones activas" value={String(detail.activeSessions)} /><Fact label="Cuenta propia" value={detail.id === currentAccountId ? "Sí" : "No"} /></View><FilterRow label="Rol asignado" value={role} allowAll={false} options={["user", "moderator", "super_admin"]} labels={ROLE_LABELS} onChange={(value) => value && setRole(value)} /><FilterRow label="Estado" value={status} allowAll={false} options={["pending_verification", "active", "suspended"]} labels={ACCOUNT_STATUS_LABELS} onChange={(value) => value && setStatus(value)} /><TextInput accessibilityLabel="Motivo de gestión de cuenta" value={reason} onChangeText={setReason} multiline placeholder="Motivo obligatorio (mínimo 10 caracteres)" placeholderTextColor="#536074" style={[styles.adminInput, styles.adminInputMultiline]} />{error && <InlineNotice message={error} tone="error" />}{notice && <InlineNotice message={notice} tone="safe" />}<Pressable accessibilityRole="button" accessibilityLabel="Guardar rol y estado" disabled={working} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>GUARDAR ROL Y ESTADO</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Revocar todas las sesiones" onPress={() => setConfirmRevoke(true)} style={[styles.actionButton, styles.dangerAction]}><Text style={styles.actionButtonText}>REVOCAR TODAS LAS SESIONES</Text></Pressable>{confirmRevoke && <View style={styles.confirmPanel}><Text style={styles.confirmTitle}>¿Revocar {detail.activeSessions} sesión(es)?</Text><Text style={styles.confirmText}>La cuenta deberá volver a iniciar sesión. Esta operación queda auditada.</Text><View style={styles.confirmActions}><Pressable accessibilityRole="button" onPress={() => setConfirmRevoke(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>CANCELAR</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Confirmar revocación de sesiones" onPress={() => void revoke()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>CONFIRMAR</Text></Pressable></View></View>}<InlineNotice message="El último superadministrador activo no puede degradarse ni suspenderse." tone="safe" /></ScrollView></View></View></Modal>;
}

const PRESENCE_PLATFORM_LABELS: Record<"web" | "android" | "ios", string> = {
  web: "Web",
  android: "App Android",
  ios: "App iOS",
};

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

// CHG-066: ubicación en vivo de usuarios registrados que comparten su
// posición mientras usan la plataforma. Regla vigente: SOLO la ve la
// consola super_admin; los anónimos no aparecen aquí (su única huella
// es la instantánea cifrada adjunta a los reportes que envíen).
function PresenceSection({ dataSource, refreshKey }: { dataSource: AdminDataSource; refreshKey: number }) {
  const [page, setPage] = useState<AdminVisitorPresencePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(await dataSource.listVisitorPresence());
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [dataSource]);
  useEffect(() => {
    void load();
    // Refresco periódico mientras la sección está abierta.
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);
  return (
    <View style={styles.sectionContent}>
      <SectionHeading
        code="05"
        title="Ubicaciones en vivo"
        description="Usuarios registrados que comparten su ubicación mientras usan la plataforma. Visible únicamente para super_admin; los reportes anónimos solo dejan una instantánea cifrada en su expediente."
      />
      {error && <InlineError message={error} onRetry={() => void load()} />}
      {loading && !page ? (
        <InlineLoading label="Cargando ubicaciones en vivo" />
      ) : (
        <View style={styles.listPanel}>
          <Panel
            title="PRESENCIA ACTIVA"
            meta={page ? `${page.total} EN LOS ÚLTIMOS ${page.windowMinutes} MIN` : "CONSULTANDO"}
          >
            {page?.items.map((item) => (
              <View key={item.presenceId} style={styles.auditCard}>
                <View style={styles.auditTop}>
                  <Text style={styles.auditAction}>
                    {PRESENCE_PLATFORM_LABELS[item.platform]}
                  </Text>
                  <Text style={[styles.auditResult, styles.resultSuccess]}>
                    REGISTRADO
                  </Text>
                </View>
                <Text style={styles.auditActor}>
                  {formatCoordinate(item.latitude)}, {formatCoordinate(item.longitude)}
                </Text>
                <Text style={styles.auditMeta}>
                  {item.accuracyMeters !== null
                    ? `±${Math.round(item.accuracyMeters)} m · `
                    : ""}
                  Visto por primera vez {formatDateTime(item.firstSeenAt)} · Última señal {formatDateTime(item.updatedAt)}
                </Text>
                <Text style={styles.auditReason}>ID de dispositivo {item.presenceId.slice(0, 8)}…</Text>
              </View>
            ))}
            {page?.items.length === 0 && (
              <EmptyText text="Ningún usuario registrado está compartiendo ubicación en este momento." />
            )}
          </Panel>
        </View>
      )}
    </View>
  );
}

function AuditSection({ dataSource, refreshKey }: { dataSource: AdminDataSource; refreshKey: number }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState<AdminAuditPage | null>(null); const [offset, setOffset] = useState(0); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setPage(await dataSource.listAudit({ q: query.trim() || undefined, limit: 25, offset })); } catch (caught: unknown) { setError(messageOf(caught)); } finally { setLoading(false); } }, [dataSource, offset, query]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  return <View style={styles.sectionContent}><SectionHeading code="04" title="Auditoría administrativa" description="Trazabilidad de acciones y resultados sin contraseñas, tokens ni payloads privados." /><TextInput accessibilityLabel="Buscar auditoría" value={query} onChangeText={(value) => { setQuery(value); setOffset(0); }} placeholder="Actor, acción, recurso o motivo" placeholderTextColor="#536074" style={styles.searchInput} />{error && <InlineError message={error} onRetry={() => void load()} />}{loading && !page ? <InlineLoading label="Cargando auditoría" /> : <View style={styles.auditList}>{page?.items.map((event) => <View key={event.id} style={styles.auditCard}><View style={styles.auditTop}><Text style={styles.auditAction}>{humanize(event.action)}</Text><Text style={[styles.auditResult, event.result === "success" ? styles.resultSuccess : styles.resultFailed]}>{event.result.toUpperCase()}</Text></View><Text style={styles.auditActor}>{event.actorDisplayName}</Text><Text style={styles.auditMeta}>{humanize(event.resourceKind)} · {event.resourceId.slice(0, 8)}… · {formatDateTime(event.occurredAt)}</Text>{event.reasonSummary && <Text style={styles.auditReason}>{event.reasonSummary}</Text>}</View>)}{page?.items.length === 0 && <EmptyText text="No hay eventos para esta búsqueda." />}{page && <Pagination total={page.total} limit={page.limit} offset={page.offset} onChange={setOffset} />}</View>}</View>;
}

function FilterRow<Value extends string>({ label, value, options, labels, onChange, allowAll = true }: { label: string; value: Value | undefined; options: Value[]; labels: Record<Value, string>; onChange: (value: Value | undefined) => void; allowAll?: boolean }) {
  return <View style={styles.filterBlock}><Text style={styles.filterLabel}>{label.toUpperCase()}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>{allowAll && <FilterChip label="Todos" active={!value} onPress={() => onChange(undefined)} />}{options.map((option) => <FilterChip key={option} label={labels[option]} active={value === option} onPress={() => onChange(option)} />)}</ScrollView></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></Pressable>; }
function KindBadge({ kind }: { kind: AdminSubmissionKind }) { return <View style={styles.kindBadge}><Text style={styles.kindBadgeText}>{KIND_LABELS[kind].toUpperCase()}</Text></View>; }
function StatusBadge({ status }: { status: AdminModerationStatus }) { return <View style={[styles.statusBadge, status === "accepted" && styles.statusAccepted, status === "rejected" && styles.statusRejected, status === "archived" && styles.statusArchived]}><Text style={styles.statusBadgeText}>{STATUS_LABELS[status].toUpperCase()}</Text></View>; }
function ClassificationBadge({ value }: { value: "public" | "private" | "protected" }) { return <Text style={[styles.classification, value === "public" && styles.classPublic, value === "protected" && styles.classProtected]}>{value === "public" ? "PÚBLICO" : value === "private" ? "PRIVADO" : "PROTEGIDO"}</Text>; }
function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) { const page = Math.floor(offset / limit) + 1; const pages = Math.max(1, Math.ceil(total / limit)); return <View style={styles.pagination}><Pressable accessibilityRole="button" accessibilityLabel="Página anterior" disabled={offset === 0} onPress={() => onChange(Math.max(0, offset - limit))} style={[styles.pageButton, offset === 0 && styles.disabled]}><Text style={styles.pageButtonText}>← ANTERIOR</Text></Pressable><Text style={styles.pageInfo}>PÁGINA {page} DE {pages}</Text><Pressable accessibilityRole="button" accessibilityLabel="Página siguiente" disabled={offset + limit >= total} onPress={() => onChange(offset + limit)} style={[styles.pageButton, offset + limit >= total && styles.disabled]}><Text style={styles.pageButtonText}>SIGUIENTE →</Text></Pressable></View>; }
function Panel({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) { return <View style={styles.panel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelMeta}>{meta}</Text></View><View style={styles.panelBody}>{children}</View></View>; }
function Fact({ label, value }: { label: string; value: string }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>; }
function InlineLoading({ label }: { label: string }) { return <View accessibilityLabel={label} style={styles.inlineState}><ActivityIndicator color={colors.cyan} /><Text style={styles.inlineStateText}>{label}…</Text></View>; }
function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) { return <View accessibilityRole="alert" style={styles.inlineError}><Text style={styles.inlineErrorTitle}>No fue posible completar la consulta</Text><Text style={styles.inlineErrorText}>{message}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>REINTENTAR</Text></Pressable></View>; }
function InlineNotice({ message, tone }: { message: string; tone: "safe" | "error" }) { return <View accessibilityRole="alert" style={[styles.notice, tone === "error" ? styles.noticeError : styles.noticeSafe]}><Text style={[styles.noticeText, tone === "error" ? styles.noticeErrorText : styles.noticeSafeText]}>{message}</Text></View>; }
function EmptyText({ text }: { text: string }) { return <Text style={styles.emptyText}>{text}</Text>; }

function AdminGateState({ title, message, loading = false, primaryLabel, onPrimary, secondaryLabel, onSecondary }: { title: string; message: string; loading?: boolean; primaryLabel?: string; onPrimary?: () => void; secondaryLabel?: string; onSecondary?: () => void }) {
  return <LinearGradient colors={["#050811", colors.canvas]} style={[styles.root, styles.gateRoot]}><View style={styles.gateCard}>{loading ? <ActivityIndicator size="large" color={colors.cyan} /> : <View style={styles.gateLock}><Text style={styles.gateLockText}>◇</Text></View>}<Text style={styles.sectionOverline}>ADMIN / ACCESS CONTROL</Text><Text accessibilityRole="header" style={styles.gateTitle}>{title}</Text><Text style={styles.gateText}>{message}</Text>{primaryLabel && onPrimary && <Pressable accessibilityRole="button" onPress={onPrimary} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{primaryLabel}</Text></Pressable>}{secondaryLabel && onSecondary && <Pressable accessibilityRole="button" onPress={onSecondary} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{secondaryLabel}</Text></Pressable>}</View></LinearGradient>;
}

function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatBytes(value: number) { return `${(value / (1024 * 1024)).toFixed(2)} MiB`; }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function messageOf(error: unknown) { return error instanceof Error ? error.message : "No fue posible completar la operación."; }
function dateBoundary(value: string, boundary: "start" | "end") { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z` : undefined; }

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 720 }, safeArea: { flex: 1 },
  header: { width: "100%", maxWidth: contentMaxWidth, minHeight: 78, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "rgba(5,8,17,0.94)" }, headerCompact: { paddingHorizontal: 12 },
  brandButton: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 }, brandMark: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cyan, borderRadius: 8, backgroundColor: "rgba(81,229,255,0.08)" }, brandMarkText: { color: colors.cyan, fontSize: 17, fontWeight: "900" }, brandOverline: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 1 }, brandTitle: { marginTop: 2, color: colors.ink, fontSize: 17, fontWeight: "800" },
  accountHeader: { flexDirection: "row", alignItems: "center", gap: 16 }, accountCopy: { alignItems: "flex-end" }, accountName: { color: colors.ink, fontSize: 10, fontWeight: "800" }, accountRole: { marginTop: 3, color: colors.alive, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.7 }, logoutButton: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,103,136,0.3)", borderRadius: 7 }, logoutText: { color: colors.reported, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" },
  shell: { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", flex: 1, flexDirection: "row" }, shellCompact: { flexDirection: "column" }, navigation: { width: 220, justifyContent: "space-between", padding: 16, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: "rgba(7,11,21,0.78)" }, navigationCompact: { width: "100%", padding: 8, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.line }, navItems: { gap: 7 }, navItemsCompact: { flexDirection: "row" }, navItem: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 48, paddingHorizontal: 12, borderRadius: 8 }, navItemCompact: { minWidth: 0, flex: 1, flexDirection: "column", justifyContent: "center", gap: 1, paddingHorizontal: 4 }, navItemActive: { backgroundColor: "rgba(81,229,255,0.10)" }, navCode: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 9 }, navCodeActive: { color: colors.cyan }, navLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "700" }, navLabelActive: { color: colors.ink }, transportNotice: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, transportNoticeCompact: { alignSelf: "center", marginTop: 7, paddingVertical: 6 }, transportDot: { width: 6, height: 6, borderRadius: 3 }, apiDot: { backgroundColor: colors.alive }, demoDot: { backgroundColor: colors.missing }, transportText: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" },
  main: { flex: 1 }, mainScroll: { flexGrow: 1, padding: 26, paddingBottom: 90 }, sectionContent: { gap: 18 }, sectionIntro: { maxWidth: 850, marginBottom: 4 }, sectionOverline: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 1.1 }, sectionTitle: { marginTop: 6, color: colors.ink, fontSize: 38, fontWeight: "800", letterSpacing: -1.8, lineHeight: 43 }, sectionLead: { maxWidth: 760, marginTop: 8, color: colors.inkSoft, fontSize: 12, lineHeight: 20 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metricCard: { minWidth: 160, flex: 1, minHeight: 125, overflow: "hidden", padding: 17, borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.panel }, metricAccent: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3 }, metricValue: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 31, fontWeight: "800" }, metricLabel: { marginTop: 14, color: colors.inkSoft, fontSize: 10, fontWeight: "700" }, dashboardColumns: { flexDirection: Platform.OS === "web" ? "row" : "column", alignItems: "flex-start", gap: 12 }, panel: { minWidth: 280, flex: 1, overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.panel }, panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.line }, panelTitle: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 8, fontWeight: "800", letterSpacing: 0.8 }, panelMeta: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7 }, panelBody: { gap: 8, padding: 14 }, countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "rgba(137,166,207,0.09)" }, countLabel: { color: colors.inkSoft, fontSize: 10 }, countValue: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 12, fontWeight: "800" }, activityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }, activityDot: { width: 7, height: 7, borderRadius: 4 }, activitySuccess: { backgroundColor: colors.alive }, activityFailure: { backgroundColor: colors.reported }, activityCopy: { minWidth: 0, flex: 1 }, activityAction: { color: colors.ink, fontSize: 10, fontWeight: "700" }, activityMeta: { marginTop: 3, color: colors.inkDim, fontSize: 8 },
  generatedAt: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, letterSpacing: 0.6, textAlign: "right" }, searchInput: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(137,166,207,0.24)", borderRadius: 8, color: colors.ink, backgroundColor: "rgba(5,9,17,0.78)", fontSize: 11 }, dateFilters: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, dateInput: { minWidth: 180, flex: 1 }, filterBlock: { gap: 7 }, filterLabel: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 0.7 }, filterChips: { gap: 6, paddingRight: 12 }, filterChip: { minHeight: 35, justifyContent: "center", paddingHorizontal: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 18 }, filterChipActive: { borderColor: colors.cyan, backgroundColor: "rgba(81,229,255,0.09)" }, filterChipText: { color: colors.inkDim, fontSize: 8, fontWeight: "700" }, filterChipTextActive: { color: colors.cyan },
  listPanel: { gap: 9 }, recordCard: { gap: 8, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.panel }, recordTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, kindBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, backgroundColor: "rgba(81,229,255,0.09)" }, kindBadgeText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 6, fontWeight: "900", letterSpacing: 0.5 }, statusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, backgroundColor: "rgba(255,207,102,0.12)" }, statusAccepted: { backgroundColor: "rgba(67,231,173,0.12)" }, statusRejected: { backgroundColor: "rgba(255,103,136,0.12)" }, statusArchived: { backgroundColor: "rgba(99,112,134,0.17)" }, statusBadgeText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: 6, fontWeight: "900" }, recordTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, recordCode: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 0.5 }, recordMeta: { color: colors.inkSoft, fontSize: 10 }, recordFooter: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line }, recordFooterText: { color: colors.inkDim, fontSize: 8, lineHeight: 13 },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, pageButton: { padding: 9 }, pageButtonText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" }, pageInfo: { color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: 7 },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.76)" }, modalCard: { width: "100%", maxWidth: 920, maxHeight: "94%", overflow: "hidden", borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 14, backgroundColor: "#0b111e" }, modalCardSmall: { width: "100%", maxWidth: 690, maxHeight: "94%", overflow: "hidden", borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 14, backgroundColor: "#0b111e" }, modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 18, borderBottomWidth: 1, borderBottomColor: colors.line }, modalHeaderCopy: { minWidth: 0, flex: 1, gap: 7 }, modalTitle: { color: colors.ink, fontSize: 23, fontWeight: "800", letterSpacing: -0.7 }, closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, closeText: { color: colors.inkSoft, fontSize: 24 }, modalScroll: { gap: 15, padding: 18, paddingBottom: 38 }, detailMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }, detailMetaText: { color: colors.inkDim, fontSize: 9 }, detailSectionLabel: { marginTop: 4, color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800", letterSpacing: 0.8 }, fieldList: { gap: 9 }, adminField: { gap: 7, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, adminFieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, adminFieldLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "800" }, classification: { color: colors.deceased, fontFamily: fontFamilies.mono, fontSize: 6, fontWeight: "900" }, classPublic: { color: colors.alive }, classProtected: { color: colors.reported }, adminInput: { minHeight: 44, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(137,166,207,0.24)", borderRadius: 7, color: colors.ink, backgroundColor: "rgba(4,8,15,0.74)", fontSize: 10 }, adminInputMultiline: { minHeight: 84, textAlignVertical: "top" }, readonlyValue: { color: colors.ink, fontSize: 10, lineHeight: 17 }, evidenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, evidenceTitle: { color: colors.ink, fontSize: 9, fontWeight: "800" }, evidenceMeta: { marginTop: 3, color: colors.inkDim, fontSize: 8 }, reasonField: { gap: 7 },
  primaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 17, borderRadius: 7, backgroundColor: colors.cyan }, primaryButtonText: { color: "#06101a", fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900", letterSpacing: 0.6 }, secondaryButton: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7 }, secondaryButtonText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "800" }, actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, actionButton: { minHeight: 42, flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderRadius: 7 }, safeAction: { borderColor: "rgba(67,231,173,0.34)", backgroundColor: "rgba(67,231,173,0.07)" }, dangerAction: { borderColor: "rgba(255,103,136,0.34)", backgroundColor: "rgba(255,103,136,0.07)" }, actionButtonText: { color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900" }, confirmPanel: { gap: 10, padding: 14, borderWidth: 1, borderColor: "rgba(255,159,67,0.34)", borderRadius: 9, backgroundColor: "rgba(255,159,67,0.07)" }, confirmTitle: { color: colors.building, fontSize: 12, fontWeight: "800" }, confirmText: { color: colors.inkSoft, fontSize: 9, lineHeight: 15 }, confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.panel }, accountAvatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(81,229,255,0.12)" }, accountAvatarText: { color: colors.cyan, fontSize: 11, fontWeight: "900" }, accountCardCopy: { minWidth: 0, flex: 1, gap: 3 }, accountEmail: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: 8 }, openArrow: { color: colors.cyan, fontSize: 18 }, accountFacts: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, fact: { minWidth: 130, flex: 1, gap: 4, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8 }, factLabel: { color: colors.inkDim, fontSize: 7, fontWeight: "800" }, factValue: { color: colors.ink, fontSize: 9, fontWeight: "700" },
  auditList: { gap: 8 }, auditCard: { gap: 6, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.panel }, auditTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, auditAction: { color: colors.ink, fontSize: 12, fontWeight: "800" }, auditResult: { color: colors.reported, fontFamily: fontFamilies.mono, fontSize: 7, fontWeight: "900" }, resultSuccess: { color: colors.alive }, resultFailed: { color: colors.reported }, auditActor: { color: colors.cyan, fontSize: 9, fontWeight: "700" }, auditMeta: { color: colors.inkDim, fontSize: 8 }, auditReason: { marginTop: 4, color: colors.inkSoft, fontSize: 9, lineHeight: 15 },
  inlineState: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, borderWidth: 1, borderColor: colors.line, borderRadius: 10 }, inlineStateText: { color: colors.inkSoft, fontSize: 10 }, inlineError: { alignItems: "flex-start", gap: 9, padding: 15, borderWidth: 1, borderColor: "rgba(255,103,136,0.34)", borderRadius: 9, backgroundColor: "rgba(255,103,136,0.07)" }, inlineErrorTitle: { color: colors.reported, fontSize: 12, fontWeight: "800" }, inlineErrorText: { color: colors.inkSoft, fontSize: 9, lineHeight: 15 }, notice: { padding: 12, borderWidth: 1, borderRadius: 8 }, noticeSafe: { borderColor: "rgba(67,231,173,0.30)", backgroundColor: "rgba(67,231,173,0.06)" }, noticeError: { borderColor: "rgba(255,103,136,0.30)", backgroundColor: "rgba(255,103,136,0.06)" }, noticeText: { fontSize: 9, lineHeight: 15 }, noticeSafeText: { color: "#93c9b7" }, noticeErrorText: { color: "#dda0ad" }, emptyText: { paddingVertical: 20, color: colors.inkDim, fontSize: 10, lineHeight: 16, textAlign: "center" },
  gateRoot: { alignItems: "center", justifyContent: "center", padding: 20 }, gateCard: { width: "100%", maxWidth: 560, alignItems: "center", gap: 13, padding: 32, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 15, backgroundColor: colors.panel }, gateLock: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 29, backgroundColor: "rgba(81,229,255,0.10)" }, gateLockText: { color: colors.cyan, fontSize: 29 }, gateTitle: { color: colors.ink, fontSize: 30, fontWeight: "800", letterSpacing: -1.1, textAlign: "center" }, gateText: { color: colors.inkSoft, fontSize: 11, lineHeight: 19, textAlign: "center" }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.42 },
});
