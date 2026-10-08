import { Chess, Square } from 'chess.js';

/**
 * Casillas de los reyes que están en jaque en una posición.
 *
 * cm-chessboard solo conoce la colocación de las piezas (no de quién es el turno), así que
 * no se pregunta "¿está en jaque el que mueve?" sino "¿está atacado este rey?", para cada
 * rey. En una posición legal solo puede haber uno. Una posición sin los dos reyes (el mapa
 * de calor, los ejercicios de coordenadas) devuelve una lista vacía.
 *
 * @param piecePlacement - FEN completo o solo su primera parte (la colocación de piezas)
 */
export function findCheckedKings(piecePlacement: string): Square[] {
  const placement = piecePlacement.split(' ')[0];
  let chess: Chess;
  try {
    chess = new Chess(`${placement} w - - 0 1`, { skipValidation: true });
  } catch {
    return [];
  }

  const checked: Square[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell?.type === 'k' && chess.isAttacked(cell.square, cell.color === 'w' ? 'b' : 'w')) {
        checked.push(cell.square);
      }
    }
  }
  return checked;
}
