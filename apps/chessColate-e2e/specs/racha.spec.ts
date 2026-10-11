import { expect, test } from '../support/resto-test';
import {
  eloDelEjercicio,
  espiarCdn,
  esperarTurnoDelUsuario,
  inicioDeRango,
  jugarJugadaErronea,
  puzzlePorElo,
  resolverPuzzle,
  sePidioRango,
} from '../support/resto-tablero';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Modo Racha (/streak) en modo invitado. Reglas (docs/implementado/RACHA_STREAK_FLOW.md):
 * un acierto suma 1 y sube el elo objetivo (elo real del puzzle + 15); el primer error
 * termina la racha; hay un salto por racha; el récord vive en localStorage.
 *
 * El CDN de pruebas sirve siempre los mismos 3 puzzles, así que una racha tiene como
 * máximo 3 ejercicios (no se repiten): al agotarlos sale la pantalla de error.
 */

const marcador = (page: import('@playwright/test').Page) =>
  page.locator('app-streak .navbar span.text-2xl');
const resultado = (page: import('@playwright/test').Page) => page.locator('app-streak .modal-box');

type Registro = { bestScore: number; runsPlayed: number; lastScore: number };
const leerRecord = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('chessColate_streak_record') ?? 'null') as Registro | null);
const leerRachas = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('chessColate_streak_runs') ?? '[]') as {
        score: number;
        endedBy: string;
        skipsUsed: number;
        maxEloReached: number;
      }[]
  );

/** Abre la racha y devuelve el puzzle de los fixtures que salió. */
async function abrirRacha(page: import('@playwright/test').Page) {
  await page.goto('/streak');
  await expect(page.getByText('Exercise rating')).toBeVisible();
  const elo = await eloDelEjercicio(page);
  const puzzle = puzzlePorElo(elo);
  await esperarTurnoDelUsuario(page, puzzle);
  return puzzle;
}

