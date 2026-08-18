/**
 * CHG-155 — El gesto que nace en el mapa no desplaza la página: el
 * lienzo bloquea el ScrollView padre al primer toque y lo desbloquea al
 * soltar el último dedo. Sin esto, el ScrollView vertical interceptaba
 * el arrastre hacia arriba/abajo y el mapa solo paneaba a los lados.
 */

import { act, render, screen } from "@testing-library/react-native";
import { ScrollView, View } from "react-native";
import {
  MapScrollLockProvider,
  useMapScrollLockController,
} from "./mapScrollLock";
import { useNativeMapTouchInteractions } from "./nativeMapTouchInteractions";

function MapSurface() {
  const handlers = useNativeMapTouchInteractions({
    onPanBy: jest.fn(),
    onZoomBy: jest.fn(),
  });
  return <View testID="map-surface" {...handlers} />;
}

function ScreenWithMap() {
  const { scrollEnabled, scrollLock } = useMapScrollLockController();
  return (
    <MapScrollLockProvider value={scrollLock}>
      <ScrollView testID="page-scroll" scrollEnabled={scrollEnabled}>
        <MapSurface />
      </ScrollView>
    </MapScrollLockProvider>
  );
}

const touchEvent = (touches: Array<{ pageX: number; pageY: number }>) => ({
  nativeEvent: { touches },
});

// El View del mapa es un responder (onStartShouldSetResponder=false
// hasta que hay arrastre real), así que fireEvent lo consideraría
// deshabilitado para toques: se invocan los props directamente, que es
// lo que hace React Native con onTouchStart/End/Cancel.
const dispatch = (testID: string, handler: string, event: object) => {
  act(() => {
    screen.getByTestId(testID).props[handler](event);
  });
};

describe("Bloqueo del scroll padre durante gestos del mapa (CHG-155)", () => {
  it("bloquea al primer toque y desbloquea al soltar el último dedo", () => {
    render(<ScreenWithMap />);
    const scroll = () => screen.getByTestId("page-scroll").props.scrollEnabled;

    expect(scroll()).toBe(true);

    dispatch("map-surface", "onTouchStart", touchEvent([{ pageX: 10, pageY: 10 }]));
    expect(scroll()).toBe(false);

    // Con un dedo aún apoyado (fin de pellizco) el bloqueo continúa.
    dispatch("map-surface", "onTouchEnd", touchEvent([{ pageX: 12, pageY: 40 }]));
    expect(scroll()).toBe(false);

    dispatch("map-surface", "onTouchEnd", touchEvent([]));
    expect(scroll()).toBe(true);
  });

  it("desbloquea si el sistema cancela el gesto", () => {
    render(<ScreenWithMap />);
    const scroll = () => screen.getByTestId("page-scroll").props.scrollEnabled;

    dispatch("map-surface", "onTouchStart", touchEvent([{ pageX: 10, pageY: 10 }]));
    expect(scroll()).toBe(false);

    dispatch("map-surface", "onTouchCancel", touchEvent([]));
    expect(scroll()).toBe(true);
  });

  it("fuera de una pantalla cableada los manejadores no rompen", () => {
    render(<MapSurface />);
    dispatch("map-surface", "onTouchStart", touchEvent([{ pageX: 10, pageY: 10 }]));
    dispatch("map-surface", "onTouchEnd", touchEvent([]));
    expect(screen.getByTestId("map-surface")).toBeTruthy();
  });

  it("reclama el gesto también en fase de captura (nativo)", () => {
    let handlers: ReturnType<typeof useNativeMapTouchInteractions> =
      {} as ReturnType<typeof useNativeMapTouchInteractions>;
    function Probe() {
      handlers = useNativeMapTouchInteractions({
        onPanBy: jest.fn(),
        onZoomBy: jest.fn(),
      });
      return null;
    }
    render(<Probe />);
    // CHG-155: sin el reclamo en captura, el ScrollView vertical se
    // quedaba con el arrastre hacia arriba/abajo.
    expect(typeof handlers.onMoveShouldSetResponderCapture).toBe("function");
    expect(typeof handlers.onResponderMove).toBe("function");
    expect(typeof handlers.onTouchStart).toBe("function");
    expect(typeof handlers.onTouchEnd).toBe("function");
    expect(typeof handlers.onTouchCancel).toBe("function");
  });
});
