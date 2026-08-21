import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import { CountdownLabel } from "./CountdownLabel";
import { distanceToRequest, formatDistance } from "./proximity";
import type { GeographicCenter } from "../operational-map/webMercator";
import type { ActiveHelpRequest } from "./types";

const countFormatter = new Intl.NumberFormat("es-CO");

// CHG-193 — Para quien pidió ayuda, el dato que importa no es cuántas
// solicitudes hay vigentes: es cuánta gente viene. El contador de la
// cabecera lo dice con sus palabras, incluido el caso de que aún no
// haya nadie, que también es información.
export function attendersHeadline(ownRequests: ActiveHelpRequest[]): string {
  const total = ownRequests.reduce(
    (sum, request) => sum + request.attendersCount,
    0,
  );
  const mine = ownRequests.length === 1 ? "TU SOLICITUD" : "TUS SOLICITUDES";
  if (total === 0) return `NADIE ATIENDE ${mine} AÚN`;
  if (total === 1) return `1 PERSONA ATIENDE ${mine}`;
  return `${countFormatter.format(total)} PERSONAS ATIENDEN ${mine}`;
}

export interface HelpRequestsSectionProps {
  items: ActiveHelpRequest[];
  loading: boolean;
  errorMessage: string | null;
  // La sesión decide si «Atender solicitud» actúa o invita a entrar.
  isAuthenticated: boolean;
  // CHG-193: el segundo argumento es el aviso aceptado.
  attend: (id: string, sharesIdentity?: boolean) => Promise<unknown>;
  onAttended: () => void;
  onLogin?: () => void;
  onRegister?: () => void;
  // Sin marco propio: bloque dentro de otra sección (transmisión en
  // vivo, DEC-125-06; Mi espacio, DEC-125-09).
  embedded?: boolean;
  maxItems?: number;
  title?: string;
  // CHG-191: posición de quien mira, para decir a qué distancia queda
  // cada solicitud. Null (sin permiso de ubicación) = no se dice nada.
  viewerLocation?: GeographicCenter | null;
  // CHG-193: las solicitudes vigentes de la propia cuenta. No se listan
  // aquí —nadie se atiende a sí mismo, CHG-190—, pero su dueña necesita
  // saber cuánta gente va en camino: el contador de la cabecera pasa a
  // hablar de ellas.
  ownRequests?: ActiveHelpRequest[];
  // CHG-193: abrir la vista de quién atiende la solicitud propia.
  onOpenAttenders?: (request: ActiveHelpRequest) => void;
}

