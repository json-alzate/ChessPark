import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';
import { PUZZLES } from '../support/fixtures';
import { jugarJugadaErronea, resolverPuzzle } from '../support/resto-tablero';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 90_000 });

/**
 * Método del Pájaro Carpintero (/woodpecker) en modo invitado. Reglas
 * (docs/implementado/PAJARO_CARPINTERO_FLOW.md): un set fijo de ejercicios se repite en varias
 * vueltas, cada una con menos tiempo; el progreso se guarda tras cada ejercicio y se puede
 * retomar; solo hay un set a la vez y vive en el dispositivo (localStorage).
 *
 * El CDN de pruebas solo sirve 3 ejercicios, así que el set se siembra en localStorage (con
 * orden fijo) en vez de armarlo por la pantalla. Armarlo contra el catálogo real se verifica
 * con /chesscolate:probar.
 */

const SET_KEY = 'chessColate_woodpecker_set';
const PROGRESS_KEY = 'chessColate_woodpecker_progress';

interface Progreso {
  setId: string;
  completedAt?: number;
  cycles: {
    cycle: number;
    order: string[];
    finishedAt?: number;
    results: { uidPuzzle: string; resolved: boolean; failByTime: boolean; timeMs: number }[];
  }[];
}

/** Siembra un set con los 3 ejercicios de los fixtures, 2 vueltas y orden fijo. */
async function sembrarSet(page: Page, config: { timing?: 'none' | 'decreasing' } = {}) {
  await page.addInitScript(
    ([clave, puzzles, timing]) => {
      // Solo la primera carga: recargar la página no debe pisar el progreso guardado
      if (localStorage.getItem(clave as string)) {
        return;
      }
      localStorage.setItem(
        clave as string,
        JSON.stringify({
          id: 'set-e2e',
          source: 'catalog',
          createdAt: 1,
          config: {
            targetCount: 3,
            minCount: 2,
            eloMin: 1000,
            eloMax: 2000,
            themes: ['fork', 'pin'],
            cycles: 2,
            order: 'same',
            timing,
            baseTimePerPuzzleSec: 60,
            decreasePercent: 20,
          },
          puzzles: (puzzles as object[]).map((p) => ({ ...p, randomNumberQuery: 0.5 })),
        })
      );
    },
    [SET_KEY, PUZZLES, config.timing ?? 'decreasing'] as const
  );
}

const leerProgreso = (page: Page) =>
  page.evaluate(
    (clave) => JSON.parse(localStorage.getItem(clave) ?? 'null') as Progreso | null,
    PROGRESS_KEY
  );

const el = (page: Page, id: string) => page.locator(`[data-testid=${id}]`);

/** La tarjeta del inicio: existe dos veces (móvil y escritorio) y solo una es visible. */
const tarjetaDelInicio = (page: Page) => page.getByTestId('woodpecker-card').filter({ visible: true });

/** Del panel a la pantalla de la vuelta ya jugando (pasa por el aviso). */
async function empezar(page: Page) {
  await el(page, 'play').click();
  await el(page, 'start').click();
}

