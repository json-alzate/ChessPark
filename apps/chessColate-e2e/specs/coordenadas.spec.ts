import type { Page } from '@playwright/test';

import { acelerarPartida, prepararReloj } from '../support/resto-reloj';
import { clicEnCasilla } from '../support/resto-tablero';
import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Coordenadas (/coordinates): una partida de 60 s en la que hay que tocar la casilla
 * que indica el título. Para no esperar un minuto de verdad se acelera el reloj de la
 * partida (ver support/resto-reloj.ts), solo después de jugar.
 */

const CLAVE_PARTIDAS = 'chessColate_coordinates_games';
const CLAVE_AJUSTES = 'chessColate_coordinates_gameSettings';

type Partida = { score: number; squaresGood: string[]; squaresBad: string[]; color: 'w' | 'b'; round: string[] };
const leerPartidas = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]') as Partida[], CLAVE_PARTIDAS);

const objetivo = (page: Page) => page.locator('h1.current-puzzle');
const resultados = (page: Page) => page.locator('ion-modal.results-modal');

/** Abre la pantalla y fija el lado de blancas para que el resultado no dependa del azar. */
async function abrir(page: Page, lado: 'White' | 'Black' = 'White') {
  await prepararReloj(page);
  await page.goto('/coordinates');
  await page.getByRole('button', { name: `${lado} King` }).click();
}

/** Toca la casilla que pide el título y espera a que cambie el objetivo. */
async function acertar(page: Page) {
  const casilla = (await objetivo(page).innerText()).trim();
  await clicEnCasilla(page, 'lib-board', casilla);
  await expect(objetivo(page)).not.toHaveText(casilla);
  return casilla;
}

/** Toca una casilla que NO es la pedida. */
async function fallar(page: Page) {
  const pedida = (await objetivo(page).innerText()).trim();
  const otra = pedida === 'a1' ? 'h8' : 'a1';
  await clicEnCasilla(page, 'lib-board', otra);
  return pedida;
}

const estadistica = (page: Page, titulo: string) =>
  page.locator('app-game-stats .stat', { hasText: titulo }).locator('.stat-value');

