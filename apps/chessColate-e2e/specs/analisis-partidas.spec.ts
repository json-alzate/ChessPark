import type { Page } from '@playwright/test';

import {
  mesesGuardados,
  partidasGuardadas,
  RESUMEN_CHESS_COM,
  RESUMEN_LICHESS,
  simularChessCom,
  simularLichess,
  USUARIO_CHESS_COM,
  USUARIO_LICHESS,
} from '../support/resto-partidas';
import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Análisis de partidas (/analytics) en modo invitado. Se conecta una cuenta de chess.com y/o
 * de lichess y la app descarga sus partidas públicas. Las APIs se simulan con `page.route`
 * (ver support/resto-partidas.ts): URLs reales de libs/chess-com-provider y
 * libs/lichess-provider, partidas PGN válidas y una variante/partida abortada que se
 * debe descartar.
 *
 * El reloj de la prueba está fijado el 2026-10-10, así que "3 meses" son agosto, septiembre
 * y octubre de 2026.
 */

const CLAVE_AJUSTES = 'chessColate_game_analytics';

const campo = (page: Page, plataforma: 'Chess.com' | 'Lichess') =>
  page.locator('app-analytics label', { hasText: plataforma }).locator('input');
const analizar = (page: Page) => page.getByRole('button', { name: 'Analyse my games' });
const descargando = (page: Page) => page.getByText('Downloading your games…');
const cifra = (page: Page, titulo: string) =>
  page.locator('app-analytics div.bg-base-200\\/40', { hasText: titulo }).first();
const pestana = (page: Page, nombre: string | RegExp) =>
  page.locator('app-analytics .join button', { hasText: nombre }).first();
const ajustesGuardados = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), CLAVE_AJUSTES);

/** Escribe las cuentas, elige 3 meses y descarga. Espera a que acabe la descarga. */
async function conectar(page: Page, cuentas: { chesscom?: string; lichess?: string }) {
  await page.goto('/analytics');
  if (cuentas.chesscom) await campo(page, 'Chess.com').fill(cuentas.chesscom);
  if (cuentas.lichess) await campo(page, 'Lichess').fill(cuentas.lichess);
  await page.getByRole('button', { name: '3 months' }).click();
  await analizar(page).click();
  await expect(page.getByText('Games', { exact: true }).first()).toBeVisible({ timeout: 45_000 });
  await expect(descargando(page)).toBeHidden({ timeout: 45_000 });
}

