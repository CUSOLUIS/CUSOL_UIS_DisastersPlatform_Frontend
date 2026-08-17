import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type GestureResponderHandlers,
} from "react-native";

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

// CHG-130 — Arrastre del muñequito en Android/iOS. Los manejadores DOM
// de arriba jamás se enganchan en nativo (el ref de un View no expone
// addEventListener, igual que en CHG-121 con el lienzo). Un dedo sobre
// el muñequito lo arrastra; el gesto es del marcador desde el primer
// toque y ningún ancestro desplazable lo arrebata a mitad de arrastre.
export function useNativeMarkerDrag(
  callbacks: DraggableMarkerCallbacks,
): GestureResponderHandlers | Record<string, never> {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  return useMemo(() => {
    if (Platform.OS === "web") {
      return {};
    }

    let last: { x: number; y: number } | null = null;
    const point = (event: GestureResponderEvent) => ({
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    });

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        last = point(event);
      },
      onPanResponderMove: (event) => {
        const current = point(event);
        if (last) {
          const deltaX = current.x - last.x;
          const deltaY = current.y - last.y;
          if (deltaX !== 0 || deltaY !== 0) {
            callbacksRef.current.onDragBy(deltaX, deltaY);
          }
        }
        last = current;
      },
      onPanResponderRelease: () => {
        last = null;
      },
      onPanResponderTerminate: () => {
        last = null;
      },
    }).panHandlers;
  }, []);
}
