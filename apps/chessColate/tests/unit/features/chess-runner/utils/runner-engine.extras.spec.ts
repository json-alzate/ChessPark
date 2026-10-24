import {
  PERFECT_COOKIES,
  PERFECT_RATIO,
  RUNNER_PHYSICS as P,
  SMASH_COOKIES,
  STAR_SECONDS,
  STAR_Y,
} from '@features/chess-runner/config/runner.config';
import { RunnerPiece, RunnerState } from '@features/chess-runner/models/runner.model';
import { createRun, jump, perfectHeight, runnerStats, stepRun } from '@features/chess-runner/utils/runner-engine.util';
import { ANCHO, carreraDeUno, PASO } from '@tests/support/chess-runner';

/**
 * Lo que premia la destreza: el salto perfecto (la pieza pasa justo cuando el perrito está en lo más alto) y la estrella,
 * que lo hace imparable unos segundos.
 */

/** Corre una carrera guionizada y recoge lo que ocurre. */
function correr(inicial: RunnerState, toques: number[] = [], limite = 14) {
  let state = inicial;
  let t = 0;
  const pendientes = [...toques];
  const registro = { perfectos: 0, arrollados: 0, tropiezos: 0, galletas: 0, estrella: false, estrellaAcabada: false };
  while (state.phase !== 'done' && t < limite) {
    while (pendientes.length && pendientes[0] <= t + 1e-9) {
      pendientes.shift();
      state = jump(state).state;
    }
    const paso = stepRun(state, PASO);
    state = paso.state;
    registro.perfectos += paso.events.perfect.length;
    registro.arrollados += paso.events.smashed.length;
    registro.tropiezos += paso.events.stumbled ? 1 : 0;
    registro.galletas += paso.events.cookies;
    registro.estrella = registro.estrella || paso.events.starTaken;
    registro.estrellaAcabada = registro.estrellaAcabada || paso.events.starEnded;
    t += PASO;
  }
  return { state, t, ...registro };
}

describe('el salto perfecto', () => {
  const peon = () => carreraDeUno('pawn');

  /** Para cada instante de toque, si pasa la pieza sin chocar y si es perfecto. */
  const barrido = () => {
    const filas: { t: number; perfecto: boolean }[] = [];
    for (let t0 = 0; t0 <= 1.8; t0 += 0.01) {
      const r = correr(peon(), [t0]);
      if (r.tropiezos === 0) {
        filas.push({ t: t0, perfecto: r.perfectos > 0 });
      }
    }
    return filas;
  };

  it('es la franja del centro de la ventana de acierto: ni la más temprana ni la más tardía lo son', () => {
    const filas = barrido();
    const perfectas = filas.filter((f) => f.perfecto);

    expect(filas.length).toBeGreaterThan(30);
    expect(perfectas.length).toBeGreaterThan(5);
    // Una franja contigua en el medio
    const medio = (filas[0].t + filas[filas.length - 1].t) / 2;
    expect(perfectas[0].t).toBeLessThan(medio);
    expect(perfectas[perfectas.length - 1].t).toBeGreaterThan(medio);
    expect(filas[0].perfecto).toBe(false);
    expect(filas[filas.length - 1].perfecto).toBe(false);
    // Y es una fracción moderada del total: se puede conseguir, pero hay que apuntar
    expect(perfectas.length / filas.length).toBeGreaterThan(0.12);
    expect(perfectas.length / filas.length).toBeLessThan(0.5);
  });

  it('da galletas de más y se cuenta en las estadísticas', () => {
    const perfecto = barrido().find((f) => f.perfecto)!;
    const r = correr(peon(), [perfecto.t]);

    expect(r.perfectos).toBe(1);
    expect(r.state.perfects).toBe(1);
    expect(r.galletas).toBeGreaterThanOrEqual(PERFECT_COOKIES);
    expect(runnerStats(r.state).perfects).toBe(1);

    const normal = barrido().find((f) => !f.perfecto)!;
    const sin = correr(peon(), [normal.t]);
    expect(sin.perfectos).toBe(0);
    expect(sin.galletas).toBeLessThan(r.galletas);
  });

  it('una pieza se juzga una sola vez, y quien la choca no se lleva ningún perfecto', () => {
    const choque = correr(peon(), []);
    expect(choque.tropiezos).toBe(1);
    expect(choque.perfectos).toBe(0);

    const perfecto = barrido().find((f) => f.perfecto)!;
    expect(correr(peon(), [perfecto.t]).perfectos).toBe(1);
  });

  it('el listón es una fracción de lo que sube el salto; en una falange, de lo que sube el doble', () => {
    const sencillo = P.jumpVelocity ** 2 / (2 * P.gravity);
    const doble = sencillo + P.doubleJumpVelocity ** 2 / (2 * P.gravity);

    expect(perfectHeight({ count: 1 }, { doubleJumpVelocity: P.doubleJumpVelocity })).toBeCloseTo(sencillo * PERFECT_RATIO, 5);
    expect(perfectHeight({ count: 3 }, { doubleJumpVelocity: P.doubleJumpVelocity })).toBeCloseTo(doble * PERFECT_RATIO, 5);
    // Con el muelle el doble salto sube más y el listón de la falange también
    expect(perfectHeight({ count: 3 }, { doubleJumpVelocity: P.doubleJumpVelocity + 30 })).toBeGreaterThan(
      perfectHeight({ count: 3 }, { doubleJumpVelocity: P.doubleJumpVelocity })
    );
  });
});

