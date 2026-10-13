import { Chess } from 'chess.js';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { PUZZLES } from './fixtures';
import { FIXED_NOW } from './test';

/**
 * Ayudas de las pruebas de entrenamiento por rutinas (prefijo `rut-`).
 *
 * Reloj: `support/test.ts` deja la fecha fija pero los temporizadores corren en
 * tiempo real. Una rutina de 1 minuto tardaría 1 minuto de verdad. `relojAcelerable`
 * instala el reloj falso de Playwright (que sigue avanzando solo, como el real) para
 * poder saltar con `page.clock.runFor(...)` los 60 s de un bloque.
 */

/** Puzzle tal como lo tiene el tablero de la pantalla activa. */
export interface PuzzleEnTablero {
  uid: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string[];
  /**
   * Identifica ESTA copia del puzzle. El uid solo no basta: los 3 puzzles de prueba se repiten
   * y a veces salen dos veces seguidas. La app le da a cada copia un `randomNumberQuery` propio.
   */
  marca: string;
}

/** Instalar ANTES de `page.goto`. La fecha arranca en la fecha fija y avanza sola. */
export async function relojAcelerable(page: Page): Promise<void> {
  await page.clock.install({ time: FIXED_NOW });
}

/** La pantalla (ion-page) visible. Ionic deja las anteriores en el DOM, ocultas. */
export function pantalla(page: Page): Locator {
  // Solo las pantallas del router: un ion-modal abierto también lleva un `.ion-page` dentro
  return page.locator('ion-router-outlet > .ion-page:not(.ion-page-hidden)').last();
}

/** Modal de Ionic abierto ahora (la presentación del bloque, la solución...). */
export function modalAbierto(page: Page): Locator {
  return page.locator('ion-modal.show-modal');
}

/** Alerta de Ionic abierta (confirmación de salir). */
export function alertaAbierta(page: Page): Locator {
  return page.locator('ion-alert');
}

/** Abre /home y espera a que el menú de rutinas esté listo. */
export async function abrirHome(page: Page): Promise<void> {
  await page.goto('/home');
  // El menú aparece cuando la app termina de iniciar la sesión (aquí: sin sesión); con la
  // máquina cargada puede tardar
  await expect(page.locator('swiper-slide').first()).toBeAttached({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Pulsa la tarjeta de la rutina por su título (Bullet, Blitz, Rapid...). El menú es un
 * slider y solo se ve una tarjeta: se lleva la deseada al centro, como haría un deslizamiento.
 */
export async function elegirRutina(page: Page, titulo: string): Promise<void> {
  // "Rapid" también está contenido en "Rapid+": se compara el título exacto de la tarjeta
  const tarjeta = page.locator('swiper-slide').filter({ has: page.getByText(titulo, { exact: true }) });
  const indice = await page
    .locator('swiper-slide')
    .evaluateAll(
      (slides, t) =>
        slides.findIndex((s) => (s.querySelector('div.font-bold.leading-tight')?.textContent ?? '').trim() === t),
      titulo
    );
  expect(indice, `tarjeta "${titulo}" en el menú`).toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => {
    (document.querySelector('swiper-container') as unknown as { swiper: { slideTo(i: number, ms: number): void } }).swiper.slideTo(
      i,
      0
    );
  }, indice);
  await expect(tarjeta).toBeInViewport({ ratio: 0.5 });
  await tarjeta.getByRole('button').first().click();
}

/** Espera la presentación del bloque y la salta con el botón Start. */
export async function empezarBloque(page: Page): Promise<void> {
  const modal = modalAbierto(page);
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: /Start/ }).click();
  await expect(modal).toHaveCount(0);
}

/** Tablero de puzzle de la pantalla activa. */
export function tablero(page: Page): Locator {
  return pantalla(page).locator('lib-board-puzzle .cm-chessboard');
}

/** Lee el puzzle que el tablero de la pantalla activa tiene cargado (build de desarrollo: `ng`). */
export async function puzzleActual(page: Page): Promise<PuzzleEnTablero | null> {
  return page.evaluate(() => {
    const paginas = Array.from(document.querySelectorAll('ion-router-outlet > .ion-page:not(.ion-page-hidden)'));
    const el = paginas[paginas.length - 1]?.querySelector('lib-board-puzzle');
    const ng = (window as unknown as { ng?: { getComponent(e: Element): any } }).ng;
    const p = el && ng ? ng.getComponent(el).puzzle : undefined;
    return p
      ? { uid: p.uid, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes, marca: `${p.uid}#${p.randomNumberQuery}` }
      : null;
  });
}

/**
 * Espera a que el tablero tenga un puzzle (distinto del indicado, si se pasa su `marca`) y a que
 * la primera jugada de la máquina ya esté hecha. Devuelve el puzzle.
 *
 * Pasar la marca del puzzle que se acaba de resolver es lo que permite esperar "el siguiente".
 */
