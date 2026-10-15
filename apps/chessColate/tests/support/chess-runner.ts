import {
  RunnerAction,
  RunnerPieceKind,
  RunnerState,
} from '@features/chess-runner/models/runner.model';
import { createRun, perform, stepRun } from '@features/chess-runner/utils/runner-engine.util';

/**
 * Ayudas para probar el Chess Runner sin dibujar nada: carreras guionizadas con el motor puro.
 */

export const PASO = 1 / 240;
export const ANCHO = 200;

/** Una orden en un instante de la carrera. */
export interface Orden {
  t: number;
  action: RunnerAction;
}

/** Tramo en el que el jugador mantiene pulsado. */
export interface Pulsacion {
  desde: number;
  hasta: number;
}

export interface Guion {
  ordenes: Orden[];
  mantener?: Pulsacion[];
}

/** Una carrera con un solo obstáculo que sale en el primer paso. */
export function carreraDeUno(kind: RunnerPieceKind, color: 'w' | 'b' = 'w'): RunnerState {
  return { ...createRun([{ kind, color }], ANCHO), untilSpawn: 0 };
}

/**
 * Corre la carrera hasta que termina (o se agota el tiempo) aplicando el guion. Devuelve el estado final
 * y todo lo que ocurrió.
 */
export function correr(inicial: RunnerState, guion: Guion = { ordenes: [] }, limite = 12) {
  let state = inicial;
  let t = 0;
  const pendientes = [...guion.ordenes].sort((a, b) => a.t - b.t);
  const registro = { saltos: 0, dobles: 0, tropiezos: 0, superados: 0 };

  while (state.phase !== 'done' && t < limite) {
    while (pendientes.length && pendientes[0].t <= t + 1e-9) {
      const resultado = perform(state, pendientes.shift()!.action);
      state = resultado.state;
      registro.saltos += resultado.jumped ? 1 : 0;
      registro.dobles += resultado.doubleJumped ? 1 : 0;
    }
    const manteniendo = (guion.mantener ?? []).some((p) => t >= p.desde && t < p.hasta);
    const paso = stepRun(state, PASO, manteniendo);
    state = paso.state;
    registro.tropiezos += paso.events.stumbled ? 1 : 0;
    registro.superados += paso.events.cleared.length;
    t += PASO;
  }
  return { state, t, ...registro };
}

/**
 * Barre el instante de la pulsación y devuelve los tramos en los que el obstáculo se supera sin tropezar.
 * `guion` recibe el instante de la pulsación.
 */
export function ventanasDeAcierto(
  kind: RunnerPieceKind,
  guion: (t0: number) => Guion,
  { desde = 0, hasta = 1.8, paso = 0.005 } = {}
) {
  const aciertos: number[] = [];
  for (let t0 = desde; t0 <= hasta; t0 += paso) {
    const r = correr(carreraDeUno(kind), guion(t0));
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
