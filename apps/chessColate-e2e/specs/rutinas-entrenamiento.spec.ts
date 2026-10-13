import { expect, test } from '../support/test';
import {
  abrirHome,
  alertaAbierta,
  aSegundos,
  avanzarHasta,
  avanzarHastaUrl,
  capturarErrores,
  cerrarModal,
  elegirRutina,
  empezarBloque,
  esperarPuzzleListo,
  historialGuardado,
  jugadaIncorrecta,
  modalAbierto,
  moverPieza,
  pantalla,
  puzzleActual,
  pulsarSalir,
  relojAcelerable,
  relojDelBloque,
  resolverPuzzle,
  tablero,
} from '../support/rut-helpers';

/**
 * Entrenamiento por rutinas en modo invitado: elegir una rutina del home, jugar los puzzles
 * moviendo piezas en el tablero, qué pasa al fallar y qué pasa al abandonar.
 *
 * Los puzzles salen de los 3 de `support/fixtures.ts` (se repiten); la app elige cuál y el
 * color con `Math.random` sembrado, por eso cada prueba lee el puzzle que hay en el tablero
 * en vez de suponerlo. El reloj es el falso de Playwright (corre solo, pero se puede saltar).
 */
test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await relojAcelerable(page);
});

test('elegir Bullet en el inicio abre el entrenamiento con la presentación del bloque', async ({ page, network }) => {
  const errores = capturarErrores(page);
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');

  await expect(page).toHaveURL(/\/puzzles\/training$/);
  const modal = modalAbierto(page);
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading')).toHaveText(/^Short Exercise with (White|Black)$/);
  await expect(modal.getByRole('button', { name: /Start/ })).toBeVisible();
  // Mientras se presenta el bloque no hay nada guardado de la rutina
  expect(await historialGuardado(page)).toEqual([]);

  // Sin pulsar nada, la cuenta atrás de 5 s cierra la presentación y arranca el bloque
  await avanzarHasta(page, async () => (await modal.count()) === 0, { pasoMs: 1000, maxMs: 12_000 });
  await expect(tablero(page)).toBeVisible();
  expect(errores).toEqual([]);
  expect(network.blocked).toEqual([]);
});

test('al empezar el bloque se ve el tablero con un puzzle, el reloj del bloque y de quién es el turno', async ({ page }) => {
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  const puzzle = await esperarPuzzleListo(page);

  // Barra de la rutina: nombre del bloque y reloj de 1 minuto corriendo
  await expect(pantalla(page).locator('.navbar')).toContainText('Short Exercise');
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(50);
  expect(aSegundos(await relojDelBloque(page))).toBeLessThanOrEqual(60);
  // Cada puzzle de Bullet tiene su propio reloj y barra de progreso (10 s)
  await expect(pantalla(page).locator('progress')).toBeVisible();

  // El FEN del puzzle empieza con el turno del rival: el usuario juega con el color contrario
  const usuario = puzzle.fen.split(' ')[1] === 'w' ? 'Black' : 'White';
  await expect(pantalla(page)).toContainText(`Find the best move for ${usuario}.`);
  // El tablero tiene las 64 casillas y las piezas del puzzle (dependen del FEN)
  await expect(tablero(page).locator('rect[data-square]')).toHaveCount(64);
  const piezasEnFen = puzzle.fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
  // la máquina ya hizo su primera jugada: puede haber una pieza menos si fue una captura
  const piezasEnTablero = await tablero(page).locator('g[data-piece]').count();
  expect(piezasEnTablero).toBeGreaterThanOrEqual(piezasEnFen - 1);
  expect(piezasEnTablero).toBeLessThanOrEqual(piezasEnFen);
});

