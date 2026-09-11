import { RatingDataPoint } from '@chesspark/game-reporter';

import {
  monthsForRange,
  platformLabel,
  thinSeries,
  toPercent,
} from './game-analytics.util';

describe('monthsForRange', () => {
  it('cuenta hacia atrás incluyendo el mes en curso', () => {
    const months = monthsForRange(3, new Date(2026, 2, 15));

    expect(months).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ]);
  });

  it('cruza el cambio de año', () => {
    const months = monthsForRange(3, new Date(2026, 0, 5));

    expect(months).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
  });
});

describe('platformLabel', () => {
  it('usa el nombre comercial de cada plataforma', () => {
    expect(platformLabel('chess.com')).toBe('Chess.com');
    expect(platformLabel('lichess')).toBe('Lichess');
  });
});

describe('toPercent', () => {
  it('redondea a entero', () => {
    expect(toPercent(0.635)).toBe(64);
    expect(toPercent(0)).toBe(0);
  });
});

describe('thinSeries', () => {
  const buildPoints = (count: number): RatingDataPoint[] =>
    Array.from({ length: count }, (_, index) => ({
      date: index,
      rating: 1500 + index,
      platform: 'lichess' as const,
    }));

  it('no toca las series cortas', () => {
    const points = buildPoints(50);
    expect(thinSeries(points, 400)).toBe(points);
  });

  it('recorta las largas conservando el último punto', () => {
    const points = buildPoints(1000);
    const thinned = thinSeries(points, 100);

    expect(thinned.length).toBeLessThanOrEqual(101);
    expect(thinned[0]).toEqual(points[0]);
    expect(thinned[thinned.length - 1]).toEqual(points[999]);
  });
});
