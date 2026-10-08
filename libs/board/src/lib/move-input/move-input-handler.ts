import { COLOR, MoveInputEvent } from 'cm-chessboard';
import { isPromotionAttempt } from './promotion';

/** Lo que el manejador necesita del tablero de cm-chessboard. */
export interface MoveInputBoard {
  removeMarkers(): void;
  addMarker(type: { class: string; slice: string }, square: string): void;
  removeArrows(): void;
  setPosition(fen: string, animated?: boolean): unknown;
  showPromotionDialog(
    square: string,
    color: string,
    onChoose: (result?: { piece?: string } | null) => void
  ): unknown;
}

/**
 * Lo que cambia entre un tablero de puzzle y otro. El manejador sabe *qué hacer en cada evento*;
 * cada componente le dice *con qué motor de ajedrez* y *qué pasa cuando se acepta una jugada*.
 */
export interface MoveInputHost {
  /** Tablero actual. Es una función porque el tablero se crea después que el manejador. */
  board(): MoveInputBoard;
  /** Casillas a las que puede ir la pieza que está en `square`. Vacío si no puede moverse. */
  destinationsFrom(square: string): string[];
  /**
   * Aplica la jugada en el estado de ajedrez del componente.
   *
   * @param promotion - Pieza de promoción (`q`, `r`, `b` o `n`), solo en coronaciones
   * @returns `false` si la jugada es ilegal; el estado no debe cambiar en ese caso
   */
  tryMove(from: string, to: string, promotion?: string): boolean;
  /** Posición actual según el estado de ajedrez del componente. */
  fen(): string;
  /** Dibuja la última jugada (el componente sabe de dónde sacarla). */
  showLastMove(): void;
  /** Quita las flechas al empezar o cancelar una jugada. */
  clearArrows(): void;
  /** Se llama cuando el estado de ajedrez ya incluye la jugada del usuario. */
  onMoveAccepted(): void;
}

const MARKER_SELECTED_SQUARE = { class: 'marker-square-green', slice: 'markerSquare' };
const MARKER_DESTINATION_DOT = { class: 'marker-dot-green', slice: 'markerDot' };

/**
 * Crea el manejador de entrada de movimientos que se registra con `board.enableMoveInput(...)`.
 *
 * Este flujo estaba copiado en `BoardPuzzleComponent` y en `BoardPuzzleSolutionComponent`. Ahora vive
 * aquí una vez:
 *
 * - `moveInputStarted`: limpia el tablero y marca la casilla elegida y los destinos posibles.
 * - `validateMoveInput`: acepta o rechaza la jugada. Una coronación abre primero el diálogo
 *   de promoción y aplica la jugada al elegir la pieza.
 * - `moveInputCanceled`: limpia marcadores y flechas.
 *
 * Devolver `true` hace que cm-chessboard conserve la pieza donde la soltó el usuario; `false` la
 * devuelve a su casilla.
 *
 * Orden de las llamadas al tablero: es parte del comportamiento y está fijado por
 * `move-input-behavior.spec.ts`, que ejecuta los mismos escenarios contra los dos componentes.
 *
 * @example
 * ```typescript
 * this.board.enableMoveInput(createMoveInputHandler(this.moveInputHost));
 * ```
 */
export function createMoveInputHandler(host: MoveInputHost): (event: MoveInputEvent) => boolean {
  /** Deja el tablero sin marcadores de selección y con la última jugada visible. */
  const resetMarkers = () => {
    host.board().removeMarkers();
    host.showLastMove();
  };

  /** Jugada normal: si se acepta, el tablero conserva la pieza y el componente la valida. */
  const handleMove = (from: string, to: string): boolean => {
    const accepted = host.tryMove(from, to);
    if (accepted) {
      host.board().removeArrows();
      host.showLastMove();
      host.onMoveAccepted();
    } else {
      resetMarkers();
    }
    return accepted;
  };

  /**
   * Coronación. Primero se comprueba que el peón pueda llegar a la casilla; si no, se rechaza sin
   * abrir el diálogo. Si puede, el diálogo elige la pieza y la jugada se aplica al confirmar. Se
   * devuelve `true` para que cm-chessboard espere esa elección.
   */
  const handlePromotion = (from: string, to: string, piece: string): boolean => {
    try {
      if (!host.destinationsFrom(from).includes(to)) {
        resetMarkers();
        return false;
      }
      const color = piece.charAt(0) === 'w' ? COLOR.white : COLOR.black;
      host.board().showPromotionDialog(to, color, (result) => {
        const accepted = !!result?.piece && host.tryMove(from, to, result.piece.charAt(1));
        // Se sincroniza el tablero con el estado de ajedrez en ambos casos: si la jugada se
        // rechaza, esto deshace el movimiento visual de la pieza.
        host.board().setPosition(host.fen(), false);
        if (accepted) {
          host.board().removeArrows();
          host.showLastMove();
          host.onMoveAccepted();
        } else {
          resetMarkers();
        }
      });
      return true;
    } catch {
      resetMarkers();
      return false;
    }
  };

  return (event: MoveInputEvent): boolean => {
    switch (event.type) {
      case 'moveInputStarted': {
        resetMarkers();
        host.clearArrows();
        // Indicadores de las casillas a las que puede ir la pieza elegida
        const destinations = event.square ? host.destinationsFrom(event.square) : [];
        if (event.square && destinations.length > 0) {
          host.board().addMarker(MARKER_SELECTED_SQUARE, event.square);
          for (const destination of destinations) {
            host.board().addMarker(MARKER_DESTINATION_DOT, destination);
          }
        }
        return true;
      }
      case 'validateMoveInput':
        if (event.squareFrom && event.squareTo && event.piece && isPromotionAttempt(event.piece, event.squareTo)) {
          return handlePromotion(event.squareFrom, event.squareTo, event.piece);
        }
        if (event.squareFrom && event.squareTo) {
          return handleMove(event.squareFrom, event.squareTo);
        }
        resetMarkers();
        return false;
      case 'moveInputCanceled':
        resetMarkers();
        host.clearArrows();
        return true;
      default:
        return true;
    }
  };
}
