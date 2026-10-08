import { drawLastMove, LAST_MOVE_MARKER, MarkableBoard, removeMarkersExceptLastMove, turnBoard } from './board-markers';

type Marker = { type: { id?: string; class?: string }; square: string };

/** Tablero falso con marcadores en memoria. */
function createBoard(markers: Marker[] = [], orientation: 'w' | 'b' = 'w') {
  const state = { markers: [...markers], orientation };
  const board = {
    getMarkers: jest.fn((_type?: unknown, square?: string) =>
      state.markers.filter((m) => !square || m.square === square)
    ),
    removeMarkers: jest.fn((type?: unknown, square?: string) => {
      state.markers = state.markers.filter((m) => {
        if (type === undefined && square === undefined) return false;
        return !(m.type === type && (square === undefined || m.square === square));
      });
    }),
    addMarker: jest.fn((type: { id?: string; class: string }, square: string) => {
      state.markers.push({ type, square });
    }),
    setOrientation: jest.fn((o: 'w' | 'b') => {
      state.orientation = o;
    }),
    getOrientation: jest.fn(() => state.orientation),
  };
  return { board: board as unknown as MarkableBoard, state, mocks: board };
}

describe('removeMarkersExceptLastMove', () => {
  const lastMove = { id: 'lastMove', class: 'marker-square-green' };
  const selected = { class: 'marker-square-green' };
  const dot = { class: 'marker-dot-green' };

  it('quita todos los marcadores menos los de última jugada', () => {
    const { board, state } = createBoard([
      { type: lastMove, square: 'e2' },
      { type: selected, square: 'a1' },
      { type: dot, square: 'a2' },
    ]);

    removeMarkersExceptLastMove(board);

    expect(state.markers).toEqual([{ type: lastMove, square: 'e2' }]);
  });

  it('con una casilla, solo limpia esa casilla', () => {
    const { board, state } = createBoard([
      { type: selected, square: 'a1' },
      { type: dot, square: 'a2' },
    ]);

    removeMarkersExceptLastMove(board, 'a1');

    expect(state.markers).toEqual([{ type: dot, square: 'a2' }]);
  });

  it('no toca el tablero si solo hay marcadores de última jugada', () => {
    const { board, mocks } = createBoard([{ type: lastMove, square: 'e2' }]);

    removeMarkersExceptLastMove(board);

    expect(mocks.removeMarkers).not.toHaveBeenCalled();
  });
});

describe('drawLastMove', () => {
  it('limpia el tablero y marca el origen y el destino', () => {
    const { board, state } = createBoard([{ type: { class: 'otro' }, square: 'h8' }]);

    drawLastMove(board, 'e2', 'e4');

    expect(state.markers).toEqual([
      { type: LAST_MOVE_MARKER, square: 'e2' },
      { type: LAST_MOVE_MARKER, square: 'e4' },
    ]);
  });

  it('si falta una de las casillas solo limpia', () => {
    const { board, state } = createBoard([{ type: { class: 'otro' }, square: 'h8' }]);

    drawLastMove(board, 'e2', undefined);
    expect(state.markers).toEqual([]);

    drawLastMove(board);
    expect(state.markers).toEqual([]);
  });

  it('el marcador de última jugada se identifica como lastMove', () => {
    expect(LAST_MOVE_MARKER.id).toBe('lastMove');
  });
});

describe('turnBoard', () => {
  it('con un lado lo pone en ese lado', () => {
    const { board, state } = createBoard([], 'w');

    turnBoard(board, 'b');

    expect(state.orientation).toBe('b');
  });

  it('sin lado lo gira al contrario', () => {
    const { board, state } = createBoard([], 'w');

    turnBoard(board);
    expect(state.orientation).toBe('b');

    turnBoard(board);
    expect(state.orientation).toBe('w');
  });
});
