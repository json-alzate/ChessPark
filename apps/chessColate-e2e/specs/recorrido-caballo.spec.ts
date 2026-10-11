import type { Page } from '@playwright/test';

import { clicEnCasilla } from '../support/resto-tablero';
import { expect, test } from '../support/resto-test';

// Margen para máquinas cargadas: la app es pesada en frío y varias suites comparten CPU.
test.describe.configure({ timeout: 60_000 });

/**
 * Recorrido del caballo (/knight-tour): visitar las 64 casillas con saltos de caballo,
 * sin repetir. El juego arranca solo con el primer movimiento y termina al completar
 * el tablero o al quedarse sin saltos posibles.
 */

const DIRS = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const nombre = (c: number, f: number) => 'abcdefgh'[c] + (f + 1);
const coords = (s: string): [number, number] => ['abcdefgh'.indexOf(s[0]), Number(s[1]) - 1];

function vecinas(c: number, f: number, visitadas: Set<string>): [number, number][] {
  return DIRS.map(([a, b]) => [c + a, f + b] as [number, number]).filter(
    ([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8 && !visitadas.has(nombre(x, y))
  );
}

/** Recorrido completo por la regla de Warnsdorff (siempre la casilla con menos salidas). */
function recorridoCompleto(inicio: string): string[] {
  let [c, f] = coords(inicio);
  // Se localiza por texto y no por rol: tras elegir la salida en ajustes (select + modal) Ionic deja
// un instante `aria-hidden` en el contenedor y el árbol de accesibilidad no ve el botón.
const reiniciar = (page: Page) => page.locator('app-knight-tour button', { hasText: 'Restart' });
const visitadas = new Set([inicio]);
  const camino = [inicio];
  for (;;) {
    const opciones = vecinas(c, f, visitadas).sort(
      (p, q) => vecinas(p[0], p[1], visitadas).length - vecinas(q[0], q[1], visitadas).length
    );
    if (!opciones.length) return camino;
    [c, f] = opciones[0];
    visitadas.add(nombre(c, f));
    camino.push(nombre(c, f));
  }
}

/** Un recorrido que se atasca a mitad de tablero (calculado a mano: ver `recorridoCompleto`). */
const RECORRIDO_SIN_SALIDA = [
  'a1', 'c2', 'e3', 'f1', 'd2', 'b3', 'c1', 'a2', 'c3', 'd5', 'c7', 'e6', 'g7', 'e8', 'f6',
  'h5', 'g3', 'h1', 'f2', 'e4', 'd6', 'b7', 'd8', 'c6', 'b4', 'd3', 'c5', 'd7', 'b8', 'a6',
];

const caballo = (page: Page) => page.locator('lib-board g[data-piece="wn"]');
const posicionDelCaballo = (page: Page) => caballo(page).getAttribute('data-square');
// Se localiza por texto y no por rol: tras elegir la salida en ajustes (select + modal) Ionic deja
// un instante `aria-hidden` en el contenedor y el árbol de accesibilidad no ve el botón.
const reiniciar = (page: Page) => page.locator('app-knight-tour button', { hasText: 'Restart' });
const visitadas = (page: Page) => page.locator('app-knight-tour .card h3', { hasText: '/ 64' }).first();

/** Fija la casilla de salida desde los ajustes (el caballo sale de una esquina). */
async function elegirSalida(page: Page, casilla: 'a1' | 'h1' | 'a8' | 'h8') {
  await page.locator('#kt-settings-trigger').click();
  const ajustes = page.locator('ion-modal.kt-settings-modal');
  await expect(ajustes).toBeVisible();
  await ajustes.locator('ion-select').click();
  await page.locator('ion-popover').getByText(casilla, { exact: true }).click();
  await expect(caballo(page)).toHaveAttribute('data-square', casilla);
  await ajustes.locator('ion-button').click();
  await expect(ajustes).toBeHidden();
}

async function abrir(page: Page, salida: 'a1' | 'h1' | 'a8' | 'h8' = 'a1') {
  await page.goto('/knight-tour');
  await expect(caballo(page)).toHaveCount(1);
  await elegirSalida(page, salida);
  await expect(visitadas(page)).toContainText('1');
}

/** Mueve el caballo a `destino` y espera a que el tablero lo refleje. */
async function saltarA(page: Page, destino: string) {
  await clicEnCasilla(page, 'lib-board', destino);
  await expect(caballo(page)).toHaveAttribute('data-square', destino);
}

test.describe('Recorrido del caballo', () => {
  test('al abrir hay un caballo en el tablero, 1 casilla visitada y las instrucciones', async ({ page }) => {
    await page.goto('/knight-tour');

    await expect(page.getByRole('heading', { name: 'Knight tour' })).toBeVisible();
    await expect(caballo(page)).toHaveCount(1);
    // Todo el tablero sin otras piezas
    await expect(page.locator('lib-board g[data-piece]')).toHaveCount(1);
    await expect(visitadas(page)).toHaveText(/^\s*1\s*\/ 64\s*$/);
    await expect(page.getByText('Ready to start!')).toBeVisible();
    await expect(page.getByText('Complete all 64 squares to win')).toBeVisible();
    await expect(reiniciar(page)).toHaveCount(0);
  });

  test('se puede elegir la casilla de salida en los ajustes', async ({ page }) => {
    await page.goto('/knight-tour');
    await elegirSalida(page, 'h8');
    await expect(visitadas(page)).toContainText('1');
    await elegirSalida(page, 'a1');
    expect(await posicionDelCaballo(page)).toBe('a1');
  });

  test('al tocar el caballo muestra sus saltos posibles y tocar otra vez los quita', async ({ page }) => {
    await abrir(page, 'a1');
    const puntos = page.locator('lib-board use.marker-dot-green');

    await clicEnCasilla(page, 'lib-board', 'a1');
    // Desde a1 solo hay dos saltos: b3 y c2
    await expect(puntos).toHaveCount(2);

    await clicEnCasilla(page, 'lib-board', 'a1');
    await expect(puntos).toHaveCount(0);
    // Ver los saltos no empieza la partida
    await expect(page.getByText('Ready to start!')).toBeVisible();
  });

  test('un salto de caballo mueve la pieza y empieza la partida; uno ilegal se ignora', async ({ page }) => {
    await abrir(page, 'a1');

    // Un movimiento que no es de caballo no hace nada
    await clicEnCasilla(page, 'lib-board', 'a3');
    await clicEnCasilla(page, 'lib-board', 'h8');
    expect(await posicionDelCaballo(page)).toBe('a1');
    await expect(visitadas(page)).toContainText('1');
    await expect(page.getByText('Ready to start!')).toBeVisible();

    await saltarA(page, 'b3');
    await expect(visitadas(page)).toHaveText(/^\s*2\s*\/ 64\s*$/);
    await expect(page.getByText('Ready to start!')).toHaveCount(0);
    await expect(reiniciar(page)).toBeVisible();

    // No se puede volver a una casilla visitada: a1 sigue siendo de caballo desde b3
    await clicEnCasilla(page, 'lib-board', 'a1');
    expect(await posicionDelCaballo(page)).toBe('b3');
    await expect(visitadas(page)).toContainText('2');

    // Y las casillas visitadas quedan marcadas
    await expect(page.locator('lib-board use.marker-square-green').first()).toBeAttached();
  });

  test('tras tres saltos el recorrido se ve como la referencia', async ({ page }) => {
    await abrir(page, 'a1');
    await saltarA(page, 'b3');
    await saltarA(page, 'd4');
    await saltarA(page, 'f5');
    await expect(visitadas(page)).toContainText('4');
    // Las casillas visitadas se marcan unos instantes después de cada salto
    await expect(page.locator('lib-board use.marker-square-green')).toHaveCount(4);

    await expect(page.locator('lib-board')).toHaveScreenshot('tres-saltos.png');
  });

  test('"Restart" vuelve al principio', async ({ page }) => {
    await abrir(page, 'a1');
    await saltarA(page, 'b3');
    await saltarA(page, 'd4');
    await expect(visitadas(page)).toContainText('3');

    await reiniciar(page).click();

    await expect(visitadas(page)).toHaveText(/^\s*1\s*\/ 64\s*$/);
    await expect(page.getByText('Ready to start!')).toBeVisible();
    await expect(reiniciar(page)).toHaveCount(0);
    await expect(caballo(page)).toHaveCount(1);
  });

  test('recorrer las 64 casillas completa el reto', async ({ page }) => {
    test.setTimeout(90_000);
    const camino = recorridoCompleto('a1');
    expect(camino, 'el recorrido de prueba debe cubrir el tablero').toHaveLength(64);

    await abrir(page, 'a1');
    for (const casilla of camino.slice(1)) {
      await saltarA(page, casilla);
    }

    await expect(page.locator('app-knight-tour h3', { hasText: 'Congratulations!' })).toBeVisible();
    await expect(page.getByText('You have completed the knight tour')).toBeVisible();
    await expect(visitadas(page)).toHaveText(/^\s*64\s*\/ 64\s*$/);
    // Con el reto completo el tablero ya no acepta más saltos
    await clicEnCasilla(page, 'lib-board', camino[0]);
    expect(await posicionDelCaballo(page)).toBe(camino[63]);

    // Se puede volver a empezar
    await reiniciar(page).click();
    await expect(page.locator('app-knight-tour h3', { hasText: 'Congratulations!' })).toHaveCount(0);
    await expect(visitadas(page)).toHaveText(/^\s*1\s*\/ 64\s*$/);
  });

  test('quedarse sin saltos posibles termina la partida con un aviso y permite reiniciar', async ({ page }) => {
    await abrir(page, 'a1');
    for (const casilla of RECORRIDO_SIN_SALIDA.slice(1)) {
      await saltarA(page, casilla);
    }

    const aviso = page.locator('ion-alert');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Game Over');
    await expect(aviso).toContainText(`Casillas visitadas: ${RECORRIDO_SIN_SALIDA.length} / 64`);
    await expect(visitadas(page)).toHaveText(new RegExp(`^\\s*${RECORRIDO_SIN_SALIDA.length}\\s*/ 64\\s*$`));

    await aviso.getByRole('button', { name: 'Reiniciar' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(visitadas(page)).toHaveText(/^\s*1\s*\/ 64\s*$/);
    await expect(page.getByText('Ready to start!')).toBeVisible();
  });
});
