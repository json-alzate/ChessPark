/**
 * Convierte un PGN de ejercicios en `Puzzle[]`. Funciones puras: no leen
 * archivos ni tocan el dispositivo.
 *
 * Cada ejercicio es una partida del archivo. Como en el catálogo de la app,
 * la **primera jugada** de la línea es la del rival (se juega sola) y el resto
 * es la solución que tiene que encontrar el usuario; el `[FEN]` es la posición
 * ANTES de esa jugada. La guía completa del formato está en
 * `docs/implementado/RUTINA_PGN_FLOW.md`.
 *
 * La lectura es tolerante: un ejercicio malo se anota en el informe y el resto
 * entra igual.
 */

import { Chess } from 'chess.js';

import { Puzzle } from '@chesspark/models';

import {
  CUSTOM_PUZZLE_DEFAULT_RATING,
  CUSTOM_PUZZLE_DEFAULT_THEME,
} from '../config/custom-puzzles.config';
import {
  PgnImportFailure,
  PgnImportResult,
  PgnIssue,
  PgnNote,
} from '../models/custom-puzzles.model';

/** Línea de cabecera: [Clave "Valor"]. */
const HEADER_LINE = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/;

/** Posición inicial estándar, para los ejercicios sin `[FEN]`. */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface PgnExercise {
  /** Texto completo del ejercicio (cabeceras y jugadas). */
  text: string;
  headers: Record<string, string>;
}

/**
 * Corta el archivo en ejercicios. Un ejercicio nuevo empieza con la primera
 * línea de cabecera que aparece **después de haber visto jugadas**, así que no
 * hace falta que todos lleven `[Event]` (a diferencia de `splitPgnGames`, que
 * es para colecciones de partidas con esa cabecera).
 */
