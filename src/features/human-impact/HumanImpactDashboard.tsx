import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { PressableStateCallbackType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import cusolUisLogo from "../../assets/cusol-uis-logo-enhanced.png";
import prometeoLogo from "../../assets/prometeo-logo-hd.png";
import {
  FadeInImage,
  RevealGroupContainer,
} from "../../components/FadeInImage";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { colors, contentMaxWidth, fontFamilies } from "../../theme";
import { font } from "../../typography";
import type { AuthenticatedAccount } from "../auth/types";
import { HumanitarianSearchPanel } from "../humanitarian-directory/HumanitarianSearchPanel";
import { MySpacePanel } from "../my-space/MySpacePanel";
import type {
  CommunityContributionDataSource,
  HumanitarianDirectoryDataSource,
} from "../humanitarian-directory/types";
import { HelpRequestProximityAlert } from "../help-requests/HelpRequestProximityAlert";
import { useActiveHelpRequests } from "../help-requests/useActiveHelpRequests";
import type { ActiveHelpRequest } from "../help-requests/types";
import { FoodOfferProximityAlert } from "../food-offers/FoodOfferProximityAlert";
import { useActiveFoodOffers } from "../food-offers/useActiveFoodOffers";
import { useActiveDamagedHomes } from "../damaged-homes/useActiveDamagedHomes";
import type { DamagedHomesDataSource } from "../damaged-homes/types";
import { damagedHomesDataSource as defaultDamagedHomesDataSource } from "../damaged-homes/dataSource";
import { useActiveTransports } from "../transports/useActiveTransports";
import { pickVolunteerPhoto } from "../help-requests/pickVolunteerPhoto";
import {
  useAccountNotifications,
  type AccountNotifications,
} from "../notifications/useAccountNotifications";
import type { HelpRequestsDataSource } from "../help-requests/types";
import type { FoodOffersDataSource } from "../food-offers/types";
import { ReportActions } from "../missing-persons/MissingPersonCommandCenter";
import { OperationalMapPanel } from "../operational-map/OperationalMapPanel";
import type { MapPointDetailPayload } from "../operational-map/pointDetail";
import {
  MapScrollLockProvider,
  useMapScrollLockController,
} from "../operational-map/mapScrollLock";
import type {
  HumanMapDataSource,
  OperationalMapDataSource,
} from "../operational-map/types";
import { DonutChart } from "./DonutChart";
import { RecentPeopleTable } from "./RecentPeopleTable";
import type {
  HumanImpactOverview,
  HumanImpactSummary,
  PeopleRecordsDataSource,
} from "./types";

interface HumanImpactDashboardProps {
  data: HumanImpactOverview;
  isDemo: boolean;
  stale: boolean;
  mapDataSource: OperationalMapDataSource;
  humanMapDataSource: HumanMapDataSource;
  peopleRecordsDataSource: PeopleRecordsDataSource;
  humanitarianDirectoryDataSource: HumanitarianDirectoryDataSource;
  communityContributionDataSource: CommunityContributionDataSource;
  // CHG-125: solicitudes «Necesitamos ayuda» vigentes.
  helpRequestsDataSource: HelpRequestsDataSource;
  // CHG-163: ofertas «Ofrecer comida» vigentes.
  foodOffersDataSource: FoodOffersDataSource;
  // CHG-182: inyectable en pruebas; por defecto, el feed real.
  damagedHomesDataSource?: DamagedHomesDataSource;
  onReportMissingPerson: () => void;
  onReportUnverifiedBuilding: () => void;
  onRegisterCollectionCenter: () => void;
  onRegisterDonationPoint: () => void;
  // CHG-153: acopio receptor y punto de distribución.
  onRegisterReceiverCenter: () => void;
  onRegisterDistributionPoint: () => void;
  // CHG-161/162: transportes y hogar en malas condiciones.
  onRegisterMuleTransport: () => void;
  onRegisterBoatTransport: () => void;
  onReportDamagedHome: () => void;
  onOfferCommunityMeals: () => void;
  onOfferTemporaryShelter: () => void;
  onRequestHelp: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onAbout: () => void;
  // CHG-139: navegación a la consola (solo la usa el super_admin).
  onOpenAdmin?: () => void;
  // CHG-193: «Ver más» de quién atiende la solicitud propia.
  onOpenAttenders?: (request: ActiveHelpRequest) => void;
  // CHG-091: deep link ?buscar= hacia el buscador del directorio.
  initialDirectorySearch?: string;
  // CHG-051: sesión activa visible en el encabezado, con cierre.
  account?: AuthenticatedAccount | null;
  onLogout?: () => void;
  // CHG-164: «VER MÁS» del popup de un marcador del mapa.
  onOpenMapPointDetail?: (payload: MapPointDetailPayload) => void;
}

const numberFormatter = new Intl.NumberFormat("es-CO");

export const PRIORITY_LAYOUT_BREAKPOINT = 1080;
// CHG-118: las tres suben 17 px, la caja de la leyenda del encabezado
// (14 de interlineado + 3 de separación). No son decorativas: de aquí
// sale el alto de la portada de entrada y el de la transmisión en
// vivo, así que una leyenda que crezca el encabezado sin avisar a
// estas constantes deja la portada sin caber en la pantalla.
export const DASHBOARD_HEADER_HEIGHT = 141;
export const DASHBOARD_STACKED_NAV_HEADER_HEIGHT = 183;
export const DASHBOARD_COMPACT_HEADER_HEIGHT = 177;
// CHG-123: el nombre visible de la plataforma es "Cusol Disaster App".
export const DASHBOARD_TOOL_TITLE = "CUSOL DISASTER APP";

// CHG-118: leyenda del encabezado, pedida por el usuario.
export const DASHBOARD_HEADER_MOTTO = "SOLO EL PUEBLO SALVA AL PUEBLO";
export const CUSOL_INSTAGRAM_URL = "https://www.instagram.com/cusol_uis/";
export const PROMETEO_INSTAGRAM_URL = "https://www.instagram.com/prometeo.uis/";

export function getBrandLinkScale({
  focused,
  hovered,
  pressed,
  reducedMotion,
}: {
  focused: boolean;
  hovered: boolean;
  pressed: boolean;
  reducedMotion: boolean;
}): number {
  if (reducedMotion) return 1;
  if (pressed) return 1.04;
  return hovered || focused ? 1.07 : 1;
}

export function shouldStackPriorityLayout(width: number): boolean {
  return width < PRIORITY_LAYOUT_BREAKPOINT;
}

export function shouldCenterEntryContent(width: number): boolean {
  return !shouldStackPriorityLayout(width);
}

export function getDashboardEntryMinHeight(
  viewportHeight: number,
  compact: boolean,
  stackedNavigation = compact,
): number {
  return Math.max(
    0,
    viewportHeight - getDashboardHeaderHeight(compact, stackedNavigation),
  );
}

export function getDashboardHeaderHeight(
  compact: boolean,
  stackedNavigation: boolean,
): number {
  return compact
    ? DASHBOARD_COMPACT_HEADER_HEIGHT
    : stackedNavigation
      ? DASHBOARD_STACKED_NAV_HEADER_HEIGHT
      : DASHBOARD_HEADER_HEIGHT;
}

// CHG-047: aire simétrico para que la transmisión en vivo no llegue
// borde a borde del viewport (la mitad arriba, la mitad abajo).
export const LIVE_RECORDS_VERTICAL_BREATHING = 56;

export function getLiveRecordsMinHeight(
  viewportHeight: number,
  headerHeight: number,
): number {
  return Math.max(
    0,
    viewportHeight - headerHeight - LIVE_RECORDS_VERTICAL_BREATHING,
  );
}

export function getSectionScrollDestination({
  currentScroll,
  headerHeight,
  pageY,
  spacingBelowHeader,
}: {
  currentScroll: number;
  headerHeight: number;
  pageY: number;
  spacingBelowHeader: number;
}): number {
  return Math.max(
    0,
    currentScroll + pageY - headerHeight - spacingBelowHeader,
  );
}

export function HumanImpactDashboard({
  data,
  isDemo,
  stale,
  mapDataSource,
  humanMapDataSource,
  peopleRecordsDataSource,
  humanitarianDirectoryDataSource,
  communityContributionDataSource,
  helpRequestsDataSource,
  foodOffersDataSource,
  damagedHomesDataSource = defaultDamagedHomesDataSource,
  initialDirectorySearch,
  onReportMissingPerson,
  onReportUnverifiedBuilding,
  onRegisterCollectionCenter,
  onRegisterDonationPoint,
  onRegisterReceiverCenter,
  onRegisterDistributionPoint,
  onRegisterMuleTransport,
  onRegisterBoatTransport,
  onReportDamagedHome,
  onOfferCommunityMeals,
  onOfferTemporaryShelter,
  onRequestHelp,
  onLogin,
  onRegister,
  onAbout,
  onOpenAdmin,
  onOpenAttenders,
  account = null,
  onLogout = () => undefined,
  onOpenMapPointDetail,
}: HumanImpactDashboardProps) {
  const { height, width } = useWindowDimensions();
  const tablet = shouldStackPriorityLayout(width);
  const compact = width < 760;
  const narrowHeader = width < 360;
  const stackedNavigation = width < 1120;
  const priorityStacked = tablet;
  const centerEntryContent = shouldCenterEntryContent(width);
  const entryMinHeight = getDashboardEntryMinHeight(
    height,
    compact,
    stackedNavigation,
  );
  const headerHeight = getDashboardHeaderHeight(compact, stackedNavigation);
  const liveRecordsMinHeight = getLiveRecordsMinHeight(height, headerHeight);
  const scrollRef = useRef<ScrollView>(null);
  // CHG-155: mientras un gesto nace en el mapa, la página no se
  // desplaza — el ScrollView vertical le robaba el paneo vertical.
  const { scrollEnabled, scrollLock } = useMapScrollLockController();
  // CHG-069: menú desplegable de la cuenta y panel "Mi espacio".
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mySpaceOpen, setMySpaceOpen] = useState(false);
  // CHG-149: contador rojo de notificaciones no atendidas (novedades en
  // los reportes propios + pendientes de la consola para super_admin).
  const isSuperAdmin = account?.assignedRole === "super_admin";
  const notifications = useAccountNotifications({
    account,
    isSuperAdmin: isSuperAdmin ?? false,
  });
  const mapRef = useRef<View>(null);
  const dataRef = useRef<View>(null);
  const liveRef = useRef<View>(null);
  const scrollPosition = useRef(0);
  // CHG-090 (QA): estado "activo" del menú según la sección visible.
  const sectionTops = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<
    "home" | "map" | "data" | "live"
  >("home");

  const registerSectionTop = (id: string) => (event: {
    nativeEvent: { layout: { y: number } };
  }) => {
    sectionTops.current[id] = event.nativeEvent.layout.y;
  };

  const resolveActiveSection = (offset: number) => {
    const anchor = offset + headerHeight + 80;
    const tops = sectionTops.current;
    let next: "home" | "map" | "data" | "live" = "home";
    (["map", "data", "live"] as const).forEach((id) => {
      if (tops[id] !== undefined && anchor >= tops[id]) {
        next = id;
      }
    });
    setActiveSection((current) => (current === next ? current : next));
  };
  const reducedMotion = useReducedMotion();

  const scrollToSection = (
    target: RefObject<View | null>,
    spacingBelowHeader = 16,
  ) => {
    target.current?.measure((_x, _y, _width, _height, _pageX, pageY) => {
      const destination = getSectionScrollDestination({
        currentScroll: scrollPosition.current,
        headerHeight,
        pageY,
        spacingBelowHeader,
      });
      scrollRef.current?.scrollTo({
        y: destination,
        animated: !reducedMotion,
      });
    });
  };

  const showMap = () => scrollToSection(mapRef);
  const showHome = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: !reducedMotion });
  };

  // CHG-125 / CHG-148: una sola consulta de solicitudes vigentes
  // alimenta el mapa (marcadores + contador del legend) y la alerta de
  // proximidad. La LISTA ya no vive en el inicio (está en el espacio
  // personal); la acción se abre desde el detalle del mapa: con cuenta
  // se atiende, sin cuenta se ofrece como voluntario.
  const { state: helpRequestsState, refresh: refreshHelpRequests } =
    useActiveHelpRequests(helpRequestsDataSource);
  // CHG-163: ofertas de comida vigentes, con el mismo pulso.
  const { state: foodOffersState } = useActiveFoodOffers(foodOffersDataSource);
  // CHG-182: casitas destruidas publicadas, con el mismo pulso.
  const { state: damagedHomesState } = useActiveDamagedHomes(
    damagedHomesDataSource,
  );
  // CHG-171: viajes de La Mulera/La Lanchera en curso, para el mapa.
  const transportsState = useActiveTransports();
  const helpRequestActions = useMemo(
    () => ({
      isAuthenticated: account !== null,
      attend: (id: string) => helpRequestsDataSource.attend(id),
      onAttended: refreshHelpRequests,
      onLogin,
      onRegister,
      pickPhoto: pickVolunteerPhoto,
      // CHG-195: el mapa necesita el mismo camino que «Mi espacio»
      // para llevar a la dueña a quiénes atienden su solicitud.
      onOpenAttenders,
    }),
    [
      account,
      helpRequestsDataSource,
      refreshHelpRequests,
      onLogin,
      onRegister,
      onOpenAttenders,
    ],
  );

  return (
    <MapScrollLockProvider value={scrollLock}>
    <LinearGradient
      colors={["#080b14", colors.canvas, "#080b14"]}
      locations={[0, 0.52, 1]}
      style={styles.root}
    >
      <View style={[styles.ambientGlowOne, styles.noPointerEvents]} />
      <View style={[styles.ambientGlowTwo, styles.noPointerEvents]} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <Header
          compact={compact}
          narrow={narrowHeader}
          stackedNavigation={stackedNavigation}
          activeSection={activeSection}
          onNavigateHome={showHome}
          onNavigateMap={showMap}
          onNavigateAbout={onAbout}
          onNavigateData={() => scrollToSection(dataRef)}
          onNavigateLive={() =>
            scrollToSection(liveRef, LIVE_RECORDS_VERTICAL_BREATHING / 2)
          }
          onLogin={onLogin}
          onRegister={onRegister}
          account={account}
          onLogout={onLogout}
          accountMenuOpen={accountMenuOpen}
          onToggleAccountMenu={() =>
            setAccountMenuOpen((current) => {
              // CHG-149: al abrir el menú se lee el mini-resumen; el
              // contador rojo se limpia.
              if (!current) {
                notifications.markRead();
              }
              return !current;
            })
          }
          onOpenMySpace={() => {
            setAccountMenuOpen(false);
            setMySpaceOpen(true);
          }}
          isSuperAdmin={isSuperAdmin ?? false}
          onOpenAdmin={
            onOpenAdmin
              ? () => {
                  setAccountMenuOpen(false);
                  onOpenAdmin();
                }
              : undefined
          }
          notifications={notifications}
        />
        <MySpacePanel
          visible={mySpaceOpen}
          onClose={() => setMySpaceOpen(false)}
          isSuperAdmin={account?.assignedRole === "super_admin"}
          onOpenAdmin={onOpenAdmin}
          onOpenAttenders={onOpenAttenders}
          // CHG-198: quien ya aceptó atender abre desde «Mi espacio» la
          // MISMA ficha que se abre tocando el marcador en el mapa.
          onOpenRequestDetail={
            onOpenMapPointDetail
              ? (request) =>
                  onOpenMapPointDetail({ kind: "help_request", request })
              : undefined
          }
          helpRequests={helpRequestsDataSource}
          foodOffers={foodOffersDataSource}
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          onScroll={(event) => {
            scrollPosition.current = event.nativeEvent.contentOffset.y;
            resolveActiveSection(scrollPosition.current);
          }}
          scrollEnabled={scrollEnabled}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View
            testID="dashboard-main-content"
            style={[styles.content, compact && styles.contentCompact]}
          >
            <View
              testID="dashboard-entry-hero"
              style={[
                styles.entryHero,
                compact && styles.entryHeroCompact,
                { minHeight: entryMinHeight },
              ]}
            >
              <View
                testID="dashboard-priority-layout"
                style={[
                  styles.priorityLayout,
                  centerEntryContent && styles.priorityLayoutViewport,
                  priorityStacked && styles.priorityLayoutStacked,
                ]}
              >
                <View
                  testID="situation-human-priority"
                  style={[
                    styles.priorityIntroColumn,
                    priorityStacked && styles.priorityStackedColumn,
                  ]}
                >
                  <SituationIntro
                    compact={compact}
                    narrow={narrowHeader}
                    stacked={priorityStacked}
                  />
                </View>

                <View
                  testID="person-search-priority"
                  style={[
                    styles.priorityActionsColumn,
                    priorityStacked && styles.priorityStackedColumn,
                  ]}
                >
                  <HumanitarianSearchPanel
                    compact={compact}
                    dataSource={humanitarianDirectoryDataSource}
                    contributionDataSource={communityContributionDataSource}
                    initialQuery={initialDirectorySearch}
                  />
                </View>
              </View>

              <ReportActions
                compact={compact}
                onReportMissingPerson={onReportMissingPerson}
                onReportUnverifiedBuilding={onReportUnverifiedBuilding}
                onRegisterCollectionCenter={onRegisterCollectionCenter}
                onRegisterDonationPoint={onRegisterDonationPoint}
                onRegisterReceiverCenter={onRegisterReceiverCenter}
                onRegisterDistributionPoint={onRegisterDistributionPoint}
                onRegisterMuleTransport={onRegisterMuleTransport}
                onRegisterBoatTransport={onRegisterBoatTransport}
                onReportDamagedHome={onReportDamagedHome}
                onOfferCommunityMeals={onOfferCommunityMeals}
                onOfferTemporaryShelter={onOfferTemporaryShelter}
                onRequestHelp={onRequestHelp}
              />

              <ScrollContinuationCue onPress={showMap} />
            </View>

            {/* CHG-131: aviso de proximidad — en la app instalada, si
                este dispositivo está dentro del radio de aviso de una
                solicitud activa, el banner de emergencia aparece antes
                que todo lo demás. Sin aviso no monta nada. */}
            <HelpRequestProximityAlert
              items={helpRequestsState.items}
              style={styles.fullWidth}
            />

            {/* CHG-163: mismo aviso de proximidad para las ofertas de
                comida con radio, con el acento de su categoría. */}
            <FoodOfferProximityAlert
              items={foodOffersState.items}
              style={styles.fullWidth}
            />

            <View
              ref={mapRef}
              onLayout={registerSectionTop("map")}
              testID="dashboard-operational-map"
              style={styles.fullWidth}
            >
              <OperationalMapPanel
                dataSource={mapDataSource}
                humanDataSource={humanMapDataSource}
                compact={compact}
                helpRequests={helpRequestsState.items}
                helpRequestActions={helpRequestActions}
                foodOffers={foodOffersState.items}
                damagedHomes={damagedHomesState.items}
                transports={transportsState.items}
                onOpenPointDetail={onOpenMapPointDetail}
              />
            </View>

            {/* CHG-148: la LISTA de solicitudes ya no vive en el
                inicio; se ve en el espacio personal (solo con cuenta).
                En el dashboard quedan la alerta de proximidad y el
                contador «Necesitamos ayuda» del legend del mapa. Tocar
                una solicitud en el mapa abre su detalle con la acción
                de voluntario. */}

            {stale && (
              <View style={[styles.notice, styles.staleNotice]} accessibilityRole="alert">
                <Text style={styles.staleNoticeText}>
                  No fue posible actualizar los datos. Se conserva el último reporte disponible.
                </Text>
              </View>
            )}

            <View
              ref={dataRef}
              onLayout={registerSectionTop("data")}
              testID="dashboard-data-and-figures"
              style={styles.dataSection}
            >
              <SummaryCards
                summary={data.summary}
                tablet={tablet}
                compact={compact}
                isDemo={isDemo}
              />

              <View
                testID="human-impact-distribution-panel"
                style={[styles.analysis, tablet && styles.analysisTablet]}
              >
                <Text style={styles.panelCode}>MODULE / DISTRIBUTION</Text>
                <View style={[styles.analysisCopy, tablet && styles.analysisCopyTablet]}>
                  <Text style={styles.eyebrow}>DISTRIBUCIÓN GENERAL</Text>
                  <Text style={styles.sectionTitle} accessibilityRole="header">
                    Estado de las personas
                  </Text>
                  <Text style={styles.bodyCopy}>
                    Relación proporcional entre los cuatro estados registrados en la plataforma.
                  </Text>
                </View>
                <DonutChart summary={data.summary} />
              </View>
            </View>

            <View
              ref={liveRef}
              onLayout={registerSectionTop("live")}
              testID="dashboard-live-transmission"
              style={[
                styles.liveSection,
                {
                  minHeight: liveRecordsMinHeight,
                  marginVertical: LIVE_RECORDS_VERTICAL_BREATHING / 2,
                },
              ]}
            >
              {/* CHG-148: la lista «Solicitudes de ayuda en curso» se
                  retiró de la transmisión en vivo; vive en el espacio
                  personal (solo con cuenta). */}
              <RecentPeopleTable
                dataSource={peopleRecordsDataSource}
                viewportMinHeight={liveRecordsMinHeight}
              />
            </View>
          </View>

          <PlatformFooter
            compact={compact}
            onNavigateAbout={onAbout}
            onNavigateData={() => scrollToSection(dataRef)}
            onNavigateLive={() =>
              scrollToSection(liveRef, LIVE_RECORDS_VERTICAL_BREATHING / 2)
            }
            onNavigateMap={showMap}
          />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
    </MapScrollLockProvider>
  );
}

