/**
 * Límites del PGN de ejercicios propios. El tope de ejercicios coincide con el
 * mayor set del Pájaro Carpintero (500 pesan unos 250 KB guardados).
 */

/** Ejercicios que se leen como máximo de un archivo; el resto se descarta y se avisa. */
export const CUSTOM_PUZZLES_MAX = 500;

/** Mínimo de ejercicios válidos para armar un set con ellos. */
export const CUSTOM_PUZZLES_MIN = 5;

/** Tamaño máximo del texto que se acepta, en caracteres (≈ 2 MB). */
export const CUSTOM_PGN_MAX_CHARS = 2_000_000;

/** Rating de un ejercicio que no trae `[PuzzleRating]`. */
export const CUSTOM_PUZZLE_DEFAULT_RATING = 1500;

/** Tema de un ejercicio que no trae `[PuzzleThemes]`. */
export const CUSTOM_PUZZLE_DEFAULT_THEME = 'custom';

/** Cuántos ejercicios con problema se detallan en pantalla (el resto se resume). */
export const CUSTOM_PGN_ISSUES_SHOWN = 5;

/** Nombre del archivo de ejemplo que se descarga desde la ayuda. */
export const CUSTOM_PGN_TEMPLATE_FILE = 'ejercicios-ejemplo.pgn';
