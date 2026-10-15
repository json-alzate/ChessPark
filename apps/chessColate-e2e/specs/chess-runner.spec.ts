import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';
import { PUZZLES } from '../support/fixtures';
import { jugarJugadaErronea, resolverPuzzle } from '../support/resto-tablero';

// Una carrera dura unos 10 s en tiempo real: margen para máquinas cargadas.
test.describe.configure({ timeout: 90_000 });

/**
 * Chess Runner (/chess-runner): Chocolate corre y salta las piezas del ejercicio como obstáculos; al
 * superarlas aparece el tablero con su reloj. Ver docs/implementado/CHESS_RUNNER_FLOW.md.
 *
 * El CDN de pruebas solo sirve los 3 ejercicios de los fixtures y la sesión no repite ninguno: al
 * tercero el catálogo se agota y sale la pantalla de error. El tutorial se ve la primera vez.
 */

const TUTORIAL_KEY = 'chessColate_runner_tutorial_seen';

const el = (page: Page, id: string) => page.locator(`[data-testid=${id}]`);

/** Con el tutorial ya visto, que es lo normal a partir de la segunda vez. */
const tutorialVisto = (page: Page) => page.addInitScript((k) => localStorage.setItem(k, 'true'), TUTORIAL_KEY);

/** El ejercicio de los fixtures que hay en el tablero. */
async function ejercicioEnPantalla(page: Page) {
  const uid = await page.evaluate(() => {
    const tablero = document.querySelector('lib-board-puzzle');
    // @ts-expect-error `ng` solo existe en la build de desarrollo, que es la que sirve la E2E
    return window.ng.getComponent(tablero).puzzle.uid as string;
  });
  const puzzle = PUZZLES.find((p) => p.uid === uid);
  if (!puzzle) {
    throw new Error(`El ejercicio ${uid} no es de los fixtures`);
  }
  return puzzle;
}

/**
 * Juega la carrera como un jugador de teclado: lee dónde está el siguiente obstáculo y pulsa lo que pide
 * esa pieza cuando está a la distancia justa. Devuelve cuando el tablero ya está a la vista.
 */
async function correrConElTeclado(page: Page) {
  await page.evaluate(() => {
    const ACTUAR_A: Record<string, number> = { pawn: 27, rook: 20, bishop: 49, knight: 42, queen: 62, king: 28 };
    const tecla = (tipo: string, key: string) =>
      window.dispatchEvent(new KeyboardEvent(tipo, { key, bubbles: true, cancelable: true }));
    const hecho = new Set<number>();
    const temporizador = setInterval(() => {
      const lienzo = document.querySelector('app-runner-canvas');
      if (!lienzo) {
        clearInterval(temporizador);
        return;
      }
      // @ts-expect-error `ng` solo existe en la build de desarrollo
      const estado = window.ng.getComponent(lienzo).state;
      if (!estado || estado.phase === 'done') {
        return;
      }
      const obstaculo = estado.obstacles.find(
        (o: { id: number; hit: boolean; cleared: boolean }) => !o.hit && !o.cleared && !hecho.has(o.id)
      );
      if (!obstaculo || obstaculo.x - (estado.dog.x + 15) > ACTUAR_A[obstaculo.kind]) {
        return;
      }
      hecho.add(obstaculo.id);
      switch (obstaculo.kind) {
        case 'rook':
          tecla('keydown', 'ArrowDown');
          tecla('keyup', 'ArrowDown');
          break;
        case 'bishop':
          tecla('keydown', 'ArrowRight');
          tecla('keyup', 'ArrowRight');
          break;
        case 'knight':
          tecla('keydown', ' ');
          setTimeout(() => tecla('keyup', ' '), 850);
          break;
        case 'queen':
          tecla('keydown', ' ');
          setTimeout(() => tecla('keyup', ' '), 50);
          setTimeout(() => {
            tecla('keydown', ' ');
            setTimeout(() => tecla('keyup', ' '), 50);
          }, 300);
          break;
        default:
          tecla('keydown', ' ');
          setTimeout(() => tecla('keyup', ' '), 50);
      }
    }, 4);
  });
  await expect(el(page, 'board-view')).toBeVisible({ timeout: 60_000 });
}

