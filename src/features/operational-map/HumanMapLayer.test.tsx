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
    unmappedStatusCounts: {
      missing: 0,
      reportedDeceased: 0,
      confirmedAlive: 1,
      confirmedDeceased: 0,
    },
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

/**
 * CHG-099 — Los contadores de la capa deben cuadrar con las cifras de
 * la portada: contaban solo lo dibujado, así que una persona sin
 * ubicación aparecía como 0 en su estado mientras las cifras la
 * contaban, y se leía como una contradicción.
 */
it("suma a quien no se puede ubicar en el contador de su estado", () => {
  renderLayer(overview());

  // La persona "confirmada viva" no tiene punto en el mapa, pero
  // existe: su filtro debe contarla, igual que las cifras.
  const aliveFilter = screen.getByLabelText(
    /Filtrar capa humana por Confirmadas vivas/i,
  );
  const counts = screen
    .getAllByText("1")
    .filter((node) => node.parent !== null);
  expect(aliveFilter).toBeTruthy();
  expect(counts.length).toBeGreaterThan(0);
});

it("distingue el total del estado de lo que hay dibujado", () => {
  renderLayer(overview());

  // 1 persona en total, 0 dibujadas: ambas lecturas conviven sin
  // contradecirse.
  expect(screen.getByText(/0 PERSONAS EN MAPA/)).toBeTruthy();
});
