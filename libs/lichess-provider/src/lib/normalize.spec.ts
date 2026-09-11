import {
  extractResult,
  formatTimeControl,
  normalizeGame,
  normalizeGames,
  parseNdjson,
} from './normalize';
import { LichessGame } from './types';

function buildGame(overrides: Partial<LichessGame> = {}): LichessGame {
  return {
    id: 'aBcD1234',
    variant: 'standard',
    speed: 'blitz',
    createdAt: 1_700_000_000_000,
    lastMoveAt: 1_700_000_600_000,
    status: 'resign',
    winner: 'black',
    players: {
      white: { user: { name: 'Ana' }, rating: 1780 },
      black: { user: { name: 'Rival' }, rating: 1820 },
    },
    opening: { eco: 'C50', name: 'Italian Game' },
    clock: { initial: 300, increment: 3, totalTime: 420 },
    pgn: '[Event "Rated blitz game"]\n\n1. e4 e5 0-1',
    ...overrides,
  };
}

describe('parseNdjson', () => {
  it('lee una partida por línea', () => {
    const body = '{"id":"a"}\n{"id":"b"}\n';
    expect(parseNdjson(body).map((game) => game.id)).toEqual(['a', 'b']);
  });

  it('salta las líneas rotas en vez de fallar', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body = '{"id":"a"}\nesto no es json\n{"id":"b"}';
    expect(parseNdjson(body)).toHaveLength(2);
  });

  it('devuelve una lista vacía si no hay nada', () => {
    expect(parseNdjson('')).toEqual([]);
  });
});

describe('formatTimeControl', () => {
  it('escribe el reloj como en el PGN', () => {
    expect(formatTimeControl(buildGame())).toEqual({
      timeControl: '300+3',
      baseSeconds: 300,
      incrementSeconds: 3,
    });
  });

  it('escribe la correspondencia como días por jugada', () => {
    const game = buildGame({ clock: undefined, daysPerTurn: 3 });
    expect(formatTimeControl(game)).toEqual({
      timeControl: '1/259200',
      baseSeconds: 259200,
      incrementSeconds: 0,
    });
  });
});

describe('extractResult', () => {
  it('reconoce quién ganó', () => {
    expect(extractResult(buildGame({ winner: 'white' }))).toBe('1-0');
    expect(extractResult(buildGame({ winner: 'black' }))).toBe('0-1');
  });

  it('sin ganador y terminada son tablas', () => {
    expect(extractResult(buildGame({ winner: undefined, status: 'draw' }))).toBe(
      '1/2-1/2'
    );
  });

  it('descarta las abortadas', () => {
    expect(extractResult(buildGame({ status: 'aborted' }))).toBeNull();
  });
});

describe('normalizeGame', () => {
  it('traduce la partida al modelo común', () => {
    const game = normalizeGame(buildGame(), 'ana');

    expect(game).not.toBeNull();
    expect(game?.source).toBe('lichess');
    expect(game?.userColor).toBe('white');
    expect(game?.result).toBe('0-1');
    expect(game?.timeClass).toBe('blitz');
    expect(game?.playedAt).toBe(1_700_000_600_000);
    expect(game?.opening).toEqual({ eco: 'C50', name: 'Italian Game' });
  });

  it('descarta las variantes', () => {
    expect(normalizeGame(buildGame({ variant: 'crazyhouse' }), 'ana')).toBeNull();
  });

  it('descarta las partidas de otra gente', () => {
    expect(normalizeGame(buildGame(), 'otro')).toBeNull();
  });

  it('llama Stockfish al rival cuando es el ordenador', () => {
    const game = normalizeGame(
      buildGame({
        players: {
          white: { user: { name: 'Ana' }, rating: 1780 },
          black: { aiLevel: 5 },
        },
      }),
      'ana'
    );
    expect(game?.black.username).toBe('Stockfish');
  });

  it('marca como analizada la que trae análisis del servidor', () => {
    const game = normalizeGame(buildGame({ analysis: [{}, {}] }), 'ana');
    expect(game?.analyzed).toBe(true);
  });
});

describe('normalizeGames', () => {
  it('deja fuera lo que no sirve', () => {
    const games = normalizeGames(
      [buildGame(), buildGame({ status: 'aborted' })],
      'ana'
    );
    expect(games).toHaveLength(1);
  });
});
