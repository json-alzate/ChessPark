import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';
import { PUZZLES } from '../support/fixtures';
import { esperarTurnoDelUsuario, jugarJugadaErronea, resolverPuzzle } from '../support/resto-tablero';

// Una carrera dura unos 25 s en tiempo real: margen para máquinas cargadas.
test.describe.configure({ timeout: 90_000 });

/**
 * Chess Runner (/chess-runner): el perrito corre y, con un toque, salta las piezas del ejercicio (las del set
 * que el usuario eligió); al superarlas aparece el tablero con su reloj. Al resolverlo, confeti y la
 * siguiente carrera arranca sola. Es una campaña de patrones con historia, lecciones, corazones y récord.
 * Ver docs/implementado/CHESS_RUNNER_FLOW.md.
 *
 * El CDN de pruebas solo sirve los 3 ejercicios de los fixtures y la sesión no repite ninguno: al
 * tercero el catálogo se agota y sale la pantalla de error.
 */

const el = (page: Page, id: string) => page.locator(`[data-testid=${id}]`);

const TEMAS = [
  'hangingPiece',
  'mateIn1',
  'fork',
  'pin',
  'skewer',
  'backRankMate',
  'discoveredAttack',
  'capturingDefender',
  'deflection',
  'attraction',
  'doubleCheck',
  'trappedPiece',
  'xRayAttack',
  'arabianMate',
  'anastasiaMate',
  'intermezzo',
  'bodenMate',
  'hookMate',
  'smotheredMate',
  'mateIn2',
];
/** Lo ya visto de la historia (prólogo, llegadas a cada mundo y final), para entrar directo a lo que se prueba. */
const HISTORIA_VISTA = ['prologue', 'epilogue', ...TEMAS.map((_, i) => `intro:${i}`)];
/** Y también todas las lecciones. */
const TODO_VISTO = [...HISTORIA_VISTA, ...TEMAS.flatMap((t) => [`lesson:${t}`, `review:${t}`])];

/**
 * Deja guardada una campaña antes de abrir la pantalla (por defecto, con la historia y las lecciones ya vistas, así la
 * carrera empieza al abrir). Se escribe en cada carga de la página: vale para las pruebas que no recargan.
 */
async function sembrarCampana(page: Page, cambios: Record<string, unknown> = {}) {
  const campana = {
    version: 2,
    round: 0,
    chapter: 0,
    rating: 900,
    peakRating: 900,
    cookies: 0,
    skin: 'choco',
    skins: ['choco'],
    solvedInBlock: 0,
    failsInBlock: 0,
    puzzles: 0,
    mastery: {},
    powers: [],
    stars: [],
    review: null,
    seen: TODO_VISTO,
    ...cambios,
  };
  await page.addInitScript((datos) => localStorage.setItem('chessColate_runner_campaign', JSON.stringify(datos)), campana);
}

