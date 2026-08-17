/**
 * CHG-126 — Sección "Sistema" de la consola super_admin: tarjetas con
 * la instantánea, gráficas con la serie, tooltip al arrastrar y sondeo
 * periódico con limpieza.
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import {
  SystemMetricsSection,
  formatBytes,
  formatRate,
  formatTemperature,
  formatUptime,
} from "./SystemMetricsSection";
import { demoAdminDataSource } from "./dataSource";
import type {
  AdminDataSource,
  AdminSystemMetrics,
  SystemMetricsSample,
} from "./types";

function sample(overrides: Partial<SystemMetricsSample> = {}): SystemMetricsSample {
  return {
    sampledAt: "2026-08-16T14:00:00Z",
    cpuPercent: 37.5,
    cpuTemperatureCelsius: 44.6,
    load1m: 1.25,
    load5m: 0.9,
    load15m: 0.7,
    memoryTotalBytes: 8 * 1024 ** 3,
    memoryUsedBytes: 4 * 1024 ** 3,
    memoryAvailableBytes: 4 * 1024 ** 3,
    swapTotalBytes: 2 * 1024 ** 3,
    swapUsedBytes: 512 * 1024 ** 2,
    diskTotalBytes: 200 * 1024 ** 3,
    diskUsedBytes: 120 * 1024 ** 3,
    diskFreeBytes: 80 * 1024 ** 3,
    networkRxBytesPerSecond: 250_000,
    networkTxBytesPerSecond: 80_000,
    uptimeSeconds: 86_400 * 12 + 3_600 * 4,
    ...overrides,
  };
}

function metrics(): AdminSystemMetrics {
  const series = [
    sample({ sampledAt: "2026-08-16T13:59:50Z", cpuPercent: 20 }),
    sample({ sampledAt: "2026-08-16T13:59:55Z", cpuPercent: 60 }),
    sample({ sampledAt: "2026-08-16T14:00:00Z" }),
  ];
  return {
    intervalSeconds: 5,
    latest: series[series.length - 1],
    series,
    generatedAt: "2026-08-16T14:00:01Z",
  };
}

function dataSourceWith(
  getSystemMetrics: AdminDataSource["getSystemMetrics"],
): AdminDataSource {
  return { getSystemMetrics } as unknown as AdminDataSource;
}

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe("SystemMetricsSection", () => {
  it("muestra la instantánea del host y las tres gráficas", async () => {
    const getSystemMetrics = jest.fn().mockResolvedValue(metrics());

    render(
      <SystemMetricsSection
        dataSource={dataSourceWith(getSystemMetrics)}
        refreshKey={0}
      />,
    );

    expect(await screen.findByText("37.5%")).toBeTruthy();
    // El valor de la tarjeta y la etiqueta media del eje de memoria
    // comparten formato; basta con que exista al menos una.
    expect(screen.getAllByText("4.0 GiB").length).toBeGreaterThan(0);
    expect(screen.getByText("80.0 GiB")).toBeTruthy();
    expect(screen.getByText("↓ 244 KiB/s")).toBeTruthy();
    expect(screen.getByText("12 d 4 h")).toBeTruthy();
    // CHG-140: temperatura del host con sensor presente.
    expect(screen.getByText("44.6 °C")).toBeTruthy();
    expect(screen.getByTestId("system-chart-cpu")).toBeTruthy();
    expect(screen.getByTestId("system-chart-temperature")).toBeTruthy();
    expect(screen.getByTestId("system-chart-memory")).toBeTruthy();
    expect(screen.getByTestId("system-chart-network")).toBeTruthy();
    // Dos series en la gráfica de red exigen leyenda visible.
    expect(screen.getByText("Recibido")).toBeTruthy();
    expect(screen.getByText("Enviado")).toBeTruthy();
  });

  // CHG-140: sin sensores térmicos (VPS virtualizada) la tarjeta marca
  // N/D y la gráfica de temperatura no se dibuja; nada más se degrada.
  it("degrada la temperatura a N/D cuando el host no expone sensores", async () => {
    const withoutSensor = metrics();
    withoutSensor.series = withoutSensor.series.map((entry) => ({
      ...entry,
      cpuTemperatureCelsius: null,
    }));
    withoutSensor.latest =
      withoutSensor.series[withoutSensor.series.length - 1];
    const getSystemMetrics = jest.fn().mockResolvedValue(withoutSensor);

    render(
      <SystemMetricsSection
        dataSource={dataSourceWith(getSystemMetrics)}
        refreshKey={0}
      />,
    );

    expect(await screen.findByText("N/D")).toBeTruthy();
    expect(
      screen.getByText("Este host no expone sensores térmicos"),
    ).toBeTruthy();
    expect(screen.queryByTestId("system-chart-temperature")).toBeNull();
    expect(screen.getByTestId("system-chart-cpu")).toBeTruthy();
  });

  it("al arrastrar sobre la gráfica revela el valor y la hora de la muestra", async () => {
    const getSystemMetrics = jest.fn().mockResolvedValue(metrics());

    render(
      <SystemMetricsSection
        dataSource={dataSourceWith(getSystemMetrics)}
        refreshKey={0}
      />,
    );
    const chart = await screen.findByTestId("system-chart-cpu");
    fireEvent(chart, "layout", {
      nativeEvent: { layout: { width: 300, height: 170 } },
    });

    fireEvent(chart, "responderGrant", {
      nativeEvent: { locationX: 150 },
    });

    const tooltip = await screen.findByTestId("system-chart-cpu-tooltip");
    expect(tooltip).toBeTruthy();
    // La muestra central de la serie: 60 %.
    expect(screen.getByText("CPU: 60.0%")).toBeTruthy();

    fireEvent(chart, "responderRelease", { nativeEvent: {} });
    expect(screen.queryByTestId("system-chart-cpu-tooltip")).toBeNull();
  });

  it("sondea periódicamente y detiene el sondeo al desmontar", async () => {
    jest.useFakeTimers();
    const getSystemMetrics = jest.fn().mockResolvedValue(metrics());

    const view = render(
      <SystemMetricsSection
        dataSource={dataSourceWith(getSystemMetrics)}
        refreshKey={0}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(getSystemMetrics).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(getSystemMetrics).toHaveBeenCalledTimes(2);

    view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(20_000);
      await Promise.resolve();
    });
    expect(getSystemMetrics).toHaveBeenCalledTimes(2);
  });

  it("degrada con error y reintento cuando la consulta falla", async () => {
    const getSystemMetrics = jest
      .fn()
      .mockRejectedValueOnce(new Error("Gateway caído"))
      .mockResolvedValue(metrics());

    render(
      <SystemMetricsSection
        dataSource={dataSourceWith(getSystemMetrics)}
        refreshKey={0}
      />,
    );

    expect(await screen.findByText("Gateway caído")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "REINTENTAR" }));
    expect(await screen.findByText("37.5%")).toBeTruthy();
  });

  it("el modo demo entrega una serie con instantánea coherente", async () => {
    const demo = await demoAdminDataSource.getSystemMetrics();

    expect(demo.series.length).toBeGreaterThan(10);
    expect(demo.latest).toEqual(demo.series[demo.series.length - 1]);
    expect(demo.latest.memoryUsedBytes).toBeLessThanOrEqual(
      demo.latest.memoryTotalBytes,
    );
    expect(demo.latest.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(demo.latest.cpuPercent).toBeLessThanOrEqual(100);
    expect(demo.latest.cpuTemperatureCelsius).toBeGreaterThan(0);
  });
});

describe("formato de unidades", () => {
  it("compacta bytes, tasas y uptime", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(4 * 1024 ** 3)).toBe("4.0 GiB");
    expect(formatBytes(200 * 1024 ** 3)).toBe("200 GiB");
    expect(formatRate(250_000)).toBe("244 KiB/s");
    expect(formatTemperature(44.65)).toBe("44.6 °C");
    expect(formatUptime(86_400 * 12 + 3_600 * 4)).toBe("12 d 4 h");
    expect(formatUptime(3_600 * 2 + 60 * 5)).toBe("2 h 5 min");
  });
});
