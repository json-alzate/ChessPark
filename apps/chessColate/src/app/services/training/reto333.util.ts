import { UserPuzzle } from '@cpark/models';

/** Puzzles que hay que resolver para completar el Reto 333. */
export const RETO333_TARGET = 333;

/** Elo con el que arranca la rampa del Reto 333. */
export const RETO333_START_ELO = 400;

/** Puntos de elo que sube la rampa por cada puzzle resuelto. */
export const RETO333_ELO_STEP = 10;

/** Resumen de un intento de Reto 333, sin el elo que alcanzó (lo lleva la pantalla). */
export interface Reto333Summary {
  /** Puzzles resueltos en el intento. */
  score: number;
  /** Duración en segundos, redondeada hacia abajo. */
  timeSeconds: number;
  /** Duración ya formateada como "Xm Ys". */
  timeString: string;
  /** Si se llegó a los 333 resueltos. */
  completed: boolean;
}

/**
 * Calcula el resumen del intento de Reto 333 al terminar la sesión.
 *
 * Se cuentan solo los puzzles resueltos (los fallados no suman) y el tiempo
 * sale del reloj real desde el inicio, no de la suma de tiempos por puzzle,
 * porque el usuario también gasta tiempo en ver soluciones y en la pantalla de
 * bloque.
 *
 * @param puzzlesPlayed Puzzles jugados en el bloque del Reto 333.
 * @param startTime Instante (ms) en que empezó el intento, o `null` si nunca arrancó.
 * @param now Instante (ms) en que termina el intento.
 * @returns Resumen listo para guardar como marca y mostrar al usuario.
 */
export function summarizeReto333(
  puzzlesPlayed: UserPuzzle[],
  startTime: number | null,
  now: number
): Reto333Summary {
  const score = puzzlesPlayed.filter((p) => p.resolved).length;
  const timeSeconds = startTime ? Math.floor((now - startTime) / 1000) : 0;

  return {
    score,
    timeSeconds,
    timeString: formatMinutesSeconds(timeSeconds),
    completed: score >= RETO333_TARGET,
  };
}

/** Formatea segundos como "Xm Ys" (por ejemplo, 125 → "2m 5s"). */
export function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}
