import type { Page } from '@playwright/test';

import {
  construirPgn,
  ITALIANA,
  MATE_DEL_LOCO,
  MATE_DEL_PASTOR,
  PAQUETE_PETROSIAN,
  simularCatalogoDePartidas,
} from '../support/resto-partidas';
import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Partidas (/games, /games/:id, /games/viewer, /games/pgn): catálogo de campeones, lista de
 * partidas con filtros, reproductor jugada a jugada y PGN propio.
 *
 * El catálogo se simula (support/resto-partidas.ts): un campeón de prueba con cuatro
 * partidas que cubren blancas/negras y ganada/tablas/perdida.
 */

const TABLERO = 'lib-board-game-player svg.cm-chessboard';
/** La pieza `codigo` (p. ej. `wq`) en `casilla`. Se busca el código exacto: mientras una pieza se captura
 *  las dos conviven un instante en la casilla. */
const pieza = (page: Page, casilla: string, codigo = '') =>
  page.locator(`${TABLERO} g[data-piece${codigo ? `="${codigo}"` : ''}][data-square="${casilla}"]`);
const progreso = (page: Page) => page.getByText(/^\s*move \d+ \/ \d+\s*$/);
/** Ids de los paquetes de partidas guardados en IndexedDB (`ChessColateGamesDB`). */
const paquetesGuardados = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((ok) => {
        const abrir = indexedDB.open('ChessColateGamesDB');
        abrir.onerror = () => ok([]);
        abrir.onsuccess = () => {
          const db = abrir.result;
          if (!db.objectStoreNames.contains('packs')) {
            db.close();
            ok([]);
            return;
          }
          const claves = db.transaction('packs', 'readonly').objectStore('packs').getAllKeys();
          claves.onsuccess = () => {
            db.close();
            ok(claves.result.map(String));
          };
        };
      })
  );
const boton = (page: Page, etiqueta: string) => page.getByRole('button', { name: etiqueta, exact: true });
const filas = (page: Page) => page.locator('app-games-player ul.divide-y > li');
/** Altura en pantalla de una casilla (NaN mientras el tablero se está redibujando). */
const alturaDe = (page: Page, casilla: string) =>
  page
    .locator(`${TABLERO} rect[data-square="${casilla}"]`)
    .first()
    .evaluate((e) => e.getBoundingClientRect().y)
    .catch(() => NaN);
/** ¿La casilla `a` queda más arriba en pantalla que la `b`? (se reintenta mientras se redibuja) */
const estaArriba = (page: Page, a: string, b: string) =>
  expect.poll(async () => (await alturaDe(page, a)) < (await alturaDe(page, b)));
const estaAbajo = (page: Page, a: string, b: string) =>
  expect.poll(async () => (await alturaDe(page, a)) > (await alturaDe(page, b)));

/** Descarga el paquete del catálogo y entra a su lista de partidas. */
async function abrirPaquete(page: Page) {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  await page.locator('app-games section', { hasText: 'On your device' }).getByText('Tigran Petrosian').click();
  await expect(page).toHaveURL(/\/games\/petrosian$/);
  await expect(filas(page)).toHaveCount(4);
}

