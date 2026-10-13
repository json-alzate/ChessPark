/** La escalera de dificultad: el ELO sube poco a poco y, al llegar al tope, vuelve a empezar. */
export interface EloLadder {
  minElo: number;
  maxElo: number;
  /** Cuánto tarda en subir de `minElo` a `maxElo`. */
  periodMs: number;
}

export const DEFAULT_LADDER: EloLadder = {
  minElo: 600,
  maxElo: 2200,
  periodMs: 2 * 60 * 60_000,
};

/**
 * ELO objetivo en un instante.
 *
 * Sube en línea recta con la hora (no con el tema), así que entre un puzzle y el siguiente
 * apenas se mueve. Como el resto del programa, depende solo de la hora: un reinicio del
 * runner retoma la escalera donde iba.
 */
export function eloAt(nowMs: number, ladder: EloLadder): number {
  const progress = (nowMs % ladder.periodMs) / ladder.periodMs;
  return Math.round(ladder.minElo + progress * (ladder.maxElo - ladder.minElo));
}