test.describe('Coordenadas', () => {
  test('sin partidas previas el marcador está vacío y se puede empezar', async ({ page }) => {
    await abrir(page);

    await expect(page.getByRole('heading', { name: 'Chess Coordinates' })).toBeVisible();
    await expect(page.getByText('No scores yet.')).toBeVisible();
    await expect(page.getByText('Play your first game!')).toBeVisible();
    await expect(page.locator('app-scoreboard .stat', { hasText: 'Rounds' }).locator('.stat-value')).toHaveText('0');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(objetivo(page)).toHaveCount(0);
  });

  test('una partida: acertar y fallar actualiza el marcador, y al acabar el tiempo guarda el resultado', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Play' }).click();

    // En juego: aparece el objetivo, el rey del lado elegido y las estadísticas
    await expect(objetivo(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0);
    await expect(estadistica(page, 'Correct')).toHaveText('0');
    await expect(estadistica(page, 'Errors')).toHaveText('0');

    // Un fallo: suma error y el objetivo sigue siendo el mismo
    const pedida = await fallar(page);
    await expect(estadistica(page, 'Errors')).toHaveText('1');
    await expect(estadistica(page, 'Correct')).toHaveText('0');
    await expect(objetivo(page)).toHaveText(pedida);

    // Dos aciertos: suman y el objetivo cambia
    const primera = await acertar(page);
    const segunda = await acertar(page);
    await expect(estadistica(page, 'Correct')).toHaveText('2');
    await expect(estadistica(page, 'Errors')).toHaveText('1');
    await expect(estadistica(page, 'Accuracy')).toHaveText('66.7%');
    // Mientras se juega no se guarda nada
    expect(await leerPartidas(page)).toEqual([]);

    // Se acaba el tiempo
    await acelerarPartida(page);
    await expect(resultados(page)).toBeVisible();
    await expect(resultados(page)).toContainText('Final Score');
    await expect(resultados(page).locator('.text-6xl')).toHaveText('2');
    await expect(resultados(page)).toContainText('NEW');
    await expect(resultados(page)).toContainText('Congratulations!');
    await expect(resultados(page)).toContainText('New RECORD with Whites: 2!');
    await expect(resultados(page)).toContainText('67%');
    await expect(resultados(page)).toContainText('Playing with Whites');

    // Quedó guardada en el dispositivo, con lo acertado y lo fallado
    const partidas = await leerPartidas(page);
    expect(partidas).toHaveLength(1);
    expect(partidas[0]).toMatchObject({ score: 2, color: 'w', squaresGood: [primera, segunda], squaresBad: [pedida] });
    expect(partidas[0].round.length).toBe(200);

    // Cerrar el resultado deja el marcador con el récord
    await resultados(page).getByRole('button', { name: 'Continue' }).click();
    await expect(resultados(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    const marcador = page.locator('app-scoreboard');
    await expect(marcador).toContainText('2 points');
    await expect(marcador.locator('.stat', { hasText: 'Whites' }).locator('.stat-value')).toHaveText('2');
    await expect(marcador.locator('.stat', { hasText: 'Blacks' }).locator('.stat-value')).toHaveText('0');
    await expect(marcador.locator('.stat', { hasText: 'Rounds' }).locator('.stat-value')).toHaveText('1');
    await expect(page.getByText('No scores yet.')).toHaveCount(0);

    // Y sigue ahí tras recargar
    await page.reload();
    await expect(page.locator('app-scoreboard')).toContainText('2 points');
  });

  test('con las negras el tablero se voltea y la partida se guarda como negras', async ({ page }) => {
    await abrir(page, 'Black');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(objetivo(page)).toBeVisible();

    // El tablero está volteado: la fila 1 queda ARRIBA (con blancas está abajo)
    const alturaDe = (c: string) =>
      page
        .locator(`lib-board svg rect[data-square="${c}"]`)
        .first()
        .evaluate((e) => e.getBoundingClientRect().y)
        .catch(() => NaN);
    await expect.poll(async () => (await alturaDe('a1')) < (await alturaDe('a8'))).toBe(true);

    // La casilla pedida debe poder tocarse aunque el tablero esté volteado
    const primera = await acertar(page);
    await acelerarPartida(page);
    await expect(resultados(page)).toContainText('Playing with Blacks');
    await expect(resultados(page)).toContainText('New RECORD with Blacks: 1!');

    const partidas = await leerPartidas(page);
    expect(partidas[0]).toMatchObject({ score: 1, color: 'b', squaresGood: [primera], squaresBad: [] });
    await resultados(page).getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.locator('app-scoreboard .stat', { hasText: 'Blacks' }).locator('.stat-value')
    ).toHaveText('1');
  });

  test('una partida peor que el récord no lo supera y lo recuerda', async ({ page }) => {
    await page.addInitScript((k) => {
      if (!localStorage.getItem(k)) {
        localStorage.setItem(
          k,
          JSON.stringify([
            { uid: 'g1', uidUser: 'u', score: 5, squaresGood: [], squaresBad: [], round: ['a1'], date: 1, color: 'w' },
          ])
        );
      }
    }, CLAVE_PARTIDAS);
    await abrir(page);
    await expect(page.locator('app-scoreboard')).toContainText('5 points');

    await page.getByRole('button', { name: 'Play' }).click();
    await acertar(page);
    await acelerarPartida(page);

    await expect(resultados(page)).toContainText('Good game');
    await expect(resultados(page)).toContainText('Your best score with Whites is 5.');
    await expect(resultados(page)).not.toContainText('NEW');
    const partidas = await leerPartidas(page);
    expect(partidas).toHaveLength(2);
    expect(partidas.map((p) => p.score).sort()).toEqual([1, 5]);
  });

  test('igualar el récord se avisa como empate', async ({ page }) => {
    await page.addInitScript((k) => {
      if (!localStorage.getItem(k)) {
        localStorage.setItem(
          k,
          JSON.stringify([
            { uid: 'g1', uidUser: 'u', score: 1, squaresGood: ['a1'], squaresBad: [], round: ['a1'], date: 1, color: 'w' },
          ])
        );
      }
    }, CLAVE_PARTIDAS);
    await abrir(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await acertar(page);
    await acelerarPartida(page);

    await expect(resultados(page)).toContainText('Record tied!');
    await expect(resultados(page)).toContainText('You matched your best with Whites: 1!');
  });

  test('el modo infinito se activa en ajustes, se recuerda, no tiene reloj y no guarda la partida', async ({ page }) => {
    await abrir(page);
    await page.locator('#settings-trigger').click();
    const ajustes = page.locator('ion-modal.settings-modal');
    await expect(ajustes).toBeVisible();
    await ajustes.locator('li.list-row', { hasText: 'Infinite Mode' }).locator('input.toggle').check();
    await expect
      .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), CLAVE_AJUSTES))
      .toMatchObject({ infiniteMode: true });
    await ajustes.locator('ion-button').click();
    await expect(ajustes).toBeHidden();

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(objetivo(page)).toBeVisible();
    await expect(page.locator('app-timer')).toContainText('Infinite Mode');
    await expect(page.locator('app-timer progress')).toHaveCount(0);

    await acertar(page);
    await expect(estadistica(page, 'Correct')).toHaveText('1');
    await page.getByRole('button', { name: 'Stop game' }).click();

    // Muestra el resultado, pero una partida sin límite de tiempo no cuenta para el marcador
    await expect(resultados(page)).toBeVisible();
    await expect(resultados(page).locator('.text-6xl')).toHaveText('1');
    expect(await leerPartidas(page)).toEqual([]);

    // El ajuste sobrevive a una recarga
    await resultados(page).getByRole('button', { name: 'Continue' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('app-timer')).toContainText('Infinite Mode');
  });
});