test.describe('Partidas', () => {
  test('el catálogo lista los campeones con cuántas partidas trae y cuánto pesa', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');

    await expect(page.getByRole('heading', { name: 'Historical games' })).toBeVisible();
    const campeones = page.locator('app-games section', { hasText: 'World champions' });
    await expect(campeones).toContainText('Tigran Petrosian');
    await expect(campeones).toContainText('1963–1969');
    await expect(campeones).toContainText('4 games');
    // Sin nada descargado no hay sección "En tu dispositivo"
    await expect(page.getByText('On your device')).toHaveCount(0);
    await expect(page.getByText('Open your own PGN')).toBeVisible();
  });

  test('descargar un paquete lo deja en el dispositivo y aparece en Almacenamiento', async ({ page }) => {
    const peticiones = await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await expect(page.getByText('Tigran Petrosian')).toBeVisible();

    await page.getByRole('button', { name: 'Download', exact: true }).click();

    const enDispositivo = page.locator('app-games section', { hasText: 'On your device' });
    await expect(enDispositivo).toContainText('Tigran Petrosian');
    await expect(enDispositivo).toContainText('4 games');
    expect(peticiones.some((p) => p.endsWith('/players/petrosian.pgn'))).toBe(true);
    // Ya no se ofrece para descargar
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(0);

    await page.goto('/settings/storage');
    const paquetes = page.locator('app-storage section', { hasText: 'Historical games' });
    await expect(paquetes).toContainText('Tigran Petrosian');
    await expect(paquetes).toContainText('4 games');

    // Sigue ahí tras recargar y sin volver a pedirlo
    const antes = peticiones.filter((p) => p.endsWith('.pgn')).length;
    await page.goto('/games');
    await expect(page.locator('app-games section', { hasText: 'On your device' })).toContainText('Tigran Petrosian');
    expect(peticiones.filter((p) => p.endsWith('.pgn')).length).toBe(antes);
  });

  test('la lista del campeón se filtra por resultado, color y rival', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);

    await expect(page.getByRole('heading', { name: 'Tigran Petrosian' })).toBeVisible();
    await expect(page.getByText('4 games').first()).toBeVisible();
    await expect(filas(page).first()).toContainText('Petrosian, Tigran V – Spassky, Boris V');
    await expect(filas(page).first()).toContainText('1-0');
    await expect(filas(page).first()).toContainText('7 moves');

    await boton(page, 'Won').click();
    await expect(filas(page)).toHaveCount(2);
    await boton(page, 'Drawn').click();
    await expect(filas(page)).toHaveCount(1);
    await expect(filas(page).first()).toContainText('Smyslov, Vasily');

    await boton(page, 'All').click();
    await boton(page, 'As white').click();
    await expect(filas(page)).toHaveCount(2);
    await boton(page, 'As black').click();
    await expect(filas(page)).toHaveCount(2);
    await expect(filas(page).first()).toContainText('Botvinnik');

    await boton(page, 'All').click();
    await page.getByPlaceholder('Search opponent…').fill('fisch');
    await expect(filas(page)).toHaveCount(1);
    await expect(filas(page).first()).toContainText('Fischer, Robert J');
    await page.getByPlaceholder('Search opponent…').fill('zzzz');
    await expect(page.getByText('No games match your search.')).toBeVisible();
  });

  test('el reproductor avanza y retrocede jugada a jugada y el tablero lo refleja', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);
    await filas(page).first().getByRole('button').click();

    // Mate del pastor: Petrosian (blancas) – Spassky
    await expect(page).toHaveURL(/\/games\/viewer\?index=0$/);
    await expect(page.locator('.viewer-header')).toContainText('Petrosian, Tigran V – Spassky, Boris V');
    await expect(page.locator('.viewer-header')).toContainText('1-0');
    await expect(progreso(page)).toHaveText('move 0 / 7');
    await expect(pieza(page, 'e2', 'wp')).toHaveCount(1);
    await expect(page.locator('.font-mono button', { hasText: /^Qxf7#$/ })).toBeVisible();

    await boton(page, 'Next move').click();
    await expect(progreso(page)).toHaveText('move 1 / 7');
    await expect(pieza(page, 'e4', 'wp')).toHaveCount(1);
    await expect(pieza(page, 'e2')).toHaveCount(0);

    await boton(page, 'Next move').click();
    await expect(progreso(page)).toHaveText('move 2 / 7');
    await expect(pieza(page, 'e5', 'bp')).toHaveCount(1);

    await boton(page, 'Previous move').click();
    await expect(progreso(page)).toHaveText('move 1 / 7');
    await expect(pieza(page, 'e5')).toHaveCount(0);

    // Al final: la dama blanca captura en f7 y es mate
    await boton(page, 'Go to end').click();
    await expect(progreso(page)).toHaveText('move 7 / 7');
    await expect(pieza(page, 'f7', 'wq')).toHaveCount(1);

    await boton(page, 'Go to start').click();
    await expect(progreso(page)).toHaveText('move 0 / 7');
    await expect(pieza(page, 'f7', 'bp')).toHaveCount(1);
    await expect(pieza(page, 'f7', 'wq')).toHaveCount(0);

    // Tocar una jugada de la lista salta a ella
    await page.locator('.font-mono button', { hasText: /^Bc4$/ }).click();
    await expect(progreso(page)).toHaveText('move 3 / 7');
    await expect(pieza(page, 'c4', 'wb')).toHaveCount(1);
  });

  test('el final del mate del pastor se ve como la referencia', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);
    await filas(page).first().getByRole('button').click();
    await boton(page, 'Go to end').click();
    await expect(progreso(page)).toHaveText('move 7 / 7');
    await expect(pieza(page, 'f7', 'wq')).toHaveCount(1);
    await expect(pieza(page, 'f7', 'bp')).toHaveCount(0);

    await expect(page.locator('app-games-viewer .container')).toHaveScreenshot('mate-del-pastor-final.png');
  });

  test('"Play" reproduce la partida sola hasta el final', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);
    await filas(page).nth(1).getByRole('button').click();

    // Mate del loco: 4 jugadas, a medio segundo cada una
    await expect(page.locator('.viewer-header')).toContainText('Botvinnik, Mikhail – Petrosian, Tigran V');
    await expect(progreso(page)).toHaveText('move 0 / 4');
    await page.getByRole('button', { name: '0.5s', exact: true }).click();
    await boton(page, 'Play or pause').click();

    await expect(progreso(page)).toHaveText('move 4 / 4', { timeout: 20_000 });
    await expect(pieza(page, 'h4', 'bq')).toHaveCount(1);
    // La velocidad elegida se recuerda en el dispositivo
    const ajustes = await page.evaluate(() => localStorage.getItem('chessColate_games_playback'));
    expect(JSON.parse(ajustes ?? '{}')).toMatchObject({ msPerMove: 500 });
  });

  test('girar el tablero invierte su orientación', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);
    await filas(page).first().getByRole('button').click();
    await expect(pieza(page, 'e2', 'wp')).toHaveCount(1);

    // Blancas abajo: la fila 1 está más abajo que la 8
    await estaAbajo(page, 'a1', 'a8').toBe(true);
    await boton(page, 'Flip the board').click();
    await estaArriba(page, 'a1', 'a8').toBe(true);
    await boton(page, 'Flip the board').click();
    await estaAbajo(page, 'a1', 'a8').toBe(true);
  });

  test('el modo TV encadena las partidas de la colección', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);

    await page.getByRole('button', { name: 'Watch in TV mode' }).click();

    await expect(page).toHaveURL(/\/games\/viewer\?index=0&tv=1$/);
    await expect(page.getByText('1 / 4')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Autoplay' })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('2 / 4')).toBeVisible();
    await expect(page.locator('.viewer-header')).toContainText('Botvinnik, Mikhail – Petrosian, Tigran V');
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(page.getByText('1 / 4')).toBeVisible();
  });

  test('borrar el paquete pide confirmación y lo quita del dispositivo', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const aviso = page.locator('ion-alert');
    await expect(aviso).toContainText('Delete these games?');
    await aviso.getByRole('button', { name: 'Cancel' }).click();
    await expect(aviso).toBeHidden();
    await expect(page).toHaveURL(/\/games\/petrosian$/);

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await aviso.getByRole('button', { name: 'Delete', exact: true }).click();

    // Vuelve al catálogo y el paquete ya no está guardado en el dispositivo
    await expect(page).toHaveURL(/\/games$/);
    await expect.poll(() => paquetesGuardados(page)).toEqual([]);
    await page.reload();
    await expect(page.getByText('On your device')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
  });

  // Antes: el catálogo que queda en la pila de Ionic seguía enseñando el paquete borrado en
  // "On your device" (GamesPage solo cargaba la lista en ngOnInit). Se arregló con ionViewWillEnter.
  test('tras borrar el paquete, el catálogo ya no lo muestra sin recargar', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await abrirPaquete(page);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('ion-alert').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByText('On your device')).toHaveCount(0);
  });

  test('un PGN pegado se abre como colección propia y se reproduce', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await page.getByText('Open your own PGN').click();
    const abrir = page.getByRole('button', { name: 'Open', exact: true });
    await expect(abrir).toBeDisabled();

    const dos = [
      construirPgn({ Event: 'Mi torneo', White: 'Yo', Black: 'Tú', Date: '2026.10.01' }, ITALIANA, '1-0'),
      construirPgn({ Event: 'Mi torneo', White: 'Ella', Black: 'Yo', Date: '2026.10.02' }, MATE_DEL_LOCO, '0-1'),
    ].join('\n');
    await page.getByPlaceholder('Paste the PGN of one or more games here…').fill(dos);
    await expect(abrir).toBeEnabled();
    await abrir.click();

    await expect(page).toHaveURL(/\/games\/pgn$/);
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();
    await expect(filas(page)).toHaveCount(2);
    await expect(filas(page).first()).toContainText('Yo – Tú');
    await expect(filas(page).first()).toContainText('12 moves');
    await expect(filas(page).nth(1)).toContainText('Ella – Yo');
    // Un PGN propio no es un paquete: no se puede "borrar del dispositivo"
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);

    await filas(page).nth(1).getByRole('button').click();
    await expect(page.locator('.viewer-header')).toContainText('Ella – Yo');
    await expect(progreso(page)).toHaveText('move 0 / 4');
    await boton(page, 'Go to end').click();
    await expect(pieza(page, 'h4', 'bq')).toHaveCount(1);
  });

  test('un texto que no es un PGN avisa en vez de abrir nada', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await page.getByText('Open your own PGN').click();
    await page.getByPlaceholder('Paste the PGN of one or more games here…').fill('esto no es una partida');
    await page.getByRole('button', { name: 'Open', exact: true }).click();

    const aviso = page.locator('ion-alert');
    await expect(aviso).toContainText('No games found');
    await expect(aviso).toContainText('That text does not look like a valid PGN.');
    await expect(page).toHaveURL(/\/games$/);
  });

  test('un PGN con relojes de chess.com muestra el tiempo y no cuenta los comentarios como jugadas', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games');
    await page.getByText('Open your own PGN').click();
    const pgn = construirPgn(
      { Event: 'Live Chess', White: 'Blanco', Black: 'Negro', Date: '2026.10.01', TimeControl: '600' },
      MATE_DEL_PASTOR,
      '1-0',
      true
    );
    await page.getByPlaceholder('Paste the PGN of one or more games here…').fill(pgn);
    await page.getByRole('button', { name: 'Open', exact: true }).click();

    await expect(filas(page)).toHaveCount(1);
    // Siete jugadas, no 14+ por culpa de los {[%clk …]}
    await expect(filas(page).first()).toContainText('7 moves');
    await filas(page).first().getByRole('button').click();
    await expect(progreso(page)).toHaveText('move 0 / 7');
    await expect(page.locator('.viewer-header')).toContainText('Rapid');
  });

  test('el reproductor de una partida sin cargar muestra el aviso en vez de romperse', async ({ page }) => {
    await simularCatalogoDePartidas(page);
    await page.goto('/games/viewer?index=0');

    // Sin colección abierta no hay partida que enseñar: vuelve al catálogo
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByRole('heading', { name: 'Historical games' })).toBeVisible();
  });
});