export async function esperarPuzzleListo(page: Page, marcaAnterior?: string): Promise<PuzzleEnTablero> {
  let puzzle: PuzzleEnTablero | null = null;
  await expect
    .poll(
      async () => {
        puzzle = await puzzleActual(page);
        return !!puzzle && puzzle.marca !== marcaAnterior;
      },
      { message: 'el tablero debería tener un puzzle nuevo', timeout: 15_000 }
    )
    .toBe(true);
  const p = puzzle as unknown as PuzzleEnTablero;
  await esperarMaquina(page, p, 1);
  // El aviso "Iniciando..." (ion-loading) puede tardar en irse con el tablero ya a la vista, y
  // mientras esté ahí se come los clics: se espera a que desaparezca antes de dejar jugar
  await expect(page.locator('ion-loading')).toHaveCount(0);
  return p;
}

/** Centro de una casilla en coordenadas de la página. */
async function centroDe(page: Page, casilla: string): Promise<{ x: number; y: number }> {
  const rect = tablero(page).locator(`rect[data-square="${casilla}"]`);
  const caja = await rect.boundingBox();
  if (!caja) throw new Error(`la casilla ${casilla} no está visible`);
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

/**
 * Espera a que la máquina haya hecho su jugada `indice` de la solución (1 = la inicial, 3 = la
 * que sigue a la primera del usuario...). Mirar solo las piezas no basta: cuando el siguiente
 * puzzle es el mismo que el anterior, el tablero todavía muestra el final del anterior, donde la
 * casilla de origen ya está vacía. Por eso se consulta el estado del componente del tablero
 * (build de desarrollo: `ng`) y después se confirma en el dibujo.
 */
export async function esperarMaquina(page: Page, puzzle: PuzzleEnTablero, indice: number): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ idx, fen }) => {
            const paginas = Array.from(document.querySelectorAll('ion-router-outlet > .ion-page:not(.ion-page-hidden)'));
            const el = paginas[paginas.length - 1]?.querySelector('lib-board-puzzle');
            const ng = (window as unknown as { ng?: { getComponent(e: Element): any } }).ng;
            if (!el || !ng) return false;
            const c = ng.getComponent(el);
            return (
              c.puzzle?.fen === fen &&
              c.engine.solutionFenAt(0) === fen &&
              c.engine.currentMoveNumber === idx &&
              c.fenToCompareAndPlaySound === c.engine.solutionFenAt(idx)
            );
          },
          { idx: indice, fen: puzzle.fen }
        ),
      { message: `la máquina debería haber hecho la jugada ${indice} del puzzle ${puzzle.uid}`, timeout: 15_000 }
    )
    .toBe(true);
  // La jugada se dibuja con animación y al terminar marca origen y destino: hasta entonces el
  // tablero ignora los clics (el marcador del destino es la señal de "ya se puede jugar")
  const uci = puzzle.moves.split(' ')[indice - 1];
  await expect(
    tablero(page).locator(`.markers-layer g[data-square="${uci.slice(2, 4)}"] .marker-square-green`)
  ).toHaveCount(1);
}

/**
 * Mueve una pieza como lo haría el usuario: clic en la pieza y clic en la casilla destino.
 * No toca el estado de la app: pasa por los mismos eventos del tablero (cm-chessboard).
 */
export async function moverPieza(page: Page, uci: string): Promise<void> {
  // En el inicio el tablero está más abajo del primer pantallazo: se trae a la vista antes de tocarlo
  await tablero(page).scrollIntoViewIfNeeded();
  const desde = await centroDe(page, uci.slice(0, 2));
  await page.mouse.click(desde.x, desde.y);
  // Los destinos posibles se marcan con puntos: el tablero ya está esperando el destino
  await expect(tablero(page).locator('.marker-dot-green').first()).toBeAttached();
  const hasta = await centroDe(page, uci.slice(2, 4));
  await page.mouse.click(hasta.x, hasta.y);
}

/**
 * Juega TODA la solución del puzzle (las jugadas del usuario son las de índice impar; las
 * pares las hace la máquina y se esperan). Termina cuando el puzzle se da por resuelto.
 */
export async function resolverPuzzle(page: Page, puzzle: PuzzleEnTablero): Promise<void> {
  const jugadas = puzzle.moves.split(' ');
  for (let i = 1; i < jugadas.length; i += 2) {
    await moverPieza(page, jugadas[i]);
    if (i + 1 < jugadas.length) {
      await esperarMaquina(page, puzzle, i + 2);
    }
  }
}

/**
 * Una jugada legal del usuario que NO es la solución ni da mate (la app da por buena
 * cualquier jugada que mate). Se calcula con chess.js a partir del FEN y la jugada inicial de la máquina.
 */
export function jugadaIncorrecta(puzzle: PuzzleEnTablero): string {
  const jugadas = puzzle.moves.split(' ');
  const chess = new Chess(puzzle.fen);
  chess.move(jugadas[0]);
  const candidatas = chess
    .moves({ verbose: true })
    .filter((m) => `${m.from}${m.to}${m.promotion ?? ''}` !== jugadas[1])
    .filter((m) => !m.san.endsWith('#'));
  // Una que no capture ni dé jaque: movimientos "tranquilos" que se ven claros en el tablero
  const tranquila = candidatas.find((m) => !m.san.includes('x') && !m.san.includes('+')) ?? candidatas[0];
  return `${tranquila.from}${tranquila.to}`;
}

