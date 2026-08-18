import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppDownloadPromo } from "./components/AppDownloadPromo";
import { authDataSource } from "./features/auth/dataSource";
import type { AuthDataSource, AuthenticatedAccount } from "./features/auth/types";
import { HumanImpactDashboard } from "./features/human-impact/HumanImpactDashboard";
import { humanImpactDataSource } from "./features/human-impact/dataSource";
import type {
  HumanImpactDataSource,
  HumanImpactOverview,
  PeopleRecordsDataSource,
} from "./features/human-impact/types";
import { peopleRecordsDataSource } from "./features/human-impact/peopleRecordsDataSource";
import { communityContributionDataSource } from "./features/humanitarian-directory/contributionDataSource";
import { humanitarianDirectoryDataSource } from "./features/humanitarian-directory/dataSource";
import type {
  CommunityContributionDataSource,
  HumanitarianDirectoryDataSource,
} from "./features/humanitarian-directory/types";
import { helpRequestsDataSource } from "./features/help-requests/dataSource";
import type { HelpRequestsDataSource } from "./features/help-requests/types";
import { operationalMapDataSource } from "./features/operational-map/dataSource";
import { humanMapDataSource } from "./features/operational-map/humanMapDataSource";
import type {
  HumanMapDataSource,
  OperationalMapDataSource,
} from "./features/operational-map/types";
import {
  CHANGE_SIGNAL_INTERVAL_MS,
  changeSignalSource,
  type ChangeSignalSource,
} from "./platform/changeSignal";
import {
  notifyDataRefresh,
  useDataRefreshTick,
} from "./platform/dataRefresh";
import { colors } from "./theme";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: HumanImpactOverview; stale: boolean };

interface AppProps {
  dataSource?: HumanImpactDataSource;
  mapDataSource?: OperationalMapDataSource;
  humanMapDataSource?: HumanMapDataSource;
  peopleRecordsDataSource?: PeopleRecordsDataSource;
  humanitarianDirectoryDataSource?: HumanitarianDirectoryDataSource;
  communityContributionDataSource?: CommunityContributionDataSource;
  // CHG-125: solicitudes «Necesitamos ayuda» (inyectable en pruebas).
  helpRequestsDataSource?: HelpRequestsDataSource;
  onReportMissingPerson?: () => void;
  onReportUnverifiedBuilding?: () => void;
  onRegisterCollectionCenter?: () => void;
  onRegisterDonationPoint?: () => void;
  // CHG-153: acopio receptor y punto de distribución.
  onRegisterReceiverCenter?: () => void;
  onRegisterDistributionPoint?: () => void;
  onOfferCommunityMeals?: () => void;
  onOfferTemporaryShelter?: () => void;
  onRequestHelp?: () => void;
  onLogin?: () => void;
  onRegister?: () => void;
  onAbout?: () => void;
  // CHG-139: abre /administracion desde Mi espacio (super_admin).
  onOpenAdmin?: () => void;
  // CHG-091: deep link ?buscar= hacia el buscador del directorio.
  initialDirectorySearch?: string;
  // CHG-051: origen de la sesión (inyectable en pruebas).
  authSource?: AuthDataSource;
  // CHG-082: sonda de la señal de cambios (inyectable en pruebas).
  changeSignal?: ChangeSignalSource;
}