describe('la estrella', () => {
  const piezas = (n: number, conRespiro: number[] = []): RunnerPiece[] =>
    Array.from({ length: n }, (_, i) => ({ kind: 'pawn' as const, color: 'w' as const, beat: 0.9, rest: conRespiro.includes(i) ? 2.4 : undefined }));

  it('sale una sola vez por carrera, en el primer respiro, a una altura que un salto sencillo alcanza', () => {
    let state = createRun(piezas(5, [1, 3]), ANCHO);
    const estrellas: number[] = [];
    for (let i = 0; i < 12 * 240 && state.phase === 'running'; i++) {
      // Saltar todo el rato mantiene la carrera viva sin chocar
      if (state.dog.y === 0 && i % 40 === 0) {
        state = jump(state).state;
      }
      state = stepRun({ ...state, dog: { ...state.dog, stumble: 5 } }, PASO).state;
      const ahora = state.pickups.filter((c) => c.kind === 'star').map((c) => c.id);
      ahora.forEach((id) => !estrellas.includes(id) && estrellas.push(id));
    }

    expect(estrellas).toHaveLength(1);
    expect(state.starSpawned).toBe(true);
    expect(STAR_Y).toBeLessThan(P.jumpVelocity ** 2 / (2 * P.gravity));
  });

  it('coger la estrella la gasta como pickup, no cuenta como galleta y arranca el tiempo', () => {
    let state = { ...createRun(piezas(3), ANCHO), untilSpawn: 99999 };
    state = { ...state, pickups: [{ id: 99, kind: 'star', x: state.dog.x - 4, y: 0 }] };
    const paso = stepRun(state, PASO);

    expect(paso.events.starTaken).toBe(true);
    expect(paso.events.cookies).toBe(0);
    expect(paso.state.starTime).toBe(STAR_SECONDS);
    expect(paso.state.pickups.some((c) => c.kind === 'star')).toBe(false);
  });

  it('con la estrella no se choca: la pieza se arrolla, cuenta como superada, da galletas y sigue la racha', () => {
    const inicial = { ...carreraDeUno('king'), starTime: STAR_SECONDS };
    const r = correr(inicial, []);

    expect(r.tropiezos).toBe(0);
    expect(r.arrollados).toBe(1);
    expect(r.state.smashed).toBe(1);
    expect(r.state.cleared).toBe(1);
    expect(r.state.combo).toBe(1);
    expect(r.galletas).toBe(SMASH_COOKIES);
    expect(runnerStats(r.state).smashed).toBe(1);
  });

  it('dura sus segundos, avisa de que se acabó y después se vuelve a chocar', () => {
    const corta = correr({ ...createRun([{ kind: 'pawn', color: 'w' }], ANCHO), untilSpawn: 99999, starTime: 0.5 }, [], 1.5);
    expect(corta.estrellaAcabada).toBe(true);
    expect(corta.state.starTime).toBe(0);

    // La pieza llega con la estrella ya apagada
    const tarde = correr({ ...carreraDeUno('pawn'), starTime: 0.05, untilSpawn: 0, dog: { ...carreraDeUno('pawn').dog } });
    expect(tarde.tropiezos + tarde.arrollados).toBe(1);
    expect(tarde.tropiezos).toBe(1);
  });

  it('una pieza arrollada ya no estorba: no vuelve a contar ni a chocar', () => {
    const r = correr({ ...carreraDeUno('pawn'), starTime: STAR_SECONDS }, []);

    expect(r.state.cleared).toBe(1);
    expect(r.state.stumbles).toBe(0);
    expect(r.state.obstacles.filter((o) => !o.cleared)).toHaveLength(0);
  });
});
