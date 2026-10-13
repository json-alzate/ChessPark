import { expect, test } from '../support/test';
import { abrirHome, capturarErrores, modalAbierto, pantalla } from '../support/rut-helpers';

/**
 * Rutinas propias y públicas sin sesión (modo invitado). Qué hace cada ruta protegida:
 *
 * - /puzzles/custom-plans        -> CustomPlansGuard deja pasar; la pantalla pide iniciar sesión
 * - /puzzles/custom-plans/create -> AuthGuard: sin perfil redirige a /home
 * - /puzzles/custom-plans/edit/x -> AuthGuard: igual
 * - /puzzles/public-plans        -> PublicPlansGuard deja pasar; la pantalla sale sin rutinas
 *
 * No se puede simular Firebase: aquí solo se ve el comportamiento de invitado.
 */

test('/puzzles/custom-plans sin sesión se queda en la pantalla y pide iniciar sesión', async ({ page, network }) => {
  const errores = capturarErrores(page);
  await page.goto('/puzzles/custom-plans');

  const lista = pantalla(page);
  await expect(page).toHaveURL(/\/puzzles\/custom-plans$/);
  await expect(lista.getByRole('heading', { name: 'My sessions' })).toBeVisible();
  await expect(lista).toContainText('Log in to create and manage your custom sessions');
  await expect(lista.getByRole('button', { name: 'Log in' })).toBeVisible();
  // Sin sesión no se ofrece crear nada
  await expect(lista.getByRole('button', { name: 'Create session' })).toHaveCount(0);
  await expect(lista.getByRole('button', { name: 'Create my first session' })).toHaveCount(0);
  await expect(lista.locator('.skeleton')).toHaveCount(0);

  await expect(lista).toHaveScreenshot('custom-plans-sin-sesion.png');
  // Sin perfil el guard no pide nada a Firestore
  expect(network.blocked.filter((u) => u.includes('firestore'))).toEqual([]);
  expect(errores).toEqual([]);
});

test('en /puzzles/custom-plans, "Log in" abre el formulario de acceso', async ({ page }) => {
  await page.goto('/puzzles/custom-plans');
  await pantalla(page).getByRole('button', { name: 'Log in' }).click();

  const modal = modalAbierto(page);
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Login with Google' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Login with email' })).toBeVisible();
  // Es un modal: la pantalla de debajo sigue siendo la misma
  await expect(page).toHaveURL(/\/puzzles\/custom-plans$/);
});

test('/puzzles/custom-plans/create sin sesión redirige al inicio', async ({ page }) => {
  const errores = capturarErrores(page);
  await page.goto('/puzzles/custom-plans/create');

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('swiper-slide').first()).toBeAttached({ timeout: 30_000 });
  // No llegó a abrirse el formulario de creación
  await expect(page.locator('app-custom-plan-form')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('/puzzles/custom-plans/edit/:uid sin sesión redirige al inicio', async ({ page }) => {
  await page.goto('/puzzles/custom-plans/edit/una-rutina-cualquiera');

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('swiper-slide').first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('app-custom-plan-form')).toHaveCount(0);
});

test('/puzzles/public-plans sin sesión abre la pantalla pero sin rutinas disponibles', async ({ page }) => {
  const errores = capturarErrores(page);
  await page.goto('/puzzles/public-plans');

  const publicas = pantalla(page);
  await expect(page).toHaveURL(/\/puzzles\/public-plans$/);
  await expect(publicas.getByRole('heading', { name: 'Public sessions' })).toBeVisible();
  await expect(publicas.getByRole('button', { name: 'Most recent' })).toBeVisible();
  await expect(publicas.getByRole('button', { name: 'Most played' })).toBeVisible();
  await expect(publicas.getByRole('button', { name: 'Most liked' })).toBeVisible();
  // La red está cortada: la lista de rutinas públicas no llega y se ve el estado vacío
  await expect(publicas).toContainText('No public sessions available');
  await expect(publicas.locator('.skeleton')).toHaveCount(0);

  await expect(publicas).toHaveScreenshot('public-plans-sin-sesion.png');

  // La otra pestaña: sin sesión no hay interacciones
  await publicas.getByRole('button', { name: 'My interactions' }).click();
  await expect(publicas).toContainText('You have no interactions in this category');
  expect(errores).toEqual([]);
});

test('en /puzzles/public-plans el guard intenta leer las rutinas públicas aunque no haya sesión', async ({ page, network }) => {
  await page.goto('/puzzles/public-plans');
  await expect(pantalla(page)).toContainText('No public sessions available');
  // Las rutinas públicas se piden a Firestore sin esperar a un perfil; aquí la red está cortada
  await expect
    .poll(() => network.blocked.some((u) => u.includes('firestore.googleapis.com')), {
      message: 'debería haber intentado leer Firestore',
    })
    .toBe(true);
});

test('desde el inicio, las tarjetas Custom y Public llevan a sus pantallas y se vuelve con "Home"', async ({ page }) => {
  await abrirHome(page);

  await page.getByRole('link', { name: /Custom/ }).click();
  await expect(page).toHaveURL(/\/puzzles\/custom-plans$/);
  await expect(pantalla(page)).toContainText('Log in to create and manage your custom sessions');
  await pantalla(page).locator('.breadcrumbs').getByText('Home').click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole('link', { name: /Public/ }).click();
  await expect(page).toHaveURL(/\/puzzles\/public-plans$/);
  await expect(pantalla(page).getByRole('heading', { name: 'Public sessions' })).toBeVisible();
  await pantalla(page).locator('.breadcrumbs').getByText('Home').click();
  await expect(page).toHaveURL(/\/home$/);
});
