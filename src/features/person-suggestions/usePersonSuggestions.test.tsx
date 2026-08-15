/**
 * CHG-091 — Sugerencias en tiempo real: debounce de 400 ms, disparo
 * con 3+ caracteres y aborto de respuestas viejas.
 */

import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  SUGGESTIONS_DEBOUNCE_MS,
  usePersonSuggestions,
} from "./usePersonSuggestions";
import type {
  PersonSuggestion,
  PersonSuggestionsDataSource,
} from "./types";

jest.useFakeTimers();

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

function makeDataSource() {
  const calls: string[] = [];
  const dataSource: PersonSuggestionsDataSource = {
    transport: "fixture",
    async autocomplete(query) {
      calls.push(`autocomplete:${query}`);
      return {
        items: [SUGGESTION],
        query,
        generatedAt: "2026-08-15T12:00:00Z",
      };
    },
    async checkDuplicates(firstName, lastName) {
      calls.push(`duplicates:${firstName}|${lastName}`);
      return {
        items: [SUGGESTION],
        firstName,
        lastName,
        generatedAt: "2026-08-15T12:00:00Z",
      };
    },
  };
  return { dataSource, calls };
}

function Probe({
  dataSource,
  query,
  firstName,
  lastName,
}: {
  dataSource: PersonSuggestionsDataSource;
  query?: string;
  firstName?: string;
  lastName?: string;
}) {
  const state = usePersonSuggestions({
    dataSource,
    query,
    firstName,
    lastName,
  });
  return (
    <Text testID="probe-state">
      {state.status === "ready"
        ? `ready:${state.items.length}`
        : state.status}
    </Text>
  );
}

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(SUGGESTIONS_DEBOUNCE_MS);
  });
}

it("no dispara con menos de 3 caracteres", async () => {
  const { dataSource, calls } = makeDataSource();
  render(<Probe dataSource={dataSource} query="Ka" />);
  await flush();

  expect(calls).toEqual([]);
  expect(screen.getByTestId("probe-state").children[0]).toBe("idle");
});

it("espera la pausa de 400 ms antes de llamar (debounce)", async () => {
  const { dataSource, calls } = makeDataSource();
  const view = render(<Probe dataSource={dataSource} query="Kam" />);

  // Reescrituras rápidas: cada tecla reinicia el temporizador.
  await act(async () => {
    jest.advanceTimersByTime(SUGGESTIONS_DEBOUNCE_MS - 50);
  });
  view.rerender(<Probe dataSource={dataSource} query="Kami" />);
  await act(async () => {
    jest.advanceTimersByTime(SUGGESTIONS_DEBOUNCE_MS - 50);
  });
  expect(calls).toEqual([]);

  view.rerender(<Probe dataSource={dataSource} query="Kamila" />);
  await flush();

  // Una sola llamada, con el texto final.
  expect(calls).toEqual(["autocomplete:Kamila"]);
  expect(screen.getByTestId("probe-state").children[0]).toBe("ready:1");
});

it("en modo duplicados une nombres y apellidos", async () => {
  const { dataSource, calls } = makeDataSource();
  render(
    <Probe dataSource={dataSource} firstName="Kamila" lastName="Rueda" />,
  );
  await flush();

  expect(calls).toEqual(["duplicates:Kamila|Rueda"]);
});

it("vuelve a idle cuando el texto baja del mínimo", async () => {
  const { dataSource } = makeDataSource();
  const view = render(<Probe dataSource={dataSource} query="Kamila" />);
  await flush();
  expect(screen.getByTestId("probe-state").children[0]).toBe("ready:1");

  view.rerender(<Probe dataSource={dataSource} query="Ka" />);
  await flush();

  expect(screen.getByTestId("probe-state").children[0]).toBe("idle");
});

it("un error del data source no rompe el flujo: queda idle", async () => {
  const dataSource: PersonSuggestionsDataSource = {
    transport: "api",
    autocomplete: () => Promise.reject(new Error("red caída")),
    checkDuplicates: () => Promise.reject(new Error("red caída")),
  };
  render(<Probe dataSource={dataSource} query="Kamila" />);
  await flush();

  expect(screen.getByTestId("probe-state").children[0]).toBe("idle");
});
