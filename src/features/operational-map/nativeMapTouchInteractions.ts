// CHG-121 — Gestos táctiles del lienzo de teselas fuera de la web.
//
// Los gestos de CHG-050 son manejadores DOM (pointer/touch) y en nativo
// jamás se enganchan: el ref de un View nativo no expone
// addEventListener. Este controlador replica el mismo contrato con el
// sistema de responders de React Native: un dedo panea, dos hacen
// pinch-zoom por pasos, y el tap simple sigue llegando a marcadores y
// controles porque el responder solo se reclama cuando hay movimiento
// real o un segundo dedo.

import { useMemo, useRef } from "react";
import {
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type GestureResponderHandlers,
} from "react-native";

export interface MapTouchCallbacks {
  onPanBy: (deltaX: number, deltaY: number) => void;
  onZoomBy: (direction: 1 | -1) => void;
}

export interface TouchPoint {
  x: number;
  y: number;
}

// Mismo paso logarítmico que el pellizco web (CHG-045/CHG-050).
const PINCH_ZOOM_STEP = Math.log(1.14);
const MAX_ZOOM_STEPS_PER_FRAME = 4;
// Umbral que separa un arrastre real del temblor natural de un tap.
const DRAG_SLOP = 8;

interface ControllerState {
  lastCount: number;
  lastPan: TouchPoint | null;
  pinchDistance: number | null;
  pinchMidpoint: TouchPoint | null;
  pinchScaleDelta: number;
}

function touchMetrics(touches: TouchPoint[]): {
  distance: number;
  midpoint: TouchPoint;
} {
  const [first, second] = touches;
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
  };
}

/**
 * Máquina de estados pura del gesto: recibe la lista de toques activos
 * en cada cuadro y emite paneos y pasos de zoom. Al cambiar la cantidad
 * de dedos se re-sincroniza sin salto (CHG-050: terminar un pellizco
 * con un dedo apoyado continúa como paneo).
 */
export function createMapTouchController(callbacks: MapTouchCallbacks) {
  const state: ControllerState = {
    lastCount: 0,
    lastPan: null,
    pinchDistance: null,
    pinchMidpoint: null,
    pinchScaleDelta: 0,
  };

  const sync = (touches: TouchPoint[]) => {
    state.lastCount = touches.length;
    state.lastPan = touches.length === 1 ? touches[0] : null;
    if (touches.length === 2) {
      const metrics = touchMetrics(touches);
      state.pinchDistance = metrics.distance;
      state.pinchMidpoint = metrics.midpoint;
    } else {
      state.pinchDistance = null;
      state.pinchMidpoint = null;
    }
    state.pinchScaleDelta = 0;
  };

  const move = (touches: TouchPoint[]) => {
    if (touches.length !== state.lastCount) {
      sync(touches);
      return;
    }

    if (touches.length === 1 && state.lastPan) {
      const deltaX = touches[0].x - state.lastPan.x;
      const deltaY = touches[0].y - state.lastPan.y;
      state.lastPan = touches[0];
      if (deltaX !== 0 || deltaY !== 0) {
        callbacks.onPanBy(deltaX, deltaY);
      }
      return;
    }

    if (touches.length !== 2) {
      return;
    }

    const metrics = touchMetrics(touches);
    if (
      state.pinchDistance === null ||
      state.pinchDistance <= 0 ||
      metrics.distance <= 0
    ) {
      state.pinchDistance = metrics.distance;
      state.pinchMidpoint = metrics.midpoint;
      return;
    }

    if (state.pinchMidpoint) {
      const deltaX = metrics.midpoint.x - state.pinchMidpoint.x;
      const deltaY = metrics.midpoint.y - state.pinchMidpoint.y;
      if (deltaX !== 0 || deltaY !== 0) {
        callbacks.onPanBy(deltaX, deltaY);
      }
    }

    state.pinchScaleDelta += Math.log(metrics.distance / state.pinchDistance);
    state.pinchDistance = metrics.distance;
    state.pinchMidpoint = metrics.midpoint;

    let emittedSteps = 0;
    while (
      state.pinchScaleDelta >= PINCH_ZOOM_STEP &&
      emittedSteps < MAX_ZOOM_STEPS_PER_FRAME
    ) {
      callbacks.onZoomBy(1);
      state.pinchScaleDelta -= PINCH_ZOOM_STEP;
      emittedSteps += 1;
    }
    while (
      state.pinchScaleDelta <= -PINCH_ZOOM_STEP &&
      emittedSteps < MAX_ZOOM_STEPS_PER_FRAME
    ) {
      callbacks.onZoomBy(-1);
      state.pinchScaleDelta += PINCH_ZOOM_STEP;
      emittedSteps += 1;
    }
  };

  return { sync, move, reset: () => sync([]) };
}

/**
 * Manejadores de responder para el lienzo del mapa en Android/iOS. En
 * web devuelve un objeto vacío: allí gobiernan los manejadores DOM de
 * CHG-050 y duplicarlos produciría paneo doble.
 */
export function useNativeMapTouchInteractions(
  callbacks: MapTouchCallbacks,
): GestureResponderHandlers | Record<string, never> {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  return useMemo(() => {
    if (Platform.OS === "web") {
      return {};
    }

    const controller = createMapTouchController({
      onPanBy: (deltaX, deltaY) => callbacksRef.current.onPanBy(deltaX, deltaY),
      onZoomBy: (direction) => callbacksRef.current.onZoomBy(direction),
    });
    const readTouches = (event: GestureResponderEvent): TouchPoint[] =>
      event.nativeEvent.touches.map((touch) => ({
        x: touch.pageX,
        y: touch.pageY,
      }));

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gesture) =>
        event.nativeEvent.touches.length >= 2 ||
        Math.abs(gesture.dx) > DRAG_SLOP ||
        Math.abs(gesture.dy) > DRAG_SLOP,
      // CHG-050: el gesto que nace en el mapa es del mapa; un ancestro
      // desplazable no lo arrebata a mitad de arrastre.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => controller.sync(readTouches(event)),
      onPanResponderMove: (event) => controller.move(readTouches(event)),
      onPanResponderRelease: (event) => controller.sync(readTouches(event)),
      onPanResponderTerminate: () => controller.reset(),
    }).panHandlers;
  }, []);
}