// CHG-125 — Solicitudes «Necesitamos ayuda» vigentes: descripción,
// dirección, contador regresivo, cuántas personas atienden y la acción
// de atender para cuentas con sesión. La lista viene ya filtrada por
// vigencia desde el backend; aquí no se decide qué expira.
export function HelpRequestsSection({
  items,
  loading,
  errorMessage,
  isAuthenticated,
  attend,
  onAttended,
  onLogin,
  onRegister,
  embedded = false,
  maxItems,
  title = "Solicitudes activas de ayuda",
  viewerLocation = null,
  ownRequests = [],
  onOpenAttenders,
}: HelpRequestsSectionProps) {
  const [attendingId, setAttendingId] = useState<string | null>(null);
  const [attendError, setAttendError] = useState<string | null>(null);
  // CHG-193: atender comparte tu nombre y tu teléfono con quien pidió
  // ayuda, así que se avisa ANTES y solo se registra si se acepta.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const visibleItems =
    maxItems !== undefined ? items.slice(0, maxItems) : items;

  const attendRequest = async (id: string) => {
    setAttendingId(id);
    setAttendError(null);
    setConfirmingId(null);
    try {
      await attend(id, true);
      onAttended();
    } catch (error: unknown) {
      setAttendError(
        error instanceof Error
          ? error.message
          : "No fue posible registrar la atención. Intenta de nuevo.",
      );
    } finally {
      setAttendingId(null);
    }
  };

  return (
    <View
      testID={embedded ? "help-requests-embedded" : "help-requests-section"}
      style={[styles.panel, embedded && styles.panelEmbedded]}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.overline}>COMMUNITY / SOS</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.lead}>
            Cada solicitud expira sola al vencer su vigencia y desaparece
            de la plataforma. Si puedes acudir, márcala como atendida
            para que se sepa cuánta gente va en camino.
          </Text>
        </View>
        <View style={styles.headingSide}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>
              {ownRequests.length > 0
                ? attendersHeadline(ownRequests)
                : `${countFormatter.format(items.length)} ${
                    items.length === 1 ? "VIGENTE" : "VIGENTES"
                  }`}
            </Text>
          </View>
          {/* CHG-193: quién atiende, persona por persona. Solo aparece
              para quien publicó la solicitud. */}
          {ownRequests.length > 0 && onOpenAttenders && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver quién atiende tu solicitud"
              onPress={() => onOpenAttenders(ownRequests[0])}
              testID="help-request-own-see-more"
              style={({ pressed }) => [
                styles.seeMoreButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.seeMoreText}>VER MÁS</Text>
            </Pressable>
          )}
        </View>
      </View>

      {loading && items.length === 0 && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.emergency} />
          <Text style={styles.loadingText}>Consultando solicitudes vigentes…</Text>
        </View>
      )}

      {errorMessage && items.length === 0 && !loading && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {errorMessage}
        </Text>
      )}

      {!loading && !errorMessage && items.length === 0 && (
        <Text style={styles.emptyText}>
          No hay solicitudes de ayuda vigentes en este momento.
        </Text>
      )}

      {visibleItems.map((request) => (
        <View
          key={request.id}
          style={styles.item}
          testID={`help-request-item-${request.id}`}
        >
          <View style={styles.itemAccent} />
          <View style={styles.itemMain}>
            <View style={styles.itemTopline}>
              <CountdownLabel
                expiresAt={request.expiresAt}
                style={styles.countdown}
              />
              <Text style={styles.attenders}>
                {request.attendersCount === 1
                  ? "1 PERSONA ATENDIENDO"
                  : `${countFormatter.format(request.attendersCount)} PERSONAS ATENDIENDO`}
              </Text>
            </View>
            <Text style={styles.itemAddress}>{request.address}</Text>
            {/* CHG-191: decidir si puedes acudir depende de qué tan
                lejos queda. Solo aparece cuando hay las dos posiciones:
                la de la solicitud y la de quien mira. */}
            {(() => {
              const distance = distanceToRequest(request, viewerLocation);
              if (distance === null) return null;
              const label = formatDistance(distance);
              return (
                <Text
                  style={styles.itemDistance}
                  accessibilityLabel={`A ${label} de tu ubicación`}
                  testID={`help-request-distance-${request.id}`}
                >
                  {`A ${label.toUpperCase()} DE TI`}
                </Text>
              );
            })()}
            <Text style={styles.itemDescription}>{request.description}</Text>
            {isAuthenticated ? (
              request.attendedByMe ? (
                <Text style={styles.attendingNote}>
                  ✓ ESTÁS ATENDIENDO ESTA SOLICITUD
                </Text>
              ) : confirmingId === request.id ? (
                /* CHG-193: quien pidió ayuda necesita saber quién va en
                   camino, así que atender comparte nombre y teléfono.
                   Se dice antes, no después. */
                <View
                  style={styles.consentBox}
                  testID={`help-request-consent-${request.id}`}
                >
                  <Text style={styles.consentText}>
                    Al atender, tu nombre y tu teléfono se comparten con
                    quien pidió la ayuda, para que sepa quién va en
                    camino. Tu correo no se comparte.
                  </Text>
                  <View style={styles.consentActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Confirmar que atiendes la solicitud en ${request.address}`}
                      disabled={attendingId !== null}
                      onPress={() => void attendRequest(request.id)}
                      style={({ pressed }) => [
                        styles.attendButton,
                        pressed && styles.pressed,
                        attendingId !== null && styles.disabled,
                      ]}
                    >
                      {attendingId === request.id ? (
                        <ActivityIndicator size="small" color="#07101b" />
                      ) : (
                        <Text style={styles.attendButtonText}>
                          SÍ, ATENDER Y COMPARTIR
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar la atención"
                      onPress={() => setConfirmingId(null)}
                      style={({ pressed }) => [
                        styles.cancelButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.cancelButtonText}>CANCELAR</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Atender solicitud en ${request.address}`}
                  disabled={attendingId !== null}
                  onPress={() => setConfirmingId(request.id)}
                  style={({ pressed }) => [
                    styles.attendButton,
                    pressed && styles.pressed,
                    attendingId !== null && styles.disabled,
                  ]}
                >
                  <Text style={styles.attendButtonText}>
                    ATENDER SOLICITUD
                  </Text>
                </Pressable>
              )
            ) : null}
          </View>
        </View>
      ))}

      {attendError && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {attendError}
        </Text>
      )}

      {!isAuthenticated && items.length > 0 && (
        <View style={styles.loginInvite}>
          <Text style={styles.loginInviteText}>
            Inicia sesión para marcar que estás atendiendo una solicitud
            y que la comunidad sepa cuánta gente acude.
          </Text>
          {(onLogin || onRegister) && (
            <View style={styles.loginActions}>
              {onLogin && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Iniciar sesión para atender solicitudes"
                  onPress={onLogin}
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.loginButtonText}>INICIAR SESIÓN</Text>
                </Pressable>
              )}
              {onRegister && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Registrarme para atender solicitudes"
                  onPress={onRegister}
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.loginButtonText}>REGISTRARME</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 94, 0.28)",
    borderRadius: 14,
    backgroundColor: "rgba(22, 8, 12, 0.55)",
  },
  panelEmbedded: {
    borderRadius: 10,
    padding: 12,
  },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headingCopy: { minWidth: 220, flex: 1 },
  // CHG-193: contador y acceso a la lista viajan juntos y envuelven en
  // pantalla estrecha, como el resto de la cabecera.
  headingSide: { alignItems: "flex-end", gap: 6 },
  seeMoreButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
  },
  consentBox: {
    gap: 9,
    padding: 11,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 94, 0.36)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 77, 94, 0.06)",
  },
  consentText: { color: colors.ink, fontSize: font(12), lineHeight: 18 },
  consentActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  seeMoreText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(10),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  overline: {
    marginBottom: 3,
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: font(20),
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  lead: {
    maxWidth: 720,
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: font(11),
    lineHeight: 17,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 94, 0.36)",
    borderRadius: 6,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.emergency,
  },
  badgeText: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  loadingText: { color: colors.inkSoft, fontSize: font(11) },
  emptyText: { color: colors.inkDim, fontSize: font(12), lineHeight: 18 },
  errorText: { color: colors.reported, fontSize: font(11), lineHeight: 17 },
  item: {
    position: "relative",
    overflow: "hidden",
    padding: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.panelSoft,
  },
  itemAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: colors.emergency,
  },
  itemMain: { minWidth: 0, gap: 5 },
  itemTopline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  countdown: {
    color: colors.emergency,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  attenders: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  itemAddress: { color: colors.ink, fontSize: font(14), fontWeight: "700" },
  // CHG-191: mismo registro que el resto de los datos de la tarjeta
  // (mono, versalita), para que se lea como dato y no como titular.
  itemDistance: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  itemDescription: {
    color: colors.inkSoft,
    fontSize: font(12),
    lineHeight: 18,
  },
  attendingNote: {
    marginTop: 3,
    color: colors.alive,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  attendButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.emergency,
  },
  attendButtonText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  loginInvite: {
    gap: 8,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "rgba(137,166,207,0.16)",
  },
  loginInviteText: { color: colors.inkSoft, fontSize: font(11), lineHeight: 17 },
  loginActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  loginButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
    backgroundColor: "rgba(81,229,255,0.05)",
  },
  loginButtonText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
