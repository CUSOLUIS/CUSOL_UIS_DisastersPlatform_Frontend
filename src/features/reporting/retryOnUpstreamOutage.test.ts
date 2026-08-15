/**
 * CHG-101 — Reintento acotado ante 502/503/504. Lo que hace seguro
 * reintentar es que el envío es idempotente; sin eso, cada reintento
 * crearía otro reporte.
 */

import {
  RETRY_DELAYS_MS,
  UpstreamOutageError,
  isRetryableStatus,
  retryOnUpstreamOutage,
} from "./retryOnUpstreamOutage";

const noWait = () => Promise.resolve();

describe("qué se considera reintentable", () => {
  it("solo los estados de servidor no disponible", () => {
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("nunca un rechazo del contenido ni un éxito", () => {
    for (const status of [200, 201, 400, 401, 409, 413, 422, 429, 500]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
  });
});

describe("reintento", () => {
  it("devuelve el resultado sin reintentar si el primer intento va bien", async () => {
    const attempt = jest.fn().mockResolvedValue("constancia");

    await expect(
      retryOnUpstreamOutage(attempt, { wait: noWait }),
    ).resolves.toBe("constancia");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("supera una ventana de despliegue: 504 y luego éxito", async () => {
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(new UpstreamOutageError(504, "no disponible"))
      .mockResolvedValue("constancia");

    await expect(
      retryOnUpstreamOutage(attempt, { wait: noWait }),
    ).resolves.toBe("constancia");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("agota los reintentos previstos y entonces propaga el error", async () => {
    const attempt = jest
      .fn()
      .mockRejectedValue(new UpstreamOutageError(503, "no disponible"));

    await expect(
      retryOnUpstreamOutage(attempt, { wait: noWait }),
    ).rejects.toThrow("no disponible");
    // Un intento inicial más un reintento por cada espera prevista.
    expect(attempt).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });

  it("no reintenta un error de validación: el usuario debe corregirlo", async () => {
    const attempt = jest
      .fn()
      .mockRejectedValue(new Error("Revisa los campos: reporterPhone."));

    await expect(
      retryOnUpstreamOutage(attempt, { wait: noWait }),
    ).rejects.toThrow("Revisa los campos");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("respeta las esperas previstas, en orden", async () => {
    const waited: number[] = [];
    const attempt = jest
      .fn()
      .mockRejectedValue(new UpstreamOutageError(502, "no disponible"));

    await expect(
      retryOnUpstreamOutage(attempt, {
        wait: async (ms) => {
          waited.push(ms);
        },
      }),
    ).rejects.toThrow();
    expect(waited).toEqual([...RETRY_DELAYS_MS]);
  });

  it("deja de reintentar si el usuario abandonó la pantalla", async () => {
    const controller = new AbortController();
    const attempt = jest
      .fn()
      .mockRejectedValue(new UpstreamOutageError(504, "no disponible"));
    controller.abort();

    await expect(
      retryOnUpstreamOutage(attempt, {
        wait: noWait,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("avisa de cada reintento para poder informarlo en pantalla", async () => {
    const onRetry = jest.fn();
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(new UpstreamOutageError(504, "no disponible"))
      .mockResolvedValue("constancia");

    await retryOnUpstreamOutage(attempt, { wait: noWait, onRetry });

    expect(onRetry).toHaveBeenCalledWith(1);
  });
});
