import { RunnerPiecesService } from '@features/chess-runner/services/runner-pieces.service';

/**
 * Las piezas del runner son las del set elegido para el tablero. La librería del tablero (que arrastra
 * cm-chessboard) se sustituye por su tabla de archivos; el SVG del set y las imágenes son dobles.
 */

let estilo = 'cburnett';
jest.mock('@chesspark/board', () => ({
  CHESSBOARD_ASSETS_URL: 'assets/cm-chessboard/assets/',
  PIECES_FILES: { cburnett: 'pieces/standard.svg', papercut: 'pieces/papercut.svg' },
  getChessboardAppearance: () => ({ pieces: estilo, board: 'default' }),
}));

const CLAVES = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp'];

/** Un sprite como el de cm-chessboard: un `<g id>` por pieza. `envuelto` imita los sets con un `<g>` de herencia alrededor. */
function sprite(envuelto = false, sin: string[] = []): string {
  const piezas = CLAVES.filter((c) => !sin.includes(c))
    .map((c) => `<g id="${c}"><path d="M0 0h10v10z" data-pieza="${c}"/></g>`)
    .join('');
  const cuerpo = envuelto ? `<g id="Sprite" stroke="none" fill="none">${piezas}</g>` : piezas;
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="40px" height="40px" viewBox="0 0 40 40">${cuerpo}</svg>`;
}

const decodificar = (url: string) => decodeURIComponent(url.replace('data:image/svg+xml;charset=utf-8,', ''));

describe('RunnerPiecesService', () => {
  let servicio: RunnerPiecesService;
  const fetchFalso = jest.fn();
  let fallarImagenes = false;
  const original = {
    fetch: (globalThis as unknown as { fetch: unknown }).fetch,
    Image: (globalThis as unknown as { Image: unknown }).Image,
  };

  beforeEach(() => {
    estilo = 'cburnett';
    fallarImagenes = false;
    fetchFalso.mockReset();
    fetchFalso.mockResolvedValue({ ok: true, status: 200, text: async () => sprite() });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;
    // Una imagen que «carga» (o falla) en cuanto se le pone el `src`
    (globalThis as unknown as { Image: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_valor: string) {
        queueMicrotask(() => (fallarImagenes ? this.onerror?.() : this.onload?.()));
      }
    };
    servicio = new RunnerPiecesService();
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = original.fetch;
    (globalThis as unknown as { Image: unknown }).Image = original.Image;
  });

  it('descarga el set elegido en Ajustes y parte el sprite en las doce piezas', async () => {
    const set = await servicio.load();

    expect(fetchFalso).toHaveBeenCalledWith('assets/cm-chessboard/assets/pieces/standard.svg');
    expect([...set.images.keys()].sort()).toEqual([...CLAVES].sort());
    expect([...set.urls.keys()].sort()).toEqual([...CLAVES].sort());
  });

  it('cada pieza es un SVG suelto de 40×40 con solo su dibujo', async () => {
    const { urls } = await servicio.load();

    const svg = decodificar(urls.get('wn') as string);
    expect(urls.get('wn')).toMatch(/^data:image\/svg\+xml/);
    expect(svg).toContain('viewBox="0 0 40 40"');
    expect(svg).toContain('data-pieza="wn"');
    expect(svg).not.toContain('data-pieza="bn"');
    expect(svg).not.toContain('id="wn"');
  });

  it('conserva el grupo que envuelve a las piezas: de él heredan el trazo y el relleno', async () => {
    fetchFalso.mockResolvedValue({ ok: true, status: 200, text: async () => sprite(true) });

    const { urls } = await servicio.load();

    const svg = decodificar(urls.get('bq') as string);
    expect(svg).toContain('stroke="none"');
    expect(svg).toContain('data-pieza="bq"');
    expect(svg).not.toContain('id="Sprite"');
  });

  it('pide el set que haya elegido el usuario', async () => {
    estilo = 'papercut';

    await servicio.load();

    expect(fetchFalso).toHaveBeenCalledWith('assets/cm-chessboard/assets/pieces/papercut.svg');
  });

  it('descarga cada set una sola vez; las siguientes carreras lo reutilizan', async () => {
    const primero = await servicio.load();
    const segundo = await servicio.load();

    expect(segundo).toBe(primero);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('al cambiar de set descarga el nuevo y conserva el anterior', async () => {
    await servicio.load();
    estilo = 'papercut';
    await servicio.load();
    estilo = 'cburnett';
    await servicio.load();

    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('falla si la descarga falla, y no deja el fallo guardado: la próxima vez reintenta', async () => {
    fetchFalso.mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' });

    await expect(servicio.load()).rejects.toThrow('503');
    const set = await servicio.load();

    expect(set.images.size).toBe(12);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('falla con claridad si al set le falta una pieza', async () => {
    fetchFalso.mockResolvedValue({ ok: true, status: 200, text: async () => sprite(false, ['wk']) });

    await expect(servicio.load()).rejects.toThrow('wk');
  });

  it('falla si una pieza no se puede dibujar', async () => {
    fallarImagenes = true;

    await expect(servicio.load()).rejects.toThrow();
  });
});
