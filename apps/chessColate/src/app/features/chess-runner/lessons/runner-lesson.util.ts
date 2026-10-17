/**
 * La animación de una lección de patrón, como una función pura del tiempo: `lessonFrame(lección, t)` dice dónde está
 * cada pieza, qué casillas brillan y qué flechas se han dibujado en el segundo `t`. Sin canvas ni reloj, así se prueba.
 *
 * Línea de tiempo: la posición quieta con lo importante señalado (`INTRO_SECONDS`), cada jugada deslizándose
 * (`MOVE_SECONDS`) con un respiro para leer, y al final los objetivos iluminados con flechas (`EMPHASIS_SECONDS`).
 * Cada tramo tiene su frase en los textos de la app (`phase` dice cuál toca): qué mirar, qué se juega, por qué funciona y
 * cómo reconocerlo.
 */

import { RunnerLesson } from './runner-lessons.data';

export const INTRO_SECONDS = 2.8;
export const MOVE_SECONDS = 0.9;
/** Lo que se espera tras cada jugada: da tiempo a leer lo que ocurre. */
export const PAUSE_SECONDS = 1.1;
/** Lo que se queda iluminado el patrón al terminar (o a mitad, si la lección lo pide). */
export const EMPHASIS_SECONDS = 3.4;
/** Lo que tarda una flecha en dibujarse. */
export const ARROW_SECONDS = 0.6;

/** Una pieza dibujada: su imagen (`wn`, `bp`…) y dónde está, en casillas (0 a 8; la esquina de arriba a la izquierda es 0,0). */
export interface LessonPiece {
  key: string;
  x: number;
  y: number;
  alpha: number;
}

export interface LessonRing {
  square: string;
  /** Intensidad del brillo, de 0 a 1 (late). */
  strength: number;
  kind: 'focus' | 'target';
}

export interface LessonArrow {
  from: string;
  to: string;
  /** Cuánto de la flecha está dibujada, de 0 a 1. */
  progress: number;
}

/**
 * Qué se está explicando en cada momento:
 * - `see`: la posición quieta, con lo que hay que mirar;
 * - `play`: se hace la jugada número `step` (desde 0) y se deja leer;
 * - `why`: el patrón iluminado, con flechas;
 * - `then`: las jugadas que quedan tras el patrón iluminado (si lo estaba antes del final);
 * - `tip`: la lección ya terminó: cómo reconocer el patrón.
 */
export type LessonPhase = 'see' | 'play' | 'why' | 'then' | 'tip';

export interface LessonFrame {
  phase: LessonPhase;
  /** En `play` y `then`, la jugada que se explica (desde 0). */
  step: number;
  pieces: LessonPiece[];
  rings: LessonRing[];
  arrows: LessonArrow[];
  /** La animación ya terminó. */
  done: boolean;
}

/** Posición en casillas (columna 0 = «a», fila 0 = octava) de una casilla algebraica. */
export function squareToCell(square: string): { x: number; y: number } {
  return { x: square.charCodeAt(0) - 97, y: 8 - Number(square[1]) };
}

/** Las piezas de un FEN, por casilla: `{ e4: 'wp' }`. */
export function parseBoard(fen: string): Map<string, string> {
  const board = new Map<string, string>();
  const rows = (fen.split(' ')[0] ?? '').split('/');
  rows.forEach((row, y) => {
    let x = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        x += Number(char);
      } else if (/[pnbrqk]/i.test(char)) {
        board.set(`${String.fromCharCode(97 + x)}${8 - y}`, `${char === char.toUpperCase() ? 'w' : 'b'}${char.toLowerCase()}`);
        x++;
      }
    }
  });
  return board;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

interface Segment {
  kind: 'intro' | 'move' | 'pause' | 'emphasis';
  start: number;
  end: number;
  /** En las jugadas, cuál es. */
  index?: number;
}

/** La línea de tiempo: de qué está hecha y cuándo empieza cada parte. */
export function lessonSegments(lesson: RunnerLesson): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  const push = (kind: Segment['kind'], seconds: number, index?: number) => {
    segments.push({ kind, start: at, end: at + seconds, index });
    at += seconds;
  };
  const emphasisAfter = lesson.highlightAfter ?? lesson.moves.length;
  push('intro', INTRO_SECONDS);
  if (emphasisAfter === 0) {
    push('emphasis', EMPHASIS_SECONDS);
  }
  lesson.moves.forEach((_, index) => {
    push('move', MOVE_SECONDS, index);
    push('pause', PAUSE_SECONDS, index);
    if (index + 1 === emphasisAfter) {
      push('emphasis', EMPHASIS_SECONDS);
    }
  });
  return segments;
}

