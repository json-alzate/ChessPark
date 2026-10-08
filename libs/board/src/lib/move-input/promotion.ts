/**
 * Indica si una jugada implica una promoción: un peón que llega a la primera o a la última fila.
 *
 * Es una función pura, sin dependencias de cm-chessboard ni de chess.js, para que la usen tanto
 * el manejador de movimientos del tablero como el `PuzzleEngine`.
 *
 * @param piece - Código de pieza de cm-chessboard, p. ej. `wp` o `bp`
 * @param to - Casilla destino, p. ej. `a8`
 */
export function isPromotionAttempt(piece: string, to: string): boolean {
  return piece.charAt(1) === 'p' && (to.charAt(1) === '8' || to.charAt(1) === '1');
}