/** Quien ya jugó entra al panel: «Jugar» empieza la partida. */
async function darleAJugar(page: Page) {
  await el(page, 'play-again').click();
}

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
      const llega = (obstaculo.plan - 52) / estado.speed;
      if (llega > (obstaculo.count > 1 ? 0.2 : 0.28)) {
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
  test.beforeEach(async ({ page }) => {
    await sembrarCampana(page);
  });

  test('se ve como la referencia (con el lienzo y el cartel del patrón, que se animan, tapados)', async ({ page, network }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'pattern')).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(errores, 'errores de JavaScript en la página').toEqual([]);
    expect(network.blocked, 'peticiones externas no simuladas').toEqual([]);
    await expect(page).toHaveScreenshot('chess-runner-carrera.png', {
      mask: [el(page, 'runner-canvas'), el(page, 'level-banner')],
    });
  });

  test('el logo de la barra superior es el caballo del set de piezas que el usuario eligió en Ajustes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chessColate_pieces', 'papercut'));
    await page.goto('/chess-runner');

    const logo = page.locator('.navbar img').first();
    await expect(logo).toBeVisible();
    // Los sets de Lichess llevan gradientes con su propio nombre dentro del SVG
    expect(decodeURIComponent((await logo.getAttribute('src')) ?? '')).toContain('papercut');
  });

  test('arranca con el lienzo a una escala entera, el patrón, los corazones y la ayuda a la vista', async ({ page }) => {
    await page.goto('/chess-runner');

    const lienzo = el(page, 'runner-canvas');
    await expect(lienzo).toBeVisible();
    const caja = (await lienzo.boundingBox())!;
    // 393 px de móvil: 196 px lógicos a 2×
    expect(Math.round(caja.width)).toBe(392);
    expect(Math.round(caja.height)).toBe(352);
    await expect(el(page, 'pattern')).toContainText('Hanging Piece');
    await expect(el(page, 'block-dots').locator('span')).toHaveCount(5);
    await expect(el(page, 'run-bar')).toBeVisible();
    await expect(el(page, 'hearts').locator('[data-full=true]')).toHaveCount(3);
    await expect(page.getByText('Tap to jump. Two taps in a row, double jump.')).toBeVisible();
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
    // Y se ve qué patrón se entrena y cuántos fallos permitidos quedan
    await expect(el(page, 'puzzle-pattern')).toContainText('Hanging Piece');
    await expect(el(page, 'strikes')).toContainText('Misses: 0 of 3');
  });

  test('la carrera dura media minuta, más o menos: lo justo para entrar en materia', async ({ page }) => {
    await page.goto('/chess-runner');
    await carreraLista(page);
    const t0 = Date.now();

    await correrConElTeclado(page);

    const segundos = (Date.now() - t0) / 1000;
    expect(segundos).toBeGreaterThan(18);
    expect(segundos).toBeLessThan(40);
  });

  test('sin tocar nada el perrito choca, pierde los tres corazones y se acaba la partida', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'hearts').locator('[data-full=true]')).toHaveCount(3);

    await expect(el(page, 'game-over')).toBeVisible({ timeout: 60_000 });

    await expect(el(page, 'game-over-reason')).toHaveText('You ran out of hearts.');
    await expect(el(page, 'new-record')).toBeVisible();
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
    // El camino hasta el Rey de las Sombras, con el perrito en el primer guardián
    await expect(el(page, 'map-node')).toHaveCount(20);
    await expect(el(page, 'map-node').first()).toHaveAttribute('data-state', 'current');
    await expect(el(page, 'map-node').last()).toHaveAttribute('data-state', 'locked');
  });

  test('el récord de distancia se guarda en el dispositivo y «Play again» empieza una partida nueva', async ({ page }) => {
    await page.goto('/chess-runner');
    await expect(el(page, 'game-over')).toBeVisible({ timeout: 60_000 });
    const record = await page.evaluate(() => Number(localStorage.getItem('chessColate_runner_best_m')));
    expect(record).toBeGreaterThan(0);

    await el(page, 'play-again').click();

    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'pattern')).toContainText('Hanging Piece');
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
    // El segundo salto llega más alto que el primero (unos 62 px)
    await expect.poll(async () => (await saltos()).y).toBeGreaterThan(70);
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

