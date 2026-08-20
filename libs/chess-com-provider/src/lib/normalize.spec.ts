import {
  extractOpening,
  extractResult,
  normalizeGame,
  normalizeGames,
  openingNameFromUrl,
  parseTimeControl,
} from './normalize';
import { ChessComGame } from './types';

const PGN = [
  '[Event "Live Chess"]',
  '[Site "Chess.com"]',
  '[White "ana"]',
  '[Black "rival"]',
  '[Result "1-0"]',
  '[ECO "B90"]',
  '[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3"]',
  '[TimeControl "180+2"]',
  '',
  '1. e4 c5 2. Nf3 d6 1-0',
].join('\n');

function buildGame(overrides: Partial<ChessComGame> = {}): ChessComGame {
  return {
    uuid: 'abc-123',
    pgn: PGN,
    time_control: '180+2',
    end_time: 1_700_000_000,
    rules: 'chess',
    white: { username: 'Ana', rating: 1450, result: 'win' },
    black: { username: 'Rival', rating: 1420, result: 'resigned' },
    ...overrides,
  };
}

describe('parseTimeControl', () => {
  it('lee el tiempo base sin incremento', () => {
    expect(parseTimeControl('600')).toEqual({
      baseSeconds: 600,
      incrementSeconds: 0,
    });
  });

  it('lee el incremento cuando lo hay', () => {
    expect(parseTimeControl('180+2')).toEqual({
      baseSeconds: 180,
      incrementSeconds: 2,
    });
  });

  it('lee la correspondencia como segundos por jugada', () => {
    expect(parseTimeControl('1/86400')).toEqual({
      baseSeconds: 86400,
      incrementSeconds: 0,
    });
  });

  it('no se rompe si no viene', () => {
    expect(parseTimeControl(undefined)).toEqual({
      baseSeconds: 0,
      incrementSeconds: 0,
    });
  });
});

describe('openingNameFromUrl', () => {
  it('convierte el final de la URL en un nombre legible', () => {
    expect(
      openingNameFromUrl(
        'https://www.chess.com/openings/Italian-Game-Giuoco-Piano'
      )
    ).toBe('Italian Game Giuoco Piano');
  });

  it('corta la línea concreta para no partir la apertura en muchas filas', () => {
    expect(
      openingNameFromUrl(
        'https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3-e5'
      )
    ).toBe('Sicilian Defense Najdorf Variation');
  });
});

describe('extractOpening', () => {
  it('saca el ECO del PGN y el nombre de la URL', () => {
    expect(extractOpening(PGN)).toEqual({
      eco: 'B90',
      name: 'Sicilian Defense Najdorf Variation',
    });
  });

  it('devuelve undefined si el PGN no dice nada de la apertura', () => {
    expect(extractOpening('[White "ana"]\n\n1. e4 e5')).toBeUndefined();
  });
});

describe('extractResult', () => {
  it('reconoce la victoria de las blancas', () => {
    expect(extractResult(buildGame())).toBe('1-0');
  });

  it('reconoce la victoria de las negras', () => {
    const game = buildGame({
      white: { username: 'Ana', rating: 1450, result: 'timeout' },
      black: { username: 'Rival', rating: 1420, result: 'win' },
    });
    expect(extractResult(game)).toBe('0-1');
  });

  it('reconoce las tablas', () => {
    const game = buildGame({
      white: { username: 'Ana', rating: 1450, result: 'agreed' },
      black: { username: 'Rival', rating: 1420, result: 'agreed' },
    });
    expect(extractResult(game)).toBe('1/2-1/2');
  });

  it('devuelve null si la partida sigue en juego', () => {
    const game = buildGame({
      white: { username: 'Ana', rating: 1450 },
      black: { username: 'Rival', rating: 1420 },
    });
    expect(extractResult(game)).toBeNull();
  });
});

describe('normalizeGame', () => {
  it('traduce la partida al modelo común', () => {
    const game = normalizeGame(buildGame(), 'ana');

    expect(game).not.toBeNull();
    expect(game?.source).toBe('chess.com');
    expect(game?.userColor).toBe('white');
    expect(game?.result).toBe('1-0');
    expect(game?.timeControlSeconds).toBe(180);
    expect(game?.incrementSeconds).toBe(2);
    expect(game?.timeClass).toBe('blitz');
    expect(game?.playedAt).toBe(1_700_000_000_000);
    expect(game?.opening?.eco).toBe('B90');
    expect(game?.analyzed).toBe(false);
  });

  it('encuentra al usuario aunque no coincidan las mayúsculas', () => {
    expect(normalizeGame(buildGame(), 'RIVAL')?.userColor).toBe('black');
  });

  it('descarta las variantes que no son ajedrez estándar', () => {
    expect(normalizeGame(buildGame({ rules: 'chess960' }), 'ana')).toBeNull();
  });

  it('descarta las partidas en las que el usuario no juega', () => {
    expect(normalizeGame(buildGame(), 'otro')).toBeNull();
  });

  it('marca como analizada la que trae precisión', () => {
    const game = normalizeGame(
      buildGame({ accuracies: { white: 91.2, black: 84.5 } }),
      'ana'
    );
    expect(game?.analyzed).toBe(true);
  });
});

describe('normalizeGames', () => {
  it('deja fuera lo que no sirve y conserva el resto', () => {
    const games = normalizeGames(
      [buildGame(), buildGame({ rules: 'bughouse' }), buildGame({ uuid: 'x' })],
      'ana'
    );
    expect(games).toHaveLength(2);
  });
});