test.describe('Partidas propias desde el análisis', () => {
  test.describe.configure({ timeout: 120_000 });

  test('tocar una partida del análisis la abre en el reproductor desde el lado con el que jugó, y volver regresa al análisis', async ({
    page,
  }) => {
    const { simularChessCom, simularLichess, USUARIO_CHESS_COM, USUARIO_LICHESS } = await import(
      '../support/resto-partidas'
    );
    await simularChessCom(page);
    await simularLichess(page);
    await page.goto('/analytics');
    await page.locator('app-analytics label', { hasText: 'Chess.com' }).locator('input').fill(USUARIO_CHESS_COM);
    await page.locator('app-analytics label', { hasText: 'Lichess' }).locator('input').fill(USUARIO_LICHESS);
    await page.getByRole('button', { name: '3 months' }).click();
    await page.getByRole('button', { name: 'Analyse my games' }).click();
    await page.locator('app-analytics .join button', { hasText: /Games \(6\)/ }).click();

    const lista = page.locator('app-analytics ul.divide-y > li');
    await expect(lista).toHaveCount(6);

    // La más reciente: lichess, jugada con negras (mate del loco)
    await lista.first().getByRole('button').click();
    await expect(page).toHaveURL(/\/games\/viewer\?index=0&color=b(lack)?&source=analytics$/);
    await expect(page.locator('.viewer-header')).toContainText('li_rival1 – jalzate_li');
    await expect(page.locator('.viewer-header')).toContainText('0-1');
    await expect(progreso(page)).toHaveText('move 0 / 4');
    // Jugó con negras: el tablero arranca con las negras abajo (la fila 8 más abajo que la 1)
    await expect(pieza(page, 'e2', 'wp')).toHaveCount(1);
    await estaAbajo(page, 'a8', 'a1').toBe(true);
    await boton(page, 'Go to end').click();
    await expect(pieza(page, 'h4', 'bq')).toHaveCount(1);
    // Los relojes del PGN de lichess ({[%clk …]}) llegan al reproductor junto a cada jugada
    await expect(page.locator('.overflow-x-auto.font-mono')).toContainText('9:59');
    await expect(page.locator('.overflow-x-auto.font-mono')).toContainText('8:56');

    // La segunda de la lista es de chess.com, jugada con blancas
    await page.locator('.viewer-header button').click();
    await expect(page).toHaveURL(/\/analytics$/);
    await expect(lista).toHaveCount(6);
    await lista.nth(1).getByRole('button').click();
    await expect(page.locator('.viewer-header')).toContainText('jalzate_cc – rival_uno');
    await expect(pieza(page, 'e2', 'wp')).toHaveCount(1);
    await estaAbajo(page, 'a1', 'a8').toBe(true);
  });
});

// Se usa para comprobar que el paquete de prueba es el esperado
test('el paquete de prueba tiene cuatro partidas válidas', () => {
  expect(PAQUETE_PETROSIAN.match(/\[Event /g)).toHaveLength(4);
});
