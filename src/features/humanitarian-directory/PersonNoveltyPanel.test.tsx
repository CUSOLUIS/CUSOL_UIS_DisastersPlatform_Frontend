import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { PersonNoveltyPanel } from "./PersonNoveltyPanel";
import type { MissingPersonDirectoryCard } from "./types";

afterEach(cleanup);

const person: MissingPersonDirectoryCard = {
  kind: "missing_person",
  id: "224d7e9f-336c-4dd7-bf9b-f70c3a08cf0c",
  updatedAt: "2026-08-16T10:00:00Z",
  dataClassification: "operational",
  publicCaseCode: "MP-2026-67BD3271",
  displayName: "Carlos Andrés Trujillo Vargas",
  status: "missing",
  approximateAge: 41,
  lastSeenAt: "2026-08-12T18:30:00Z",
  lastSeenArea: "Sector Café Madrid",
  municipality: "Bucaramanga",
  department: "Santander",
  publicPhotoUrl: "https://example.com/carlos.jpg",
  source: { name: "CUSOL", sourceType: "citizen", url: null },
};

const noNovelties = async () => ({
  personId: person.id,
  publicStatus: "missing" as const,
  items: [],
  total: 0,
});

describe("PersonNoveltyPanel — foto ampliable (CHG-152)", () => {
  it("muestra la ficha con la foto y la info pública", async () => {
    render(
      <PersonNoveltyPanel
        person={person}
        onBack={jest.fn()}
        onContribute={jest.fn()}
        fetchNovelties={noNovelties}
      />,
    );

    expect(
      await screen.findByLabelText(
        "Fotografía pública autorizada de Carlos Andrés Trujillo Vargas",
      ),
    ).toBeTruthy();
    expect(screen.getByText("EDAD APROXIMADA")).toBeTruthy();
    expect(screen.getByText("41 años")).toBeTruthy();
    expect(screen.getByText("Sector Café Madrid")).toBeTruthy();
  });

  it("al tocar la foto se amplía y se cierra al tocar de nuevo", async () => {
    render(
      <PersonNoveltyPanel
        person={person}
        onBack={jest.fn()}
        onContribute={jest.fn()}
        fetchNovelties={noNovelties}
      />,
    );

    await act(async () => {});

    expect(
      screen.queryByLabelText(
        "Fotografía ampliada de Carlos Andrés Trujillo Vargas",
      ),
    ).toBeNull();

    fireEvent.press(
      screen.getByRole("button", {
        name: "Ampliar la fotografía de Carlos Andrés Trujillo Vargas",
      }),
    );
    expect(
      screen.getByLabelText(
        "Fotografía ampliada de Carlos Andrés Trujillo Vargas",
      ),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "Cerrar la fotografía ampliada" }),
    );
    expect(
      screen.queryByLabelText(
        "Fotografía ampliada de Carlos Andrés Trujillo Vargas",
      ),
    ).toBeNull();
  });
});
