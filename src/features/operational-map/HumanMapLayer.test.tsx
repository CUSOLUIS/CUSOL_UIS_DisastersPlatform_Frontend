/**
 * CHG-098 — Cuando una persona registrada no tiene ubicación, el mapa
 * no la dibuja (no se inventan posiciones) pero sí explica por qué, de
 * forma legible: fue lo que hizo pensar que el registro "desaparecía".
 */

import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { HumanMapControls } from "./OperationalMapPanel";
import { humanMapStatuses } from "./types";
import type { HumanMapOverview } from "./types";

function overview(overrides: Partial<HumanMapOverview> = {}) {
  return {
    features: [],
    totalMatched: 1,
    totalMapped: 0,
    unmappedCount: 1,
    returnedFeatures: 0,
    nextCursor: null,
    generatedAt: "2026-08-15T12:00:00Z",
    dataClassification: "operational" as const,
    ...overrides,
  };
}

function renderLayer(data: HumanMapOverview) {
  render(
    <HumanMapControls
      data={data}
      loadState={{ status: "success", data, stale: false, refreshing: false }}
      layerVisible
      activeStatuses={[...humanMapStatuses]}
      onToggleLayer={jest.fn()}
      onToggleStatus={jest.fn()}
      onRetry={jest.fn()}
      selectedFeature={null}
    />,
  );
}

it("explica que la persona sin ubicación sigue contando en las cifras", () => {
  renderLayer(overview());

  expect(
    screen.getByText(/no aparece en el mapa/i),
  ).toBeTruthy();
  expect(screen.getByText(/no incluyó ubicación/i)).toBeTruthy();
  expect(screen.getByText(/Siguen contando en las/i)).toBeTruthy();
});

it("el aviso se lee: nada por debajo del piso legible", () => {
  renderLayer(overview());

  const notice = screen.getByText(/no aparece en el mapa/i);
  const style = StyleSheet.flatten(notice.props.style);
  // CHG-090 fijó 11 px como piso; este panel estaba en 8.
  expect(style.fontSize).toBeGreaterThanOrEqual(11);
});

it("sin registros sin ubicación no muestra el aviso", () => {
  renderLayer(overview({ totalMatched: 1, totalMapped: 1, unmappedCount: 0 }));

  expect(screen.queryByText(/no aparece en el mapa/i)).toBeNull();
});
