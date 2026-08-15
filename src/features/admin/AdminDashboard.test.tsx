import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { AdminDashboard } from "./AdminDashboard";
import { AdminApiError } from "./dataSource";
import type {
  AdminAccountDetail,
  AdminDataSource,
  AdminSubmissionDetail,
} from "./types";

afterEach(cleanup);

const account: AdminAccountDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Administrador CUSOL",
  email: "admin@cusol.local",
  assignedRole: "super_admin",
  status: "active",
  activeSessions: 1,
  createdAt: "2026-08-14T12:00:00Z",
  updatedAt: "2026-08-14T12:00:00Z",
  version: 1,
  department: "Santander",
  municipality: "Bucaramanga",
  requestedAccountType: "citizen",
  organizationName: null,
  organizationRole: null,
};

const submission: AdminSubmissionDetail = {
  id: "10000000-0000-4000-8000-000000000001",
  kind: "unverified_building_report",
  trackingCode: "BR-2026-TEST",
  title: "Edificio en revisión",
  locationLabel: "Bucaramanga, Santander",
  status: "under_review",
  sourceLabel: "Reporte ciudadano",
  evidenceCount: 1,
  receivedAt: "2026-08-14T13:00:00Z",
  updatedAt: "2026-08-14T13:00:00Z",
  version: 1,
  fields: [
    {
      key: "buildingReference",
      label: "Referencia del edificio",
      displayValue: "Torre norte",
      editValue: "Torre norte",
      classification: "private",
      editable: true,
      inputKind: "text",
    },
  ],
  evidence: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      mediaType: "image/jpeg",
      sizeBytes: 1024,
      scanStatus: "safe",
      createdAt: "2026-08-14T13:00:00Z",
    },
  ],
  availableActions: ["accept", "reject", "request_changes", "archive"],
};

