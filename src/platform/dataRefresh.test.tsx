import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { App } from "../App";
import {
  notifyDataRefresh,
  subscribeToDataRefresh,
  useDataRefreshTick,
} from "./dataRefresh";

// CHG-082 — La señal de cambios refresca la portada al instante.

function TickProbe() {
  const tick = useDataRefreshTick();
  return <Text testID="tick">{tick}</Text>;
}

describe("dataRefresh", () => {
  it("publica el aviso a todos los suscriptores y permite darse de baja", () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = subscribeToDataRefresh(first);
    const unsubscribeSecond = subscribeToDataRefresh(second);

    notifyDataRefresh();
    unsubscribeFirst();
    notifyDataRefresh();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    unsubscribeSecond();
  });

  it("el tick crece con cada aviso", async () => {
    render(<TickProbe />);
    expect(screen.getByTestId("tick").props.children).toBe(0);

    act(() => notifyDataRefresh());
    await waitFor(() =>
      expect(screen.getByTestId("tick").props.children).toBe(1),
    );
  });
});

describe("sonda de la señal de cambios en App", () => {
  afterEach(() => jest.useRealTimers());

  it("avisa cuando la huella cambia y calla cuando no", async () => {
    jest.useFakeTimers();
    const heard = jest.fn();
    const unsubscribe = subscribeToDataRefresh(heard);
    const signals = ["a", "a", "b"];
    let reads = 0;
    const fetchSignal = jest.fn(async () => {
      const signal = signals[Math.min(reads, 2)];
      reads += 1;
      return signal;
    });

    render(
      <App
        changeSignal={{ transport: "api", fetchSignal }}
      />,
    );

    // Primera lectura: establece la línea base sin avisar.
    await act(async () => {
      await Promise.resolve();
    });
    expect(heard).not.toHaveBeenCalled();

    // Segunda lectura (misma huella): silencio.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(heard).not.toHaveBeenCalled();

    // Tercera lectura (huella nueva): aviso único.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("en modo fixture no sondea", () => {
    const fetchSignal = jest.fn();
    render(
      <App changeSignal={{ transport: "fixture", fetchSignal }} />,
    );
    expect(fetchSignal).not.toHaveBeenCalled();
  });
});
