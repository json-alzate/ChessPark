import { TestBed } from '@angular/core/testing';

import { Puzzle, StreakConfig } from '@chesspark/models';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

import { StreakService } from '@services/progress/streak.service';
import { DEFAULT_STREAK_CONFIG } from '@services/progress/streak.util';

import { makePuzzle } from '@tests/support/partidas-progreso-fixtures';

/**
 * Manifiesto falso: qué temas tienen archivo en cada franja de 20 puntos. Así las
 * pruebas no dependen del catálogo real. 'short' y 'long' están en la lista de
 * temas excluidos de la mezcla.
 */
let mockManifest: Record<string, number[]> = {};

jest.mock('@chesspark/puzzles-provider', () => ({
  ...jest.requireActual('@chesspark/puzzles-provider'),
  MANIFEST_ELO_STEP: 20,
  getManifestThemes: () => Object.keys(mockManifest),
  getValidEloStarts: (theme?: string) =>
    theme && mockManifest[theme] ? new Set(mockManifest[theme]) : undefined,
}));

const BUCKET = 1500; // 1500..1519
const ALL_THEMES = ['alfa', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'];

describe('StreakService', () => {
  let service: StreakService;
  const cacheService = { isFileCached: jest.fn() };
  const provider = {
    getConfig: jest.fn(),
    getCacheService: jest.fn(),
    getPuzzles: jest.fn(),
  };
  const config: StreakConfig = { ...DEFAULT_STREAK_CONFIG };

  /** Mapea las URLs de caché a temas para que cada prueba diga qué tiene descargado. */
  const setCachedThemes = (themes: string[]) => {
    cacheService.isFileCached.mockImplementation(async (fileUrl: string) =>
      themes.some((theme) => fileUrl.includes(`/${theme}/`))
    );
  };

  const calls = () => provider.getPuzzles.mock.calls.map(([options]) => options);

  beforeEach(() => {
    jest.resetAllMocks();
    mockManifest = Object.fromEntries(ALL_THEMES.map((t) => [t, [BUCKET]]));
    mockManifest['short'] = [BUCKET]; // excluido de la mezcla
    provider.getConfig.mockReturnValue({
      cdnBaseUrl: 'https://cdn',
      githubUser: 'user',
    });
    provider.getCacheService.mockReturnValue(cacheService);
    setCachedThemes([]);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [StreakService, { provide: PuzzlesProvider, useValue: provider }],
    });
    service = TestBed.inject(StreakService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('pide primero la franja exacta del objetivo (banda 0) con 30 puzzles', async () => {
    provider.getPuzzles.mockResolvedValue([makePuzzle('p1', { rating: 1505 })]);

    await service.getPuzzleForElo(1505, config, new Set());

    expect(calls()[0]).toMatchObject({
      elo: 1505,
      eloMin: 1505,
      eloMax: 1505,
      count: 30,
    });
  });

  it('con tema "all" elige entre los temas con archivo a ese elo y nunca uno excluido', async () => {
    mockManifest = { alfa: [BUCKET], short: [BUCKET], long: [BUCKET], beta: [BUCKET + 20] };
    provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);
    const random = jest.spyOn(Math, 'random');

    for (const r of [0, 0.5, 0.99]) {
      random.mockReturnValue(r);
      await service.getPuzzleForElo(1505, config, new Set());
    }

    // Solo 'alfa' tiene archivo en la franja 1500 y no es un tema excluido
    expect(calls().map((c) => c.theme)).toEqual(['alfa', 'alfa', 'alfa']);
  });

  it('con tema fijo en la configuración respeta siempre ese tema', async () => {
    provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);

    await service.getPuzzleForElo(1505, { ...config, theme: 'fork' }, new Set());

    expect(calls()[0].theme).toBe('fork');
  });

  it('sin ningún tema disponible a ese elo pide sin tema en lugar de fallar', async () => {
    mockManifest = { alfa: [BUCKET + 400] };
    provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);

    const puzzle = await service.getPuzzleForElo(1505, config, new Set());

    expect(calls()[0].theme).toBeUndefined();
    expect(puzzle?.uid).toBe('p1');
  });

  describe('preferencia por lo ya descargado', () => {
    it('con 5 o más temas en caché, el primer intento sale solo de esos', async () => {
      // 'epsilon', 'zeta', 'eta', 'delta', 'gamma' en caché; 'alfa' y 'beta' no
      setCachedThemes(['gamma', 'delta', 'epsilon', 'zeta', 'eta']);
      provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.getPuzzleForElo(1505, config, new Set());

      // Con random=0 sale el primero de la lista: 'alfa' si no se filtrara por caché
      expect(calls()[0].theme).toBe('gamma');
    });

    it('con menos de 5 temas en caché se elige entre todos (conviene descargar para ampliar)', async () => {
      setCachedThemes(['gamma', 'delta', 'epsilon', 'zeta']);
      provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.getPuzzleForElo(1505, config, new Set());

      expect(calls()[0].theme).toBe('alfa');
    });

    it('solo el primer intento tira de la caché: si no sirvió, los siguientes eligen entre todos', async () => {
      setCachedThemes(['gamma', 'delta', 'epsilon', 'zeta', 'eta']);
      provider.getPuzzles
        .mockResolvedValueOnce([]) // el archivo cacheado no aportó nada nuevo
        .mockResolvedValueOnce([makePuzzle('p2')]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.getPuzzleForElo(1505, config, new Set());

      expect(calls().map((c) => c.theme)).toEqual(['gamma', 'alfa']);
    });

    it('si la consulta a la caché falla para un tema, ese tema cuenta como no descargado', async () => {
      setCachedThemes([]);
      cacheService.isFileCached.mockImplementation(async (fileUrl: string) => {
        if (fileUrl.includes('/alfa/')) {
          throw new Error('IndexedDB no disponible');
        }
        return true;
      });
      provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.getPuzzleForElo(1505, config, new Set());

      // 6 temas cacheados (beta..eta) >= 5: se usan solo esos y alfa queda fuera
      expect(calls()[0].theme).toBe('beta');
    });

    it('consulta la caché solo de los temas disponibles a ese elo, con la URL de su archivo', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('p1')]);

      await service.getPuzzleForElo(1505, config, new Set());

      const checked = cacheService.isFileCached.mock.calls.map(([u]) => u as string);
      // 7 temas de la mezcla; 'short' (excluido) no se consulta
      expect(checked).toHaveLength(ALL_THEMES.length);
      expect(checked.some((u) => u.includes('/short/'))).toBe(false);
      expect(checked.every((u) => u.endsWith('_1500_1519.json'))).toBe(true);
    });
  });

  describe('selección del puzzle', () => {
    it('descarta los puzzles ya jugados en la racha', async () => {
      provider.getPuzzles.mockResolvedValue([
        makePuzzle('jugado-1'),
        makePuzzle('jugado-2'),
        makePuzzle('nuevo'),
      ]);

      const puzzle = await service.getPuzzleForElo(
        1505,
        config,
        new Set(['jugado-1', 'jugado-2'])
      );

      expect(puzzle?.uid).toBe('nuevo');
    });

    it('en la banda 0 elige al azar entre los candidatos nuevos', async () => {
      const candidates = [
        makePuzzle('a', { rating: 1500 }),
        makePuzzle('b', { rating: 1519 }),
        makePuzzle('c', { rating: 1510 }),
      ];
      provider.getPuzzles.mockResolvedValue(candidates);
      const random = jest.spyOn(Math, 'random');

      random.mockReturnValue(0);
      const first = await service.getPuzzleForElo(1505, config, new Set());
      random.mockReturnValue(0.99);
      const last = await service.getPuzzleForElo(1505, config, new Set());

      expect(first?.uid).toBe('a');
      expect(last?.uid).toBe('c');
    });

    it('si la banda 0 no da nada nuevo en 3 intentos, abre a 100 y elige el más cercano al objetivo', async () => {
      const all: Puzzle[] = [
        makePuzzle('lejos', { rating: 1590 }),
        makePuzzle('cerca', { rating: 1498 }),
        makePuzzle('medio', { rating: 1560 }),
      ];
      provider.getPuzzles.mockImplementation(async ({ eloMin }: { eloMin: number }) =>
        eloMin === 1505 ? [makePuzzle('usado')] : all
      );

      const puzzle = await service.getPuzzleForElo(1505, config, new Set(['usado']));

      expect(puzzle?.uid).toBe('cerca');
      const bands = calls().map((c) => c.eloMax - c.elo);
      expect(bands).toEqual([0, 0, 0, 100]);
      expect(calls()[3]).toMatchObject({ eloMin: 1405, eloMax: 1605 });
    });

    it('si hasta la banda 100 está agotada sube a 300', async () => {
      provider.getPuzzles.mockImplementation(
        async ({ eloMax, elo }: { eloMax: number; elo: number }) =>
          eloMax - elo < 300 ? [] : [makePuzzle('lejano', { rating: 1700 })]
      );

      const puzzle = await service.getPuzzleForElo(1505, config, new Set());

      expect(puzzle?.uid).toBe('lejano');
      expect(calls()).toHaveLength(7); // 3 + 3 + 1
    });

    it('si el catálogo no sirve nada nuevo en ninguna banda devuelve null tras 9 intentos', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('usado')]);

      const puzzle = await service.getPuzzleForElo(1505, config, new Set(['usado']));

      expect(puzzle).toBeNull();
      expect(calls()).toHaveLength(9);
    });

    it('si el proveedor falla (sin conexión) sigue intentando y acaba devolviendo null sin lanzar', async () => {
      provider.getPuzzles.mockRejectedValue(new Error('sin red'));

      await expect(service.getPuzzleForElo(1505, config, new Set())).resolves.toBeNull();
      expect(calls()).toHaveLength(9);
    });

    it('un fallo puntual no impide encontrar un puzzle en el siguiente intento', async () => {
      provider.getPuzzles
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce([makePuzzle('ok')]);

      const puzzle = await service.getPuzzleForElo(1505, config, new Set());

      expect(puzzle?.uid).toBe('ok');
    });
  });
});
