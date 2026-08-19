// CHG-174 — Sección «12 · Aceptación de ruta»: resumen transaccional por
// transporte. Muestra el estado de los DOS centros, habilita ACEPTAR
// RUTA solo cuando ambos aceptaron y, tras pulsarlo, enseña el código
// que el Centro Local entrega a la Mulera.
//
// Ojo con el alcance: esto completa ÚNICAMENTE la relación
// Centro Local ↔ Mulera. La aceptación con el Centro Receptor es otro
// contrato y aquí no se insinúa como hecha.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import {
  canStartReceptionRouteAcceptance,
  canStartRouteAcceptance,
  isRouteFullyAccepted,
  receptionStageMessage,
  routeAcceptanceDataSource,
  routeStateMessage,
  type RouteAcceptanceDataSource,
  type TransportRequestStatus,
  type TransportRouteState,
} from "../transports/routeAcceptance";

type SectionStatus = "loading" | "error" | "ready";

const kindLabels = { mule: "La mulera", boat: "La lanchera" } as const;

// §21: el estado de cada centro se dice con palabras, no solo color.
function statusLine(status: TransportRequestStatus | null): string {
  if (status === "accepted") return "✓ Solicitud aceptada";
  if (status === "declined") return "✕ Solicitud declinada";
  return "⏳ Pendiente de aceptación";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function RouteAcceptanceSection({
  dataSource = routeAcceptanceDataSource,
}: {
  dataSource?: RouteAcceptanceDataSource;
}) {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [items, setItems] = useState<TransportRouteState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(await dataSource.listRouteStates());
      setStatus("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar el estado de las rutas.",
      );
      setStatus("error");
    }
  }, [dataSource]);

  useEffect(() => {
    void load();
  }, [load]);

  const acceptRoute = async (
    state: TransportRouteState,
    stage: "local" | "reception",
  ) => {
    setWorking(state.transportId);
    setError(null);
    try {
      if (stage === "local") {
        await dataSource.startRouteAcceptance(state.transportId);
      } else {
        await dataSource.startReceptionRouteAcceptance(state.transportId);
      }
      await load();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "No fue posible aceptar la ruta.",
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <View style={styles.section} testID="admin-route-acceptance-section">
      <View>
        <Text style={styles.overline}>12 · ACEPTACIÓN DE RUTA</Text>
        <Text style={styles.title} accessibilityRole="header">
          Definición y aceptación de ruta
        </Text>
        <Text style={styles.description}>
          Cuando los dos centros aceptan la solicitud, el Centro de Acopio
          Local acepta la ruta y el sistema emite un código. Ese código se
          le entrega a quien conduce, que lo introduce desde su panel para
          confirmar. Aquí se completa la relación con el Centro Local; la
          del Centro Receptor se definirá aparte.
        </Text>
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {status === "loading" && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.cardMeta}>Cargando rutas…</Text>
        </View>
      )}

      {status !== "loading" && items.length === 0 && (
        <Text style={styles.empty}>
          Todavía no hay transportes asociados a tus centros.
        </Text>
      )}

      {items.map((state) => (
        <View
          key={state.transportId}
          style={styles.card}
          testID={`route-state-${state.transportId}`}
        >
          <Text style={styles.cardTitle}>
            {kindLabels[state.transportKind]} · {state.originMunicipality} →{" "}
            {state.destinationMunicipality}
          </Text>
          <Text style={styles.cardMeta}>
            Registrado {formatDate(state.transportCreatedAt)}
          </Text>

          <View style={styles.centerBlock}>
            <Text style={styles.centerName}>
              Centro de origen · {state.originCenterName}
            </Text>
            <Text style={styles.centerStatus}>
              {statusLine(state.localStatus)}
            </Text>
          </View>
          <View style={styles.centerBlock}>
            <Text style={styles.centerName}>
              Centro de destino · {state.destinationCenterName}
            </Text>
            <Text style={styles.centerStatus}>
              {statusLine(state.receptionStatus)}
            </Text>
          </View>

          {/* CHG-175 §16: las dos etapas, siempre distinguibles. */}
          <View style={styles.stageBlock}>
            <Text style={styles.stageTitle}>
              01 · CENTRO LOCAL ↔ MULERA
            </Text>
            <Text style={styles.message}>{routeStateMessage(state)}</Text>

            {state.routeStatus === null && state.isLocalSteward && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aceptar la ruta con la mulera y generar el código"
                disabled={
                  !canStartRouteAcceptance(state) ||
                  working === state.transportId
                }
                onPress={() => void acceptRoute(state, "local")}
                style={[
                  styles.primaryButton,
                  !canStartRouteAcceptance(state) && styles.disabledButton,
                ]}
                testID={`accept-route-${state.transportId}`}
              >
                <Text style={styles.primaryText}>ACEPTAR RUTA</Text>
              </Pressable>
            )}

            {/* El código de esta etapa solo lo recibe el centro local. */}
            {state.confirmationCode && !state.muleAcceptedAt && (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>
                  CÓDIGO DE REGISTRO DE RUTA
                </Text>
                <Text
                  style={styles.codeValue}
                  testID={`route-code-${state.transportId}`}
                >
                  {state.confirmationCode}
                </Text>
                <Text style={styles.codeHint}>
                  Entrégaselo a quien conduce. Es de un solo uso.
                </Text>
              </View>
            )}

            {state.muleAcceptedAt && (
              <Text style={styles.acceptedText}>
                ✓ Completada · {formatDate(state.muleAcceptedAt)}
              </Text>
            )}
          </View>

          <View style={styles.stageBlock}>
            <Text style={styles.stageTitle}>
              02 · MULERA ↔ CENTRO RECEPTOR
            </Text>
            <Text style={styles.message}>{receptionStageMessage(state)}</Text>

            {/* §20: mientras la etapa 1 siga abierta, esta no existe. */}
            {state.routeStatus !== "accepted" && (
              <Text style={styles.lockedText}>🔒 No disponible todavía</Text>
            )}

            {state.receptionStartedAt === null &&
              state.routeStatus === "accepted" &&
              state.isReceptionSteward && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aceptar la ruta con el centro receptor y generar el código"
                  disabled={
                    !canStartReceptionRouteAcceptance(state) ||
                    working === state.transportId
                  }
                  onPress={() => void acceptRoute(state, "reception")}
                  style={[
                    styles.primaryButton,
                    !canStartReceptionRouteAcceptance(state) &&
                      styles.disabledButton,
                  ]}
                  testID={`accept-reception-route-${state.transportId}`}
                >
                  <Text style={styles.primaryText}>ACEPTAR RUTA</Text>
                </Pressable>
              )}

            {/* Y este código solo lo recibe el centro receptor. */}
            {state.receptionConfirmationCode &&
              !state.receptionMuleAcceptedAt && (
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>
                    CÓDIGO DE ACEPTACIÓN CON CENTRO RECEPTOR
                  </Text>
                  <Text
                    style={styles.codeValue}
                    testID={`reception-route-code-${state.transportId}`}
                  >
                    {state.receptionConfirmationCode}
                  </Text>
                  <Text style={styles.codeHint}>
                    Compártalo con la Mulera de este transporte. Es
                    distinto del código del Centro Local y de un solo uso.
                  </Text>
                </View>
              )}

            {state.receptionMuleAcceptedAt && (
              <Text style={styles.acceptedText}>
                ✓ Completada · {formatDate(state.receptionMuleAcceptedAt)}
              </Text>
            )}
          </View>

          {/* §45: la ruta entera, solo con las dos etapas cerradas. */}
          <Text
            style={
              isRouteFullyAccepted(state)
                ? styles.routeAcceptedText
                : styles.message
            }
            testID={`route-global-${state.transportId}`}
          >
            {isRouteFullyAccepted(state)
              ? `RUTA ✓ ACEPTADA · ${formatDate(state.routeAcceptedAt!)}`
              : "RUTA · pendiente de completar las dos aceptaciones"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  overline: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  description: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  error: { color: colors.emergency, fontSize: 12, lineHeight: 18 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  empty: { color: colors.inkDim, fontSize: 12 },
  card: {
    gap: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: "rgba(13,20,33,0.8)",
  },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  cardMeta: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
  },
  centerBlock: { gap: 2, marginTop: 4 },
  centerName: { color: colors.inkSoft, fontSize: 12 },
  centerStatus: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
  message: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  disabledButton: { opacity: 0.4 },
  primaryText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  codeBox: {
    gap: 4,
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.34)",
    borderRadius: 8,
    backgroundColor: "rgba(81,229,255,0.06)",
  },
  codeLabel: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  codeValue: {
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  codeHint: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  stageBlock: {
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stageTitle: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  lockedText: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
  },
  routeAcceptedText: {
    marginTop: 10,
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  acceptedText: {
    marginTop: 6,
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    fontWeight: "800",
  },
});
