/**
 * Modo Racha (muerte súbita).
 *
 * El usuario encadena puzzles de dificultad creciente y el primer fallo termina
 * la partida. A diferencia de las rutinas, no hay bloques ni set precargado: el
 * puzzle se pide de a uno con el elo que marca la rampa.
 */

export interface StreakConfig {
  /** Elo del primer puzzle de la racha. */
  eloBase: number;
  /** Cuánto sube el elo objetivo tras cada acierto. */
  step: number;
  /** Techo de dificultad: la rampa no pasa de aquí. */
  eloCap: number;
  /** Tema fijo, o 'all' para mezclar (uno distinto por puzzle). */
  theme: string | 'all';
  /** Número de saltos disponibles por racha (0 = sin saltos). */
  maxSkips: number;
}

/** Cómo terminó una racha. */
export type StreakEndReason = 'fail' | 'quit';

export interface StreakRun {
  uid: string;
  uidUser?: string;
  startedAt: number;
  finishedAt?: number;
  config: StreakConfig;
  /** Puzzles resueltos consecutivos: la puntuación de la racha. */
  score: number;
  skipsUsed: number;
  endedBy: StreakEndReason;
  /** Orden real de los puzzles jugados (incluye el fallado y los saltados). */
  puzzleUids: string[];
  /** El puzzle que rompió la racha, si terminó por fallo. */
  failedPuzzleUid?: string;
  /** Elo real más alto que llegó a jugarse, incluido el puzzle fallado. */
  maxEloReached: number;
}

export interface StreakRecord {
  uidUser?: string;
  /** Mejor racha histórica. */
  bestScore: number;
  /** Racha en la que se logró el récord. */
  bestRunUid: string;
  /** Cuándo se logró el récord. */
  achievedAt: number;
  /** Cuántas rachas ha jugado en total. */
  runsPlayed: number;
  /** Puntuación de la última racha jugada. */
  lastScore: number;
  /** Cuándo terminó la última racha. */
  lastPlayedAt: number;
}
