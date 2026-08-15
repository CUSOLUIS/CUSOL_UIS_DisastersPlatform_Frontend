/**
 * CHG-091 — Panel flotante de coincidencias: tarjeta con código,
 * nombre, badge de estado y municipio; acciones según contexto.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { PersonSuggestionsPanel } from "./PersonSuggestionsPanel";
import type { PersonSuggestion } from "./types";

const SUGGESTION: PersonSuggestion = {
  kind: "missing_person",
  id: "persona-demo-1",
  publicCaseCode: "MP-2026-DEMO01",
  displayName: "Camila Rueda (caso demo)",
  status: "missing",
  approximateAge: 34,
  lastSeenAt: "2026-08-10T18:30:00Z",
  lastSeenArea: "Sector Café Madrid",
  municipality: "Bucaramanga",
  department: "Santander",
  publicPhotoUrl: null,
  source: { name: "Demo", sourceType: "citizen", url: null },
  updatedAt: "2026-08-12T10:00:00Z",
  dataClassification: "demonstrative",
  similarity: 0.62,
};

it("pinta código, nombre, estado y municipio, y ofrece ver ficha y aportar", () => {
  const onOpenDetail = jest.fn();
  const onContribute = jest.fn();
  render(
    <PersonSuggestionsPanel
      items={[SUGGESTION]}
      actions={{ mode: "search", onOpenDetail, onContribute }}
    />,
  );

  expect(screen.getByText("MP-2026-DEMO01")).toBeTruthy();
  expect(screen.getByText("Camila Rueda (caso demo)")).toBeTruthy();
  expect(screen.getByText("Desaparecida")).toBeTruthy();
  expect(screen.getByText("Bucaramanga · Sector Café Madrid")).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Ver ficha completa de Camila Rueda (caso demo)",
    }),
  );
  fireEvent.press(
    screen.getByRole("button", {
      name: "Aportar una novedad sobre Camila Rueda (caso demo)",
    }),
  );

  expect(onOpenDetail).toHaveBeenCalledWith(SUGGESTION);
  expect(onContribute).toHaveBeenCalledWith(SUGGESTION);
});

it("en modo duplicados ofrece es-la-misma-persona y continuar", () => {
  const onSamePerson = jest.fn();
  const onDismiss = jest.fn();
  render(
    <PersonSuggestionsPanel
      items={[SUGGESTION]}
      actions={{ mode: "duplicates", onSamePerson, onDismiss }}
    />,
  );

  expect(
    screen.getByText("¿YA ESTÁ REPORTADA? REVISA ANTES DE CONTINUAR"),
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Es la misma persona: abrir el caso de Camila Rueda (caso demo)",
    }),
  );
  fireEvent.press(
    screen.getByRole("button", {
      name: "No es la persona, continuar con el reporte",
    }),
  );

  expect(onSamePerson).toHaveBeenCalledWith(SUGGESTION);
  expect(onDismiss).toHaveBeenCalled();
});

it("sin coincidencias no pinta nada", () => {
  render(
    <PersonSuggestionsPanel
      items={[]}
      actions={{
        mode: "duplicates",
        onSamePerson: jest.fn(),
        onDismiss: jest.fn(),
      }}
    />,
  );

  expect(screen.queryByTestId("person-suggestions-panel")).toBeNull();
});
