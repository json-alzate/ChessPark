/**
 * Datos fijos de prueba. Los puzzles son reales (formato del CDN de lichess) y sus
 * jugadas están validadas con chess.js: la primera jugada es la del rival.
 */
export interface PuzzleFixture {
  uid: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
  gameUrl: string;
  openingFamily: string;
  openingVariation: string;
}

const base = { ratingDeviation: 75, popularity: 90, nbPlays: 1200, openingFamily: '', openingVariation: '' };

export const PUZZLES: PuzzleFixture[] = [
  {
    ...base,
    uid: 'e2e00008',
    fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
    moves: 'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1',
    rating: 1913,
    themes: ['crushing', 'hangingPiece', 'long', 'middlegame'],
    gameUrl: 'https://lichess.org/787zsVup/black#47',
  },
  {
    ...base,
    uid: 'e2e0009B',
    fen: 'r2qr1k1/b1p2ppp/pp4n1/P1P1p3/4P1n1/B2P2Pb/3NBP1P/RN1QR1K1 b - - 1 16',
    moves: 'b6c5 e2g4 h3g4 d1g4',
    rating: 1100,
    themes: ['advantage', 'middlegame', 'short'],
    gameUrl: 'https://lichess.org/F8M8OS71#32',
  },
  {
    ...base,
    uid: 'e2e00sHx',
    fen: '5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27',
    moves: 'd3d6 f8d8 d6d8 f6d8',
    rating: 1400,
    themes: ['endgame', 'short', 'trappedPiece'],
    gameUrl: 'https://lichess.org/3tgWCDrM#53',
  },
];