test.describe('Racha', () => {
  test('al abrir empieza en 0, sin récord, con el salto disponible y pide el elo base de 800', async ({ page }) => {
    const urls = await espiarCdn(page);
    await abrirRacha(page);

    await expect(marcador(page)).toHaveText('0');
    await expect(page.getByText('Best', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Skip exercise/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Skip exercise/ })).toContainText('1');
    expect(sePidioRango(urls, 800), `archivos pedidos: ${urls.join(', ')}`).toBe(true);
    // Sin jugar nada no hay récord guardado
    expect(await leerRecord(page)).toBeNull();
  });

  test('resolver un puzzle suma 1 y la rampa pide el elo real del puzzle + 15', async ({ page }) => {
    const urls = await espiarCdn(page);
    const primero = await abrirRacha(page);

    await resolverPuzzle(page, primero);

    await expect(marcador(page)).toHaveText('1');
    // Entra otro puzzle distinto (los fixtures tienen elos distintos)
    await expect.poll(() => eloDelEjercicio(page)).not.toBe(primero.rating);
    const segundo = puzzlePorElo(await eloDelEjercicio(page));
    await esperarTurnoDelUsuario(page, segundo);

    // La rampa: el objetivo del segundo puzzle sale del elo REAL del primero + 15
    const objetivo = Math.max(800, primero.rating + 15);
    expect(sePidioRango(urls, inicioDeRango(objetivo)), `objetivo ${objetivo}, pedidos: ${urls.join(', ')}`).toBe(true);

    await resolverPuzzle(page, segundo);
    await expect(marcador(page)).toHaveText('2');
    // Y el siguiente objetivo nunca baja del anterior
    const objetivo2 = Math.max(objetivo, segundo.rating + 15);
    await expect
      .poll(() => sePidioRango(urls, inicioDeRango(objetivo2)), { message: `objetivo ${objetivo2}` })
      .toBe(true);
    // El récord aún no se guarda: la racha sigue en curso
    expect(await leerRecord(page)).toBeNull();
  });

  test('un error termina la racha y muestra el resultado con la solución', async ({ page }) => {
    const puzzle = await abrirRacha(page);

    await jugarJugadaErronea(page, puzzle);

    await expect(resultado(page).getByRole('heading', { name: 'Streak over' })).toBeVisible();
    await expect(resultado(page)).toContainText('exercises in a row');
    // 0 resueltos; la dificultad máxima es la del puzzle en que falló
    await expect(resultado(page).locator('.text-6xl')).toHaveText('0');
    await expect(resultado(page)).toContainText('Top difficulty');
    await expect(resultado(page)).toContainText(String(puzzle.rating));
    await expect(resultado(page).getByRole('button', { name: 'See the solution' })).toBeVisible();
    await expect(resultado(page).getByRole('button', { name: 'New streak' })).toBeVisible();
    await expect(resultado(page).getByRole('button', { name: 'Back to home' })).toBeVisible();

    // La solución del puzzle que rompió la racha se abre en un modal
    await resultado(page).getByRole('button', { name: 'See the solution' }).click();
    const solucion = page.locator('ion-modal.puzzle-solution-modal');
    await expect(solucion).toBeVisible();
    await expect(solucion.locator('svg.cm-chessboard')).toBeVisible();
    await expect(solucion.getByRole('button', { name: 'Play and close' })).toBeVisible();

    // Fallar el primer puzzle sí cuenta como racha jugada (con 0)
    const record = await leerRecord(page);
    expect(record).toMatchObject({ bestScore: 0, runsPlayed: 1, lastScore: 0 });
    const rachas = await leerRachas(page);
    expect(rachas).toHaveLength(1);
    expect(rachas[0]).toMatchObject({ score: 0, endedBy: 'fail', skipsUsed: 0, maxEloReached: puzzle.rating });
  });

  test('acertar uno y fallar el siguiente da récord nuevo y se guarda en localStorage', async ({ page }) => {
    const primero = await abrirRacha(page);
    await resolverPuzzle(page, primero);
    await expect(marcador(page)).toHaveText('1');
    await expect.poll(() => eloDelEjercicio(page)).not.toBe(primero.rating);
    const segundo = puzzlePorElo(await eloDelEjercicio(page));

    await jugarJugadaErronea(page, segundo);

    await expect(resultado(page).getByRole('heading', { name: 'New best!' })).toBeVisible();
    await expect(resultado(page).locator('.text-6xl')).toHaveText('1');
    // Top difficulty: el puzzle más difícil que se llegó a jugar, también el que rompió la racha
    await expect(resultado(page)).toContainText(String(Math.max(primero.rating, segundo.rating)));

    expect(await leerRecord(page)).toMatchObject({ bestScore: 1, runsPlayed: 1, lastScore: 1 });
    const rachas = await leerRachas(page);
    expect(rachas).toHaveLength(1);
    expect(rachas[0]).toMatchObject({ score: 1, endedBy: 'fail' });

    // Tras recargar, el récord sigue ahí y se enseña en la barra superior
    await page.reload();
    await expect(page.getByText('Exercise rating')).toBeVisible();
    await expect(page.locator('app-streak .navbar')).toContainText('Best');
    await expect(page.locator('app-streak .navbar')).toContainText('1');
    await expect(page.getByText('To beat your best')).toBeVisible();
  });

  test('una racha peor que el récord no lo pisa y "New streak" empieza de cero', async ({ page }) => {
    // Récord previo de 5 en el dispositivo
    await page.addInitScript(() => {
      localStorage.setItem(
        'chessColate_streak_record',
        JSON.stringify({ bestScore: 5, bestRunUid: 'previa', achievedAt: 1, runsPlayed: 3, lastScore: 2, lastPlayedAt: 1 })
      );
    });
    const puzzle = await abrirRacha(page);
    await expect(page.locator('app-streak .navbar')).toContainText('Best');
    await expect(page.getByText('To beat your best')).toBeVisible();

    await jugarJugadaErronea(page, puzzle);

    await expect(resultado(page).getByRole('heading', { name: 'Streak over' })).toBeVisible();
    expect(await leerRecord(page)).toMatchObject({ bestScore: 5, runsPlayed: 4, lastScore: 0 });

    await resultado(page).getByRole('button', { name: 'New streak' }).click();
    await expect(resultado(page)).toHaveCount(0);
    await expect(marcador(page)).toHaveText('0');
    await expect(page.getByText('Exercise rating')).toBeVisible();
  });

  test('el salto es único: cambia de puzzle sin sumar ni fallar y queda anotado', async ({ page }) => {
    const primero = await abrirRacha(page);
    const salto = page.getByRole('button', { name: /Skip exercise/ });

    await salto.click();

    await expect(salto).toBeDisabled();
    await expect(salto).toContainText('0');
    await expect.poll(() => eloDelEjercicio(page)).not.toBe(primero.rating);
    await expect(marcador(page)).toHaveText('0');
    await expect(resultado(page)).toHaveCount(0);

    // No se puede usar dos veces (el botón sigue desactivado aunque se fuerce el clic)
    await salto.click({ force: true });
    await expect(marcador(page)).toHaveText('0');
    await expect(page.getByText('Exercise rating')).toBeVisible();
    await expect(resultado(page)).toHaveCount(0);

    // La racha sigue viva: se puede fallar y el salto queda registrado
    const segundo = puzzlePorElo(await eloDelEjercicio(page));
    await jugarJugadaErronea(page, segundo);
    await expect(resultado(page).getByRole('heading', { name: 'Streak over' })).toBeVisible();
    const rachas = await leerRachas(page);
    expect(rachas[0]).toMatchObject({ score: 0, skipsUsed: 1, endedBy: 'fail' });
  });

  test('salir con la racha viva pide confirmación; "Keep playing" sigue y "Leave" guarda lo logrado', async ({ page }) => {
    const primero = await abrirRacha(page);
    await resolverPuzzle(page, primero);
    await expect(marcador(page)).toHaveText('1');

    await page.locator('app-streak .navbar button.btn-error').click();
    await expect(page.getByText('Leave the streak?')).toBeVisible();
    await expect(page.getByText('You\'re on 1 exercises in a row.')).toBeVisible();

    await page.getByRole('button', { name: 'Keep playing' }).click();
    await expect(page.getByText('Leave the streak?')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/streak');
    expect(await leerRecord(page)).toBeNull();

    await page.locator('app-streak .navbar button.btn-error').click();
    await page.getByRole('button', { name: 'Leave' }).click();

    await expect(page).toHaveURL(/\/home$/);
    // Abandonar no rompe lo logrado: queda como récord, terminada por abandono
    await expect.poll(() => leerRecord(page)).toMatchObject({ bestScore: 1, runsPlayed: 1 });
    const rachas = await leerRachas(page);
    expect(rachas[0]).toMatchObject({ score: 1, endedBy: 'quit' });
  });

  test('salir sin haber resuelto nada no ensucia el historial', async ({ page }) => {
    await abrirRacha(page);

    await page.locator('app-streak .navbar button.btn-error').click();
    await page.getByRole('button', { name: 'Leave' }).click();

    await expect(page).toHaveURL(/\/home$/);
    expect(await leerRecord(page)).toBeNull();
    expect(await leerRachas(page)).toEqual([]);
  });

  test('si el catálogo se queda sin puzzles nuevos muestra el error y "New streak" reinicia', async ({ page }) => {
    // Los fixtures solo traen 3 puzzles y no se repiten dentro de una racha
    const primero = await abrirRacha(page);
    await resolverPuzzle(page, primero);
    await expect.poll(() => eloDelEjercicio(page)).not.toBe(primero.rating);
    const segundo = puzzlePorElo(await eloDelEjercicio(page));
    await resolverPuzzle(page, segundo);
    await expect(marcador(page)).toHaveText('2');
    await expect.poll(async () => [primero.rating, segundo.rating].includes(await eloDelEjercicio(page))).toBe(false);
    const tercero = puzzlePorElo(await eloDelEjercicio(page));
    await resolverPuzzle(page, tercero);
    await expect(marcador(page)).toHaveText('3');

    await expect(page.getByRole('heading', { name: "We couldn't load the exercise" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();

    await page.getByRole('button', { name: 'New streak' }).click();
    await expect(page.getByRole('heading', { name: "We couldn't load the exercise" })).toHaveCount(0);
    await expect(marcador(page)).toHaveText('0');
    await expect(page.getByText('Exercise rating')).toBeVisible();
  });
});