/** Lo que dura la lección entera, en segundos. */
export function lessonDuration(lesson: RunnerLesson): number {
  const segments = lessonSegments(lesson);
  return segments[segments.length - 1].end;
}

/** Cuántas jugadas están ya hechas (del todo) en el segundo `t`, y cuál se está haciendo. */
function progressOf(lesson: RunnerLesson, t: number) {
  let played = 0;
  let moving: { index: number; progress: number } | null = null;
  let segment: Segment | null = null;
  for (const s of lessonSegments(lesson)) {
    if (t >= s.start) {
      segment = s;
    }
    if (s.kind === 'move') {
      if (t >= s.end) {
        played = (s.index ?? 0) + 1;
      } else if (t >= s.start) {
        moving = { index: s.index ?? 0, progress: ease(clamp01((t - s.start) / (s.end - s.start))) };
      }
    }
  }
  return { played, moving, segment };
}

/** La imagen de la lección en el segundo `t`. */
export function lessonFrame(lesson: RunnerLesson, t: number): LessonFrame {
  const board = parseBoard(lesson.fen);
  const { played, moving, segment } = progressOf(lesson, Math.max(t, 0));
  const pieces: LessonPiece[] = [];
  let lastDestination: string | null = null;

  // Las jugadas ya hechas se aplican de golpe
  for (let i = 0; i < played; i++) {
    const from = lesson.moves[i].slice(0, 2);
    const to = lesson.moves[i].slice(2, 4);
    const piece = board.get(from);
    board.delete(from);
    if (piece) {
      board.set(to, piece);
    }
    lastDestination = to;
  }

  // La que se está haciendo, a medias: la pieza se desliza y la que se come se desvanece
  const sliding = moving ? { from: lesson.moves[moving.index].slice(0, 2), to: lesson.moves[moving.index].slice(2, 4) } : null;
  for (const [square, key] of board) {
    const cell = squareToCell(square);
    if (sliding && square === sliding.from && moving) {
      const target = squareToCell(sliding.to);
      pieces.push({ key, x: cell.x + (target.x - cell.x) * moving.progress, y: cell.y + (target.y - cell.y) * moving.progress, alpha: 1 });
    } else if (sliding && square === sliding.to && moving) {
      pieces.push({ key, x: cell.x, y: cell.y, alpha: 1 - clamp01((moving.progress - 0.5) * 2) });
    } else {
      pieces.push({ key, x: cell.x, y: cell.y, alpha: 1 });
    }
  }
  if (sliding && moving && moving.progress > 0) {
    lastDestination = sliding.to;
  }

  // Los brillos: al principio lo que hay que mirar; en el énfasis, los objetivos y las flechas hasta ellos
  const rings: LessonRing[] = [];
  const arrows: LessonArrow[] = [];
  const emphasisAfter = lesson.highlightAfter ?? lesson.moves.length;
  const pulse = (seconds: number) => 0.55 + 0.45 * Math.sin(seconds * 6);
  if (segment?.kind === 'intro') {
    for (const square of lesson.focus) {
      rings.push({ square, strength: pulse(t), kind: 'focus' });
    }
  }
  if (segment?.kind === 'emphasis') {
    const into = t - segment.start;
    const origin = lastDestination ?? lesson.moves[played - 1]?.slice(2, 4) ?? null;
    for (const square of lesson.targets) {
      rings.push({ square, strength: pulse(into), kind: 'target' });
      if (!lesson.arrows && origin && origin !== square && (lesson.arrowTo ?? lesson.targets).includes(square)) {
        arrows.push({ from: origin, to: square, progress: ease(clamp01(into / ARROW_SECONDS)) });
      }
    }
    for (const [from, to] of lesson.arrows ?? []) {
      arrows.push({ from, to, progress: ease(clamp01(into / ARROW_SECONDS)) });
    }
  }
  const total = lessonDuration(lesson);
  const done = t >= total;
  let phase: LessonPhase = 'see';
  let step = 0;
  if (done) {
    phase = 'tip';
  } else if (segment?.kind === 'emphasis') {
    phase = 'why';
  } else if (segment && (segment.kind === 'move' || segment.kind === 'pause')) {
    step = segment.index ?? 0;
    phase = step >= emphasisAfter ? 'then' : 'play';
  }
  return { phase, step, pieces, rings, arrows, done };
}
