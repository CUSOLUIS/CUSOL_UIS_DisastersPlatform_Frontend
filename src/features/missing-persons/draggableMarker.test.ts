import { bindDraggableMarker } from "./draggableMarker";

type RegisteredListener = EventListenerOrEventListenerObject;

function createInteractiveElement() {
  const listeners = new Map<string, RegisteredListener[]>();
  const element = {
    style: { cursor: "default" },
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
    button: 0,
    pointerId: 3,
    clientX: 50,
    clientY: 50,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...values,
  } as unknown as PointerEvent;
}

describe("Arrastre del muñequito de ubicación", () => {
  it("emite los desplazamientos del arrastre con clic izquierdo y detiene la propagación", () => {
    const { element, dispatch } = createInteractiveElement();
    const onDragBy = jest.fn();
    const cleanup = bindDraggableMarker(
      element as unknown as Parameters<typeof bindDraggableMarker>[0],
      { onDragBy },
    );

    const start = pointerEvent();
    dispatch("pointerdown", start as unknown as Event);
    expect(start.stopPropagation).toHaveBeenCalled();
    expect(element.style.cursor).toBe("grabbing");

    dispatch(
      "pointermove",
      pointerEvent({ clientX: 62, clientY: 41 }) as unknown as Event,
    );
    expect(onDragBy).toHaveBeenCalledWith(12, -9);

    dispatch("pointerup", pointerEvent({ clientX: 62, clientY: 41 }) as unknown as Event);
    expect(element.style.cursor).toBe("grab");

    cleanup();
    expect(element.style.cursor).toBe("default");
  });

  it("ignora otros botones y punteros ajenos al arrastre activo", () => {
    const { element, dispatch } = createInteractiveElement();
    const onDragBy = jest.fn();
    bindDraggableMarker(
      element as unknown as Parameters<typeof bindDraggableMarker>[0],
      { onDragBy },
    );

    dispatch("pointerdown", pointerEvent({ button: 2 }) as unknown as Event);
    dispatch("pointermove", pointerEvent({ clientX: 80 }) as unknown as Event);
    expect(onDragBy).not.toHaveBeenCalled();

    dispatch("pointerdown", pointerEvent() as unknown as Event);
    dispatch(
      "pointermove",
      pointerEvent({ pointerId: 99, clientX: 90 }) as unknown as Event,
    );
    expect(onDragBy).not.toHaveBeenCalled();
  });
});