test.describe('Chess Runner · la historia, la lección y los poderes', () => {
  test('la primera vez cuenta el prólogo sin una palabra y después enseña el patrón con un tablero pequeño', async ({ page }) => {
    await page.goto('/chess-runner');

    // El prólogo: una escena animada, sin texto, que se puede saltar
    await expect(el(page, 'story-canvas')).toBeVisible();
    await expect(el(page, 'story')).not.toContainText(/\w{4,}/);
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
    await el(page, 'story-skip').click();

    // El camino hasta el frasco: los veinte guardianes
    await expect(el(page, 'journey-title')).toBeVisible();
    await expect(el(page, 'map-node')).toHaveCount(20);
    await el(page, 'card-continue').click();

    // La lección del patrón: el tablero pequeño, el nombre del patrón y las frases que lo explican
    await expect(el(page, 'lesson-canvas')).toBeVisible();
    await expect(el(page, 'lesson-pattern')).toHaveText('Hanging Piece');
    await expect(el(page, 'lesson-idea')).toHaveText('An undefended piece can be captured for free');
    await expect(el(page, 'lesson-caption')).not.toBeEmpty();

    // Y empieza la carrera, cuando el usuario quiere
    await el(page, 'lesson-continue').click();
    await expect(el(page, 'runner-canvas')).toBeVisible();
  });

  test('lo visto no se repite: al volver a entrar va directo a la carrera', async ({ page }) => {
    await page.goto('/chess-runner');
    await el(page, 'story-skip').click();
    await el(page, 'card-continue').click();
    await el(page, 'lesson-continue').click();
    await expect(el(page, 'runner-canvas')).toBeVisible();

    await page.reload();

    await expect(el(page, 'runner-canvas')).toBeVisible();
    await expect(el(page, 'story-canvas')).toHaveCount(0);
  });

  test('con un poder ganado, el perrito lo lleva: las reglas de la carrera cambian', async ({ page }) => {
    await sembrarCampana(page, { chapter: 6, puzzles: 30, powers: ['nose', 'spring', 'shield'], stars: [3, 3, 3, 3, 3, 3] });
    await page.goto('/chess-runner');
    await darleAJugar(page);
    await carreraLista(page);

    const reglas = await page.evaluate(() => {
      // @ts-expect-error `ng` solo existe en la build de desarrollo
      const s = window.ng.getComponent(document.querySelector('app-runner-canvas')).state;
      return { escudos: s.shields as number, muelle: s.mods.doubleJumpVelocity as number, alcance: s.mods.pickupReachX as number };
    });
    expect(reglas.escudos).toBe(1);
    expect(reglas.muelle).toBeGreaterThan(270);
    expect(reglas.alcance).toBeGreaterThan(4);
  });

  test('el escudo aguanta el primer choque: sin tocar nada no se pierde ningún corazón por el primero', async ({ page }) => {
    await sembrarCampana(page, { chapter: 6, puzzles: 30, powers: ['nose', 'spring', 'shield'], stars: [3, 3, 3, 3, 3, 3] });
    await page.goto('/chess-runner');
    await darleAJugar(page);
    await carreraLista(page);

    await expect
      .poll(() =>
        page.evaluate(() => {
          // @ts-expect-error `ng` solo existe en la build de desarrollo
          const s = window.ng.getComponent(document.querySelector('app-runner-canvas')).state;
          return { escudos: s.shields as number, choques: s.stumbles as number };
        })
      )
      .toEqual({ escudos: 0, choques: 0 });
    await expect(el(page, 'hearts').locator('[data-full=true]')).toHaveCount(3);
  });

  test('cerrar un capítulo con poder trae la escena de victoria, la tarjeta del poder y el poder se queda en la campaña', async ({ page }) => {
    await sembrarCampana(page, { chapter: 1, solvedInBlock: 4, puzzles: 9, stars: [3] });
    await page.goto('/chess-runner');
    await darleAJugar(page);
    await el(page, 'skip').click();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();

    await resolverPuzzle(page, await ejercicioEnPantalla(page));

    await expect(el(page, 'chapter-done')).toBeVisible();
    // El ELO del perrito sube con el ejercicio
    await expect(el(page, 'rating-change')).toBeVisible();
    await expect(el(page, 'story-canvas')).toBeVisible({ timeout: 10_000 });
    await el(page, 'story-skip').click();
    // El poder nuevo se explica: nombre y qué hace
    await expect(el(page, 'power-name')).toHaveText('Nose');
    await expect(el(page, 'power-desc')).toContainText('cookies');
    await el(page, 'card-continue').click();
    // Sigue el mundo siguiente: un repaso del patrón anterior, o su lección o la carrera
    await expect(el(page, 'lesson-canvas').or(el(page, 'runner-canvas')).or(el(page, 'story-canvas'))).toBeVisible();
    const campana = await page.evaluate(() => JSON.parse(localStorage.getItem('chessColate_runner_campaign') ?? '{}'));
    expect(campana.chapter).toBe(2);
    expect(campana.powers).toEqual(['nose']);
    expect(campana.stars).toEqual([3, 3]);
    expect(campana.rating).toBeGreaterThan(900);
  });

  test('al perder se ve el armario: las galletas guardadas compran un pelaje nuevo para el perrito', async ({ page }) => {
    await sembrarCampana(page, { cookies: 500 });
    await page.goto('/chess-runner');
    await expect(el(page, 'game-over')).toBeVisible({ timeout: 60_000 });

    await expect(el(page, 'wardrobe')).toBeVisible();
    await expect(el(page, 'skin')).toHaveCount(6);
    await el(page, 'skin').nth(1).scrollIntoViewIfNeeded();
    await el(page, 'skin').nth(1).click();

    await expect(el(page, 'skin').nth(1)).toHaveAttribute('data-state', 'worn');
    const campana = await page.evaluate(() => JSON.parse(localStorage.getItem('chessColate_runner_campaign') ?? '{}'));
    expect(campana.skin).toBe('golden');
    expect(campana.skins).toEqual(['choco', 'golden']);
  });
});

