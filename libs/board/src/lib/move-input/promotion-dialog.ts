import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';

/** Lo que se necesita del tablero de cm-chessboard para cerrar el diálogo de coronación. */
export interface PromotionDialogBoard {
  isPromotionDialogShown?(): boolean;
  getExtension?(extensionClass: unknown): unknown;
}

/** Parte de la extensión `PromotionDialog` de cm-chessboard que se usa para cerrarla. */
interface PromotionDialogExtension {
  state: { callback: unknown };
  setDisplayState(displayState: 'hidden'): void;
}

/**
 * Cierra el diálogo de coronación si está abierto (o a punto de abrirse) **sin avisar** a quien lo
 * abrió: su callback queda anulado.
 *
 * Hace falta cuando el puzzle termina o cambia mientras el diálogo sigue abierto (se acabó el
 * tiempo, se falló, entró el siguiente puzzle). cm-chessboard no cierra el diálogo por su cuenta:
 * sin esto, las opciones de la coronación anterior quedaban dibujadas sobre el puzzle nuevo, el
 * primer toque en el tablero se gastaba en cancelarlas y elegir una pieza ejecutaba la jugada
 * vieja sobre la posición nueva ("las piezas se congelan después de una coronación").
 *
 * @returns `true` si había un diálogo que cerrar
 */
export function closePromotionDialog(target: object | null | undefined): boolean {
  const board = target as PromotionDialogBoard | null | undefined;
  if (!board?.isPromotionDialogShown?.()) {
    return false;
  }
  const dialog = board.getExtension?.(PromotionDialog) as PromotionDialogExtension | null | undefined;
  if (!dialog) {
    return false;
  }
  // Sin callback: cerrar no debe contar como "cancelar la jugada" del usuario (eso ya no existe)
  dialog.state.callback = null;
  dialog.setDisplayState('hidden');
  return true;
}
