import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { HelpRequestForm, collectHelpRequestIssues, initialHelpRequestDraft } from "./HelpRequestForm";
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
    durationHours: "12",
    truthConfirmed: true,
  };

  it("acepta un borrador completo sin fotografía (la foto es opcional)", () => {
    expect(collectHelpRequestIssues(validDraft)).toEqual([]);
  });

  it("exige descripción, dirección, punto, vigencia y confirmación", () => {
    const fields = collectHelpRequestIssues(initialHelpRequestDraft).map(
      (issue) => issue.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        "description",
        "address",
        "location",
        "durationHours",
        "truthConfirmed",
      ]),
    );
  });

  it("rechaza la vigencia fuera del rango de 1 a 72 horas", () => {
    (["0", "73", "100", "-4", "2.5", "abc"] as const).forEach((hours) => {
      const issues = collectHelpRequestIssues({
        ...validDraft,
        durationHours: hours,
      });
      expect(issues.map((issue) => issue.field)).toContain("durationHours");
    });
    expect(
      collectHelpRequestIssues({ ...validDraft, durationHours: "72" }),
    ).toEqual([]);
    expect(
      collectHelpRequestIssues({ ...validDraft, durationHours: "1" }),
    ).toEqual([]);
  });

  it("rechaza descripciones demasiado cortas", () => {
    const issues = collectHelpRequestIssues({
      ...validDraft,
      description: "Ayuda ya",
    });
    expect(issues.map((issue) => issue.field)).toContain("description");
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
      screen.getByText(
        /Fija el punto en el mapa: cruza la dirección, usa «¿Dónde estoy\?»/,
      ),
    ).toBeTruthy();
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
    fireEvent.changeText(screen.getByLabelText("Vigencia en horas *"), "12");
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
    expect(draft.durationHours).toBe("12");
    expect(draft.latitude).not.toBe("");
    expect(draft.longitude).not.toBe("");

    expect(await screen.findByText("Solicitud publicada")).toBeTruthy();
    expect(screen.getByText("HR-2026-DEMO0001")).toBeTruthy();
  });

  it("ofrece «¿Dónde estoy?» y fija el punto con el GPS", async () => {
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

    fireEvent.press(
      await screen.findByRole("button", { name: "¿Dónde estoy?" }),
    );

    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/PUNTO FIJADO · LAT 7\.13980/),
    ).toBeTruthy();
  });
});
