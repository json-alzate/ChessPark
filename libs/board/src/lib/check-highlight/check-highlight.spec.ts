import { CheckHighlight } from './check-highlight';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Doble mínimo del tablero de cm-chessboard: lo que la extensión toca de él. */
function fakeBoard(fen: string) {
  const layer = document.createElementNS(SVG_NS, 'g');
  const existing = document.createElementNS(SVG_NS, 'g');
  existing.setAttribute('class', 'markers');
  layer.appendChild(existing);
  const board = {
    fen,
    state: { position: {}, extensionPoints: {} as Record<string, (() => void)[]> },
    view: {
      markersLayer: layer,
      squareWidth: 10,
      squareHeight: 10,
      // a1 abajo a la izquierda: x por columna, y por fila contada desde arriba
      squareToPoint: (square: string) => ({
        x: (square.charCodeAt(0) - 97) * 10,
        y: (8 - Number(square[1])) * 10,
      }),
    },
    getPosition: () => board.fen,
  };
  return board;
}

function fire(board: ReturnType<typeof fakeBoard>, point: string) {
  board.state.extensionPoints[point].forEach((callback) => callback());
}

describe('CheckHighlight', () => {
  it('pinta de rojo la casilla del rey en jaque, con el tamaño y lugar de esa casilla', () => {
    const board = fakeBoard('rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR');
    new CheckHighlight(board);

    fire(board, 'positionChanged');

    const rects = board.view.markersLayer.querySelectorAll('rect.check-square');
    expect(rects).toHaveLength(1);
    expect(rects[0].getAttribute('x')).toBe('40'); // e
    expect(rects[0].getAttribute('y')).toBe('0'); // fila 8
    expect(rects[0].getAttribute('width')).toBe('10');
    expect(rects[0].getAttribute('fill')).toMatch(/^url\(#cm-check-gradient-\d+\)$/);
  });

  it('quita el rojo cuando el jaque desaparece', () => {
    const board = fakeBoard('rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR');
    new CheckHighlight(board);
    fire(board, 'positionChanged');

    board.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    fire(board, 'positionChanged');

    expect(board.view.markersLayer.querySelectorAll('rect.check-square')).toHaveLength(0);
  });

  it('se redibuja cuando el tablero se redibuja (giro, cambio de tamaño)', () => {
    const board = fakeBoard('rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR');
    new CheckHighlight(board);
    fire(board, 'positionChanged');

    board.view.squareWidth = 20;
    fire(board, 'afterRedrawBoard');

    expect(board.view.markersLayer.querySelector('rect.check-square')?.getAttribute('width')).toBe('20');
  });

  it('antes de que exista la posición no dibuja ni falla', () => {
    const board = fakeBoard('');
    board.state.position = undefined as never;
    new CheckHighlight(board);

    expect(() => fire(board, 'afterRedrawBoard')).not.toThrow();
  });

  it('va debajo de los demás marcadores y se retira al destruir el tablero', () => {
    const board = fakeBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    new CheckHighlight(board);

    expect(board.view.markersLayer.firstElementChild?.getAttribute('class')).toBe('check-highlight');

    fire(board, 'destroy');

    expect(board.view.markersLayer.querySelector('.check-highlight')).toBeNull();
    expect(board.view.markersLayer.querySelector('.markers')).not.toBeNull();
  });
});
