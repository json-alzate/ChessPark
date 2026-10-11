import { expect, test } from '../support/test';

/**
 * Todas las rutas públicas de la app (sin sesión) abren, no terminan en blanco y
 * se ven igual que en la captura de referencia. Es la red de seguridad de los
 * refactors: si mover una carpeta rompe un import, un `templateUrl` o una ruta
 * lazy, la pantalla correspondiente falla aquí.
 */
const RUTAS = [
  { ruta: '/home', nombre: 'home' },
  { ruta: '/puzzles/plans-history', nombre: 'historial-de-rutinas' },
  { ruta: '/games', nombre: 'partidas' },
  { ruta: '/analytics', nombre: 'analisis-de-partidas' },
  { ruta: '/streak', nombre: 'racha' },
  { ruta: '/coordinates', nombre: 'coordenadas' },
  { ruta: '/knight-tour', nombre: 'recorrido-del-caballo' },
  { ruta: '/chess960', nombre: 'chess960' },
  { ruta: '/settings', nombre: 'ajustes' },
  { ruta: '/settings/storage', nombre: 'ajustes-almacenamiento' },
  { ruta: '/reminders', nombre: 'recordatorios' },
  { ruta: '/donation', nombre: 'donacion' },
  { ruta: '/privacy', nombre: 'privacidad' },
];

for (const { ruta, nombre } of RUTAS) {
  test(`${ruta} abre y se ve como la referencia`, async ({ page, network }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto(ruta);
    await page.waitForLoadState('networkidle');

    const pantalla = page.locator('.ion-page:not(.ion-page-hidden)').last();
    await expect(pantalla).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(ruta);
    expect(errores, 'errores de JavaScript en la página').toEqual([]);
    expect(network.blocked, 'peticiones externas no simuladas').toEqual([]);

    await expect(page).toHaveScreenshot(`${nombre}.png`);
  });
}

// Antes no había ruta `**`: una dirección que no existe dejaba la pantalla en blanco
// (y un error NG04002 en la consola). Ahora lleva al inicio.
test('una ruta que no existe lleva al inicio en vez de dejar la pantalla en blanco', async ({ page }) => {
  await page.goto('/esta-ruta-no-existe');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.ion-page:not(.ion-page-hidden)').last()).toBeVisible();
});
