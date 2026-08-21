import { Platform } from "react-native";
import type {
  ActiveHelpRequest,
  HelpRequestAttendersPage,
  HelpRequestAttendReceipt,
  HelpRequestPage,
  HelpRequestsDataSource,
} from "./types";

// CHG-125 — Solicitudes «Necesitamos ayuda». La lista activa es
// pública; «Atender solicitud» exige la cookie de sesión. El modo demo
// permite trabajar la interfaz sin backend, con atención idempotente
// igual que la real (DEC-125-03).

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const apiBaseUrl =
  configuredApiBaseUrl ?? (Platform.OS === "web" ? "" : undefined);

export class HelpRequestsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HelpRequestsApiError";
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (apiBaseUrl === undefined) {
    throw new HelpRequestsApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar las solicitudes de ayuda desde un dispositivo móvil.",
      503,
    );
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    // La cookie de sesión (si existe) marca attendedByMe y habilita
    // «Atender solicitud»; sin sesión la lista sigue siendo pública.
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    let detail: string | null;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : null;
    } catch {
      detail = null;
    }
    throw new HelpRequestsApiError(
      detail ?? `Las solicitudes de ayuda respondieron con estado ${response.status}.`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

// CHG-196 — Mutación que responde 204: mismas cabeceras y misma
// cookie que `apiRequest`, pero sin intentar leer un cuerpo que no
// existe. Los errores se traducen igual.
async function apiRequestNoContent(
  path: string,
  init: RequestInit = {},
): Promise<void> {
  if (apiBaseUrl === undefined) {
    throw new HelpRequestsApiError(
      "Configura EXPO_PUBLIC_API_BASE_URL para consultar las solicitudes de ayuda desde un dispositivo móvil.",
      503,
    );
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  if (!response.ok) {
    let detail: string | null;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : null;
    } catch {
      detail = null;
    }
    throw new HelpRequestsApiError(
      detail ?? `Las solicitudes de ayuda respondieron con estado ${response.status}.`,
      response.status,
    );
  }
}

const apiHelpRequestsDataSource: HelpRequestsDataSource = {
  transport: "api",
  listActive: (signal) =>
    apiRequest<HelpRequestPage>("/api/v1/help-requests?limit=50", { signal }),
  attend: (id, sharesIdentity = false) =>
    apiRequest<HelpRequestAttendReceipt>(`/api/v1/help-requests/${id}/attend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sharesIdentity }),
    }),
  listAttenders: (id, signal) =>
    apiRequest<HelpRequestAttendersPage>(
      `/api/v1/help-requests/${id}/attenders`,
      { signal },
    ),
  // CHG-196: 204 sin cuerpo; `apiRequest` devolvería un JSON vacío, así
  // que se pide aparte y solo se comprueba el estado.
  remove: async (id) => {
    await apiRequestNoContent(`/api/v1/help-requests/${id}`, {
      method: "DELETE",
    });
  },
};

function nowIso() {
  return new Date().toISOString();
}

function inHoursIso(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

// La vigencia demo se recalcula en cada consulta para que las tarjetas
// nunca aparezcan ya expiradas al abrir la interfaz sin backend.
function buildDemoRequests(): ActiveHelpRequest[] {
  return [
    {
      id: "5d3f9a10-1111-4c2d-9e3f-000000000001",
      description:
        "Una familia quedó aislada por la creciente y necesita agua potable, cobijas y ayuda para evacuar a dos adultos mayores.",
      address: "Vereda El Salado, Piedecuesta, Santander",
      latitude: 6.9871,
      longitude: -73.0498,
      notificationRadiusKm: 10,
      createdAt: nowIso(),
      expiresAt: inHoursIso(6),
      attendersCount: 2,
      attendedByMe: false,
      photoUrl: null,
    },
    {
      id: "5d3f9a10-1111-4c2d-9e3f-000000000002",
      description:
        "Se necesitan manos y herramienta para remover escombros livianos y abrir paso hacia tres viviendas afectadas.",
      address: "Barrio La Cumbre, Floridablanca, Santander",
      latitude: 7.0703,
      longitude: -73.0862,
      notificationRadiusKm: null,
      createdAt: nowIso(),
      expiresAt: inHoursIso(24),
      attendersCount: 0,
      attendedByMe: false,
      photoUrl: null,
    },
  ];
}

let demoRequests = buildDemoRequests();

const demoHelpRequestsDataSource: HelpRequestsDataSource = {
  transport: "demo",
  async listActive() {
    // El filtro por vigencia también rige en demo, para que la
    // interfaz ensaye la desaparición automática.
    const now = Date.now();
    demoRequests = demoRequests.filter(
      (request) => Date.parse(request.expiresAt) > now,
    );
    if (demoRequests.length === 0) {
      demoRequests = buildDemoRequests();
    }
    return {
      items: demoRequests.map((request) => ({ ...request })),
      total: demoRequests.length,
      generatedAt: nowIso(),
    };
  },
  async listAttenders(id) {
    // En demo nadie ha consentido compartir nada: la lista enseña el
    // caso que más se va a ver en la realidad al principio.
    const request = demoRequests.find((item) => item.id === id);
    const items = Array.from(
      { length: request ? request.attendersCount : 0 },
      (_unused, index) => ({
        id: `${id}-atendiendo-${index}`,
        kind: index % 2 === 0 ? ("account" as const) : ("volunteer" as const),
        joinedAt: nowIso(),
        sharesContact: false,
        name: null,
        phone: null,
        photoUrl: null,
      }),
    );
    return { items, total: items.length, generatedAt: nowIso() };
  },
  async remove(id) {
    // CHG-196: en demo la solicitud sale de la lista, como en la vida.
    demoRequests = demoRequests.filter((item) => item.id !== id);
  },
  async attend(id) {
    const request = demoRequests.find((item) => item.id === id);
    if (!request) {
      throw new HelpRequestsApiError("La solicitud no existe o ya expiró.", 404);
    }
    // DEC-125-03: repetir la acción no duplica.
    if (!request.attendedByMe) {
      request.attendedByMe = true;
      request.attendersCount += 1;
    }
    return {
      id: request.id,
      attendersCount: request.attendersCount,
      attending: true,
    };
  },
};

// Igual que el resto de la plataforma: API real por defecto; `demo`
// solo cuando se pide explícitamente (trabajo sin backend).
const requestedMode = process.env.EXPO_PUBLIC_HELP_REQUESTS_DATA_MODE;
export const helpRequestsDataSource =
  requestedMode === "demo"
    ? demoHelpRequestsDataSource
    : apiHelpRequestsDataSource;

export { apiHelpRequestsDataSource, demoHelpRequestsDataSource };
