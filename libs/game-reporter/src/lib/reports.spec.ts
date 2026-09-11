import { ChessGame } from '@cpark/models';

import { applyFilters } from './filters';
import {
  getActivityHeatmap,
  getGeneralStats,
  getOpeningStats,
  getRatingProgress,
} from './reports';

/** Una fecha fija para que las pruebas no dependan del día en que se corran. */
const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date(2026, 0, 10, 12, 0, 0).getTime();

function buildGame(overrides: Partial<ChessGame> = {}): ChessGame {
  return {
    id: 'g1',
    source: 'lichess',
    pgn: '1. e4 e5',
    timeControl: '300+0',
    timeControlSeconds: 300,
    incrementSeconds: 0,
    timeClass: 'blitz',
    playedAt: BASE,
    white: { username: 'ana', rating: 1500 },
    black: { username: 'rival', rating: 1600 },
    result: '1-0',
    userColor: 'white',
    opening: { eco: 'C50', name: 'Italian Game' },
    variant: 'standard',
    analyzed: false,
    ...overrides,
  };
}

describe('getRatingProgress', () => {
  it('devuelve el rating del usuario, ordenado por fecha', () => {
    const games = [
      buildGame({ id: 'b', playedAt: BASE + DAY, white: { username: 'ana', rating: 1520 } }),
      buildGame({ id: 'a', playedAt: BASE }),
    ];

    expect(getRatingProgress(games)).toEqual([
      { date: BASE, rating: 1500, platform: 'lichess' },
      { date: BASE + DAY, rating: 1520, platform: 'lichess' },
    ]);
  });

  it('salta las partidas sin rating', () => {
    const games = [buildGame({ white: { username: 'ana', rating: 0 } })];
    expect(getRatingProgress(games)).toEqual([]);
  });
});

describe('getGeneralStats', () => {
  it('cuenta victorias, derrotas y tablas desde el color del usuario', () => {
    const games = [
      buildGame({ id: '1', result: '1-0', userColor: 'white' }),
      buildGame({ id: '2', result: '1-0', userColor: 'black' }),
      buildGame({ id: '3', result: '1/2-1/2' }),
    ];

    const stats = getGeneralStats(games);

    expect(stats.games).toBe(3);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.draws).toBe(1);
    // Las tablas valen medio punto: (1 + 0.5) / 3
    expect(stats.winRate).toBeCloseTo(0.5);
  });

  it('separa por plataforma, tiempo y color', () => {
    const games = [
      buildGame({ id: '1', source: 'lichess', timeClass: 'blitz' }),
      buildGame({
        id: '2',
        source: 'chess.com',
        timeClass: 'rapid',
        userColor: 'black',
      }),
    ];

    const stats = getGeneralStats(games);

    expect(stats.byPlatform['lichess']?.games).toBe(1);
    expect(stats.byPlatform['chess.com']?.games).toBe(1);
    expect(stats.byTimeClass['blitz']?.games).toBe(1);
    expect(stats.byTimeClass['rapid']?.games).toBe(1);
    expect(stats.byColor.white.games).toBe(1);
    expect(stats.byColor.black.games).toBe(1);
  });

  it('promedia el rating del rival', () => {
    const games = [
      buildGame({ id: '1', black: { username: 'r1', rating: 1600 } }),
      buildGame({ id: '2', black: { username: 'r2', rating: 1400 } }),
    ];
    expect(getGeneralStats(games).averageOpponentRating).toBe(1500);
  });

  it('cuenta la racha desde la partida más reciente', () => {
    const games = [
      buildGame({ id: '1', playedAt: BASE, result: '0-1' }),
      buildGame({ id: '2', playedAt: BASE + DAY, result: '1-0' }),
      buildGame({ id: '3', playedAt: BASE + 2 * DAY, result: '1-0' }),
    ];
    expect(getGeneralStats(games).currentStreak).toBe(2);
  });

  it('la racha es negativa si viene de perder', () => {
    const games = [
      buildGame({ id: '1', playedAt: BASE, result: '1-0' }),
      buildGame({ id: '2', playedAt: BASE + DAY, result: '0-1' }),
    ];
    expect(getGeneralStats(games).currentStreak).toBe(-1);
  });

  it('aguanta que no haya partidas', () => {
    const stats = getGeneralStats([]);
    expect(stats.games).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.currentStreak).toBe(0);
  });
});

describe('getOpeningStats', () => {
  it('agrupa por ECO y ordena por partidas jugadas', () => {
    const games = [
      buildGame({ id: '1', opening: { eco: 'C50', name: 'Italian Game' } }),
      buildGame({
        id: '2',
        opening: { eco: 'C50', name: 'Italiana' },
        userColor: 'black',
      }),
      buildGame({ id: '3', opening: { eco: 'B90', name: 'Najdorf' } }),
    ];

    const rows = getOpeningStats(games);

    expect(rows).toHaveLength(2);
    expect(rows[0].eco).toBe('C50');
    expect(rows[0].games).toBe(2);
    expect(rows[0].asWhite).toBe(1);
    expect(rows[0].asBlack).toBe(1);
  });

  it('ignora las partidas sin apertura identificada', () => {
    expect(getOpeningStats([buildGame({ opening: undefined })])).toEqual([]);
  });
});

describe('getActivityHeatmap', () => {
  it('rellena los días sin partidas para poder dibujarlos', () => {
    const games = [
      buildGame({ id: '1', playedAt: BASE }),
      buildGame({ id: '2', playedAt: BASE }),
      buildGame({ id: '3', playedAt: BASE + 2 * DAY }),
    ];

    const days = getActivityHeatmap(games);

    expect(days).toEqual([
      { date: '2026-01-10', games: 2 },
      { date: '2026-01-11', games: 0 },
      { date: '2026-01-12', games: 1 },
    ]);
  });

  it('sin partidas no hay mapa', () => {
    expect(getActivityHeatmap([])).toEqual([]);
  });
});

describe('applyFilters', () => {
  const games = [
    buildGame({ id: '1', source: 'lichess', timeClass: 'blitz', playedAt: BASE }),
    buildGame({
      id: '2',
      source: 'chess.com',
      timeClass: 'rapid',
      timeControlSeconds: 600,
      playedAt: BASE + 10 * DAY,
      userColor: 'black',
    }),
  ];

  it('sin filtros no quita nada', () => {
    expect(applyFilters(games)).toHaveLength(2);
  });

  it('filtra por plataforma', () => {
    expect(applyFilters(games, { platform: 'lichess' })).toHaveLength(1);
    expect(applyFilters(games, { platform: 'both' })).toHaveLength(2);
  });

  it('filtra por familia de tiempo', () => {
    expect(applyFilters(games, { timeClasses: ['rapid'] })[0].id).toBe('2');
  });

  it('filtra por fechas', () => {
    const result = applyFilters(games, {
      dateFrom: new Date(BASE + DAY),
    });
    expect(result.map((game) => game.id)).toEqual(['2']);
  });

  it('filtra por tiempo mínimo y exacto', () => {
    expect(applyFilters(games, { timeControlMin: 500 })[0].id).toBe('2');
    expect(applyFilters(games, { timeControlExact: 300 })[0].id).toBe('1');
  });

  it('filtra por color', () => {
    expect(applyFilters(games, { color: 'black' })[0].id).toBe('2');
  });
});
