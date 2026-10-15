/**
 * Lo mínimo del Pájaro Carpintero que necesita la tarjeta del inicio: si hay
 * set y por dónde va. Pura, para que el inicio no tenga que cargar los
 * servicios de la funcionalidad solo por pintar una tarjeta.
 */

import { WoodpeckerState } from '../models/woodpecker.model';
import { currentCycle, nextCycleNumber } from './woodpecker-cycle.util';

export interface WoodpeckerHomeSummary {
  completed: boolean;
  /** La vuelta que toca (o la última, si el set ya terminó). */
  cycle: number;
  cycles: number;
  /** Ejercicios jugados de la vuelta en curso (0 si no hay una abierta). */
  answered: number;
  /** Ejercicios del set. */
  total: number;
}

/** `null` si no hay set. */
export function homeSummary(state: WoodpeckerState | null): WoodpeckerHomeSummary | null {
  if (!state) {
    return null;
  }
  const { set, progress } = state;
  const active = currentCycle(progress);
  const completed = progress.completedAt !== undefined;

  return {
    completed,
    cycle: active?.cycle ?? nextCycleNumber(progress, set.config) ?? set.config.cycles,
    cycles: set.config.cycles,
    answered: active?.results.length ?? 0,
    total: set.puzzles.length,
  };
}
