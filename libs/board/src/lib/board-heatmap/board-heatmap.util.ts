/** Una casilla del mapa de calor, lista para pintar. */
export interface HeatCell {
  square: string;
  /** Veces que se llegó a la casilla. */
  count: number;
  /** Intensidad de 0 (nada) a 4 (la casilla más visitada). */
  level: number;
  /** Es la casilla donde empezó la pieza. */
  isStart: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Las 64 casillas en el orden en que se ven, de izquierda a derecha y de
 * arriba abajo, según desde qué lado se mire el tablero.
 *
 * La intensidad es relativa a la casilla más visitada de esa misma pieza: en
 * una sola partida los números son pequeños, y con una escala fija casi todo
 * saldría con el tono más flojo.
 */
export function heatCells(
  counts: Record<string, number>,
  startSquare: string,
  orientation: 'w' | 'b'
): HeatCell[] {
  const max = Math.max(0, ...Object.values(counts));
  const ranks =
    orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'w' ? FILES : [...FILES].reverse();

  const cells: HeatCell[] = [];
  for (const rank of ranks) {
    for (const file of files) {
      const square = `${file}${rank}`;
      const count = counts[square] ?? 0;
      cells.push({
        square,
        count,
        level: count && max ? Math.ceil((count / max) * 4) : 0,
        isStart: square === startSquare,
      });
    }
  }
  return cells;
}

/**
 * La parte de piezas de un FEN con una sola pieza: 'wn' en f3 da
 * '8/8/8/8/8/5N2/8/8'. Sin pieza o sin casilla, el tablero vacío.
 */
export function singlePiecePlacement(piece: string, square: string): string {
  const rows = Array.from({ length: 8 }, () => new Array<string>(8).fill(''));

  if (piece.length === 2 && square.length === 2) {
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    if (file >= 0 && rank >= 1 && rank <= 8) {
      const letter = piece[1];
      rows[8 - rank][file] = piece[0] === 'w' ? letter.toUpperCase() : letter;
    }
  }

  return rows
    .map((row) => {
      let text = '';
      let empty = 0;
      for (const cell of row) {
        if (cell) {
          text += (empty || '') + cell;
          empty = 0;
        } else {
          empty += 1;
        }
      }
      return text + (empty || '');
    })
    .join('/');
}