test.describe('Chess Runner · el ejercicio', () => {
  test.beforeEach(async ({ page }) => {
    await sembrarCampana(page);
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

  test('resolverlo avanza el bloque del patrón: los ejercicios de un capítulo son del mismo tema', async ({ page }) => {
    await resolverPuzzle(page, await ejercicioEnPantalla(page));

    await expect(el(page, 'runner-canvas')).toBeVisible({ timeout: 10_000 });
    // El mismo patrón, un ejercicio más hecho
    await expect(el(page, 'pattern')).toContainText('Hanging Piece');
    const hechos = await page.evaluate(() => JSON.parse(localStorage.getItem('chessColate_runner_campaign') ?? '{}').solvedInBlock);
    expect(hechos).toBe(1);
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

  test('tras fallar se puede volver a ver el patrón con el tablero pequeño', async ({ page }) => {
    await jugarJugadaErronea(page, await ejercicioEnPantalla(page));

    await el(page, 'show-lesson').click();

    const ventana = el(page, 'lesson-modal');
    await expect(ventana).toBeVisible();
    await expect(ventana.locator('canvas')).toBeVisible();
    await el(page, 'lesson-modal-close').click();
    await expect(ventana).toHaveCount(0);
    // Seguimos en el resultado: ver el patrón no continúa el juego
    await expect(el(page, 'result')).toBeVisible();
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
    await sembrarCampana(page);
    await page.goto('/chess-runner');
    await expect(el(page, 'runner-canvas')).toBeVisible();

    // A mitad de partida la equis lleva al panel; desde el panel, al inicio
    await el(page, 'exit').click();
    await expect(el(page, 'game-over')).toBeVisible();
    await expect(el(page, 'game-over-reason')).toHaveText('You left the game: your distance is saved.');
    await el(page, 'exit').click();

    await expect(page).toHaveURL(/\/home$/);
  });

  test('al volver a entrar se ve el panel, no la partida que se dejó', async ({ page }) => {
    await sembrarCampana(page, { chapter: 3, puzzles: 20, powers: ['nose', 'spring'], stars: [3, 3, 3] });
    await page.goto('/chess-runner');

    await expect(el(page, 'game-over-title')).toHaveText('Chess Runner');
    await expect(el(page, 'runner-canvas')).toHaveCount(0);
    await expect(el(page, 'power-item')).toHaveCount(2);
    // Las piezas del set se ven ya en el panel: el logo de la barra y los guardianes del camino
    await expect(page.locator('.navbar img').first()).toBeVisible();
    await expect(page.locator('[data-testid=map-node] img:not([data-testid=map-power])')).toHaveCount(20);
    await el(page, 'play-again').click();
    await expect(el(page, 'runner-canvas')).toBeVisible();
  });

  test('aparece en el menú lateral, en Práctica', async ({ page }) => {
    await page.goto('/home');
    await page.locator('app-navbar [role=button]').first().click();

    await expect(page.getByText('Chess Runner').first()).toBeVisible();
  });
});
