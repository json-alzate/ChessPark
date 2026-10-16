import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';
import { PUZZLES } from '../support/fixtures';
import { esperarTurnoDelUsuario, jugarJugadaErronea, resolverPuzzle } from '../support/resto-tablero';

// Una carrera dura unos 10 s en tiempo real: margen para máquinas cargadas.
test.describe.configure({ timeout: 90_000 });

/**
 * Chess Runner (/chess-runner): Chocolate corre y, con un toque, salta las piezas del ejercicio (las del set
 * que el usuario eligió); al superarlas aparece el tablero con su reloj. Al resolverlo, confeti y la
 * siguiente carrera arranca sola. Ver docs/implementado/CHESS_RUNNER_FLOW.md.
 *
 * El CDN de pruebas solo sirve los 3 ejercicios de los fixtures y la sesión no repite ninguno: al
 * tercero el catálogo se agota y sale la pantalla de error.
 */

const el = (page: Page, id: string) => page.locator(`[data-testid=${id}]`);

/** El lienzo escucha toques y teclas cuando ya cargó los sprites y las piezas: se espera a que la carrera exista. */
async function carreraLista(page: Page) {
  await expect(el(page, 'runner-canvas')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        // @ts-expect-error `ng` solo existe en la build de desarrollo
        () => !!window.ng.getComponent(document.querySelector('app-runner-canvas')).state
      )
    )
    .toBe(true);
}

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
 * Juega la carrera como un jugador de teclado: lee cuándo llega el siguiente obstáculo (por su `plan`, que es
 * la hora de llegada aunque la pieza se deslice o salte) y pulsa Espacio con la antelación justa. Con una
 * falange pulsa dos veces seguidas: el doble salto. Devuelve cuando el tablero ya está a la vista.
 */
async function correrConElTeclado(page: Page) {
  await page.evaluate(() => {
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
      if (!obstaculo) {
        return;
      }
      const llega = (obstaculo.plan - 54) / estado.speed;
      if (llega > (obstaculo.count > 1 ? 0.17 : 0.2)) {
        return;
      }
      hecho.add(obstaculo.id);
      const pulsar = () =>
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      pulsar();
      if (obstaculo.count > 1) {
        setTimeout(pulsar, 30);
      }
    }, 4);
  });
  await expect(el(page, 'board-view')).toBeVisible({ timeout: 60_000 });
}

test.describe('Chess Runner · la carrera', () => {
  test('se ve como la referencia (con el lienzo y el cartel de nivel, que se animan, tapados)', async ({ page, network }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'pips').locator('img').first()).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(errores, 'errores de JavaScript en la página').toEqual([]);
    expect(network.blocked, 'peticiones externas no simuladas').toEqual([]);
    await expect(page).toHaveScreenshot('chess-runner-carrera.png', {
      mask: [el(page, 'runner-canvas'), el(page, 'level-banner')],
    });
  });

  test('las miniaturas son las piezas del set que el usuario eligió en Ajustes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chessColate_pieces', 'papercut'));
    await page.goto('/chess-runner');

    const miniatura = el(page, 'pips').locator('img').first();
    await expect(miniatura).toBeVisible();
    // Los sets de Lichess llevan gradientes con su propio nombre dentro del SVG
    expect(decodeURIComponent((await miniatura.getAttribute('src')) ?? '')).toContain('papercut');
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
    await expect(page.getByText('Tap to jump. Two taps in a row, double jump.')).toBeVisible();
    await expect(el(page, 'level')).toHaveText('Level 1');
    await expect(el(page, 'combo')).toContainText('Streak 0');
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

  test('sin tocar nada Chocolate choca, pierde los tres corazones y se acaba la partida', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'hearts').locator('[data-full=true]')).toHaveCount(3);

    await expect(el(page, 'game-over')).toBeVisible({ timeout: 60_000 });

    await expect(el(page, 'game-over-reason')).toHaveText('You ran out of hearts.');
    await expect(el(page, 'new-record')).toBeVisible();
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
  });

  test('el récord de distancia se guarda en el dispositivo y «Play again» empieza una partida nueva', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'game-over')).toBeVisible({ timeout: 60_000 });
    const record = await page.evaluate(() => Number(localStorage.getItem('chessColate_runner_best_m')));
    expect(record).toBeGreaterThan(0);

    await el(page, 'play-again').click();

    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'level')).toHaveText('Level 1');
    await expect(el(page, 'hearts').locator('[data-full=true]')).toHaveCount(3);
    await expect(el(page, 'record')).toContainText(`${record} m`);
  });

  test('dos toques seguidos hacen el doble salto; no hay triple', async ({ page }) => {
    await page.goto('/chess-runner');
    await carreraLista(page);
    const saltos = () =>
      page.evaluate(() => {
        // @ts-expect-error `ng` solo existe en la build de desarrollo
        const s = window.ng.getComponent(document.querySelector('app-runner-canvas')).state;
        return { jumps: s.dog.jumps as number, y: s.dog.y as number };
      });

    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await saltos()).jumps).toBe(2);
    // El segundo salto llega más alto que el primero (unos 47 px)
    await expect.poll(async () => (await saltos()).y).toBeGreaterThan(55);
    await page.keyboard.press('Space');
    expect((await saltos()).jumps).toBe(2);
  });

  test('«Skip the run» va directo al ejercicio', async ({ page }) => {
    await page.goto('/chess-runner');
    await el(page, 'skip').click();

    await expect(el(page, 'board-view')).toBeVisible();
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
  });

  test('con el dedo: tocar en cualquier parte salta, al instante y sin esperar a soltar', async ({ page }) => {
    await page.goto('/chess-runner');
    await carreraLista(page);
    const cdp = await page.context().newCDPSession(page);
    const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const perro = () =>
      page.evaluate(() => {
        // @ts-expect-error `ng` solo existe en la build de desarrollo
        const s = window.ng.getComponent(document.querySelector('app-runner-canvas')).state;
        return { y: s.dog.y as number, vy: s.dog.vy as number };
      });

    // Un toque lejos del lienzo, donde cae el pulgar: salta mientras el dedo sigue apoyado
    await toque('touchStart', 200, 700);
    await expect.poll(async () => (await perro()).vy).toBeGreaterThan(0);
    await toque('touchEnd', 0, 0);
    await expect.poll(async () => (await perro()).y).toBe(0);

    // Deslizar no hace otra cosa: es el mismo salto
    await toque('touchStart', 200, 420);
    for (let i = 1; i <= 5; i++) {
      await toque('touchMove', 200, 420 + i * 9);
      await page.waitForTimeout(25);
    }
    await toque('touchEnd', 0, 0);
    await expect.poll(async () => (await perro()).y).toBe(0);
  });

  test('con la barra espaciadora también salta', async ({ page }) => {
    await page.goto('/chess-runner');
    await carreraLista(page);
    await page.keyboard.press('Space');

    await expect
      .poll(() =>
        page.evaluate(() => {
          // @ts-expect-error `ng` solo existe en la build de desarrollo
          return window.ng.getComponent(document.querySelector('app-runner-canvas')).state.dog.vy as number;
        })
      )
      .not.toBe(0);
  });
});

