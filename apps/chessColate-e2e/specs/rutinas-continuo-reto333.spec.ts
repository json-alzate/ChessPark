import { expect, test } from '../support/test';
import { PUZZLES } from '../support/fixtures';
import {
  abrirHome,
  alertaAbierta,
  capturarErrores,
  cerrarModal,
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
  servirPuzzles,
} from '../support/rut-helpers';

/**
 * Entrenamiento continuo (infinito) y Reto 333 desde el inicio, sin sesión.
 *
 * Continuo: sin presentación de bloque, sin reloj, puzzles uno tras otro sacados del pool.
 * Nunca "termina" y por eso no guarda nada al salir. Reto 333: 333 mates en 1 sin reloj;
 * el primer fallo cierra el intento, guarda la marca (`chesscolate_reto333_stats`) y la
 * rutina en el historial.
 */
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await relojAcelerable(page);
});

const CLAVE_RETO = 'chesscolate_reto333_stats';

test.describe('entrenamiento continuo', () => {
  test('"Train now" entra directo al tablero, sin presentación ni reloj de bloque', async ({ page, network }) => {
    const errores = capturarErrores(page);
    // Un solo puzzle en el CDN: el tablero es siempre el mismo y la captura es estable
    await servirPuzzles(page, [PUZZLES[1]]);
    await abrirHome(page);
    await expect(page.getByText('Continuous training')).toBeVisible();
    await page.getByRole('button', { name: 'Train now' }).click();

    await expect(page).toHaveURL(/\/puzzles\/training$/);
    const puzzle = await esperarPuzzleListo(page);
    expect(puzzle.uid).toBe(PUZZLES[1].uid);
    // Directo al puzzle: ni presentación, ni reloj, ni lista de bloques
    await expect(modalAbierto(page)).toHaveCount(0);
    expect(await relojDelBloque(page)).toBeNull();
    await expect(pantalla(page).locator('.navbar .dropdown')).toHaveCount(0);
    // Muestra la dificultad del puzzle y de quién es el turno (el FEN empieza con negras: juegan blancas)
    await expect(pantalla(page).locator('.navbar .badge')).toHaveText(String(puzzle.rating));
    await expect(pantalla(page)).toContainText('Find the best move for White.');

    await expect(pantalla(page)).toHaveScreenshot('continuo-entrenando.png');
    expect(errores).toEqual([]);
    expect(network.blocked).toEqual([]);
  });

  test('se encadenan puzzles sin parar y salir no guarda nada (no es una rutina que termine)', async ({ page }) => {
    const errores = capturarErrores(page);
    await abrirHome(page);
    await page.getByRole('button', { name: 'Train now' }).click();
    await expect(page).toHaveURL(/\/puzzles\/training$/);

    // Con 3 puzzles en el CDN el pool se agota enseguida: la app debe seguir sirviendo (repetidos)
    let puzzle = await esperarPuzzleListo(page);
    const vistos = [puzzle.marca];
    for (let i = 0; i < 4; i++) {
      await resolverPuzzle(page, puzzle);
      puzzle = await esperarPuzzleListo(page, puzzle.marca);
      vistos.push(puzzle.marca);
      await expect(modalAbierto(page)).toHaveCount(0);
    }
    expect(new Set(vistos).size).toBe(5);

    await pulsarSalir(page);
    await alertaAbierta(page).getByRole('button', { name: 'Exit' }).click();
    await expect(page).toHaveURL(/\/home$/);
    expect(await historialGuardado(page)).toEqual([]);
    expect(errores).toEqual([]);
  });

  test('fallar abre la solución; al cerrarla sigue con otro puzzle', async ({ page }) => {
    await abrirHome(page);
    await page.getByRole('button', { name: 'Train now' }).click();
    const puzzle = await esperarPuzzleListo(page);

    await moverPieza(page, jugadaIncorrecta(puzzle));

    const modal = modalAbierto(page);
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(String(puzzle.rating));
    await expect(modal.getByRole('button', { name: 'See the solution' })).toBeVisible();
    await cerrarModal(modal).click();
    await expect(modal).toHaveCount(0);

    const siguiente = await esperarPuzzleListo(page, puzzle.marca);
    expect(siguiente.marca).not.toBe(puzzle.marca);
    await expect(page).toHaveURL(/\/puzzles\/training$/);
  });

  test('en el inicio, el puzzle de vista previa se juega y al acertar ofrece continuar al entrenamiento', async ({ page }) => {
    await abrirHome(page);
    const previa = await esperarPuzzleListo(page);
    await expect(page.getByRole('button', { name: 'Train now' })).toBeVisible();

    await resolverPuzzle(page, previa);

    await expect(page.getByText('Excellent!')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/puzzles\/training$/);
    await esperarPuzzleListo(page);
    await expect(modalAbierto(page)).toHaveCount(0);
  });

  test('en el inicio, fallar el puzzle de vista previa avisa y deja ver la solución', async ({ page }) => {
    await abrirHome(page);
    const previa = await esperarPuzzleListo(page);

    await moverPieza(page, jugadaIncorrecta(previa));

    await expect(page.getByText('Incorrect!')).toBeVisible();
    await page.getByRole('button', { name: 'See the solution' }).click();
    const modal = modalAbierto(page);
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(String(previa.rating));
    await cerrarModal(modal).click();
    await expect(modal).toHaveCount(0);
    // Sigue en el inicio y se puede pasar al entrenamiento
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });
});

