/**
 * Lógica pura de la pantalla de Análisis de partidas (sin Angular ni red):
 * cuentas conectadas, rangos de historial y preparación de las gráficas.
 */

import {
  ArchiveMonth,
  archiveMonthsBetween,
  ChessPlatform,
  TimeClass,
} from '@cpark/models';
import { RatingDataPoint } from '@chesspark/game-reporter';

/** Una cuenta conectada por el usuario. */
export interface ConnectedAccounts {
  /** Nombre en chess.com; vacío si no la ha conectado. */
  chesscom: string;
  /** Nombre en lichess; vacío si no la ha conectado. */
  lichess: string;
}

export const EMPTY_ACCOUNTS: ConnectedAccounts = { chesscom: '', lichess: '' };

/** Cuánto historial se baja la primera vez, en meses. */
export const HISTORY_RANGES = [3, 6, 12, 24] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const DEFAULT_HISTORY_RANGE: HistoryRange = 6;

/** Las familias de tiempo que se ofrecen como filtro, en orden de reloj. */
export const TIME_CLASSES: TimeClass[] = [
  'bullet',
  'blitz',
  'rapid',
  'classical',
  'daily',
];

/** Lo que la pantalla guarda entre visitas. */
export interface GameAnalyticsSettings {
  accounts: ConnectedAccounts;
  historyMonths: HistoryRange;
}

export const DEFAULT_SETTINGS: GameAnalyticsSettings = {
  accounts: EMPTY_ACCOUNTS,
  historyMonths: DEFAULT_HISTORY_RANGE,
};

/**
 * Los meses que cubre un rango contado hacia atrás desde hoy.
 *
 * El mes en curso siempre entra: quien acaba de jugar espera ver esa partida.
 */
export function monthsForRange(months: number, now = new Date()): ArchiveMonth[] {
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return archiveMonthsBetween(from, now);
}

/** El nombre visible de una plataforma. */
export function platformLabel(platform: ChessPlatform): string {
  return platform === 'chess.com' ? 'Chess.com' : 'Lichess';
}

/** Un porcentaje entero listo para pintar: 0,635 → 64. */
export function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * Adelgaza la serie de rating a un máximo de puntos.
 *
 * Un año de blitz son miles de partidas y Chart.js las dibujaría todas: la
 * gráfica tarda y no se lee mejor. Se toma una de cada N conservando siempre
 * el primer y el último punto, que son los que marcan la tendencia.
 */
export function thinSeries(
  points: RatingDataPoint[],
  maxPoints = 400
): RatingDataPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = Math.ceil(points.length / maxPoints);
  const thinned = points.filter((_, index) => index % step === 0);

  const last = points[points.length - 1];
  if (thinned[thinned.length - 1] !== last) {
    thinned.push(last);
  }
  return thinned;
}