/** Contenido de `chessColate_plans_history` (el historial guardado en el dispositivo). */
export async function historialGuardado(page: Page): Promise<any[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('chessColate_plans_history') ?? '[]'));
}

/** Pulsa la X de salir del entrenamiento (es el único botón con ese aspecto en la barra). */
export async function pulsarSalir(page: Page): Promise<void> {
  await pantalla(page).locator('button.btn-error').click();
}

/**
 * Hace pasar el tiempo de la app (reloj falso) de a poco hasta que se cumpla la condición.
 * Se avanza en pasos cortos y se comprueba entre paso y paso: así un modal que aparece
 * (la presentación del siguiente bloque, que se cierra sola a los 5 s) no se salta de largo.
 */
export async function avanzarHasta(
  page: Page,
  condicion: () => Promise<boolean>,
  opciones: { pasoMs?: number; maxMs?: number; mensaje?: string } = {}
): Promise<void> {
  const paso = opciones.pasoMs ?? 2000;
  const max = opciones.maxMs ?? 400_000;
  let avanzado = 0;
  while (avanzado <= max) {
    // Un poco de tiempo real entre paso y paso: las animaciones (cerrar un modal...) lo necesitan
    const cumplida = await expect
      .poll(condicion, { timeout: 150, intervals: [50] })
      .toBe(true)
      .then(
        () => true,
        () => false
      );
    if (cumplida) return;
    await page.clock.runFor(paso);
    avanzado += paso;
  }
  throw new Error(opciones.mensaje ?? `la condición no se cumplió tras avanzar ${max / 1000} s`);
}

/** Avanza el reloj hasta llegar a una URL (por ejemplo, el resumen al agotarse el tiempo). */
export async function avanzarHastaUrl(page: Page, ruta: string, maxMs = 400_000): Promise<void> {
  await avanzarHasta(page, async () => new URL(page.url()).pathname === ruta, {
    maxMs,
    mensaje: `no se llegó a ${ruta}; se quedó en ${page.url()}`,
  });
}

/** Hace que el CDN devuelva SOLO estos puzzles (por defecto, uno). Registrar antes de `goto`. */
export async function servirPuzzles(page: Page, puzzles = [PUZZLES[1]]): Promise<void> {
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(puzzles),
    })
  );
}

/** Texto del reloj del bloque en la barra de la rutina (mm:ss), o `null` si no hay. */
export async function relojDelBloque(page: Page): Promise<string | null> {
  const reloj = pantalla(page).locator('.navbar span.font-mono');
  return (await reloj.count()) ? ((await reloj.first().textContent()) ?? '').trim() : null;
}

/** Cantidad de puzzles que la app guardó de la rutina terminada, desglosados. */
export function resumenDePuzzles(plan: { blocks: { puzzlesPlayed: { resolved: boolean; failByTime?: boolean }[] }[] }) {
  const jugados = plan.blocks.flatMap((b) => b.puzzlesPlayed);
  return {
    total: jugados.length,
    resueltos: jugados.filter((p) => p.resolved).length,
    porTiempo: jugados.filter((p) => p.failByTime).length,
  };
}

/** Errores de JavaScript sin atrapar que salten en la página (se revisan al final de la prueba). */
export function capturarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  return errores;
}

/** "01:05" -> 65 */
export function aSegundos(reloj: string | null): number {
  const [m, s] = (reloj ?? '').split(':').map(Number);
  return m * 60 + s;
}

/** Botón X de un modal de puzzle (hay uno para móvil y otro para escritorio: solo uno se ve). */
export function cerrarModal(modal: Locator): Locator {
  return modal.locator('button:visible:has(ion-icon[name="close-outline"])');
}

/**
 * Salta el tiempo del bloque en curso hasta que le queden `restantes` segundos y se detiene ahí.
 * El tramo final (el cambio de bloque o el fin de la rutina) se deja correr en tiempo real: si se
 * salta de golpe, la cuenta atrás de 5 s de la presentación del bloque siguiente puede llegar a
 * cero antes de que el modal termine de aparecer (con la máquina cargada pasa), y el modal se
 * queda abierto para siempre. En la vida real eso no ocurre: ahí nadie salta el reloj.
 */
export async function llevarBloqueAlFinal(page: Page, restantes = 3): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const reloj = await relojDelBloque(page);
    if (reloj === null) return;
    const faltan = aSegundos(reloj);
    if (faltan <= restantes) return;
    await page.clock.runFor(Math.min(10_000, (faltan - restantes) * 1000));
    // un respiro en tiempo real para que la app procese lo ocurrido en el salto
    await expect.poll(() => relojDelBloque(page), { timeout: 2000, intervals: [50, 100] }).not.toBe(reloj);
  }
  throw new Error('el reloj del bloque no llegó al final');
}
