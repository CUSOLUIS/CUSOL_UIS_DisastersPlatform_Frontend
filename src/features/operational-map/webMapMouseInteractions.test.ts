import { panGeographicCenter } from "./OsmWebMapCanvas";
import { bindWebMapMouseInteractions } from "./webMapMouseInteractions";

type RegisteredListener = EventListenerOrEventListenerObject;

function createInteractiveElement() {
  const listeners = new Map<string, RegisteredListener[]>();
  const element = {
    style: { cursor: "crosshair" },
    addEventListener: jest.fn((type: string, listener: RegisteredListener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }),
    removeEventListener: jest.fn((type: string, listener: RegisteredListener) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((current) => current !== listener),
      );
    }),
    setPointerCapture: jest.fn(),
    releasePointerCapture: jest.fn(),
  };

  const dispatch = (type: string, event: Event) => {
    (listeners.get(type) ?? []).forEach((listener) => {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    });
  };

  return { element, dispatch };
}

function pointerEvent(values: Partial<PointerEvent> = {}): PointerEvent {
  return {
    button: 2,
    pointerId: 7,
    clientX: 100,
    clientY: 100,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...values,
  } as unknown as PointerEvent;
}

function wheelEvent(deltaY: number): WheelEvent {
  return {
    deltaY,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as WheelEvent;
}

describe("Interacciones web del mapa", () => {
  it("desplaza con clic izquierdo o derecho y evita el menú contextual", () => {
    const { element, dispatch } = createInteractiveElement();
    const onPanBy = jest.fn();
    const cleanup = bindWebMapMouseInteractions(
      element as unknown as Parameters<typeof bindWebMapMouseInteractions>[0],
      { onPanBy, onZoomBy: jest.fn() },
    );

    const contextMenu = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as Event;
    dispatch("contextmenu", contextMenu);
    expect(contextMenu.preventDefault).toHaveBeenCalledTimes(1);

    dispatch("pointerdown", pointerEvent({ button: 0 }));
    dispatch("pointermove", pointerEvent({ button: 0, clientX: 140, clientY: 130 }));
    expect(onPanBy).toHaveBeenLastCalledWith(40, 30);
    dispatch("pointerup", pointerEvent({ button: 0, clientX: 140, clientY: 130 }));

    onPanBy.mockClear();
    dispatch(
      "pointerdown",
      pointerEvent({
        button: 0,
        target: {
          closest: jest.fn().mockReturnValue({ role: "button" }),
        } as unknown as EventTarget,
      }),
    );
    dispatch("pointermove", pointerEvent({ button: 0, clientX: 150, clientY: 140 }));
    expect(onPanBy).not.toHaveBeenCalled();

    dispatch("pointerdown", pointerEvent());
    expect(element.setPointerCapture).toHaveBeenLastCalledWith(7);
    expect(element.style.cursor).toBe("grabbing");
    dispatch("pointermove", pointerEvent({ clientX: 125, clientY: 90 }));
    expect(onPanBy).toHaveBeenCalledWith(25, -10);
    dispatch("pointerup", pointerEvent({ clientX: 125, clientY: 90 }));
    expect(element.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(element.style.cursor).toBe("grab");

    cleanup();
    expect(element.style.cursor).toBe("crosshair");
  });

  it("convierte la rueda en zoom gradual y acumula gestos pequeños", () => {
    const { element, dispatch } = createInteractiveElement();
    const onZoomBy = jest.fn();
    bindWebMapMouseInteractions(
      element as unknown as Parameters<typeof bindWebMapMouseInteractions>[0],
      { onPanBy: jest.fn(), onZoomBy },
    );

    dispatch("wheel", wheelEvent(-20));
    expect(onZoomBy).not.toHaveBeenCalled();
    dispatch("wheel", wheelEvent(-20));
    expect(onZoomBy).toHaveBeenLastCalledWith(1);
    dispatch("wheel", wheelEvent(80));
    expect(onZoomBy).toHaveBeenLastCalledWith(-1);
  });

  it("transforma el arrastre en un nuevo centro geográfico", () => {
    const initialCenter = { latitude: 4.65, longitude: -74.25 };
    const moved = panGeographicCenter(initialCenter, 5, 30, 20);

    expect(moved.longitude).toBeLessThan(initialCenter.longitude);
    expect(moved.latitude).toBeGreaterThan(initialCenter.latitude);
  });
});
