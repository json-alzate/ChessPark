import { defineConfig } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

// Puerto propio, distinto del 4200/4301 de `nx serve`/devctl: así la suite nunca
// se engancha a un servidor de desarrollo que recompila y recarga las páginas.
const PORT = Number(process.env['E2E_PORT'] || 4310);
const baseURL = process.env['BASE_URL'] || `http://localhost:${PORT}`;

/**
 * Pruebas E2E de ChessColate (Playwright).
 *
 * - La app se compila una vez en desarrollo y se sirve estática (`support/serve.mjs`).
 * - NUNCA se toca la red real: `support/network.ts` intercepta todo (Firebase,
 *   CDN de puzzles, APIs de chess.com/lichess). Las claves reales de
 *   `src/environments/private/keys.ts` no llegan a usarse.
 * - Viewport de móvil: la app es Ionic/Capacitor.
 * - `toHaveScreenshot` compara contra las capturas de `snapshots/`: son la red
 *   de seguridad visual de los refactors. Ver README.md.
 */
export default defineConfig({
  testDir: './specs',
  outputDir: '../../dist/.playwright/apps/chessColate-e2e/test-output',
  snapshotPathTemplate: '{testDir}/../snapshots/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['html'], ['list']] : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' },
  },

  use: {
    baseURL,
    // Reloj y entorno fijos para que las capturas sean reproducibles.
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'on-first-retry',
    launchOptions: { slowMo: Number(process.env['SLOWMO']) || 0 },
  },

  webServer: {
    command: 'node apps/chessColate-e2e/support/serve.mjs',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
    timeout: 600_000,
    env: { E2E_PORT: String(PORT) },
  },

  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
  ],
});
