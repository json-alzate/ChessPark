/** Parte de `VisualMoveInput` (cm-chessboard) que se necesita para soltar una pieza que sigue en la mano. */
interface VisualMoveInputLike {
  moveInputState: string;
  fromSquare: string | null;
  toSquare: string | null;
  movedPiece: string | null;
  setMoveInputState(state: 'reset'): void;
}

/** Tablero de cm-chessboard visto desde fuera: solo importa `view.visualMoveInput`. */
interface BoardWithMoveInput {
  view?: { visualMoveInput?: VisualMoveInputLike };
}

/** Estados en los que el dedo o el ratón siguen sobre una pieza (arrastrándola o a punto de arrastrarla). */
const HOLDING_STATES = ['pieceClickedThreshold', 'dragTo', 'clickDragTo', 'secondClickThreshold'];

/** Además, la pieza elegida con un toque que espera el segundo toque. */
const SELECTED_STATES = [...HOLDING_STATES, 'clickTo'];

/**
 * Suelta cualquier pieza que el usuario tenga en la mano cuando la posición del tablero cambia por
 * debajo (se acabó el tiempo, entró otro puzzle).
 *
 * cm-chessboard solo reinicia su entrada de movimientos cuando recibe el `touchend`/`mouseup`. Si la
 * pieza que se arrastraba desaparece al redibujar el tablero, ese evento se pierde: el tablero se
 * queda en `dragTo`, con una pieza "fantasma" dibujada encima del puzzle nuevo, y los primeros
 * toques siguientes se gastan en recuperarse ("las piezas se congelan"). `disableMoveInput()` no lo
 * arregla: solo apaga el callback, no el estado.
 *
 * Nunca toca el estado `moveDone` (el tablero está aplicando una jugada ya aceptada) ni
 * `waitForInputStart` (no hay nada que soltar).
 *
 * @param includeSelection - también descarta la pieza elegida con un toque, que esperaba su destino
 * @returns `true` si había algo que soltar
 */
export function cancelMoveInput(board: object | null | undefined, includeSelection = false): boolean {
  const input = (board as BoardWithMoveInput | null | undefined)?.view?.visualMoveInput;
  if (!input) {
    return false;
  }
  const states = includeSelection ? SELECTED_STATES : HOLDING_STATES;
  if (!states.includes(input.moveInputState)) {
    return false;
  }
  // Sin origen ni pieza, para que el reinicio no vuelva a dejar la pieza vieja en la posición nueva
  input.fromSquare = null;
  input.toSquare = null;
  input.movedPiece = null;
  input.setMoveInputState('reset');
  return true;
}
