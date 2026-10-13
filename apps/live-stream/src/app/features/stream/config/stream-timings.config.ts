import { InjectionToken } from '@angular/core';
import { DEFAULT_LADDER } from '@features/stream/utils/elo-ladder.util';

/** Tiempos del ciclo de un puzzle y de la rotación de temas. */
export interface StreamTimings {
  /** Posición inicial a la vista, antes de la jugada del rival. */
  presentMs: number;
  /** Pausa tras la jugada del rival. */
  opponentMs: number;
  /** Cuenta atrás "¿lo ves?", en segundos. */
  countdownS: number;
  /** Tiempo entre jugadas de la solución. */
  moveMs: number;
  /** Pausa con la posición final antes del siguiente puzzle. */
  closeMs: number;
  /** Duración de cada bloque del programa (cada cuánto cambia el tema). */
  blockMs: number;
  /** Cuánto tarda el ELO en subir de abajo a arriba antes de reiniciarse. */
  ladderMs: number;
  /** Desfase para probar: coloca la escalera en un ELO concreto al abrir la página (en producción es 0). */
  ladderOffsetMs: number;
}

export const DEFAULT_TIMINGS: StreamTimings = {
  presentMs: 2000,
  opponentMs: 1200,
  countdownS: 10,
  moveMs: 1500,
  closeMs: 3000,
  blockMs: 20 * 60_000,
  ladderMs: DEFAULT_LADDER.periodMs,
  ladderOffsetMs: 0,
};

/**
 * Lee ajustes de la URL para probar sin esperar:
 * `?countdown=3&move=600&block=60000&ladder=300000&startElo=1800`.
 * Los valores inválidos se ignoran. `startElo` desplaza la escalera para que, al abrir la
 * página, el ELO objetivo sea ese (sirve para probar los extremos sin esperar horas).
 */
export function timingsFromQuery(search: string, nowMs: number = Date.now()): StreamTimings {
  const query = new URLSearchParams(search);
  const read = (name: string, fallback: number, scale = 1): number => {
    const value = Number(query.get(name));
    return Number.isFinite(value) && value > 0 ? value * scale : fallback;
  };

  const ladderMs = read('ladder', DEFAULT_TIMINGS.ladderMs);
  const startElo = Number(query.get('startElo'));
  const { minElo, maxElo } = DEFAULT_LADDER;
  let ladderOffsetMs = 0;
  if (query.get('startElo') !== null && Number.isFinite(startElo) && startElo >= minElo && startElo <= maxElo) {
    const wanted = ((startElo - minElo) / (maxElo - minElo)) * ladderMs;
    ladderOffsetMs = Math.round((wanted - (nowMs % ladderMs) + ladderMs) % ladderMs);
  }

  return {
    presentMs: read('present', DEFAULT_TIMINGS.presentMs),
    opponentMs: read('opponent', DEFAULT_TIMINGS.opponentMs),
    countdownS: Math.round(read('countdown', DEFAULT_TIMINGS.countdownS)),
    moveMs: read('move', DEFAULT_TIMINGS.moveMs),
    closeMs: read('close', DEFAULT_TIMINGS.closeMs),
    blockMs: read('block', DEFAULT_TIMINGS.blockMs),
    ladderMs,
    ladderOffsetMs,
  };
}

export const STREAM_TIMINGS = new InjectionToken<StreamTimings>('STREAM_TIMINGS', {
  providedIn: 'root',
  factory: () => timingsFromQuery(window.location.search),
});
