import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';
import { eloDelEjercicio, esperarTurnoDelUsuario, puzzlePorElo, resolverPuzzle } from '../support/resto-tablero';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Tablero redimensionable en escritorio (asa de la esquina inferior derecha, como en lichess).
 * La preferencia es global, vive en `chessColate_board_size` y se publica en `--cc-board-size`;
 * sin ella cada pantalla usa su tamaño de siempre. Ver docs/implementado/TABLERO_REDIMENSIONABLE_FLOW.md.
 */

const KEY = 'chessColate_board_size';
const ALTO = 900;

/** Escritorio con ratón: el asa solo se pinta con `hover` y puntero fino. */
test.describe('Tablero redimensionable · escritorio', () => {
  test.use({
    viewport: { width: 1280, height: ALTO },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });

  const asa = (page: Page) => page.getByTestId('board-resize-handle').first();
  const columna = (page: Page) => page.locator('.cc-board-column').first();
  const ancho = async (page: Page) => Math.round((await columna(page).boundingBox())!.width);
  const tablero = async (page: Page) =>
    Math.round((await page.locator('svg.cm-chessboard').first().boundingBox())!.width);
  const guardado = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
  const centro = async (page: Page) => {
    const caja = (await asa(page).boundingBox())!;
    return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  };

  async function abrirRacha(page: Page) {
    await page.goto('/streak');
    await expect(page.getByText('Exercise rating')).toBeVisible();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
  }

  /** Arrastra el asa con el ratón, en pasos como los de una mano. */
  async function arrastrar(page: Page, dx: number, dy: number, pasos = 12) {
    const inicio = await centro(page);
    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    for (let i = 1; i <= pasos; i++) {
      await page.mouse.move(inicio.x + (dx * i) / pasos, inicio.y + (dy * i) / pasos);
    }
    await page.mouse.up();
  }

  test('sin preferencia el tablero tiene el tamaño de siempre y no hay nada guardado', async ({ page }) => {
    await abrirRacha(page);

    // clamp(480px, 100vh − 190px, 640px) con 900 de alto
    expect(await ancho(page)).toBe(640);
    expect(await tablero(page)).toBe(640);
    expect(await guardado(page)).toBeNull();
    await expect(asa(page)).toBeVisible();
  });

  test('arrastrar el asa cambia el tablero y la columna a la vez, y se guarda al soltar', async ({ page }) => {
    await abrirRacha(page);

    await arrastrar(page, -100, -120);

    const nuevo = await ancho(page);
    expect(nuevo).toBeLessThan(640);
    expect(nuevo).toBeGreaterThanOrEqual(320);
    // El tablero llena la columna: el asa de la esquina queda donde está la esquina
    expect(await tablero(page)).toBe(nuevo);
    expect(await guardado(page)).toBe(String(nuevo));
  });

  test('el asa sigue al puntero mientras se arrastra, aunque la columna esté centrada', async ({ page }) => {
    await abrirRacha(page);
    const inicio = await centro(page);

    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(inicio.x - i * 8, inicio.y - i * 16);
    }
    const asaAhora = await centro(page);
    await page.mouse.up();

    // Vertical clavado; horizontal dentro de lo que permite una columna centrada
    expect(Math.abs(asaAhora.y - (inicio.y - 128))).toBeLessThan(4);
    expect(Math.abs(asaAhora.x - (inicio.x - 64))).toBeLessThan(40);
  });

  test('agrandar no pasa de lo que cabe en la ventana (alto − 150)', async ({ page }) => {
    await abrirRacha(page);

    await arrastrar(page, 400, 500, 30);

    expect(await ancho(page)).toBe(ALTO - 150);
    expect(await guardado(page)).toBe(String(ALTO - 150));
  });

  test('encoger no baja de 320', async ({ page }) => {
    await abrirRacha(page);

    await arrastrar(page, -600, -700, 30);

    expect(await ancho(page)).toBe(320);
  });

  test('la preferencia sobrevive a recargar y se aplica antes de pintar el tablero', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '560'), KEY);
    await abrirRacha(page);

    expect(await ancho(page)).toBe(560);
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--cc-board-size'))).toBe('560px');

    await page.reload();
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    expect(await ancho(page)).toBe(560);
  });

  test('es global: la misma preferencia vale en las otras pantallas, acotada a lo que les cabe', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '700'), KEY);

    await page.goto('/coordinates');
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    // Esta pantalla tiene título sobre el tablero: aparta 240 de alto en vez de 150
    expect(await ancho(page)).toBe(ALTO - 240);

    await page.goto('/streak');
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();
    expect(await ancho(page)).toBe(700);
  });

  test('una pantalla con título sobre el tablero conserva su tamaño de siempre sin preferencia', async ({ page }) => {
    await page.goto('/coordinates');
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();

    expect(await ancho(page)).toBe(480);
  });

  test('doble clic en el asa vuelve al tamaño de siempre y borra lo guardado', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '480'), KEY);
    await abrirRacha(page);
    expect(await ancho(page)).toBe(480);

    await asa(page).dblclick();

    await expect.poll(() => ancho(page)).toBe(640);
    expect(await guardado(page)).toBeNull();
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--cc-board-size'))).toBe('');
  });

  test('con el teclado: las flechas cambian de 16 en 16', async ({ page }) => {
    await abrirRacha(page);

    await asa(page).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');

    await expect.poll(() => ancho(page)).toBe(608);
    expect(await guardado(page)).toBe('608');
    await expect(asa(page)).toHaveAttribute('aria-valuenow', '608');
  });

  test('con el tablero a otro tamaño se sigue jugando: las casillas responden donde se ven', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '520'), KEY);
    await abrirRacha(page);
    expect(await tablero(page)).toBe(520);

    const puzzle = puzzlePorElo(await eloDelEjercicio(page));
    await esperarTurnoDelUsuario(page, puzzle);
    await resolverPuzzle(page, puzzle);

    await expect(page.locator('app-streak .navbar span.text-2xl')).toHaveText('1');
  });

  test('el arrastre no deja el cuerpo bloqueado: al soltar se puede seleccionar de nuevo', async ({ page }) => {
    await abrirRacha(page);
    const inicio = await centro(page);

    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    await page.mouse.move(inicio.x - 30, inicio.y - 30);
    await expect(page.locator('body')).toHaveClass(/cc-board-resizing/);
    await page.mouse.up();

    await expect(page.locator('body')).not.toHaveClass(/cc-board-resizing/);
  });
});

test.describe('Tablero redimensionable · móvil', () => {
  test('en el móvil no hay asa y el tablero llena el ancho como siempre', async ({ page }) => {
    await page.goto('/streak');
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();

    await expect(page.getByTestId('board-resize-handle').first()).toBeHidden();
    const caja = (await page.locator('svg.cm-chessboard').first().boundingBox())!;
    expect(Math.round(caja.width)).toBe(393);
  });

  test('una preferencia guardada no cambia el tablero del móvil', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '320'), KEY);
    await page.goto('/streak');
    await expect(page.locator('svg.cm-chessboard')).toBeVisible();

    const caja = (await page.locator('svg.cm-chessboard').first().boundingBox())!;
    expect(Math.round(caja.width)).toBe(393);
  });
});
