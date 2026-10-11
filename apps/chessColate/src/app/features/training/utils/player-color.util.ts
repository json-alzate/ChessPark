/**
 * El FEN de un puzzle empieza con el turno del oponente (quien acaba de mover,
 * jugada que la máquina reproduce al abrir el tablero), así que el usuario juega
 * siempre con el color contrario al que indica el FEN.
 */
export function playerColorFromFen(fen?: string): 'white' | 'black' | null {
  if (!fen) return null;

  const turn = fen.trim().split(/\s+/)[1]?.toLowerCase();
  if (turn === 'b') return 'white';
  if (turn === 'w') return 'black';
  return null;
}

/**
 * Color con el que juega el usuario en el puzzle actual.
 * Un bloque de color fijo manda sobre el FEN; uno 'random' (el caso de infinity,
 * cuyo pool es de color mixto) lo deriva del puzzle que se está jugando.
 */
export function resolvePlayerColor(
  blockColor: 'white' | 'black' | 'random' | undefined,
  fen?: string
): 'white' | 'black' {
  if (blockColor === 'white' || blockColor === 'black') return blockColor;
  return playerColorFromFen(fen) ?? 'white';
}
