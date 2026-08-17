import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { HelpRequestForm, collectHelpRequestIssues, initialHelpRequestDraft } from "./HelpRequestForm";
import { resetVisitorPresenceForTests } from "../operational-map/visitorPresence";
import type { HelpRequestReceipt } from "./types";

// El formulario dispara geocodificación inversa de mejor esfuerzo al
// fijar el punto; en pruebas no hay red y el fallo debe ser silencioso.
beforeEach(() => {
  jest
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("sin red en pruebas"));
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  // CHG-130: la auto-ubicación consulta la última posición conocida;
  // ningún test debe heredar la de otro.
  resetVisitorPresenceForTests();
});

const anonymousSession = {
  getCurrentAccount: () => Promise.reject(new Error("sin sesión")),
};

describe("collectHelpRequestIssues (CHG-125)", () => {
  const validDraft = {
    description: "Una familia quedó aislada y necesita agua y cobijas.",
    address: "Vereda El Salado, Piedecuesta",
    latitude: "6.98710",
    longitude: "-73.04980",
    durationValue: "12",
    durationUnit: "hours" as const,
    notificationRadiusKm: "5",
    truthConfirmed: true,
  };

  it("acepta un borrador completo sin fotografía (la foto es opcional)", () => {
    expect(collectHelpRequestIssues(validDraft)).toEqual([]);
  });

  it("exige descripción, dirección, vigencia y confirmación", () => {
    const fields = collectHelpRequestIssues(initialHelpRequestDraft).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        "description",
        "address",
        "durationValue",
        "truthConfirmed",
      ]),
    );
    // CHG-127: el punto en el mapa es opcional — su ausencia no bloquea.
    expect(fields).not.toContain("location");
  });

  // CHG-127: la dirección escrita basta; sin coordenadas no hay errores.
  it("acepta un borrador sin coordenadas", () => {
    expect(
      collectHelpRequestIssues({ ...validDraft, latitude: "", longitude: "" }),
    ).toEqual([]);
  });

  it("rechaza coordenadas fuera de rango cuando sí las hay", () => {
    const issues = collectHelpRequestIssues({
      ...validDraft,
      latitude: "95",
      longitude: "-73.04980",
    });
    expect(issues.map((issue) => issue.field)).toContain("location");
  });

  it("rechaza la vigencia fuera del rango de 1 a 72 horas", () => {
    (["0", "73", "100", "-4", "2.5", "abc"] as const).forEach((hours) => {
      const issues = collectHelpRequestIssues({
        ...validDraft,
        durationValue: hours,
      });
      expect(issues.map((issue) => issue.field)).toContain("durationValue");
    });
    expect(
      collectHelpRequestIssues({ ...validDraft, durationValue: "72" }),
    ).toEqual([]);
    expect(
      collectHelpRequestIssues({ ...validDraft, durationValue: "1" }),
    ).toEqual([]);
  });

  // CHG-130: con la unidad en días rigen los límites de días (1-30).
  it("valida la vigencia en días con sus propios límites", () => {
    const inDays = { ...validDraft, durationUnit: "days" as const };
    expect(
      collectHelpRequestIssues({ ...inDays, durationValue: "2" }),
    ).toEqual([]);
    expect(
      collectHelpRequestIssues({ ...inDays, durationValue: "30" }),
    ).toEqual([]);
    (["0", "31", "-1", "1.5"] as const).forEach((days) => {
      const issues = collectHelpRequestIssues({
        ...inDays,
        durationValue: days,
      });
      expect(issues.map((issue) => issue.field)).toContain("durationValue");
    });
    // 72 es válido en horas pero excede el tope de 30 días.
    expect(
      collectHelpRequestIssues({ ...inDays, durationValue: "72" }).map(
        (issue) => issue.field,
      ),
    ).toContain("durationValue");
  });

  it("rechaza descripciones demasiado cortas", () => {
    const issues = collectHelpRequestIssues({
      ...validDraft,
      description: "Ayuda ya",
    });
    expect(issues.map((issue) => issue.field)).toContain("description");
  });

  // CHG-146: la calidad de texto (CHG-107) se avisa en cliente. Una
  // descripción de emergencia breve pero real se acepta; 1-2 palabras
  // o basura se rechazan con mensaje claro antes de enviar.
  it("acepta una descripción de emergencia breve pero real", () => {
    expect(
      collectHelpRequestIssues({
        ...validDraft,
        description: "Necesito ayuda urgente aquí",
      }),
    ).toEqual([]);
  });

  it("rechaza una descripción con muy pocas palabras distintas", () => {
    const issues = collectHelpRequestIssues({
      ...validDraft,
      description: "ayuda ayuda ayuda",
    });
    const descriptionIssue = issues.find(
      (issue) => issue.field === "description",
    );
    expect(descriptionIssue?.message).toMatch(/palabras distintas/);
  });
});

