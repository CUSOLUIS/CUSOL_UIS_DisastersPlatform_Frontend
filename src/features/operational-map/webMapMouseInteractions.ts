import { useCallback, useEffect, useRef } from "react";

export interface WebMapMouseCallbacks {
  onPanBy: (deltaX: number, deltaY: number) => void;
  onZoomBy: (direction: 1 | -1) => void;
  dragButtons?: readonly number[];
}

type InteractiveElement = Pick<
  HTMLElement,
  | "addEventListener"
  | "removeEventListener"
  | "setPointerCapture"
  | "releasePointerCapture"
  | "style"
>;

export function bindWebMapMouseInteractions(
  element: InteractiveElement,
  callbacks: WebMapMouseCallbacks,
): () => void {
  let dragging = false;
  let activePointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let wheelDelta = 0;
  const previousCursor = element.style.cursor;
  const dragButtons = callbacks.dragButtons ?? [0, 2];
  element.style.cursor = "grab";

  const preventContextMenu = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const startDrag = (event: PointerEvent) => {
    if (
      !dragButtons.includes(event.button) ||
      (event.button === 0 && isInteractiveTarget(event.target))
    ) {
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
      callbacks.onPanBy(deltaX, deltaY);
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

  const zoomWithWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    wheelDelta += event.deltaY;

    if (Math.abs(wheelDelta) < 35) {
      return;
    }

    callbacks.onZoomBy(wheelDelta < 0 ? 1 : -1);
    wheelDelta = 0;
  };

  element.addEventListener("contextmenu", preventContextMenu, true);
  element.addEventListener("pointerdown", startDrag, true);
  element.addEventListener("pointermove", moveDrag, true);
  element.addEventListener("pointerup", finishDrag, true);
  element.addEventListener("pointercancel", finishDrag, true);
  element.addEventListener("wheel", zoomWithWheel, {
    capture: true,
    passive: false,
  });

  return () => {
    element.removeEventListener("contextmenu", preventContextMenu, true);
    element.removeEventListener("pointerdown", startDrag, true);
    element.removeEventListener("pointermove", moveDrag, true);
    element.removeEventListener("pointerup", finishDrag, true);
    element.removeEventListener("pointercancel", finishDrag, true);
    element.removeEventListener("wheel", zoomWithWheel, true);
    element.style.cursor = previousCursor;
  };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const candidate = target as { closest?: (selectors: string) => unknown } | null;
  if (!candidate || typeof candidate.closest !== "function") {
    return false;
  }

  return Boolean(
    candidate.closest(
      'button, a, input, textarea, select, [role="button"], [role="link"], [role="checkbox"]',
    ),
  );
}

export function useWebMapMouseInteractions(callbacks: WebMapMouseCallbacks) {
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

    cleanupRef.current = bindWebMapMouseInteractions(
      candidate as InteractiveElement,
      {
        onPanBy: (deltaX, deltaY) =>
          callbacksRef.current.onPanBy(deltaX, deltaY),
        onZoomBy: (direction) => callbacksRef.current.onZoomBy(direction),
        dragButtons: callbacksRef.current.dragButtons,
      },
    );
  }, []);

  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    [],
  );

  return attach;
}
