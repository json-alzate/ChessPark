import { heatCells, singlePiecePlacement } from './board-heatmap.util';

describe('heatCells', () => {
  it('con blancas abajo empieza en a8 y termina en h1', () => {
    const cells = heatCells({}, '', 'w');

    expect(cells).toHaveLength(64);
    expect(cells[0].square).toBe('a8');
    expect(cells[63].square).toBe('h1');
  });

  it('con negras abajo empieza en h1 y termina en a8', () => {
    const cells = heatCells({}, '', 'b');

    expect(cells[0].square).toBe('h1');
    expect(cells[63].square).toBe('a8');
  });

  it('la casilla más visitada tiene la intensidad máxima', () => {
    const cells = heatCells({ f3: 4, g5: 1, e5: 2 }, 'g1', 'w');
    const bySquare = Object.fromEntries(cells.map((cell) => [cell.square, cell]));

    expect(bySquare['f3'].level).toBe(4);
    expect(bySquare['e5'].level).toBe(2);
    expect(bySquare['g5'].level).toBe(1);
    expect(bySquare['a1'].level).toBe(0);
    expect(bySquare['g1'].isStart).toBe(true);
  });
});

describe('singlePiecePlacement', () => {
  it('coloca una pieza blanca en mayúscula', () => {
    expect(singlePiecePlacement('wn', 'f3')).toBe('8/8/8/8/8/5N2/8/8');
  });

  it('coloca una pieza negra en minúscula', () => {
    expect(singlePiecePlacement('bq', 'd8')).toBe('3q4/8/8/8/8/8/8/8');
  });

  it('sin pieza devuelve el tablero vacío', () => {
    expect(singlePiecePlacement('', '')).toBe('8/8/8/8/8/8/8/8');
  });
});
