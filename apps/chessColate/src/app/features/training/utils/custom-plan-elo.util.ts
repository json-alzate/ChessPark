import { User } from '@chesspark/models';

import { DEFAULT_PLAN_ELO } from './plan-initial-elo.util';

/**
 * Elo con el que arranca una rutina propia o pública, según cuánto dura.
 *
 * Usa el elo total de la rutina predefinida que más se le parece por duración:
 * hasta 5 min → `plan5Total`, hasta 10 → `plan10Total`, hasta 20 → `plan20Total` y más
 * de 20 → `plan30Total`. Si el perfil no tiene el elo de ese tramo, o no hay perfil con
 * elos, se parte de 1500.
 *
 * @param totalSeconds Suma de los segundos de los bloques con tiempo (los ilimitados no suman).
 * @param elos Elos del perfil del usuario, o `undefined` si no hay perfil con elos.
 */
export function eloToStartForDuration(totalSeconds: number, elos: User['elos'] | undefined): number {
  if (!elos) {
    return DEFAULT_PLAN_ELO;
  }

  const total =
    totalSeconds <= 300
      ? elos.plan5Total
      : totalSeconds <= 600
        ? elos.plan10Total
        : totalSeconds <= 1200
          ? elos.plan20Total
          : elos.plan30Total;

  return typeof total === 'number' ? total : DEFAULT_PLAN_ELO;
}

/** Segundos totales de una lista de bloques: los que no tienen tiempo (<= 0) no suman. */
export function totalBlockSeconds(blocks: ReadonlyArray<{ time: number }>): number {
  return blocks.reduce((sum, block) => sum + (block.time > 0 ? block.time : 0), 0);
}
