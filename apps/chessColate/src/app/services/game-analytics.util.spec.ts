import { ChessGame } from '@cpark/models';
import { RatingDataPoint } from '@chesspark/game-reporter';

import {
  boardOrientation,
  monthsForRange,
  newestFirst,
  opponentOf,
  platformLabel,
  rangeStart,
  thinSeries,
  toPercent,
} from './game-analytics.util';

function buildGame(overrides: Partial<ChessGame> = {}): ChessGame {
  return {
    id: 'g1',
    source: 'lichess',
    pgn: '1. e4 e5',
    timeControl: '300+0',
    timeControlSeconds: 300,
    incrementSeconds: 0,
    timeClass: 'blitz',
    playedAt: 1_000,
    white: { username: 'ana', rating: 1500 },
    black: { username: 'rival', rating: 1600 },
    result: '1-0',
    userColor: 'white',
    variant: 'standard',
    analyzed: false,
    ...overrides,
  };
}

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

describe('rangeStart', () => {
  it('empieza el primer día del mes más antiguo del rango', () => {
    expect(rangeStart(3, new Date(2026, 2, 15))).toBe(
      new Date(2026, 0, 1).getTime()
    );
  });

  it('con un solo mes, empieza el día 1 del mes en curso', () => {
    expect(rangeStart(1, new Date(2026, 2, 15))).toBe(
      new Date(2026, 2, 1).getTime()
    );
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

describe('newestFirst', () => {
  it('pone primero la partida más reciente', () => {
    const games = [
      buildGame({ id: 'vieja', playedAt: 1_000 }),
      buildGame({ id: 'nueva', playedAt: 3_000 }),
      buildGame({ id: 'media', playedAt: 2_000 }),
    ];

    expect(newestFirst(games).map((game) => game.id)).toEqual([
      'nueva',
      'media',
      'vieja',
    ]);
  });

  it('no desordena la lista original', () => {
    const games = [buildGame({ id: 'a', playedAt: 1 }), buildGame({ id: 'b', playedAt: 2 })];
    newestFirst(games);
    expect(games[0].id).toBe('a');
  });
});

describe('opponentOf', () => {
  it('con blancas, el rival es quien lleva negras', () => {
    expect(opponentOf(buildGame({ userColor: 'white' })).username).toBe('rival');
  });

  it('con negras, el rival es quien lleva blancas', () => {
    expect(opponentOf(buildGame({ userColor: 'black' })).username).toBe('ana');
  });
});

describe('boardOrientation', () => {
  it('ve el tablero desde el color con el que jugó el usuario', () => {
    expect(boardOrientation(buildGame({ userColor: 'white' }))).toBe('w');
    expect(boardOrientation(buildGame({ userColor: 'black' }))).toBe('b');
  });
});
