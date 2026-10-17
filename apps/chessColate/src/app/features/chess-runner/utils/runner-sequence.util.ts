/**
 * De qué piezas se compone la carrera: las del ejercicio, sin pasarse de largo y en un orden que no
 * agobie al empezar. Determinista: el mismo ejercicio da siempre la misma carrera.
 */

import {
  difficultyForLevel,
  FIRST_GAP,
  MAX_LEVEL,
  MAX_OBSTACLES,
  MAX_PER_KIND,
  REST_SECONDS,
  RUN_SECONDS,
  RunnerDifficulty,
  WALL_COUNT,
  WALL_KINDS,
} from '../config/runner.config';
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
const sizeOf = (piece: RunnerPiece) => SIZE_ORDER.indexOf(piece.kind);

/** Cuántas falanges (tres piezas en fila, que piden el doble salto) lleva una carrera de ese nivel. */
export function wallsForLevel(level: number): number {
  if (level < 2) return 0;
  if (level < 5) return 1;
  if (level < 8) return 2;
  if (level < 12) return 3;
  return 4;
}

/**
 * Cuántas piezas van «encadenadas» (con el hueco mínimo tras ellas): casi ninguna al empezar y cada vez más según
 * se avanza, hasta la mitad. Es lo que hace que el ritmo se apriete y se sienta el avance.
 */
export function tightShare(level: number): number {
  return Math.min(0.12 + 0.025 * (Math.max(level, 1) - 1), 0.5);
}

/** Cuánto hueco deja una pieza (el `beat`): encadenada, un respiro largo o un ritmo normal, sin ser un metrónomo. */
function beatFor(level: number, random: () => number): number {
  const roll = random();
  const tight = tightShare(level);
  if (roll < tight) {
    return random() * 0.08;
  }
  if (roll < tight + 0.2) {
    return 0.85 + random() * 0.15;
  }
  return 0.25 + random() * 0.5;
}

/** Lo que dura aparte de las piezas: el último obstáculo llega hasta el perrito y este corre hacia el tablero. */
const RUN_TAIL_SECONDS = 2.4;
/** Lo que añade una falange: es larga y el doble salto tarda más en aterrizar. */
const WALL_SECONDS = 1;
/** Tope de piezas en una carrera, para que una posición con pocas piezas no se haga eterna. */
const MAX_RUN_PIECES = 26;

/**
 * Cuántos segundos va a durar una carrera, más o menos (con el suelo a la velocidad media del nivel). La usa
 * `buildRunnerSequence` para ajustar el largo; las pruebas la comparan con carreras simuladas.
 */
export function expectedRunSeconds(sequence: RunnerPiece[], difficulty: RunnerDifficulty): number {
  if (sequence.length === 0) {
    return 0;
  }
  const meanSpeed = (difficulty.startSpeed + difficulty.endSpeed) / 2;
  let seconds = FIRST_GAP / meanSpeed + RUN_TAIL_SECONDS;
  sequence.forEach((piece, index) => {
    if (index < sequence.length - 1) {
      const t = Math.min(Math.max(piece.beat ?? 0.5, 0), 1);
      seconds += difficulty.minGapTime + (difficulty.maxGapTime - difficulty.minGapTime) * t;
      seconds += piece.rest ?? 0;
    }
    seconds += (piece.wall ?? 1) > 1 ? WALL_SECONDS : 0;
  });
  return seconds;
}

/** Cuánto debería durar la carrera de un nivel. */
export function targetRunSeconds(level: number): number {
  return RUN_SECONDS.base + RUN_SECONDS.perLevel * (Math.min(Math.max(level, 1), MAX_LEVEL) - 1);
}

/**
 * La carrera de un ejercicio, en oleadas con un respiro de galletas entre una y otra:
 * 1. **Presentación**: cada tipo de pieza del ejercicio una vez, de la más baja a la más alta. Es el momento de
 *    familiarizarse con quién está en el tablero.
 * 2. **Desfile**: todas, mezcladas con la semilla del ejercicio.
 * 3. **Desafío**: todas, de la más alta a la más baja, con el suelo ya a toda velocidad.
 * El largo se ajusta a `targetRunSeconds` quitando del final (o repitiendo, si el ejercicio tiene pocas piezas).
 * Cada pieza lleva su propio ritmo (`beat`); el mismo ejercicio da siempre la misma carrera.
 *
 * Desde el nivel 2 alguna pieza (nunca la primera, ni las que se deslizan) sale como falange: tres iguales en fila,
 * que solo se pasan con el doble salto.
 */
export function buildRunnerSequence(fen: string, seed: string, level = 1): RunnerPiece[] {
  const base = chooseObstacles(piecesOfFen(fen));
  if (base.length === 0) {
    return [];
  }
  const random = seededRandom(hashString(seed));
  const withBeat = (piece: RunnerPiece): RunnerPiece => ({ kind: piece.kind, color: piece.color, beat: beatFor(level, random) });
  const shuffle = <T>(items: T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const ordered = [...base].sort((a, b) => sizeOf(a) - sizeOf(b));
  const presentation = ordered.filter((piece, i) => ordered.findIndex((p) => p.kind === piece.kind) === i);
  const waves: RunnerPiece[][] = [
    presentation.map(withBeat),
    shuffle(base).map(withBeat),
    [...ordered].reverse().map(withBeat),
  ];

  const difficulty = difficultyForLevel(level);
  // Las falanges (que se marcan al final) alargan la carrera: se descuentan de antemano
  const target = targetRunSeconds(level) - wallsForLevel(level) * WALL_SECONDS;
  const rest = (wave: RunnerPiece[]): RunnerPiece[] =>
    wave.map((piece, i) => (i === wave.length - 1 ? { ...piece, rest: REST_SECONDS } : piece));

  // Se arma con las tres oleadas y se recorta o se alarga hasta que dure lo que toca
  let sequence = [...rest(waves[0]), ...rest(waves[1]), ...waves[2]];
  const trim = (list: RunnerPiece[]): RunnerPiece[] => {
    // Se quita del final, pero el último respiro se quita con su pieza para no acabar con una pausa
    const shorter = list.slice(0, -1);
    const last = shorter[shorter.length - 1];
    return last?.rest ? shorter.slice(0, -1) : shorter;
  };
  while (sequence.length > 4 && expectedRunSeconds(sequence, difficulty) > target + 1) {
    sequence = trim(sequence);
  }
  // Pocas piezas: se repite el desfile, mezclado de nuevo, de una en una hasta llegar
  const extra = shuffle(base).map(withBeat);
  while (sequence.length < MAX_RUN_PIECES && expectedRunSeconds(sequence, difficulty) < target - 1) {
    sequence = [...sequence, extra[sequence.length % extra.length]];
  }
  // El último no lleva respiro detrás
  const finalIndex = sequence.length - 1;
  if (sequence[finalIndex].rest) {
    sequence[finalIndex] = { ...sequence[finalIndex], rest: undefined };
  }

  // Las falanges: se eligen con la misma semilla entre las piezas que lo admiten
  const candidates = sequence
    .map((piece, index) => ({ index, key: random() }))
    .filter(({ index }) => index > 0 && WALL_KINDS.includes(sequence[index].kind))
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
