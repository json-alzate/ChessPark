import { PuzzlesProvider, createPuzzlesProvider } from './puzzles-provider';
import { ELO_CONSTANTS } from './constants';
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
    const mockPuzzles: Puzzle[] = [
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
      const puzzles = await provider.getPuzzles();

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
      const puzzles = await provider.getPuzzles({ elo: 100 });

      expect(puzzles).toBeDefined();
      // Debería usar ELO_CONSTANTS.MIN_ELO (400)
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.some((call) => call[0].includes('400_419'))).toBe(true);
    });

    it('debe normalizar ELO mayor al máximo', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({ elo: 3000 });

      expect(puzzles).toBeDefined();
      // Debería usar ELO_CONSTANTS.MAX_ELO (2800)
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.some((call) => call[0].includes('2800_2819'))).toBe(true);
    });

    it('debe limitar la cantidad de puzzles al máximo permitido', async () => {
      await provider.init();
      const puzzles = await provider.getPuzzles({ count: 500 });

      // No debe devolver más de 200 (MAX_PUZZLE_COUNT)
      expect(puzzles.length).toBeLessThanOrEqual(200);
    });

    it('debe filtrar por color cuando se especifica', async () => {
      const mockPuzzlesWithColor: Puzzle[] = [
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
      await provider.getPuzzles();

      // Verificar que se hizo una llamada a fetch con algún tema
      expect(fetch).toHaveBeenCalled();
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    it('debe procesar múltiples ELOs en paralelo usando batches', async () => {
      const mockPuzzlesBatch: Puzzle[] = Array.from({ length: 10 }, (_, i) => ({
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
