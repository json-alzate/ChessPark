/**
 * Encodes a chess position (FEN) as an 8×8×20 tensor for the neural network.
 *
 * Channels:
 *  0-5  : white pieces (P, N, B, R, Q, K)
 *  6-11 : black pieces (p, n, b, r, q, k)
 *  12   : side to move (1=white, 0=black)
 *  13   : castling — white kingside
 *  14   : castling — white queenside
 *  15   : castling — black kingside
 *  16   : castling — black queenside
 *  17   : en passant file (1 on that file, 0 elsewhere)
 *  18   : halfmove clock normalized to [0,1] over 100 moves
 *  19   : fullmove number normalized to [0,1] over 100 moves
 */

const PIECE_CHANNEL: Record<string, number> = {
  P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5,
  p: 6, n: 7, b: 8, r: 9, q: 10, k: 11,
};

export function encodeFen(fen: string): number[][][] {
  const tensor: number[][][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => new Array(20).fill(0))
  );

  const parts = fen.split(' ');
  const board = parts[0];
  const activeColor = parts[1] ?? 'w';
  const castling = parts[2] ?? '-';
  const enPassant = parts[3] ?? '-';
  const halfmove = parseInt(parts[4] ?? '0', 10);
  const fullmove = parseInt(parts[5] ?? '1', 10);

  // Piece planes (channels 0-11)
  let rank = 7;
  let file = 0;
  for (const ch of board) {
    if (ch === '/') {
      rank--;
      file = 0;
    } else if (ch >= '1' && ch <= '8') {
      file += parseInt(ch, 10);
    } else {
      const channel = PIECE_CHANNEL[ch];
      if (channel !== undefined) {
        tensor[rank][file][channel] = 1;
      }
      file++;
    }
  }

  // Side to move (channel 12)
  const sideValue = activeColor === 'w' ? 1 : 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      tensor[r][f][12] = sideValue;
    }
  }

  // Castling rights (channels 13-16)
  const castlingChannels: Record<string, number> = { K: 13, Q: 14, k: 15, q: 16 };
  for (const [flag, channel] of Object.entries(castlingChannels)) {
    if (castling.includes(flag)) {
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          tensor[r][f][channel] = 1;
        }
      }
    }
  }

  // En passant (channel 17) — mark the entire file
  if (enPassant !== '-') {
    const epFile = enPassant.charCodeAt(0) - 'a'.charCodeAt(0);
    for (let r = 0; r < 8; r++) {
      tensor[r][epFile][17] = 1;
    }
  }

  // Halfmove clock normalized (channel 18)
  const halfmoveNorm = Math.min(halfmove / 100, 1);
  // Fullmove normalized (channel 19)
  const fullmoveNorm = Math.min(fullmove / 100, 1);
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      tensor[r][f][18] = halfmoveNorm;
      tensor[r][f][19] = fullmoveNorm;
    }
  }

  return tensor;
}
