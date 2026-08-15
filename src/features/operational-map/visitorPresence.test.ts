import {
  getLastKnownVisitorLocation,
  getPresenceId,
  presencePlatform,
  reportVisitorPresence,
  resetVisitorPresenceForTests,
  setLastKnownVisitorLocation,
} from "./visitorPresence";

function fetchStub(status: number) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchFn = (async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return { status } as Response;
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("visitorPresence", () => {
  beforeEach(() => {
    resetVisitorPresenceForTests();
  });

  it("mantiene un identificador de dispositivo estable", () => {
    const first = getPresenceId();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(getPresenceId()).toBe(first);
  });

  it("guarda la última ubicación conocida para las instantáneas", () => {
    expect(getLastKnownVisitorLocation()).toBeNull();
    setLastKnownVisitorLocation({ latitude: 7.1, longitude: -73.1 });
    expect(getLastKnownVisitorLocation()).toEqual({
      latitude: 7.1,
      longitude: -73.1,
    });
  });

  it("envía la posición con el identificador y respeta el throttle", async () => {
    const { calls, fetchFn } = fetchStub(202);
    const center = { latitude: 7.12, longitude: -73.12 };

    await reportVisitorPresence(center, {
      fetchFn,
      requestBaseUrl: "",
      accuracyMeters: 12,
      now: () => 60_000,
    });
    await reportVisitorPresence(center, {
      fetchFn,
      requestBaseUrl: "",
      now: () => 70_000,
    });
    await reportVisitorPresence(center, {
      fetchFn,
      requestBaseUrl: "",
      now: () => 95_000,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("/api/v1/presence");
    expect(calls[0].body).toMatchObject({
      presenceId: getPresenceId(),
      latitude: 7.12,
      longitude: -73.12,
      accuracyMeters: 12,
      // jest-expo simula un dispositivo (ios); en web reporta "web".
      platform: presencePlatform(),
    });
  });

  it("pausa el envío cuando el gateway responde 401 (sin sesión)", async () => {
    const { calls, fetchFn } = fetchStub(401);
    const center = { latitude: 7.12, longitude: -73.12 };

    await reportVisitorPresence(center, {
      fetchFn,
      requestBaseUrl: "",
      now: () => 60_000,
    });
    // Aún dentro de la pausa de 5 minutos: ni siquiera intenta.
    await reportVisitorPresence(center, {
      fetchFn,
      requestBaseUrl: "",
      now: () => 60_000 + 4 * 60_000,
    });
    // Pasada la pausa vuelve a intentar (la persona pudo iniciar sesión).
    await reportVisitorPresence(center, {
      fetchFn,
      requestBaseUrl: "",
      now: () => 60_000 + 6 * 60_000,
    });

    expect(calls).toHaveLength(2);
  });
});
