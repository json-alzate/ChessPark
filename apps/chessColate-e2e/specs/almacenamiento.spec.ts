import type { Page } from '@playwright/test';

import { contarDescargas, sembrarDescargas } from '../support/resto-almacen';
import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Almacenamiento (/settings/storage): los archivos de puzzles descargados viven en
 * IndexedDB; la pantalla los agrupa por tema, y se pueden borrar uno a uno, por tema o
 * todos. Borrar nunca toca el progreso. Aquí se siembran archivos con la misma forma
 * que los guarda la app y se comprueba la lista y el estado real de IndexedDB.
 */

const grupos = (page: Page) => page.locator('app-storage ul.flex-col > li');
const aviso = (page: Page) => page.locator('ion-alert');

/** Abre la app, siembra las descargas y abre la pantalla de gestión. */
async function abrirConDescargas(page: Page, archivos: { tema: string; desde: number }[]) {
  await page.goto('/settings');
  await expect(page.getByText('Manage downloads')).toBeVisible();
  await sembrarDescargas(page, archivos);
  await page.goto('/settings/storage');
}

test.describe('Almacenamiento', () => {
  test('sin descargas muestra el mensaje de vacío', async ({ page }) => {
    await page.goto('/settings/storage');

    await expect(page.getByRole('heading', { name: 'Downloaded exercises' })).toBeVisible();
    await expect(
      page.getByText('You have no downloaded exercises. They download on their own as you train.')
    ).toBeVisible();
    await expect(page.locator('app-storage button', { hasText: 'Delete all' })).toHaveCount(0);
  });

  test('lo descargado aparece agrupado por tema, con su rango de elo y cuántos ejercicios trae', async ({ page }) => {
    await abrirConDescargas(page, [
      { tema: 'fork', desde: 1500 },
      { tema: 'fork', desde: 1520 },
      { tema: 'pin', desde: 1300 },
    ]);

    await expect(page.getByText('3 files', { exact: false }).first()).toBeVisible();
    await expect(grupos(page)).toHaveCount(2);
    await expect(grupos(page).filter({ hasText: '2 files' })).toHaveCount(1);
    await expect(grupos(page).filter({ hasText: '1 file' })).toHaveCount(1);

    // Cada grupo se despliega y enseña sus archivos por rango de elo
    const horquilla = grupos(page).filter({ hasText: '2 files' });
    await horquilla.locator('button').first().click();
    await expect(horquilla).toContainText('1500');
    await expect(horquilla).toContainText('1520');
    await expect(horquilla).toContainText('3 exercises');
    // La interfaz nunca enseña una URL
    await expect(page.locator('app-storage')).not.toContainText('jsdelivr');
    await expect(page.locator('app-storage')).not.toContainText('.json');

    // Y "Ajustes" resume lo mismo
    await page.goto('/settings');
    await expect(page.getByText(/^\s*3 files/)).toBeVisible();
  });

  test('la lista de descargas desplegada se ve como la referencia', async ({ page }) => {
    await abrirConDescargas(page, [
      { tema: 'fork', desde: 1500 },
      { tema: 'fork', desde: 1520 },
      { tema: 'pin', desde: 1300 },
    ]);
    await expect(grupos(page)).toHaveCount(2);
    await grupos(page).filter({ hasText: '2 files' }).locator('button').first().click();
    await expect(grupos(page).filter({ hasText: '2 files' })).toContainText('1520');

    await expect(page.locator('app-storage .container')).toHaveScreenshot('descargas-desplegadas.png');
  });

  test('borrar un archivo pide confirmación; cancelar no borra y confirmar lo quita de IndexedDB', async ({ page }) => {
    await abrirConDescargas(page, [
      { tema: 'fork', desde: 1500 },
      { tema: 'fork', desde: 1520 },
    ]);
    await expect(grupos(page)).toHaveCount(1);
    expect(await contarDescargas(page)).toEqual([2, 2]);
    await grupos(page).first().locator('button').first().click();
    const botonArchivo = grupos(page).first().locator('ul button[aria-label^="Delete the"]');
    await expect(botonArchivo).toHaveCount(2);

    // Cancelar: todo sigue igual
    await botonArchivo.first().click();
    await expect(aviso(page)).toContainText('Delete this file?');
    await aviso(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(aviso(page)).toHaveCount(0);
    await expect(botonArchivo).toHaveCount(2);
    expect(await contarDescargas(page)).toEqual([2, 2]);

    // Confirmar: queda un archivo, en la lista y en IndexedDB
    await botonArchivo.first().click();
    await aviso(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(aviso(page)).toHaveCount(0);
    await expect(botonArchivo).toHaveCount(1);
    await expect(grupos(page).first()).toContainText('1 file');
    expect(await contarDescargas(page)).toEqual([1, 1]);
  });

  test('borrar un tema entero quita todos sus archivos y deja los demás', async ({ page }) => {
    await abrirConDescargas(page, [
      { tema: 'fork', desde: 1500 },
      { tema: 'fork', desde: 1520 },
      { tema: 'pin', desde: 1300 },
    ]);
    await expect(grupos(page)).toHaveCount(2);
    const horquilla = grupos(page).filter({ hasText: '2 files' });

    // La papelera del tema dice qué borra (no «Delete all», que es el botón de toda la lista)
    await horquilla.locator('button[aria-label^="Delete "]:not([aria-label^="Delete the"])').first().click();
    await expect(aviso(page)).toContainText('2 files');
    await aviso(page).getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(grupos(page)).toHaveCount(1);
    await expect(grupos(page).first()).toContainText('1 file');
    expect(await contarDescargas(page)).toEqual([1, 1]);
  });

  test('"Delete all" vacía todo, avisa de que el progreso se conserva y vuelve al estado vacío', async ({ page }) => {
    await abrirConDescargas(page, [
      { tema: 'fork', desde: 1500 },
      { tema: 'pin', desde: 1300 },
      { tema: 'mateIn2', desde: 1100 },
    ]);
    await expect(grupos(page)).toHaveCount(3);

    await page.locator('app-storage button.btn-outline', { hasText: 'Delete all' }).click();
    await expect(aviso(page)).toContainText('Delete everything?');
    await expect(aviso(page)).toContainText("You won't lose your progress or your ELO.");
    await aviso(page).getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByText('You have no downloaded exercises.', { exact: false })).toBeVisible();
    await expect(grupos(page)).toHaveCount(0);
    expect(await contarDescargas(page)).toEqual([0, 0]);

    // Y Ajustes ya no cuenta archivos
    await page.goto('/settings');
    await expect(page.getByText(/^\s*0 files/)).toBeVisible();
  });

  test('lo que la app descarga sola al entrenar aparece en la lista', async ({ page }) => {
    // La racha pide archivos de puzzles al CDN y los deja en IndexedDB
    await page.goto('/streak');
    await expect(page.getByText('Exercise rating')).toBeVisible();
    await expect.poll(async () => (await contarDescargas(page))[0]).toBeGreaterThan(0);
    const [archivos] = await contarDescargas(page);

    await page.goto('/settings/storage');

    await expect(page.locator('app-storage button.btn-outline', { hasText: 'Delete all' })).toBeVisible();
    await expect(page.getByText(/\d+ files? ·/).first()).toBeVisible();
    expect(await grupos(page).count()).toBeGreaterThan(0);
    expect((await contarDescargas(page))[0]).toBeGreaterThanOrEqual(archivos);
  });
});