test.describe('Chess Runner · tutorial', () => {
  test('la primera vez enseña cómo se salta cada pieza y no arranca hasta que se confirma', async ({ page }) => {
    await page.goto('/chess-runner');

    await expect(el(page, 'tutorial')).toBeVisible();
    await expect(el(page, 'tutorial').locator('li')).toHaveCount(6);
    await expect(page.getByText('Pawn')).toBeVisible();
    await expect(page.getByText('Queen')).toBeVisible();
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), TUTORIAL_KEY)).toBeNull();
  });

  test('«Let\'s run» lo da por visto, arranca la carrera y en las siguientes visitas ya no sale', async ({ page }) => {
    await page.goto('/chess-runner');
    await el(page, 'tutorial-start').click();

    await expect(el(page, 'runner-canvas')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), TUTORIAL_KEY)).toBe('true');

    await page.reload();
    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'tutorial')).toHaveCount(0);
  });
});

test.describe('Chess Runner · la carrera', () => {
  test.beforeEach(async ({ page }) => {
    await tutorialVisto(page);
  });

  test('arranca con el lienzo a una escala entera, las piezas por superar y la ayuda a la vista', async ({ page }) => {
    await page.goto('/chess-runner');

    const lienzo = el(page, 'runner-canvas');
    await expect(lienzo).toBeVisible();
    const caja = (await lienzo.boundingBox())!;
    // 393 px de móvil: 196 px lógicos a 2×
    expect(Math.round(caja.width)).toBe(392);
    expect(Math.round(caja.height)).toBe(352);
    expect(await el(page, 'pips').locator('img').count()).toBeGreaterThan(0);
    expect(await el(page, 'pips').locator('img').count()).toBeLessThanOrEqual(8);
    await expect(page.getByText('Tap to jump')).toBeVisible();
    await expect(el(page, 'skip')).toBeVisible();
    await expect(el(page, 'session')).toContainText('Solved: 0');
  });

  test('jugada con el teclado, sin tropezar, termina y pasa al ejercicio con su reloj', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();

    await correrConElTeclado(page);

    await expect(el(page, 'run-summary')).toContainText('A run without stumbles.');
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    // El ejercicio trae su cuenta atrás: 60 s, la carrera no los descuenta
    await expect(page.locator('lib-board-puzzle')).toContainText(/00:(59|60)|01:00/);
  });

  test('sin tocar nada Chocolate tropieza, la pieza vuelve una vez y la carrera acaba sola', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();

    await expect(el(page, 'board-view')).toBeVisible({ timeout: 80_000 });

    await expect(el(page, 'run-summary')).toContainText('stumbles');
  });

  test('«Skip the run» va directo al ejercicio', async ({ page }) => {
    await page.goto('/chess-runner');
    await el(page, 'skip').click();

    await expect(el(page, 'board-view')).toBeVisible();
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
  });

  test('con el dedo: tocar en cualquier parte salta, deslizar abajo agacha y arriba a la derecha es el salto largo', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    const toque = (type: string, x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const perro = () =>
      page.evaluate(() => {
        // @ts-expect-error `ng` solo existe en la build de desarrollo
        const s = window.ng.getComponent(document.querySelector('app-runner-canvas')).state;
        return { y: s.dog.y as number, slide: s.dog.slide as number, longJump: s.dog.longJump as boolean, jumps: s.dog.jumps as number };
      });
    const aterrizado = async () => {
      await expect.poll(async () => (await perro()).y).toBe(0);
    };

    // Un toque lejos del lienzo, donde cae el pulgar
    await toque('touchStart', 200, 700);
    await toque('touchEnd', 0, 0);
    await expect.poll(async () => (await perro()).jumps).toBe(1);
    await aterrizado();

    // Deslizar hacia abajo, despacio como una mano
    await toque('touchStart', 200, 420);
    for (let i = 1; i <= 5; i++) {
      await toque('touchMove', 200, 420 + i * 9);
      await page.waitForTimeout(25);
    }
    expect((await perro()).slide).toBeGreaterThan(0);
    await toque('touchEnd', 0, 0);
    await page.waitForTimeout(700);
    await aterrizado();

    // Arriba y a la derecha
    await toque('touchStart', 150, 520);
    for (let i = 1; i <= 5; i++) {
      await toque('touchMove', 150 + i * 8, 520 - i * 8);
      await page.waitForTimeout(25);
    }
    expect((await perro()).longJump).toBe(true);
    await toque('touchEnd', 0, 0);
  });
});

