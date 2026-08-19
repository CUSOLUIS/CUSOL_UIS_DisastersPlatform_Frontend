// CHG-165 — Sección «06 · Verificaciones»: pendientes con
// APROBAR/RECHAZAR (confirmación en dos pasos) y deshabilitados por
// denuncias con REACTIVAR CENTRO (confirmación que anuncia el reinicio
// del ciclo). El backend es quien decide; aquí se refleja.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { CenterVerificationsSection } from "./CenterVerificationsSection";
import type {
  AdminCenterVerification,
  AdminDataSource,
} from "./types";

afterEach(cleanup);

const PENDING: AdminCenterVerification = {
  id: "cc000000-0000-4000-8000-000000000001",
  kind: "collection_center",
  name: "Acopio La Feria",
  locationLabel: "Calle 10 # 5-51",
  municipality: "Bucaramanga",
  department: "Santander",
  latitude: 7.1193,
  longitude: -73.1227,
  description: "Recibe alimentos no perecederos.",
  schedule: null,
  contact: null,
  createdAt: "2026-08-18T14:00:00Z",
  createdByAccountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  verificationStatus: "unverified",
  operationalStatus: "open",
  disabledAt: null,
  verifiedAt: null,
  activeReportsCount: 0,
};

const DISABLED: AdminCenterVerification = {
  ...PENDING,
  id: "cc000000-0000-4000-8000-000000000002",
  name: "Acopio Puerta del Sol",
  operationalStatus: "inactive",
  disabledAt: "2026-08-19T02:00:00Z",
  activeReportsCount: 20,
};

function fakeDataSource(
  overrides: Partial<AdminDataSource> = {},
): AdminDataSource {
  return {
    listCenterVerifications: jest.fn().mockResolvedValue({
      pending: [PENDING],
      disabled: [DISABLED],
    }),
    decideCenterVerification: jest.fn().mockResolvedValue({
      id: PENDING.id,
      verificationStatus: "verified",
      operationalStatus: "open",
      disabledAt: null,
      activeReportsCount: 0,
    }),
    reactivateCenter: jest.fn().mockResolvedValue({
      id: DISABLED.id,
      verificationStatus: "unverified",
      operationalStatus: "open",
      disabledAt: null,
      activeReportsCount: 0,
    }),
    ...overrides,
  } as unknown as AdminDataSource;
}

async function renderSection(dataSource: AdminDataSource) {
  render(<CenterVerificationsSection dataSource={dataSource} />);
  await waitFor(() =>
    expect(screen.getByTestId(`admin-center-${PENDING.id}`)).toBeTruthy(),
  );
}

it("muestra pendientes y deshabilitados con su información", async () => {
  await renderSection(fakeDataSource());

  expect(screen.getByText("Acopio La Feria")).toBeTruthy();
  expect(screen.getByText("Acopio Puerta del Sol")).toBeTruthy();
  expect(screen.getByText(/PENDIENTES DE VERIFICACIÓN · 1/)).toBeTruthy();
  expect(
    screen.getByText(/DESHABILITADOS POR DENUNCIAS · 1/),
  ).toBeTruthy();
  expect(screen.getByText(/20 denuncia\(s\) del ciclo/)).toBeTruthy();
});

it("aprobar pide confirmación y llama al backend con approve", async () => {
  const dataSource = fakeDataSource();
  await renderSection(dataSource);

  fireEvent.press(
    screen.getByLabelText(`Aprobar verificación de ${PENDING.name}`),
  );
  fireEvent.press(
    screen.getByLabelText(`Confirmar aprobación de ${PENDING.name}`),
  );

  await waitFor(() =>
    expect(dataSource.decideCenterVerification).toHaveBeenCalledWith(
      PENDING.id,
      { decision: "approve", reason: undefined },
    ),
  );
  await waitFor(() =>
    expect(screen.getByText(/quedó VERIFICADO/)).toBeTruthy(),
  );
});

it("rechazar guarda el motivo escrito", async () => {
  const dataSource = fakeDataSource();
  await renderSection(dataSource);

  fireEvent.press(
    screen.getByLabelText(`Rechazar verificación de ${PENDING.name}`),
  );
  fireEvent.changeText(
    screen.getByLabelText("Motivo de la decisión"),
    "Dirección inexistente.",
  );
  fireEvent.press(
    screen.getByLabelText(`Confirmar rechazo de ${PENDING.name}`),
  );

  await waitFor(() =>
    expect(dataSource.decideCenterVerification).toHaveBeenCalledWith(
      PENDING.id,
      { decision: "reject", reason: "Dirección inexistente." },
    ),
  );
});

it("REACTIVAR CENTRO confirma anunciando el reinicio del ciclo", async () => {
  const dataSource = fakeDataSource();
  await renderSection(dataSource);

  fireEvent.press(
    screen.getByLabelText(`Reactivar centro ${DISABLED.name}`),
  );
  expect(
    screen.getByText(/contador de denuncias correspondiente/),
  ).toBeTruthy();

  fireEvent.press(
    screen.getByTestId(`admin-center-reactivate-confirm-${DISABLED.id}`),
  );

  await waitFor(() =>
    expect(dataSource.reactivateCenter).toHaveBeenCalledWith(DISABLED.id),
  );
  await waitFor(() =>
    expect(screen.getByText(/fue reactivado/)).toBeTruthy(),
  );
});