test.describe('Pájaro carpintero: sin set', () => {
  test('ofrece configurar el set con los valores por defecto y explica el método', async ({ page }) => {
    await page.goto('/woodpecker');

    await expect(page.getByRole('heading', { name: 'Woodpecker method' })).toBeVisible();
    await expect(page.getByText('How does it work?')).toBeVisible();
    await expect(el(page, 'size').getByRole('button', { name: '100' })).toHaveAttribute('aria-pressed', 'true');
    await expect(el(page, 'cycles-value')).toHaveText('5');
    await expect(el(page, 'create')).toBeEnabled();
    expect(await page.evaluate((k) => localStorage.getItem(k), SET_KEY)).toBeNull();
  });

  test('con un catálogo que no da para el mínimo explica por qué y no guarda nada', async ({ page }) => {
    await page.goto('/woodpecker');

    await el(page, 'create').click();

    // El catálogo de pruebas solo tiene 3 ejercicios y el set de 100 necesita al menos 70
    await expect(el(page, 'error')).toContainText('we only found 3 exercises');
    await expect(el(page, 'error')).toContainText('at least 70');
    await expect(el(page, 'create')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), SET_KEY)).toBeNull();
  });

  test('al elegir temas a mano exige marcar al menos uno', async ({ page }) => {
    await page.goto('/woodpecker');

    await el(page, 'themes').locator('summary').click();
    await page.getByText('Choose themes').click();

    await expect(el(page, 'create')).toBeDisabled();
    await expect(page.getByText('Choose at least one theme.')).toBeVisible();
  });

  test('los tamaños, las vueltas y el rango de ELO se pueden ajustar', async ({ page }) => {
    await page.goto('/woodpecker');

    await el(page, 'size').getByRole('button', { name: '200' }).click();
    await expect(el(page, 'size').getByRole('button', { name: '200' })).toHaveAttribute('aria-pressed', 'true');
    await expect(el(page, 'size')).toContainText('about 85 min');

    await page.getByRole('button', { name: 'One round more' }).click();
    await expect(el(page, 'cycles-value')).toHaveText('6');

    await el(page, 'elo').locator('input[type=range]').first().fill('1900');
    // Subir el mínimo por encima del máximo empuja el máximo para dejar 200 puntos
    await expect(el(page, 'elo')).toContainText('1900 – 2100');
  });
});