export function splitExercises(text: string): PgnExercise[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const exercises: PgnExercise[] = [];

  let current: string[] = [];
  let headers: Record<string, string> = {};
  let inMoves = false;
  let braceDepth = 0;

  const flush = () => {
    const body = current.join('\n').trim();
    if (body !== '') {
      exercises.push({ text: body, headers });
    }
    current = [];
    headers = {};
    inMoves = false;
    braceDepth = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const header = braceDepth === 0 ? HEADER_LINE.exec(trimmed) : null;

    if (header) {
      if (inMoves) {
        flush();
      }
      headers[header[1]] = header[2].replace(/\\(["\\])/g, '$1');
    } else if (trimmed !== '') {
      inMoves = true;
      // Un comentario { … } puede ocupar varias líneas y no debe confundirse con una cabecera
      for (const char of trimmed) {
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
      }
    }
    current.push(line);
  }
  flush();

  return exercises;
}

/**
 * Nombre de un tema para mostrarlo: el del catálogo si lo hay, el texto
 * «Propio» para los ejercicios sin tema, y si no, lo que escribió el usuario en
 * su PGN tal cual (puede ser cualquier etiqueta suya).
 */
export function themeLabel(theme: string, catalogName: string | undefined, customLabel: string): string {
  if (theme === CUSTOM_PUZZLE_DEFAULT_THEME) {
    return customLabel;
  }
  return catalogName || theme;
}

/** Hash FNV-1a de 32 bits en base 36: identifica un ejercicio por su contenido. */
function hashOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** Temas de `[PuzzleThemes]` / `[Themes]`: separados por espacio o coma, sin repetidos. */
export function parseThemes(raw: string | undefined): string[] {
  const themes = (raw ?? '')
    .split(/[\s,;]+/)
    .map((theme) => theme.trim())
    .filter((theme) => theme !== '');
  const unique = [...new Set(themes)];
  return unique.length > 0 ? unique : [CUSTOM_PUZZLE_DEFAULT_THEME];
}

/** Rating de `[PuzzleRating]` / `[Rating]`; el de por defecto si falta o no es un número positivo. */
export function parseRating(raw: string | undefined, fallback = CUSTOM_PUZZLE_DEFAULT_RATING): number {
  const rating = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(rating) && rating > 0 ? rating : fallback;
}

function uciOf(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

type ExerciseOutcome =
  | { ok: true; puzzle: Puzzle; notes: PgnNote['code'][] }
  | { ok: false; issue: Omit<PgnIssue, 'index' | 'title'> };

/** Convierte un ejercicio suelto; el motivo del fallo viaja en el resultado, no como excepción. */
function buildPuzzle(exercise: PgnExercise): ExerciseOutcome {
  const { headers } = exercise;
  const notes: PgnNote['code'][] = [];

  const hasFen = headers['FEN'] !== undefined && headers['FEN'].trim() !== '';
  const fen = hasFen ? headers['FEN'].trim() : START_FEN;
  if (!hasFen) {
    notes.push('no-fen');
  }

  try {
    new Chess(fen);
  } catch {
    return { ok: false, issue: { code: 'invalid-fen' } };
  }

  const chess = new Chess(fen);
  try {
    chess.loadPgn(exercise.text);
  } catch (error) {
    const invalid = /Invalid move in PGN: (.+)$/.exec(error instanceof Error ? error.message : '');
    return invalid
      ? { ok: false, issue: { code: 'illegal-move', move: invalid[1].trim() } }
      : { ok: false, issue: { code: 'unreadable' } };
  }

  const history = chess.history({ verbose: true });
  if (history.length === 0) {
    return { ok: false, issue: { code: 'no-moves' } };
  }
  if (history.length < 2) {
    return { ok: false, issue: { code: 'too-short' } };
  }

  // La solución acaba en una jugada del usuario (posiciones impares): si la línea acaba en
  // una del rival no habría nada que hacer tras ella, así que se quita.
  if (history.length % 2 === 1) {
    history.pop();
    notes.push('trailing-opponent-move-dropped');
  }
  if (history.length < 2) {
    return { ok: false, issue: { code: 'too-short' } };
  }

  const moves = history.map(uciOf).join(' ');
  const site = headers['Site'] ?? headers['Link'] ?? '';

  return {
    ok: true,
    notes,
    puzzle: {
      uid: `pgn-${hashOf(`${fen}|${moves}`)}`,
      fen,
      moves,
      rating: parseRating(headers['PuzzleRating'] ?? headers['Rating']),
      ratingDeviation: 0,
      popularity: 0,
      randomNumberQuery: 0,
      nbPlays: 0,
      themes: parseThemes(headers['PuzzleThemes'] ?? headers['Themes']),
      gameUrl: /^https?:\/\//i.test(site) ? site : '',
      openingFamily: '',
      openingVariation: '',
    },
  };
}

/**
 * Lee el texto de un PGN de ejercicios. Devuelve los válidos (en el orden del
 * archivo, sin repetidos) y, aparte, los que no entraron y por qué.
 */
export function parsePgnExercises(text: string): PgnImportResult {
  const exercises = splitExercises(text);
  const puzzles: Puzzle[] = [];
  const issues: PgnIssue[] = [];
  const notes: PgnNote[] = [];
  const seen = new Set<string>();

  exercises.forEach((exercise, i) => {
    const index = i + 1;
    const title = (exercise.headers['Event'] ?? '').trim();
    const outcome = buildPuzzle(exercise);

    if (!outcome.ok) {
      issues.push({ index, title, ...outcome.issue });
      return;
    }
    if (seen.has(outcome.puzzle.uid)) {
      issues.push({ index, title, code: 'duplicate' });
      return;
    }

    seen.add(outcome.puzzle.uid);
    puzzles.push(outcome.puzzle);
    outcome.notes.forEach((code) => notes.push({ index, title, code }));
  });

  return { puzzles, total: exercises.length, issues, notes };
}

/** Por qué un texto ni siquiera llega a leerse como PGN; `null` si se puede intentar. */
export function checkPgnText(text: string, maxChars: number): PgnImportFailure | null {
  if (text.trim() === '') {
    return 'empty';
  }
  if (text.length > maxChars) {
    return 'too-big';
  }
  // Un archivo binario (una imagen, un zip…) leído como texto trae caracteres de control
  const hasControlChars = [...text.slice(0, 2000)].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x08 || (code >= 0x0e && code <= 0x1f);
  });
  if (hasControlChars) {
    return 'not-text';
  }
  return null;
}

/** Se queda con los primeros `max` ejercicios; `dropped` dice cuántos sobraron. */
export function limitExercises(puzzles: Puzzle[], max: number): { kept: Puzzle[]; dropped: number } {
  return puzzles.length > max
    ? { kept: puzzles.slice(0, max), dropped: puzzles.length - max }
    : { kept: puzzles, dropped: 0 };
}
