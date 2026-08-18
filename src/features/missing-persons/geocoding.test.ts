import {
  buildLastSeenQuery,
  parseDraftCoordinates,
  searchAddressCandidates,
  type FetchLike, reverseGeocode } from "./geocoding";

// CHG-147: la geocodificación pasa por el proxy del gateway; en las
// pruebas (plataforma nativa) la base sale de esta variable, como en
// un dispositivo real.
beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "http://gateway.test";
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
});

describe("Cruce de dirección por el proxy del gateway", () => {
  it("arma la consulta con zona, municipio, departamento y país, omitiendo vacíos", () => {
    expect(
      buildLastSeenQuery({
        department: "Santander",
        municipality: "Bucaramanga",
        lastSeenArea: "Parque García Rovira",
      }),
    ).toBe("Parque García Rovira, Bucaramanga, Santander, Colombia");

    expect(
      buildLastSeenQuery({ department: " ", municipality: "Soacha", lastSeenArea: "" }),
    ).toBe("Soacha, Colombia");
  });

  it("consulta el proxy del gateway y convierte las candidatas", async () => {
    const fetchFn: FetchLike = jest.fn(async (url: string) => {
      expect(url).toContain("http://gateway.test/api/v1/geocode/search");
      expect(url).toContain(
        `q=${encodeURIComponent("Parque García Rovira, Bucaramanga")}`,
      );
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              label: "Parque García Rovira, Bucaramanga, Santander",
              latitude: 7.1148,
              longitude: -73.1268,
            },
            { label: "Sin coordenadas", latitude: "no-numérico", longitude: -73.0 },
          ],
        }),
      };
    });

    const candidates = await searchAddressCandidates(
      "Parque García Rovira, Bucaramanga",
      fetchFn,
    );

    expect(candidates).toEqual([
      {
        label: "Parque García Rovira, Bucaramanga, Santander",
        latitude: 7.1148,
        longitude: -73.1268,
      },
    ]);
  });

  it("devuelve vacío sin consultar cuando la dirección está en blanco", async () => {
    const fetchFn = jest.fn() as unknown as FetchLike;
    expect(await searchAddressCandidates("   ", fetchFn)).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reporta errores legibles cuando el servicio falla o no responde", async () => {
    const failing: FetchLike = async () => ({ ok: false, json: async () => [] });
    await expect(searchAddressCandidates("Bogotá", failing)).rejects.toThrow(
      /servicio de direcciones no respondió/,
    );

    const unreachable: FetchLike = async () => {
      throw new Error("network");
    };
    await expect(searchAddressCandidates("Bogotá", unreachable)).rejects.toThrow(
      /Revisa la conexión/,
    );
  });

  it("interpreta las coordenadas del borrador solo cuando ambas son válidas", () => {
    expect(parseDraftCoordinates("4.65290", "-74.08360")).toEqual({
      latitude: 4.6529,
      longitude: -74.0836,
    });
    expect(parseDraftCoordinates("", "-74.08360")).toBeNull();
    expect(parseDraftCoordinates("abc", "-74.08360")).toBeNull();
  });
});

// CHG-086 — Geocodificación inversa para autocompletar la dirección.
describe("reverseGeocode", () => {
  it("resuelve dirección, municipio y departamento del punto", async () => {
    const fetchFn = jest.fn(async (url: string) => {
      expect(url).toContain("http://gateway.test/api/v1/geocode/reverse");
      expect(url).toContain("lat=7.1193");
      expect(url).toContain("lon=-73.1227");
      return {
        ok: true,
        json: async () => ({
          label: "Parque García Rovira, Bucaramanga, Santander, Colombia",
          addressLine: "Parque García Rovira",
          municipality: "Bucaramanga",
          department: "Santander",
        }),
      };
    });

    await expect(
      reverseGeocode({ latitude: 7.1193, longitude: -73.1227 }, fetchFn),
    ).resolves.toEqual({
      label: "Parque García Rovira, Bucaramanga, Santander, Colombia",
      addressLine: "Parque García Rovira",
      municipality: "Bucaramanga",
      department: "Santander",
    });
  });

  it("deja addressLine nulo cuando el proxy no lo trae o viene vacío", async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        label: "Vereda El Roble, Colombia",
        addressLine: "  ",
        municipality: null,
        department: null,
      }),
    }));

    await expect(
      reverseGeocode({ latitude: 7.2, longitude: -73.2 }, fetchFn),
    ).resolves.toMatchObject({ addressLine: null });
  });

  it("tolera municipio y departamento nulos en zonas rurales", async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        label: "Vereda El Roble, Colombia",
        municipality: null,
        department: null,
      }),
    }));

    await expect(
      reverseGeocode({ latitude: 7.2, longitude: -73.2 }, fetchFn),
    ).resolves.toEqual({
      label: "Vereda El Roble, Colombia",
      addressLine: null,
      municipality: null,
      department: null,
    });
  });

  it("rechaza cuando el punto no tiene dirección conocida (404 del proxy)", async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    await expect(
      reverseGeocode({ latitude: 0, longitude: 0 }, fetchFn),
    ).rejects.toThrow(/no corresponde a una dirección conocida/);
  });

  it("sin EXPO_PUBLIC_API_BASE_URL en nativo pide configurarla", async () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    try {
      await expect(
        reverseGeocode({ latitude: 1, longitude: 1 }, jest.fn()),
      ).rejects.toThrow(/EXPO_PUBLIC_API_BASE_URL/);
    } finally {
      process.env.EXPO_PUBLIC_API_BASE_URL = "http://gateway.test";
    }
  });
});
