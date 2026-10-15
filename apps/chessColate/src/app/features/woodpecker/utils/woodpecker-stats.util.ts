/**
 * Medición del progreso: lo que se enseña al terminar cada vuelta y en el
 * resumen final. Es el corazón del método, porque la mejora solo se ve
 * comparando las vueltas sobre el mismo material.
 */

import {
  WOODPECKER_MAX_RECORDED_MS,
  WOODPECKER_PROBLEM_MIN_FAILURES,
} from '../config/woodpecker.config';
import {
  WoodpeckerCycle,
  WoodpeckerCycleComparison,
  WoodpeckerCycleSummary,
  WoodpeckerProblemPuzzle,
} from '../models/woodpecker.model';

/** Tiempo que se anota por un ejercicio: lo medido, sin pasarse del tope. */
export function clampRecordedTime(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return 0;
  }
  return Math.min(Math.round(elapsedMs), WOODPECKER_MAX_RECORDED_MS);
}

/** Resumen de una vuelta, terminada o en curso. */
export function summarizeCycle(cycle: WoodpeckerCycle): WoodpeckerCycleSummary {
  const answered = cycle.results.length;
  const solved = cycle.results.filter((result) => result.resolved).length;
  const failedByTime = cycle.results.filter((result) => result.failByTime).length;
  const totalTimeMs = cycle.results.reduce((sum, result) => sum + result.timeMs, 0);

  return {
    cycle: cycle.cycle,
    total: cycle.order.length,
    answered,
    solved,
    failed: answered - solved,
    failedByTime,
    accuracy: answered > 0 ? (solved / answered) * 100 : 0,
    totalTimeMs,
    avgTimeMs: answered > 0 ? totalTimeMs / answered : 0,
    finished: cycle.finishedAt !== undefined,
  };
}

/** Resúmenes de las vueltas ya terminadas, en orden. */
export function finishedSummaries(cycles: WoodpeckerCycle[]): WoodpeckerCycleSummary[] {
  return cycles
    .filter((cycle) => cycle.finishedAt !== undefined)
    .map((cycle) => summarizeCycle(cycle));
}

/** Cómo cambió una vuelta respecto a la anterior. */
export function compareCycles(
  previous: WoodpeckerCycleSummary,
  current: WoodpeckerCycleSummary
): WoodpeckerCycleComparison {
  return {
    accuracyDelta: current.accuracy - previous.accuracy,
    timeDeltaPercent:
      previous.totalTimeMs > 0
        ? ((current.totalTimeMs - previous.totalTimeMs) / previous.totalTimeMs) * 100
        : null,
  };
}

/**
 * Ejercicios que se fallan en varias vueltas terminadas: los candidatos a
 * repasar con calma. De los más fallados a los menos.
 */
export function problemPuzzles(
  cycles: WoodpeckerCycle[],
  minFailures: number = WOODPECKER_PROBLEM_MIN_FAILURES
): WoodpeckerProblemPuzzle[] {
  const failures = new Map<string, number>();
  for (const cycle of cycles) {
    if (cycle.finishedAt === undefined) {
      continue;
    }
    for (const result of cycle.results) {
      if (!result.resolved) {
        failures.set(result.uidPuzzle, (failures.get(result.uidPuzzle) ?? 0) + 1);
      }
    }
  }

  return [...failures.entries()]
    .filter(([, count]) => count >= minFailures)
    .map(([uidPuzzle, count]) => ({ uidPuzzle, failures: count }))
    .sort((a, b) => b.failures - a.failures || a.uidPuzzle.localeCompare(b.uidPuzzle));
}

/**
 * Resumen de la vuelta más reciente y lo que cambió respecto a la anterior.
 * `previous` y `comparison` son `null` en la primera vuelta.
 */
export function latestCycleReport(cycles: WoodpeckerCycle[]): {
  current: WoodpeckerCycleSummary;
  previous: WoodpeckerCycleSummary | null;
  comparison: WoodpeckerCycleComparison | null;
} | null {
  const summaries = finishedSummaries(cycles);
  const current = summaries[summaries.length - 1];
  if (!current) {
    return null;
  }
  const previous = summaries[summaries.length - 2] ?? null;
  return {
    current,
    previous,
    comparison: previous ? compareCycles(previous, current) : null,
  };
}
