import type { Page } from '@playwright/test';

import { PUZZLES, type PuzzleFixture } from '../support/fixtures';
import {
  abrirHome,
  avanzarHasta,
  elegirRutina,
  empezarBloque,
  esperarPuzzleListo,
  moverPieza,
  pantalla,
  puzzleActual,
  relojAcelerable,
  servirPuzzles,
  tablero,
} from '../support/rut-helpers';
import { expect, test } from '../support/test';

/**
 * El tablero "se congelaba" en tres situaciones que las demás pruebas no tocan porque el
 * dedo/diálogo seguía ahí cuando la posición cambiaba por debajo:
 *  1. se acaba el tiempo del ejercicio con el diálogo de coronación abierto;
 *  2. se acaba el tiempo con una pieza en la mano (arrastrando);
 *  3. el dedo arranca en el borde izquierdo del tablero (columna "a") y iOS lo toma por "volver".
 *
 * Puzzle real de lichess con coronación como primera jugada del usuario (blancas):
 * e3e4 (rival) e7e8=Q e4e8 d7e8. Se sirve también su espejo (el usuario juega con negras): la
 * rutina elige el color al azar y solo deja los puzzles de ese color.
 */
const CORONACION: PuzzleFixture = {
  ...PUZZLES[0],
  uid: 'e2ecoron',
  fen: '8/3KP2k/8/2p5/2P5/4r3/8/8 b - - 0 57',
  moves: 'e3e4 e7e8q e4e8 d7e8',
  rating: 604,
  themes: ['endgame', 'promotion', 'short'],
};

const CORONACION_ESPEJO: PuzzleFixture = {
  ...CORONACION,
  uid: 'e2ecoroN',
  fen: '8/8/4R3/2p5/2P5/8/3kp2K/8 w - - 0 57',
  moves: 'e6e5 e2e1q e5e1 d2e1',
};

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await relojAcelerable(page);
  await servirPuzzles(page, [CORONACION, CORONACION_ESPEJO]);
});

/** Casillas de la coronación del usuario en el puzzle que hay en el tablero (e7e8 o e2e1). */
const coronacionDe = (moves: string) => moves.split(' ')[1].slice(0, 4);

async function empezarBullet(page: Page) {
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  return esperarPuzzleListo(page);
}

const dialogoDeCoronacion = (page: Page) => page.locator('.promotion-dialog-button-group');

/** Toque con el dedo (evento táctil real): Playwright solo sabe tocar, no arrastrar. */
async function dedo(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const tocar = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  return { tocar };
}

async function centro(page: Page, casilla: string) {
  const caja = await tablero(page).locator(`rect[data-square="${casilla}"]`).boundingBox();
  if (!caja) throw new Error(`la casilla ${casilla} no está visible`);
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

test('si se acaba el tiempo con el diálogo de coronación abierto, el puzzle siguiente no hereda el diálogo ni pierde el primer toque', async ({ page }) => {
  const p = await empezarBullet(page);

  await moverPieza(page, coronacionDe(p.moves));
  await expect(dialogoDeCoronacion(page).first()).toBeVisible();

  // El ejercicio de Bullet dura 10 s: el reloj llega a 0 con el diálogo todavía abierto
  await avanzarHasta(page, async () => (await puzzleActual(page))?.marca !== p.marca, { pasoMs: 1000, maxMs: 20_000 });
  const siguiente = await esperarPuzzleListo(page, p.marca);

  await expect(dialogoDeCoronacion(page)).toHaveCount(0);
  // El primer toque en el puzzle nuevo ya selecciona la pieza (antes se gastaba en cancelar el diálogo viejo)
  await moverPieza(page, coronacionDe(siguiente.moves));
  await expect(dialogoDeCoronacion(page).first()).toBeVisible();
});

test('si se acaba el tiempo con una pieza en la mano, no queda una pieza fantasma y el tablero responde', async ({ page }) => {
  const p = await empezarBullet(page);
  const { tocar } = await dedo(page);
  const origen = await centro(page, coronacionDe(p.moves).slice(0, 2));

  await tocar('touchStart', origen.x, origen.y);
  await tocar('touchMove', origen.x + 15, origen.y + 15);
  await expect(page.locator('.cm-chessboard-draggable-piece')).toHaveCount(1);

  await avanzarHasta(page, async () => (await puzzleActual(page))?.marca !== p.marca, { pasoMs: 1000, maxMs: 20_000 });
  const siguiente = await esperarPuzzleListo(page, p.marca);

  await expect(page.locator('.cm-chessboard-draggable-piece')).toHaveCount(0);
  await tocar('touchEnd', origen.x, origen.y);
  await moverPieza(page, coronacionDe(siguiente.moves));
  await expect(dialogoDeCoronacion(page).first()).toBeVisible();
});

test('deslizar el dedo desde el borde izquierdo del tablero no saca de la rutina (el "volver" de iOS)', async ({ page }) => {
  await empezarBullet(page);
  const { tocar } = await dedo(page);
  const caja = await tablero(page).boundingBox();
  if (!caja) throw new Error('sin tablero');
  const y = caja.y + caja.height / 2;

  await tocar('touchStart', 8, y);
  for (let x = 20; x <= 220; x += 25) {
    await tocar('touchMove', x, y);
  }
  await tocar('touchEnd', 220, y);
  await page.waitForTimeout(800);

  await expect(page).toHaveURL(/\/puzzles\/training$/);
  await expect(pantalla(page).locator('lib-board-puzzle')).toBeVisible();
});