export function App({
  dataSource = humanImpactDataSource,
  mapDataSource = operationalMapDataSource,
  humanMapDataSource: humanLayerDataSource = humanMapDataSource,
  peopleRecordsDataSource: recordsDataSource = peopleRecordsDataSource,
  humanitarianDirectoryDataSource: directoryDataSource = humanitarianDirectoryDataSource,
  communityContributionDataSource: contributionDataSource = communityContributionDataSource,
  helpRequestsDataSource: helpRequestsSource = helpRequestsDataSource,
  onReportMissingPerson = () => undefined,
  onReportUnverifiedBuilding = () => undefined,
  onRegisterCollectionCenter = () => undefined,
  onRegisterDonationPoint = () => undefined,
  onRegisterReceiverCenter = () => undefined,
  onRegisterDistributionPoint = () => undefined,
  onOfferCommunityMeals = () => undefined,
  onOfferTemporaryShelter = () => undefined,
  onRequestHelp = () => undefined,
  onLogin = () => undefined,
  onRegister = () => undefined,
  onAbout = () => undefined,
  onOpenAdmin,
  initialDirectorySearch,
  authSource = authDataSource,
  changeSignal = changeSignalSource,
}: AppProps) {
  // CHG-051: la sesión activa (si existe) se muestra en el encabezado
  // y puede cerrarse desde ahí. Sin sesión, el encabezado conserva los
  // accesos de iniciar sesión y registro.
  const [sessionAccount, setSessionAccount] =
    useState<AuthenticatedAccount | null>(null);

  useEffect(() => {
    let mounted = true;
    authSource
      .getCurrentAccount()
      .then((account) => {
        if (mounted) setSessionAccount(account);
      })
      .catch(() => {
        if (mounted) setSessionAccount(null);
      });
    return () => {
      mounted = false;
    };
  }, [authSource]);

  const logout = () => {
    void authSource
      .logout()
      .catch(() => undefined)
      .finally(() => setSessionAccount(null));
  };

  // CHG-082: sonda de la señal de cambios — cuando la huella del
  // backend cambia (registro nuevo o modificado), todos los módulos
  // suscritos de la portada refrescan de inmediato. Los fallos se
  // ignoran: el sondeo de 30 s de cada módulo sigue de respaldo.
  useEffect(() => {
    if (changeSignal.transport !== "api") {
      return;
    }
    const controller = new AbortController();
    let lastSignal: string | null = null;
    const probe = async () => {
      try {
        const signal = await changeSignal.fetchSignal(controller.signal);
        if (lastSignal !== null && signal !== lastSignal) {
          notifyDataRefresh();
        }
        lastSignal = signal;
      } catch {
        // Silencio deliberado: sin señal no se interrumpe nada.
      }
    };
    void probe();
    const timer = globalThis.setInterval(
      () => void probe(),
      CHANGE_SIGNAL_INTERVAL_MS,
    );
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [changeSignal]);

  return (
    <SafeAreaProvider>
      <DashboardLoader
        dataSource={dataSource}
        mapDataSource={mapDataSource}
        humanMapDataSource={humanLayerDataSource}
        peopleRecordsDataSource={recordsDataSource}
        humanitarianDirectoryDataSource={directoryDataSource}
        communityContributionDataSource={contributionDataSource}
        helpRequestsDataSource={helpRequestsSource}
        onReportMissingPerson={onReportMissingPerson}
        onReportUnverifiedBuilding={onReportUnverifiedBuilding}
        onRegisterCollectionCenter={onRegisterCollectionCenter}
        onRegisterDonationPoint={onRegisterDonationPoint}
        onRegisterReceiverCenter={onRegisterReceiverCenter}
        onRegisterDistributionPoint={onRegisterDistributionPoint}
        onOfferCommunityMeals={onOfferCommunityMeals}
        onOfferTemporaryShelter={onOfferTemporaryShelter}
        onRequestHelp={onRequestHelp}
        onLogin={onLogin}
        onRegister={onRegister}
        onAbout={onAbout}
        onOpenAdmin={onOpenAdmin}
        initialDirectorySearch={initialDirectorySearch}
        sessionAccount={sessionAccount}
        onLogout={logout}
      />
      {/* CHG-065: anuncio de descarga de la app (10 s, una vez por
          sesión del navegador; solo en web). */}
      <AppDownloadPromo />
    </SafeAreaProvider>
  );
}

function DashboardLoader({
  dataSource,
  mapDataSource,
  humanMapDataSource,
  peopleRecordsDataSource,
  humanitarianDirectoryDataSource,
  communityContributionDataSource,
  helpRequestsDataSource: helpRequestsSource,
  onReportMissingPerson,
  onReportUnverifiedBuilding,
  onRegisterCollectionCenter,
  onRegisterDonationPoint,
  onRegisterReceiverCenter,
  onRegisterDistributionPoint,
  onOfferCommunityMeals,
  onOfferTemporaryShelter,
  onRequestHelp,
  onLogin,
  onRegister,
  onAbout,
  onOpenAdmin,
  sessionAccount,
  initialDirectorySearch,
  onLogout,
}: {
  dataSource: HumanImpactDataSource;
  mapDataSource: OperationalMapDataSource;
  humanMapDataSource: HumanMapDataSource;
  peopleRecordsDataSource: PeopleRecordsDataSource;
  humanitarianDirectoryDataSource: HumanitarianDirectoryDataSource;
  communityContributionDataSource: CommunityContributionDataSource;
  helpRequestsDataSource: HelpRequestsDataSource;
  onReportMissingPerson: () => void;
  onReportUnverifiedBuilding: () => void;
  onRegisterCollectionCenter: () => void;
  onRegisterDonationPoint: () => void;
  onRegisterReceiverCenter: () => void;
  onRegisterDistributionPoint: () => void;
  onOfferCommunityMeals: () => void;
  onOfferTemporaryShelter: () => void;
  onRequestHelp: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onAbout: () => void;
  // CHG-139: abre /administracion desde Mi espacio (super_admin).
  onOpenAdmin?: () => void;
  initialDirectorySearch?: string;
  sessionAccount: AuthenticatedAccount | null;
  onLogout: () => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  // CHG-082: refresco inmediato cuando la señal de cambios avisa.
  const refreshTick = useDataRefreshTick();

  // CHG-050: en web la página jamás se desplaza horizontalmente (en
  // móvil un ancho desbordado permitía sacar toda la app hacia los
  // lados); el scroll de la app es solo vertical.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflowX: html.style.overflowX,
      bodyOverflowX: body.style.overflowX,
      htmlMaxWidth: html.style.maxWidth,
      bodyMaxWidth: body.style.maxWidth,
    };
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    html.style.maxWidth = "100%";
    body.style.maxWidth = "100%";
    return () => {
      html.style.overflowX = previous.htmlOverflowX;
      body.style.overflowX = previous.bodyOverflowX;
      html.style.maxWidth = previous.htmlMaxWidth;
      body.style.maxWidth = previous.bodyMaxWidth;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadOverview = async () => {
      try {
        const data = await dataSource.getOverview(controller.signal);
        setLoadState({ status: "success", data, stale: false });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "No fue posible consultar la situación humana.";

        setLoadState((current) =>
          current.status === "success"
            ? { ...current, stale: true }
            : { status: "error", message },
        );
      }
    };

    void loadOverview();

    const refreshTimer =
      dataSource.transport === "api"
        ? globalThis.setInterval(() => void loadOverview(), 30_000)
        : undefined;

    return () => {
      controller.abort();
      if (refreshTimer !== undefined) {
        globalThis.clearInterval(refreshTimer);
      }
    };
  }, [dataSource, refreshTick]);

  if (loadState.status === "loading") {
    // CHG-090 (QA): esqueleto de carga con la silueta de la portada en
    // lugar de un spinner a pantalla vacía.
    return <DashboardSkeleton />;
  }

  if (loadState.status === "error") {
    return (
      <View style={styles.statePage} accessibilityRole="alert">
        <View style={styles.errorMark}>
          <Text style={styles.errorMarkText}>!</Text>
        </View>
        <Text style={styles.errorTitle} accessibilityRole="header">
          No pudimos cargar la situación
        </Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
      </View>
    );
  }

  return (
    <HumanImpactDashboard
      data={loadState.data}
      isDemo={dataSource.dataKind === "demonstrative"}
      stale={loadState.stale}
      mapDataSource={mapDataSource}
      humanMapDataSource={humanMapDataSource}
      peopleRecordsDataSource={peopleRecordsDataSource}
      humanitarianDirectoryDataSource={humanitarianDirectoryDataSource}
      communityContributionDataSource={communityContributionDataSource}
      helpRequestsDataSource={helpRequestsSource}
      initialDirectorySearch={initialDirectorySearch}
      onReportMissingPerson={onReportMissingPerson}
      onReportUnverifiedBuilding={onReportUnverifiedBuilding}
      onRegisterCollectionCenter={onRegisterCollectionCenter}
      onRegisterDonationPoint={onRegisterDonationPoint}
      onRegisterReceiverCenter={onRegisterReceiverCenter}
      onRegisterDistributionPoint={onRegisterDistributionPoint}
      onOfferCommunityMeals={onOfferCommunityMeals}
      onOfferTemporaryShelter={onOfferTemporaryShelter}
      onRequestHelp={onRequestHelp}
      onLogin={onLogin}
      onRegister={onRegister}
      onAbout={onAbout}
      onOpenAdmin={onOpenAdmin}
      account={sessionAccount}
      onLogout={onLogout}
    />
  );
}

