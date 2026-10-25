import { PackAssetsService } from '@features/chess-runner/services/pack-assets.service';

import { MAP_VACIO, MAP_ZONA, PACK_UNO, PACK_VARIOS } from '@tests/support/pack-lab';

const RUNNER = { sprites: { 'scene-floor': { file: 'scene-floor.png', frameW: 32, frameH: 20, frames: 1, fps: 1 } } };

type Respuesta = { ok: boolean; status: number; json: () => Promise<unknown> } | Error;

describe('PackAssetsService', () => {
  const original = (globalThis as unknown as { fetch: unknown }).fetch;
  const fetchFalso = jest.fn();
  let service: PackAssetsService;

  /** Responde a cada archivo con su JSON, un 404 (`undefined`) o un fallo de red (`Error`). */
  function servir(archivos: Record<string, unknown>) {
    fetchFalso.mockImplementation(async (url: string): Promise<Respuesta> => {
      const nombre = Object.keys(archivos).find((clave) => url.split('?')[0].endsWith(clave));
      const valor = nombre ? archivos[nombre] : undefined;
      if (valor instanceof Error) throw valor;
      if (valor === undefined) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => valor };
    });
  }

  beforeEach(() => {
    fetchFalso.mockReset();
    (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;
    service = new PackAssetsService();
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = original;
  });

  it('lee los tres manifiestos de sus carpetas', async () => {
    servir({ 'pack.json': PACK_UNO, 'map.json': MAP_VACIO, 'runner.json': RUNNER });

    await service.load();

    expect(fetchFalso.mock.calls.map(([url]) => url).sort()).toEqual([
      'assets/images/map/map.json',
      'assets/images/pack/pack.json',
      'assets/images/runner/runner.json',
    ]);
  });

  it('con un solo personaje y el mapa vacío: un personaje y ninguna zona, sin avisos', async () => {
    servir({ 'pack.json': PACK_UNO, 'map.json': MAP_VACIO, 'runner.json': RUNNER });

    const assets = await service.load();

    expect(assets.characters.map((c) => c.id)).toEqual(['choco']);
    expect(assets.map.zones).toEqual([]);
    expect(assets.backdrop['scene-floor']).toEqual({ file: 'scene-floor.png', frameW: 32, frameH: 20 });
    expect(assets.missing).toEqual([]);
  });

  it('con varios personajes y una zona los entrega todos', async () => {
    servir({ 'pack.json': PACK_VARIOS, 'map.json': MAP_ZONA, 'runner.json': RUNNER });

    const assets = await service.load();

    expect(assets.characters.map((c) => c.id)).toEqual(['choco', 'nannukk', 'luna']);
    expect(assets.map.zones.map((z) => z.id)).toEqual(['1']);
    expect(assets.map.paper.trail).toHaveLength(3);
  });

  it('si falta un manifiesto o falla la red, sigue con lo demás y lo apunta', async () => {
    servir({ 'pack.json': PACK_UNO, 'runner.json': new Error('sin red') });

    const assets = await service.load();

    expect(assets.characters).toHaveLength(1);
    expect(assets.map.zones).toEqual([]);
    expect(assets.backdrop).toEqual({});
    expect(assets.missing).toEqual(['map', 'runner']);
  });

  it('un JSON roto cuenta como que falta', async () => {
    servir({ 'map.json': MAP_VACIO, 'runner.json': RUNNER });
    fetchFalso.mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('x')) }));

    const assets = await service.load();

    expect(assets.missing).toContain('pack');
    expect(assets.characters).toEqual([]);
  });

  it('al recargar pide los archivos de nuevo saltándose la caché, y no guarda nada entre cargas', async () => {
    servir({ 'pack.json': PACK_UNO, 'map.json': MAP_VACIO, 'runner.json': RUNNER });
    await service.load();
    servir({ 'pack.json': PACK_VARIOS, 'map.json': MAP_VACIO, 'runner.json': RUNNER });

    const assets = await service.load({ fresh: true });

    expect(assets.characters).toHaveLength(3);
    expect(assets.version).toMatch(/^v=\d+$/);
    const [url, opciones] = fetchFalso.mock.calls[fetchFalso.mock.calls.length - 1];
    expect(url).toContain(`?${assets.version}`);
    expect(opciones).toEqual({ cache: 'no-store' });
  });

  it('brokenImages() devuelve, en orden, las imágenes que no cargan', async () => {
    const ImagenOriginal = globalThis.Image;
    class ImagenFalsa {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(url: string) {
        setTimeout(() => (url.includes('rota') ? this.onerror?.() : this.onload?.()), 0);
      }
    }
    (globalThis as unknown as { Image: unknown }).Image = ImagenFalsa;
    try {
      await expect(service.brokenImages(['a.png', 'rota-1.png', 'b.png', 'rota-2.png'])).resolves.toEqual(['rota-1.png', 'rota-2.png']);
      await expect(service.brokenImages([])).resolves.toEqual([]);
    } finally {
      globalThis.Image = ImagenOriginal;
    }
  });

  describe('visibleHeight()', () => {
    const ImagenOriginal = globalThis.Image;
    class ImagenFalsa {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(url: string) {
        setTimeout(() => (url.includes('rota') ? this.onerror?.() : this.onload?.()), 0);
      }
    }

    beforeEach(() => {
      (globalThis as unknown as { Image: unknown }).Image = ImagenFalsa;
    });

    afterEach(() => {
      globalThis.Image = ImagenOriginal;
      jest.restoreAllMocks();
    });

    /** Un canvas falso cuyo cuadro de 4×6 tiene opacas las filas 2 a 4 (alto visible 3). */
    function canvasFalso() {
      const alfa = [0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 9, 0, 255, 0, 0, 0, 0, 0, 0, 0];
      const data = new Uint8ClampedArray(alfa.length * 4);
      alfa.forEach((a, i) => (data[i * 4 + 3] = a));
      const drawImage = jest.fn();
      const contexto = { drawImage, getImageData: jest.fn(() => ({ data })) };
      const crear = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = crear(tag);
        if (tag === 'canvas') (el as HTMLCanvasElement).getContext = jest.fn(() => contexto) as never;
        return el;
      });
      return { drawImage };
    }

    it('pinta solo el primer cuadro y cuenta de la primera a la última fila opaca', async () => {
      const { drawImage } = canvasFalso();

      await expect(service.visibleHeight('pack-choco-run.png', 4, 6)).resolves.toBe(3);
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4, 6, 0, 0, 4, 6);
    });

    it('da null si la imagen no carga o no hay canvas (jsdom)', async () => {
      await expect(service.visibleHeight('rota.png', 4, 6)).resolves.toBeNull();
      jest.spyOn(document, 'createElement').mockImplementation(() => ({ getContext: () => null }) as never);
      await expect(service.visibleHeight('pack-choco-run.png', 4, 6)).resolves.toBeNull();
    });
  });

  it('url() arma la ruta del archivo con la versión si la hay', () => {
    expect(PackAssetsService.url('assets/images/pack/', 'a.png')).toBe('assets/images/pack/a.png');
    expect(PackAssetsService.url('assets/images/pack/', 'a.png', 'v=1')).toBe('assets/images/pack/a.png?v=1');
  });
});
