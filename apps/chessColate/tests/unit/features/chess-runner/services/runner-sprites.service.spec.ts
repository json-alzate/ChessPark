import { RunnerSpritesService } from '@features/chess-runner/services/runner-sprites.service';

const MANIFIESTO = {
  sprites: {
    'dog-run': { file: 'dog-run.png', frameW: 52, frameH: 40, frames: 4, fps: 12 },
    'piece-pawn-w': { file: 'piece-pawn-w.png', frameW: 18, frameH: 24, frames: 1, fps: 1 },
  },
};

describe('RunnerSpritesService', () => {
  let service: RunnerSpritesService;
  const fetchFalso = jest.fn();
  const imagenesPedidas: string[] = [];
  let fallarImagen: string | null = null;
  const original = { fetch: (globalThis as unknown as { fetch: unknown }).fetch, Image: (globalThis as unknown as { Image: unknown }).Image };

  beforeEach(() => {
    imagenesPedidas.length = 0;
    fallarImagen = null;
    fetchFalso.mockReset();
    fetchFalso.mockResolvedValue({ ok: true, status: 200, json: async () => MANIFIESTO });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchFalso;
    // Una imagen que «carga» (o falla) en cuanto se le pone el `src`
    (globalThis as unknown as { Image: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(valor: string) {
        imagenesPedidas.push(valor);
        queueMicrotask(() => (fallarImagen && valor.includes(fallarImagen) ? this.onerror?.() : this.onload?.()));
      }
    };
    service = new RunnerSpritesService();
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = original.fetch;
    (globalThis as unknown as { Image: unknown }).Image = original.Image;
  });

  it('lee el manifiesto y baja cada tira', async () => {
    const sprites = await service.load();

    expect(fetchFalso).toHaveBeenCalledWith('assets/images/runner/runner.json');
    expect([...sprites.keys()]).toEqual(['dog-run', 'piece-pawn-w']);
    expect(imagenesPedidas.sort()).toEqual([
      'assets/images/runner/dog-run.png',
      'assets/images/runner/piece-pawn-w.png',
    ]);
  });

  it('cada sprite trae sus medidas y su velocidad', async () => {
    const sprites = await service.load();

    expect(sprites.get('dog-run')).toMatchObject({ frameW: 52, frameH: 40, frames: 4, fps: 12 });
  });

  it('solo carga una vez: las siguientes carreras reutilizan lo bajado', async () => {
    const primera = await service.load();
    const segunda = await service.load();

    expect(segunda).toBe(primera);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('dos peticiones a la vez comparten la misma descarga', async () => {
    const [a, b] = await Promise.all([service.load(), service.load()]);

    expect(a).toBe(b);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('si el manifiesto no responde, falla con un mensaje claro', async () => {
    fetchFalso.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    await expect(service.load()).rejects.toThrow('runner.json (404)');
  });

  it('si una imagen no carga, falla y dice cuál', async () => {
    fallarImagen = 'piece-pawn-w';

    await expect(service.load()).rejects.toThrow('piece-pawn-w.png');
  });

  it('un fallo no se queda guardado: la siguiente vez se reintenta', async () => {
    fetchFalso.mockRejectedValueOnce(new Error('sin red'));
    await expect(service.load()).rejects.toThrow('sin red');

    const sprites = await service.load();

    expect(sprites.size).toBe(2);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });
});
