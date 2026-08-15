import { useCallback, useEffect, useRef } from "react";

export interface WebMapMouseCallbacks {
  onPanBy: (deltaX: number, deltaY: number) => void;
  onZoomBy: (direction: 1 | -1) => void;
  dragButtons?: readonly number[];
  touchGestures?: boolean;
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
  const pinchZoomStep = Math.log(1.14);
  let dragging = false;
  let activePointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let wheelDelta = 0;
  let pinchDistance: number | null = null;
  let pinchScaleDelta = 0;
  let pinchMidpoint: { x: number; y: number } | null = null;
  let pinching = false;
  let singlePanLast: { x: number; y: number } | null = null;
  const previousCursor = element.style.cursor;
  const previousTouchAction = element.style.touchAction;
  const dragButtons = callbacks.dragButtons ?? [0, 2];
  const touchGestures = callbacks.touchGestures ?? true;
  element.style.cursor = "grab";
  if (touchGestures) {
    // CHG-050: el mapa consume TODOS los gestos táctiles que nacen en
    // él: un dedo panea el mapa (nunca la página) y dos hacen
    // pinch-zoom sin activar los gestos del navegador.
    element.style.touchAction = "none";
  }

  const preventContextMenu = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const startDrag = (event: PointerEvent) => {
    if (
      event.pointerType === "touch" ||
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
    if (
      event.pointerType === "touch" ||
      !dragging ||
      event.pointerId !== activePointerId
    ) {
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
    if (
      event.pointerType === "touch" ||
      !dragging ||
      event.pointerId !== activePointerId
    ) {
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

  const preventPageGesture = (event: Event) => {
    if (!touchGestures) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const startPinch = (event: TouchEvent) => {
    if (!touchGestures) return;

    // CHG-050: un solo dedo inicia el paneo del mapa, salvo que el
    // toque nazca en un control interactivo (marcadores, zoom): ahí no
    // se intercepta para que el tap siga funcionando.
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      singlePanLast = isInteractiveTarget(event.target)
        ? null
        : { x: touch.clientX, y: touch.clientY };
      return;
    }

    if (event.touches.length !== 2) return;

    singlePanLast = null;
    const metrics = touchMetrics(event.touches);
    pinchDistance = metrics.distance;
    pinchScaleDelta = 0;
    pinchMidpoint = metrics.midpoint;
    pinching = true;
    event.preventDefault();
    event.stopPropagation();
  };

  const movePinch = (event: TouchEvent) => {
    if (!touchGestures) return;

    if (!pinching && event.touches.length === 1 && singlePanLast) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - singlePanLast.x;
      const deltaY = touch.clientY - singlePanLast.y;
      singlePanLast = { x: touch.clientX, y: touch.clientY };
      if (deltaX !== 0 || deltaY !== 0) {
        callbacks.onPanBy(deltaX, deltaY);
      }
      // El gesto es del mapa: la página jamás se desplaza con él.
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!pinching || event.touches.length !== 2) return;

    const metrics = touchMetrics(event.touches);
    if (
      pinchDistance === null ||
      pinchDistance <= 0 ||
      metrics.distance <= 0
    ) {
      pinchDistance = metrics.distance;
      pinchMidpoint = metrics.midpoint;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (pinchMidpoint) {
      const deltaX = metrics.midpoint.x - pinchMidpoint.x;
      const deltaY = metrics.midpoint.y - pinchMidpoint.y;
      if (deltaX !== 0 || deltaY !== 0) {
        callbacks.onPanBy(deltaX, deltaY);
      }
    }

    pinchScaleDelta += Math.log(metrics.distance / pinchDistance);
    pinchDistance = metrics.distance;
    pinchMidpoint = metrics.midpoint;

    let emittedSteps = 0;
    while (pinchScaleDelta >= pinchZoomStep && emittedSteps < 4) {
      callbacks.onZoomBy(1);
      pinchScaleDelta -= pinchZoomStep;
      emittedSteps += 1;
    }
    while (pinchScaleDelta <= -pinchZoomStep && emittedSteps < 4) {
      callbacks.onZoomBy(-1);
      pinchScaleDelta += pinchZoomStep;
      emittedSteps += 1;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  const finishPinch = (event: TouchEvent) => {
    if (!touchGestures) return;

    if (!pinching) {
      if (event.touches.length === 0) {
        singlePanLast = null;
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length === 2) {
      const metrics = touchMetrics(event.touches);
      pinchDistance = metrics.distance;
      pinchScaleDelta = 0;
      pinchMidpoint = metrics.midpoint;
      return;
    }

    pinchDistance = null;
    pinchScaleDelta = 0;
    pinchMidpoint = null;
    pinching = false;
    // CHG-050: si queda un dedo apoyado tras el pellizco, continúa
    // como paneo de un dedo sin salto.
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      singlePanLast = { x: touch.clientX, y: touch.clientY };
    } else {
      singlePanLast = null;
    }
  };

  const cancelPinch = (event: TouchEvent) => {
    if (!touchGestures) return;

    singlePanLast = null;
    if (!pinching) return;

    event.preventDefault();
    event.stopPropagation();
    pinchDistance = null;
    pinchScaleDelta = 0;
    pinchMidpoint = null;
    pinching = false;
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
  if (touchGestures) {
    element.addEventListener("touchstart", startPinch, {
      capture: true,
      passive: false,
    });
    element.addEventListener("touchmove", movePinch, {
      capture: true,
      passive: false,
    });
    element.addEventListener("touchend", finishPinch, {
      capture: true,
      passive: false,
    });
    element.addEventListener("touchcancel", cancelPinch, {
      capture: true,
      passive: false,
    });
    // Safari expone además estos eventos propietarios durante el pellizco.
    element.addEventListener("gesturestart", preventPageGesture, {
      capture: true,
      passive: false,
    });
    element.addEventListener("gesturechange", preventPageGesture, {
      capture: true,
      passive: false,
    });
  }

  return () => {
    element.removeEventListener("contextmenu", preventContextMenu, true);
    element.removeEventListener("pointerdown", startDrag, true);
    element.removeEventListener("pointermove", moveDrag, true);
    element.removeEventListener("pointerup", finishDrag, true);
    element.removeEventListener("pointercancel", finishDrag, true);
    element.removeEventListener("wheel", zoomWithWheel, true);
    if (touchGestures) {
      element.removeEventListener("touchstart", startPinch, true);
      element.removeEventListener("touchmove", movePinch, true);
      element.removeEventListener("touchend", finishPinch, true);
      element.removeEventListener("touchcancel", cancelPinch, true);
      element.removeEventListener("gesturestart", preventPageGesture, true);
      element.removeEventListener("gesturechange", preventPageGesture, true);
      element.style.touchAction = previousTouchAction;
    }
    element.style.cursor = previousCursor;
  };
}

function touchMetrics(touches: TouchList): {
  distance: number;
  midpoint: { x: number; y: number };
} {
  const first = touches[0];
  const second = touches[1];
  return {
    distance: Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    ),
    midpoint: {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    },
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
        touchGestures: callbacksRef.current.touchGestures,
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
