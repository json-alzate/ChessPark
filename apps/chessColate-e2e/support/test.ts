import { test as base, expect } from '@playwright/test';

import { installNetworkGuard, type NetworkGuard } from './network';

/** Fecha fija: las pantallas que dependen de "hoy" (racha, historial) salen igual siempre. */
export const FIXED_NOW = new Date('2026-10-10T12:00:00Z');

interface Options {
  /** Marca el onboarding como visto para que no tape la pantalla. Poner a `false` para probarlo. */
  skipOnboarding: boolean;
}

export const test = base.extend<Options & { network: NetworkGuard }>({
  skipOnboarding: [true, { option: true }],

  network: [
    async ({ page, baseURL, skipOnboarding }, use) => {
      const origin = new URL(baseURL as string).origin;
      const guard = await installNetworkGuard(page, origin);

      await page.clock.setFixedTime(FIXED_NOW);
      await page.addInitScript((skip) => {
        if (skip) {
          localStorage.setItem('chessColate_onboarding_seen', 'true');
        }
        // Math.random determinista (mulberry32): el puzzle que sale, los temas al azar
        // y cualquier "aleatorio" de la app dan lo mismo en cada corrida.
        let seed = 20261010;
        Math.random = () => {
          seed = (seed + 0x6d2b79f5) | 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }, skipOnboarding);

      await use(guard);
    },
    { auto: true },
  ],
});

export { expect };
