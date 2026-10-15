import { PuzzlesProvider, createPuzzlesProvider } from './puzzles-provider';
import { getValidEloStarts } from './manifest';
import { Puzzle } from './types';

// Mock de fetch global
global.fetch = jest.fn();

describe('PuzzlesProvider', () => {
  let provider: PuzzlesProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new PuzzlesProvider({
      enableCache: false, // Deshabilitar caché para tests
    });
  });

  afterEach(() => {
    provider.close();
  });

  describe('init', () => {
    it('debe inicializar correctamente', async () => {
      await expect(provider.init()).resolves.not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('debe retornar la configuración actual', () => {
      const config = provider.getConfig();
      expect(config).toHaveProperty('cdnBaseUrl');
      expect(config).toHaveProperty('githubUser');
      expect(config).toHaveProperty('enableCache');
      expect(config).toHaveProperty('cacheExpirationMs');
      expect(config).toHaveProperty('maxConcurrentDownloads');
      expect(config).toHaveProperty('batchSize');
    });
  });

  describe('getPuzzles', () => {
    const mockPuzzles: Partial<Puzzle>[] = [
      {
        uid: '00001',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: 'e2e4 e7e5',
        rating: 1500,
        themes: ['opening'],
      },
      {
        uid: '00002',
        fen: 'rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: 'd2d4 d7d5',
        rating: 1510,
        themes: ['middlegame'],
      },
    ];

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPuzzles,
      });
    });

    it('debe obtener puzzles con opciones por defecto', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({ elo: 1500 });

      expect(puzzles).toBeDefined();
      expect(Array.isArray(puzzles)).toBe(true);
    });

    it('debe obtener puzzles con ELO específico', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({ elo: 1800 });

      expect(puzzles).toBeDefined();
      expect(fetch).toHaveBeenCalled();
    });

    it('debe normalizar ELO menor al mínimo', async () => {
      await provider.init();
      // 'fork' existe en todo el rango 400-2800 en el manifiesto
      const puzzles = await provider.getPuzzles({ elo: 100, theme: 'fork' });

      expect(puzzles).toBeDefined();
      // Debería usar ELO_CONSTANTS.MIN_ELO (400)
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.some((call) => call[0].includes('400_419'))).toBe(true);
    });

    it('debe normalizar ELO mayor al máximo', async () => {
      await provider.init();
      // 'fork' existe en todo el rango 400-2800 en el manifiesto
      const puzzles = await provider.getPuzzles({ elo: 3000, theme: 'fork' });

      expect(puzzles).toBeDefined();
      // Debería usar ELO_CONSTANTS.MAX_ELO (2800)
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.some((call) => call[0].includes('2800_2819'))).toBe(true);
    });

    it('debe limitar la cantidad de puzzles al máximo permitido', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({ count: 500, elo: 1500 });

      // No debe devolver más de 200 (MAX_PUZZLE_COUNT)
      expect(puzzles.length).toBeLessThanOrEqual(200);
    });

    it('no devuelve el mismo ejercicio dos veces aunque varios archivos lo traigan', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [
          { uid: 'a', fen: 'f', moves: 'e2e4', rating: 1500, themes: ['fork'] },
          { uid: 'b', fen: 'f', moves: 'e2e4', rating: 1500, themes: ['fork'] },
        ],
      });
      const p = new PuzzlesProvider({ enableCache: false, batchSize: 3 });

      const puzzles = await p.getPuzzles({ elo: 1500, theme: 'fork', count: 50 });

      expect(puzzles.map((x) => x.uid).sort()).toEqual(['a', 'b']);
      p.close();
    });

    it('debe filtrar por color cuando se especifica', async () => {
      const mockPuzzlesWithColor: Partial<Puzzle>[] = [
        {
          uid: '00001',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: 'e2e4 e7e5',
          rating: 1500,
        },
        {
          uid: '00002',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
          moves: 'd2d4 d7d5',
          rating: 1510,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPuzzlesWithColor,
      });

      await provider.init();
      const puzzles = await provider.getPuzzles({ color: 'w', elo: 1500 });

      // Debería retornar solo puzzles donde el turno es blancas
      puzzles.forEach((puzzle) => {
        const color = puzzle.fen.split(' ')[1];
        expect(color).toBe('w');
      });
    });

    it('debe manejar errores de red correctamente y retornar array vacío si todos fallan', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('Failed to fetch')
      );

      await provider.init();

      // El provider es resiliente y continúa buscando en otros ELOs
      // Si todos fallan, retorna array vacío en lugar de lanzar error
      const puzzles = await provider.getPuzzles({ elo: 1500 });
      expect(Array.isArray(puzzles)).toBe(true);
      expect(puzzles.length).toBe(0);
    });

    it('debe manejar respuestas 404 sin lanzar error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await provider.init();
      const puzzles = await provider.getPuzzles({ elo: 1500 });

      // Debe retornar array vacío o intentar con otros ELOs
      expect(Array.isArray(puzzles)).toBe(true);
    });

    it('debe elegir un tema aleatorio si no se especifica tema ni apertura', async () => {
      await provider.init();
      await provider.getPuzzles({ elo: 1500 });

      // Verificar que se hizo una llamada a fetch con algún tema
      expect(fetch).toHaveBeenCalled();
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    it('debe procesar múltiples ELOs en paralelo usando batches', async () => {
      const mockPuzzlesBatch: Partial<Puzzle>[] = Array.from({ length: 10 }, (_, i) => ({
        uid: `0000${i}`,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: 'e2e4 e7e5',
        rating: 1500 + i,
        themes: ['opening'],
      }));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPuzzlesBatch,
      });

      await provider.init();
      const puzzles = await provider.getPuzzles({ elo: 1500, count: 50 });

      // Debe haber hecho múltiples llamadas (una por cada ELO en el batch)
      expect(fetch).toHaveBeenCalled();
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      // Debe haber procesado en batches (múltiples llamadas)
      expect(fetchCalls.length).toBeGreaterThan(1);
    });

    it('debe respetar el límite de descargas concurrentes', async () => {
      const providerWithLimit = new PuzzlesProvider({
        enableCache: false,
        maxConcurrentDownloads: 2,
        batchSize: 1,
      });

      let concurrentDownloads = 0;
      let maxConcurrent = 0;

      (global.fetch as jest.Mock).mockImplementation(async () => {
        concurrentDownloads++;
        maxConcurrent = Math.max(maxConcurrent, concurrentDownloads);

        // Simular tiempo de descarga
        await new Promise(resolve => setTimeout(resolve, 10));

        concurrentDownloads--;

        return {
          ok: true,
          status: 200,
          json: async () => mockPuzzles,
        };
      });

      await providerWithLimit.init();
      await providerWithLimit.getPuzzles({ elo: 1500, count: 10 });

      // El máximo de descargas concurrentes no debe exceder el límite
      expect(maxConcurrent).toBeLessThanOrEqual(2);

      providerWithLimit.close();
    });

    it('debe procesar batches correctamente', async () => {
      const providerWithBatch = new PuzzlesProvider({
        enableCache: false,
        batchSize: 3,
      });

      const callOrder: number[] = [];

      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        // Extraer el ELO de la URL para rastrear el orden
        const eloMatch = url.match(/(\d+)_\d+/);
        if (eloMatch) {
          callOrder.push(parseInt(eloMatch[1]));
        }

        return {
          ok: true,
          status: 200,
          json: async () => mockPuzzles,
        };
      });

      await providerWithBatch.init();
      await providerWithBatch.getPuzzles({ elo: 1500, count: 20 });

      // Debe haber procesado múltiples ELOs
      expect(callOrder.length).toBeGreaterThan(1);

      providerWithBatch.close();
    });
  });

  describe('descargas que se cuelgan', () => {
    /** Un fetch que nunca responde, salvo que se le aborte, como hace el navegador con `signal`. */
    const fetchColgado = () =>
      (global.fetch as jest.Mock).mockImplementation(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
            );
          })
      );

    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('un archivo que no responde se abandona tras el tiempo máximo en vez de esperar para siempre', async () => {
      fetchColgado();
      const lento = new PuzzlesProvider({ enableCache: false, requestTimeoutMs: 20 });

      const puzzles = await lento.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      expect(puzzles).toEqual([]);
      lento.close();
    });

    it('lo reintenta una vez antes de rendirse, la segunda en el espejo de GitHub', async () => {
      fetchColgado();
      const lento = new PuzzlesProvider({ enableCache: false, requestTimeoutMs: 20 });

      await lento.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      // Cada archivo se pidió dos veces: a jsDelivr y, después, al mismo archivo en raw.githubusercontent.com
      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
      expect(urls.length).toBeGreaterThanOrEqual(2);
      expect(urls.length % 2).toBe(0);
      const primarias = urls.filter((u) => u.startsWith('https://cdn.jsdelivr.net/'));
      const espejos = urls.filter((u) => u.startsWith('https://raw.githubusercontent.com/'));
      expect(primarias).toHaveLength(urls.length / 2);
      expect(espejos).toHaveLength(urls.length / 2);
      expect(espejos[0]).toMatch(/^https:\/\/raw\.githubusercontent\.com\/json-alzate\/chesscolate-puzzles-files-themes-[a-z]-[a-z]\/main\/puzzlesFilesThemes\/fork\/fork_\d+_\d+\.json$/);
      lento.close();
    });

    it('sin espejo repite el mismo servidor, como antes', async () => {
      fetchColgado();
      const lento = new PuzzlesProvider({ enableCache: false, requestTimeoutMs: 20, mirrorEnabled: false });

      await lento.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
      expect(urls.every((u) => u.startsWith('https://cdn.jsdelivr.net/'))).toBe(true);
      expect(new Set(urls).size).toBe(urls.length / 2);
      lento.close();
    });

    it('si jsDelivr responde con un error de servidor, el espejo salva la descarga', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) =>
        Promise.resolve(
          url.startsWith('https://cdn.jsdelivr.net/')
            ? { ok: false, status: 503 }
            : {
                ok: true,
                json: async () => [{ uid: 'espejo', fen: 'f', moves: 'e2e4', rating: 1500, themes: ['fork'] }],
              }
        )
      );
      const p = new PuzzlesProvider({ enableCache: false });

      const puzzles = await p.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      expect(puzzles.map((x) => x.uid)).toContain('espejo');
      p.close();
    });

    it('un 404 de jsDelivr es definitivo: no se consulta el espejo', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
      const p = new PuzzlesProvider({ enableCache: false });

      expect(await p.getPuzzles({ elo: 1500, theme: 'fork', count: 10 })).toEqual([]);
      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
      expect(urls.some((u) => u.includes('raw.githubusercontent.com'))).toBe(false);
      p.close();
    });

    it('si el reintento responde, se obtienen los puzzles', async () => {
      let llamadas = 0;
      (global.fetch as jest.Mock).mockImplementation(
        (_url: string, init?: { signal?: AbortSignal }) => {
          if (llamadas++ === 0) {
            return new Promise((_r, reject) =>
              init?.signal?.addEventListener('abort', () =>
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
              )
            );
          }
          return Promise.resolve({
            ok: true,
            json: async () => [{ uid: 'ok', fen: 'f', moves: 'e2e4', rating: 1500, themes: ['fork'] }],
          });
        }
      );
      const lento = new PuzzlesProvider({ enableCache: false, requestTimeoutMs: 20 });

      const puzzles = await lento.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      expect(puzzles.map((p) => p.uid)).toContain('ok');
      lento.close();
    });

    it('el tiempo máximo se puede configurar y por defecto son 8 s', () => {
      expect(provider.getConfig().requestTimeoutMs).toBe(8000);
      expect(new PuzzlesProvider({ requestTimeoutMs: 1234 }).getConfig().requestTimeoutMs).toBe(1234);
    });

    it('un error de servidor (500) no se reintenta contra el mismo servidor: no mejora esperando', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
      const rapido = new PuzzlesProvider({ enableCache: false, mirrorEnabled: false });

      await rapido.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url);
      expect(new Set(urls).size).toBe(urls.length);
      rapido.close();
    });

    it('si falla un batch entero por error del CDN no sigue con los ELOs vecinos', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
      const caido = new PuzzlesProvider({ enableCache: false, batchSize: 3 });

      expect(await caido.getPuzzles({ elo: 1500, theme: 'fork', count: 10 })).toEqual([]);

      // Solo se pidió el primer batch: tres archivos, cada uno a jsDelivr y a su espejo
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(6);
      caido.close();
    });

    it('un batch de archivos que no existen (404) sí sigue buscando en otros ELOs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
      const p = new PuzzlesProvider({ enableCache: false, batchSize: 3 });

      await p.getPuzzles({ elo: 1500, theme: 'fork', count: 10 });

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(3);
      p.close();
    });

    it('un 404 sigue siendo un archivo vacío, sin reintento', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
      const p = new PuzzlesProvider({ enableCache: false });

      expect(await p.getPuzzles({ elo: 1500, theme: 'fork', count: 10 })).toEqual([]);
      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url);
      expect(new Set(urls).size).toBe(urls.length);
      p.close();
    });
  });

  describe('filtrado por manifiesto', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });
    });

    it('no debe pedir nada si el tema no existe en el manifiesto', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({
        elo: 1500,
        theme: 'tema_inexistente_xyz',
      });

      expect(puzzles).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('no debe pedir nada si la apertura no existe en el manifiesto', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({
        elo: 1500,
        openingFamily: 'Apertura_Inexistente_XYZ',
      });

      expect(puzzles).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('solo debe pedir URLs cuyo rango de ELO existe para el tema', async () => {
      await provider.init();
      await provider.getPuzzles({ elo: 1500, theme: 'fork', count: 200 });

      const validStarts = getValidEloStarts('fork');
      expect(validStarts).toBeDefined();

      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.length).toBeGreaterThan(0);
      // Cada URL pedida debe corresponder a un ELO start presente en el manifiesto
      fetchCalls.forEach((call) => {
        const match = (call[0] as string).match(/_(\d+)_\d+\.json$/);
        expect(match).not.toBeNull();
        const start = parseInt(match![1], 10);
        expect(validStarts!.has(start)).toBe(true);
      });
    });
  });

  describe('createPuzzlesProvider', () => {
    it('debe crear y inicializar un proveedor', async () => {
      const provider = await createPuzzlesProvider({
        enableCache: false,
      });

      expect(provider).toBeInstanceOf(PuzzlesProvider);
      provider.close();
    });
  });

  describe('cache methods', () => {
    beforeEach(() => {
      provider = new PuzzlesProvider({
        enableCache: false,
      });
    });

    it('debe limpiar el caché', async () => {
      await provider.init();
      await expect(provider.clearCache()).resolves.not.toThrow();
    });

    it('debe obtener el tamaño del caché', async () => {
      await provider.init();
      const size = await provider.getCacheSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('close', () => {
    it('debe cerrar la conexión sin errores', async () => {
      await provider.init();
      expect(() => provider.close()).not.toThrow();
    });
  });
});
