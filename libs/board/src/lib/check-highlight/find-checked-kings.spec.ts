import { findCheckedKings } from './find-checked-kings';

describe('findCheckedKings', () => {
  it('la posición inicial no tiene reyes en jaque', () => {
    expect(findCheckedKings('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toEqual([]);
  });

  it('detecta el rey negro en jaque por una dama', () => {
    // 1.e4 f6 2.Qh5+
    expect(findCheckedKings('rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR')).toEqual(['e8']);
  });

  it('detecta el rey blanco en jaque por un alfil', () => {
    // 1.e4 e5 2.Nf3 Bb4 ... jaque con ...Bb4+ tras 1.d4 e5 2.dxe5 Bb4+
    expect(findCheckedKings('rnbqk1nr/pppp1ppp/8/4P3/1b6/8/PPP1PPPP/RNBQKBNR')).toEqual(['e1']);
  });

  it('acepta un FEN completo, no solo la colocación', () => {
    expect(
      findCheckedKings('rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2')
    ).toEqual(['e8']);
  });

  it('una pieza clavada o bloqueada no da jaque', () => {
    // la dama h5 queda tapada por el peón g6
    expect(findCheckedKings('rnbqkbnr/pppppp1p/6p1/7Q/4P3/8/PPPP1PPP/RNB1KBNR')).toEqual([]);
  });

  it('sin los dos reyes (mapa de calor, coordenadas) devuelve lista vacía sin fallar', () => {
    expect(findCheckedKings('8/8/8/8/3Q4/8/8/8')).toEqual([]);
    expect(findCheckedKings('')).toEqual([]);
  });
});
