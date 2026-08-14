import {
  buildLastSeenQuery,
  parseDraftCoordinates,
  searchAddressCandidates,
  type FetchLike,
} from "./geocoding";

describe("Cruce de dirección con Nominatim", () => {
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

  it("consulta Nominatim restringido a Colombia y convierte las coincidencias", async () => {
    const fetchFn: FetchLike = jest.fn(async (url: string) => {
      expect(url).toContain("nominatim.openstreetmap.org/search");
      expect(url).toContain("countrycodes=co");
      expect(url).toContain(encodeURIComponent("Parque García Rovira, Bucaramanga"));
      return {
        ok: true,
        json: async () => [
          { display_name: "Parque García Rovira, Bucaramanga, Santander", lat: "7.1148", lon: "-73.1268" },
          { display_name: "Sin coordenadas", lat: "no-numérico", lon: "-73.0" },
        ],
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
