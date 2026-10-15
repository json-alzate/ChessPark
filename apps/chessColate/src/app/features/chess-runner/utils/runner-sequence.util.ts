/**
 * De qué piezas se compone la carrera: las del ejercicio, sin pasarse de largo y en un orden que no
 * agobie al empezar. Determinista: el mismo ejercicio da siempre la misma carrera.
 */

import { MAX_OBSTACLES, MAX_PER_KIND } from '../config/runner.config';
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

/**
 * La carrera de un ejercicio: sus piezas en un orden mezclado con la semilla del ejercicio, pero con un
 * peón primero si lo hay, porque el salto básico es la mejor forma de entrar en materia.
 */
export function buildRunnerSequence(fen: string, seed: string): RunnerPiece[] {
  const obstacles = chooseObstacles(piecesOfFen(fen));
  const random = seededRandom(hashString(seed));

  // Fisher-Yates con la semilla
  for (let i = obstacles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [obstacles[i], obstacles[j]] = [obstacles[j], obstacles[i]];
  }

  const pawn = obstacles.findIndex((piece) => piece.kind === 'pawn');
  if (pawn > 0) {
    [obstacles[0], obstacles[pawn]] = [obstacles[pawn], obstacles[0]];
  }
  return obstacles;
}

/** El bando del obstáculo, para elegir su sprite. */
export function spriteName(kind: RunnerPieceKind, color: RunnerPieceColor): string {
  return `piece-${kind}-${color}`;
}
