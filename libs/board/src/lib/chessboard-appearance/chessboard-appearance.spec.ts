import {
  BOARD_STYLE_OPTIONS,
  CHESSBOARD_SPRITE_WRAPPER_ID,
  DEFAULT_CHESSBOARD_APPEARANCE,
  getChessboardAppearance,
  isBoardStyle,
  isPiecesStyle,
  PIECES_FILES,
  PIECES_STYLE_OPTIONS,
  resetChessboardAppearanceForTests,
  setChessboardAppearance,
} from './chessboard-appearance';

describe('chessboard-appearance', () => {
  afterEach(() => {
    resetChessboardAppearanceForTests();
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('arranca con la apariencia que la app tenía antes de poder elegirla', () => {
    expect(getChessboardAppearance()).toEqual({ pieces: 'cburnett', board: 'chessboard-js' });
    expect(getChessboardAppearance()).toEqual(DEFAULT_CHESSBOARD_APPEARANCE);
  });

  it('cada set de piezas ofrecido tiene su sprite, y no hay sprites sin ofrecer', () => {
    expect([...PIECES_STYLE_OPTIONS].sort()).toEqual(Object.keys(PIECES_FILES).sort());
    PIECES_STYLE_OPTIONS.forEach((name) => expect(PIECES_FILES[name]).toMatch(/^pieces\/[a-z-]+\.svg$/));
  });

  it('los temas de tablero no se repiten', () => {
    const names = BOARD_STYLE_OPTIONS.map((option) => option.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('valida los nombres que llegan de fuera (perfil, localStorage)', () => {
    expect(isPiecesStyle('fantasy')).toBe(true);
    expect(isPiecesStyle('inventado')).toBe(false);
    expect(isPiecesStyle(undefined)).toBe(false);
    expect(isBoardStyle('green')).toBe(true);
    expect(isBoardStyle('inventado')).toBe(false);
    expect(isBoardStyle(null)).toBe(false);
  });

  it('cambia solo lo que se pide y descarta valores inválidos', () => {
    setChessboardAppearance({ board: 'blue' });
    expect(getChessboardAppearance()).toEqual({ pieces: 'cburnett', board: 'blue' });

    setChessboardAppearance({ pieces: 'nope' as never, board: undefined });
    expect(getChessboardAppearance()).toEqual({ pieces: 'cburnett', board: 'blue' });
  });

  it('cambia la clase de color de los tableros que ya están dibujados', () => {
    document.body.innerHTML =
      '<svg class="cm-chessboard border-type-thin chessboard-js"></svg><svg class="otra"></svg>';

    setChessboardAppearance({ board: 'green' });

    const [board, other] = Array.from(document.querySelectorAll('svg'));
    expect(board.getAttribute('class')).toBe('cm-chessboard border-type-thin green');
    expect(other.getAttribute('class')).toBe('otra');
  });

  it('reemplaza el sprite cacheado para que los tableros dibujados cambien de piezas', async () => {
    document.body.innerHTML = `<div id="${CHESSBOARD_SPRITE_WRAPPER_ID}"><svg id="viejo"></svg></div>`;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '<svg id="nuevo"></svg>' });
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    setChessboardAppearance({ pieces: 'fantasy' });
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchMock).toHaveBeenCalledWith('assets/cm-chessboard/assets/pieces/fantasy.svg');
    expect(document.getElementById(CHESSBOARD_SPRITE_WRAPPER_ID)?.innerHTML).toBe('<svg id="nuevo"></svg>');
  });

  it('si la descarga falla, los tableros conservan sus piezas', async () => {
    document.body.innerHTML = `<div id="${CHESSBOARD_SPRITE_WRAPPER_ID}"><svg id="viejo"></svg></div>`;
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('sin red'));

    setChessboardAppearance({ pieces: 'staunty' });
    await new Promise((resolve) => setTimeout(resolve));

    expect(document.getElementById(CHESSBOARD_SPRITE_WRAPPER_ID)?.innerHTML).toBe('<svg id="viejo"></svg>');
    expect(getChessboardAppearance().pieces).toBe('staunty');
  });

  it('sin tableros dibujados no descarga nada: el primero traerá el sprite vigente', async () => {
    const fetchMock = jest.fn();
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    setChessboardAppearance({ pieces: 'fantasy' });
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
