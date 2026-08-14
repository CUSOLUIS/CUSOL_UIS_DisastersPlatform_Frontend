import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import {
  AboutPage,
  CUSOL_COMMUNITY_PROFILE_URL,
  CUSOL_UIS_NEWS_URL,
  PROMETEO_UIS_URL,
} from "./AboutPage";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("AboutPage", () => {
  it("presenta CUSOL, Prometeo, contexto editorial y fuentes trazables", () => {
    render(<AboutPage onBack={jest.fn()} />);

    expect(screen.getByRole("header", { name: "CUSOL-UIS" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "PROMETEO" })).toBeTruthy();
    expect(screen.getByText(/Nació alrededor de 2005/)).toBeTruthy();
    expect(screen.getByText(/primer grupo interdisciplinario/)).toBeTruthy();
    expect(screen.getByText("Paz, Conflictos y Democracia")).toBeTruthy();
    expect(screen.getByText("NO DECLARA UNA ALIANZA FORMAL")).toBeTruthy();
    expect(screen.getByText("VERIFICADAS · 14 AGO 2026")).toBeTruthy();
  });

  it("abre las tres fuentes exactas y permite volver", () => {
    const onBack = jest.fn();
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<AboutPage onBack={onBack} />);

    fireEvent.press(screen.getByRole("link", { name: /FLISOL 2026 Santander/ }));
    fireEvent.press(screen.getByRole("link", { name: /Perfil de CUSOL-UIS/ }));
    fireEvent.press(screen.getByRole("link", { name: /Grupo de Investigación Prometeo/ }));
    fireEvent.press(screen.getAllByRole("button", { name: "Volver a la portada" })[0]);

    expect(openUrl).toHaveBeenNthCalledWith(1, CUSOL_UIS_NEWS_URL);
    expect(openUrl).toHaveBeenNthCalledWith(2, CUSOL_COMMUNITY_PROFILE_URL);
    expect(openUrl).toHaveBeenNthCalledWith(3, PROMETEO_UIS_URL);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