test.describe('Pájaro carpintero: con set', () => {
  test.beforeEach(async ({ page }) => {
    await sembrarSet(page);
  });

  test('el panel enseña el set, la vuelta que toca y su reloj', async ({ page }) => {
    await page.goto('/woodpecker');

    await expect(el(page, 'set-card')).toContainText('3 exercises');
    await expect(el(page, 'set-card')).toContainText('1000 – 2000');
    await expect(el(page, 'cycle-badge')).toHaveText('Round 1 of 2');
    await expect(el(page, 'set-card')).toContainText('60 s per exercise');
    await expect(el(page, 'play')).toContainText('Start round 1');
    await expect(el(page, 'evolution-empty')).toBeVisible();
  });

  test('jugar las dos vueltas: se compara con la anterior y el set termina', async ({ page }) => {
    await page.goto('/woodpecker');
    await el(page, 'play').click();

    // Aviso de la vuelta 1: con su reloj y sin tablero hasta pulsar «Start»
    await expect(el(page, 'ready')).toContainText('Round 1 of 2');
    await expect(el(page, 'ready')).toContainText('60 s per exercise');
    await expect(page.locator('svg.cm-chessboard')).toHaveCount(0);
    await el(page, 'start').click();

    for (const puzzle of PUZZLES) {
      await resolverPuzzle(page, puzzle);
    }

    // Vuelta 1 terminada: es la base, no se compara con nada
    await expect(el(page, 'cycle-done')).toContainText('Round 1 finished');
    await expect(el(page, 'result-accuracy')).toContainText('100 %');
    await expect(el(page, 'done-note')).toContainText('This is your baseline');
    expect(await leerProgreso(page)).toMatchObject({ cycles: [{ cycle: 1 }] });

    // Vuelta 2: otro aviso, con menos tiempo
    await el(page, 'next-cycle').click();
    await expect(el(page, 'ready')).toContainText('Round 2 of 2');
    await expect(el(page, 'ready')).toContainText('48 s per exercise');
    await el(page, 'start').click();
    for (const puzzle of PUZZLES) {
      await resolverPuzzle(page, puzzle);
    }

    // Set terminado: celebra y no ofrece otra vuelta
    await expect(el(page, 'cycle-done')).toContainText('Set completed');
    await expect(el(page, 'next-cycle')).toHaveCount(0);
    const progreso = await leerProgreso(page);
    expect(progreso?.completedAt).toBeDefined();
    expect(progreso?.cycles.map((c) => c.results.length)).toEqual([3, 3]);

    // El panel final tiene la evolución de las dos vueltas y deja armar otro set
    await el(page, 'back-to-set').click();
    await expect(el(page, 'completed-card')).toContainText('Set completed');
    await expect(el(page, 'evolution').locator('[data-testid=cycle-row]')).toHaveCount(2);
    await expect(el(page, 'new-set')).toBeVisible();
    await expect(el(page, 'play')).toHaveCount(0);
  });

  test('un fallo se anota, deja ver la solución y se sigue sin perder la vuelta', async ({ page }) => {
    await page.goto('/woodpecker');
    await empezar(page);

    await jugarJugadaErronea(page, PUZZLES[0]);

    await expect(el(page, 'feedback-message')).toHaveText("That's not the best move.");
    expect(await leerProgreso(page)).toMatchObject({
      cycles: [{ results: [{ uidPuzzle: PUZZLES[0].uid, resolved: false, failByTime: false }] }],
    });

    await el(page, 'show-solution').click();
    const solucion = page.locator('ion-modal.puzzle-solution-modal');
    await expect(solucion).toBeVisible();
    await expect(solucion.locator('svg.cm-chessboard')).toBeVisible();
    await solucion.getByRole('button', { name: 'Play and close' }).click();
    await expect(solucion).toHaveCount(0);

    // «Next» sigue con el ejercicio siguiente del set
    await el(page, 'next').click();
    await expect(el(page, 'feedback')).toHaveCount(0);
    await expect(el(page, 'counter')).toContainText('1 of 3');
    await resolverPuzzle(page, PUZZLES[1]);
    await expect(el(page, 'solved')).toHaveText('1');
  });

  test('con el reloj en marcha el tablero enseña la barra de tiempo', async ({ page }) => {
    await page.goto('/woodpecker');
    await empezar(page);
    await expect(page.locator('lib-board-puzzle progress')).toBeVisible();
  });

  test('salir a mitad de la vuelta guarda el avance y el panel lo retoma tras recargar', async ({ page }) => {
    await page.goto('/woodpecker');
    await empezar(page);
    await resolverPuzzle(page, PUZZLES[0]);
    await expect(el(page, 'counter')).toContainText('1 of 3');

    await el(page, 'exit').click();

    await expect(el(page, 'set-card')).toContainText('1 of 3 exercises');
    await expect(el(page, 'play')).toContainText('Continue round 1');

    await page.reload();
    await expect(el(page, 'set-card')).toContainText('1 of 3 exercises');

    // Retoma por el segundo ejercicio, sin repetir el primero
    await el(page, 'play').click();
    await expect(el(page, 'resume-note')).toContainText('exercise 2');
    await el(page, 'start').click();
    await resolverPuzzle(page, PUZZLES[1]);
    const progreso = await leerProgreso(page);
    expect(progreso?.cycles[0].results.map((r) => r.uidPuzzle)).toEqual([PUZZLES[0].uid, PUZZLES[1].uid]);
  });

  test('abandonar pide confirmación, borra el set y vuelve a la configuración', async ({ page }) => {
    await page.goto('/woodpecker');

    await el(page, 'discard').click();
    await expect(page.getByText('Abandon the set?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep the set' }).click();
    await expect(el(page, 'set-card')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), SET_KEY)).not.toBeNull();

    await el(page, 'discard').click();
    await page.getByRole('button', { name: 'Abandon', exact: true }).click();

    await expect(el(page, 'create')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), SET_KEY)).toBeNull();
    expect(await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY)).toBeNull();
  });

  test('la tarjeta del inicio sigue el estado del set', async ({ page }) => {
    await page.goto('/home');

    const tarjeta = tarjetaDelInicio(page);
    await expect(tarjeta).toContainText('Woodpecker method');
    await expect(tarjeta).toContainText('Round 1 of 2');
    await expect(tarjeta.getByRole('button', { name: 'Continue' })).toBeVisible();

    await tarjeta.click();
    await expect(page).toHaveURL(/\/woodpecker$/);
  });

  test('sin set la tarjeta del inicio invita a armar uno', async ({ page }) => {
    await page.addInitScript((k) => localStorage.removeItem(k), SET_KEY);
    await page.goto('/home');

    const tarjeta = tarjetaDelInicio(page);
    await expect(tarjeta.getByRole('button', { name: 'Build my set' })).toBeVisible();
  });

  test('la pantalla de juego sin set (o con el set terminado) vuelve al panel', async ({ page }) => {
    await page.addInitScript((k) => localStorage.removeItem(k), SET_KEY);
    await page.goto('/woodpecker/play');

    await expect(page).toHaveURL(/\/woodpecker$/);
    await expect(el(page, 'create')).toBeVisible();
  });
});