test('jugar la solución moviendo las piezas resuelve el puzzle y aparece el siguiente', async ({ page }) => {
  const errores = capturarErrores(page);
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  const puzzle = await esperarPuzzleListo(page);

  await resolverPuzzle(page, puzzle);

  // Acertar no abre la solución: la rutina sigue sola con otro puzzle
  const siguiente = await esperarPuzzleListo(page, puzzle.marca);
  expect(siguiente.marca).not.toBe(puzzle.marca);
  await expect(modalAbierto(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/puzzles\/training$/);
  // La rutina no termina por resolver un puzzle: sigue sin guardarse nada
  expect(await historialGuardado(page)).toEqual([]);
  expect(errores).toEqual([]);
});

test('fallar un puzzle en Bullet no muestra la solución: pasa al siguiente y queda como fallado', async ({ page }) => {
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  const primero = await esperarPuzzleListo(page);

  await moverPieza(page, jugadaIncorrecta(primero));

  // Bullet no tiene "mostrar solución": sin modal, directo al siguiente puzzle
  const segundo = await esperarPuzzleListo(page, primero.marca);
  await expect(modalAbierto(page)).toHaveCount(0);
  await resolverPuzzle(page, segundo);
  await esperarPuzzleListo(page, segundo.marca);

  // Al terminar la rutina el primero está guardado como fallo (no por tiempo) y el segundo como acierto
  await avanzarHastaUrl(page, '/puzzles/plan-played');
  const [plan] = await historialGuardado(page);
  const jugados = plan.blocks[0].puzzlesPlayed;
  expect(jugados[0]).toMatchObject({ uidPuzzle: primero.uid, resolved: false, failByTime: false });
  expect(jugados[1]).toMatchObject({ uidPuzzle: segundo.uid, resolved: true, failByTime: false });
});

test('si se acaba el tiempo del puzzle (10 s en Bullet) pasa al siguiente como fallo por tiempo', async ({ page }) => {
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  const primero = await esperarPuzzleListo(page);

  // Sin tocar el tablero, el reloj del puzzle llega a 0 y la app cambia de puzzle
  await avanzarHasta(page, async () => (await puzzleActual(page))?.marca !== primero.marca, {
    pasoMs: 1000,
    maxMs: 20_000,
    mensaje: 'el puzzle no cambió al agotarse su tiempo',
  });
  const segundo = await esperarPuzzleListo(page, primero.marca);
  await expect(modalAbierto(page)).toHaveCount(0);
  expect(segundo.marca).not.toBe(primero.marca);

  await avanzarHastaUrl(page, '/puzzles/plan-played');
  const [plan] = await historialGuardado(page);
  expect(plan.blocks[0].puzzlesPlayed[0]).toMatchObject({
    uidPuzzle: primero.uid,
    resolved: false,
    failByTime: true,
    resolvedTime: 10,
  });
});

test('fallar en Rapid abre la solución, congela el reloj del bloque y al cerrarla sigue la rutina', async ({ page }) => {
  await abrirHome(page);
  await elegirRutina(page, 'Rapid');
  await empezarBloque(page);
  const puzzle = await esperarPuzzleListo(page);
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(110);

  await moverPieza(page, jugadaIncorrecta(puzzle));

  // Rapid sí muestra la solución del puzzle fallado
  const modal = modalAbierto(page);
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'See the solution' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Ask a clue' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Play and close' })).toBeVisible();
  await expect(modal).toContainText(String(puzzle.rating));

  // Mientras se ve la solución el reloj del bloque no corre
  const congelado = await relojDelBloque(page);
  await page.clock.runFor(6000);
  expect(await relojDelBloque(page)).toBe(congelado);

  await cerrarModal(modal).click();
  await expect(modal).toHaveCount(0);

  // Con la solución cerrada llega otro puzzle y el reloj del bloque vuelve a correr
  await esperarPuzzleListo(page, puzzle.marca);
  await page.clock.runFor(3000);
  expect(aSegundos(await relojDelBloque(page))).toBeLessThan(aSegundos(congelado));
});

test('abandonar: Cancelar mantiene la rutina y Salir vuelve al inicio sin guardar nada', async ({ page }) => {
  const errores = capturarErrores(page);
  await abrirHome(page);
  await elegirRutina(page, 'Bullet');
  await empezarBloque(page);
  const puzzle = await esperarPuzzleListo(page);
  // Se juega un puzzle completo antes de abandonar: aun así no debe guardarse
  await resolverPuzzle(page, puzzle);
  const enCurso = await esperarPuzzleListo(page, puzzle.marca);

  await pulsarSalir(page);
  const alerta = alertaAbierta(page);
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText('Exit training');
  await expect(alerta).toContainText('Are you sure you want to exit the training?');

  // Cancelar: la alerta se va y el puzzle sigue siendo el mismo
  await alerta.getByRole('button', { name: 'Cancel' }).click();
  await expect(alerta).toHaveCount(0);
  await expect(page).toHaveURL(/\/puzzles\/training$/);
  expect((await puzzleActual(page))?.marca).toBe(enCurso.marca);

  // Salir: de vuelta al inicio
  await pulsarSalir(page);
  await alertaAbierta(page).getByRole('button', { name: 'Exit' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('swiper-slide').first()).toBeAttached();

  // Una rutina abandonada no se guarda: ni historial ni resumen
  expect(await page.evaluate(() => localStorage.getItem('chessColate_plans_history'))).toBeNull();
  expect(errores).toEqual([]);

  // Y se puede empezar otra rutina limpia (sin restos de la anterior)
  await elegirRutina(page, 'Blitz');
  await expect(page).toHaveURL(/\/puzzles\/training$/);
  await expect(modalAbierto(page)).toBeVisible();
  await empezarBloque(page);
  const nuevo = await esperarPuzzleListo(page);
  expect(nuevo.marca).not.toBe(enCurso.marca);
  expect(aSegundos(await relojDelBloque(page))).toBeGreaterThan(170); // Blitz: 3 min
});

test('abrir /puzzles/training sin ninguna rutina en curso devuelve al inicio', async ({ page }) => {
  await page.goto('/puzzles/training');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('swiper-slide').first()).toBeAttached();
  expect(await page.evaluate(() => localStorage.getItem('chessColate_plans_history'))).toBeNull();
});
