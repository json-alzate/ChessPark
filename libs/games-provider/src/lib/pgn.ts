import { Chess } from 'chess.js';

import { GameHeader, MoveSquares, ParsedGame } from './types';

/**
 * Lectura de archivos PGN con muchas partidas.
 *
 * Se hace en dos pasos a propósito:
 *
 *  1. `parsePackHeaders` recorre el texto una vez y saca **solo las cabeceras**.
 *     Es trabajo de cadenas, sin ajedrez de por medio.
 *  2. `buildGame` deriva las posiciones de **una** partida, cuando esa partida
 *     se va a ver.
 *
 * Derivar las posiciones de las 4.310 partidas de Anand al abrir la pantalla la
 * dejaría congelada varios segundos sin que nadie lo haya pedido.
 */

/** Cada partida de un PGN empieza con su cabecera [Event …] al principio de línea. */
const GAME_START = /^\[Event\s/gm;

/** Línea de cabecera: [Clave "Valor"]. */
const HEADER_LINE = /^\[(\w+)\s+"([^"]*)"\]/;

/** Corta el archivo en partidas sueltas, sin interpretarlas. */
export function splitPgnGames(pgn: string): string[] {
  const starts: number[] = [];
  GAME_START.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = GAME_START.exec(pgn)) !== null) {
    starts.push(match.index);
  }

  return starts.map((start, i) =>
    pgn.slice(start, i + 1 < starts.length ? starts[i + 1] : pgn.length).trim()
  );
}

/** Separa una partida en sus cabeceras y su texto de jugadas. */
export function splitHeadersAndMoves(gameText: string): {
  headers: Record<string, string>;
  movetext: string;
} {
  const headers: Record<string, string> = {};
  const lines = gameText.split(/\r?\n/);

  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      continue;
    }
    const header = HEADER_LINE.exec(line);
    if (!header) {
      break;
    }
    headers[header[1]] = header[2];
  }

  return { headers, movetext: lines.slice(i).join('\n').trim() };
}

/**
 * Cuenta las jugadas del texto de movimientos. PGN Mentor pega el número a la
 * jugada ('1.d4 Nf6 2.Nf3'), así que se le quita el número a cada trozo y lo
 * que quede con contenido cuenta como jugada.
 */
export function countPlies(movetext: string): number {
  let count = 0;

  for (const raw of movetext.split(/\s+/)) {
    if (!raw) {
      continue;
    }
    // Resultado final de la partida
    if (raw === '1-0' || raw === '0-1' || raw === '1/2-1/2' || raw === '*') {
      continue;
    }
    // Símbolo de evaluación ($1, $14…)
    if (raw.startsWith('$')) {
      continue;
    }
    // Quita el número de jugada pegado o suelto ('12.', '12...', '12.e4')
    const move = raw.replace(/^\d+\.+/, '');
    if (move === '') {
      continue;
    }
    count++;
  }

  return count;
}

/** ELO del PGN; null cuando viene vacío o sin sentido (normal antes de 1970). */
function parseElo(value: string | undefined): number | null {
  const elo = Number.parseInt(value ?? '', 10);
  return Number.isFinite(elo) && elo > 0 ? elo : null;
}

/** Año de una fecha PGN ('1963.05.20', '1963.??.??'); null si no se sabe. */
function parseYear(date: string | undefined): number | null {
  const year = Number.parseInt((date ?? '').slice(0, 4), 10);
  return Number.isFinite(year) && year > 0 ? year : null;
}

/** Cabecera de una partida suelta. */
export function parseGameHeader(gameText: string, index: number): GameHeader {
  const { headers, movetext } = splitHeadersAndMoves(gameText);

  return {
    index,
    white: headers['White'] ?? '',
    black: headers['Black'] ?? '',
    event: headers['Event'] ?? '',
    date: headers['Date'] ?? '',
    year: parseYear(headers['Date']),
    result: headers['Result'] ?? '*',
    whiteElo: parseElo(headers['WhiteElo']),
    blackElo: parseElo(headers['BlackElo']),
    plies: countPlies(movetext),
  };
}

/**
 * Primera pasada sobre un paquete: las cabeceras de todas sus partidas.
 * Devuelve también los textos, para no volver a cortar el archivo al abrir una.
 */
export function parsePackHeaders(pgn: string): {
  headers: GameHeader[];
  games: string[];
} {
  const games = splitPgnGames(pgn);
  return { headers: games.map(parseGameHeader), games };
}

/**
 * Segunda pasada: convierte una partida en algo reproducible.
 *
 * Solo la línea principal — las variantes y los comentarios se ignoran, que es
 * lo acordado para esta entrega. Si el PGN no se deja leer, devuelve null y el
 * llamador decide (en el modo TV, saltar a la siguiente).
 */
export function buildGame(gameText: string, header: GameHeader): ParsedGame | null {
  const chess = new Chess();

  try {
    chess.loadPgn(gameText);
  } catch {
    return null;
  }

  const sanMoves = chess.history();
  if (sanMoves.length === 0) {
    return null;
  }

  // Se rebobina hasta el principio para ir anotando la posición tras cada jugada
  // y las casillas que se tocaron, que son las que se resaltan en el tablero.
  const fens: string[] = [];
  const moveSquares: MoveSquares[] = [];
  const replay = new Chess(startingFen(gameText));
  fens.push(replay.fen());

  for (const san of sanMoves) {
    let move;
    try {
      move = replay.move(san);
    } catch {
      break;
    }
    moveSquares.push({ from: move.from, to: move.to });
    fens.push(replay.fen());
  }

  // Si alguna jugada no se pudo repetir, se recorta a lo que sí se pudo.
  const playable = fens.length - 1;

  return {
    header: { ...header, plies: playable },
    sanMoves: sanMoves.slice(0, playable),
    fens,
    moveSquares: moveSquares.slice(0, playable),
  };
}

/** Posición de partida: la del tag FEN si la partida no empieza en la inicial. */
function startingFen(gameText: string): string | undefined {
  const { headers } = splitHeadersAndMoves(gameText);
  return headers['FEN'];
}
