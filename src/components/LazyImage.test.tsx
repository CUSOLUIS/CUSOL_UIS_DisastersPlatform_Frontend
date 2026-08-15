/**
 * CHG-090 (QA) — La fotografía de una tarjeta no se descarga hasta que
 * el hueco que ocupa se acerca a la ventana: hasta entonces se pinta el
 * marcador de posición.
 */

import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { LazyImage, lazyImageRootMargin } from "./LazyImage";

const foto = { uri: "https://example.invalid/persona.jpg" };

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

function installObserver() {
  const observed: ObserverCallback[] = [];
  const disconnect = jest.fn();
  const options: (IntersectionObserverInit | undefined)[] = [];

  class FakeObserver {
    constructor(callback: ObserverCallback, init?: IntersectionObserverInit) {
      observed.push(callback);
      options.push(init);
    }
    observe = jest.fn();
    disconnect = disconnect;
  }

  // El componente detecta la capacidad, así que exponer el observador
  // basta para activar el diferido.
  (window as unknown as Record<string, unknown>).IntersectionObserver =
    FakeObserver;

  return { observed, disconnect, options };
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).IntersectionObserver;
  jest.restoreAllMocks();
});

it("no monta la imagen hasta que el hueco entra en la ventana", async () => {
  const { observed } = installObserver();

  render(
    <LazyImage
      testID="foto-persona"
      placeholder={<Text>SIN FOTO</Text>}
      source={foto}
    />,
  );
  await act(async () => undefined);

  // Fuera de pantalla: solo el marcador de posición.
  expect(screen.queryByTestId("foto-persona")).toBeNull();
  expect(screen.getByText("SIN FOTO")).toBeTruthy();

  // El observador anuncia la entrada y la descarga arranca.
  act(() => {
    observed[0]([{ isIntersecting: true }]);
  });

  expect(screen.getByTestId("foto-persona")).toBeTruthy();
  expect(screen.queryByText("SIN FOTO")).toBeNull();
});

it("se anticipa a la ventana y deja de observar tras la primera entrada", async () => {
  const { observed, disconnect, options } = installObserver();

  render(<LazyImage testID="foto-persona" source={foto} />);
  await act(async () => undefined);

  expect(options[0]?.rootMargin).toBe(lazyImageRootMargin);

  act(() => {
    observed[0]([{ isIntersecting: true }]);
  });

  expect(disconnect).toHaveBeenCalled();
});

it("sin IntersectionObserver la imagen se monta de una vez", async () => {
  render(<LazyImage testID="foto-persona" source={foto} />);
  await act(async () => undefined);

  expect(screen.getByTestId("foto-persona")).toBeTruthy();
});

it("muestra la foto de una vez si el nodo no es observable", async () => {
  const { observed } = installObserver();
  // Un entorno sin DOM real rechaza observe(): la foto no puede quedar
  // esperando un aviso que nunca llegará.
  (window as unknown as Record<string, unknown>).IntersectionObserver =
    class {
      constructor(callback: ObserverCallback) {
        observed.push(callback);
      }
      observe() {
        throw new TypeError("no es un Element");
      }
      disconnect = jest.fn();
    };

  render(<LazyImage testID="foto-persona" source={foto} />);
  await act(async () => undefined);

  expect(screen.getByTestId("foto-persona")).toBeTruthy();
});