test.describe('Chess Runner · el ejercicio', () => {
  test.beforeEach(async ({ page }) => {
    await tutorialVisto(page);
    await page.goto('/chess-runner');
    await el(page, 'skip').click();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
  });

  test('resolverlo suma a la sesión, celebra y ofrece otro ejercicio sin la solución', async ({ page }) => {
    await resolverPuzzle(page, await ejercicioEnPantalla(page));

    await expect(el(page, 'result-message')).toHaveText('Well solved.');
    await expect(el(page, 'session')).toContainText('Solved: 1');
    await expect(el(page, 'show-solution')).toHaveCount(0);
    await expect(el(page, 'next')).toBeVisible();
  });

  test('fallarlo no suma, deja ver la solución y pide otro', async ({ page }) => {
    await jugarJugadaErronea(page, await ejercicioEnPantalla(page));

    await expect(el(page, 'result-message')).toHaveText("That's not the best move.");
    await expect(el(page, 'session')).toContainText('Solved: 0');

    await el(page, 'show-solution').click();
    const solucion = page.locator('ion-modal.puzzle-solution-modal');
    await expect(solucion).toBeVisible();
    await expect(solucion.locator('svg.cm-chessboard')).toBeVisible();
    await solucion.getByRole('button', { name: 'Play and close' }).click();
    await expect(solucion).toHaveCount(0);
  });

  test('«Another exercise» trae una carrera nueva con otro ejercicio de la sesión', async ({ page }) => {
    const primero = await ejercicioEnPantalla(page);
    await resolverPuzzle(page, primero);

    await el(page, 'next').click();

    await expect(el(page, 'runner-canvas')).toBeVisible();
    await el(page, 'skip').click();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    expect((await ejercicioEnPantalla(page)).uid).not.toBe(primero.uid);
  });

  test('cuando el catálogo se queda sin ejercicios nuevos enseña el error y deja reintentar', async ({ page }) => {
    // Los fixtures solo traen 3 y no se repiten dentro de la sesión
    for (let i = 0; i < 2; i++) {
      await resolverPuzzle(page, await ejercicioEnPantalla(page));
      await el(page, 'next').click();
      await el(page, 'skip').click();
      await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    }
    await resolverPuzzle(page, await ejercicioEnPantalla(page));
    await expect(el(page, 'session')).toContainText('Solved: 3');

    await el(page, 'next').click();

    await expect(el(page, 'error')).toBeVisible();
    await expect(page.getByRole('heading', { name: "We couldn't fetch the exercise" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });
});

test.describe('Chess Runner · salidas', () => {
  test('la equis lleva al inicio', async ({ page }) => {
    await tutorialVisto(page);
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();

    await el(page, 'exit').click();

    await expect(page).toHaveURL(/\/home$/);
  });

  test('aparece en el menú lateral, en Práctica', async ({ page }) => {
    await page.goto('/home');
    await page.locator('app-navbar [role=button]').first().click();

    await expect(page.getByText('Chess Runner').first()).toBeVisible();
  });
});
