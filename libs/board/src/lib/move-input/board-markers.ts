/**
 * Utilidades para dibujar marcadores sobre un tablero de cm-chessboard.
 *
 * Eran métodos copiados, idénticos, en los dos tableros de puzzle (`BoardPuzzleComponent` y
 * `BoardPuzzleSolutionComponent`). Son funciones que reciben el tablero, sin estado propio, para
 * que cada componente las use sin repetirlas.
 */

/** Lo mínimo que estas utilidades necesitan del tablero. */
export interface MarkableBoard {
  getMarkers(type?: unknown, square?: string): { type: { id?: string }; square?: string }[];
  removeMarkers(type?: unknown, square?: string): void;
  addMarker(type: { id?: string; class: string; slice: string }, square: string): void;
  setOrientation(orientation: 'w' | 'b'): void;
  getOrientation(): 'w' | 'b';
}

/** Marcador de la casilla de origen y destino de la última jugada. */
export const LAST_MOVE_MARKER = {
  id: 'lastMove',
  class: 'marker-square-green',
  slice: 'markerSquare',
};

/**
 * Quita todos los marcadores salvo los de última jugada (`lastMove`).
 *
 * @param square - Si se indica, solo se limpia esa casilla; si no, todo el tablero
 */
export function removeMarkersExceptLastMove(board: MarkableBoard, square?: string): void {
  const markers = square ? board.getMarkers(undefined, square) : board.getMarkers();
  markers.forEach((marker) => {
    if (marker.type?.id !== 'lastMove') {
      board.removeMarkers(marker.type, square ?? marker.square);
    }
  });
}

/**
 * Limpia los marcadores y dibuja el de la última jugada.
 *
 * El llamador decide de dónde salen las casillas (historial de chess.js, solución del puzzle...);
 * esta función solo dibuja. Si falta alguna de las dos casillas, deja el tablero sin marcadores.
 */
export function drawLastMove(board: MarkableBoard, from?: string, to?: string): void {
  board.removeMarkers();
  if (from && to) {
    board.addMarker(LAST_MOVE_MARKER, from);
    board.addMarker(LAST_MOVE_MARKER, to);
  }
}

/**
 * Gira el tablero. Con `orientation` lo pone en ese lado; sin ella, lo gira al lado contrario.
 */
export function turnBoard(board: MarkableBoard, orientation?: 'w' | 'b'): void {
  if (orientation) {
    board.setOrientation(orientation);
  } else {
    board.setOrientation(board.getOrientation() === 'w' ? 'b' : 'w');
  }
}
