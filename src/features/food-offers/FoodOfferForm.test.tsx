import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  FoodOfferForm,
  collectFoodOfferIssues,
  initialFoodOfferDraft,
} from "./FoodOfferForm";
import { resetVisitorPresenceForTests } from "../operational-map/visitorPresence";
import type { FoodOfferReceipt } from "./types";

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
  // La auto-ubicación consulta la última posición conocida; ningún
  // test debe heredar la de otro.
  resetVisitorPresenceForTests();
});

const anonymousSession = {
  getCurrentAccount: () => Promise.reject(new Error("sin sesión")),
};

describe("collectFoodOfferIssues (CHG-163)", () => {
  const validDraft = {
    description: "Sancocho comunitario para cuarenta personas al mediodía.",
    address: "Salón comunal La Cumbre, Floridablanca",
    latitude: "7.07120",
    longitude: "-73.08550",
    durationValue: "6",
    durationUnit: "hours" as const,
    notificationRadiusKm: "5",
    truthConfirmed: true,
  };

  it("acepta un borrador completo", () => {
    expect(collectFoodOfferIssues(validDraft)).toEqual([]);
  });

  it("exige descripción, dirección, vigencia y confirmación", () => {
    const fields = collectFoodOfferIssues(initialFoodOfferDraft).map(
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
    // Regla CHG-127: el punto en el mapa es opcional — su ausencia no
    // bloquea.
    expect(fields).not.toContain("location");
  });

  it("acepta un borrador sin coordenadas (la dirección escrita basta)", () => {
    expect(
      collectFoodOfferIssues({ ...validDraft, latitude: "", longitude: "" }),
    ).toEqual([]);
  });

  it("rechaza coordenadas fuera de rango cuando sí las hay", () => {
    const issues = collectFoodOfferIssues({
      ...validDraft,
      latitude: "95",
      longitude: "-73.08550",
    });
    expect(issues.map((issue) => issue.field)).toContain("location");
  });

  it("valida la vigencia en horas (1-72) y en días (1-30)", () => {
    (["0", "73", "-4", "2.5", "abc"] as const).forEach((hours) => {
      expect(
        collectFoodOfferIssues({ ...validDraft, durationValue: hours }).map(
          (issue) => issue.field,
        ),
      ).toContain("durationValue");
    });
    expect(
      collectFoodOfferIssues({ ...validDraft, durationValue: "72" }),
    ).toEqual([]);
    const inDays = { ...validDraft, durationUnit: "days" as const };
    expect(collectFoodOfferIssues({ ...inDays, durationValue: "30" })).toEqual(
      [],
    );
    // 72 es válido en horas pero excede el tope de 30 días.
    expect(
      collectFoodOfferIssues({ ...inDays, durationValue: "72" }).map(
        (issue) => issue.field,
      ),
    ).toContain("durationValue");
  });

  it("valida el radio de aviso 1-100 y admite dejarlo vacío", () => {
    (["0", "101", "-3", "4.5"] as const).forEach((radius) => {
      expect(
        collectFoodOfferIssues({
          ...validDraft,
          notificationRadiusKm: radius,
        }).map((issue) => issue.field),
      ).toContain("notificationRadiusKm");
    });
    expect(
      collectFoodOfferIssues({ ...validDraft, notificationRadiusKm: "" }),
    ).toEqual([]);
  });

  it("rechaza una descripción con muy pocas palabras distintas", () => {
    const issues = collectFoodOfferIssues({
      ...validDraft,
      description: "comida comida comida",
    });
    const descriptionIssue = issues.find(
      (issue) => issue.field === "description",
    );
    expect(descriptionIssue?.message).toMatch(/palabras distintas/);
  });
});

describe("FoodOfferForm (CHG-163)", () => {
  it("señala los campos pendientes al intentar publicar vacío", async () => {
    render(
      <FoodOfferForm onBack={() => undefined} sessionSource={anonymousSession} />,
    );

    fireEvent.press(
      await screen.findByRole("button", { name: "Publicar oferta de comida" }),
    );

    expect(
      await screen.findByText("Revisa la oferta antes de continuar"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Escribe la dirección del lugar o resuélvela/),
    ).toBeTruthy();
    // La ausencia del punto en el mapa no es un error.
    expect(
      screen.queryByText(/Las coordenadas del punto están fuera de rango/),
    ).toBeNull();
  });

  it("publica con punto fijado desde el mapa y muestra la constancia", async () => {
    const receipt: FoodOfferReceipt = {
      id: "8a1b2c30-4444-4d5e-8f6a-000000000009",
      publicCode: "FO-2026-DEMO0001",
      status: "active",
      receivedAt: "2026-08-19T12:00:00Z",
      expiresAt: "2026-08-19T18:00:00Z",
    };
    const submitOffer = jest.fn().mockResolvedValue(receipt);

    render(
      <FoodOfferForm
        onBack={() => undefined}
        sessionSource={anonymousSession}
        submitOffer={submitOffer}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Descripción de la oferta *"),
      "Sancocho comunitario para cuarenta personas al mediodía.",
    );
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Salón comunal La Cumbre, Floridablanca",
    );
    // El muñequito en el centro del mapa fija las coordenadas, igual
    // que en los demás formularios (CHG-080).
    fireEvent.press(
      screen.getByRole("button", {
        name: "Colocar el muñequito en el centro del mapa",
      }),
    );
    fireEvent.changeText(screen.getByLabelText("Vigencia *"), "6");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Confirmo que la oferta es real y de buena fe.",
      }),
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Publicar oferta de comida" }),
    );

    await waitFor(() => expect(submitOffer).toHaveBeenCalledTimes(1));
    const [draft] = submitOffer.mock.calls[0];
    expect(draft.durationValue).toBe("6");
    expect(draft.latitude).not.toBe("");
    expect(draft.longitude).not.toBe("");

    expect(await screen.findByText("Oferta publicada")).toBeTruthy();
    expect(screen.getByText("FO-2026-DEMO0001")).toBeTruthy();
  });

  it("publica sin punto en el mapa, solo con la dirección escrita", async () => {
    const receipt: FoodOfferReceipt = {
      id: "8a1b2c30-4444-4d5e-8f6a-000000000010",
      publicCode: "FO-2026-DEMO0002",
      status: "active",
      receivedAt: "2026-08-19T12:00:00Z",
      expiresAt: "2026-08-20T00:00:00Z",
    };
    const submitOffer = jest.fn().mockResolvedValue(receipt);

    render(
      <FoodOfferForm
        onBack={() => undefined}
        sessionSource={anonymousSession}
        submitOffer={submitOffer}
      />,
    );

    fireEvent.changeText(
      await screen.findByLabelText("Descripción de la oferta *"),
      "Desayunos calientes para familias afectadas cada mañana.",
    );
    fireEvent.changeText(
      screen.getByLabelText("Dirección *"),
      "Parroquia San Judas, Piedecuesta",
    );
    fireEvent.changeText(screen.getByLabelText("Vigencia *"), "12");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "Confirmo que la oferta es real y de buena fe.",
      }),
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Publicar oferta de comida" }),
    );

    await waitFor(() => expect(submitOffer).toHaveBeenCalledTimes(1));
    const [draft] = submitOffer.mock.calls[0];
    expect(draft.latitude).toBe("");
    expect(draft.longitude).toBe("");

    expect(await screen.findByText("Oferta publicada")).toBeTruthy();
    expect(screen.getByText("FO-2026-DEMO0002")).toBeTruthy();
  });

  it("ubica al entrar y «¿Dónde estoy?» vuelve a leer la posición", async () => {
    const locateVisitor = jest
      .fn()
      .mockResolvedValue({ latitude: 7.1398, longitude: -73.1211 });
    render(
      <FoodOfferForm
        onBack={() => undefined}
        sessionSource={anonymousSession}
        locateVisitor={locateVisitor}
      />,
    );

    // Al entrar a la funcionalidad se intenta la ubicación una vez y
    // el punto queda fijado sin tocar nada (DEC-130-02).
    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/PUNTO FIJADO · LAT 7\.13980/),
    ).toBeTruthy();

    fireEvent.press(
      await screen.findByRole("button", { name: "¿Dónde estoy?" }),
    );
    await waitFor(() => expect(locateVisitor).toHaveBeenCalledTimes(2));
  });
});
