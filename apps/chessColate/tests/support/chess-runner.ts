import { RunnerPieceKind, RunnerState } from '@features/chess-runner/models/runner.model';
import { difficultyForLevel } from '@features/chess-runner/config/runner.config';
import { createRun, jump, stepRun } from '@features/chess-runner/utils/runner-engine.util';

/**
 * Ayudas para probar el Chess Runner sin dibujar nada: carreras guionizadas con el motor puro.
 */

export const PASO = 1 / 240;
export const ANCHO = 200;

/** Los instantes (en segundos desde el principio de la carrera) en que el jugador toca. */
export interface Guion {
  toques: number[];
}

/** Una carrera con un solo obstáculo que sale en el primer paso (y de nivel `nivel`); con `falange`, tres iguales en fila. */
export function carreraDeUno(
  kind: RunnerPieceKind,
  color: 'w' | 'b' = 'w',
  { nivel = 1, falange = false } = {}
): RunnerState {
  return {
    ...createRun([{ kind, color, wall: falange ? 3 : undefined }], ANCHO, difficultyForLevel(nivel)),
    untilSpawn: 0,
  };
}

/**
 * Corre la carrera hasta que termina (o se agota el tiempo) con los toques del guion. Devuelve el estado
 * final y todo lo que ocurrió.
 */
export function correr(inicial: RunnerState, guion: Guion = { toques: [] }, limite = 12) {
  let state = inicial;
  let t = 0;
  const pendientes = [...guion.toques].sort((a, b) => a - b);
  const registro = { saltos: 0, tropiezos: 0, superados: 0, galletas: 0 };

  while (state.phase !== 'done' && t < limite) {
    while (pendientes.length && pendientes[0] <= t + 1e-9) {
      pendientes.shift();
      const resultado = jump(state);
      state = resultado.state;
      registro.saltos += resultado.jumped ? 1 : 0;
    }
    const paso = stepRun(state, PASO);
    state = paso.state;
    registro.tropiezos += paso.events.stumbled ? 1 : 0;
    registro.superados += paso.events.cleared.length;
    registro.galletas += paso.events.cookies;
    t += PASO;
  }
  return { state, t, ...registro };
}

/**
 * Barre el instante del toque y devuelve los tramos en los que el obstáculo se supera sin tropezar.
 */
export function ventanasDeAcierto(
  kind: RunnerPieceKind,
  { desde = 0, hasta = 1.8, paso = 0.005, nivel = 1, falange = false, doble = false } = {}
) {
  const aciertos: number[] = [];
  for (let t0 = desde; t0 <= hasta; t0 += paso) {
    // El doble salto son dos toques seguidos: el segundo espera a la cima
    const toques = doble ? [t0, t0 + 0.03] : [t0];
    const r = correr(carreraDeUno(kind, 'w', { nivel, falange }), { toques });
    if (r.tropiezos === 0 && r.state.phase === 'done') {
      aciertos.push(Math.round(t0 * 1000) / 1000);
    }
  }
  // Agrupar en tramos contiguos
  const tramos: { desde: number; hasta: number; ancho: number }[] = [];
  for (const t of aciertos) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && t - ultimo.hasta <= paso * 1.5) {
      ultimo.hasta = t;
      ultimo.ancho = Math.round((ultimo.hasta - ultimo.desde + paso) * 1000) / 1000;
    } else {
      tramos.push({ desde: t, hasta: t, ancho: paso });
    }
  }
  return { aciertos, tramos, mejor: tramos.reduce((m, x) => Math.max(m, x.ancho), 0) };
}
