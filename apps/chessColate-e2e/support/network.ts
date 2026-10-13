import type { Page } from '@playwright/test';

import { PUZZLES } from './fixtures';

/** Peticiones que la app intentó hacer a hosts externos sin que una prueba las simulara. */
export interface NetworkGuard {
  blocked: string[];
}

/**
 * Llamadas de arranque de Firebase/Google que la app hace siempre, aunque la analítica
 * esté apagada. Se abortan igual, pero no se anotan: no son una fuga, son ruido.
 */
const ARRANQUE_DE_FIREBASE = [
  'apis.google.com',
  'www.googletagmanager.com',
  'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com',
];

/**
 * Corta TODA la red hacia fuera. Solo el servidor de la app y los puzzles del CDN
 * (con datos fijos) responden. Todo lo demás —Firebase, Google, chess.com, lichess,
 * RevenueCat…— se aborta y se anota en `blocked`.
 *
 * Una prueba que necesite simular algo más registra su propia ruta con `page.route`
 * *después*: Playwright atiende primero el handler más reciente.
 */
export async function installNetworkGuard(page: Page, appOrigin: string): Promise<NetworkGuard> {
  const guard: NetworkGuard = { blocked: [] };

  await page.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url());

    if (url.origin === appOrigin) {
      return route.continue();
    }
    if (url.hostname === 'cdn.jsdelivr.net') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(PUZZLES),
      });
    }
    if (ARRANQUE_DE_FIREBASE.includes(url.hostname)) {
      return route.abort('blockedbyclient');
    }
    guard.blocked.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  });

  return guard;
}
