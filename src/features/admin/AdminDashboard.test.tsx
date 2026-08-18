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
    // CHG-159: borrado definitivo.
    deleteSubmissionPermanently: jest.fn().mockResolvedValue({
      id: submission.id,
      auditEventId: "30000000-0000-4000-8000-000000000005",
      deletedAt: "2026-08-14T14:00:00Z",
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
    listVisitorPresence: jest.fn().mockResolvedValue({
      items: [
        {
          presenceId: "50000000-0000-4000-8000-000000000001",
          latitude: 7.1193,
          longitude: -73.1227,
          accuracyMeters: 18,
          platform: "android",
          authenticated: true,
          firstSeenAt: "2026-08-14T13:50:00Z",
          updatedAt: "2026-08-14T14:00:00Z",
        },
      ],
      total: 1,
      windowMinutes: 30,
      generatedAt: "2026-08-14T14:00:00Z",
    }),
    // CHG-126: métricas del sistema para la sección 06.
    getSystemMetrics: jest.fn().mockResolvedValue({
      intervalSeconds: 5,
      latest: systemMetricsSample("2026-08-14T14:00:00Z"),
      series: [
        systemMetricsSample("2026-08-14T13:59:55Z"),
        systemMetricsSample("2026-08-14T14:00:00Z"),
      ],
      generatedAt: "2026-08-14T14:00:00Z",
    }),
    // CHG-138: gestión de solicitudes de ayuda.
    listHelpRequests: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      generatedAt: "2026-08-17T12:00:00Z",
    }),
    listHelpRequestVolunteers: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      generatedAt: "2026-08-17T12:00:00Z",
    }),
    deleteHelpRequest: jest.fn().mockResolvedValue({ deleted: 1 }),
    purgeHelpRequests: jest.fn().mockResolvedValue({ deleted: 0 }),
    // CHG-154: registros de personas.
    listPeople: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    updatePerson: jest.fn(),
    hidePerson: jest.fn(),
    restorePerson: jest.fn(),
    resetPlatform: jest.fn().mockResolvedValue({
      tablesCleared: 21,
      accountsDeleted: 6,
      generatedAt: "2026-08-17T12:00:00Z",
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };
}

function systemMetricsSample(sampledAt: string) {
  return {
    sampledAt,
    cpuPercent: 21.5,
    cpuTemperatureCelsius: 48.2,
    load1m: 0.8,
    load5m: 0.6,
    load15m: 0.5,
    memoryTotalBytes: 8 * 1024 ** 3,
    memoryUsedBytes: 3 * 1024 ** 3,
    memoryAvailableBytes: 5 * 1024 ** 3,
    swapTotalBytes: 2 * 1024 ** 3,
    swapUsedBytes: 256 * 1024 ** 2,
    diskTotalBytes: 160 * 1024 ** 3,
    diskUsedBytes: 100 * 1024 ** 3,
    diskFreeBytes: 60 * 1024 ** 3,
    networkRxBytesPerSecond: 120_000,
    networkTxBytesPerSecond: 45_000,
    uptimeSeconds: 86_400 * 3 + 3_600 * 5,
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
      await screen.findByRole("header", {
        name: "Sesión administrativa requerida",
      }),
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

    // CHG-159: archivar se presenta como deshabilitación reversible.
    fireEvent.press(
      screen.getByRole("button", { name: "Deshabilitar (archivar) expediente" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Confirmar Deshabilitar (archivar)" }),
    );

    await waitFor(() =>
      expect(dataSource.archiveSubmission).toHaveBeenCalledWith(submission.id, {
        expectedVersion: 1,
        reason: "Corrección verificada por moderación",
      }),
    );
    expect(await screen.findByText("Deshabilitar (archivar) aplicado y auditado.")).toBeTruthy();
  });

  it("filtra la bandeja por tema y por subtema (CHG-159)", async () => {
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
    await screen.findByRole("button", {
      name: "Abrir expediente BR-2026-TEST",
    });

    fireEvent.press(screen.getByRole("button", { name: "Ayuda humanitaria" }));
    await waitFor(() =>
      expect(dataSource.listSubmissions).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "ayuda", kind: undefined }),
        undefined,
      ),
    );
    // El enlace cruzado evita duplicar la gestión de «Necesitamos ayuda».
    expect(
      screen.getByRole("button", {
        name: "Abrir la sección de solicitudes Necesitamos ayuda",
      }),
    ).toBeTruthy();

    // El subtema manda sobre el tema al consultar.
    fireEvent.press(screen.getByRole("button", { name: "Comida comunitaria" }));
    await waitFor(() =>
      expect(dataSource.listSubmissions).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "community_meal_offer",
          theme: undefined,
        }),
        undefined,
      ),
    );
  });

  it("elimina definitivamente un expediente deshabilitado (CHG-159)", async () => {
    const dataSource = createDataSource();
    dataSource.getSubmission = jest.fn().mockResolvedValue({
      ...submission,
      status: "archived",
      availableActions: ["restore", "delete"],
    });

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
      screen.getByLabelText("Motivo administrativo"),
      "Expediente duplicado; retiro definitivo.",
    );
    fireEvent.press(
      screen.getByRole("button", {
        name: "Eliminar definitivamente expediente",
      }),
    );
    expect(screen.getByText(/IRREVERSIBLE/)).toBeTruthy();
    fireEvent.press(
      screen.getByRole("button", {
        name: "Confirmar Eliminar definitivamente",
      }),
    );

    await waitFor(() =>
      expect(dataSource.deleteSubmissionPermanently).toHaveBeenCalledWith(
        submission.id,
        {
          expectedVersion: 1,
          reason: "Expediente duplicado; retiro definitivo.",
        },
      ),
    );
    // El modal se cierra: el expediente ya no existe.
    await waitFor(() =>
      expect(
        screen.queryByRole("header", { name: submission.title }),
      ).toBeNull(),
    );
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
