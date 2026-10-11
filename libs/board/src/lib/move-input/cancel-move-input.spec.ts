import { cancelMoveInput } from './cancel-move-input';

function fakeBoard(state: string) {
  const input = {
    moveInputState: state,
    fromSquare: 'e2' as string | null,
    toSquare: null as string | null,
    movedPiece: 'wp' as string | null,
    setMoveInputState: jest.fn(),
  };
  return { input, board: { view: { visualMoveInput: input } } };
}

describe('cancelMoveInput', () => {
  it.each(['dragTo', 'clickDragTo', 'pieceClickedThreshold', 'secondClickThreshold'])(
    'con el dedo todavía en la pieza (%s) la suelta y reinicia sin dejar la pieza vieja en la posición nueva',
    (state) => {
      const { board, input } = fakeBoard(state);

      expect(cancelMoveInput(board)).toBe(true);

      expect(input.fromSquare).toBeNull();
      expect(input.movedPiece).toBeNull();
      expect(input.setMoveInputState).toHaveBeenCalledWith('reset');
    }
  );

  it('una pieza elegida con un toque (clickTo) solo se descarta si se pide', () => {
    const { board, input } = fakeBoard('clickTo');

    expect(cancelMoveInput(board)).toBe(false);
    expect(input.setMoveInputState).not.toHaveBeenCalled();

    expect(cancelMoveInput(board, true)).toBe(true);
    expect(input.setMoveInputState).toHaveBeenCalledWith('reset');
  });

  it.each(['waitForInputStart', 'moveDone', 'reset'])('en %s no toca nada', (state) => {
    const { board, input } = fakeBoard(state);

    expect(cancelMoveInput(board, true)).toBe(false);

    expect(input.setMoveInputState).not.toHaveBeenCalled();
    expect(input.fromSquare).toBe('e2');
  });

  it.each([null, undefined, {}, { view: {} }])('tolera un tablero sin entrada de movimientos (%p)', (board) => {
    expect(cancelMoveInput(board)).toBe(false);
  });
});
