import type { Page } from '@playwright/test';

import { esperarPieza, jugar } from '../support/resto-tablero';
import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Onboarding: modal de bienvenida con 5 diapositivas que sale la primera vez que se entra
 * a Inicio. Aquí se desactiva el atajo de las demás pruebas (`skipOnboarding: false`) para
 * ver el flujo real. Se completa (o se salta) y queda marcado en localStorage
 * (`chessColate_onboarding_seen`) para no volver a salir.
 */

test.use({ skipOnboarding: false });

const modal = (page: Page) => page.locator('ion-modal').filter({ has: page.locator('app-onboarding-modal') });
const visto = (page: Page) => page.evaluate(() => localStorage.getItem('chessColate_onboarding_seen'));
const siguiente = (page: Page) => modal(page).getByRole('button', { name: 'Next' });
/** El título de la diapositiva que se está viendo (la activa de Swiper). */
const titulo = (page: Page) => modal(page).locator('swiper-slide-active h2, swiper-slide.swiper-slide-active h2');

test.describe('Onboarding', () => {
  test('la primera visita a Inicio lo muestra desde la primera diapositiva', async ({ page }) => {
    await page.goto('/home');

    await expect(modal(page)).toBeVisible();
    await expect(titulo(page)).toHaveText('Tactics are your biggest lever');
    await expect(modal(page).getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(modal(page).getByRole('button', { name: 'Skip' })).toBeVisible();
    await expect(modal(page).locator('button[aria-label^="slide "]')).toHaveCount(5);
    // Mientras se ve no está marcado como visto
    expect(await visto(page)).toBeNull();
  });

  test('la primera y la cuarta diapositiva se ven como la referencia', async ({ page }) => {
    await page.goto('/home');
    await expect(titulo(page)).toHaveText('Tactics are your biggest lever');
    await expect(modal(page)).toHaveScreenshot('diapositiva-1.png');

    await modal(page).getByRole('button', { name: 'slide 4' }).click();
    await expect(titulo(page)).toHaveText('Make it yours');
    await expect(modal(page).locator('lib-fen-board svg.cm-chessboard')).toBeVisible();
    await expect(modal(page)).toHaveScreenshot('diapositiva-4.png');
  });

  test('se recorre entera con "Next", se puede volver atrás y al final "Start training" lo cierra y lo marca como visto', async ({ page }) => {
    await page.goto('/home');
    await expect(modal(page)).toBeVisible();

    await siguiente(page).click();
    await expect(titulo(page)).toHaveText('ChessColate makes it easy');
    await expect(modal(page).getByRole('button', { name: 'Back' })).toBeVisible();

    await modal(page).getByRole('button', { name: 'Back' }).click();
    await expect(titulo(page)).toHaveText('Tactics are your biggest lever');

    await siguiente(page).click();
    await siguiente(page).click();
    await expect(titulo(page)).toHaveText('Try it: solve the mate');
    await siguiente(page).click();
    await expect(titulo(page)).toHaveText('Make it yours');
    await siguiente(page).click();
    await expect(titulo(page)).toHaveText('Build the habit, enjoy the ride');
    // En la última, el botón principal cambia
    await expect(siguiente(page)).toHaveCount(0);
    expect(await visto(page)).toBeNull();

    await modal(page).getByRole('button', { name: 'Start training' }).click();

    await expect(modal(page)).toBeHidden();
    expect(await visto(page)).toBe('true');
    // Y no vuelve a salir al recargar ni al volver a entrar a Inicio
    await page.reload();
    await expect(page.locator('app-home')).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
    await page.goto('/streak');
    await page.goto('/home');
    await expect(page.locator('app-home')).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
  });

  test('"Skip" lo cierra en cualquier diapositiva y también lo marca como visto', async ({ page }) => {
    await page.goto('/home');
    await expect(modal(page)).toBeVisible();
    await siguiente(page).click();
    await expect(titulo(page)).toHaveText('ChessColate makes it easy');

    await modal(page).getByRole('button', { name: 'Skip' }).click();

    await expect(modal(page)).toBeHidden();
    expect(await visto(page)).toBe('true');
    await page.reload();
    await expect(page.locator('app-home')).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
  });

  test('los puntos llevan directo a una diapositiva', async ({ page }) => {
    await page.goto('/home');
    await expect(modal(page)).toBeVisible();

    await modal(page).getByRole('button', { name: 'slide 5' }).click();
    await expect(titulo(page)).toHaveText('Build the habit, enjoy the ride');
    await modal(page).getByRole('button', { name: 'slide 1' }).click();
    await expect(titulo(page)).toHaveText('Tactics are your biggest lever');
  });

  test('la diapositiva interactiva deja resolver el mate en 2 con la dama, torre y alfil', async ({ page }) => {
    await page.goto('/home');
    await modal(page).getByRole('button', { name: 'slide 3' }).click();
    await expect(titulo(page)).toHaveText('Try it: solve the mate');
    const tablero = modal(page).locator('lib-board-puzzle svg.cm-chessboard');
    await expect(tablero).toBeVisible();
    // Posición del puzzle del onboarding: tras la jugada del rival (Rey a f8) juegan blancas
    await esperarPieza(page, 'f8', 'bk', 'app-onboarding-modal lib-board-puzzle');

    // Dxd8+ (la dama sacrifica), Axd8 (respuesta del rival) y Te8#
    await jugar(page, 'd1d8', 'app-onboarding-modal lib-board-puzzle');
    await esperarPieza(page, 'd8', 'bb', 'app-onboarding-modal lib-board-puzzle');
    await jugar(page, 'e1e8', 'app-onboarding-modal lib-board-puzzle');

    await expect(modal(page).getByText("That's it! That click is what you'll train every day.")).toBeVisible();
    // Resolverlo no cierra el onboarding ni lo marca como visto
    await expect(modal(page)).toBeVisible();
    expect(await visto(page)).toBeNull();
  });

  test('la diapositiva de apariencia deja elegir piezas y tablero y se guarda igual que en Ajustes', async ({ page }) => {
    await page.goto('/home');
    await modal(page).getByRole('button', { name: 'slide 4' }).click();
    await expect(titulo(page)).toHaveText('Make it yours');

    await modal(page).getByRole('tab', { name: 'Board' }).click();
    await modal(page).getByRole('button', { name: 'Blue', exact: true }).click();
    await expect(modal(page).locator('lib-fen-board svg.cm-chessboard')).toHaveClass(/\bblue\b/);
    await modal(page).getByRole('tab', { name: 'Pieces' }).click();
    await modal(page).getByRole('button', { name: 'Fantasy', exact: true }).click();
    await expect(modal(page).getByRole('button', { name: 'Fantasy', exact: true })).toHaveAttribute('aria-pressed', 'true');

    expect(await page.evaluate(() => localStorage.getItem('chessColate_board'))).toBe('blue');
    expect(await page.evaluate(() => localStorage.getItem('chessColate_pieces'))).toBe('fantasy');
  });
});
