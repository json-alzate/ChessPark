import { TestBed } from '@angular/core/testing';

import { Plan } from '@chesspark/models';

import { PlanStorageService } from '@services/plans/plan-storage.service';

const KEY = 'chessColate_plans_history';

const plan = (uid: string, createdAt: number, extra: Partial<Plan> = {}): Plan => ({
  uid,
  blocks: [],
  createdAt,
  planType: 'plan5',
  isFinished: true,
  ...extra,
});

const stored = (): Plan[] => JSON.parse(localStorage.getItem(KEY) as string);

describe('PlanStorageService', () => {
  let service: PlanStorageService;

  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlanStorageService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('savePlan', () => {
    it('guarda un plan terminado en localStorage', () => {
      service.savePlan(plan('a', 10));

      expect(stored()).toEqual([plan('a', 10)]);
    });

    it('rechaza un plan no terminado: no escribe nada y avisa', () => {
      service.savePlan(plan('a', 10, { isFinished: false }));
      service.savePlan(plan('b', 10, { isFinished: undefined }));

      expect(localStorage.getItem(KEY)).toBeNull();
      expect(console.warn).toHaveBeenCalledTimes(2);
    });

    it('si el uid ya existe lo reemplaza en vez de duplicarlo', () => {
      service.savePlan(plan('a', 10, { title: 'viejo' }));

      service.savePlan(plan('a', 10, { title: 'nuevo' }));

      expect(stored()).toHaveLength(1);
      expect(stored()[0].title).toBe('nuevo');
    });

    it('guarda ordenado del más reciente al más antiguo', () => {
      service.savePlan(plan('viejo', 10));
      service.savePlan(plan('nuevo', 30));
      service.savePlan(plan('medio', 20));

      expect(stored().map((p) => p.uid)).toEqual(['nuevo', 'medio', 'viejo']);
    });

    it('conserva los planes anteriores al agregar uno', () => {
      service.savePlan(plan('a', 10));
      service.savePlan(plan('b', 20));

      expect(service.getTotalPlansCount()).toBe(2);
    });
  });

  describe('getAllPlans', () => {
    it('devuelve vacío si no hay nada guardado', () => {
      expect(service.getAllPlans()).toEqual([]);
    });

    it('ordena por fecha descendente aunque el almacenamiento esté desordenado', () => {
      localStorage.setItem(KEY, JSON.stringify([plan('a', 1), plan('c', 3), plan('b', 2)]));

      expect(service.getAllPlans().map((p) => p.uid)).toEqual(['c', 'b', 'a']);
    });

    it('devuelve vacío y registra el error si el JSON está corrupto', () => {
      localStorage.setItem(KEY, '{no es json');

      expect(service.getAllPlans()).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it('un historial corrupto no impide guardar un plan nuevo', () => {
      localStorage.setItem(KEY, '{no es json');

      service.savePlan(plan('a', 10));

      expect(stored()).toEqual([plan('a', 10)]);
    });
  });

  describe('getPlanById', () => {
    beforeEach(() => {
      service.savePlan(plan('a', 10));
      service.savePlan(plan('b', 20));
    });

    it('devuelve el plan con ese uid', () => {
      expect(service.getPlanById('a')?.createdAt).toBe(10);
    });

    it('devuelve null si no existe', () => {
      expect(service.getPlanById('zzz')).toBeNull();
    });
  });

  describe('deletePlan', () => {
    it('elimina solo el plan indicado', () => {
      service.savePlan(plan('a', 10));
      service.savePlan(plan('b', 20));

      service.deletePlan('a');

      expect(stored().map((p) => p.uid)).toEqual(['b']);
    });

    it('si el uid no existe deja el historial igual', () => {
      service.savePlan(plan('a', 10));

      service.deletePlan('zzz');

      expect(stored().map((p) => p.uid)).toEqual(['a']);
    });
  });

  describe('clearAllPlans', () => {
    it('borra la clave del historial', () => {
      service.savePlan(plan('a', 10));

      service.clearAllPlans();

      expect(localStorage.getItem(KEY)).toBeNull();
      expect(service.getAllPlans()).toEqual([]);
    });
  });

  describe('getTotalPlansCount / getPlansByType', () => {
    beforeEach(() => {
      service.savePlan(plan('a', 10, { planType: 'plan5' }));
      service.savePlan(plan('b', 20, { planType: 'custom' }));
      service.savePlan(plan('c', 30, { planType: 'plan5' }));
    });

    it('cuenta todos los planes guardados', () => {
      expect(service.getTotalPlansCount()).toBe(3);
    });

    it('filtra por tipo conservando el orden más reciente primero', () => {
      expect(service.getPlansByType('plan5').map((p) => p.uid)).toEqual(['c', 'a']);
    });

    it('devuelve vacío para un tipo sin planes', () => {
      expect(service.getPlansByType('infinity')).toEqual([]);
    });
  });
});