function PlatformFooter({
  compact,
  onNavigateAbout,
  onNavigateData,
  onNavigateLive,
  onNavigateMap,
}: {
  compact: boolean;
  onNavigateAbout: () => void;
  onNavigateData: () => void;
  onNavigateLive: () => void;
  onNavigateMap: () => void;
}) {
  return (
    <View
      testID="platform-footer"
      accessibilityLabel="Información institucional y navegación de cierre"
      style={[styles.footerShell, compact && styles.footerShellCompact]}
    >
      <View style={[styles.footerInner, compact && styles.footerInnerCompact]}>
        <View style={[styles.footerMain, compact && styles.footerMainCompact]}>
          <View style={styles.footerIdentity}>
            <Text style={styles.footerEyebrow}>CENTRO DIGITAL DE AYUDA Y MONITOREO</Text>
            <Text style={styles.footerTitle}>CUSOL DISASTER APP</Text>
            <Text style={styles.footerDescription}>
              Información pública y trazable para localizar personas, coordinar ayudas y
              comprender la respuesta humanitaria ante emergencias y desastres.
            </Text>
            <Text style={styles.footerAlliance}>
              CUSOL UIS · GRUPO PROMETEO · UNIVERSIDAD INDUSTRIAL DE SANTANDER
            </Text>
          </View>

          <View style={[styles.footerNavigation, compact && styles.footerNavigationCompact]}>
            <FooterColumn title="EXPLORAR">
              <FooterLink label="Mapa operativo" onPress={onNavigateMap} />
              <FooterLink label="Cifras y datos" onPress={onNavigateData} />
              <FooterLink label="Transmisión en vivo" onPress={onNavigateLive} />
              <FooterLink label="Quiénes somos" onPress={onNavigateAbout} />
            </FooterColumn>
            <FooterColumn title="COMUNIDAD">
              <FooterLink
                external
                label="CUSOL en Instagram ↗"
                onPress={() => void Linking.openURL(CUSOL_INSTAGRAM_URL)}
              />
              <FooterLink
                external
                label="Prometeo en Instagram ↗"
                onPress={() => void Linking.openURL(PROMETEO_INSTAGRAM_URL)}
              />
            </FooterColumn>
          </View>
        </View>

        <View style={[styles.footerNotice, compact && styles.footerNoticeCompact]}>
          <Text style={styles.footerNoticeLabel}>USO RESPONSABLE</Text>
          <Text style={styles.footerNoticeText}>
            Verifica la fuente, la fecha y el estado antes de actuar. Esta plataforma no
            reemplaza los canales oficiales de atención de emergencias.
          </Text>
        </View>

        <View style={[styles.footerBottom, compact && styles.footerBottomCompact]}>
          <Text style={styles.footerMeta}>© 2026 CUSOL · PROMETEO · UIS</Text>
          <Text style={styles.footerMeta}>COLOMBIA · INFORMACIÓN PÚBLICA</Text>
        </View>
      </View>
    </View>
  );
}

