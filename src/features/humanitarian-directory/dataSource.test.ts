import { contributionEndpoint } from "./contributionDataSource";
import {
  buildDirectorySearchParameters,
  filterHumanitarianDirectory,
} from "./dataSource";
import { humanitarianDirectoryDemoData } from "./demoData";

describe("Fuentes del directorio humanitario", () => {
  it("filtra por tipo, texto normalizado y valoración", () => {
    expect(
      filterHumanitarianDirectory(humanitarianDirectoryDemoData, {
        kind: "collection_center",
        query: "bogota",
        filter: "rating_4",
      }).map((item) => item.id),
    ).toEqual(["de5129a2-a6a5-44aa-9831-722a5890c320"]);

    expect(
      filterHumanitarianDirectory(humanitarianDirectoryDemoData, {
        kind: "missing_person",
        query: "chaqueta amarilla",
        filter: "missing",
      }).map((item) => item.id),
    ).toEqual(["51fd51d6-0a82-4cd4-9dca-a57984f59711"]);
  });

  it("serializa únicamente los filtros aplicables al endpoint", () => {
    const parameters = buildDirectorySearchParameters({
      kind: "collection_center",
      query: "  norte ",
      filter: "open",
    });
    expect(parameters.get("kind")).toBe("collection_center");
    expect(parameters.get("q")).toBe("norte");
    expect(parameters.get("openNow")).toBe("true");
    expect(parameters.has("personStatus")).toBe(false);
  });

  it("separa las rutas de aportes públicos y autenticados", () => {
    const contribution = {
      kind: "aid_location_rating" as const,
      targetId: "location-1",
      rating: 5,
      evidenceDescription: "Lugar disponible y verificable",
      photos: [],
      truthConfirmed: true as const,
      reviewAcknowledged: true as const,
    };
    expect(contributionEndpoint(contribution, "anonymous")).toBe(
      "/api/v1/public/aid-locations/location-1/ratings",
    );
    expect(contributionEndpoint(contribution, "authenticated")).toBe(
      "/api/v1/me/aid-locations/location-1/ratings",
    );
  });
});
