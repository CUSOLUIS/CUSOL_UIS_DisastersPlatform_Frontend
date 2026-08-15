import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { LazyImage } from "../../components/LazyImage";
import { resolvePublicMediaUrl } from "../media/publicMediaUrl";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import type { PersonSuggestion } from "./types";

// CHG-091 — Panel flotante de coincidencias: se pinta justo debajo del
// input que lo dispara. Cada tarjeta trae miniatura (diferida, CHG-090),
// nombre + código, badge de estado y municipio. Las acciones cambian
// según el contexto: buscador (ver ficha / aportar novedad) o
// formulario de reporte (es la misma persona / continuar).

export const personStatusLabels: Record<PersonSuggestion["status"], string> = {
  missing: "Desaparecida",
  found: "Encontrada",
  deceased: "Fallecida",
};

interface SearchActions {
  mode: "search";
  onOpenDetail: (item: PersonSuggestion) => void;
  onContribute: (item: PersonSuggestion) => void;
}

interface DuplicateActions {
  mode: "duplicates";
  onSamePerson: (item: PersonSuggestion) => void;
  onDismiss: () => void;
}

type PanelActions = SearchActions | DuplicateActions;

export function PersonSuggestionsPanel({
  items,
  actions,
}: {
  items: PersonSuggestion[];
  actions: PanelActions;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View
      testID="person-suggestions-panel"
      accessibilityLabel={
        actions.mode === "search"
          ? "Personas que coinciden con tu búsqueda"
          : "Personas ya registradas con nombre similar"
      }
      style={styles.panel}
    >
      <Text style={styles.title}>
        {actions.mode === "search"
          ? "COINCIDENCIAS REGISTRADAS"
          : "¿YA ESTÁ REPORTADA? REVISA ANTES DE CONTINUAR"}
      </Text>

      {items.map((item) => (
        <View
          key={item.id}
          testID={`person-suggestion-${item.id}`}
          style={styles.card}
        >
          <View style={styles.cardMain}>
            {resolvePublicMediaUrl(item.publicPhotoUrl) ? (
              <LazyImage
                containerStyle={styles.avatar}
                placeholder={<SuggestionPersonIcon />}
                accessibilityLabel={`Fotografía pública autorizada de ${item.displayName}`}
                source={{ uri: resolvePublicMediaUrl(item.publicPhotoUrl)! }}
                resizeMode="cover"
                style={styles.photo}
              />
            ) : (
              <View style={styles.avatar}>
                <SuggestionPersonIcon />
              </View>
            )}
            <View style={styles.copy}>
              <View style={styles.metaRow}>
                <Text style={styles.caseCode}>{item.publicCaseCode}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    item.status === "missing" && styles.statusMissing,
                  ]}
                >
                  {personStatusLabels[item.status]}
                </Text>
              </View>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.place}>
                {item.municipality} · {item.lastSeenArea}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            {actions.mode === "search" ? (
              <>
                <SuggestionButton
                  label="VER FICHA COMPLETA"
                  accessibilityLabel={`Ver ficha completa de ${item.displayName}`}
                  onPress={() => actions.onOpenDetail(item)}
                />
                <SuggestionButton
                  label="+ APORTAR NOVEDAD"
                  accessibilityLabel={`Aportar una novedad sobre ${item.displayName}`}
                  onPress={() => actions.onContribute(item)}
                />
              </>
            ) : (
              <SuggestionButton
                label="ES LA MISMA PERSONA"
                accessibilityLabel={`Es la misma persona: abrir el caso de ${item.displayName}`}
                emphasized
                onPress={() => actions.onSamePerson(item)}
              />
            )}
          </View>
        </View>
      ))}

      {actions.mode === "duplicates" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="No es la persona, continuar con el reporte"
          onPress={actions.onDismiss}
          style={({ pressed }) => [
            styles.dismiss,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.dismissText}>
            NO ES LA PERSONA / CONTINUAR
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function SuggestionButton({
  label,
  accessibilityLabel,
  emphasized = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  emphasized?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        emphasized && styles.actionButtonEmphasized,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          emphasized && styles.actionTextEmphasized,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SuggestionPersonIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={colors.missing} strokeWidth={1.6} />
      <Path
        d="M4 20c1.4-3.4 4.4-5 8-5s6.6 1.6 8 5"
        stroke={colors.missing}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    marginTop: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(81,229,255,0.28)",
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  title: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  card: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.panelSoft,
  },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,207,102,0.26)",
    borderRadius: 22,
    backgroundColor: "rgba(255,207,102,0.06)",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%", borderRadius: 22 },
  copy: { flex: 1, gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  caseCode: {
    color: colors.missing,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "900",
  },
  statusBadge: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
  },
  statusMissing: {
    color: colors.missing,
    borderColor: "rgba(255,207,102,0.3)",
  },
  name: {
    color: colors.ink,
    fontSize: font(15),
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  place: { color: colors.inkSoft, fontSize: font(12), lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 7,
    backgroundColor: "rgba(81,229,255,0.04)",
  },
  actionButtonEmphasized: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyan,
  },
  actionText: {
    color: colors.cyan,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  actionTextEmphasized: { color: "#06101a" },
  dismiss: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
  },
  dismissText: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(11),
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