function createDataSource(
  role: "user" | "super_admin" = "super_admin",
): AdminDataSource {
  return {
    transport: "demo",
    getCurrentAccount: jest.fn().mockResolvedValue({
      id: account.id,
      displayName: account.displayName,
      email: account.email,
      assignedRole: role,
      status: "active",
      sessionExpiresAt: "2026-08-15T12:00:00Z",
    }),
    getOverview: jest.fn().mockResolvedValue({
      underReview: 1,
      needsInformation: 0,
      acceptedToday: 2,
      archived: 0,
      activeAccounts: 1,
      suspendedAccounts: 0,
      oldestPendingAt: submission.receivedAt,
      byKind: [{ kind: submission.kind, count: 1 }],
      recentActivity: [],
      generatedAt: "2026-08-14T14:00:00Z",
    }),
    listSubmissions: jest.fn().mockResolvedValue({
      items: [submission],
      total: 1,
      limit: 25,
      offset: 0,
      generatedAt: "2026-08-14T14:00:00Z",
    }),
    getSubmission: jest.fn().mockResolvedValue(submission),
    updateSubmission: jest.fn().mockResolvedValue(submission),
    decideSubmission: jest.fn().mockResolvedValue({
      id: submission.id,
      status: "accepted",
      version: 2,
      auditEventId: "30000000-0000-4000-8000-000000000001",
      updatedAt: "2026-08-14T14:00:00Z",
    }),
    archiveSubmission: jest.fn().mockResolvedValue({
      id: submission.id,
      status: "archived",
      version: 2,
      auditEventId: "30000000-0000-4000-8000-000000000002",
      updatedAt: "2026-08-14T14:00:00Z",
    }),
    restoreSubmission: jest.fn().mockResolvedValue({
      id: submission.id,
      status: "under_review",
      version: 2,
      auditEventId: "30000000-0000-4000-8000-000000000003",
      updatedAt: "2026-08-14T14:00:00Z",
    }),
    grantEvidenceAccess: jest.fn().mockResolvedValue({
      url: "https://example.invalid/evidence",
      expiresAt: "2026-08-14T14:05:00Z",
      auditEventId: "30000000-0000-4000-8000-000000000004",
    }),
    listAccounts: jest.fn().mockResolvedValue({
      items: [account],
      total: 1,
      limit: 25,
      offset: 0,
      generatedAt: "2026-08-14T14:00:00Z",
    }),
    getAccount: jest.fn().mockResolvedValue(account),
    updateAccount: jest.fn().mockResolvedValue(account),
    revokeAccountSessions: jest.fn().mockResolvedValue(undefined),
    listAudit: jest.fn().mockResolvedValue({
      items: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          actorAccountId: account.id,
          actorDisplayName: account.displayName,
          action: "submission_updated",
          resourceKind: submission.kind,
          resourceId: submission.id,
          result: "success",
          reasonSummary: "Validación administrativa",
          occurredAt: "2026-08-14T14:00:00Z",
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
      generatedAt: "2026-08-14T14:00:00Z",
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
}

describe("AdminDashboard", () => {
  it("no carga información administrativa si el servidor no confirma super_admin", async () => {
    const dataSource = createDataSource("user");

    render(
      <AdminDashboard
        dataSource={dataSource}
        onHome={jest.fn()}
        onLogin={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole("header", {
        name: "Acceso administrativo denegado",
      }),
    ).toBeTruthy();
    expect(dataSource.getOverview).not.toHaveBeenCalled();
  });

  it("retira de inmediato la data si una consulta informa sesión vencida", async () => {
    const dataSource = createDataSource();
    dataSource.getOverview = jest
      .fn()
      .mockRejectedValue(new AdminApiError("Sesión vencida", 401));

    render(
      <AdminDashboard
        dataSource={dataSource}
        onHome={jest.fn()}
        onLogin={jest.fn()}
      />,
    );

    expect(
      // El gate de sesión aparece tras varios ciclos de render (ready →
      // carga → 401 → error); en runners lentos supera el segundo del
      // timeout por defecto sin que sea un fallo funcional.
      await screen.findByRole(
        "header",
        { name: "Sesión administrativa requerida" },
        { timeout: 10000 },
      ),
    ).toBeTruthy();
    expect(screen.queryByText("DATOS DEMOSTRATIVOS")).toBeNull();
  });

  it("presenta resumen, cuentas y auditoría con datos demo rotulados", async () => {
    const dataSource = createDataSource();

    render(
      <AdminDashboard
        dataSource={dataSource}
        onHome={jest.fn()}
        onLogin={jest.fn()}
      />,
    );

    expect(
      await screen.findByRole("header", { name: "Panorama de control" }),
    ).toBeTruthy();
    expect(screen.getByText("DATOS DEMOSTRATIVOS")).toBeTruthy();

    fireEvent.press(screen.getByRole("tab", { name: "Cuentas" }));
    expect(
      await screen.findByRole("button", {
        name: "Administrar cuenta Administrador CUSOL",
      }),
    ).toBeTruthy();

    fireEvent.press(screen.getByRole("tab", { name: "Auditoría" }));
    expect(await screen.findByText("Submission Updated")).toBeTruthy();
  });

  it("edita y archiva un expediente enviando versión y motivo", async () => {
    const dataSource = createDataSource();

    render(
      <AdminDashboard
        dataSource={dataSource}
        onHome={jest.fn()}
        onLogin={jest.fn()}
      />,
    );

    await screen.findByRole("header", { name: "Panorama de control" });
    fireEvent.press(screen.getByRole("tab", { name: "Ingresos" }));
    fireEvent.press(
      await screen.findByRole("button", {
        name: "Abrir expediente BR-2026-TEST",
      }),
    );

    await screen.findByRole("header", { name: submission.title });
    fireEvent.changeText(
      screen.getByLabelText("Editar Referencia del edificio"),
      "Torre norte actualizada",
    );
    fireEvent.changeText(
      screen.getByLabelText("Motivo administrativo"),
      "Corrección verificada por moderación",
    );
    fireEvent.press(
      screen.getByRole("button", {
        name: "Guardar cambios del expediente",
      }),
    );

    await waitFor(() =>
      expect(dataSource.updateSubmission).toHaveBeenCalledWith(submission.id, {
        expectedVersion: 1,
        reason: "Corrección verificada por moderación",
        changes: [
          { field: "buildingReference", value: "Torre norte actualizada" },
        ],
      }),
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Archivar expediente" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Confirmar Archivar" }),
    );

    await waitFor(() =>
      expect(dataSource.archiveSubmission).toHaveBeenCalledWith(submission.id, {
        expectedVersion: 1,
        reason: "Corrección verificada por moderación",
      }),
    );
    expect(await screen.findByText("Archivar aplicado y auditado.")).toBeTruthy();
  });

  it("cierra la sesión antes de enviar al formulario de acceso", async () => {
    const dataSource = createDataSource();
    const onLogin = jest.fn();

    render(
      <AdminDashboard
        dataSource={dataSource}
        onHome={jest.fn()}
        onLogin={onLogin}
      />,
    );

    fireEvent.press(
      await screen.findByRole("button", {
        name: "Cerrar sesión administrativa",
      }),
    );
    await waitFor(() => expect(dataSource.logout).toHaveBeenCalledTimes(1));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
