/**
 * CHG-121 — Gestos táctiles del mapa fuera de la web: un dedo panea,
 * dos hacen pinch-zoom por pasos y los cambios de cantidad de dedos se
 * re-sincronizan sin salto, replicando el contrato de CHG-050.
 */

import {
  createMapTouchController,
  type TouchPoint,
} from "./nativeMapTouchInteractions";

function controller() {
  const onPanBy = jest.fn();
  const onZoomBy = jest.fn();
  return { onPanBy, onZoomBy, ...createMapTouchController({ onPanBy, onZoomBy }) };
}

const touch = (x: number, y: number): TouchPoint => ({ x, y });

describe("Controlador táctil nativo del mapa", () => {
  it("panea en cualquier dirección con un solo dedo", () => {
    const { sync, move, onPanBy, onZoomBy } = controller();

    sync([touch(100, 100)]);
    move([touch(112, 91)]);
    move([touch(107, 103)]);

    expect(onPanBy).toHaveBeenNthCalledWith(1, 12, -9);
    expect(onPanBy).toHaveBeenNthCalledWith(2, -5, 12);
    expect(onZoomBy).not.toHaveBeenCalled();
  });

  it("no emite paneo si el dedo no se movió", () => {
    const { sync, move, onPanBy } = controller();

    sync([touch(50, 50)]);
    move([touch(50, 50)]);

    expect(onPanBy).not.toHaveBeenCalled();
  });

  it("acerca por pasos al separar los dedos", () => {
    const { sync, move, onZoomBy } = controller();

    // Distancia 100 → 130: log(1.3) ≈ 2 pasos de log(1.14).
    sync([touch(0, 0), touch(100, 0)]);
    move([touch(-15, 0), touch(115, 0)]);

    expect(onZoomBy).toHaveBeenCalledTimes(2);
    expect(onZoomBy).toHaveBeenCalledWith(1);
  });

  it("aleja al juntar los dedos", () => {
    const { sync, move, onZoomBy } = controller();

    // Distancia 100 → 80: log(0.8) ≈ 1 paso negativo.
    sync([touch(0, 0), touch(100, 0)]);
    move([touch(10, 0), touch(90, 0)]);

    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy).toHaveBeenCalledWith(-1);
  });

  it("panea por el punto medio durante el pellizco sin cambiar el zoom", () => {
    const { sync, move, onPanBy, onZoomBy } = controller();

    sync([touch(0, 0), touch(100, 0)]);
    move([touch(10, 20), touch(110, 20)]);

    expect(onPanBy).toHaveBeenCalledWith(10, 20);
    expect(onZoomBy).not.toHaveBeenCalled();
  });

  it("al soltar un dedo tras el pellizco continúa como paneo sin salto", () => {
    const { sync, move, onPanBy } = controller();

    sync([touch(0, 0), touch(100, 0)]);
    // Queda un dedo: el primer cuadro solo re-sincroniza…
    move([touch(100, 0)]);
    expect(onPanBy).not.toHaveBeenCalled();
    // …y el siguiente ya panea desde la posición re-sincronizada.
    move([touch(106, -4)]);
    expect(onPanBy).toHaveBeenCalledWith(6, -4);
  });

  it("un segundo dedo re-sincroniza el pellizco sin zoom fantasma", () => {
    const { sync, move, onZoomBy } = controller();

    sync([touch(0, 0)]);
    // Aparece el segundo dedo lejos: solo se re-sincroniza.
    move([touch(0, 0), touch(200, 0)]);
    expect(onZoomBy).not.toHaveBeenCalled();
    // Un pellizco real desde ahí sí emite pasos.
    move([touch(30, 0), touch(170, 0)]);
    expect(onZoomBy).toHaveBeenCalledWith(-1);
  });
});
