import { BoardStyle, PiecesStyle } from '@chesspark/models';

/** Carpeta de assets de cm-chessboard (piezas y estilos), copiada al build de las apps. */
export const CHESSBOARD_ASSETS_URL = 'assets/cm-chessboard/assets/';

/** Id del contenedor donde cm-chessboard guarda el sprite de piezas (assetsCache). */
export const CHESSBOARD_SPRITE_WRAPPER_ID = 'cm-chessboard-sprite';

/** Apariencia del tablero: set de piezas y colores de las casillas. */
export interface ChessboardAppearance {
  pieces: PiecesStyle;
  board: BoardStyle;
}

/** Apariencia con la que la app venía antes de poder elegirla. */
export const DEFAULT_CHESSBOARD_APPEARANCE: ChessboardAppearance = {
  pieces: 'cburnett',
  board: 'chessboard-js',
};

/** Sprite de cada set de piezas, relativo a la carpeta de assets de cm-chessboard. */
export const PIECES_FILES: Record<PiecesStyle, string> = {
  cburnett: 'pieces/standard.svg',
  fantasy: 'pieces/fantasy.svg',
  staunty: 'pieces/staunty.svg',
};

/** Una opción de color de tablero, con las casillas que se muestran en su muestra. */
export interface BoardStyleOption {
  name: BoardStyle;
  light: string;
  dark: string;
}

/**
 * Temas de tablero. Los colores repiten los de `chessboard.scss` (cm-chessboard
 * los pinta con la clase CSS del mismo nombre) y solo sirven para las muestras.
 */
export const BOARD_STYLE_OPTIONS: readonly BoardStyleOption[] = [
  { name: 'chessboard-js', light: '#f0d9b5', dark: '#b58863' },
  { name: 'default', light: '#ecdab9', dark: '#c5a076' },
  { name: 'default-contrast', light: '#ecdab9', dark: '#c5a076' },
  { name: 'chess-club', light: '#e6d3b1', dark: '#af6b3f' },
  { name: 'green', light: '#e0ddcc', dark: '#4c946a' },
  { name: 'blue', light: '#d8ecfb', dark: '#86afcf' },
  { name: 'black-and-white', light: '#ffffff', dark: '#9c9c9c' },
];

/** Set de piezas disponibles, en el orden en que se ofrecen. */
export const PIECES_STYLE_OPTIONS: readonly PiecesStyle[] = ['cburnett', 'fantasy', 'staunty'];

export function isPiecesStyle(value: unknown): value is PiecesStyle {
  return typeof value === 'string' && value in PIECES_FILES;
}

export function isBoardStyle(value: unknown): value is BoardStyle {
  return BOARD_STYLE_OPTIONS.some((option) => option.name === value);
}

let current: ChessboardAppearance = { ...DEFAULT_CHESSBOARD_APPEARANCE };

/** Apariencia vigente: la que reciben los tableros que se construyan a partir de ahora. */
export function getChessboardAppearance(): ChessboardAppearance {
  return current;
}

/**
 * Cambia la apariencia y la aplica a los tableros que ya están en pantalla.
 *
 * Ionic conserva las páginas anteriores en el DOM, así que sin esto un tablero ya
 * dibujado (p. ej. el de Inicio) seguiría con el estilo viejo al volver de Ajustes.
 */
export function setChessboardAppearance(next: Partial<ChessboardAppearance>): void {
  const previous = current;
  current = {
    pieces: next.pieces && isPiecesStyle(next.pieces) ? next.pieces : previous.pieces,
    board: next.board && isBoardStyle(next.board) ? next.board : previous.board,
  };

  if (typeof document === 'undefined') return;

  if (current.board !== previous.board) {
    restyleBoards(current.board);
  }
  if (current.pieces !== previous.pieces) {
    void swapPiecesSprite(current.pieces);
  }
}

/** Cambia la clase de color de todos los tableros dibujados. */
function restyleBoards(board: BoardStyle): void {
  const known = BOARD_STYLE_OPTIONS.map((option) => option.name);
  document.querySelectorAll('svg.cm-chessboard').forEach((svg) => {
    svg.classList.remove(...known);
    svg.classList.add(board);
  });
}

/**
 * cm-chessboard descarga el sprite una sola vez por página y lo deja en un div
 * (`assetsCache`); los tableros dibujados apuntan a ese div con `<use href="#wk">`.
 * Reescribir su contenido cambia las piezas de todos a la vez sin reconstruirlos.
 * Si todavía no hay div (ningún tablero creado) no hay nada que cambiar: el primero
 * que se cree descargará el sprite de la apariencia vigente.
 */
async function swapPiecesSprite(pieces: PiecesStyle): Promise<void> {
  const wrapper = document.getElementById(CHESSBOARD_SPRITE_WRAPPER_ID);
  if (!wrapper) return;

  try {
    const response = await fetch(CHESSBOARD_ASSETS_URL + PIECES_FILES[pieces]);
    if (!response.ok) return;
    const sprite = await response.text();
    // Mientras se descargaba pudo elegirse otro set: gana el último
    if (current.pieces === pieces) {
      wrapper.innerHTML = sprite;
    }
  } catch {
    // Sin red o sin el archivo: los tableros conservan las piezas que ya tenían
  }
}

/** Restablece la apariencia por defecto sin tocar el DOM. Solo para pruebas. */
export function resetChessboardAppearanceForTests(): void {
  current = { ...DEFAULT_CHESSBOARD_APPEARANCE };
}
