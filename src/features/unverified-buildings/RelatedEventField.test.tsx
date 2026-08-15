/**
 * CHG-092 — "Evento relacionado" creable: lista eventos existentes al
 * escribir, fija la selección como chip y ofrece crear cuando el
 * nombre no existe.
 */

import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RelatedEventField } from "./RelatedEventField";
import { SUGGESTIONS_DEBOUNCE_MS } from "../person-suggestions/usePersonSuggestions";
import type { RelatedEventsDataSource } from "./relatedEvents";

jest.useFakeTimers();

const EVENT = {
  id: "77777777-7777-4777-8777-777777777701",
  title: "Sismo en el Centro",
  disasterType: "earthquake",
  verificationStatus: "verified" as const,
  occurredAt: "2026-08-10T06:00:00Z",
  similarity: 0.9,
};

function makeDataSource(items = [EVENT]): RelatedEventsDataSource {
  return {
    transport: "fixture",
    autocomplete: jest.fn().mockResolvedValue({
      items,
      query: "",
      generatedAt: "2026-08-15T12:00:00Z",
    }),
  };
}

async function flushDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(SUGGESTIONS_DEBOUNCE_MS);
  });
}

function Harness({ dataSource }: { dataSource: RelatedEventsDataSource }) {
  const [state, setState] = useState({ eventId: "", eventName: "" });
  return (
    <RelatedEventField
      selectedEventId={state.eventId}
      eventName={state.eventName}
      onSelect={(eventId: string, title: string) =>
        setState({ eventId, eventName: title })
      }
      onNameChange={(eventName: string) =>
        setState({ eventId: "", eventName })
      }
      dataSource={dataSource}
    />
  );
}

it("lista eventos al escribir y fija la selección como chip", async () => {
  const dataSource = makeDataSource();
  render(<Harness dataSource={dataSource} />);

  fireEvent.changeText(
    screen.getByLabelText("Evento relacionado"),
    "Sismo",
  );
  await flushDebounce();

  expect(screen.getByText("Sismo en el Centro")).toBeTruthy();
  expect(screen.getByText("EARTHQUAKE · Verificado")).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Seleccionar el evento Sismo en el Centro",
    }),
  );

  // Chip con el título y botón para quitar la selección.
  expect(screen.getByTestId("related-event-chip")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("button", { name: "Quitar el evento seleccionado" }),
  );
  expect(screen.queryByTestId("related-event-chip")).toBeNull();
});

it("ofrece crear cuando el nombre no coincide exactamente", async () => {
  const dataSource = makeDataSource();
  render(<Harness dataSource={dataSource} />);

  fireEvent.changeText(
    screen.getByLabelText("Evento relacionado"),
    "Vendaval en La Cumbre",
  );
  await flushDebounce();

  expect(
    screen.getByRole("button", {
      name: "Crear nuevo evento: Vendaval en La Cumbre",
    }),
  ).toBeTruthy();
});

it("con coincidencia exacta no ofrece crear duplicado", async () => {
  const dataSource = makeDataSource();
  render(<Harness dataSource={dataSource} />);

  fireEvent.changeText(
    screen.getByLabelText("Evento relacionado"),
    "sismo en el centro",
  );
  await flushDebounce();

  expect(
    screen.queryByRole("button", {
      name: /Crear nuevo evento/,
    }),
  ).toBeNull();
});

it("no consulta con menos de 3 caracteres", async () => {
  const dataSource = makeDataSource();
  render(<Harness dataSource={dataSource} />);

  fireEvent.changeText(screen.getByLabelText("Evento relacionado"), "Si");
  await flushDebounce();

  expect(dataSource.autocomplete).not.toHaveBeenCalled();
  expect(screen.queryByTestId("related-event-options")).toBeNull();
});
