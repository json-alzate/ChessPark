import type { Page } from '@playwright/test';

import { expect, test } from '../support/test';
import {
  abrirHome,
  avanzarHastaUrl,
  capturarErrores,
  elegirRutina,
  empezarBloque,
  esperarPuzzleListo,
  historialGuardado,
  llevarBloqueAlFinal,
  modalAbierto,
  pantalla,
  relojAcelerable,
  relojDelBloque,
  resolverPuzzle,
  resumenDePuzzles,
  aSegundos,
} from '../support/rut-helpers';

/**
 * Terminar una rutina completa (modo invitado): resumen en /puzzles/plan-played, la rutina
 * guardada en localStorage (`chessColate_plans_history`) y visible en /puzzles/plans-history.
 *
 * Se usa Bullet (1 bloque de 1 minuto) y, para ver el cambio de bloque, Blitz+ (2 bloques de
 * 2,5 minutos). El minuto se salta con el reloj falso. Mientras se salta el tiempo, los
 * puzzles que nadie juega se agotan solos (fallo por tiempo): por eso el total de puzzles
 * guardados no es fijo y las pruebas lo comparan con lo que quedó guardado.
 */
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await relojAcelerable(page);
});

/** Juega Bullet: resuelve `aciertos` puzzles, deja pasar el minuto y llega al resumen. */
async function terminarBullet(page: Page, aciertos: number): Promise<void> {
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  let puzzle = await esperarPuzzleListo(page);
  for (let i = 0; i < aciertos; i++) {
    await resolverPuzzle(page, puzzle);
    puzzle = await esperarPuzzleListo(page, puzzle.marca);
  }
  await avanzarHastaUrl(page, '/puzzles/plan-played');
}

test('terminar Bullet lleva al resumen y deja la rutina guardada en localStorage', async ({ page, network }) => {
  const errores = capturarErrores(page);
  await terminarBullet(page, 2);

  // Resumen de la rutina
  const resumen = pantalla(page);
  await expect(resumen.getByRole('heading', { name: 'Exercises played' })).toBeVisible();
  await expect(resumen.getByRole('button', { name: 'Repeat session' })).toBeVisible();
  await expect(resumen.locator('.collapse-title').first()).toContainText('Short Exercise');

  // Lo guardado en el dispositivo
  const guardados = await historialGuardado(page);
  expect(guardados).toHaveLength(1);
  const [plan] = guardados;
  expect(plan).toMatchObject({ planType: 'plan1', isFinished: true });
  expect(typeof plan.uid).toBe('string');
  expect(typeof plan.createdAt).toBe('number');
  expect(plan.blocks).toHaveLength(1);
  expect(plan.blocks[0]).toMatchObject({ time: 60, theme: 'short' });
  const { total, resueltos, porTiempo } = resumenDePuzzles(plan);
  expect(resueltos).toBe(2);
  expect(total).toBeGreaterThan(2);
  // Todo lo que no se jugó se agotó por tiempo mientras se saltaba el minuto
  expect(porTiempo).toBe(total - resueltos);
  // Cada puzzle guardado conserva con qué se jugó
  expect(plan.blocks[0].puzzlesPlayed[0]).toMatchObject({ resolved: true, failByTime: false });
  expect(plan.blocks[0].puzzlesPlayed[0].fenStartUserPuzzle).toEqual(expect.any(String));

  // El resumen muestra los mismos puzzles que se guardaron
  await expect(resumen.locator('.collapse-title .badge')).toHaveText(String(total));
  // Sin sesión no se ve el elo ni las estadísticas: se pide iniciar sesión
  await expect(resumen.getByText('Log in to see your ELO')).toBeVisible();
  await expect(resumen.getByText('Sign in to view your statistics')).toBeVisible();

  expect(errores).toEqual([]);
  expect(network.blocked).toEqual([]);
});

test('la rutina terminada aparece en el historial y se puede abrir desde ahí', async ({ page }) => {
  await terminarBullet(page, 2);
  const [plan] = await historialGuardado(page);
  const { total, resueltos } = resumenDePuzzles(plan);

  // El historial vive en localStorage: sobrevive a recargar la app
  await page.goto('/puzzles/plans-history');
  const historial = pantalla(page);
  await expect(historial.getByRole('heading', { name: 'History' })).toBeVisible();
  const tarjeta = historial.locator('.card', { hasText: 'View blocks' }).first();
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText('01:00'); // el minuto del bloque
  await expect(tarjeta).toContainText(`${total} Exercises`);
  await expect(tarjeta).toContainText(`${Math.round((resueltos / total) * 100)}%`);
  await expect(historial).toContainText('Today');

  // Abrir el detalle muestra el resumen de esa rutina, con camino de vuelta al historial
  await tarjeta.getByRole('button', { name: 'View details' }).click();
  await expect(page).toHaveURL(new RegExp(`/puzzles/plan-played\\?uid=${plan.uid}$`));
  await expect(pantalla(page).getByRole('heading', { name: 'Exercises played' })).toBeVisible();
  await expect(pantalla(page).locator('.collapse-title .badge')).toHaveText(String(total));
  await pantalla(page).locator('.breadcrumbs').getByText('History').click();
  await expect(page).toHaveURL(/\/puzzles\/plans-history$/);
});