test.describe('Análisis de partidas', () => {
  test.describe.configure({ timeout: 120_000 });

  test('sin cuentas muestra el formulario para conectar, sin pedir contraseña', async ({ page }) => {
    await page.goto('/analytics');

    await expect(page.getByRole('heading', { name: 'Analysis of my games' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Connect your account' })).toBeVisible();
    await expect(campo(page, 'Chess.com')).toBeVisible();
    await expect(campo(page, 'Lichess')).toBeVisible();
    await expect(page.locator('app-analytics input[type="password"]')).toHaveCount(0);
    // Sin ningún nombre escrito no se puede analizar
    await expect(analizar(page)).toBeDisabled();
    await expect(page.getByText('Nothing is uploaded to any server.', { exact: false })).toBeVisible();
    // Por defecto el historial es de 6 meses
    await expect(page.getByRole('button', { name: '6 months' })).toHaveClass(/btn-primary/);
    await campo(page, 'Lichess').fill('alguien');
    await expect(analizar(page)).toBeEnabled();
  });

  test('conectar chess.com descarga solo los meses con partidas dentro del rango y calcula el resumen', async ({ page }) => {
    const pedidas = await simularChessCom(page);
    await conectar(page, { chesscom: USUARIO_CHESS_COM });

    // Solo se piden los meses con partidas Y dentro de 3 meses (no el 2025/12 que existe en el archivo)
    const meses = pedidas.filter((p) => /\/games\/\d{4}\/\d{2}$/.test(p)).map((p) => p.slice(-7));
    expect(meses.sort()).toEqual(RESUMEN_CHESS_COM.mesesPedidos);
    expect(pedidas[0]).toBe(`/pub/player/${USUARIO_CHESS_COM}`);

    // La variante (chess960) se descarta: quedan 3 partidas
    await expect(cifra(page, 'Games')).toContainText(String(RESUMEN_CHESS_COM.partidas));
    await expect(cifra(page, 'Score')).toContainText(`${RESUMEN_CHESS_COM.puntuacion}%`);
    await expect(cifra(page, 'W / D / L')).toHaveText(/1\s*\/\s*1\s*\/\s*1/);
    await expect(cifra(page, 'Avg. opponent')).toContainText(String(RESUMEN_CHESS_COM.rivalMedio));
    await expect(pestana(page, /Games \(/)).toContainText(`(${RESUMEN_CHESS_COM.partidas})`);
    // Con una sola plataforma no hay filtro de plataforma
    await expect(page.getByRole('button', { name: 'Lichess', exact: true })).toHaveCount(0);
    // Con blancas y con negras
    await expect(page.getByText('2 games')).toBeVisible();
    await expect(page.getByText('1 games')).toBeVisible();
  });

  test('conectar lichess descarga mes a mes, descarta variantes y abortadas y calcula el resumen', async ({ page }) => {
    const pedidas = await simularLichess(page);
    await conectar(page, { lichess: USUARIO_LICHESS });

    // Una petición por mes (agosto, septiembre, octubre), con el intervalo exacto de cada mes
    const descargas = pedidas.filter((p) => p.startsWith('/api/games/user/'));
    expect(descargas).toHaveLength(3);
    expect(descargas[0]).toContain('pgnInJson=true');
    expect(descargas[0]).toContain('clocks=true');

    await expect(cifra(page, 'Games')).toContainText(String(RESUMEN_LICHESS.partidas));
    await expect(cifra(page, 'Score')).toContainText(`${RESUMEN_LICHESS.puntuacion}%`);
    await expect(cifra(page, 'W / D / L')).toHaveText(/1\s*\/\s*1\s*\/\s*1/);
    await expect(cifra(page, 'Avg. opponent')).toContainText(String(RESUMEN_LICHESS.rivalMedio));
  });

  test('con las dos plataformas se juntan las partidas y el filtro por plataforma las separa', async ({ page }) => {
    await simularChessCom(page);
    await simularLichess(page);
    await conectar(page, { chesscom: USUARIO_CHESS_COM, lichess: USUARIO_LICHESS });

    await expect(cifra(page, 'Games')).toContainText('6');
    await expect(cifra(page, 'W / D / L')).toHaveText(/2\s*\/\s*2\s*\/\s*2/);
    await expect(pestana(page, /Games \(/)).toContainText('(6)');

    const filtro = page.locator('app-analytics section', { hasText: 'Filters' }).first();
    await filtro.getByRole('button', { name: 'Lichess', exact: true }).click();
    await expect(cifra(page, 'Games')).toContainText('3');
    await expect(cifra(page, 'Avg. opponent')).toContainText(String(RESUMEN_LICHESS.rivalMedio));
    await expect(pestana(page, /Games \(/)).toContainText('(3)');

    await filtro.getByRole('button', { name: 'Chess.com', exact: true }).click();
    await expect(cifra(page, 'Avg. opponent')).toContainText(String(RESUMEN_CHESS_COM.rivalMedio));
    await expect(pestana(page, /Games \(/)).toContainText('(3)');

    await filtro.getByRole('button', { name: 'All', exact: true }).click();
    await expect(pestana(page, /Games \(/)).toContainText('(6)');

    // Por ritmo de juego: 4 de las 6 son blitz y 2 son rápidas (una por plataforma)
    await filtro.getByRole('button', { name: 'Rapid', exact: true }).click();
    await expect(pestana(page, /Games \(/)).toContainText('(2)');
  });

  test('la lista de partidas va de la más reciente a la más antigua con rival, resultado y apertura', async ({ page }) => {
    await simularChessCom(page);
    await simularLichess(page);
    await conectar(page, { chesscom: USUARIO_CHESS_COM, lichess: USUARIO_LICHESS });

    await pestana(page, /Games \(/).click();

    const filas = page.locator('app-analytics ul.divide-y > li');
    await expect(filas).toHaveCount(6);
    // De más nueva a más antigua: 6 oct, 5 oct, 20 sep, 12 sep, 3 sep, 20 ago
    const orden = ['li_rival1', 'rival_uno', 'rival_tres', 'rival_dos', 'li_rival3', 'li_rival2'];
    for (const [i, rival] of orden.entries()) {
      await expect(filas.nth(i)).toContainText(`vs ${rival}`);
    }
    await expect(filas.nth(0)).toContainText('Won');
    await expect(filas.nth(0)).toContainText('Lichess');
    await expect(filas.nth(0)).toContainText('Bird Opening');
    await expect(filas.nth(1)).toContainText('Won');
    await expect(filas.nth(1)).toContainText('Chess.com');
    await expect(filas.nth(2)).toContainText('Draw');
    await expect(filas.nth(3)).toContainText('Lost');
    await expect(filas.nth(5)).toContainText('Lost');
    // El rating del rival entre paréntesis
    await expect(filas.nth(1)).toContainText('(1250)');
  });

  test('las partidas se guardan en el dispositivo: al recargar salen sin volver a pedir los meses', async ({ page }) => {
    const pedidas = await simularChessCom(page);
    await conectar(page, { chesscom: USUARIO_CHESS_COM });

    // Guardado: ajustes en localStorage y los meses (con sus partidas) en IndexedDB
    const ajustes = await ajustesGuardados(page);
    expect(ajustes).toMatchObject({ accounts: { chesscom: USUARIO_CHESS_COM, lichess: '' }, historyMonths: 3 });
    expect(await mesesGuardados(page)).toEqual([
      `chess.com:${USUARIO_CHESS_COM}:2026-09`,
      `chess.com:${USUARIO_CHESS_COM}:2026-10`,
    ]);
    // 2 de septiembre y 1 de octubre (la variante no se guarda)
    expect(await partidasGuardadas(page)).toBe(3);

    const mesesAntes = pedidas.filter((p) => /\/games\/\d{4}\/\d{2}$/.test(p)).length;
    await page.reload();

    await expect(cifra(page, 'Games')).toContainText('3');
    await expect(cifra(page, 'W / D / L')).toHaveText(/1\s*\/\s*1\s*\/\s*1/);
    // Ya no se pide ningún mes: salen del dispositivo
    await expect(descargando(page)).toBeHidden();
    expect(pedidas.filter((p) => /\/games\/\d{4}\/\d{2}$/.test(p)).length).toBe(mesesAntes);
    // Y el formulario de conexión no vuelve a salir
    await expect(page.getByRole('heading', { name: 'Connect your account' })).toHaveCount(0);
  });

  test('un usuario de chess.com que no existe avisa y no guarda nada', async ({ page }) => {
    const pedidas = await simularChessCom(page);
    await page.goto('/analytics');
    await campo(page, 'Chess.com').fill('no_existe_123');
    await analizar(page).click();

    const aviso = page.locator('ion-alert');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('User not found');
    await expect(aviso).toContainText('Chess.com does not know that user. Check the spelling.');
    await aviso.getByRole('button', { name: 'Close' }).click();
    await expect(aviso).toBeHidden();

    // Sigue en el formulario, sin cuentas guardadas y sin haber descargado partidas
    await expect(page.getByRole('heading', { name: 'Connect your account' })).toBeVisible();
    expect(await ajustesGuardados(page)).toBeNull();
    expect(pedidas.filter((p) => p.includes('/games/'))).toEqual([]);
    expect(await mesesGuardados(page)).toEqual([]);
  });

  test('un usuario de lichess que no existe avisa y no guarda nada', async ({ page }) => {
    const pedidas = await simularLichess(page);
    await page.goto('/analytics');
    await campo(page, 'Lichess').fill('no_existe_123');
    await analizar(page).click();

    const aviso = page.locator('ion-alert');
    await expect(aviso).toContainText('User not found');
    await expect(aviso).toContainText('Lichess does not know that user. Check the spelling.');
    await aviso.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('heading', { name: 'Connect your account' })).toBeVisible();
    expect(await ajustesGuardados(page)).toBeNull();
    expect(pedidas.filter((p) => p.startsWith('/api/games/'))).toEqual([]);
  });

  test('si una de las dos cuentas no existe no se conecta ninguna', async ({ page }) => {
    await simularChessCom(page);
    const lichess = await simularLichess(page);
    await page.goto('/analytics');
    await campo(page, 'Chess.com').fill(USUARIO_CHESS_COM);
    await campo(page, 'Lichess').fill('no_existe_123');
    await analizar(page).click();

    await expect(page.locator('ion-alert')).toContainText('Lichess does not know that user.');
    await page.locator('ion-alert').getByRole('button', { name: 'Close' }).click();
    expect(await ajustesGuardados(page)).toBeNull();
    expect(lichess.filter((p) => p.startsWith('/api/games/'))).toEqual([]);
  });

  test('si el perfil existe pero chess.com no tiene su archivo, se muestra el error', async ({ page }) => {
    await simularChessCom(page, { sinArchivo: true });
    await page.goto('/analytics');
    await campo(page, 'Chess.com').fill(USUARIO_CHESS_COM);
    await analizar(page).click();

    await expect(page.getByText('Chess.com does not know that user. Check the spelling.')).toBeVisible();
    await expect(descargando(page)).toBeHidden();
  });

  test('si falla un mes, el resto de la descarga se conserva', async ({ page }) => {
    await simularChessCom(page, { mesConError: '2026/10' });
    await conectar(page, { chesscom: USUARIO_CHESS_COM });

    // Septiembre llegó (2 partidas); octubre falló (1 partida perdida)
    await expect(cifra(page, 'Games')).toContainText('2');
    expect(await mesesGuardados(page)).toEqual([`chess.com:${USUARIO_CHESS_COM}:2026-09`]);
  });

  test('desconectar una cuenta pide confirmación, borra sus partidas del dispositivo y vuelve al formulario', async ({ page }) => {
    await simularChessCom(page);
    await conectar(page, { chesscom: USUARIO_CHESS_COM });
    expect(await partidasGuardadas(page)).toBe(3);

    await page.locator('app-analytics details summary').click();
    await page.getByRole('button', { name: 'Disconnect' }).click();
    const aviso = page.locator('ion-alert');
    await expect(aviso).toContainText('Disconnect this account?');
    await expect(aviso).toContainText(`${USUARIO_CHESS_COM}'s games on Chess.com`);

    // Cancelar no toca nada
    await aviso.getByRole('button', { name: 'Cancel' }).click();
    await expect(aviso).toBeHidden();
    expect(await partidasGuardadas(page)).toBe(3);

    await page.getByRole('button', { name: 'Disconnect' }).click();
    await aviso.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Connect your account' })).toBeVisible();
    expect(await partidasGuardadas(page)).toBe(0);
    expect(await ajustesGuardados(page)).toMatchObject({ accounts: { chesscom: '', lichess: '' } });
  });

  test('Almacenamiento lista el archivo de cada cuenta y permite borrarlo desde ahí', async ({ page }) => {
    await simularChessCom(page);
    await simularLichess(page);
    await conectar(page, { chesscom: USUARIO_CHESS_COM, lichess: USUARIO_LICHESS });

    await page.goto('/settings/storage');
    const cuentas = page.locator('app-storage section', { hasText: 'Analysis of my games' });
    await expect(cuentas).toContainText(USUARIO_CHESS_COM);
    await expect(cuentas).toContainText(USUARIO_LICHESS);
    await expect(cuentas).toContainText('Chess.com · 3 games');
    await expect(cuentas).toContainText('Lichess · 3 games');

    await cuentas.locator('li', { hasText: USUARIO_LICHESS }).getByRole('button', { name: 'Disconnect' }).click();
    await page.locator('ion-alert').getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(cuentas).not.toContainText(USUARIO_LICHESS);
    await expect(cuentas).toContainText(USUARIO_CHESS_COM);
    expect(await mesesGuardados(page)).toEqual([
      `chess.com:${USUARIO_CHESS_COM}:2026-09`,
      `chess.com:${USUARIO_CHESS_COM}:2026-10`,
    ]);
    // Y la cuenta quedó desconectada en los ajustes del análisis
    expect(await ajustesGuardados(page)).toMatchObject({ accounts: { chesscom: USUARIO_CHESS_COM, lichess: '' } });
  });
});