// CHG-090 (QA) — Esqueleto de la portada durante la carga inicial:
// franjas que imitan encabezado, misión y tarjetas, con pulso suave.
function DashboardSkeleton() {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const block = (extra: object) => [
    skeletonStyles.block,
    { opacity: pulse },
    extra,
  ];

  return (
    <View
      style={skeletonStyles.page}
      accessibilityLabel="Cargando situación humana"
    >
      <Animated.View style={block(skeletonStyles.header)} />
      <View style={skeletonStyles.body}>
        <Animated.View style={block(skeletonStyles.kicker)} />
        <Animated.View style={block(skeletonStyles.titleOne)} />
        <Animated.View style={block(skeletonStyles.titleTwo)} />
        <Animated.View style={block(skeletonStyles.paragraph)} />
        <Animated.View style={block(skeletonStyles.paragraphShort)} />
        <View style={skeletonStyles.cards}>
          <Animated.View style={block(skeletonStyles.card)} />
          <Animated.View style={block(skeletonStyles.card)} />
          <Animated.View style={block(skeletonStyles.card)} />
        </View>
      </View>
      <Text style={skeletonStyles.caption}>
        Preparando el panorama de situación…
      </Text>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  block: { borderRadius: 10, backgroundColor: "rgba(137,166,207,0.16)" },
  header: { height: 76, borderRadius: 0, marginBottom: 28 },
  body: { flex: 1, width: "100%", maxWidth: 960, alignSelf: "center", paddingHorizontal: 24, gap: 14 },
  kicker: { width: 240, height: 12 },
  titleOne: { width: "55%", height: 44, marginTop: 10 },
  titleTwo: { width: "75%", height: 44 },
  paragraph: { width: "90%", height: 14, marginTop: 18 },
  paragraphShort: { width: "62%", height: 14 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 30 },
  card: { flexGrow: 1, flexBasis: "30%", minWidth: 180, height: 130, borderRadius: 14 },
  caption: { padding: 18, textAlign: "center", color: colors.inkDim, fontSize: 12 },
});

const styles = StyleSheet.create({
  statePage: {
    flex: 1,
    minHeight: 600,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 32,
    backgroundColor: colors.canvas,
  },
  stateText: {
    maxWidth: 460,
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  errorMark: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 103, 136, 0.42)",
    borderRadius: 10,
    backgroundColor: "rgba(255, 103, 136, 0.10)",
  },
  errorMarkText: {
    color: colors.reported,
    fontSize: 24,
    fontWeight: "700",
  },
  errorTitle: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: "600",
    letterSpacing: -1.5,
    textAlign: "center",
  },
});
