import { InfinityPoolEntry, Puzzle, PuzzlesProvider } from '@chesspark/puzzles-provider';
import { ProfileService } from '@core/account/profile.service';
import { InfinityPuzzlePoolService } from '@services/training/infinity-puzzle-pool.service';

import { makePuzzle } from '@tests/support/partidas-progreso-fixtures';

/** Lista corta y conocida de temas: permite pruebas deterministas del relleno. */
const mockThemes = [
  'fork', 'pin', 'mate', 'opening', 'endgame', 'skewer',
  'sacrifice', 'deflection', 'attraction', 'quietMove', 'zugzwang', 'clearance',
];

jest.mock('@chesspark/puzzles-provider', () => ({
  ...jest.requireActual('@chesspark/puzzles-provider'),
  AVAILABLE_THEMES: [
    'fork', 'pin', 'mate', 'opening', 'endgame', 'skewer',
    'sacrifice', 'deflection', 'attraction', 'quietMove', 'zugzwang', 'clearance',
  ],
}));

const POOL_SIZE = 50;
const ELO = 1500;

const puzzles = (count: number, prefix = 'p', overrides: Partial<Puzzle> = {}): Puzzle[] =>
  Array.from({ length: count }, (_, i) => makePuzzle(`${prefix}${i}`, overrides));

const poolOf = (list: Puzzle[], elo = ELO): InfinityPoolEntry => ({
  id: 'infinityPool',
  puzzles: list,
  elo,
  createdAt: 1,
});

/** Deja correr el trabajo en segundo plano (todos los dobles resuelven sin red). */
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