test.describe('Pájaro carpintero: sin reloj', () => {
  test('el ritmo relajado no pone tiempos y el aviso lo dice', async ({ page }) => {
    await sembrarSet(page, { timing: 'none' });
    await page.goto('/woodpecker');

    await expect(el(page, 'set-card')).toContainText('No clock');
    await el(page, 'play').click();
    await expect(el(page, 'ready')).toContainText('No clock');
    await el(page, 'start').click();
    await expect(page.locator('lib-board-puzzle progress')).toHaveCount(0);
  });
});

/**
 * Set armado con un PGN propio (docs/implementado/RUTINA_PGN_FLOW.md). Se lee el archivo en el
 * navegador: no hace falta catálogo, así que aquí sí se arma el set por la pantalla.
 */
test.describe('Pájaro carpintero: con un PGN propio', () => {
  const ejercicio = (n: number) =>
    `[Event "Pasillo ${n}"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 ${n}"]\n[PuzzleThemes "mateIn1"]\n\n1... a6 2. Re8# *`;
  const PGN = [
    ...[1, 2, 3, 4, 5].map(ejercicio),
    '[Event "Roto"]\n[FEN "esto no es un fen"]\n\n1... a6 2. Re8# *',
    '[Event "Ilegal"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 2. Qh5 *',
  ].join('\n\n');

  async function elegirArchivo(page: Page, contenido: string, nombre = 'mis-ejercicios.pgn') {
    await page.goto('/woodpecker');
    await el(page, 'source-pgn').click();
    await el(page, 'file-input').setInputFiles({ name: nombre, mimeType: 'text/plain', buffer: Buffer.from(contenido) });
  }

  test('la pestaña «My PGN» cambia los filtros del catálogo por el importador y su ayuda', async ({ page }) => {
    await page.goto('/woodpecker');
    await el(page, 'source-pgn').click();

    await expect(el(page, 'pgn-importer')).toBeVisible();
    await expect(el(page, 'size')).toHaveCount(0);
    await expect(el(page, 'create')).toBeDisabled();
    await el(page, 'format-help').locator('summary').click();
    await expect(el(page, 'example')).toContainText('[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]');
  });

  test('lee el archivo, cuenta lo que entra y dice qué ejercicio falló y por qué', async ({ page }) => {
    await elegirArchivo(page, PGN);

    await expect(el(page, 'summary-count')).toContainText('5 of 7 exercises ready');
    await expect(el(page, 'issues')).toContainText('Roto');
    await expect(el(page, 'issues')).toContainText('Ilegal');
    await expect(el(page, 'issues')).toContainText('not legal');
    await expect(el(page, 'create')).toBeEnabled();
  });

  test('con menos de 5 ejercicios válidos no deja armar el set', async ({ page }) => {
    await elegirArchivo(page, [1, 2, 3].map(ejercicio).join('\n\n'));

    await expect(el(page, 'too-few')).toBeVisible();
    await expect(el(page, 'create')).toBeDisabled();
  });

  test('un archivo que no es un PGN explica que no hay ejercicios', async ({ page }) => {
    await elegirArchivo(page, 'esto no es un PGN', 'notas.txt');

    await expect(el(page, 'failure')).toBeVisible();
    await expect(el(page, 'create')).toBeDisabled();
  });

  test('arma el set con el archivo, lo guarda con su origen y el panel lo dice', async ({ page }) => {
    await elegirArchivo(page, PGN);
    await el(page, 'create').click();

    await expect(el(page, 'source-pgn')).toContainText('mis-ejercicios.pgn');
    const set = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SET_KEY);
    expect(set).toMatchObject({ source: 'pgn', sourceName: 'mis-ejercicios.pgn' });
    expect(set.puzzles).toHaveLength(5);
    expect(set.puzzles[0].moves).toBe('a7a6 e1e8');
  });

  test('«Quitar» vuelve a dejar el importador sin nada cargado', async ({ page }) => {
    await elegirArchivo(page, PGN);
    await el(page, 'clear').click();

    await expect(el(page, 'summary')).toHaveCount(0);
    await expect(el(page, 'create')).toBeDisabled();
  });
});
