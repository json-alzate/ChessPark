import {
  ChessGame,
  ChessGameOpening,
  GameResult,
  timeClassFor,
} from '@cpark/models';

import { ChessComGame } from './types';

/** Cómo describe chess.com un empate, mire quien mire la partida. */
const DRAW_RESULTS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
]);

/** Lo que se lee del control de tiempo de chess.com. */
export interface ParsedTimeControl {
  baseSeconds: number;
  incrementSeconds: number;
}

/**
 * Lee el control de tiempo: '600' son diez minutos, '180+2' tres minutos con
 * dos segundos por jugada y '1/86400' un día por jugada (correspondencia).
 */
export function parseTimeControl(raw: string | undefined): ParsedTimeControl {
  if (!raw) {
    return { baseSeconds: 0, incrementSeconds: 0 };
  }

  // Correspondencia: '1/86400' son los segundos que dan por jugada
  if (raw.includes('/')) {
    const perMove = Number(raw.split('/')[1]);
    return {
      baseSeconds: Number.isFinite(perMove) ? perMove : 0,
      incrementSeconds: 0,
    };
  }

  const [base, increment] = raw.split('+');
  return {
    baseSeconds: Number(base) || 0,
    incrementSeconds: Number(increment) || 0,
  };
}

/** El valor de una cabecera del PGN, o undefined si no está. */
export function readPgnHeader(
  pgn: string | undefined,
  name: string
): string | undefined {
  if (!pgn) {
    return undefined;
  }
  const match = new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn);
  return match?.[1] || undefined;
}

/**
 * La apertura de la partida. chess.com no manda el nombre suelto: manda el
 * código ECO en el PGN y una URL de la que se saca el nombre legible.
 */
export function extractOpening(
  pgn: string | undefined
): ChessGameOpening | undefined {
  const eco = readPgnHeader(pgn, 'ECO');
  const url = readPgnHeader(pgn, 'ECOUrl');

  if (!eco && !url) {
    return undefined;
  }

  return {
    eco: eco ?? '',
    name: url ? openingNameFromUrl(url) : (eco ?? ''),
  };
}

/**
 * 'https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation'
 * → 'Sicilian Defense Najdorf Variation'.
 *
 * Las URLs largas acaban en la línea concreta ('…-4.Nxd4-Nf6'); esa cola se
 * corta, porque agrupar por ella dejaría una tabla de aperturas con una fila
 * por partida.
 */
export function openingNameFromUrl(url: string): string {
  const slug = url.split('/').filter(Boolean).pop() ?? '';
  const withoutMoves = slug.split(/-\d+\./)[0];
  return withoutMoves.replace(/-/g, ' ').trim();
}

/** El resultado de la partida, o null si aún no ha terminado. */
export function extractResult(game: ChessComGame): GameResult | null {
  const white = game.white?.result;
  const black = game.black?.result;

  if (white === 'win') {
    return '1-0';
  }
  if (black === 'win') {
    return '0-1';
  }
  if (white && black && DRAW_RESULTS.has(white) && DRAW_RESULTS.has(black)) {
    return '1/2-1/2';
  }
  return null;
}

/**
 * Pasa una partida de chess.com al modelo común.
 *
 * Devuelve null cuando la partida no sirve para el reporte: variantes que no
 * son ajedrez estándar, partidas sin terminar (la API devuelve las de
 * correspondencia en curso) o partidas en las que el usuario no juega.
 */
export function normalizeGame(
  game: ChessComGame,
  username: string
): ChessGame | null {
  if ((game.rules ?? 'chess') !== 'chess') {
    return null;
  }

  const result = extractResult(game);
  if (!result) {
    return null;
  }

  const lowered = username.toLowerCase();
  const whiteName = game.white?.username ?? '';
  const blackName = game.black?.username ?? '';

  let userColor: 'white' | 'black';
  if (whiteName.toLowerCase() === lowered) {
    userColor = 'white';
  } else if (blackName.toLowerCase() === lowered) {
    userColor = 'black';
  } else {
    return null;
  }

  const timeControl = game.time_control ?? '';
  const { baseSeconds, incrementSeconds } = parseTimeControl(timeControl);

  return {
    id: game.uuid || game.url || `${whiteName}-${blackName}-${game.end_time}`,
    source: 'chess.com',
    pgn: game.pgn ?? '',
    timeControl,
    timeControlSeconds: baseSeconds,
    incrementSeconds,
    timeClass: timeClassFor(baseSeconds, incrementSeconds),
    playedAt: (game.end_time ?? 0) * 1000,
    white: { username: whiteName, rating: game.white?.rating ?? 0 },
    black: { username: blackName, rating: game.black?.rating ?? 0 },
    result,
    userColor,
    opening: extractOpening(game.pgn),
    variant: 'standard',
    analyzed: Boolean(game.accuracies),
  };
}

/** Normaliza un mes entero, descartando lo que no sirve. */
export function normalizeGames(
  games: ChessComGame[],
  username: string
): ChessGame[] {
  return games
    .map((game) => normalizeGame(game, username))
    .filter((game): game is ChessGame => game !== null);
}
