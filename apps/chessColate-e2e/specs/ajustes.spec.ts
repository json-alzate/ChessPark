import type { Page } from '@playwright/test';

import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Ajustes (/settings) en modo invitado: apariencia (piezas, tablero y tema de la app) e
 * idioma. Sin sesión todo se guarda solo en el dispositivo (localStorage) y debe
 * sobrevivir a una recarga y verse en los demás tableros de la app.
 */

const local = (page: Page, clave: string) => page.evaluate((k) => localStorage.getItem(k), clave);
const vista = (page: Page) => page.locator('app-appearance-picker lib-fen-board svg.cm-chessboard');
const pestana = (page: Page, nombre: string) =>
  page.locator('app-appearance-picker').getByRole('tab', { name: nombre, exact: true });
const sprite = (page: Page) => page.locator('#cm-chessboard-sprite').innerHTML();

test.describe('Ajustes', () => {
  test('muestra las secciones y, en web, no ofrece los recordatorios nativos', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    for (const seccion of ['Appearance', 'Language', 'Support the app', 'Storage']) {
      await expect(page.getByRole('heading', { name: seccion })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Notifications' })).toHaveCount(0);
    // Por defecto: inglés marcado, tablero y piezas de siempre, tema halloween
    await expect(page.locator('app-settings ul.menu a.active')).toHaveText(/English/);
    await expect(vista(page)).toHaveClass(/chessboard-js/);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('halloween');
    // El resumen de almacenamiento termina de calcularse
    await expect(page.getByText('Manage downloads')).toBeVisible();
    await expect(page.getByText('Calculating…')).toHaveCount(0);
  });

  test('el color del tablero se aplica al instante, se guarda y sigue tras recargar', async ({ page }) => {
    await page.goto('/settings');
    await expect(vista(page)).toBeVisible();
    expect(await local(page, 'chessColate_board')).toBe('chessboard-js');

    await pestana(page, 'Board').click();
    await page.getByRole('button', { name: 'Green', exact: true }).click();

    await expect(vista(page)).toHaveClass(/\bgreen\b/);
    await expect(vista(page)).not.toHaveClass(/chessboard-js/);
    await expect(page.getByRole('button', { name: 'Green', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Wood', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(await local(page, 'chessColate_board')).toBe('green');

    await page.reload();
    await expect(vista(page)).toHaveClass(/\bgreen\b/);
    await pestana(page, 'Board').click();
    await expect(page.getByRole('button', { name: 'Green', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await local(page, 'chessColate_board')).toBe('green');
  });

  test('el estilo de piezas cambia el juego de piezas, se guarda y sigue tras recargar', async ({ page }) => {
    await page.goto('/settings');
    await expect(vista(page)).toBeVisible();
    const antes = await sprite(page);
    expect(await local(page, 'chessColate_pieces')).toBe('cburnett');

    await page.getByRole('button', { name: 'Fantasy', exact: true }).click();

    // Se reemplaza el sprite de piezas que comparten todos los tableros
    await expect.poll(() => sprite(page)).not.toBe(antes);
    await expect(page.getByRole('button', { name: 'Fantasy', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await local(page, 'chessColate_pieces')).toBe('fantasy');
    const conFantasy = await sprite(page);

    await page.reload();
    await expect(vista(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fantasy', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // Tras recargar, el sprite que se pinta es el elegido (no el de siempre)
    await expect.poll(() => sprite(page)).toBe(conFantasy);
    expect(await local(page, 'chessColate_pieces')).toBe('fantasy');
  });

  test('el tema de la app cambia toda la interfaz, se guarda y sigue tras recargar', async ({ page }) => {
    await page.goto('/settings');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'halloween');
    expect(await page.evaluate(() => document.documentElement.classList.contains('ion-palette-dark'))).toBe(true);

    await pestana(page, 'Theme').click();
    await page.getByRole('button', { name: 'cupcake', exact: true }).click();

    await expect(html).toHaveAttribute('data-theme', 'cupcake');
    // Cupcake es un tema claro: Ionic deja la paleta oscura
    await expect(html).not.toHaveClass(/ion-palette-dark/);
    expect(await local(page, 'chessColate_theme')).toBe('cupcake');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'cupcake');
    await expect(html).not.toHaveClass(/ion-palette-dark/);

    // Y uno oscuro la vuelve a poner
    await pestana(page, 'Theme').click();
    await page.getByRole('button', { name: 'dracula', exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'dracula');
    await expect(html).toHaveClass(/ion-palette-dark/);
    expect(await local(page, 'chessColate_theme')).toBe('dracula');
  });

  test('la muestra de apariencia con tablero verde y piezas fantasy se ve como la referencia', async ({ page }) => {
    await page.goto('/settings');
    await expect(vista(page)).toBeVisible();
    await pestana(page, 'Board').click();
    await page.getByRole('button', { name: 'Green', exact: true }).click();
    await pestana(page, 'Pieces').click();
    await page.getByRole('button', { name: 'Fantasy', exact: true }).click();
    await expect(vista(page)).toHaveClass(/\bgreen\b/);
    await expect(page.getByRole('button', { name: 'Fantasy', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await expect(page.locator('app-appearance-picker lib-fen-board')).toHaveScreenshot('muestra-verde-fantasy.png');
  });

  test('la apariencia elegida llega a los tableros de las demás pantallas', async ({ page }) => {
    await page.addInitScript(() => {
      // Apariencia guardada de una sesión anterior
      if (!localStorage.getItem('chessColate_board')) {
        localStorage.setItem('chessColate_board', 'blue');
        localStorage.setItem('chessColate_pieces', 'fantasy');
        localStorage.setItem('chessColate_theme', 'nord');
      }
    });
    await page.goto('/chess960');

    const tablero = page.locator('lib-chess960-board svg.cm-chessboard');
    await expect(tablero).toBeVisible();
    await expect(tablero).toHaveClass(/\bblue\b/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
    // Es el sprite de piezas "fantasy": distinto del clásico
    const fantasy = await sprite(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Classic', exact: true }).click();
    await expect.poll(() => sprite(page)).not.toBe(fantasy);
    expect(await local(page, 'chessColate_pieces')).toBe('cburnett');
  });

  test('cambiar el idioma traduce la pantalla, se guarda y sigue tras recargar', async ({ page }) => {
    await page.goto('/settings');
    expect(await page.evaluate(() => localStorage.getItem('chessColate_lang'))).toBe('en');

    await page.locator('app-settings ul.menu a', { hasText: 'Spanish' }).click();

    await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Idioma' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apariencia' })).toBeVisible();
    await expect(page.locator('app-settings ul.menu a.active')).toHaveText(/Español/);
    expect(await local(page, 'chessColate_lang')).toBe('es');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
    await expect(page.locator('app-settings ul.menu a.active')).toHaveText(/Español/);

    // Y se puede volver a inglés
    await page.locator('app-settings ul.menu a', { hasText: 'Inglés' }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    expect(await local(page, 'chessColate_lang')).toBe('en');
  });

  test('la fila de almacenamiento lleva a la gestión de descargas', async ({ page }) => {
    await page.goto('/settings');

    await page.getByText('Manage downloads').click();

    await expect(page).toHaveURL(/\/settings\/storage$/);
    await expect(page.getByRole('heading', { name: 'Downloaded exercises' })).toBeVisible();
  });
});
