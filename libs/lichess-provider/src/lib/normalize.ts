import {
  ChessGame,
  ChessGameOpening,
  GameResult,
  timeClassFor,
} from '@cpark/models';

import { LichessGame } from './types';

/** Estados en los que la partida no llegó a contar como jugada. */
const UNPLAYED_STATUS = new Set(['created', 'started', 'aborted', 'noStart']);

/** Un día en segundos: base de las partidas por correspondencia. */
const SECONDS_PER_DAY = 24 * 60 * 60;

/** Lee cada línea del NDJSON; las líneas rotas se ignoran en vez de tumbar todo. */
export function parseNdjson(body: string): LichessGame[] {
  const games: LichessGame[] = [];

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      games.push(JSON.parse(trimmed) as LichessGame);
    } catch {
      console.warn('[LichessProvider] Línea del NDJSON ilegible, se salta');
    }
  }

  return games;
}

/**
 * El control de tiempo en el formato del PGN: '180+2'. En correspondencia
 * lichess da días por jugada, que se escriben como '1/86400' —igual que
 * chess.com— para que las dos plataformas se lean con la misma regla.
 */
export function formatTimeControl(game: LichessGame): {
  timeControl: string;
  baseSeconds: number;
  incrementSeconds: number;
} {
  if (game.clock) {
    const baseSeconds = game.clock.initial ?? 0;
    const incrementSeconds = game.clock.increment ?? 0;
    return {
      timeControl: `${baseSeconds}+${incrementSeconds}`,
      baseSeconds,
      incrementSeconds,
    };
  }

  const days = game.daysPerTurn ?? 1;
  const baseSeconds = days * SECONDS_PER_DAY;
  return {
    timeControl: `1/${baseSeconds}`,
    baseSeconds,
    incrementSeconds: 0,
  };
}

/** El resultado de la partida, o null si no llegó a terminar. */
export function extractResult(game: LichessGame): GameResult | null {
  if (UNPLAYED_STATUS.has(game.status ?? '')) {
    return null;
  }
  if (game.winner === 'white') {
    return '1-0';
  }
  if (game.winner === 'black') {
    return '0-1';
  }
  return '1/2-1/2';
}

/** La apertura, si lichess la identificó. */
export function extractOpening(
  game: LichessGame
): ChessGameOpening | undefined {
  if (!game.opening?.eco && !game.opening?.name) {
    return undefined;
  }
  return {
    eco: game.opening.eco ?? '',
    name: game.opening.name ?? game.opening.eco ?? '',
  };
}

/**
 * Pasa una partida de lichess al modelo común.
 *
 * Devuelve null cuando la partida no sirve: variantes, partidas abortadas o
 * partidas en las que el usuario no juega.
 */
export function normalizeGame(
  game: LichessGame,
  username: string
): ChessGame | null {
  if ((game.variant ?? 'standard') !== 'standard') {
    return null;
  }

  const result = extractResult(game);
  if (!result) {
    return null;
  }

  const lowered = username.toLowerCase();
  // El rival puede ser el ordenador, que no trae `user`
  const whiteName = game.players?.white?.user?.name ?? 'Stockfish';
  const blackName = game.players?.black?.user?.name ?? 'Stockfish';

  let userColor: 'white' | 'black';
  if (whiteName.toLowerCase() === lowered) {
    userColor = 'white';
  } else if (blackName.toLowerCase() === lowered) {
    userColor = 'black';
  } else {
    return null;
  }

  const { timeControl, baseSeconds, incrementSeconds } = formatTimeControl(game);

  return {
    id: game.id ?? `${whiteName}-${blackName}-${game.createdAt}`,
    source: 'lichess',
    pgn: game.pgn ?? '',
    timeControl,
    timeControlSeconds: baseSeconds,
    incrementSeconds,
    timeClass: timeClassFor(baseSeconds, incrementSeconds),
    playedAt: game.lastMoveAt ?? game.createdAt ?? 0,
    white: {
      username: whiteName,
      rating: game.players?.white?.rating ?? 0,
    },
    black: {
      username: blackName,
      rating: game.players?.black?.rating ?? 0,
    },
    result,
    userColor,
    opening: extractOpening(game),
    variant: 'standard',
    analyzed: Array.isArray(game.analysis) && game.analysis.length > 0,
  };
}

/** Normaliza una tanda entera, descartando lo que no sirve. */
export function normalizeGames(
  games: LichessGame[],
  username: string
): ChessGame[] {
  return games
    .map((game) => normalizeGame(game, username))
    .filter((game): game is ChessGame => game !== null);
}
