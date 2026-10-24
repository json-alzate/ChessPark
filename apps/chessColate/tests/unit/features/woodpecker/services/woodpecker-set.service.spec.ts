import { TestBed } from '@angular/core/testing';

import { Puzzle } from '@chesspark/models';
import { UidGeneratorService } from '@chesspark/common-utils';
import { PuzzleQueryOptions, PuzzlesProvider } from '@chesspark/puzzles-provider';

import { WoodpeckerSetService } from '@features/woodpecker/services/woodpecker-set.service';
import { configuracion, ejercicio } from '@tests/support/pajaro-carpintero';

/** Manifiesto falso: qué franjas de 20 puntos tiene cada tema. */
let mockManifest: Record<string, number[]> = {};

jest.mock('@chesspark/puzzles-provider', () => ({
  ...jest.requireActual('@chesspark/puzzles-provider'),
  getManifestThemes: () => Object.keys(mockManifest),
  getValidEloStarts: (theme?: string) =>
    theme && mockManifest[theme] ? new Set(mockManifest[theme]) : undefined,
}));

function franjas(desde: number, hasta: number): number[] {
  const lista: number[] = [];
  for (let elo = desde; elo <= hasta; elo += 20) {
    lista.push(elo);
  }
  return lista;
}

describe('WoodpeckerSetService', () => {
  let service: WoodpeckerSetService;
  const provider = { getPuzzles: jest.fn() };

  /**
   * Cada archivo del catálogo trae `porArchivo` ejercicios con uid propio
   * (`tema@franja#n`), como si fueran distintos entre archivos.
   */
  function catalogo(porArchivo: number) {
    provider.getPuzzles.mockImplementation(async (opciones: PuzzleQueryOptions) =>
      Array.from({ length: Math.min(porArchivo, opciones.count ?? 50) }, (_, i) =>
        ejercicio(`${opciones.theme}@${opciones.eloMin}#${i}`, {
          rating: opciones.eloMin,
          themes: [opciones.theme ?? ''],
        })
      )
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockManifest = {
      fork: franjas(400, 2800),
      pin: franjas(400, 2800),
      mateIn2: franjas(400, 2800),
      short: franjas(400, 2800), // excluido: describe duración, no táctica
    };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        WoodpeckerSetService,
        { provide: PuzzlesProvider, useValue: provider },
        { provide: UidGeneratorService, useValue: { generateSimpleUid: () => 'set-nuevo' } },
      ],
    });
    service = TestBed.inject(WoodpeckerSetService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('availableThemes', () => {
    it('ofrece los temas con archivos, sin los de duración o desenlace', () => {
      expect(service.availableThemes.sort()).toEqual(['fork', 'mateIn2', 'pin']);
    });
  });

  describe('generate', () => {
    it('arma el set con el tamaño pedido, sin repetidos', async () => {
      catalogo(60);

      const resultado = await service.generate(configuracion({ targetCount: 100 }));

      expect(resultado.status).toBe('ok');
      if (resultado.status !== 'ok') return;
      const uids = resultado.set.puzzles.map((p) => p.uid);
      expect(uids).toHaveLength(100);
      expect(new Set(uids).size).toBe(100);
      expect(resultado.short).toBe(false);
    });

    it('el set queda con su id, origen, fecha y los filtros usados', async () => {
      catalogo(60);
      const config = configuracion({ targetCount: 50, minCount: 35 });

      const resultado = await service.generate(config);

      if (resultado.status !== 'ok') throw new Error('debía salir bien');
      expect(resultado.set).toMatchObject({
        id: 'set-nuevo',
        source: 'catalog',
        config: { ...config, targetCount: 50 },
      });
      expect(resultado.set.createdAt).toBeGreaterThan(0);
    });

    it('pide cada archivo exacto: la franja de 20 puntos de un solo tema', async () => {
      catalogo(60);

      await service.generate(configuracion({ eloMin: 1300, eloMax: 1700 }));

      for (const [opciones] of provider.getPuzzles.mock.calls as [PuzzleQueryOptions][]) {
        expect(opciones.eloMax).toBe((opciones.eloMin as number) + 19);
        expect(opciones.eloMin).toBeGreaterThanOrEqual(1300);
        expect(opciones.eloMax).toBeLessThan(1700);
        expect(['fork', 'pin']).toContain(opciones.theme);
      }
    });

    it('baja pocos archivos, no una franja por cada tramo del rango', async () => {
      catalogo(60);

      await service.generate(configuracion({ targetCount: 100, eloMin: 400, eloMax: 2800 }));

      // 100 ejercicios a ~25 por archivo: cuatro archivos y no 120 franjas por tema
      expect(provider.getPuzzles.mock.calls.length).toBeLessThanOrEqual(6);
    });

    it('informa del avance archivo a archivo', async () => {
      catalogo(60);
      const avance: [number, number][] = [];

      await service.generate(configuracion({ targetCount: 100 }), (hecho, total) =>
        avance.push([hecho, total])
      );

      expect(avance[0][0]).toBe(0);
      const ultimo = avance[avance.length - 1];
      expect(ultimo[0]).toBe(ultimo[1]);
    });

    it('si los archivos dan de menos pide más hasta completar', async () => {
      catalogo(8); // cada archivo trae solo 8

      const resultado = await service.generate(configuracion({ targetCount: 100 }));

      if (resultado.status !== 'ok') throw new Error('debía salir bien');
      expect(resultado.set.puzzles.length).toBe(100);
    });

    it('acepta un set más corto si supera el mínimo, y lo avisa', async () => {
      // Solo hay 3 franjas en el rango y 20 ejercicios por archivo: 3 archivos × 20 × 2 temas = 120 máx.
      mockManifest = { fork: [1500, 1520, 1540], pin: [1500, 1520, 1540] };
      catalogo(20);

      const resultado = await service.generate(
        configuracion({ targetCount: 200, minCount: 100, eloMin: 1500, eloMax: 1600 })
      );

      if (resultado.status !== 'ok') throw new Error('debía salir bien');
      expect(resultado.short).toBe(true);
      expect(resultado.set.puzzles.length).toBe(120);
      // La configuración guardada refleja lo que de verdad hay
      expect(resultado.set.config.targetCount).toBe(120);
    });

    it('rechaza el set si no llega al mínimo', async () => {
      mockManifest = { fork: [1500] };
      catalogo(20);

      const resultado = await service.generate(
        configuracion({ targetCount: 200, minCount: 140, themes: ['fork'], eloMin: 1500, eloMax: 1600 })
      );

      expect(resultado).toEqual({ status: 'too-few', found: 20, required: 140 });
    });

    it('sin archivos en el rango dice que no hay ejercicios, sin descargar nada', async () => {
      const resultado = await service.generate(
        configuracion({ themes: ['inventado'], minCount: 70 })
      );

      expect(resultado).toEqual({ status: 'too-few', found: 0, required: 70 });
      expect(provider.getPuzzles).not.toHaveBeenCalled();
    });

    it('sin conexión (todo falla) dice que no está disponible', async () => {
      provider.getPuzzles.mockRejectedValue(new Error('Error de red'));

      expect(await service.generate(configuracion())).toEqual({ status: 'unavailable' });
    });

    it('si el catálogo devuelve vacío en todo, tampoco está disponible', async () => {
      provider.getPuzzles.mockResolvedValue([]);

      expect(await service.generate(configuracion())).toEqual({ status: 'unavailable' });
    });

    it('un archivo que falla no tumba el resto', async () => {
      let llamada = 0;
      provider.getPuzzles.mockImplementation(async (opciones: PuzzleQueryOptions): Promise<Puzzle[]> => {
        if (llamada++ === 0) {
          throw new Error('Error de red');
        }
        return Array.from({ length: 60 }, (_, i) =>
          ejercicio(`${opciones.theme}@${opciones.eloMin}#${i}`)
        );
      });

      const resultado = await service.generate(configuracion({ targetCount: 100, minCount: 70 }));

      expect(resultado.status).toBe('ok');
    });

    it('mezcla temas: el set no sale por bloques', async () => {
      catalogo(60);

      const resultado = await service.generate(configuracion({ targetCount: 100 }));

      if (resultado.status !== 'ok') throw new Error('debía salir bien');
      const primeros = resultado.set.puzzles.slice(0, 20).map((p) => p.themes[0]);
      expect(new Set(primeros).size).toBe(2);
    });
  });

  describe('fromPuzzles', () => {
    const puzzles = [ejercicio('a'), ejercicio('b'), ejercicio('c')];

    it('arma el set con los ejercicios tal cual, en el orden del archivo, sin tocar el catálogo', () => {
      const config = configuracion({ targetCount: 3, minCount: 3 });

      const set = service.fromPuzzles(config, puzzles, 'tacticas.pgn');

      expect(set).toMatchObject({ id: 'set-nuevo', source: 'pgn', sourceName: 'tacticas.pgn', config });
      expect(set.puzzles.map((p) => p.uid)).toEqual(['a', 'b', 'c']);
      expect(provider.getPuzzles).not.toHaveBeenCalled();
    });

    it('guarda la fecha de creación', () => {
      const antes = Date.now();

      const set = service.fromPuzzles(configuracion(), puzzles, '');

      expect(set.createdAt).toBeGreaterThanOrEqual(antes);
      expect(set.sourceName).toBe('');
    });
  });
});