test.describe('Reto 333', () => {
  test('sin sesión se puede aceptar el reto: presentación, contador 0 / 333 y avanza al resolver', async ({ page, network }) => {
    const errores = capturarErrores(page);
    await abrirHome(page);
    await expect(page.locator('span:visible', { hasText: 'Survival' })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), CLAVE_RETO)).toBeNull();
    await page.getByRole('button', { name: 'Accept Challenge' }).click();

    await expect(page).toHaveURL(/\/puzzles\/training$/);
    const modal = modalAbierto(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading')).toHaveText('Mate in 1');
    await empezarBloque(page);

    let puzzle = await esperarPuzzleListo(page);
    const barra = pantalla(page).locator('.navbar');
    await expect(barra).toContainText('0 / 333');
    await expect(barra).toContainText('Mate in 1');
    expect(await relojDelBloque(page)).toBeNull(); // sin reloj

    for (const resueltos of [1, 2]) {
      await resolverPuzzle(page, puzzle);
      puzzle = await esperarPuzzleListo(page, puzzle.marca);
      await expect(barra).toContainText(`${resueltos} / 333`);
    }
    await expect(modalAbierto(page)).toHaveCount(0);
    expect(errores).toEqual([]);
    expect(network.blocked).toEqual([]);
  });

  test('el primer fallo muestra la solución y luego el resultado; guarda la marca y la rutina', async ({ page }) => {
    const errores = capturarErrores(page);
    await abrirHome(page);
    await page.getByRole('button', { name: 'Accept Challenge' }).click();
    await empezarBloque(page);
    let puzzle = await esperarPuzzleListo(page);
    for (let i = 0; i < 2; i++) {
      await resolverPuzzle(page, puzzle);
      puzzle = await esperarPuzzleListo(page, puzzle.marca);
    }

    await moverPieza(page, jugadaIncorrecta(puzzle));

    // Primero la solución del puzzle fallado...
    const solucion = modalAbierto(page);
    await expect(solucion).toBeVisible();
    // ...y los minutos que pasan mientras se mira cuentan en el "tiempo total" (el reloj del reto es el real)
    await page.clock.runFor(125_000);
    await cerrarModal(solucion).click();
    await expect(solucion).toHaveCount(0);

    // ...después el resultado del intento
    const resultado = page.locator('.modal-box');
    await expect(resultado).toBeVisible();
    await expect(resultado.getByRole('heading')).toHaveText('Good Try!');
    const valores = resultado.locator('.stat-value');
    await expect(valores.nth(0)).toHaveText('2 / 333'); // resueltos: el fallado no suma
    await expect(valores.nth(1)).toHaveText(/^([2-9]|\d\d)m \d+s$/);
    await expect(valores.nth(2)).toHaveText('420'); // 400 de partida + 10 por cada acierto
    await expect(resultado.getByRole('button', { name: 'Back to Home' })).toBeVisible();
    await expect(resultado.getByRole('button', { name: 'Try again' })).toBeVisible();
    // El tiempo total cambia en cada corrida: se tapa para comparar el resto de la tarjeta
    await expect(resultado).toHaveScreenshot('reto333-resultado.png', { mask: [valores.nth(1)] });

    // Marca del reto en el dispositivo
    const marca = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CLAVE_RETO)) ?? 'null');
    expect(marca).toMatchObject({ lastScore: 2, bestScore: 2, maxElo: 420, completed: false });
    expect(marca.timeString).toMatch(/^\d+m \d+s$/);
    expect(marca.lastTime).toBeGreaterThanOrEqual(125);
    // La rutina queda en el historial con los 3 puzzles jugados: 2 aciertos y el fallo
    const [plan] = await historialGuardado(page);
    expect(plan).toMatchObject({ planType: 'reto333', isFinished: true });
    expect(plan.blocks[0].puzzlesPlayed.map((p: { resolved: boolean }) => p.resolved)).toEqual([true, true, false]);

    // Volver al inicio: la tarjeta del reto enseña el intento
    await resultado.getByRole('button', { name: 'Back to Home' }).click();
    await expect(page).toHaveURL(/\/home$/);
    const tarjeta = page.locator('.card:visible', { hasText: 'Survival' });
    await expect(tarjeta).toContainText('2 / 333');
    await expect(tarjeta).toContainText('Best: 2');
    await expect(tarjeta.getByRole('button', { name: 'Try Again' })).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('"Try again" del resultado empieza un intento nuevo desde 0 / 333', async ({ page }) => {
    await abrirHome(page);
    await page.getByRole('button', { name: 'Accept Challenge' }).click();
    await empezarBloque(page);
    const puzzle = await esperarPuzzleListo(page);

    await moverPieza(page, jugadaIncorrecta(puzzle)); // falla el primero: 0 aciertos
    const solucion = modalAbierto(page);
    await expect(solucion).toBeVisible();
    await cerrarModal(solucion).click();
    const resultado = page.locator('.modal-box');
    await expect(resultado.locator('.stat-value').nth(0)).toHaveText('0 / 333');

    await resultado.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.modal-box')).toHaveCount(0);
    // Otro intento: vuelve la presentación y el contador arranca en cero
    await expect(modalAbierto(page)).toBeVisible();
    await empezarBloque(page);
    const nuevo = await esperarPuzzleListo(page);
    expect(nuevo.marca).not.toBe(puzzle.marca);
    await expect(pantalla(page).locator('.navbar')).toContainText('0 / 333');
    await expect(page).toHaveURL(/\/puzzles\/training$/);
  });

  test('salir del reto a medias no guarda marca ni rutina', async ({ page }) => {
    await abrirHome(page);
    await page.getByRole('button', { name: 'Accept Challenge' }).click();
    await empezarBloque(page);
    const puzzle = await esperarPuzzleListo(page);
    await resolverPuzzle(page, puzzle);
    await esperarPuzzleListo(page, puzzle.marca);
    await expect(pantalla(page).locator('.navbar')).toContainText('1 / 333');

    await pulsarSalir(page);
    await alertaAbierta(page).getByRole('button', { name: 'Exit' }).click();

    await expect(page).toHaveURL(/\/home$/);
    expect(await page.evaluate((k) => localStorage.getItem(k), CLAVE_RETO)).toBeNull();
    expect(await historialGuardado(page)).toEqual([]);
    // La tarjeta sigue invitando a aceptar el reto (no hay intento previo)
    await expect(page.getByRole('button', { name: 'Accept Challenge' })).toBeVisible();
    expect(await puzzleActual(page)).not.toBeNull(); // el inicio vuelve a mostrar su puzzle de vista previa
  });
});
