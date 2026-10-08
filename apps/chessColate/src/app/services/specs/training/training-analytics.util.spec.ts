import { Puzzle } from '@chesspark/models';

import {
  puzzleCompletedPayload,
  puzzleStartedPayload,
  reto333FinishedPayload,
} from '../../training/training-analytics.util';

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    uid: 'p1',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    moves: 'e2e4',
    rating: 1500,
    ratingDeviation: 50,
    popularity: 90,
    randomNumberQuery: 0.5,
    nbPlays: 100,
    themes: ['pin', 'fork'],
    gameUrl: '',
    openingFamily: '',
    openingVariation: '',
    ...overrides,
  };
}

/**
 * Las aserciones usan `toEqual` con el objeto completo a propósito: fijan el
 * conjunto exacto de campos de cada evento, no solo los valores.
 */
describe('puzzleStartedPayload', () => {
  it('en una rutina por defecto reporta la familia, los minutos y el tema del bloque', () => {
    expect(
      puzzleStartedPayload({ planType: 'plan5', blockTheme: 'mateIn1', puzzle: makePuzzle() })
    ).toEqual({
      routine_kind: 'default',
      routine_minutes: 5,
      theme: 'mateIn1',
      puzzle_elo: 1500,
    });
  });

  it('sin tema de bloque (rutina infinita) reporta el primer tema del puzzle servido', () => {
    expect(
      puzzleStartedPayload({ planType: 'infinity', blockTheme: '', puzzle: makePuzzle() })
    ).toEqual({
      routine_kind: 'infinity',
      routine_minutes: 0,
      theme: 'pin',
      puzzle_elo: 1500,
    });
  });

  it('sin tema en ningún sitio reporta cadena vacía, y sin rating reporta 0', () => {
    const puzzle = makePuzzle({ themes: [], rating: undefined as unknown as number });

    expect(puzzleStartedPayload({ planType: 'reto333', puzzle })).toEqual({
      routine_kind: 'reto333',
      routine_minutes: 0,
      theme: '',
      puzzle_elo: 0,
    });
  });
});

describe('puzzleCompletedPayload', () => {
  it('un acierto lleva el resultado, el elo del puzzle y del usuario, el tiempo, el primer tema y la rutina', () => {
    expect(
      puzzleCompletedPayload({
        planType: 'plan10',
        puzzle: makePuzzle({ timeUsed: 7 }),
        result: 'good',
        userElo: 1600,
      })
    ).toEqual({
      result: 'good',
      puzzle_elo: 1500,
      user_elo: 1600,
      resolved_time: 7,
      first_theme: 'pin',
      routine_kind: 'default',
      routine_minutes: 10,
    });
  });

  it('un fallo se reporta tal cual', () => {
    expect(
      puzzleCompletedPayload({ planType: 'plan5', puzzle: makePuzzle(), result: 'bad', userElo: 1 })
        .result
    ).toBe('bad');
  });

  it('el fallo por tiempo del tablero se reporta como "timeout"', () => {
    expect(
      puzzleCompletedPayload({ planType: 'plan5', puzzle: makePuzzle(), result: 'timeOut', userElo: 1 })
        .result
    ).toBe('timeout');
  });

  it('sin sesión, sin tiempo usado y sin temas reporta ceros y cadena vacía', () => {
    const puzzle = makePuzzle({ themes: [], timeUsed: undefined });

    expect(puzzleCompletedPayload({ planType: 'custom', puzzle, result: 'good' })).toEqual({
      result: 'good',
      puzzle_elo: 1500,
      user_elo: 0,
      resolved_time: 0,
      first_theme: '',
      routine_kind: 'custom',
      routine_minutes: 0,
    });
  });

  it('toma la familia de la rutina del tipo de plan', () => {
    const base = { puzzle: makePuzzle(), result: 'good' as const, userElo: 1 };

    expect(puzzleCompletedPayload({ ...base, planType: 'reto333' })).toEqual(
      expect.objectContaining({ routine_kind: 'reto333', routine_minutes: 0 })
    );
    expect(puzzleCompletedPayload({ ...base, planType: 'infinity' })).toEqual(
      expect.objectContaining({ routine_kind: 'infinity', routine_minutes: 0 })
    );
    expect(puzzleCompletedPayload({ ...base, planType: 'plan30' })).toEqual(
      expect.objectContaining({ routine_kind: 'default', routine_minutes: 30 })
    );
  });
});

describe('reto333FinishedPayload', () => {
  it('copia el resumen del intento, el elo alcanzado y la mejor marca', () => {
    expect(
      reto333FinishedPayload({
        summary: { score: 12, timeSeconds: 125, timeString: '2m 5s', completed: false },
        elo: 520,
        bestScore: 40,
      })
    ).toEqual({
      solved_count: 12,
      time_seconds: 125,
      elo: 520,
      completed: false,
      best_score: 40,
    });
  });

  it('un intento completado se reporta como tal', () => {
    expect(
      reto333FinishedPayload({
        summary: { score: 333, timeSeconds: 9000, timeString: '150m 0s', completed: true },
        elo: 3730,
        bestScore: 333,
      }).completed
    ).toBe(true);
  });
});
