import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Chess960 (/chess960): muestra una de las 960 posiciones iniciales (la 518 es la
 * normal), se elige por número o al azar. Los datos salen de assets/data/chess960.json:
 * la prueba compara el tablero con ese archivo y además comprueba las reglas de Fischer.
 */

const POSICIONES: { id: number; fen: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'apps/chessColate/src/assets/data/chess960.json'), 'utf-8')
);
const fenDe = (id: number) => POSICIONES.find((p) => p.id === id)!.fen;

const campo = (page: Page) => page.getByRole('spinbutton');

/** Piezas de la primera fila (a1..h1) leídas del tablero, como `RNBQKBNR` (blancas en mayúscula). */
async function filaDeBlancas(page: Page): Promise<string> {
  const piezas = await page
    .locator('lib-chess960-board g[data-piece]')
    .evaluateAll((els) => els.map((e) => [e.getAttribute('data-piece'), e.getAttribute('data-square')]));
  const fila: string[] = Array(8).fill('?');
  for (const [pieza, casilla] of piezas as [string, string][]) {
    if (casilla[1] === '1') {
      const letra = pieza[1];
      fila['abcdefgh'.indexOf(casilla[0])] = pieza[0] === 'w' ? letra.toUpperCase() : letra;
    }
  }
  return fila.join('');
}

/** Primera fila de un FEN, en mayúsculas (la de las blancas: última parte del tablero). */
const filaDelFen = (fen: string) => fen.split(' ')[0].split('/')[7];

/** ¿Es una posición legal de Fischer? Alfiles en colores opuestos y rey entre las torres. */
function esFischerRandom(fila: string): boolean {
  const alfiles = [...fila].map((p, i) => (p === 'B' ? i : -1)).filter((i) => i >= 0);
  const torres = [...fila].map((p, i) => (p === 'R' ? i : -1)).filter((i) => i >= 0);
  const rey = fila.indexOf('K');
  return (
    [...fila].sort().join('') === 'BBKNNQRR' &&
    alfiles.length === 2 &&
    alfiles[0] % 2 !== alfiles[1] % 2 &&
    torres[0] < rey &&
    rey < torres[1]
  );
}

test.describe('Chess960', () => {
  test('abre con la posición 518, que es el ajedrez normal', async ({ page }) => {
    await page.goto('/chess960');

    await expect(page.getByRole('heading', { name: 'Chess960' })).toBeVisible();
    await expect(campo(page)).toHaveValue('518');
    await expect(page.getByText('Position 518 is the standard chess setup.')).toBeVisible();
    await expect(page.locator('lib-chess960-board g[data-piece]')).toHaveCount(32);
    await expect.poll(() => filaDeBlancas(page)).toBe('RNBQKBNR');
    await expect(page.getByText('Basic Rules')).toBeVisible();
  });

  test('escribir un número muestra esa posición (0 y 959 son los extremos)', async ({ page }) => {
    await page.goto('/chess960');
    await expect(page.locator('lib-chess960-board g[data-piece]')).toHaveCount(32);

    await campo(page).fill('0');
    await expect.poll(() => filaDeBlancas(page)).toBe(filaDelFen(fenDe(0)).toUpperCase());
    expect(filaDelFen(fenDe(0))).toBe('BBQNNRKR');

    await campo(page).fill('959');
    await expect.poll(() => filaDeBlancas(page)).toBe(filaDelFen(fenDe(959)).toUpperCase());

    // Las negras son el espejo de las blancas
    const negras = await page
      .locator('lib-chess960-board g[data-piece^="b"][data-square$="8"]')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-square')![0]}${e.getAttribute('data-piece')![1]}`).sort().join(' '));
    const blancas = await page
      .locator('lib-chess960-board g[data-piece^="w"][data-square$="1"]')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-square')![0]}${e.getAttribute('data-piece')![1]}`).sort().join(' '));
    expect(negras).toBe(blancas);
  });

  test('la posición 0 se ve como la referencia', async ({ page }) => {
    await page.goto('/chess960');
    await expect(page.locator('lib-chess960-board g[data-piece]')).toHaveCount(32);
    await campo(page).fill('0');
    await expect.poll(() => filaDeBlancas(page)).toBe('BBQNNRKR');

    await expect(page.locator('lib-chess960-board')).toHaveScreenshot('posicion-0.png');
  });

  test('los números fuera de rango se corrigen al límite', async ({ page }) => {
    await page.goto('/chess960');
    await expect(page.locator('lib-chess960-board g[data-piece]')).toHaveCount(32);

    await campo(page).fill('5000');
    await expect(campo(page)).toHaveValue('959');
    await expect.poll(() => filaDeBlancas(page)).toBe(filaDelFen(fenDe(959)).toUpperCase());

    await campo(page).fill('-7');
    await expect(campo(page)).toHaveValue('0');
    await expect.poll(() => filaDeBlancas(page)).toBe('BBQNNRKR');
  });

  test('"Random" cambia de posición y siempre cumple las reglas de Fischer', async ({ page }) => {
    await page.goto('/chess960');
    await expect(page.locator('lib-chess960-board g[data-piece]')).toHaveCount(32);
    const vistas = new Set<string>();

    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Random' }).click();
      const id = Number(await campo(page).inputValue());
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(959);

      // El tablero muestra exactamente la posición de ese número
      const esperada = filaDelFen(fenDe(id)).toUpperCase();
      await expect.poll(() => filaDeBlancas(page)).toBe(esperada);
      expect(esFischerRandom(esperada), `posición ${id}: ${esperada}`).toBe(true);
      vistas.add(String(id));
    }
    // Con 6 sorteos sobre 960 posiciones no puede salir siempre la misma
    expect(vistas.size).toBeGreaterThan(1);
  });

  test('las 960 posiciones del archivo son legales de Fischer', async () => {
    expect(POSICIONES).toHaveLength(960);
    const mal = POSICIONES.filter((p) => !esFischerRandom(filaDelFen(p.fen).toUpperCase()));
    expect(mal.map((p) => p.id)).toEqual([]);
    expect(new Set(POSICIONES.map((p) => p.fen)).size).toBe(960);
  });
});
