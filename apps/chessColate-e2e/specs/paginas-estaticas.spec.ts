import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Páginas casi estáticas: Donación (/donation) y Privacidad (/privacy). Sin sesión y sin
 * plugins nativos, la donación solo puede mostrar el contenido y pedir iniciar sesión
 * (las compras reales pasan por RevenueCat y no se pueden simular aquí).
 */

test.describe('Donación', () => {
  test('explica en qué ayuda el apoyo y, sin sesión, pide iniciar sesión en vez de ofrecer importes', async ({ page }) => {
    await page.goto('/donation');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Support');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ChessColate');
    await expect(page.getByText('an independent project made with passion', { exact: false })).toBeVisible();

    // Lo que financia el apoyo
    await expect(page.getByText('Your support makes possible')).toBeVisible();
    for (const beneficio of ['No ads', 'New features', 'Continuous improvements', 'Independent project']) {
      await expect(page.getByText(beneficio, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('Recurring subscriptions processed by RevenueCat', { exact: false })).toBeVisible();
    await expect(page.getByText('Cancel anytime from your device settings.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore purchases' })).toBeVisible();

    // Sin sesión: no hay importes, hay una invitación a entrar
    await expect(page.getByRole('heading', { name: 'Sign in to donate' })).toBeVisible();
    await expect(page.getByText('You need an account to process your donation', { exact: false })).toBeVisible();
    await expect(page.getByText('/ month')).toHaveCount(0);
    await expect(page.getByText('Choose the amount you prefer', { exact: false })).toHaveCount(0);
  });

  test('"Login" abre el inicio de sesión con Google y se puede cerrar', async ({ page }) => {
    await page.goto('/donation');

    await page.locator('app-donation').getByRole('button', { name: 'Login', exact: true }).click();

    const login = page.locator('ion-modal app-login');
    await expect(login).toBeVisible();
    await expect(login.getByRole('button', { name: 'Login with Google' })).toBeVisible();
    await expect(login.locator('input[type="email"]').first()).toBeVisible();

    await login.locator('ion-fab-button').click();
    await expect(page.locator('ion-modal app-login')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sign in to donate' })).toBeVisible();
  });
});

test.describe('Privacidad', () => {
  test('muestra la política completa con sus secciones y el contacto', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible();
    await expect(page.getByText('Last updated:', { exact: false })).toBeVisible();
    for (const seccion of [
      'Interpretation and Definitions',
      'Collecting and Using Your Personal Data',
      "Children's Privacy",
      'Links to Other Websites',
      'Changes to this Privacy Policy',
      'Contact Us',
    ]) {
      await expect(page.getByRole('heading', { name: seccion, level: 2 })).toBeAttached();
    }
    // El contacto es un mailto real
    await expect(page.locator('app-privacy a[href^="mailto:"]')).toHaveCount(1);
    await expect(page.locator('app-privacy a[href^="mailto:"]')).toHaveAttribute('href', /@/);
  });

  test('el enlace de migas lleva a Inicio', async ({ page }) => {
    await page.goto('/privacy');

    await page.locator('app-privacy .breadcrumbs a').click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('app-home')).toBeVisible();
  });

  test('la política se puede leer entera haciendo scroll hasta el contacto', async ({ page }) => {
    await page.goto('/privacy');
    const contacto = page.getByRole('heading', { name: 'Contact Us', level: 2 });

    await contacto.scrollIntoViewIfNeeded();

    await expect(contacto).toBeInViewport();
    await expect(page.getByText('By email:', { exact: false })).toBeVisible();
  });
});
