/**
 * De qué piezas se compone la carrera: las del ejercicio, sin pasarse de largo y en un orden que no
 * agobie al empezar. Determinista: el mismo ejercicio da siempre la misma carrera.
 */

import { MAX_OBSTACLES, MAX_PER_KIND, WALL_COUNT, WALL_KINDS } from '../config/runner.config';
import { RunnerPiece, RunnerPieceColor, RunnerPieceKind } from '../models/runner.model';

const KIND_OF_LETTER: Record<string, RunnerPieceKind> = {
  p: 'pawn',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  q: 'queen',
  k: 'king',
};

/** Orden en que se recortan los repetidos cuando hay demasiados: primero los más duros, que no hace falta repetir. */
const TRIM_ORDER: RunnerPieceKind[] = ['king', 'queen', 'rook', 'knight', 'bishop', 'pawn'];

/** Las piezas del tablero de un FEN, en el orden en que aparecen (de la fila 8 a la 1). */
export function piecesOfFen(fen: string): RunnerPiece[] {
  const placement = fen.split(' ')[0] ?? '';
  const pieces: RunnerPiece[] = [];
  for (const char of placement) {
    const kind = KIND_OF_LETTER[char.toLowerCase()];
    if (kind) {
      pieces.push({ kind, color: char === char.toUpperCase() ? 'w' : 'b' });
    }
  }
  return pieces;
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número a partir de un texto (para sembrar con el uid del ejercicio). */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Qué obstáculos salen, quitados los repetidos de más. De cada tipo salen hasta `MAX_PER_KIND`, y se
 * alterna el bando si el ejercicio tiene los dos. Si aun así son demasiados se quita el segundo
 * ejemplar de los tipos más duros primero (dos damas y dos reyes seguidos son un castigo, no un reto)
 * hasta `MAX_OBSTACLES`, sin dejar nunca un tipo sin representar.
 */
export function chooseObstacles(pieces: RunnerPiece[]): RunnerPiece[] {
  const chosen: RunnerPiece[] = [];
  for (const kind of TRIM_ORDER) {
    const ofKind = pieces.filter((piece) => piece.kind === kind);
    const white = ofKind.filter((piece) => piece.color === 'w');
    const black = ofKind.filter((piece) => piece.color === 'b');
    const picked: RunnerPiece[] = [];
    // Alternar bandos, empezando por el que más tiene
    const first = white.length >= black.length ? white : black;
    const second = first === white ? black : white;
    for (let i = 0; picked.length < MAX_PER_KIND && i < first.length + second.length; i++) {
      const source = i % 2 === 0 ? first : second;
      const fallback = i % 2 === 0 ? second : first;
      const piece = source[Math.floor(i / 2)] ?? fallback[Math.floor(i / 2)];
      if (piece) {
        picked.push(piece);
      }
    }
    chosen.push(...picked);
  }

  // Demasiados: se quita el segundo ejemplar de los más duros hasta que quepan
  for (const kind of TRIM_ORDER) {
    while (chosen.length > MAX_OBSTACLES && chosen.filter((p) => p.kind === kind).length > 1) {
      const index = chosen.map((p) => p.kind).lastIndexOf(kind);
      chosen.splice(index, 1);
    }
  }
  return chosen.slice(0, MAX_OBSTACLES);
}

/** De las más bajas a las más altas: las que dejan más margen salen primero. */
const SIZE_ORDER: RunnerPieceKind[] = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];

/** Cuántas falanges (tres piezas en fila, que piden el doble salto) lleva una carrera de ese nivel. */
export function wallsForLevel(level: number): number {
  if (level < 2) return 0;
  if (level < 5) return 1;
  if (level < 8) return 2;
  return 3;
}

/**
 * La carrera de un ejercicio: sus piezas de menor a mayor (el peón para entrar en materia, el rey para
 * terminar), de modo que dentro de la carrera la dificultad va subiendo. Entre piezas del mismo tipo el
 * orden se mezcla con la semilla del ejercicio, y cada una recibe su propio ritmo (`beat`): el mismo
 * ejercicio da siempre la misma carrera, pero no suena a metrónomo.
 *
 * Desde el nivel 2 alguna pieza (nunca la primera, ni las que se deslizan) sale como falange: tres iguales
 * en fila, que solo se pasan con el doble salto.
 */
export function buildRunnerSequence(fen: string, seed: string, level = 1): RunnerPiece[] {
  const obstacles = chooseObstacles(piecesOfFen(fen));
  const random = seededRandom(hashString(seed));

  // Fisher-Yates con la semilla; después, un orden estable por tamaño
  for (let i = obstacles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [obstacles[i], obstacles[j]] = [obstacles[j], obstacles[i]];
  }
  obstacles.sort((a, b) => SIZE_ORDER.indexOf(a.kind) - SIZE_ORDER.indexOf(b.kind));
  const sequence = obstacles.map((piece) => ({ ...piece, beat: random() }));

  // Las falanges: se eligen con la misma semilla entre las piezas que lo admiten
  const candidates = sequence
    .map((piece, index) => ({ piece, index, key: random() }))
    .filter(({ piece, index }) => index > 0 && WALL_KINDS.includes(piece.kind))
    .sort((a, b) => a.key - b.key)
    .slice(0, wallsForLevel(level));
  for (const { index } of candidates) {
    sequence[index] = { ...sequence[index], wall: WALL_COUNT };
  }
  return sequence;
}

const LETTER_OF_KIND: Record<RunnerPieceKind, string> = {
  pawn: 'p',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  queen: 'q',
  king: 'k',
};

/** El nombre de una pieza en el sprite del set (`wp`, `bn`…), el mismo que usa el tablero. */
export function pieceKey(kind: RunnerPieceKind, color: RunnerPieceColor): string {
  return `${color}${LETTER_OF_KIND[kind]}`;
}
