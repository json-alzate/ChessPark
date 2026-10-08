import { getPieceHeatmap, PieceHeatmap, TrackedPiece } from './piece-heatmap';

/** La pieza con ese id; falla la prueba si no existe. */
function pieceOf(heatmap: PieceHeatmap | null, id: string): TrackedPiece {
  const piece = heatmap?.pieces.find((item) => item.id === id);
  if (!piece) {
    throw new Error(`No hay pieza ${id}`);
  }
  return piece;
}

describe('getPieceHeatmap', () => {
  it('sigue a las 32 piezas de la posición inicial', () => {
    const heatmap = getPieceHeatmap('1. e4 e5 *');

    expect(heatmap?.pieces).toHaveLength(32);
    expect(heatmap?.totalPlies).toBe(2);
  });

  it('cuenta cuántas veces llegó una pieza a cada casilla', () => {
    const heatmap = getPieceHeatmap('1. Nf3 e5 2. Ng5 Nc6 3. Nf3 *');
    const knight = pieceOf(heatmap, 'w-g1');

    expect(knight.arrivals).toEqual({ f3: 2, g5: 1 });
    expect(knight.plies).toEqual([1, 3, 5]);
    expect(knight.lastSquare).toBe('f3');
    expect(knight.capturedAtPly).toBeUndefined();
  });

  it('distingue las dos piezas del mismo tipo por su casilla inicial', () => {
    const heatmap = getPieceHeatmap('1. Nf3 Nf6 2. Nc3 *');

    expect(pieceOf(heatmap, 'w-g1').arrivals).toEqual({ f3: 1 });
    expect(pieceOf(heatmap, 'w-b1').arrivals).toEqual({ c3: 1 });
  });

  it('anota en qué jugada capturaron una pieza y deja de seguirla', () => {
    const heatmap = getPieceHeatmap('1. e4 d5 2. exd5 Qxd5 *');
    const pawn = pieceOf(heatmap, 'w-e2');
    const queen = pieceOf(heatmap, 'b-d8');

    expect(pawn.capturedAtPly).toBe(4);
    expect(pawn.lastSquare).toBe('d5');
    expect(queen.arrivals).toEqual({ d5: 1 });
    expect(queen.plies).toEqual([4]);
  });

  it('en la captura al paso quita el peón de su casilla, no del destino', () => {
    const heatmap = getPieceHeatmap('1. e4 a6 2. e5 d5 3. exd6 *');
    const captured = pieceOf(heatmap, 'b-d7');

    expect(captured.capturedAtPly).toBe(5);
    expect(captured.lastSquare).toBe('d5');
    expect(pieceOf(heatmap, 'w-e2').arrivals).toEqual({ e4: 1, e5: 1, d6: 1 });
  });

  it('en el enroque también llega la torre', () => {
    const heatmap = getPieceHeatmap(
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O *'
    );

    expect(pieceOf(heatmap, 'w-e1').arrivals).toEqual({ g1: 1 });
    expect(pieceOf(heatmap, 'w-h1').arrivals).toEqual({ f1: 1 });
    expect(pieceOf(heatmap, 'w-h1').plies).toEqual([7]);
  });

  it('en el enroque largo la torre va a la columna d', () => {
    const heatmap = getPieceHeatmap(
      '1. d4 d5 2. Nc3 Nc6 3. Bf4 Bf5 4. Qd2 Qd7 5. O-O-O O-O-O *'
    );

    expect(pieceOf(heatmap, 'w-a1').arrivals).toEqual({ d1: 1 });
    expect(pieceOf(heatmap, 'b-a8').arrivals).toEqual({ d8: 1 });
    expect(pieceOf(heatmap, 'b-e8').arrivals).toEqual({ c8: 1 });
  });

  it('un peón que corona sigue siendo la misma pieza', () => {
    const pgn = [
      '[SetUp "1"]',
      '[FEN "8/P7/8/8/8/8/8/k6K w - - 0 1"]',
      '',
      '1. a8=Q+ *',
    ].join('\n');
    const pawn = pieceOf(getPieceHeatmap(pgn), 'w-a7');

    expect(pawn.type).toBe('p');
    expect(pawn.promotedTo).toBe('q');
    expect(pawn.arrivals).toEqual({ a8: 1 });
  });

  it('parte de la posición del FEN cuando el PGN trae una propia', () => {
    const pgn = [
      '[SetUp "1"]',
      '[FEN "8/P7/8/8/8/8/8/k6K w - - 0 1"]',
      '',
      '1. a8=Q+ *',
    ].join('\n');

    expect(getPieceHeatmap(pgn)?.pieces.map((piece) => piece.id)).toEqual([
      'w-h1',
      'w-a7',
      'b-a1',
    ]);
  });

  it('ordena blancas primero y, dentro de cada color, rey, dama, torres…', () => {
    const ids = getPieceHeatmap('*')?.pieces.map((piece) => piece.id) ?? [];

    expect(ids.slice(0, 4)).toEqual(['w-e1', 'w-d1', 'w-a1', 'w-h1']);
    expect(ids[16]).toBe('b-e8');
  });

  it('devuelve null si el PGN no se deja leer', () => {
    expect(getPieceHeatmap('1. e5 e4 *')).toBeNull();
  });
});