test('"Repeat session" del resumen empieza otra rutina igual y las dos quedan en el historial', async ({ page }) => {
  await terminarBullet(page, 1);
  const [primera] = await historialGuardado(page);

  await pantalla(page).getByRole('button', { name: 'Repeat session' }).click();
  await expect(page).toHaveURL(/\/puzzles\/training$/);
  await expect(modalAbierto(page)).toBeVisible();
  await expect(modalAbierto(page).getByRole('heading')).toHaveText(/^Short Exercise with (White|Black)$/);
  await empezarBloque(page);
  await esperarPuzzleListo(page);
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(50);
  // Mientras se juega la segunda no se toca lo guardado de la primera
  expect(await historialGuardado(page)).toHaveLength(1);

  await avanzarHastaUrl(page, '/puzzles/plan-played');
  const guardados = await historialGuardado(page);
  expect(guardados).toHaveLength(2);
  expect(new Set(guardados.map((p) => p.uid)).size).toBe(2);
  expect(guardados.map((p) => p.planType)).toEqual(['plan1', 'plan1']);
  expect(guardados.map((p) => p.uid)).toContain(primera.uid);

  await page.goto('/puzzles/plans-history');
  await expect(pantalla(page).locator('.card', { hasText: 'View blocks' })).toHaveCount(2);
});

test('desde el resumen se puede empezar otra rutina del menú ("3 min" = Blitz)', async ({ page }) => {
  await terminarBullet(page, 0);

  await pantalla(page).getByRole('button', { name: '3 min' }).click();
  await expect(page).toHaveURL(/\/puzzles\/training$/);
  await empezarBloque(page);
  await esperarPuzzleListo(page);
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(170);
  expect(aSegundos(await relojDelBloque(page))).toBeLessThanOrEqual(180);
});

test('una rutina de dos bloques (Blitz+) cambia de bloque al agotarse el tiempo y termina en el resumen', async ({ page }) => {
  const errores = capturarErrores(page);
  await abrirHome(page);
  await elegirRutina(page, 'Blitz+');
  const modal = modalAbierto(page);
  await expect(modal).toBeVisible();
  const primerBloque = (await modal.getByRole('heading').textContent())?.trim();
  await empezarBloque(page);
  let puzzle = await esperarPuzzleListo(page);
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(140); // 2:30

  await resolverPuzzle(page, puzzle);
  puzzle = await esperarPuzzleListo(page, puzzle.marca);

  // Se agota el primer bloque: aparece la presentación del segundo, que es distinta
  await llevarBloqueAlFinal(page);
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await expect(modal.getByRole('heading')).not.toHaveText(primerBloque ?? '');
  expect(await historialGuardado(page)).toEqual([]); // todavía no termina
  await empezarBloque(page);
  await esperarPuzzleListo(page);
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(140); // el reloj del segundo bloque arranca de nuevo

  // Se agota el segundo: fin de la rutina
  await llevarBloqueAlFinal(page);
  await expect(page).toHaveURL(/\/puzzles\/plan-played$/, { timeout: 15_000 });
  const [plan] = await historialGuardado(page);
  expect(plan).toMatchObject({ planType: 'plan5', isFinished: true });
  expect(plan.blocks).toHaveLength(2);
  expect(plan.blocks[0].puzzlesPlayed[0]).toMatchObject({ resolved: true });
  expect(plan.blocks[1].puzzlesPlayed.length).toBeGreaterThan(0);
  expect(plan.blocks[1].puzzlesPlayed.every((p: { resolved: boolean }) => !p.resolved)).toBe(true);
  // El resumen tiene un acordeón por bloque, cada uno con sus puzzles
  await expect(pantalla(page).locator('.collapse-title .badge')).toHaveText([
    String(plan.blocks[0].puzzlesPlayed.length),
    String(plan.blocks[1].puzzlesPlayed.length),
  ]);
  expect(errores).toEqual([]);
});
