import { ChessGame } from '@cpark/models';

import { ReportFilters } from './types';

/**
 * Deja solo las partidas que encajan con lo que pide la pantalla.
 *
 * Se aplica una vez y el resultado alimenta todos los reportes: recalcular los
 * filtros dentro de cada uno multiplicaría el trabajo por cinco sin ganar nada.
 */
export function applyFilters(
  games: ChessGame[],
  filters: ReportFilters = {}
): ChessGame[] {
  const from = filters.dateFrom?.getTime();
  const to = filters.dateTo?.getTime();
  const timeClasses = filters.timeClasses?.length
    ? new Set(filters.timeClasses)
    : null;

  return games.filter((game) => {
    if (
      filters.platform &&
      filters.platform !== 'both' &&
      game.source !== filters.platform
    ) {
      return false;
    }
    if (timeClasses && !timeClasses.has(game.timeClass)) {
      return false;
    }
    if (from !== undefined && game.playedAt < from) {
      return false;
    }
    if (to !== undefined && game.playedAt > to) {
      return false;
    }
    if (
      filters.timeControlMin !== undefined &&
      game.timeControlSeconds < filters.timeControlMin
    ) {
      return false;
    }
    if (
      filters.timeControlExact !== undefined &&
      game.timeControlSeconds !== filters.timeControlExact
    ) {
      return false;
    }
    if (filters.color && game.userColor !== filters.color) {
      return false;
    }
    return true;
  });
}