describe("HelpRequestForm (CHG-125)", () => {
  it("señala los campos pendientes al intentar publicar vacío", async () => {
    render(
      <HelpRequestForm onBack={() => undefined} sessionSource={anonymousSession} />,
    );

    fireEvent.press(
      await screen.findByRole("button", {
        name: "Publicar solicitud de ayuda",
      }),
    );

    expect(
      await screen.findByText("Revisa la solicitud antes de continuar"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Escribe la dirección del lugar o resuélvela/),
    ).toBeTruthy();
    // CHG-127: la ausencia del punto en el mapa ya no es un error.
    expect(
      screen.queryByText(/Las coordenadas del punto están fuera de rango/),
    ).toBeNull();
  });

  it("publica con punto fijado desde el mapa y muestra la constancia", async () => {
    const receipt: HelpRequestReceipt = {
      id: "7f0e0a10-3333-4c2d-9e3f-000000000009",
      publicCode: "HR-2026-DEMO0001",
      status: "active",
      receivedAt: "2026-08-16T12:00:00Z",
      expiresAt: "2026-08-17T00:00:00Z",
    };
    const submitRequest = jest.fn().mockResolvedValue(receipt);

    render(
      <HelpRequestForm
        onBack={() => undefined}
        sessionSource={anonymousSession}
        submitRequest={submitRequest}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Descripción de la situación *"),
      "Se desbordó la quebrada y hay tres familias sin salida segura.",
    );
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Vereda El Salado, Piedecuesta",
    );
    // El muñequito en el centro del mapa fija las coordenadas, igual
    // que en el reporte de persona (CHG-080).
    fireEvent.press(
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      }),
    );
    fireEvent.changeText(screen.getByLabelText("Vigencia *"), "12");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Confirmo que la solicitud es real y de buena fe.",
      }),
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Publicar solicitud de ayuda" }),
    );

    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(1));
    const [draft, photos] = submitRequest.mock.calls[0];
    expect(photos).toEqual([]);
    expect(draft.durationValue).toBe("12");
    expect(draft.latitude).not.toBe("");
    expect(draft.longitude).not.toBe("");

    expect(await screen.findByText("Solicitud publicada")).toBeTruthy();
    expect(screen.getByText("HR-2026-DEMO0001")).toBeTruthy();
  });

  // CHG-127: la dirección escrita basta — se publica sin fijar el punto.
  it("publica sin punto en el mapa, solo con la dirección escrita", async () => {
    const receipt: HelpRequestReceipt = {
      id: "7f0e0a10-3333-4c2d-9e3f-000000000010",
      publicCode: "HR-2026-DEMO0002",
      status: "active",
      receivedAt: "2026-08-17T12:00:00Z",
      expiresAt: "2026-08-18T00:00:00Z",
    };
    const submitRequest = jest.fn().mockResolvedValue(receipt);

    render(
      <HelpRequestForm
        onBack={() => undefined}
        sessionSource={anonymousSession}
        submitRequest={submitRequest}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Descripción de la situación *"),
      "Se desbordó la quebrada y hay tres familias sin salida segura.",
    );
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Vereda El Salado, Piedecuesta",
    );
    fireEvent.changeText(screen.getByLabelText("Vigencia *"), "12");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Confirmo que la solicitud es real y de buena fe.",
      }),
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Publicar solicitud de ayuda" }),
    );

    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(1));
    const [draft] = submitRequest.mock.calls[0];
    expect(draft.latitude).toBe("");
    expect(draft.longitude).toBe("");

    expect(await screen.findByText("Solicitud publicada")).toBeTruthy();
    expect(screen.getByText("HR-2026-DEMO0002")).toBeTruthy();
  });

  it("ubica al entrar y «¿Dónde estoy?» vuelve a leer la posición", async () => {
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1398, longitude: -73.1211 });
    render(
      <HelpRequestForm
        onBack={() => undefined}
        sessionSource={anonymousSession}
        locateVisitor={locateVisitor}
      />,
    );

    // CHG-130: al entrar a la funcionalidad se intenta la ubicación
    // una vez y el punto queda fijado sin tocar nada.
    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/PUNTO FIJADO · LAT 7\.13980/),
    ).toBeTruthy();

    // El botón sigue disponible y RELEE la posición (la primera lectura
    // pudo ser imprecisa o la persona pudo moverse).
    fireEvent.press(
      await screen.findByRole("button", { name: "¿Dónde estoy?" }),
    );
    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(2));
  });
});
