import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __e2eFactorReloj?: number;
  }
}

/**
 * Permite acelerar el reloj de la pantalla de Coordenadas.
 *
 * La partida dura 60 s y el reloj es un `interval(10)` de RxJS que resta 0,01 por tick
 * (no mira el reloj real). Esperar un minuto de verdad volvería lenta e inestable la
 * suite, y `page.clock.runFor` deja congelado el reloj de la página. Así que, antes de
 * cargar la app, se envuelve `setInterval`: cada vez que salta un intervalo de 10 ms
 * su callback se ejecuta `window.__e2eFactorReloj` veces (1 = velocidad normal).
 *
 * Llamar ANTES de `page.goto`, y luego `acelerarPartida` cuando se quiera que el
 * tiempo corra. Mientras no se llame, la partida va a velocidad real.
 */
export async function prepararReloj(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__e2eFactorReloj = 1;
    const original = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
      if (ms === 10 && typeof handler === 'function') {
        return original(() => {
          const veces = window.__e2eFactorReloj ?? 1;
          for (let i = 0; i < veces; i++) {
            (handler as (...a: unknown[]) => void)(...args);
          }
        }, 10);
      }
      return original(handler, ms, ...args);
    }) as typeof window.setInterval;
  });
}

/** Con factor 100, un segundo de juego pasa en 10 ms reales. */
export async function acelerarPartida(page: Page, factor = 100): Promise<void> {
  await page.evaluate((f) => {
    window.__e2eFactorReloj = f;
  }, factor);
}
