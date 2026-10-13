import { Chess } from 'chess.js';
import { puzzleToFrames } from '@features/stream/utils/puzzle-frames.util';

// Puzzle real de la base (mate en 2, ELO 1506): el rival juega primero y resuelven las negras.
const MATE_EN_2 = {
  fen: '1r5r/5pk1/4p3/2Np2PP/p1nP4/n1P5/P3B3/K1R4R w - - 2 34',
  moves: 'c5a4 b8b1 c1b1 a3c2',
};

describe('puzzleToFrames', () => {
  it('devuelve la posición inicial más una por jugada', () => {
    const frames = puzzleToFrames(MATE_EN_2);

    expect(frames?.fens).toHaveLength(5);
    expect(frames?.moveSquares).toHaveLength(4);
    expect(frames?.fens[0]).toBe(MATE_EN_2.fen);
  });

  it('la primera jugada es la del rival y quien resuelve es el otro color', () => {
    const frames = puzzleToFrames(MATE_EN_2);

    expect(frames?.moveSquares[0]).toEqual({ from: 'c5', to: 'a4' });
    expect(frames?.solver).toBe('b');
  });

  it('la solución termina en mate', () => {
    const frames = puzzleToFrames(MATE_EN_2);

    expect(new Chess(frames?.fens.at(-1)).isCheckmate()).toBe(true);
  });

  it('entiende las promociones', () => {
    const frames = puzzleToFrames({ fen: '6k1/P7/8/8/8/8/8/K7 b - - 0 1', moves: 'g8h8 a7a8q' });

    expect(frames?.fens.at(-1)).toMatch(/^Q6k/);
    expect(frames?.solver).toBe('w');
  });

  it('descarta un puzzle con una jugada ilegal', () => {
    expect(puzzleToFrames({ ...MATE_EN_2, moves: 'c5a4 b8b1 c1b1 a3a3' })).toBeNull();
  });

  it('descarta un FEN inválido', () => {
    expect(puzzleToFrames({ fen: 'esto no es un fen', moves: 'e2e4 e7e5' })).toBeNull();
  });

  it('descarta un puzzle sin solución (menos de dos jugadas)', () => {
    expect(puzzleToFrames({ ...MATE_EN_2, moves: 'c5a4' })).toBeNull();
    expect(puzzleToFrames({ ...MATE_EN_2, moves: '' })).toBeNull();
  });

  it('descarta jugadas con formato raro en lugar de lanzar', () => {
    expect(puzzleToFrames({ ...MATE_EN_2, moves: 'c5a4 zzzz' })).toBeNull();
  });
});