test.describe('Chess Runner · el ejercicio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chess-runner');
    await el(page, 'skip').click();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
  });

  test('al resolverlo el tablero es el mismo: no se recrea ni repite la primera jugada del rival', async ({ page }) => {
    const puzzle = await ejercicioEnPantalla(page);
    await esperarTurnoDelUsuario(page, puzzle);
    await page.evaluate(() => {
      (window as unknown as { __tablero: Element | null }).__tablero = document.querySelector('svg.cm-chessboard');
    });

    await resolverPuzzle(page, puzzle);

    await expect(el(page, 'result-message')).toHaveText('Well solved.');
    expect(
      await page.evaluate(
        () => document.querySelector('svg.cm-chessboard') === (window as unknown as { __tablero: Element | null }).__tablero
      )
    ).toBe(true);
  });

  test('resolverlo sube de nivel y la siguiente carrera lo anuncia', async ({ page }) => {
    await expect(el(page, 'level')).toHaveCount(0);

    await resolverPuzzle(page, await ejercicioEnPantalla(page));

    await expect(el(page, 'level-up')).toHaveText('On to level 2.');
    await expect(el(page, 'runner-canvas')).toBeVisible({ timeout: 10_000 });
    await expect(el(page, 'level')).toHaveText('Level 2');
    // La primera falange trae la explicación del doble salto
    await expect(el(page, 'level-banner')).toContainText(/double jump|Faster than the last one/);
  });

  test('resolverlo suma a la sesión, celebra y no pide ningún botón', async ({ page }) => {
    await resolverPuzzle(page, await ejercicioEnPantalla(page));

    await expect(el(page, 'result-message')).toHaveText('Well solved.');
    await expect(el(page, 'session')).toContainText('Solved: 1');
    await expect(el(page, 'show-solution')).toHaveCount(0);
    await expect(el(page, 'next')).toHaveCount(0);
  });

  test('tras resolverlo arranca sola la carrera del siguiente ejercicio, sin tocar nada', async ({ page }) => {
    const primero = await ejercicioEnPantalla(page);
    await resolverPuzzle(page, primero);

    await expect(el(page, 'runner-canvas')).toBeVisible({ timeout: 10_000 });
    await expect(el(page, 'session')).toContainText('Solved: 1');
    await el(page, 'skip').click();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    expect((await ejercicioEnPantalla(page)).uid).not.toBe(primero.uid);
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

    // Cerrarla no deja el tablero parado: el juego sigue con otra carrera y otro ejercicio
    await expect(el(page, 'runner-canvas')).toBeVisible({ timeout: 10_000 });
    await expect(el(page, 'session')).toContainText('Solved: 0');
  });

  test('fallarlo y pulsar «Another exercise» trae una carrera nueva con otro ejercicio', async ({ page }) => {
    const primero = await ejercicioEnPantalla(page);
    await jugarJugadaErronea(page, primero);

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
      await expect(el(page, 'runner-canvas')).toBeVisible({ timeout: 10_000 });
      await el(page, 'skip').click();
      await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    }
    await resolverPuzzle(page, await ejercicioEnPantalla(page));

    // El tercero era el último: la carrera que seguiría no tiene ejercicio y sale el error
    await expect(el(page, 'error')).toBeVisible({ timeout: 10_000 });
    await expect(el(page, 'session')).toContainText('Solved: 3');
    await expect(el(page, 'error')).toBeVisible();
    await expect(page.getByRole('heading', { name: "We couldn't fetch the exercise" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });
});

test.describe('Chess Runner · salidas', () => {
  test('la equis lleva al inicio', async ({ page }) => {
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
