import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fontFamilies } from "../../theme";
import { font } from "../../typography";
import type { AidLocationParentCandidate } from "../aid-locations/types";
import { normalizeSearchText } from "./cityCatalog";

// CHG-171 §12-§15, §21, §54 — Popup reusable de selección de centro:
// el mismo componente sirve para el origen (acopios locales) y el
// destino (receptores). Busca por nombre y dirección sobre los
// resultados ya cargados (sin consultas por tecla, §13/§53); cancelar
// conserva la selección previa (§65).

const statusLabel: Record<string, string> = {
  open: "ABIERTO",
  closed: "CERRADO",
  at_capacity: "CAPACIDAD COMPLETA",
  under_observation: "EN OBSERVACIÓN",
};

export function CenterPickerModal({
  visible,
  title,
  candidates,
  selectedId,
  onSelect,
  onClose,
  testIDPrefix,
}: {
  visible: boolean;
  title: string;
  candidates: AidLocationParentCandidate[];
  selectedId: string;
  onSelect: (candidate: AidLocationParentCandidate) => void;
  onClose: () => void;
  testIDPrefix: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = normalizeSearchText(query);
    if (!term) return candidates;
    return candidates.filter((candidate) =>
      normalizeSearchText(
        `${candidate.name} ${candidate.address}`,
      ).includes(term),
    );
  }, [candidates, query]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID={`${testIDPrefix}-modal`}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar la selección de centro"
              onPress={onClose}
              style={styles.close}
              testID={`${testIDPrefix}-close`}
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            accessibilityLabel="Buscar centro"
            placeholder="Buscar centro por nombre o dirección"
            placeholderTextColor="#4b586d"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={styles.search}
            testID={`${testIDPrefix}-search`}
          />
          <Text style={styles.count}>
            {filtered.length === 1
              ? "1 resultado"
              : `${filtered.length} resultados`}
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.length === 0 && (
              <Text style={styles.empty}>
                Ningún centro coincide con la búsqueda.
              </Text>
            )}
            {filtered.map((candidate) => {
              const selected = candidate.id === selectedId;
              return (
                <View
                  key={candidate.id}
                  style={[styles.item, selected && styles.itemSelected]}
                  testID={`${testIDPrefix}-item-${candidate.id}`}
                >
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName}>{candidate.name}</Text>
                    <Text style={styles.itemMeta}>{candidate.address}</Text>
                    <Text style={styles.itemMeta}>
                      {candidate.municipality}, {candidate.department}
                    </Text>
                    <Text style={styles.itemStatus}>
                      {statusLabel[candidate.operationalStatus] ??
                        candidate.operationalStatus.toUpperCase()}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar ${candidate.name}`}
                    onPress={() => onSelect(candidate)}
                    style={styles.selectButton}
                    testID={`${testIDPrefix}-select-${candidate.id}`}
                  >
                    <Text style={styles.selectText}>
                      {selected ? "SELECCIONADO" : "SELECCIONAR"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(3,6,12,0.82)",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "86%",
    gap: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 14,
    backgroundColor: "rgba(9,13,24,0.98)",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamilies.mono,
    fontSize: font(12),
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  close: { marginTop: -4, marginRight: -6, padding: 8, borderRadius: 6 },
  closeGlyph: {
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(13),
    fontWeight: "800",
  },
  search: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(137,166,207,0.22)",
    borderRadius: 8,
    color: colors.ink,
    backgroundColor: "rgba(5,9,17,0.72)",
    fontSize: font(12),
  },
  count: {
    color: colors.inkDim,
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    letterSpacing: 0.6,
  },
  list: { flexGrow: 0 },
  listContent: { gap: 10, paddingBottom: 4 },
  empty: { color: colors.inkDim, fontSize: font(11), lineHeight: 17 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: "rgba(5,9,17,0.55)",
  },
  itemSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(81,229,255,0.10)",
  },
  itemCopy: { minWidth: 0, flex: 1, gap: 2 },
  itemName: { color: colors.ink, fontSize: font(12), fontWeight: "700" },
  itemMeta: { color: colors.inkDim, fontSize: font(10), lineHeight: 15 },
  itemStatus: {
    marginTop: 2,
    color: colors.inkSoft,
    fontFamily: fontFamilies.mono,
    fontSize: font(8),
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  selectButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: colors.cyan,
  },
  selectText: {
    color: "#07101b",
    fontFamily: fontFamilies.mono,
    fontSize: font(9),
    fontWeight: "900",
    letterSpacing: 0.6,
  },
});
