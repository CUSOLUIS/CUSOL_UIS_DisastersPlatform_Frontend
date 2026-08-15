/**
 * CHG-068 — Los logos de un mismo grupo aparecen a la vez: ninguno se
 * revela hasta que TODOS terminan de cargar, y entonces la transición
 * arranca sincronizada para ambos.
 */

import { act, render, screen } from "@testing-library/react-native";
import { Animated } from "react-native";
import { FadeInImage } from "./FadeInImage";

// El setup global fija "reducir movimiento" en true para acelerar las
// demás pruebas; aquí se cubre justamente la transición animada.
jest.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

const cusol = { uri: "https://example.invalid/cusol.png" };
const prometeo = { uri: "https://example.invalid/prometeo.png" };

afterEach(() => {
  jest.restoreAllMocks();
});

it("las imágenes del grupo esperan a la última carga y aparecen juntas", async () => {
  const spy = jest.spyOn(Animated, "parallel");
  render(
    <>
      <FadeInImage testID="logo-a" group="par-de-prueba" slideFrom="left" source={cusol} />
      <FadeInImage testID="logo-b" group="par-de-prueba" slideFrom="left" source={prometeo} />
    </>,
  );
  await act(async () => undefined);

  // Carga la primera: nadie se anima todavía.
  act(() => {
    screen.getByTestId("logo-a").props.onLoad({ nativeEvent: {} });
  });
  expect(spy).not.toHaveBeenCalled();

  // Carga la segunda: la transición arranca para ambas a la vez.
  act(() => {
    screen.getByTestId("logo-b").props.onLoad({ nativeEvent: {} });
  });
  expect(spy).toHaveBeenCalledTimes(2);
});

it("sin grupo, la imagen se anima apenas carga (comportamiento CHG-063)", async () => {
  const spy = jest.spyOn(Animated, "parallel");
  render(<FadeInImage testID="solo" source={cusol} />);
  await act(async () => undefined);

  act(() => {
    screen.getByTestId("solo").props.onLoad({ nativeEvent: {} });
  });
  expect(spy).toHaveBeenCalledTimes(1);
});
