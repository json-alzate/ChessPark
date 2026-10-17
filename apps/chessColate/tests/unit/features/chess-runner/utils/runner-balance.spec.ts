import { difficultyForLevel } from '@features/chess-runner/config/runner.config';
import { RunnerPiece, RunnerState } from '@features/chess-runner/models/runner.model';
import { CONTACT_X, createRun, jump, stepRun } from '@features/chess-runner/utils/runner-engine.util';
import { buildRunnerSequence, seededRandom } from '@features/chess-runner/utils/runner-sequence.util';

/**
 * El equilibrio del juego con jugadores de carne y hueso. Un jugador perfecto no existe: la gente toca con un error de
 * decenas de milisegundos. Aquí un «jugador» toca cuando falta `centro` segundos para que llegue la pieza, más un error
 * gaussiano de desviación `sigma`. Si el juego se vuelve injusto (la gente normal pierde antes de llegar al ejercicio)
 * o trivial (nadie se equivoca nunca), estas pruebas lo dicen.
 *
 * Referencia: σ = 0,05 s es un jugador muy fino; 0,09 s, uno normal con el móvil en la mano; 0,12 s, uno despistado.
 */

const PASO = 1 / 120;
const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  'r4rk1/1p3ppp/p2p4/2pNn2R/2P1P2q/P2P3P/1P2Q1P1/R5K1 b - - 3 19',
  '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
];

/** Cuándo toca, de media, un jugador que acierta con el centro de la ventana: la mitad del margen que dejan las piezas. */
const CENTRO = { sencilla: 0.28, falange: 0.2 };

function correr(piezas: RunnerPiece[], nivel: number, sigma: number, azar: () => number) {
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(azar(), 1e-9))) * Math.cos(2 * Math.PI * azar());
  let state: RunnerState = createRun(piezas, 196, difficultyForLevel(nivel));
  const objetivo = new Map<number, number>();
  const hecho = new Set<number>();
  let t = 0;
  while (state.phase !== 'done' && t < 90) {
    const delante = state.obstacles.find((o) => !o.hit && !o.cleared && !hecho.has(o.id));
    if (delante) {
      if (!objetivo.has(delante.id)) {
        objetivo.set(delante.id, (delante.count > 1 ? CENTRO.falange : CENTRO.sencilla) + sigma * gauss());
      }
      if ((delante.plan - CONTACT_X) / state.speed <= objetivo.get(delante.id)!) {
        hecho.add(delante.id);
        state = jump(state).state;
        if (delante.count > 1) {
          state = jump(state).state;
        }
      }
    }
    state = stepRun(state, PASO).state;
    t += PASO;
  }
  return { choques: state.stumbles, piezas: state.total, galletas: state.cookies };
}

/** Promedios de varias carreras del nivel dado, con ejercicios distintos. */
function medir(nivel: number, sigma: number, carreras = 24) {
  const azar = seededRandom(97 + nivel * 13);
  let choques = 0;
  let piezas = 0;
  let limpias = 0;
  let galletas = 0;
  for (let i = 0; i < carreras; i++) {
    const secuencia = buildRunnerSequence(FENS[i % FENS.length], `balance-${sigma}-${nivel}-${i}`, nivel);
    const r = correr(secuencia, nivel, sigma, azar);
    choques += r.choques;
    piezas += r.piezas;
    limpias += r.choques === 0 ? 1 : 0;
    galletas += r.galletas;
  }
  return {
    choquesPorCarrera: choques / carreras,
    fallos: choques / piezas,
    limpias: limpias / carreras,
    galletas: galletas / carreras,
  };
}

describe('el equilibrio con jugadores reales', () => {
  it('un jugador fino casi nunca choca, en ningún nivel', () => {
    for (const nivel of [1, 5, 10]) {
      expect(medir(nivel, 0.05).choquesPorCarrera).toBeLessThan(0.5);
    }
  });

  it('un jugador normal (σ 0,09) casi no choca al empezar y sufre algo más a medida que sube el nivel', () => {
    const empezando = medir(1, 0.09);
    const arriba = medir(10, 0.09);

    expect(empezando.choquesPorCarrera).toBeLessThan(0.6);
    expect(empezando.limpias).toBeGreaterThan(0.6);
    expect(arriba.choquesPorCarrera).toBeLessThan(1.5);
    expect(arriba.choquesPorCarrera).toBeGreaterThanOrEqual(empezando.choquesPorCarrera);
  });

  it('un jugador despistado (σ 0,12) llega vivo al ejercicio: no pierde sus tres corazones en una sola carrera', () => {
    for (const nivel of [1, 5, 10]) {
      expect(medir(nivel, 0.12).choquesPorCarrera).toBeLessThan(2);
    }
  });

  it('el juego no es trivial: quien toca sin criterio (σ 0,25) sí choca bastante', () => {
    expect(medir(5, 0.25).choquesPorCarrera).toBeGreaterThan(3);
  });

  it('un jugador normal recupera lo que pierde: entre ejercicios y galletas devuelve más corazones de los que pierde por carrera', () => {
    const { choquesPorCarrera, galletas } = medir(3, 0.09);
    // Un corazón por ejercicio resuelto (y una carrera por ejercicio) más las galletas de la carrera
    const recuperados = 1 + galletas / 60;

    expect(recuperados).toBeGreaterThan(choquesPorCarrera);
  });

  it('un jugador despistado también se mantiene a flote casi siempre', () => {
    const { choquesPorCarrera, galletas } = medir(3, 0.12);

    expect(1 + galletas / 60).toBeGreaterThan(choquesPorCarrera);
  });
});
