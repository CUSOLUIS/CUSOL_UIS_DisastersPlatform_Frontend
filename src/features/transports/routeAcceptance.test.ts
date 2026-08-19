// CHG-179 — Los mensajes del acuerdo de ruta nombran el medio real.
//
// El acuerdo se construyó sobre el transporte (CHG-174/175), así que la
// lancha ya lo recorría entero; lo que fallaba era que la interfaz la
// llamaba «Mulera» en cada aviso.

import {
  receptionStageMessage,
  routeStateMessage,
  type TransportRouteState,
} from "./routeAcceptance";

const BASE: TransportRouteState = {
  transportId: "tr-1",
  transportKind: "mule",
  transportCreatedAt: "2026-08-19T14:00:00Z",
  originCenterName: "Acopio La Feria",
  destinationCenterName: "Receptor Mompós",
  originMunicipality: "Bucaramanga",
  destinationMunicipality: "Mompós",
  localStatus: "accepted",
  receptionStatus: "accepted",
  routeStatus: "code_issued",
  confirmationCode: "RT-2026-0001",
  localAcceptedAt: "2026-08-19T15:00:00Z",
  muleCodeValidatedAt: null,
  muleAcceptedAt: null,
  receptionConfirmationCode: null,
  receptionStartedAt: null,
  receptionMuleCodeValidatedAt: null,
  receptionMuleAcceptedAt: null,
  routeAcceptedAt: null,
  isLocalSteward: true,
  isReceptionSteward: true,
};

describe("routeStateMessage (CHG-179)", () => {
  it("espera a la mulera cuando el transporte es terrestre", () => {
    expect(routeStateMessage(BASE)).toBe(
      "Código entregado. Esperando aceptación de la mulera.",
    );
  });

  it("espera a la lanchera cuando el transporte es fluvial", () => {
    expect(routeStateMessage({ ...BASE, transportKind: "boat" })).toBe(
      "Código entregado. Esperando aceptación de la lanchera.",
    );
  });
});

describe("receptionStageMessage (CHG-179)", () => {
  it("nombra el medio mientras la etapa 1 sigue abierta", () => {
    expect(
      receptionStageMessage({ ...BASE, transportKind: "boat" }),
    ).toBe(
      "Esperando la aceptación inicial entre la lanchera y el Centro de Acopio Local.",
    );
  });

  it("nombra el medio al esperar su aceptación en la etapa 2", () => {
    const state: TransportRouteState = {
      ...BASE,
      transportKind: "boat",
      routeStatus: "accepted",
      muleAcceptedAt: "2026-08-19T16:00:00Z",
      receptionStartedAt: "2026-08-19T16:30:00Z",
      receptionConfirmationCode: "RR-2026-0001",
    };
    expect(receptionStageMessage(state)).toBe(
      "Código entregado. Esperando aceptación de la lanchera.",
    );
  });
});
