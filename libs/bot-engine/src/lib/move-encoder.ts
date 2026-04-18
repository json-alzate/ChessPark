/**
 * Encodes/decodes UCI chess moves to/from a flat policy index (0–4095).
 *
 * Index = fromSquare * 64 + toSquare
 * where squares are numbered 0–63: a1=0, b1=1, ..., h8=63
 *
 * Promotions: queen promotion is assumed when the last rank is reached.
 * Other promotions (n/b/r) are encoded as the base from-to pair
 * and resolved externally if needed.
 */

function squareIndex(squareStr: string): number {
  const file = squareStr.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(squareStr[1], 10) - 1;
  return rank * 8 + file;
}

function squareFromIndex(idx: number): string {
  const file = idx % 8;
  const rank = Math.floor(idx / 8);
  return String.fromCharCode('a'.charCodeAt(0) + file) + String(rank + 1);
}

export function uciToIndex(uci: string): number {
  const from = squareIndex(uci.slice(0, 2));
  const to = squareIndex(uci.slice(2, 4));
  return from * 64 + to;
}

export function indexToUci(index: number): string {
  const from = Math.floor(index / 64);
  const to = index % 64;
  return squareFromIndex(from) + squareFromIndex(to);
}

/**
 * Builds a Float32Array mask of length 4096.
 * Legal moves get value 1, all others 0.
 */
export function buildLegalMask(legalMoves: string[]): Float32Array {
  const mask = new Float32Array(4096);
  for (const move of legalMoves) {
    const idx = uciToIndex(move);
    if (idx >= 0 && idx < 4096) {
      mask[idx] = 1;
    }
  }
  return mask;
}
