/**
 * Mecánica de las vueltas: en qué orden se juega cada una, cuánto tiempo hay
 * por ejercicio y cómo avanza el progreso. Todo inmutable y puro, para que la
 * pantalla solo tenga que llamar y guardar.
 */

import { WOODPECKER_MIN_TIME_SEC } from '../config/woodpecker.config';
import {
  WoodpeckerConfig,
  WoodpeckerCycle,
  WoodpeckerOrder,
  WoodpeckerProgress,
  WoodpeckerPuzzleResult,
} from '../models/woodpecker.model';
import { shuffled } from './woodpecker-set.util';

/** Tiempos de un ejercicio con el formato que entiende el tablero (segundos restantes). */
export interface WoodpeckerPuzzleTimes {
  total: number;
  /** Cuando quedan estos segundos el reloj pasa a aviso. */
  warningOn: number;
  /** Cuando quedan estos segundos el reloj pasa a peligro. */
  dangerOn: number;
}

/**
 * Orden de los ejercicios en una vuelta.
 *
 * La vuelta 1 siempre es el orden canónico del set. Después:
 * - `same`: idéntico siempre.
 * - `reverse`: se alterna, las vueltas pares van al revés.
 * - `shuffle`: se baraja de nuevo en cada vuelta, para que no se memorice la
 *   secuencia en vez de las posiciones.
 */
export function cycleOrder(
  canonical: string[],
  cycle: number,
  order: WoodpeckerOrder,
  random: () => number = Math.random
): string[] {
  if (cycle <= 1 || order === 'same') {
    return [...canonical];
  }
  if (order === 'reverse') {
    return cycle % 2 === 0 ? [...canonical].reverse() : [...canonical];
  }
  return shuffled(canonical, random);
}

/** Lo que define el reloj de un set: lo comparten la configuración y los ritmos de la pantalla. */
export type WoodpeckerClockSpec = Pick<
  WoodpeckerConfig,
  'timing' | 'baseTimePerPuzzleSec' | 'decreasePercent'
>;

/**
 * Segundos por ejercicio en una vuelta, o `null` si no hay límite.
 * Con tiempo decreciente baja un porcentaje en cada vuelta, sin pasar del
 * mínimo para que siga siendo humanamente resoluble.
 */
export function timeForCycle(clock: WoodpeckerClockSpec, cycle: number): number | null {
  if (clock.timing === 'none' || clock.baseTimePerPuzzleSec <= 0) {
    return null;
  }
  const factor = Math.pow(1 - clock.decreasePercent / 100, Math.max(0, cycle - 1));
  return Math.max(
    WOODPECKER_MIN_TIME_SEC,
    Math.round(clock.baseTimePerPuzzleSec * factor)
  );
}

/** Segundos por ejercicio de una vuelta de un set. */
export function timePerPuzzleSec(config: WoodpeckerConfig, cycle: number): number | null {
  return timeForCycle(config, cycle);
}

/** Los tiempos del tablero para una vuelta, o `undefined` si no hay límite. */
export function puzzleTimesFor(
  config: WoodpeckerConfig,
  cycle: number
): WoodpeckerPuzzleTimes | undefined {
  const total = timePerPuzzleSec(config, cycle);
  if (total === null) {
    return undefined;
  }
  return {
    total,
    warningOn: Math.round(total * 0.5),
    dangerOn: Math.round(total * 0.25),
  };
}

/** La vuelta en curso: la última sin terminar. */
export function currentCycle(progress: WoodpeckerProgress): WoodpeckerCycle | null {
  const last = progress.cycles[progress.cycles.length - 1];
  return last && last.finishedAt === undefined ? last : null;
}

/** Número de la próxima vuelta por empezar, o `null` si ya se hicieron todas. */
export function nextCycleNumber(
  progress: WoodpeckerProgress,
  config: WoodpeckerConfig
): number | null {
  if (progress.completedAt !== undefined) {
    return null;
  }
  const done = progress.cycles.filter((cycle) => cycle.finishedAt !== undefined).length;
  return done < config.cycles ? done + 1 : null;
}

/** Progreso vacío de un set recién creado. */
export function emptyProgress(setId: string): WoodpeckerProgress {
  return { setId, cycles: [] };
}

/**
 * Abre la siguiente vuelta. Si ya hay una en curso, o ya se hicieron todas, no
 * cambia nada: así reanudar y empezar son la misma llamada.
 */
export function startCycle(
  progress: WoodpeckerProgress,
  config: WoodpeckerConfig,
  canonicalUids: string[],
  now: number,
  random: () => number = Math.random
): WoodpeckerProgress {
  if (currentCycle(progress)) {
    return progress;
  }
  const next = nextCycleNumber(progress, config);
  if (next === null) {
    return progress;
  }
  const cycle: WoodpeckerCycle = {
    cycle: next,
    order: cycleOrder(canonicalUids, next, config.order, random),
    startedAt: now,
    results: [],
  };
  return { ...progress, cycles: [...progress.cycles, cycle] };
}

/** El ejercicio que toca jugar en la vuelta en curso, o `null` si ya se jugaron todos. */
export function nextPuzzleUid(cycle: WoodpeckerCycle): string | null {
  return cycle.order[cycle.results.length] ?? null;
}

export function isCycleComplete(cycle: WoodpeckerCycle): boolean {
  return cycle.results.length >= cycle.order.length;
}

/**
 * Anota cómo salió el ejercicio actual de la vuelta en curso. Ignora el
 * resultado si no hay vuelta en curso, si ya está completa o si no es el
 * ejercicio que tocaba: un evento tardío del tablero no debe correr la vuelta.
 */
export function recordResult(
  progress: WoodpeckerProgress,
  result: WoodpeckerPuzzleResult
): WoodpeckerProgress {
  const cycle = currentCycle(progress);
  if (!cycle || isCycleComplete(cycle) || nextPuzzleUid(cycle) !== result.uidPuzzle) {
    return progress;
  }
  const updated: WoodpeckerCycle = { ...cycle, results: [...cycle.results, result] };
  return { ...progress, cycles: [...progress.cycles.slice(0, -1), updated] };
}

/**
 * Cierra la vuelta en curso (debe estar completa). Si era la última, el set
 * queda terminado.
 */
export function finishCycle(
  progress: WoodpeckerProgress,
  config: WoodpeckerConfig,
  now: number
): WoodpeckerProgress {
  const cycle = currentCycle(progress);
  if (!cycle || !isCycleComplete(cycle)) {
    return progress;
  }
  const closed: WoodpeckerCycle = { ...cycle, finishedAt: now };
  const cycles = [...progress.cycles.slice(0, -1), closed];
  const isLast = closed.cycle >= config.cycles;
  return { ...progress, cycles, completedAt: isLast ? now : progress.completedAt };
}
