import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { operationalMapDataSource } from "./features/operational-map/dataSource";
import { humanMapDataSource } from "./features/operational-map/humanMapDataSource";
import type {
  HumanMapDataSource,
  OperationalMapDataSource,
} from "./features/operational-map/types";
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
  onReportMissingPerson?: () => void;
  onReportUnverifiedBuilding?: () => void;
  onRegisterCollectionCenter?: () => void;
  onRegisterDonationPoint?: () => void;
  onOfferCommunityMeals?: () => void;
  onOfferTemporaryShelter?: () => void;
  onLogin?: () => void;
  onRegister?: () => void;
  onAbout?: () => void;
  // CHG-051: origen de la sesión (inyectable en pruebas).
  authSource?: AuthDataSource;
}

export function App({
  dataSource = humanImpactDataSource,
  mapDataSource = operationalMapDataSource,
  humanMapDataSource: humanLayerDataSource = humanMapDataSource,
  peopleRecordsDataSource: recordsDataSource = peopleRecordsDataSource,
  humanitarianDirectoryDataSource: directoryDataSource = humanitarianDirectoryDataSource,
  communityContributionDataSource: contributionDataSource = communityContributionDataSource,
  onReportMissingPerson = () => undefined,
  onReportUnverifiedBuilding = () => undefined,
  onRegisterCollectionCenter = () => undefined,
  onRegisterDonationPoint = () => undefined,
  onOfferCommunityMeals = () => undefined,
  onOfferTemporaryShelter = () => undefined,
  onLogin = () => undefined,
  onRegister = () => undefined,
  onAbout = () => undefined,
  authSource = authDataSource,
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

  return (
    <SafeAreaProvider>
      <DashboardLoader
        dataSource={dataSource}
        mapDataSource={mapDataSource}
        humanMapDataSource={humanLayerDataSource}
        peopleRecordsDataSource={recordsDataSource}
        humanitarianDirectoryDataSource={directoryDataSource}
        communityContributionDataSource={contributionDataSource}
        onReportMissingPerson={onReportMissingPerson}
        onReportUnverifiedBuilding={onReportUnverifiedBuilding}
        onRegisterCollectionCenter={onRegisterCollectionCenter}
        onRegisterDonationPoint={onRegisterDonationPoint}
        onOfferCommunityMeals={onOfferCommunityMeals}
        onOfferTemporaryShelter={onOfferTemporaryShelter}
        onLogin={onLogin}
        onRegister={onRegister}
        onAbout={onAbout}
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
  onReportMissingPerson,
  onReportUnverifiedBuilding,
  onRegisterCollectionCenter,
  onRegisterDonationPoint,
  onOfferCommunityMeals,
  onOfferTemporaryShelter,
  onLogin,
  onRegister,
  onAbout,
  sessionAccount,
  onLogout,
}: {
  dataSource: HumanImpactDataSource;
  mapDataSource: OperationalMapDataSource;
  humanMapDataSource: HumanMapDataSource;
  peopleRecordsDataSource: PeopleRecordsDataSource;
  humanitarianDirectoryDataSource: HumanitarianDirectoryDataSource;
  communityContributionDataSource: CommunityContributionDataSource;
  onReportMissingPerson: () => void;
  onReportUnverifiedBuilding: () => void;
  onRegisterCollectionCenter: () => void;
  onRegisterDonationPoint: () => void;
  onOfferCommunityMeals: () => void;
  onOfferTemporaryShelter: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onAbout: () => void;
  sessionAccount: AuthenticatedAccount | null;
  onLogout: () => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

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
  }, [dataSource]);

  if (loadState.status === "loading") {
    return (
      <View style={styles.statePage} accessibilityLabel="Cargando situación humana">
        <ActivityIndicator size="large" color={colors.cyan} />
        <Text style={styles.stateText}>Preparando el panorama de situación…</Text>
      </View>
    );
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
      onReportMissingPerson={onReportMissingPerson}
      onReportUnverifiedBuilding={onReportUnverifiedBuilding}
      onRegisterCollectionCenter={onRegisterCollectionCenter}
      onRegisterDonationPoint={onRegisterDonationPoint}
      onOfferCommunityMeals={onOfferCommunityMeals}
      onOfferTemporaryShelter={onOfferTemporaryShelter}
      onLogin={onLogin}
      onRegister={onRegister}
      onAbout={onAbout}
      account={sessionAccount}
      onLogout={onLogout}
    />
  );
}

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
