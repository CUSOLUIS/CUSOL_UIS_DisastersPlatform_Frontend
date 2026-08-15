/**
 * CHG-065 — Anuncio de descarga de la app al entrar.
 *
 * Aparece al cargar, dura 10 segundos con cuenta regresiva, se puede
 * cerrar con la X o se cierra solo, y ofrece el APK de Android con la
 * alternativa de pantalla de inicio para iPhone.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ANDROID_APK_PATH, AppDownloadPromo } from "./AppDownloadPromo";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("se muestra al entrar y se cierra solo a los 10 segundos", () => {
  jest.useFakeTimers();
  render(<AppDownloadPromo enabled />);

  expect(screen.getByTestId("app-download-promo")).toBeTruthy();
  expect(screen.getByText(/SE CIERRA EN 10 S/)).toBeTruthy();

  act(() => {
    jest.advanceTimersByTime(4_000);
  });
  expect(screen.getByText(/SE CIERRA EN 6 S/)).toBeTruthy();

  act(() => {
    jest.advanceTimersByTime(6_000);
  });
  expect(screen.queryByTestId("app-download-promo")).toBeNull();
});

it("la X lo cierra de inmediato", () => {
  jest.useFakeTimers();
  render(<AppDownloadPromo enabled />);

  fireEvent.press(screen.getByTestId("app-download-promo-close"));

  expect(screen.queryByTestId("app-download-promo")).toBeNull();
});

it("ofrece el APK de Android y la alternativa para iPhone", () => {
  jest.useFakeTimers();
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  render(<AppDownloadPromo enabled />);

  fireEvent.press(screen.getByTestId("app-download-promo-android"));
  expect(openUrl).toHaveBeenCalledWith(ANDROID_APK_PATH);
  expect(screen.getByText(/Añadir a\s+pantalla de inicio/)).toBeTruthy();
});

it("deshabilitado no aparece (plataformas nativas)", () => {
  render(<AppDownloadPromo enabled={false} />);

  expect(screen.queryByTestId("app-download-promo")).toBeNull();
});
