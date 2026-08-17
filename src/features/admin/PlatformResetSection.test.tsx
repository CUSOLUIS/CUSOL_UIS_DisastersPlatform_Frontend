// CHG-139 — El reinicio absoluto exige escribir la frase exacta; sin
// ella el botón ni se habilita. El recibo muestra los conteos.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { PlatformResetSection } from "./PlatformResetSection";
import type { AdminDataSource } from "./types";

afterEach(cleanup);

function sectionDataSource(resetPlatform = jest.fn()) {
  return {
    dataSource: { resetPlatform } as unknown as AdminDataSource,
    resetPlatform,
  };
}

describe("PlatformResetSection (CHG-139)", () => {
  it("sin la frase exacta el botón queda deshabilitado y no ejecuta nada", () => {
    const { dataSource, resetPlatform } = sectionDataSource();
    render(<PlatformResetSection dataSource={dataSource} />);

    const button = screen.getByLabelText(
      "Ejecutar el reinicio absoluto de la plataforma",
    );
    expect(button.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(
      screen.getByLabelText("Frase de confirmación del reinicio"),
      "reiniciar todo",
    );
    fireEvent.press(button);
    expect(resetPlatform).not.toHaveBeenCalled();
  });

  it("con la frase exacta ejecuta y muestra el recibo", async () => {
    const resetPlatform = jest.fn().mockResolvedValue({
      tablesCleared: 21,
      accountsDeleted: 6,
      generatedAt: "2026-08-17T12:00:00Z",
    });
    const { dataSource } = sectionDataSource(resetPlatform);
    render(<PlatformResetSection dataSource={dataSource} />);

    fireEvent.changeText(
      screen.getByLabelText("Frase de confirmación del reinicio"),
      "REINICIAR TODO",
    );
    fireEvent.press(
      screen.getByLabelText(
        "Ejecutar el reinicio absoluto de la plataforma",
      ),
    );

    await waitFor(() =>
      expect(resetPlatform).toHaveBeenCalledWith("REINICIAR TODO"),
    );
    expect(await screen.findByText("PLATAFORMA REINICIADA")).toBeTruthy();
    expect(
      screen.getByText(
        /Se vaciaron 21 tablas de datos y se eliminaron 6 cuentas/,
      ),
    ).toBeTruthy();
  });

  it("muestra el error del servidor sin romper la sección", async () => {
    const resetPlatform = jest
      .fn()
      .mockRejectedValue(new Error("Reinicio incompleto"));
    const { dataSource } = sectionDataSource(resetPlatform);
    render(<PlatformResetSection dataSource={dataSource} />);

    fireEvent.changeText(
      screen.getByLabelText("Frase de confirmación del reinicio"),
      "REINICIAR TODO",
    );
    fireEvent.press(
      screen.getByLabelText(
        "Ejecutar el reinicio absoluto de la plataforma",
      ),
    );

    expect(await screen.findByText("Reinicio incompleto")).toBeTruthy();
    expect(screen.queryByText("PLATAFORMA REINICIADA")).toBeNull();
  });
});
