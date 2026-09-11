import { Chess, Move } from 'chess.js';

/** Color de una pieza, con las letras de chess.js. */
export type PieceColor = 'w' | 'b';

/** Tipo de pieza, con las letras de chess.js. */
export type PieceKind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

/**
 * Una pieza seguida a lo largo de la partida.
 *
 * Se identifica por su casilla inicial ("el caballo de g1"). En ajedrez
 * estándar esa casilla es la misma en todas las partidas, así que más adelante
 * sumar el mapa de varias partidas será sumar los de las piezas con el mismo id.
 */
export interface TrackedPiece {
  /** Color y casilla inicial: 'w-g1'. */
  id: string;
  color: PieceColor;
  /** El tipo con el que empezó; un peón que corona sigue siendo 'p'. */
  type: PieceKind;
  startSquare: string;
  /** A qué coronó, si fue un peón que llegó al final. */
  promotedTo?: PieceKind;
  /** Cuántas veces llegó a cada casilla. */
  arrivals: Record<string, number>;
  /** Medias jugadas en que se movió, empezando en 1 (la primera de blancas). */
  plies: number[];
  /** Media jugada en que la capturaron; sin valor si llegó al final. */
  capturedAtPly?: number;
  /** Dónde terminó: su última casilla, o donde la capturaron. */
  lastSquare: string;
}

/** El mapa de calor de todas las piezas de una partida. */
export interface PieceHeatmap {
  /** Ordenadas: blancas primero y, dentro de cada color, rey, dama, torres… */
  pieces: TrackedPiece[];
  /** Medias jugadas de la partida. */
  totalPlies: number;
}

/** Orden en que se listan los tipos: de más valor a menos, como en un marcador. */
const KIND_ORDER: PieceKind[] = ['k', 'q', 'r', 'b', 'n', 'p'];

/**
 * Por dónde se movió cada pieza de una partida: a qué casillas llegó y cuántas
 * veces, en qué jugadas se movió y si acabó capturada.
 *
 * Cuenta llegadas, no casillas atravesadas ni tiempo en cada casilla: cada
 * jugada suma uno en la casilla de destino. Así el resultado se comprueba
 * contra la lista de jugadas sin hacer cuentas.
 *
 * Tres jugadas mueven o quitan una pieza que no es la que dice la jugada:
 * - En el enroque también llega la torre, y cuenta como jugada suya.
 * - En la captura al paso el peón capturado no está en la casilla de destino.
 * - Al coronar la pieza sigue siendo la misma; se anota a qué coronó.
 *
 * Devuelve null si el PGN no se deja leer.
 */
export function getPieceHeatmap(pgn: string): PieceHeatmap | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }

  const moves = chess.history({ verbose: true });
  // La posición de partida: la estándar, o la del FEN si el PGN trae una propia
  const initialFen = moves[0]?.before ?? chess.fen();

  const pieces: TrackedPiece[] = [];
  /** Qué pieza hay ahora mismo en cada casilla. */
  const bySquare = new Map<string, TrackedPiece>();

  for (const row of new Chess(initialFen).board()) {
    for (const cell of row) {
      if (!cell) {
        continue;
      }
      const piece: TrackedPiece = {
        id: `${cell.color}-${cell.square}`,
        color: cell.color,
        type: cell.type,
        startSquare: cell.square,
        arrivals: {},
        plies: [],
        lastSquare: cell.square,
      };
      pieces.push(piece);
      bySquare.set(cell.square, piece);
    }
  }

  const arrive = (from: string, to: string, ply: number): TrackedPiece | null => {
    const piece = bySquare.get(from);
    if (!piece) {
      return null;
    }
    bySquare.delete(from);
    piece.arrivals[to] = (piece.arrivals[to] ?? 0) + 1;
    piece.plies.push(ply);
    piece.lastSquare = to;
    bySquare.set(to, piece);
    return piece;
  };

  moves.forEach((move: Move, index) => {
    const ply = index + 1;

    // La capturada primero: si no, la que llega la taparía en el mapa
    if (move.captured) {
      const capturedSquare = move.isEnPassant()
        ? `${move.to[0]}${move.from[1]}`
        : move.to;
      const captured = bySquare.get(capturedSquare);
      if (captured) {
        captured.capturedAtPly = ply;
        captured.lastSquare = capturedSquare;
        bySquare.delete(capturedSquare);
      }
    }

    const mover = arrive(move.from, move.to, ply);
    if (mover && move.promotion) {
      mover.promotedTo = move.promotion;
    }

    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const rank = move.from[1];
      const [rookFrom, rookTo] = move.isKingsideCastle()
        ? [`h${rank}`, `f${rank}`]
        : [`a${rank}`, `d${rank}`];
      arrive(rookFrom, rookTo, ply);
    }
  });

  pieces.sort(
    (a, b) =>
      (a.color === b.color ? 0 : a.color === 'w' ? -1 : 1) ||
      KIND_ORDER.indexOf(a.type) - KIND_ORDER.indexOf(b.type) ||
      a.startSquare.localeCompare(b.startSquare)
  );

  return { pieces, totalPlies: moves.length };
}
