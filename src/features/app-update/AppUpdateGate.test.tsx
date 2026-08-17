// CHG-128 — El portón bloquea la app instalada desactualizada y deja
// pasar en todos los demás casos (falla abierta, DEC-128-03).

import { Text } from "react-native";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { AppUpdateGate } from "./AppUpdateGate";

afterEach(cleanup);

const contenido = <Text>contenido de la app</Text>;

describe("AppUpdateGate (CHG-128)", () => {
  it("bloquea la app y dispara la descarga cuando hay versión más nueva", async () => {
    const openDownload = jest.fn();
    render(
      <AppUpdateGate
        platformOs="android"
        revision="vieja111"
        fetchLatest={async () => "nueva222"}
        openDownload={openDownload}
      >
        {contenido}
      </AppUpdateGate>,
    );

    expect(await screen.findByTestId("app-update-gate")).toBeTruthy();
    expect(screen.queryByText("contenido de la app")).toBeNull();
    expect(
      screen.getByText("Hay una versión más nueva de la app"),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole("button", { name: "ACTUALIZAR AHORA" }),
    );
    expect(openDownload).toHaveBeenCalledTimes(1);
    // El portón sigue bloqueando: no hay forma de continuar sin
    // instalar la versión nueva.
    expect(screen.queryByText("contenido de la app")).toBeNull();
  });

  it("deja pasar cuando la revisión está al día", async () => {
    render(
      <AppUpdateGate
        platformOs="android"
        revision="misma333"
        fetchLatest={async () => "misma333"}
      >
        {contenido}
      </AppUpdateGate>,
    );

    expect(await screen.findByText("contenido de la app")).toBeTruthy();
  });

  it("deja pasar si el manifiesto no responde (falla abierta)", async () => {
    render(
      <AppUpdateGate
        platformOs="android"
        revision="vieja111"
        fetchLatest={async () => null}
      >
        {contenido}
      </AppUpdateGate>,
    );

    expect(await screen.findByText("contenido de la app")).toBeTruthy();
  });

  it("no verifica nada en la web", () => {
    const fetchLatest = jest.fn();
    render(
      <AppUpdateGate
        platformOs="web"
        revision="vieja111"
        fetchLatest={fetchLatest}
      >
        {contenido}
      </AppUpdateGate>,
    );
    expect(screen.getByText("contenido de la app")).toBeTruthy();
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it("no verifica nada en builds sin revisión embebida", () => {
    const fetchLatest = jest.fn();
    render(
      <AppUpdateGate
        platformOs="android"
        revision={null}
        fetchLatest={fetchLatest}
      >
        {contenido}
      </AppUpdateGate>,
    );
    expect(screen.getByText("contenido de la app")).toBeTruthy();
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it("muestra el estado de verificación mientras consulta", () => {
    render(
      <AppUpdateGate
        platformOs="android"
        revision="vieja111"
        fetchLatest={() => new Promise(() => undefined)}
      >
        {contenido}
      </AppUpdateGate>,
    );
    expect(screen.getByTestId("app-update-checking")).toBeTruthy();
    expect(screen.queryByText("contenido de la app")).toBeNull();
  });
});