function FooterColumn({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.footerColumn}>
      <Text style={styles.footerColumnTitle}>{title}</Text>
      <View style={styles.footerLinks}>{children}</View>
    </View>
  );
}

function FooterLink({
  external = false,
  label,
  onPress,
}: {
  external?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={external ? "Abre un sitio externo" : "Navega dentro de la plataforma"}
      onPress={onPress}
      style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}
    >
      <Text style={styles.footerLinkText}>{label}</Text>
    </Pressable>
  );
}

// CHG-097: el encabezado de la plataforma se exporta para que las
// rutas internas (formularios de reporte) monten el mismo navbar y no
// aparezcan como una pantalla suelta sin identidad.
export function Header({
  compact,
  narrow,
  stackedNavigation,
  activeSection,
  onNavigateHome,
  onNavigateMap,
  onNavigateAbout,
  onNavigateData,
  onNavigateLive,
  onLogin,
  onRegister,
  account,
  onLogout,
  accountMenuOpen,
  onToggleAccountMenu,
  onOpenMySpace,
  isSuperAdmin = false,
  onOpenAdmin,
  notifications,
}: {
  compact: boolean;
  narrow: boolean;
  stackedNavigation: boolean;
  activeSection: "home" | "map" | "data" | "live";
  onNavigateHome: () => void;
  onNavigateMap: () => void;
  onNavigateAbout: () => void;
  onNavigateData: () => void;
  onNavigateLive: () => void;
  onLogin: () => void;
  onRegister: () => void;
  account: AuthenticatedAccount | null;
  onLogout: () => void;
  accountMenuOpen: boolean;
  onToggleAccountMenu: () => void;
  onOpenMySpace: () => void;
  // CHG-149: acceso al dashboard admin (super_admin) y contador rojo.
  isSuperAdmin?: boolean;
  onOpenAdmin?: () => void;
  notifications?: AccountNotifications;
}) {
  const reducedMotion = useReducedMotion();
  // CHG-090 (QA): en pantallas angostas la navegación vive en un menú
  // hamburguesa desplegable en lugar del scroll horizontal.
  const [menuOpen, setMenuOpen] = useState(false);
  const navigateAnd = (navigate: () => void) => () => {
    setMenuOpen(false);
    navigate();
  };

  return (
    <View style={styles.headerShell}>
      <View
        style={[
          styles.header,
          stackedNavigation && styles.headerStackedNavigation,
          compact && styles.headerCompact,
          narrow && styles.headerNarrow,
        ]}
      >
        <View
          testID="header-primary-row"
          style={[
            styles.headerPrimary,
            stackedNavigation && styles.headerPrimaryStacked,
            compact && styles.headerPrimaryCompact,
            narrow && styles.headerPrimaryNarrow,
          ]}
        >
          <View
            testID="brand-lockup"
            style={styles.brand}
          >
            <View
              testID="brand-logo-frame"
              style={[
                styles.brandLogoFrame,
                compact && styles.brandLogoFrameCompact,
                narrow && styles.brandLogoFrameNarrow,
              ]}
            >
              {/* CHG-070: los círculos completos entran deslizándose
                  junto con los logos, no solo la imagen interior. */}
              <RevealGroupContainer
                group="header-brand-logos"
                slideFrom="left"
                style={[styles.brandLogos, narrow && styles.brandLogosNarrow]}
              >
                <BrandLink
                  testID="cusol-brand-link"
                  accessibilityLabel="CUSOL UIS en Instagram"
                  url={CUSOL_INSTAGRAM_URL}
                  reducedMotion={reducedMotion}
                >
                  <BrandIcon compact={compact} narrow={narrow} />
                </BrandLink>
                <BrandLink
                  testID="prometeo-brand-link"
                  accessibilityLabel="Prometeo UIS en Instagram"
                  url={PROMETEO_INSTAGRAM_URL}
                  reducedMotion={reducedMotion}
                >
                  <PrometeoIcon compact={compact} narrow={narrow} />
                </BrandLink>
              </RevealGroupContainer>
            </View>
            <Text
              style={[
                styles.brandToolTitle,
                compact && styles.brandToolTitleCompact,
                narrow && styles.brandToolTitleNarrow,
              ]}
            >
              {DASHBOARD_TOOL_TITLE}
            </Text>
            {/* CHG-118: leyenda del encabezado. Se lee (font(11), el
                piso de legibilidad de la portada) y va apagada para
                acompañar sin competir con la navegación. */}
            <Text
              style={[
                styles.brandMotto,
                narrow && styles.brandMottoNarrow,
              ]}
            >
              {DASHBOARD_HEADER_MOTTO}
            </Text>
          </View>

          {!stackedNavigation && (
            <HeaderNavigation
              activeSection={activeSection}
              onNavigateHome={onNavigateHome}
              onNavigateMap={onNavigateMap}
              onNavigateAbout={onNavigateAbout}
              onNavigateData={onNavigateData}
              onNavigateLive={onNavigateLive}
            />
          )}

          {stackedNavigation && (
            <Pressable
              testID="header-menu-toggle"
              accessibilityRole="button"
              accessibilityLabel={
                menuOpen
                  ? "Cerrar menú de navegación"
                  : "Abrir menú de navegación"
              }
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((current) => !current)}
              style={({ pressed }) => [
                styles.menuToggle,
                pressed && styles.authButtonPressed,
              ]}
            >
              <Text style={styles.menuToggleIcon}>
                {menuOpen ? "✕" : "☰"}
              </Text>
            </Pressable>
          )}
          <View
            testID="header-auth-actions"
            style={[
              styles.authActions,
              compact && styles.authActionsCompact,
              narrow && styles.authActionsNarrow,
            ]}
          >
            {account ? (
              // CHG-051: con sesión activa el encabezado muestra la
              // cuenta y permite cerrarla. CHG-069: el chip despliega
              // "Mi espacio" debajo del nombre.
              <>
                <View style={styles.sessionChipHolder}>
                  <Pressable
                    testID="session-account-chip"
                    accessibilityRole="button"
                    accessibilityLabel={
                      notifications?.unread
                        ? `Sesión activa de ${account.displayName}. ${notifications.count} notificaciones sin atender. Abrir menú de cuenta`
                        : `Sesión activa de ${account.displayName}. Abrir menú de cuenta`
                    }
                    onPress={onToggleAccountMenu}
                    style={[
                      styles.sessionChip,
                      narrow && styles.sessionChipNarrow,
                    ]}
                  >
                    <View style={styles.sessionDot} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.sessionChipText,
                        narrow && styles.authButtonTextNarrow,
                      ]}
                    >
                      {account.displayName.toLocaleUpperCase("es-CO")}
                    </Text>
                    <Text style={styles.sessionChipCaret}>
                      {accountMenuOpen ? "▴" : "▾"}
                    </Text>
                  </Pressable>
                  {/* CHG-149: contador rojo sobre el nombre cuando hay
                      notificaciones nuevas sin atender. */}
                  {notifications?.unread && notifications.count > 0 && (
                    <View
                      pointerEvents="none"
                      testID="notifications-badge"
                      style={styles.notificationsBadge}
                    >
                      <Text style={styles.notificationsBadgeText}>
                        {notifications.count > 99 ? "99+" : notifications.count}
                      </Text>
                    </View>
                  )}
                  {accountMenuOpen && (
                    <View
                      testID="session-account-menu"
                      style={styles.sessionMenu}
                    >
                      {/* CHG-149: mini-resumen de lo que hay sin atender. */}
                      {notifications && notifications.count > 0 && (
                        <View style={styles.sessionMenuSummary}>
                          {notifications.adminPending > 0 && (
                            <Text style={styles.sessionMenuSummaryText}>
                              {notifications.adminPending} por revisar en la
                              consola
                            </Text>
                          )}
                          {notifications.ownNovelties > 0 && (
                            <Text style={styles.sessionMenuSummaryText}>
                              {notifications.ownNovelties} novedad
                              {notifications.ownNovelties === 1 ? "" : "es"} en
                              tus reportes
                            </Text>
                          )}
                        </View>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Abrir Mi espacio"
                        onPress={onOpenMySpace}
                        style={({ pressed }) => [
                          styles.sessionMenuItem,
                          pressed && styles.authButtonPressed,
                        ]}
                      >
                        <Text style={styles.sessionMenuItemText}>
                          MI ESPACIO
                        </Text>
                      </Pressable>
                      {/* CHG-149: acceso al dashboard admin, bajo Mi
                          espacio, solo para super_admin. */}
                      {isSuperAdmin && onOpenAdmin && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Abrir el dashboard de administración"
                          onPress={onOpenAdmin}
                          style={({ pressed }) => [
                            styles.sessionMenuItem,
                            pressed && styles.authButtonPressed,
                          ]}
                        >
                          <Text style={styles.sessionMenuItemText}>
                            DASHBOARD ADMIN
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar sesión"
                  onPress={onLogout}
                  style={({ pressed }) => [
                    styles.loginButton,
                    compact && styles.authButtonCompact,
                    narrow && styles.authButtonNarrow,
                    pressed && styles.authButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.loginButtonText,
                      narrow && styles.authButtonTextNarrow,
                    ]}
                  >
                    CERRAR SESIÓN
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Iniciar sesión"
                  onPress={onLogin}
                  style={({ pressed }) => [
                    styles.loginButton,
                    compact && styles.authButtonCompact,
                    narrow && styles.authButtonNarrow,
                    pressed && styles.authButtonPressed,
                  ]}
                >
                  <Text style={[styles.loginButtonText, narrow && styles.authButtonTextNarrow]}>
                    INICIAR SESIÓN
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Registrarse"
                  onPress={onRegister}
                  style={({ pressed }) => [
                    styles.registerButton,
                    compact && styles.authButtonCompact,
                    narrow && styles.authButtonNarrow,
                    pressed && styles.authButtonPressed,
                  ]}
                >
                  <Text style={[styles.registerButtonText, narrow && styles.authButtonTextNarrow]}>
                    REGISTRARSE
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {stackedNavigation && menuOpen && (
          <View testID="header-menu-panel" style={styles.menuPanel}>
            <HeaderNavigation
              stacked
              activeSection={activeSection}
              onNavigateHome={navigateAnd(onNavigateHome)}
              onNavigateMap={navigateAnd(onNavigateMap)}
              onNavigateAbout={navigateAnd(onNavigateAbout)}
              onNavigateData={navigateAnd(onNavigateData)}
              onNavigateLive={navigateAnd(onNavigateLive)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function HeaderNavigation({
  stacked = false,
  activeSection,
  onNavigateHome,
  onNavigateMap,
  onNavigateAbout,
  onNavigateData,
  onNavigateLive,
}: {
  stacked?: boolean;
  activeSection: "home" | "map" | "data" | "live";
  onNavigateHome: () => void;
  onNavigateMap: () => void;
  onNavigateAbout: () => void;
  onNavigateData: () => void;
  onNavigateLive: () => void;
}) {
  // CHG-090 (QA): Inicio explícito primero, herramientas de acción en
  // el medio y "Quiénes somos" al final.
  const items = [
    { id: "home", label: "INICIO", hint: "Vuelve al comienzo de la portada", onPress: onNavigateHome, active: activeSection === "home" },
    { id: "map", label: "VER MAPA", hint: "Baja al mapa operativo", onPress: onNavigateMap, active: activeSection === "map" },
    { id: "data", label: "CIFRAS Y DATOS", hint: "Baja al resumen de cifras", onPress: onNavigateData, active: activeSection === "data" },
    { id: "live", label: "TRANSMISIÓN EN VIVO", hint: "Baja a las personas agregadas recientemente", onPress: onNavigateLive, active: activeSection === "live" },
    { id: "about", label: "QUIÉNES SOMOS", hint: "Abre la página institucional", onPress: onNavigateAbout, active: false },
  ];

  return (
    <View
      testID="header-navigation"
      accessibilityRole="toolbar"
      accessibilityLabel="Navegación principal"
      style={[styles.headerNavigation, stacked && styles.headerNavigationStacked]}
    >
      {items.map((item) => (
        <HeaderNavigationLink key={item.label} stacked={stacked} {...item} />
      ))}
    </View>
  );
}

function HeaderNavigationLink({
  active = false,
  hint,
  id,
  label,
  onPress,
  stacked,
}: {
  active?: boolean;
  hint: string;
  id: string;
  label: string;
  onPress: () => void;
  stacked: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID={`header-navigation-${id}`}
      accessibilityRole="link"
      accessibilityLabel={label.toLocaleLowerCase("es-CO")}
      accessibilityHint={hint}
      accessibilityState={{ selected: active }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({
        hovered,
        pressed,
      }: PressableStateCallbackType & { hovered?: boolean }) => [
        styles.headerNavigationLink,
        (focused || hovered) && styles.headerNavigationLinkInteractive,
        active && styles.headerNavigationLinkActive,
        pressed && styles.headerNavigationLinkPressed,
      ]}
    >
      <Text
        style={[
          styles.headerNavigationText,
          !stacked && styles.headerNavigationTextDesktop,
          active && styles.headerNavigationTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ScrollContinuationCue({ onPress }: { onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;

    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, contentMaxWidth],
  });

  return (
    <Pressable
      testID="dashboard-scroll-cue"
      accessibilityRole="button"
      accessibilityLabel="Ver más contenido"
      accessibilityHint="Baja hasta el mapa y los demás módulos"
      onPress={onPress}
      style={({ pressed }) => [
        styles.scrollCue,
        pressed && styles.scrollCuePressed,
      ]}
    >
      <View style={styles.scrollCueRail} accessibilityElementsHidden>
        <Animated.View
          testID="dashboard-scroll-cue-scan"
          style={[
            styles.scrollCueScan,
            reducedMotion
              ? styles.scrollCueScanReduced
              : { transform: [{ translateX }] },
          ]}
        />
      </View>
      <View style={styles.scrollCueLabelRow}>
        <Text style={styles.scrollCueLabel}>VER MÁS</Text>
        <Text style={styles.scrollCueArrow}>↓</Text>
      </View>
    </Pressable>
  );
}

function SituationIntro({
  compact,
  narrow,
  stacked,
}: {
  compact: boolean;
  narrow: boolean;
  stacked: boolean;
}) {
  const missionTitleStyle = [
    styles.heroTitle,
    !stacked && styles.heroTitleMissionWide,
    compact && styles.heroTitleMissionCompact,
    narrow && styles.heroTitleMissionNarrow,
  ];

  return (
    <View style={[styles.hero, styles.situationIntro, compact && styles.heroCompact]}>
      <View style={styles.heroCopy}>
        <View style={styles.signalLabel}>
          <View style={styles.signalLine} />
          <Text
            testID="dashboard-signal-label"
            style={[styles.signalText, narrow && styles.signalTextNarrow]}
          >
            CENTRO DIGITAL DE AYUDA Y MONITOREO
          </Text>
        </View>
        <Text style={missionTitleStyle} accessibilityRole="header">
          Misión
        </Text>
        <Text style={[missionTitleStyle, styles.heroTitleAccent]}>
          Humanitaria
        </Text>
        <Text style={styles.heroDescription}>
          Unimos datos verificables y reportes ciudadanos para localizar personas,
          coordinar ayudas y monitorear la respuesta humanitaria ante emergencias y
          desastres.
        </Text>
        <View style={styles.tags}>
          <Tag label="COL / NACIONAL" />
          <Tag label="LECTURA CONSOLIDADA" />
          <Tag label="MONITOREO ACTIVO" active />
        </View>
      </View>
    </View>
  );
}

function Tag({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.tag, active && styles.tagActive]}>
      <Text style={[styles.tagText, active && styles.tagTextActive]}>{label}</Text>
    </View>
  );
}

function SummaryCards({
  summary,
  tablet,
  compact,
  isDemo,
}: {
  summary: HumanImpactSummary;
  tablet: boolean;
  compact: boolean;
  isDemo: boolean;
}) {
  const secondaryCards = [
    {
      key: "reported",
      label: "Muertos reportados",
      note: "Pendientes de confirmación",
      value: summary.reportedDeceased,
      color: colors.reported,
    },
    {
      key: "alive",
      label: "Confirmados vivos",
      note: "Verificación completada",
      value: summary.confirmedAlive,
      color: colors.alive,
    },
    {
      key: "deceased",
      label: "Muertos confirmados",
      note: "Verificación completada",
      value: summary.confirmedDeceased,
      color: colors.deceased,
    },
  ];

  return (
    <View
      testID="human-impact-summary"
      style={[styles.summary, tablet && styles.summaryTablet]}
      accessibilityLabel="Resumen de situación humana"
    >
      <LinearGradient
        colors={["#171d2b", "#0a0f1a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryMetric, tablet && styles.primaryMetricTablet]}
      >
        <View style={styles.metricHeader}>
          <View style={styles.metricIcon}><MissingIcon /></View>
          <Text style={styles.metricHeaderText}>INDICADOR PRINCIPAL · PRIORIDAD 01</Text>
        </View>
        <View style={styles.primaryMetricCopy}>
          <View style={styles.metricCodeRow}>
            <Text style={[styles.metricCode, styles.metricCodeInline]}>MISSING / ACTIVE</Text>
            {isDemo && <Text style={styles.testScenarioLabel}>ESCENARIO DE PRUEBA</Text>}
          </View>
          <Text style={[styles.primaryValue, compact && styles.primaryValueCompact]}>
            {numberFormatter.format(summary.missing)}
          </Text>
          <Text style={styles.primaryLabel} accessible accessibilityRole="header">
            Desaparecidos
          </Text>
          <Text style={styles.primaryDescription}>
            Personas cuya ubicación aún no ha sido confirmada.
          </Text>
        </View>
        <SignalBars />
      </LinearGradient>

      <View
        style={[
          styles.secondaryMetrics,
          tablet && styles.secondaryMetricsTablet,
          compact && styles.secondaryMetricsCompact,
        ]}
      >
        {secondaryCards.map((card) => (
          <View key={card.key} style={styles.secondaryMetric}>
            <View style={[styles.metricAccent, { backgroundColor: card.color }]} />
            <Text style={[styles.secondaryCode, { color: card.color }]}>STATUS / {card.key.toUpperCase()}</Text>
            <Text style={styles.secondaryLabel}>{card.label}</Text>
            <Text style={styles.secondaryValue}>{numberFormatter.format(card.value)}</Text>
            <Text style={styles.secondaryNote}>{card.note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SignalBars() {
  return (
    <View style={styles.signalBars} accessibilityElementsHidden>
      {[18, 35, 58, 28, 72, 43, 86, 34, 60, 96, 41, 68].map((height, index) => (
        <View key={`${height}-${index}`} style={[styles.signalBar, { height }]} />
      ))}
    </View>
  );
}

function BrandLink({
  accessibilityLabel,
  children,
  reducedMotion,
  testID,
  url,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  reducedMotion: boolean;
  testID: string;
  url: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const targetScale = getBrandLinkScale({
    focused,
    hovered,
    pressed,
    reducedMotion,
  });

  useEffect(() => {
    scale.stopAnimation();
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }

    const animation = Animated.timing(scale, {
      toValue: targetScale,
      duration: targetScale === 1 ? 120 : 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, scale, targetScale]);

  return (
    <Animated.View
      testID={`${testID}-motion`}
      style={[styles.brandLinkMotion, { transform: [{ scale }] }]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Abre el perfil de Instagram en una aplicación externa"
        hitSlop={4}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={() => {
          void Linking.openURL(url);
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={({ pressed: isPressed }) => [
          styles.brandLink,
          isPressed && styles.brandLinkPressed,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function BrandIcon({ compact, narrow }: { compact: boolean; narrow: boolean }) {
  return (
    <FadeInImage
      testID="cusol-brand-logo"
      // CHG-068/070: ambos logos y sus círculos aparecen a la vez; el
      // movimiento lo pone el contenedor del grupo.
      group="header-brand-logos"
      revealMode="signal"
      source={cusolUisLogo}
      resizeMode="contain"
      style={[
        styles.brandLogo,
        compact && styles.brandLogoCompact,
        narrow && styles.brandLogoNarrow,
      ]}
      accessible={false}
    />
  );
}

function PrometeoIcon({ compact, narrow }: { compact: boolean; narrow: boolean }) {
  return (
    <View
      testID="prometeo-brand-circle"
      style={[
        styles.prometeoCircle,
        compact && styles.prometeoCircleCompact,
        narrow && styles.prometeoCircleNarrow,
      ]}
    >
      <FadeInImage
        testID="prometeo-brand-logo"
        group="header-brand-logos"
        revealMode="signal"
        accessibilityIgnoresInvertColors
        source={prometeoLogo}
        resizeMode="contain"
        style={styles.prometeoLogo}
      />
    </View>
  );
}

function MissingIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="3.5" fill="none" stroke={colors.missing} strokeWidth={1.4} />
      <Path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6M19 4v5M16.5 6.5h5" fill="none" stroke={colors.missing} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 700 },
  noPointerEvents: { pointerEvents: "none" },
  safeArea: { flex: 1 },
  ambientGlowOne: {
    position: "absolute", top: 320, left: -260, width: 520, height: 520,
    borderRadius: 260, backgroundColor: "rgba(77, 78, 224, 0.07)",
  },
  ambientGlowTwo: {
    position: "absolute", top: 1120, right: -280, width: 560, height: 560,
    borderRadius: 280, backgroundColor: "rgba(25, 194, 170, 0.06)",
  },
  headerShell: {
    zIndex: 10, borderBottomWidth: 1, borderBottomColor: colors.line,
    backgroundColor: "rgba(5, 8, 16, 0.96)",
  },
  header: {
    width: "100%", maxWidth: contentMaxWidth, minHeight: DASHBOARD_HEADER_HEIGHT, alignSelf: "center",
    justifyContent: "center", paddingHorizontal: 24, paddingVertical: 10,
  },
  headerStackedNavigation: { minHeight: DASHBOARD_STACKED_NAV_HEADER_HEIGHT, gap: 8 },
  headerCompact: { minHeight: DASHBOARD_COMPACT_HEADER_HEIGHT, paddingHorizontal: 10, paddingVertical: 9 },
  headerNarrow: { paddingHorizontal: 6 },
  headerPrimary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  headerPrimaryStacked: { gap: 12 },
  // CHG-122: en compacto la fila envuelve para que los accesos de
  // sesión bajen completos a su propia fila en vez de recortarse
  // fuera de la pantalla por la derecha.
  headerPrimaryCompact: { gap: 8, flexWrap: "wrap" },
  headerPrimaryNarrow: { gap: 4 },
  brand: { flexShrink: 0, alignItems: "center", justifyContent: "center" },
  brandLogoFrame: {
    borderWidth: 1,
    borderColor: "rgba(170, 188, 209, 0.48)",
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(8, 13, 22, 0.72)",
  },
  brandLogoFrameCompact: { borderRadius: 16, paddingHorizontal: 7, paddingVertical: 5 },
  brandLogoFrameNarrow: { borderRadius: 14, paddingHorizontal: 6, paddingVertical: 4 },
  brandLogos: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandLogosNarrow: { gap: 8 },
  brandLinkMotion: { borderRadius: 999 },
  brandLink: { borderRadius: 999 },
  brandLinkPressed: { opacity: 0.86 },
  brandLogo: { width: 68, height: 68 },
  brandLogoCompact: { width: 60, height: 60 },
  brandLogoNarrow: { width: 52, height: 52 },
  prometeoCircle: { width: 68, height: 68, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", borderRadius: 34, backgroundColor: "#ffffff" },
  prometeoCircleCompact: { width: 60, height: 60, borderRadius: 30 },
  prometeoCircleNarrow: { width: 52, height: 52, borderRadius: 26 },
  prometeoLogo: { width: "100%", height: "100%" },
  brandToolTitle: { marginTop: 7, color: colors.ink, fontFamily: fontFamilies.mono, fontSize: 7.5, fontWeight: "900", letterSpacing: 1.8, lineHeight: 10, textAlign: "center" },
  brandToolTitleCompact: { marginTop: 6, fontSize: 6.5, letterSpacing: 1.35, lineHeight: 9 },
  brandToolTitleNarrow: { marginTop: 5, fontSize: 5.5, letterSpacing: 0.8, lineHeight: 7 },
  brandMotto: { marginTop: 3, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 0.6, lineHeight: 14, textAlign: "center" },
  brandMottoNarrow: { letterSpacing: 0.2 },
  headerNavigation: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerNavigationStacked: {
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 4,
  },
  // CHG-090 (QA): estado activo del enlace de navegación.
  headerNavigationLinkActive: {
    borderColor: "rgba(81,229,255,0.55)",
    backgroundColor: "rgba(81,229,255,0.10)",
  },
  headerNavigationTextActive: { color: colors.cyan },
  // CHG-090 (QA): menú hamburguesa en pantallas angostas.
  menuToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 8,
    backgroundColor: "rgba(81,229,255,0.04)",
  },
  menuToggleIcon: { color: colors.cyan, fontSize: 18, lineHeight: 22 },
  menuPanel: {
    width: "100%",
    paddingHorizontal: 4,
    paddingBottom: 10,
    gap: 4,
  },
  headerNavigationScroll: { width: "100%", flexGrow: 0 },
  headerNavigationScrollContent: {
    minWidth: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerNavigationLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 8,
    backgroundColor: "rgba(81, 229, 255, 0.025)",
  },
  headerNavigationLinkPressed: {
    borderColor: colors.lineStrong,
    backgroundColor: "rgba(81, 229, 255, 0.10)",
    transform: [{ translateY: 1 }],
  },
  headerNavigationLinkInteractive: {
    borderColor: "rgba(81, 229, 255, 0.24)",
    backgroundColor: "rgba(81, 229, 255, 0.07)",
  },
  headerNavigationText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.75,
  },
  headerNavigationTextDesktop: { fontSize: 11, letterSpacing: 0.85 },
  authActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 9 },
  // CHG-122: el bloque puede crecer para ocupar la fila envuelta
  // entera manteniendo los botones alineados a la derecha.
  authActionsCompact: { gap: 6, flexGrow: 1, justifyContent: "flex-end" },
  authActionsNarrow: { gap: 4 },
  // CHG-051: chip de sesión activa en el encabezado.
  sessionChipHolder: {
    position: "relative",
    zIndex: 30,
  },
  // CHG-149: contador rojo de notificaciones, sobre el nombre.
  notificationsBadge: {
    position: "absolute",
    top: -8,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.emergency,
    borderWidth: 1,
    borderColor: colors.canvas,
    zIndex: 40,
  },
  notificationsBadgeText: {
    color: "#ffffff",
    fontFamily: fontFamilies.mono,
    // CHG-108: el piso legible se respeta con font().
    fontSize: font(9),
    fontWeight: "900",
  },
  sessionMenuSummary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(255,77,94,0.06)",
  },
  sessionMenuSummaryText: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 16,
  },
  sessionMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  sessionMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sessionMenuItemText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sessionChipCaret: {
    color: colors.inkSoft,
    fontSize: 11,
    marginLeft: 2,
  },
  sessionChip: {
    maxWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(67,231,173,0.34)",
    borderRadius: 8,
    backgroundColor: "rgba(67,231,173,0.08)",
  },
  sessionChipNarrow: { maxWidth: 130, paddingHorizontal: 8 },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.alive,
  },
  sessionChipText: {
    flexShrink: 1,
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  loginButton: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 15, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 7, backgroundColor: "rgba(81,229,255,0.04)" },
  registerButton: { minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: colors.cyan, borderRadius: 7, backgroundColor: colors.cyan },
  // CHG-090 (QA): área táctil mínima de 44dp también en móvil.
  authButtonCompact: { minHeight: 44, paddingHorizontal: 12 },
  authButtonNarrow: { minHeight: 44, paddingHorizontal: 9 },
  authButtonPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  loginButtonText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "800", letterSpacing: 0.7 },
  registerButtonText: { color: "#06101a", fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "900", letterSpacing: 0.7 },
  authButtonTextNarrow: { fontSize: font(11), letterSpacing: 0.35 },
  scrollContent: { flexGrow: 1 },
  content: { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", gap: 16, paddingHorizontal: 24 },
  // CHG-090 (QA): padding lateral consistente en móvil.
  contentCompact: { paddingHorizontal: 20 },
  dataSection: { width: "100%", gap: 16 },
  entryHero: {
    width: "100%",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  entryHeroCompact: {
    paddingTop: 32,
    paddingBottom: 14,
  },
  priorityLayout: { width: "100%", flexDirection: "row", alignItems: "center", gap: 24 },
  priorityLayoutViewport: { flexGrow: 1, flexShrink: 0 },
  priorityLayoutStacked: { flexDirection: "column", gap: 16 },
  priorityIntroColumn: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  priorityActionsColumn: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  priorityStackedColumn: { width: "100%", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  scrollCue: {
    width: "100%",
    alignItems: "center",
    gap: 9,
    paddingTop: 8,
    paddingBottom: 2,
  },
  scrollCuePressed: {
    opacity: 0.68,
  },
  scrollCueRail: {
    width: "100%",
    height: 1,
    overflow: "hidden",
    backgroundColor: "rgba(81,229,255,0.20)",
  },
  scrollCueScan: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 180,
    height: 1,
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  scrollCueScanReduced: {
    left: "43%",
    width: "14%",
  },
  scrollCueLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scrollCueLabel: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  scrollCueArrow: {
    color: colors.cyan,
    fontSize: 15,
    lineHeight: 17,
  },
  fullWidth: { width: "100%" },
  liveSection: { width: "100%" },
  hero: { minHeight: 610, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 54, marginBottom: 24 },
  situationIntro: { minHeight: 430, marginBottom: 0, paddingTop: 34, paddingHorizontal: 22, borderLeftWidth: 1, borderLeftColor: "rgba(81,229,255,0.25)" },
  heroStacked: { flexDirection: "column", alignItems: "stretch", gap: 40, paddingTop: 12 },
  // CHG-090 (QA): más aire entre el bloque de misión y el directorio.
  heroCompact: { minHeight: 0, flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", gap: 44 },
  heroCopy: { zIndex: 2, flex: 1 },
  signalLabel: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  signalLine: { width: 28, height: 1, backgroundColor: colors.cyan },
  signalText: { color: colors.cyan, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 1.4 },
  signalTextNarrow: { fontSize: font(11), letterSpacing: 0.8 },
  heroTitle: { color: colors.ink, fontSize: 118, fontWeight: "700", letterSpacing: -9, lineHeight: 96 },
  heroTitleAccent: { color: colors.cyan },
  heroTitleCompact: { fontSize: 70, letterSpacing: -5, lineHeight: 61 },
  heroTitleMissionWide: { fontSize: 108, letterSpacing: -8, lineHeight: 92 },
  heroTitleMissionCompact: { fontSize: 52, letterSpacing: -3.8, lineHeight: 54 },
  heroTitleMissionNarrow: { fontSize: 41, letterSpacing: -3, lineHeight: 44 },
  // CHG-090 (QA): tono más claro para asegurar el contraste AA sobre
  // el fondo azul marino, y cuerpo un punto más grande.
  heroDescription: { maxWidth: 660, marginTop: 28, color: "#b9c5da", fontSize: 17, lineHeight: 28 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  tag: { paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 5, backgroundColor: "rgba(16, 25, 40, 0.42)" },
  tagActive: { borderColor: "rgba(67, 231, 173, 0.28)" },
  tagText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: font(11), letterSpacing: 0.8 },
  tagTextActive: { color: colors.alive },
  notice: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255, 207, 102, 0.28)", borderRadius: 9, backgroundColor: "rgba(255, 207, 102, 0.07)" },
  staleNotice: { borderColor: "rgba(255, 103, 136, 0.30)", backgroundColor: "rgba(255, 103, 136, 0.08)" },
  staleNoticeText: { color: "#e6a3b2", fontSize: 11 },
  summary: { flexDirection: "row", gap: 16 },
  summaryTablet: { flexDirection: "column" },
  primaryMetric: { position: "relative", minHeight: 500, flex: 1.6, justifyContent: "space-between", overflow: "hidden", padding: 40, borderWidth: 1, borderColor: "rgba(255, 207, 102, 0.22)", borderRadius: 14 },
  primaryMetricTablet: { minHeight: 440 },
  metricHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  metricIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255, 207, 102, 0.24)", borderRadius: 8, backgroundColor: "rgba(255, 207, 102, 0.06)" },
  metricHeaderText: { color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 1.2 },
  primaryMetricCopy: { zIndex: 2 },
  metricCodeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 9, marginBottom: 7 },
  metricCode: { marginBottom: 7, color: "#927e52", fontFamily: fontFamilies.mono, fontSize: font(11), letterSpacing: 1.3 },
  metricCodeInline: { marginBottom: 0 },
  testScenarioLabel: { paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(137,166,207,0.18)", borderRadius: 4, backgroundColor: "rgba(137,166,207,0.05)", color: colors.inkSoft, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 0.7 },
  primaryValue: { color: colors.missing, fontSize: 210, fontWeight: "700", letterSpacing: -14, lineHeight: 188 },
  primaryValueCompact: { fontSize: 96, letterSpacing: -6, lineHeight: 88 },
  primaryLabel: { marginBottom: 10, color: colors.ink, fontSize: 64, fontWeight: "500", letterSpacing: -3.2 },
  primaryDescription: { maxWidth: 560, color: colors.inkSoft, fontSize: 16, lineHeight: 25 },
  signalBars: { position: "absolute", right: 30, bottom: 28, height: 105, flexDirection: "row", alignItems: "flex-end", gap: 4, opacity: 0.38 },
  signalBar: { width: 2, backgroundColor: colors.cyan },
  secondaryMetrics: { flex: 0.75, gap: 16 },
  secondaryMetricsTablet: { flexDirection: "row" },
  secondaryMetricsCompact: { flexDirection: "column" },
  secondaryMetric: { position: "relative", minHeight: 150, flex: 1, justifyContent: "flex-end", overflow: "hidden", padding: 23, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel },
  metricAccent: { position: "absolute", top: 22, bottom: 22, left: 0, width: 2 },
  secondaryCode: { position: "absolute", top: 18, right: 18, fontFamily: fontFamilies.mono, fontSize: font(11), letterSpacing: 1, opacity: 0.55 },
  secondaryLabel: { marginBottom: 5, color: colors.inkSoft, fontSize: font(11), fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  secondaryValue: { color: colors.ink, fontSize: 54, fontWeight: "600", letterSpacing: -3.5, lineHeight: 57 },
  secondaryNote: { marginTop: 4, color: colors.inkDim, fontSize: font(11) },
  analysis: { position: "relative", flexDirection: "row", alignItems: "center", gap: 56, overflow: "hidden", padding: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.panel },
  analysisTablet: { flexDirection: "column", alignItems: "stretch" },
  analysisCopy: { width: 300 },
  analysisCopyTablet: { width: "100%", maxWidth: 600 },
  panelCode: { position: "absolute", top: 18, right: 22, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11), letterSpacing: 1.2 },
  eyebrow: { marginBottom: 11, color: colors.inkDim, fontFamily: fontFamilies.mono, fontSize: font(11), fontWeight: "700", letterSpacing: 1.5 },
  sectionTitle: { marginBottom: 12, color: colors.ink, fontSize: 47, fontWeight: "500", letterSpacing: -2.4, lineHeight: 48 },
  bodyCopy: { maxWidth: 450, color: colors.inkSoft, fontSize: 13, lineHeight: 22 },
  footerShell: {
    width: "100%",
    marginTop: 32,
    backgroundColor: "#010204",
    borderTopWidth: 1,
    borderTopColor: "rgba(137, 166, 207, 0.20)",
  },
  footerShellCompact: { marginTop: 24 },
  footerInner: {
    width: "100%",
    maxWidth: contentMaxWidth,
    alignSelf: "center",
    gap: 30,
    paddingHorizontal: 34,
    paddingTop: 48,
    paddingBottom: 26,
  },
  footerInnerCompact: { gap: 24, paddingHorizontal: 20, paddingTop: 36 },
  footerMain: { flexDirection: "row", justifyContent: "space-between", gap: 80 },
  footerMainCompact: { flexDirection: "column", gap: 32 },
  footerIdentity: { flex: 1, maxWidth: 650 },
  footerEyebrow: {
    marginBottom: 10,
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  footerTitle: { color: colors.ink, fontSize: 25, fontWeight: "700", letterSpacing: -0.8 },
  footerDescription: {
    maxWidth: 590,
    marginTop: 13,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  footerAlliance: {
    marginTop: 18,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    lineHeight: 18,
    letterSpacing: 0.75,
  },
  footerNavigation: { flexDirection: "row", gap: 64 },
  footerNavigationCompact: { flexWrap: "wrap", gap: 36 },
  footerColumn: { minWidth: 150 },
  footerColumnTitle: {
    marginBottom: 13,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  footerLinks: { gap: 6 },
  footerLink: { alignSelf: "flex-start", paddingVertical: 5 },
  footerLinkPressed: { opacity: 0.62 },
  footerLinkText: { color: "#c4cfdd", fontSize: 12, fontWeight: "600" },
  footerNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 18,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(137, 166, 207, 0.13)",
  },
  footerNoticeCompact: { flexDirection: "column", gap: 8 },
  footerNoticeLabel: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1,
  },
  footerNoticeText: { flex: 1, color: colors.inkDim, fontSize: font(11), lineHeight: 16 },
  footerBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    paddingTop: 19,
    borderTopWidth: 1,
    borderTopColor: "rgba(137, 166, 207, 0.13)",
  },
  footerBottomCompact: { flexDirection: "column", gap: 8 },
  footerMeta: {
    color: "#8996ad",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    letterSpacing: 0.75,
  },
});