describe('InfinityPuzzlePoolService', () => {
  let service: InfinityPuzzlePoolService;
  let store: InfinityPoolEntry | null;
  let userElo: number;
  let saveDelayMs: number;

  const cache = {
    getInfinityPool: jest.fn(),
    saveInfinityPool: jest.fn(),
    getCachedUrlsMatchingElo: jest.fn(),
    getCachedPuzzles: jest.fn(),
  };
  const provider = { getCacheService: () => cache, getPuzzles: jest.fn() };
  const profile = { getEloTotalByPlanType: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    store = null;
    userElo = ELO;
    saveDelayMs = 0;

    // IndexedDB devuelve copias: mutar lo leído no debe cambiar lo guardado
    cache.getInfinityPool.mockImplementation(async () =>
      store ? { ...store, puzzles: [...store.puzzles] } : null
    );
    cache.saveInfinityPool.mockImplementation(async (entry: InfinityPoolEntry) => {
      if (saveDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, saveDelayMs));
      }
      store = entry;
    });
    cache.getCachedUrlsMatchingElo.mockResolvedValue([]);
    profile.getEloTotalByPlanType.mockImplementation(() => userElo);
    provider.getPuzzles.mockResolvedValue([]);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    service = new InfinityPuzzlePoolService(
      provider as unknown as PuzzlesProvider,
      profile as unknown as ProfileService
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('usa el elo del plan infinity del perfil', () => {
    userElo = 1777;

    expect(service.getUserInfinityElo()).toBe(1777);
    expect(profile.getEloTotalByPlanType).toHaveBeenCalledWith('infinity');
  });

  describe('validez del pool (tolerancia de elo)', () => {
    it('un pool vacío no es válido aunque el elo coincida', () => {
      expect(service.isPoolValid(poolOf([]), ELO)).toBe(false);
    });

    it.each([
      [ELO + 400, true],
      [ELO - 400, true],
      [ELO + 401, false],
      [ELO - 401, false],
    ])('con el pool a elo %s es válido: %s (tolerancia máxima de 400)', (poolElo, valid) => {
      expect(service.isPoolValid(poolOf(puzzles(3), poolElo), ELO)).toBe(valid);
    });
  });

  describe('popOnePuzzle', () => {
    let refill: jest.SpyInstance;

    beforeEach(() => {
      refill = jest.spyOn(service, 'refillPoolBackground').mockImplementation(() => undefined);
    });

    it('sirve el primer puzzle y guarda el resto conservando elo e id del pool', async () => {
      store = poolOf(puzzles(30));

      const puzzle = await service.popOnePuzzle();

      expect(puzzle?.uid).toBe('p0');
      expect(store?.puzzles).toHaveLength(29);
      expect(store?.puzzles[0].uid).toBe('p1');
      expect(store).toMatchObject({ id: 'infinityPool', elo: ELO });
    });

    it('con el pool lleno y al elo del usuario no agenda reconstrucción', async () => {
      store = poolOf(puzzles(40));

      await service.popOnePuzzle();

      expect(refill).not.toHaveBeenCalled();
    });

    it('sin pool devuelve null y agenda su reconstrucción', async () => {
      const result = await service.popOnePuzzle();

      expect(result).toBeNull();
      expect(refill).toHaveBeenCalledWith(ELO);
      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
    });

    it('con el pool vacío devuelve null y agenda su reconstrucción', async () => {
      store = poolOf([]);

      expect(await service.popOnePuzzle()).toBeNull();
      expect(refill).toHaveBeenCalledWith(ELO);
    });

    it('con el pool a más de 400 de elo no lo sirve (dificultad equivocada) y no lo toca', async () => {
      store = poolOf(puzzles(30), ELO - 401);

      expect(await service.popOnePuzzle()).toBeNull();
      expect(refill).toHaveBeenCalledWith(ELO);
      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
    });

    it('con una deriva de 101 a 400 todavía sirve el pool, pero reconstruye en segundo plano', async () => {
      store = poolOf(puzzles(30), ELO - 101);

      const puzzle = await service.popOnePuzzle();

      expect(puzzle?.uid).toBe('p0');
      expect(refill).toHaveBeenCalledWith(ELO);
    });

    it('con una deriva de exactamente 100 no reconstruye', async () => {
      store = poolOf(puzzles(30), ELO - 100);

      await service.popOnePuzzle();

      expect(refill).not.toHaveBeenCalled();
    });

    it('al quedar 15 o menos puzzles rellena en segundo plano; con 16 no', async () => {
      store = poolOf(puzzles(17)); // tras servir quedan 16
      await service.popOnePuzzle();
      expect(refill).not.toHaveBeenCalled();

      await service.popOnePuzzle(); // quedan 15
      expect(refill).toHaveBeenCalledTimes(1);
    });

    it('al servir el último puzzle devuelve ese puzzle y pide rellenar', async () => {
      store = poolOf(puzzles(1));

      const puzzle = await service.popOnePuzzle();

      expect(puzzle?.uid).toBe('p0');
      expect(store?.puzzles).toEqual([]);
      expect(refill).toHaveBeenCalled();
    });

    describe('exclusión mutua', () => {
      it('dos pops simultáneos no sirven el mismo puzzle ni pierden ninguno', async () => {
        store = poolOf(puzzles(30));
        saveDelayMs = 5;

        const [a, b, c] = await Promise.all([
          service.popOnePuzzle(),
          service.popOnePuzzle(),
          service.popOnePuzzle(),
        ]);

        expect([a?.uid, b?.uid, c?.uid]).toEqual(['p0', 'p1', 'p2']);
        expect(store?.puzzles.map((p) => p.uid)).toEqual(puzzles(30).slice(3).map((p) => p.uid));
      });

      it('un pop y un borrado concurrentes se aplican uno tras otro sin revertirse', async () => {
        store = poolOf(puzzles(30));
        saveDelayMs = 5;

        const [popped] = await Promise.all([
          service.popOnePuzzle(),
          service.removePuzzleFromPool('p10'),
        ]);

        expect(popped?.uid).toBe('p0');
        const remaining = store!.puzzles.map((p) => p.uid);
        expect(remaining).not.toContain('p0');
        expect(remaining).not.toContain('p10');
        expect(remaining).toHaveLength(28);
      });

      it('un fallo al leer el pool no bloquea a los que esperan detrás', async () => {
        store = poolOf(puzzles(30));
        cache.getInfinityPool.mockRejectedValueOnce(new Error('IndexedDB caído'));

        const first = service.popOnePuzzle();
        const second = service.popOnePuzzle();

        await expect(first).rejects.toThrow('IndexedDB caído');
        await expect(second).resolves.toMatchObject({ uid: 'p0' });
      });
    });
  });

  describe('peekOnePuzzle', () => {
    it('devuelve un puzzle del pool sin quitarlo ni guardar nada', async () => {
      store = poolOf(puzzles(5));

      const puzzle = await service.peekOnePuzzle();

      expect(store?.puzzles.map((p) => p.uid)).toContain(puzzle?.uid);
      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
      expect(store?.puzzles).toHaveLength(5);
    });

    it.each([
      ['no hay pool', null],
      ['el pool está vacío', poolOf([])],
      ['el pool está demasiado lejos del elo', poolOf(puzzles(5), ELO + 500)],
    ])('devuelve null cuando %s', async (_caso, pool) => {
      store = pool;

      expect(await service.peekOnePuzzle()).toBeNull();
    });
  });

  describe('removePuzzleFromPool', () => {
    let refill: jest.SpyInstance;

    beforeEach(() => {
      refill = jest.spyOn(service, 'refillPoolBackground').mockImplementation(() => undefined);
    });

    it('quita solo el puzzle con ese uid', async () => {
      store = poolOf(puzzles(30));

      await service.removePuzzleFromPool('p7');

      expect(store?.puzzles).toHaveLength(29);
      expect(store?.puzzles.some((p) => p.uid === 'p7')).toBe(false);
      expect(refill).not.toHaveBeenCalled();
    });

    it('un uid que no está deja el pool igual', async () => {
      store = poolOf(puzzles(30));

      await service.removePuzzleFromPool('no-existe');

      expect(store?.puzzles).toHaveLength(30);
    });

    it('rellena en segundo plano al llegar a 15 puzzles', async () => {
      store = poolOf(puzzles(16));

      await service.removePuzzleFromPool('p0');

      expect(refill).toHaveBeenCalledWith(ELO);
    });

    it('si el pool no es válido no guarda nada', async () => {
      store = poolOf(puzzles(30), ELO + 500);

      await service.removePuzzleFromPool('p0');

      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
    });

    it('sin pool no hace nada', async () => {
      await service.removePuzzleFromPool('p0');

      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
    });
  });

  describe('findPuzzleFromCachedFiles', () => {
    it('busca archivos descargados dentro de ±100 de elo y devuelve un puzzle de uno de ellos', async () => {
      cache.getCachedUrlsMatchingElo.mockResolvedValue(['url-a']);
      cache.getCachedPuzzles.mockResolvedValue(puzzles(3, 'c'));

      const puzzle = await service.findPuzzleFromCachedFiles(ELO);

      expect(cache.getCachedUrlsMatchingElo).toHaveBeenCalledWith(ELO, 100);
      expect(cache.getCachedPuzzles).toHaveBeenCalledWith('url-a');
      expect(['c0', 'c1', 'c2']).toContain(puzzle?.uid);
    });

    it('sin archivos descargados devuelve null sin leer ninguno', async () => {
      cache.getCachedUrlsMatchingElo.mockResolvedValue([]);

      expect(await service.findPuzzleFromCachedFiles(ELO)).toBeNull();
      expect(cache.getCachedPuzzles).not.toHaveBeenCalled();
    });

    it.each([[null], [[]]])('si el archivo elegido no trae puzzles (%p) devuelve null', async (content) => {
      cache.getCachedUrlsMatchingElo.mockResolvedValue(['url-a']);
      cache.getCachedPuzzles.mockResolvedValue(content);

      expect(await service.findPuzzleFromCachedFiles(ELO)).toBeNull();
    });

    it('no modifica la lista de puzzles guardada en la caché', async () => {
      const original = puzzles(5, 'c');
      cache.getCachedUrlsMatchingElo.mockResolvedValue(['url-a']);
      cache.getCachedPuzzles.mockResolvedValue(original);

      await service.findPuzzleFromCachedFiles(ELO);

      expect(original.map((p) => p.uid)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    });
  });

  describe('getNextPuzzle', () => {
    let refill: jest.SpyInstance;

    beforeEach(() => {
      refill = jest.spyOn(service, 'refillPoolBackground').mockImplementation(() => undefined);
    });

    it('sirve del pool cuando puede, sin acudir a archivos ni al CDN', async () => {
      store = poolOf(puzzles(30));

      const puzzle = await service.getNextPuzzle();

      expect(puzzle?.uid).toBe('p0');
      expect(cache.getCachedUrlsMatchingElo).not.toHaveBeenCalled();
      expect(provider.getPuzzles).not.toHaveBeenCalled();
    });

    it('si el pool no sirve, entrega un puzzle de los archivos ya descargados', async () => {
      cache.getCachedUrlsMatchingElo.mockResolvedValue(['url-a']);
      cache.getCachedPuzzles.mockResolvedValue([makePuzzle('del-archivo')]);

      const puzzle = await service.getNextPuzzle();

      expect(puzzle?.uid).toBe('del-archivo');
      expect(provider.getPuzzles).not.toHaveBeenCalled();
      expect(refill).toHaveBeenCalledWith(ELO);
    });

    it('si tampoco hay archivos descargados, pide UN puzzle al proveedor al elo del usuario', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('cdn-1'), makePuzzle('cdn-2')]);

      const puzzle = await service.getNextPuzzle();

      expect(puzzle?.uid).toBe('cdn-1');
      expect(provider.getPuzzles).toHaveBeenCalledWith({ elo: ELO });
    });

    it('si el proveedor no devuelve nada, devuelve null', async () => {
      provider.getPuzzles.mockResolvedValue([]);

      expect(await service.getNextPuzzle()).toBeNull();
    });
  });

  describe('buildPool', () => {
    it('pide 5 puzzles de 10 temas distintos al elo dado y guarda un pool de 50 como mucho', async () => {
      provider.getPuzzles.mockImplementation(async ({ theme }: { theme: string }) =>
        puzzles(5, `${theme}-`)
      );

      await service.buildPool(ELO);

      const calls = provider.getPuzzles.mock.calls.map(([o]) => o);
      expect(calls).toHaveLength(10);
      expect(new Set(calls.map((c) => c.theme)).size).toBe(10);
      expect(calls.every((c) => c.elo === ELO && c.count === 5)).toBe(true);
      expect(mockThemes).toEqual(expect.arrayContaining(calls.map((c) => c.theme)));

      expect(store).toMatchObject({ id: 'infinityPool', elo: ELO });
      expect(store?.puzzles).toHaveLength(50);
      expect(typeof store?.createdAt).toBe('number');
    });

    it('elimina duplicados por uid entre temas', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('igual'), makePuzzle('otro')]);

      await service.buildPool(ELO);

      expect(store?.puzzles.map((p) => p.uid).sort()).toEqual(['igual', 'otro']);
    });

    it('un tema que falla no tumba la construcción: se ignora', async () => {
      let n = 0;
      provider.getPuzzles.mockImplementation(async () => {
        n++;
        if (n % 2 === 0) throw new Error('404');
        return [makePuzzle(`ok-${n}`)];
      });

      await service.buildPool(ELO);

      expect(store?.puzzles).toHaveLength(5);
    });

    it('si el pool actual es válido y está al elo, no vuelve a construirlo', async () => {
      store = poolOf(puzzles(30), ELO - 100);

      await service.buildPool(ELO);

      expect(provider.getPuzzles).not.toHaveBeenCalled();
      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
    });

    it('si el pool actual deriva más de 100 lo reconstruye (aunque siga siendo válido)', async () => {
      store = poolOf(puzzles(30, 'viejo-'), ELO - 150);
      provider.getPuzzles.mockImplementation(async ({ theme }: { theme: string }) =>
        puzzles(5, `${theme}-`)
      );

      await service.buildPool(ELO);

      expect(provider.getPuzzles).toHaveBeenCalled();
      expect(store?.elo).toBe(ELO);
      // El pool viejo era de otro elo: sus puzzles no se arrastran
      expect(store?.puzzles.some((p) => p.uid.startsWith('viejo'))).toBe(false);
    });

    it('un pool vacío se reconstruye', async () => {
      store = poolOf([]);
      provider.getPuzzles.mockResolvedValue([makePuzzle('nuevo')]);

      await service.buildPool(ELO);

      expect(store?.puzzles.map((p) => p.uid)).toEqual(['nuevo']);
    });

    it('dos construcciones simultáneas se juntan en una sola', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('x')]);

      await Promise.all([service.buildPool(ELO), service.buildPool(ELO)]);

      expect(provider.getPuzzles).toHaveBeenCalledTimes(10);
      expect(cache.saveInfinityPool).toHaveBeenCalledTimes(1);
    });

    it('al terminar permite una construcción nueva, también tras un fallo', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('x')]);
      cache.saveInfinityPool.mockRejectedValueOnce(new Error('disco lleno'));

      await expect(service.buildPool(ELO)).rejects.toThrow('disco lleno');
      await expect(service.buildPool(ELO)).resolves.toBeUndefined();

      expect(store?.puzzles.map((p) => p.uid)).toEqual(['x']);
    });

    it('conserva lo que quede del pool al mismo elo (no devuelve puzzles ya servidos)', async () => {
      store = poolOf([]); // vacío al empezar: se reconstruye
      provider.getPuzzles.mockImplementation(async () => {
        // Mientras se descarga, otro proceso deja en el pool dos puzzles al mismo elo
        store = poolOf([makePuzzle('quedan-1'), makePuzzle('quedan-2')]);
        return [makePuzzle('fresco')];
      });

      await service.buildPool(ELO);

      const uids = store!.puzzles.map((p) => p.uid);
      expect(uids.slice(0, 2)).toEqual(['quedan-1', 'quedan-2']);
      expect(uids).toContain('fresco');
    });

    it('descarta lo que hubiera de otro elo al guardar', async () => {
      store = poolOf([]);
      provider.getPuzzles.mockImplementation(async () => {
        store = poolOf([makePuzzle('de-otro-elo')], ELO + 300);
        return [makePuzzle('fresco')];
      });

      await service.buildPool(ELO);

      expect(store?.puzzles.map((p) => p.uid)).toEqual(['fresco']);
    });

    it('los puzzles que quedaban tienen prioridad cuando se supera el tope de 50', async () => {
      store = poolOf([]);
      provider.getPuzzles.mockImplementation(async ({ theme }: { theme: string }) => {
        store = poolOf(puzzles(3, 'quedan-'));
        return puzzles(5, `${theme}-`);
      });

      await service.buildPool(ELO);

      expect(store?.puzzles).toHaveLength(POOL_SIZE);
      expect(store?.puzzles.slice(0, 3).map((p) => p.uid)).toEqual(['quedan-0', 'quedan-1', 'quedan-2']);
    });
  });

  describe('refillPoolBackground', () => {
    it('sin pool lo construye', async () => {
      provider.getPuzzles.mockResolvedValue([makePuzzle('nuevo')]);

      service.refillPoolBackground(ELO);
      await flush();

      expect(store?.puzzles.map((p) => p.uid)).toEqual(['nuevo']);
    });

    it('con el pool desfasado más de 100 de elo lo reconstruye al elo actual', async () => {
      store = poolOf(puzzles(40), ELO - 250);
      provider.getPuzzles.mockResolvedValue([makePuzzle('nuevo')]);

      service.refillPoolBackground(ELO);
      await flush();

      expect(store).toMatchObject({ elo: ELO });
      expect(store?.puzzles.map((p) => p.uid)).toEqual(['nuevo']);
    });

    it('con el pool completo no descarga ni guarda nada', async () => {
      store = poolOf(puzzles(POOL_SIZE));

      service.refillPoolBackground(ELO);
      await flush();

      expect(provider.getPuzzles).not.toHaveBeenCalled();
      expect(cache.saveInfinityPool).not.toHaveBeenCalled();
    });

    it('rellena hasta el tope pidiendo solo temas con hueco y solo los puzzles que faltan por tema', async () => {
      // 11 temas saturados (5 puzzles cada uno) y 'fork' con 3: solo 'fork' tiene hueco
      const saturated = mockThemes.filter((t) => t !== 'fork');
      const withThemes = [
        ...puzzles(5, 'sat-', { themes: saturated }),
        ...puzzles(3, 'fork-', { themes: ['fork'] }),
        ...puzzles(37, 'x-'),
      ];
      store = poolOf(withThemes); // 45 puzzles: faltan 5 -> 1 tema
      provider.getPuzzles.mockResolvedValue([makePuzzle('nuevo-1'), makePuzzle('nuevo-2')]);

      service.refillPoolBackground(ELO);
      await flush();

      expect(provider.getPuzzles).toHaveBeenCalledTimes(1);
      expect(provider.getPuzzles).toHaveBeenCalledWith({ elo: ELO, theme: 'fork', count: 2 });
      expect(store?.puzzles).toHaveLength(47);
      expect(store?.puzzles.map((p) => p.uid)).toEqual(
        expect.arrayContaining(['nuevo-1', 'nuevo-2'])
      );
    });

    it('pide ceil(faltan/5) temas', async () => {
      store = poolOf(puzzles(30)); // faltan 20 -> 4 temas
      provider.getPuzzles.mockResolvedValue([]);

      service.refillPoolBackground(ELO);
      await flush();

      expect(provider.getPuzzles).toHaveBeenCalledTimes(4);
      expect(new Set(provider.getPuzzles.mock.calls.map(([o]) => o.theme)).size).toBe(4);
    });

    it('re-ancla el pool al elo actual (si no, rellenar nunca le devolvería la validez)', async () => {
      store = poolOf(puzzles(40), ELO - 80); // deriva tolerada: se rellena, no se reconstruye
      provider.getPuzzles.mockResolvedValue([makePuzzle('nuevo')]);

      service.refillPoolBackground(ELO);
      await flush();

      expect(store?.elo).toBe(ELO);
      expect(store?.puzzles.length).toBeGreaterThan(40);
    });

    it('respeta los puzzles servidos mientras se descargaba (relee el pool bajo el lock)', async () => {
      store = poolOf(puzzles(40));
      provider.getPuzzles.mockImplementation(async () => {
        // Durante la descarga, el entrenamiento consume 10 puzzles
        store = poolOf(puzzles(40).slice(10));
        return [makePuzzle('nuevo')];
      });

      service.refillPoolBackground(ELO);
      await flush();

      const uids = store!.puzzles.map((p) => p.uid);
      expect(uids).not.toContain('p0');
      expect(uids).not.toContain('p9');
      expect(uids).toContain('p10');
      expect(uids).toContain('nuevo');
    });

    it('no supera el tope de 50 ni duplica uids', async () => {
      store = poolOf(puzzles(48));
      provider.getPuzzles.mockResolvedValue(puzzles(5, 'n-'));

      service.refillPoolBackground(ELO);
      await flush();

      expect(store?.puzzles).toHaveLength(POOL_SIZE);
      const uids = store!.puzzles.map((p) => p.uid);
      expect(new Set(uids).size).toBe(uids.length);
    });

    it('un tema que falla al descargar no impide guardar los demás', async () => {
      store = poolOf(puzzles(30));
      let n = 0;
      provider.getPuzzles.mockImplementation(async () => {
        n++;
        if (n === 1) throw new Error('404');
        return [makePuzzle(`ok-${n}`)];
      });

      service.refillPoolBackground(ELO);
      await flush();

      expect(store?.puzzles).toHaveLength(33);
    });

    it('solo hay un relleno a la vez: llamadas repetidas mientras corre no duplican descargas', async () => {
      store = poolOf(puzzles(30));
      provider.getPuzzles.mockResolvedValue([]);

      service.refillPoolBackground(ELO);
      service.refillPoolBackground(ELO);
      service.refillPoolBackground(ELO);
      await flush();

      expect(provider.getPuzzles).toHaveBeenCalledTimes(4); // una sola tanda
    });

    it('tras un error lo registra y permite nuevos rellenos', async () => {
      cache.getInfinityPool.mockRejectedValueOnce(new Error('IndexedDB caído'));

      service.refillPoolBackground(ELO);
      await flush();
      expect(console.error).toHaveBeenCalled();

      store = poolOf(puzzles(30));
      provider.getPuzzles.mockResolvedValue([]);
      service.refillPoolBackground(ELO);
      await flush();

      expect(provider.getPuzzles).toHaveBeenCalled();
    });
  });
});
