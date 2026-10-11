import type { Page } from '@playwright/test';
import { Chess } from 'chess.js';

import { PUZZLES, type PuzzleFixture } from './fixtures';

/**
 * Ayudas para jugar sobre el tablero (cm-chessboard) en las pruebas de racha y
 * otros modos con puzzles. El tablero es un SVG: cada casilla es un
 * `rect[data-square]` y cada pieza un `g[data-piece][data-square]`.
 */

const TABLERO = 'svg.cm-chessboard';

/** El puzzle de los fixtures cuyo elo coincide con el que muestra la pantalla. */
export function puzzlePorElo(elo: number): PuzzleFixture {
  const puzzle = PUZZLES.find((p) => p.rating === elo);
  if (!puzzle) {
    throw new Error(`Ningún puzzle de los fixtures tiene elo ${elo}`);
  }
  return puzzle;
}

/** Posición del puzzle tras aplicar las primeras `plies` jugadas de su solución. */
function posicionTras(puzzle: PuzzleFixture, plies: number): Chess {
  const chess = new Chess(puzzle.fen);
  puzzle.moves
    .split(' ')
    .slice(0, plies)
    .forEach((m) => chess.move(m));
  return chess;
}

/** Espera a que el tablero exista y la pieza `codigo` (p. ej. `wq`) esté en `casilla`. */
export async function esperarPieza(page: Page, casilla: string, codigo: string, alcance = ''): Promise<void> {
  await page
    .locator(`${alcance} ${TABLERO} g[data-piece="${codigo}"][data-square="${casilla}"]`)
    .waitFor({ state: 'attached' });
}

/** Espera a que el rival haga su jugada número `plies` (índice 0 = la primera) del puzzle. */
async function esperarJugadaDelRival(page: Page, puzzle: PuzzleFixture, indice: number): Promise<void> {
  const chess = posicionTras(puzzle, indice);
  const uci = puzzle.moves.split(' ')[indice];
  const mov = chess.move(uci);
  await esperarPieza(page, mov.to, `${mov.color}${mov.promotion ?? mov.piece}`);
}

/** Centro de una casilla en coordenadas de pantalla. */
async function centroDe(page: Page, casilla: string, alcance = ''): Promise<{ x: number; y: number }> {
  const rect = page.locator(`${alcance} ${TABLERO} rect[data-square="${casilla}"]`);
  // El tablero se redibuja al cambiar de puzzle u orientación: se reintenta mientras no esté
  for (let intento = 0; intento < 60; intento++) {
    const caja = await rect.boundingBox().catch(() => null);
    if (caja) {
      return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  throw new Error(`La casilla ${casilla} no está visible`);
}

/** Juega una jugada UCI (`e2e4`) con dos clics: pieza y destino. */
export async function jugar(page: Page, uci: string, alcance = ''): Promise<void> {
  const origen = await centroDe(page, uci.slice(0, 2), alcance);
  await page.mouse.click(origen.x, origen.y);
  const destino = await centroDe(page, uci.slice(2, 4), alcance);
  await page.mouse.click(destino.x, destino.y);
}

/** Espera a que el rival haya hecho su primera jugada: el tablero ya espera al usuario. */
export async function esperarTurnoDelUsuario(page: Page, puzzle: PuzzleFixture): Promise<void> {
  await esperarJugadaDelRival(page, puzzle, 0);
}

/**
 * Resuelve el puzzle que hay en pantalla con la solución de los fixtures: juega
 * las jugadas del usuario (1, 3, 5…) y espera la réplica del rival entre una y otra.
 */
export async function resolverPuzzle(page: Page, puzzle: PuzzleFixture): Promise<void> {
  const jugadas = puzzle.moves.split(' ');
  await esperarTurnoDelUsuario(page, puzzle);
  for (let i = 1; i < jugadas.length; i += 2) {
    await jugar(page, jugadas[i]);
    if (i + 1 < jugadas.length) {
      await esperarJugadaDelRival(page, puzzle, i + 1);
    }
  }
}

/**
 * Juega una jugada legal que NO es la de la solución (ni da mate): la app la cuenta
 * como fallo. Devuelve la jugada que se hizo.
 */
export async function jugarJugadaErronea(page: Page, puzzle: PuzzleFixture): Promise<string> {
  await esperarTurnoDelUsuario(page, puzzle);
  const chess = posicionTras(puzzle, 1);
  const solucion = puzzle.moves.split(' ')[1];
  const candidata = chess
    .moves({ verbose: true })
    .find((m) => `${m.from}${m.to}${m.promotion ?? ''}` !== solucion && !m.san.includes('#'));
  if (!candidata) {
    throw new Error('No hay jugada errónea disponible');
  }
  const uci = `${candidata.from}${candidata.to}`;
  await jugar(page, uci);
  return uci;
}

/** Elo del ejercicio que muestra la pantalla de racha. */
export async function eloDelEjercicio(page: Page): Promise<number> {
  const texto = await page.locator('app-streak span.font-mono').first().innerText();
  return Number(texto.trim());
}

/**
 * Anota cada archivo de puzzles que pide la app al CDN y responde con los
 * puzzles fijos. Sirve para comprobar QUÉ elo pide la app (la rampa de la racha).
 * Se registra después del guardián de red, así que tiene prioridad sobre él.
 */
export async function espiarCdn(page: Page): Promise<string[]> {
  const urls: string[] = [];
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\//, (route) => {
    urls.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(PUZZLES),
    });
  });
  return urls;
}

/** Inicio del rango de 20 puntos de elo al que pertenece `elo` (1415 -> 1400). */
export function inicioDeRango(elo: number): number {
  return Math.floor(elo / 20) * 20;
}

/** ¿Alguna de las URLs pedidas es un archivo del rango de elo que empieza en `inicio`? */
export function sePidioRango(urls: string[], inicio: number): boolean {
  return urls.some((u) => new RegExp(`_${inicio}_${inicio + 19}\\.json$`).test(u));
}

/**
 * Clic en una casilla de un tablero cualquiera (`alcance` es el contenedor, p. ej.
 * `lib-board`). Espera a que la casilla deje de moverse (el tablero se voltea con una
 * transición al empezar a jugar) para no hacer clic donde ya no está.
 */
export async function clicEnCasilla(page: Page, alcance: string, casilla: string): Promise<void> {
  const rect = page.locator(`${alcance} svg rect[data-square="${casilla}"]`).first();
  let anterior = '';
  for (let intento = 0; intento < 40; intento++) {
    const caja = await rect.boundingBox();
    const actual = JSON.stringify(caja);
    if (caja && actual === anterior) {
      await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
      return;
    }
    anterior = actual;
    // Un fotograma de animación: no es una espera fija, es el paso de la comprobación
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  throw new Error(`La casilla ${casilla} no se estabilizó`);
}
