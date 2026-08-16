import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { CommunityContributionForm } from "./CommunityContributionForm";
import { contributionEndpoint } from "./contributionDataSource";
import { humanitarianDirectoryDemoData } from "./demoData";
import type { CommunityContributionDataSource } from "./types";

const personTarget = humanitarianDirectoryDemoData.find(
  (item) => item.kind === "missing_person",
)!;

function dataSourceWithActor(
  actorKind: "anonymous" | "authenticated" | "health_sector",
): CommunityContributionDataSource {
  return {
    transport: "fixture",
    getActorKind: async () => actorKind,
    submit: jest.fn(),
  };
}

afterEach(cleanup);

// CHG-124 — El aviso del sector salud: su reporte no pasa por revisión
// informal y un fallecimiento queda como muerte CONFIRMADA.
describe("Aviso del sector salud en el aporte", () => {
  it("aparece solo para el perfil de salud y usa el texto pedido con fallecida", async () => {
    render(
      <CommunityContributionForm
        dataSource={dataSourceWithActor("health_sector")}
        onBack={jest.fn()}
        target={personTarget}
      />,
    );

    const notice = await screen.findByTestId("health-sector-notice");
    expect(notice).toBeTruthy();
    expect(screen.getByText("SECTOR SALUD · CON SESIÓN")).toBeTruthy();
    // Con el desenlace por defecto (encontrada) avisa la aplicación
    // inmediata; al elegir fallecida, el texto de "Muerto confirmado".
    expect(
      screen.getByText(/se aplica de inmediato al estado público/),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole("radio", { name: "Persona fallecida" }),
    );
    expect(
      screen.getByText(/categorizada directamente como “Muerto confirmado”/),
    ).toBeTruthy();
    expect(
      screen.getByText(/sin fase intermedia de revisión informal/),
    ).toBeTruthy();
  });

  it("no aparece para una cuenta sin perfil de salud", async () => {
    render(
      <CommunityContributionForm
        dataSource={dataSourceWithActor("authenticated")}
        onBack={jest.fn()}
        target={personTarget}
      />,
    );
    expect(await screen.findByText("CON SESIÓN")).toBeTruthy();
    expect(screen.queryByTestId("health-sector-notice")).toBeNull();
  });

  it("no aparece para aportes anónimos", async () => {
    render(
      <CommunityContributionForm
        dataSource={dataSourceWithActor("anonymous")}
        onBack={jest.fn()}
        target={personTarget}
      />,
    );
    expect(await screen.findByText("APORTE PÚBLICO")).toBeTruthy();
    expect(screen.queryByTestId("health-sector-notice")).toBeNull();
  });

  it("el sector salud aporta por el canal autenticado", () => {
    const contribution = {
      kind: "missing_person_status" as const,
      targetId: personTarget.id,
      claimedOutcome: "deceased" as const,
      evidenceDescription: "x".repeat(30),
      photos: [],
      truthConfirmed: true as const,
      reviewAcknowledged: true as const,
    };
    expect(contributionEndpoint(contribution, "health_sector")).toBe(
      `/api/v1/me/missing-persons/${personTarget.id}/status-reports`,
    );
    expect(contributionEndpoint(contribution, "anonymous")).toBe(
      `/api/v1/public/missing-persons/${personTarget.id}/status-reports`,
    );
  });
});
