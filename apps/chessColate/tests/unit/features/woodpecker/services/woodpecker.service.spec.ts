import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { WoodpeckerSetService } from '@features/woodpecker/services/woodpecker-set.service';
import { WoodpeckerStorageService } from '@features/woodpecker/services/woodpecker-storage.service';
import { WoodpeckerService } from '@features/woodpecker/services/woodpecker.service';
import {
  aleatorioConSemilla,
  configuracion,
  conjunto,
  ejercicios,
  resultado,
} from '@tests/support/pajaro-carpintero';

describe('WoodpeckerService', () => {
  let service: WoodpeckerService;
  let storage: WoodpeckerStorageService;

  const setService = { generate: jest.fn(), availableThemes: ['fork', 'pin'] };
  const analytics = { logEvent: jest.fn() };

  const puzzles = ejercicios(4);
  const config = configuracion({ cycles: 2, targetCount: 4, minCount: 3 });
  const set = conjunto(puzzles, { config });

  function eventos(nombre: string) {
    return analytics.logEvent.mock.calls.filter(([n]) => n === nombre).map(([, p]) => p);
  }

  /** Juega entera la vuelta en curso. */
  function jugarVuelta(acierta: (uid: string) => boolean = () => true) {
    while (service.nextPuzzle()) {
      const uid = service.nextPuzzle()!.uid;
      service.registerResult(resultado(uid, acierta(uid), 4_000));
    }
  }

  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        WoodpeckerService,
        WoodpeckerStorageService,
        { provide: WoodpeckerSetService, useValue: setService },
        { provide: AnalyticsService, useValue: analytics },
      ],
    });
    service = TestBed.inject(WoodpeckerService);
    storage = TestBed.inject(WoodpeckerStorageService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('crear un set', () => {
    it('guarda el set congelado y deja el progreso en blanco', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });

      const creacion = await service.createSet(config);

      expect(creacion.status).toBe('ok');
      expect(service.set).toEqual(set);
      expect(service.progress).toEqual({ setId: 'set-1', cycles: [] });
      expect(storage.getState()?.set).toEqual(set);
    });

    it('crear otro set sustituye al anterior y su progreso', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });
      await service.createSet(config);
      service.beginCycle();
      jugarVuelta();

      const otro = conjunto(ejercicios(4, 'q'), { id: 'set-2', config });
      setService.generate.mockResolvedValue({ status: 'ok', set: otro, short: false });
      await service.createSet(config);

      expect(service.set?.id).toBe('set-2');
      expect(service.progress).toEqual({ setId: 'set-2', cycles: [] });
      expect(storage.getState()?.progress.cycles).toEqual([]);
    });

    it('registra el set creado con sus filtros', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });

      await service.createSet(config);

      expect(eventos('woodpecker_plan_created')).toEqual([
        {
          target: 4,
          actual: 4,
          elo_min: 1300,
          elo_max: 1700,
          themes_count: 2,
          cycles: 2,
          order: 'shuffle',
          timing: 'decreasing',
        },
      ]);
    });

    it('avisa cuando el catálogo no alcanzó lo pedido, pero acepta el set', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: true });

      const creacion = await service.createSet(configuracion({ targetCount: 10, minCount: 3 }));

      expect(creacion.status).toBe('ok');
      expect(eventos('woodpecker_set_short')).toEqual([{ requested: 10, available: 4 }]);
    });

    it('si no llega al mínimo no guarda nada y conserva lo que hubiera', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });
      await service.createSet(config);

      setService.generate.mockResolvedValue({ status: 'too-few', found: 5, required: 70 });
      const creacion = await service.createSet(config);

      expect(creacion).toEqual({ status: 'too-few', found: 5, required: 70 });
      expect(service.set?.id).toBe('set-1');
      expect(eventos('woodpecker_set_short')).toEqual([{ requested: 4, available: 5 }]);
    });

    it('sin conexión devuelve el estado sin tocar nada', async () => {
      setService.generate.mockResolvedValue({ status: 'unavailable' });

      expect(await service.createSet(config)).toEqual({ status: 'unavailable' });
      expect(service.set).toBeNull();
    });

    it('si el dispositivo no tiene espacio lo dice y no deja un set a medias', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota llena');
      });

      expect(await service.createSet(config)).toEqual({ status: 'storage-full' });
      expect(service.set).toBeNull();
    });

    it('pasa el avance de la descarga a quien lo pide', async () => {
      setService.generate.mockImplementation(async (_config, onProgress) => {
        onProgress?.(1, 4);
        return { status: 'too-few', found: 0, required: 3 };
      });
      const avance = jest.fn();

      await service.createSet(config, avance);

      expect(avance).toHaveBeenCalledWith(1, 4);
    });
  });

  describe('jugar las vueltas', () => {
    beforeEach(async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });
      await service.createSet(config);
      analytics.logEvent.mockClear();
    });

    it('sin set no hay vuelta que empezar', () => {
      service.discard();
      expect(service.beginCycle()).toBeNull();
    });

    it('empieza la vuelta 1 con el orden del set y la registra', () => {
      const cycle = service.beginCycle();

      expect(cycle).toMatchObject({ cycle: 1, order: ['p1', 'p2', 'p3', 'p4'], results: [] });
      expect(eventos('woodpecker_cycle_started')).toEqual([{ cycle: 1, set_size: 4 }]);
    });

    it('el ejercicio que toca es el del set, con su tablero completo', () => {
      service.beginCycle();
      expect(service.nextPuzzle()).toEqual(puzzles[0]);
    });

    it('cada resultado avanza al siguiente ejercicio y se guarda al instante', () => {
      service.beginCycle();
      service.registerResult(resultado('p1', true, 3_000));

      expect(service.nextPuzzle()?.uid).toBe('p2');
      expect(storage.getState()?.progress.cycles[0].results).toEqual([resultado('p1', true, 3_000)]);
    });

    it('reanudar tras cerrar la app sigue donde se quedó, sin abrir otra vuelta', () => {
      service.beginCycle();
      service.registerResult(resultado('p1', true));
      service.registerResult(resultado('p2', false));
      analytics.logEvent.mockClear();

      // «Cierra y abre la app»: un servicio nuevo que solo tiene lo guardado en el dispositivo
      const reabierto = TestBed.runInInjectionContext(() => new WoodpeckerService());
      reabierto.load();
      const cycle = reabierto.beginCycle();

      expect(cycle?.results).toHaveLength(2);
      expect(reabierto.nextPuzzle()?.uid).toBe('p3');
      expect(eventos('woodpecker_cycle_started')).toEqual([]);
    });

    it('ignora un resultado de un ejercicio que no toca', () => {
      service.beginCycle();
      service.registerResult(resultado('p3', true));

      expect(service.activeCycle?.results).toEqual([]);
    });

    it('no se puede cerrar una vuelta a medias', () => {
      service.beginCycle();
      service.registerResult(resultado('p1', true));

      expect(service.completeCycle()).toBeNull();
      expect(service.activeCycle).not.toBeNull();
    });

    it('al terminar la vuelta 1 devuelve su informe sin comparación y no termina el set', () => {
      service.beginCycle();
      jugarVuelta((uid) => uid !== 'p2');

      const informe = service.completeCycle();

      expect(informe?.current).toMatchObject({ cycle: 1, solved: 3, failed: 1, accuracy: 75 });
      expect(informe?.comparison).toBeNull();
      expect(informe?.finishedSet).toBe(false);
      expect(service.isCompleted).toBe(false);
      expect(service.activeCycle).toBeNull();
      expect(eventos('woodpecker_cycle_completed')).toEqual([
        { cycle: 1, solved: 3, failed: 1, total_time_ms: 16_000 },
      ]);
    });

    it('la vuelta 2 compara con la 1 y, al ser la última, termina el set', () => {
      service.beginCycle(aleatorioConSemilla(1));
      jugarVuelta((uid) => uid !== 'p2');
      service.completeCycle();

      service.beginCycle(aleatorioConSemilla(1));
      jugarVuelta();
      const informe = service.completeCycle();

      expect(informe?.comparison?.accuracyDelta).toBe(25);
      expect(informe?.finishedSet).toBe(true);
      expect(service.isCompleted).toBe(true);
      expect(eventos('woodpecker_plan_completed')).toEqual([
        {
          cycles: 2,
          accuracy_first: 75,
          accuracy_last: 100,
          time_first_ms: 16_000,
          time_last_ms: 16_000,
        },
      ]);
    });

    it('con el set terminado ya no se abren más vueltas', () => {
      service.beginCycle();
      jugarVuelta();
      service.completeCycle();
      service.beginCycle();
      jugarVuelta();
      service.completeCycle();

      expect(service.beginCycle()).toBeNull();
    });

    it('la vuelta 2 usa menos tiempo por ejercicio que la 1', () => {
      service.beginCycle();
      const vuelta1 = service.timesForActiveCycle();
      jugarVuelta();
      service.completeCycle();

      service.beginCycle();
      const vuelta2 = service.timesForActiveCycle();

      expect(vuelta1?.total).toBe(60);
      expect(vuelta2?.total).toBe(48);
    });

    it('sin límite de tiempo el tablero no recibe tiempos', async () => {
      const relajado = conjunto(puzzles, { config: { ...config, timing: 'none' } });
      setService.generate.mockResolvedValue({ status: 'ok', set: relajado, short: false });
      await service.createSet(config);
      service.beginCycle();

      expect(service.timesForActiveCycle()).toBeUndefined();
    });
  });

  describe('abandonar', () => {
    it('borra el set y el progreso del dispositivo y lo registra', async () => {
      setService.generate.mockResolvedValue({ status: 'ok', set, short: false });
      await service.createSet(config);
      service.beginCycle();
      jugarVuelta();
      service.completeCycle();
      analytics.logEvent.mockClear();

      service.discard();

      expect(service.set).toBeNull();
      expect(storage.getState()).toBeNull();
      expect(eventos('woodpecker_plan_abandoned')).toEqual([
        { cycles_done: 1, cycles: 2, completed: false },
      ]);
    });

    it('sin set no registra nada', () => {
      service.discard();
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('cargar lo guardado', () => {
    it('recupera el set y el progreso del dispositivo', () => {
      storage.saveNewSet(set);

      const estado = service.load();

      expect(estado?.set).toEqual(set);
      expect(service.nextPuzzle()).toBeNull(); // aún no hay vuelta abierta
    });

    it('sin nada guardado no hay estado', () => {
      expect(service.load()).toBeNull();
      expect(service.getState()).toBeNull();
    });
  });
});
