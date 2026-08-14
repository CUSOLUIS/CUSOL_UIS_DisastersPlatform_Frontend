import { useCallback, useEffect, useRef } from "react";

export interface DraggableMarkerCallbacks {
  onDragBy: (deltaX: number, deltaY: number) => void;
}

type InteractiveElement = Pick<
  HTMLElement,
  | "addEventListener"
  | "removeEventListener"
  | "setPointerCapture"
  | "releasePointerCapture"
  | "style"
>;

// Arrastre del muñequito con clic izquierdo. Detiene la propagación para que
// el lienzo del mapa no interprete el gesto como desplazamiento del encuadre.
export function bindDraggableMarker(
  element: InteractiveElement,
  callbacks: DraggableMarkerCallbacks,
): () => void {
  let dragging = false;
  let activePointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  const previousCursor = element.style.cursor;
  element.style.cursor = "grab";

  const startDrag = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    dragging = true;
    activePointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    element.style.cursor = "grabbing";
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      // El navegador puede rechazar la captura si el puntero ya terminó.
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const moveDrag = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (deltaX !== 0 || deltaY !== 0) {
      callbacks.onDragBy(deltaX, deltaY);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const finishDrag = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    dragging = false;
    activePointerId = null;
    element.style.cursor = "grab";
    try {
      element.releasePointerCapture?.(event.pointerId);
    } catch {
      // La liberación puede llegar después de perder la captura fuera del mapa.
    }
    event.preventDefault();
    event.stopPropagation();
  };

  element.addEventListener("pointerdown", startDrag);
  element.addEventListener("pointermove", moveDrag);
  element.addEventListener("pointerup", finishDrag);
  element.addEventListener("pointercancel", finishDrag);

  return () => {
    element.removeEventListener("pointerdown", startDrag);
    element.removeEventListener("pointermove", moveDrag);
    element.removeEventListener("pointerup", finishDrag);
    element.removeEventListener("pointercancel", finishDrag);
    element.style.cursor = previousCursor;
  };
}

export function useDraggableMarker(callbacks: DraggableMarkerCallbacks) {
  const callbacksRef = useRef(callbacks);
  const cleanupRef = useRef<(() => void) | null>(null);
  callbacksRef.current = callbacks;

  const attach = useCallback((node: unknown) => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const candidate = node as Partial<InteractiveElement> | null;
    if (
      !candidate ||
      typeof candidate.addEventListener !== "function" ||
      typeof candidate.removeEventListener !== "function" ||
      !candidate.style
    ) {
      return;
    }

    cleanupRef.current = bindDraggableMarker(candidate as InteractiveElement, {
      onDragBy: (deltaX, deltaY) => callbacksRef.current.onDragBy(deltaX, deltaY),
    });
  }, []);

  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    [],
  );

  return attach;
}
