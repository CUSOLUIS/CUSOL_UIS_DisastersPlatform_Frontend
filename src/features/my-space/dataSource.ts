import { Platform } from "react-native";
import type {
  MySpaceDataSource,
  MyReportsPage,
  VolunteerAlert,
  VolunteerAlertInput,
  VolunteerAlertPage,
} from "./types";

// CHG-069 — "Mi espacio". La API real exige la cookie de sesión; el
// modo demo permite trabajar la interfaz sin backend.

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class MySpaceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MySpaceApiError";
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (apiBaseUrl === undefined) {
    throw new MySpaceApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para usar Mi espacio desde un dispositivo móvil.",
      503,
    );
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let detail: string | null = null;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : null;
    } catch {
      detail = null;
    }
    throw new MySpaceApiError(
      detail ?? `Mi espacio respondió con estado ${response.status}.`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

const apiMySpaceDataSource: MySpaceDataSource = {
  transport: "api",
  getMyReports: (signal) =>
    apiRequest<MyReportsPage>("/api/v1/me/reports", { signal }),
  listVolunteerAlerts: (signal) =>
    apiRequest<VolunteerAlertPage>("/api/v1/me/volunteer-alerts", { signal }),
  createVolunteerAlert: (input: VolunteerAlertInput) =>
    apiRequest<VolunteerAlert>("/api/v1/me/volunteer-alerts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  resolveVolunteerAlert: (id) =>
    apiRequest<VolunteerAlert>(`/api/v1/me/volunteer-alerts/${id}/resolve`, {
      method: "POST",
    }),
};

function nowIso() {
  return new Date().toISOString();
}

const demoAlerts: VolunteerAlert[] = [
  {
    id: "e1b0c1d2-1111-4a2b-8c3d-000000000001",
    description:
      "Se necesitan manos para clasificar donaciones en el punto de acopio.",
    address: "Carrera 27 #9-30, Bucaramanga",
    latitude: 7.1398,
    longitude: -73.1211,
    status: "active",
    createdAt: "2026-08-14T15:00:00Z",
    updatedAt: "2026-08-14T15:00:00Z",
  },
];

const demoMySpaceDataSource: MySpaceDataSource = {
  transport: "demo",
  async getMyReports() {
    return {
      items: [
        {
          id: "f2c1d2e3-2222-4b3c-9d4e-000000000001",
          kind: "missing_person_report",
          referenceCode: "MP-2026-DEMO0001",
          title: "Reporte demostrativo",
          status: "under_review",
          receivedAt: "2026-08-13T10:00:00Z",
          novelties: [
            {
              claimedOutcome: "found",
              moderationStatus: "under_review",
              receivedAt: "2026-08-14T09:30:00Z",
            },
          ],
        },
      ],
      total: 1,
      generatedAt: nowIso(),
    };
  },
  async listVolunteerAlerts() {
    return {
      items: [...demoAlerts],
      total: demoAlerts.length,
      generatedAt: nowIso(),
    };
  },
  async createVolunteerAlert(input) {
    const alert: VolunteerAlert = {
      id: `demo-${demoAlerts.length + 1}`,
      description: input.description,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    demoAlerts.unshift(alert);
    return alert;
  },
  async resolveVolunteerAlert(id) {
    const alert = demoAlerts.find((item) => item.id === id);
    if (!alert) {
      throw new MySpaceApiError("La alerta no existe.", 404);
    }
    alert.status = "resolved";
    alert.updatedAt = nowIso();
    return { ...alert };
  },
};

// Igual que el resto de la plataforma: API real por defecto; `demo`
// solo cuando se pide explícitamente (trabajo sin backend).
const requestedMode = process.env.EXPO_PUBLIC_MY_SPACE_DATA_MODE;
export const mySpaceDataSource =
  requestedMode === "demo" ? demoMySpaceDataSource : apiMySpaceDataSource;

export { apiMySpaceDataSource, demoMySpaceDataSource };
