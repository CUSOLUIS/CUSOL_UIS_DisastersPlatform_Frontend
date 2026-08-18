// CHG-154 — Sección «Personas» de la consola: listar con filtros,
// ocultar con confirmación (reversible), restaurar desde la vista de
// ocultos y editar con el estado bloqueado cuando hay caso vinculado.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { PeopleRecordsAdminSection } from "./PeopleRecordsAdminSection";
import type { AdminDataSource, AdminPersonRecord } from "./types";

afterEach(cleanup);

const LINKED_PERSON: AdminPersonRecord = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
  displayName: "Marina Rueda",
  status: "missing",
  location: "Bucaramanga, Santander",
  relatedEvent: "Deslizamiento Mesa de los Santos",
  latitude: 7.1,
  longitude: -73.1,
  hasLinkedCase: true,
  source: { name: "Reporte ciudadano", sourceType: "citizen", url: null },
  createdAt: "2026-08-10T10:00:00Z",
  updatedAt: "2026-08-10T10:00:00Z",
  hiddenAt: null,
  hiddenBy: null,
};

const SEED_PERSON: AdminPersonRecord = {
  ...LINKED_PERSON,
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
  displayName: "Aurelio Prada",
  status: "confirmed_alive",
  hasLinkedCase: false,
  source: { name: "Registro oficial", sourceType: "official", url: null },
};

function sectionDataSource(
  overrides: Partial<AdminDataSource> = {},
): AdminDataSource {
  return {
    listPeople: jest
      .fn()
      .mockResolvedValue({ items: [LINKED_PERSON, SEED_PERSON], total: 2 }),
    updatePerson: jest.fn().mockResolvedValue(LINKED_PERSON),
    hidePerson: jest.fn().mockResolvedValue({
      ...LINKED_PERSON,
      hiddenAt: "2026-08-18T11:00:00Z",
      hiddenBy: "Admin CUSOL",
    }),
    restorePerson: jest.fn().mockResolvedValue(LINKED_PERSON),
    ...overrides,
  } as unknown as AdminDataSource;
}

it("lista con los filtros del pedido (desaparecidos y confirmados vivos, visibles)", async () => {
  const dataSource = sectionDataSource();
  render(<PeopleRecordsAdminSection dataSource={dataSource} />);

  await waitFor(() =>
    expect(screen.getByText("Marina Rueda")).toBeTruthy(),
  );
  expect(dataSource.listPeople).toHaveBeenCalledWith(
    expect.objectContaining({
      statuses: ["missing", "confirmed_alive"],
      visibility: "visible",
      limit: 25,
      offset: 0,
    }),
  );
  expect(screen.getByText("Aurelio Prada")).toBeTruthy();
  expect(screen.getByText("2 REGISTRO(S)")).toBeTruthy();
});

it("oculta un registro tras la confirmación y recarga", async () => {
  const dataSource = sectionDataSource();
  const onMutated = jest.fn();
  render(
    <PeopleRecordsAdminSection
      dataSource={dataSource}
      onMutated={onMutated}
    />,
  );

  await waitFor(() =>
    expect(screen.getByText("Marina Rueda")).toBeTruthy(),
  );
  fireEvent.press(
    screen.getByLabelText("Ocultar el registro de Marina Rueda"),
  );
  // Nada viaja sin la confirmación explícita.
  expect(dataSource.hidePerson).not.toHaveBeenCalled();
  expect(
    screen.getByText(/No se borra nada: el registro deja de verse/),
  ).toBeTruthy();

  fireEvent.press(
    screen.getByLabelText("Confirmar ocultar a Marina Rueda"),
  );
  await waitFor(() =>
    expect(dataSource.hidePerson).toHaveBeenCalledWith(LINKED_PERSON.id),
  );
  await waitFor(() => expect(onMutated).toHaveBeenCalled());
  expect(dataSource.listPeople).toHaveBeenCalledTimes(2);
});

it("edita campos y bloquea el estado cuando hay caso vinculado", async () => {
  const dataSource = sectionDataSource();
  render(<PeopleRecordsAdminSection dataSource={dataSource} />);

  await waitFor(() =>
    expect(screen.getByText("Marina Rueda")).toBeTruthy(),
  );
  fireEvent.press(
    screen.getByLabelText("Editar el registro de Marina Rueda"),
  );
  // Con caso vinculado no hay selector de estado, solo la explicación.
  expect(
    screen.getByText(/lo derivan las novedades verificadas/),
  ).toBeTruthy();

  fireEvent.changeText(
    screen.getByLabelText("Nombre público"),
    "Marina Rueda Gómez",
  );
  fireEvent.press(
    screen.getByLabelText("Guardar cambios de Marina Rueda"),
  );
  await waitFor(() =>
    expect(dataSource.updatePerson).toHaveBeenCalledWith(LINKED_PERSON.id, {
      displayName: "Marina Rueda Gómez",
    }),
  );
});

it("permite editar el estado en registros sembrados sin caso", async () => {
  const dataSource = sectionDataSource();
  render(<PeopleRecordsAdminSection dataSource={dataSource} />);

  await waitFor(() =>
    expect(screen.getByText("Aurelio Prada")).toBeTruthy(),
  );
  fireEvent.press(
    screen.getByLabelText("Editar el registro de Aurelio Prada"),
  );
  fireEvent.press(screen.getByLabelText("Estado Desaparecida"));
  fireEvent.press(
    screen.getByLabelText("Guardar cambios de Aurelio Prada"),
  );
  await waitFor(() =>
    expect(dataSource.updatePerson).toHaveBeenCalledWith(SEED_PERSON.id, {
      status: "missing",
    }),
  );
});

it("muestra los ocultos con su rastro y permite restaurar", async () => {
  const hidden: AdminPersonRecord = {
    ...LINKED_PERSON,
    hiddenAt: "2026-08-18T11:00:00Z",
    hiddenBy: "Admin CUSOL",
  };
  const dataSource = sectionDataSource({
    listPeople: jest.fn().mockResolvedValue({ items: [hidden], total: 1 }),
  });
  render(<PeopleRecordsAdminSection dataSource={dataSource} />);

  await waitFor(() =>
    expect(screen.getByText("Marina Rueda")).toBeTruthy(),
  );
  fireEvent.press(screen.getByLabelText("Ver registros ocultos"));
  await waitFor(() =>
    expect(dataSource.listPeople).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibility: "hidden" }),
    ),
  );
  expect(screen.getByText("OCULTO")).toBeTruthy();
  expect(screen.getByText(/oculto por Admin CUSOL/)).toBeTruthy();

  fireEvent.press(
    screen.getByLabelText("Restaurar el registro de Marina Rueda"),
  );
  await waitFor(() =>
    expect(dataSource.restorePerson).toHaveBeenCalledWith(LINKED_PERSON.id),
  );
});
