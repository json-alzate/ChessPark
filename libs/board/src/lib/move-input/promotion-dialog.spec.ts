jest.mock('cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js', () => ({ PromotionDialog: class {} }));

import { closePromotionDialog } from './promotion-dialog';

function fakeBoard(shown: boolean) {
  const dialog = { state: { callback: jest.fn() as unknown }, setDisplayState: jest.fn() };
  return {
    dialog,
    board: {
      isPromotionDialogShown: jest.fn(() => shown),
      getExtension: jest.fn(() => dialog),
    },
  };
}

describe('closePromotionDialog', () => {
  it('cierra el diálogo abierto y anula su callback para que no actúe sobre el puzzle siguiente', () => {
    const { board, dialog } = fakeBoard(true);

    expect(closePromotionDialog(board)).toBe(true);

    expect(dialog.state.callback).toBeNull();
    expect(dialog.setDisplayState).toHaveBeenCalledWith('hidden');
  });

  it('no hace nada si no hay diálogo abierto', () => {
    const { board, dialog } = fakeBoard(false);

    expect(closePromotionDialog(board)).toBe(false);

    expect(dialog.setDisplayState).not.toHaveBeenCalled();
  });

  it.each([null, undefined, {}])('tolera un tablero sin la extensión (%p)', (board) => {
    expect(closePromotionDialog(board as never)).toBe(false);
  });

  it('si la extensión no está registrada no falla', () => {
    const board = { isPromotionDialogShown: () => true, getExtension: () => undefined };

    expect(closePromotionDialog(board)).toBe(false);
  });
});
