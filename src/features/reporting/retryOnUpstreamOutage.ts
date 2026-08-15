// CHG-101 — Reintento acotado ante una caída momentánea del backend.
//
// Cada despliegue reemplaza el contenedor sin arranque en caliente, así
// que durante ~5-15 s el gateway responde 502/503/504. Quien estaba
// enviando un reporte veía un error y tenía que rehacer el envío: en
// una plataforma de emergencias eso es perder el reporte.
//
// El reintento es seguro **solo** porque el envío es idempotente: la
// misma `Idempotency-Key` viaja en todos los intentos y el backend
// devuelve la constancia del reporte ya creado en vez de duplicarlo.
// Sin esa garantía, reintentar crearía dos casos para la misma
// persona.

// Estados en los que reintentar tiene sentido: el servidor no está
// disponible, no es que haya rechazado el contenido.
export const RETRYABLE_STATUSES = [502, 503, 504] as const;

// Esperas entre intentos. Cubren buena parte de la ventana de
// reinicio sin dejar al usuario esperando indefinidamente.
export const RETRY_DELAYS_MS = [2000, 5000] as const;

export function isRetryableStatus(status: number): boolean {
  return (RETRYABLE_STATUSES as readonly number[]).includes(status);
}

export class UpstreamOutageError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamOutageError";
    this.status = status;
  }
}

export interface RetryOptions {
  signal?: AbortSignal;
  delaysMs?: readonly number[];
  // Inyectable en pruebas para no esperar de verdad.
  wait?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number) => void;
}

const defaultWait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta `attempt` reintentando solo si falla con un estado de
 * indisponibilidad. `attempt` se invoca de nuevo entera, así que debe
 * reconstruir su propio cuerpo: un FormData ya enviado no se puede
 * reutilizar de forma fiable.
 */
export async function retryOnUpstreamOutage<T>(
  attempt: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const delays = options.delaysMs ?? RETRY_DELAYS_MS;
  const wait = options.wait ?? defaultWait;

  for (let index = 0; ; index += 1) {
    try {
      return await attempt();
    } catch (error: unknown) {
      const retryable =
        error instanceof UpstreamOutageError &&
        isRetryableStatus(error.status);
      const hasBudget = index < delays.length;
      // Si el usuario abandonó la pantalla no se sigue intentando.
      if (!retryable || !hasBudget || options.signal?.aborted) {
        throw error;
      }

      options.onRetry?.(index + 1);
      await wait(delays[index]);

      if (options.signal?.aborted) {
        throw error;
      }
    }
  }
}
