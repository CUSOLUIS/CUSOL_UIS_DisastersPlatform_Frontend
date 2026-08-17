import { cleanup, render, screen } from "@testing-library/react-native";
import { FallbackMapCanvas } from "../operational-map/FallbackMapCanvas";
import { normalizeOperationalMapOverview } from "../operational-map/dataSource";
import { operationalMapDemoData } from "../operational-map/demoData";
import {
  helpRequestIdFromPointId,
  helpRequestsToMapPoints,
} from "./mapPoints";
import type { ActiveHelpRequest } from "./types";

afterEach(cleanup);

const request: ActiveHelpRequest = {
  id: "b2000000-0000-4000-8000-000000000001",
  description: "Se necesita ayuda para evacuar a dos adultos mayores.",
  address: "Vereda El Salado, Piedecuesta",
  latitude: 6.9871,
  longitude: -73.0498,
  createdAt: "2026-08-16T10:00:00Z",
  expiresAt: "2026-08-16T22:00:00Z",
  attendersCount: 2,
  attendedByMe: false,
  photoUrl: null,
};

describe("helpRequestsToMapPoints (CHG-125, DEC-125-10)", () => {
  it("convierte la solicitud en un punto help_request con datos públicos", () => {
    const [point] = helpRequestsToMapPoints([request]);
    expect(point.category).toBe("help_request");
    expect(point.id).toBe(`help_request:${request.id}`);
    expect(point.locationLabel).toBe(request.address);
    expect(point.description).toBe(request.description);
    expect(helpRequestIdFromPointId(point.id)).toBe(request.id);
    expect(helpRequestIdFromPointId("otro-punto")).toBeNull();
  });

  it("el resumen normalizado cuenta la categoría nueva sin romper overviews previos", () => {
    const merged = normalizeOperationalMapOverview({
      ...operationalMapDemoData,
      items: [
        ...operationalMapDemoData.items,
        ...helpRequestsToMapPoints([request]),
      ],
    });
    expect(merged.summary.helpRequests).toBe(1);
    // Un overview sin la clave nueva sigue siendo válido (backend
    // anterior): se recalcula desde los puntos.
    expect(
      normalizeOperationalMapOverview(operationalMapDemoData).summary
        .helpRequests,
    ).toBe(0);
  });

  it("el lienzo dibuja el marcador rojo animado de la solicitud", () => {
    const [point] = helpRequestsToMapPoints([request]);
    render(
      <FallbackMapCanvas
        points={[point]}
        selectedId={null}
        onSelect={() => undefined}
        compact={false}
      />,
    );

    expect(screen.getByTestId(`map-marker-${point.id}`)).toBeTruthy();
    // El icono se oculta de accesibilidad (el Pressable ya anuncia el
    // punto), así que la consulta incluye elementos ocultos.
    expect(
      screen.getByTestId("help-request-marker-icon", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });
});
