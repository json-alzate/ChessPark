import { TestBed } from '@angular/core/testing';

import { Block, Plan, PlanElos } from '@chesspark/models';
import { UidGeneratorService } from '@chesspark/common-utils';
import { PlanFacadeService } from '@chesspark/state';

import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { PlanRepository } from '@services/firestore/plan.repository';
import { ProfileService } from '@services/account/profile.service';
import { BlockService } from '@services/training/block.service';
import { PlanService } from '@services/plans/plan.service';
import { PlansElosService } from '@services/plans/plans-elos.service';

const block = (extra: Partial<Block> = {}): Block => ({
  time: 60,
  puzzlesCount: 0,
  theme: 'fork',
  elo: 0,
  color: 'white',
  puzzlesPlayed: [],
  ...extra,
});

const customPlan = (blocks: Block[], extra: Partial<Plan> = {}): Plan => ({
  uid: 'c1',
  title: 'Mi rutina',
  blocks,
  createdAt: 1,
  planType: 'custom',
  ...extra,
});

describe('PlanService', () => {
  let service: PlanService;
  let planRepository: { savePlan: jest.Mock };
  let blockService: { getRandomTheme: jest.Mock; getPuzzlesForBlock: jest.Mock };
  let plansElosService: { getOnePlanElo: jest.Mock; getWeakness: jest.Mock };
  let planFacade: {
    clearPlan: jest.Mock;
    loadPlan: jest.Mock;
    setPlan: jest.Mock;
    setPlanError: jest.Mock;
  };
  let analytics: { logEvent: jest.Mock };
  let reminders: { onSessionStarted: jest.Mock };
  let calls: string[];

  beforeEach(() => {
    calls = [];
    planRepository = { savePlan: jest.fn() };
    blockService = {
      getRandomTheme: jest.fn().mockReturnValue('aleatorio'),
      getPuzzlesForBlock: jest.fn().mockResolvedValue([{ id: 'z1' }]),
    };
    plansElosService = {
      getOnePlanElo: jest.fn().mockResolvedValue({}),
      getWeakness: jest.fn(),
    };
    planFacade = {
      clearPlan: jest.fn(() => void calls.push('clear')),
      loadPlan: jest.fn(() => void calls.push('load')),
      setPlan: jest.fn(() => void calls.push('set')),
      setPlanError: jest.fn(),
    };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    reminders = { onSessionStarted: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanRepository, useValue: planRepository },
        { provide: BlockService, useValue: blockService },
        { provide: ProfileService, useValue: {} },
        { provide: PlansElosService, useValue: plansElosService },
        { provide: UidGeneratorService, useValue: { generateSimpleUid: () => 'uid-nuevo' } },
        { provide: PlanFacadeService, useValue: planFacade },
        { provide: AnalyticsService, useValue: analytics },
        { provide: TrainingReminderService, useValue: reminders },
      ],
    });
    service = TestBed.inject(PlanService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('makeCustomPlanForPlay', () => {
    it('lee los elos del plan custom de origen (uidCustomPlan) cuando existe', async () => {
      await service.makeCustomPlanForPlay(customPlan([block()], { uid: 'copia', uidCustomPlan: 'origen' }));

      expect(plansElosService.getOnePlanElo).toHaveBeenCalledWith('origen');
    });

    it('sin uidCustomPlan usa el uid del propio plan', async () => {
      await service.makeCustomPlanForPlay(customPlan([block()]));

      expect(plansElosService.getOnePlanElo).toHaveBeenCalledWith('c1');
    });

    describe('tema del bloque', () => {
      it('un tema normal se conserva', async () => {
        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'pin' })]));

        expect(result.blocks[0].theme).toBe('pin');
        expect(blockService.getRandomTheme).not.toHaveBeenCalled();
      });

      it("'all' se reemplaza por un tema al azar", async () => {
        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'all' })]));

        expect(result.blocks[0].theme).toBe('aleatorio');
      });

      it("'weakness' usa el tema más débil según los elos del plan", async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({ themes: { fork: 1500, pin: 1200 }, total: 1400 });
        plansElosService.getWeakness.mockReturnValue('pin');

        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'weakness' })]));

        expect(plansElosService.getWeakness).toHaveBeenCalledWith({ fork: 1500, pin: 1200 });
        expect(result.blocks[0].theme).toBe('pin');
      });

      it("'weakness' sin elos de temas cae a un tema al azar", async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({});

        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'weakness' })]));

        expect(plansElosService.getWeakness).not.toHaveBeenCalled();
        expect(result.blocks[0].theme).toBe('aleatorio');
      });

      it("'weakness' cuando no hay debilidad calculable (null) cae a un tema al azar", async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({ themes: {}, total: 1400 });
        plansElosService.getWeakness.mockReturnValue(null);

        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'weakness' })]));

        expect(result.blocks[0].theme).toBe('aleatorio');
      });
    });

    describe('elo del bloque', () => {
      it('con rango eloMin/eloMax elige un valor dentro del rango (extremos incluidos)', async () => {
        const random = jest.spyOn(Math, 'random');
        const blocks = [block({ eloMin: 1200, eloMax: 1400 })];

        random.mockReturnValue(0);
        const low = await service.makeCustomPlanForPlay(customPlan(blocks));
        random.mockReturnValue(0.999999);
        const high = await service.makeCustomPlanForPlay(customPlan(blocks));

        expect(low.blocks[0].elo).toBe(1200);
        expect(high.blocks[0].elo).toBe(1400);
      });

      it('el rango tiene prioridad sobre los elos guardados', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        plansElosService.getOnePlanElo.mockResolvedValue({ themes: { fork: 1900 }, total: 1900 });

        const result = await service.makeCustomPlanForPlay(
          customPlan([block({ theme: 'fork', eloMin: 1000, eloMax: 1100 })])
        );

        expect(result.blocks[0].elo).toBe(1000);
      });

      it('sin rango usa el elo del tema en el plan', async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({ themes: { fork: 1700 }, total: 1500 });

        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'fork' })]));

        expect(result.blocks[0].elo).toBe(1700);
      });

      it('si el tema no tiene elo usa el total del plan', async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({ themes: { pin: 1300 }, total: 1450 });

        const result = await service.makeCustomPlanForPlay(customPlan([block({ theme: 'fork' })]));

        expect(result.blocks[0].elo).toBe(1450);
      });

      it('sin elos del plan usa el elo de arranque recibido', async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({});

        const result = await service.makeCustomPlanForPlay(customPlan([block()]), 1234);

        expect(result.blocks[0].elo).toBe(1234);
      });

      it('el elo de arranque por defecto es 1500', async () => {
        const result = await service.makeCustomPlanForPlay(customPlan([block()]));

        expect(result.blocks[0].elo).toBe(1500);
      });

      it('un rango incompleto (solo eloMin) se ignora', async () => {
        const result = await service.makeCustomPlanForPlay(customPlan([block({ eloMin: 1000 })]), 1500);

        expect(result.blocks[0].elo).toBe(1500);
      });

      it('con total guardado en 0 se respeta el 0 (no cae al elo de arranque)', async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({ total: 0 } as PlanElos);

        const result = await service.makeCustomPlanForPlay(customPlan([block()]), 1500);

        expect(result.blocks[0].elo).toBe(0);
      });
    });

    describe('puzzles y progreso', () => {
      it('pide los puzzles de cada bloque con el tema y el elo ya resueltos', async () => {
        plansElosService.getOnePlanElo.mockResolvedValue({ themes: { pin: 1300 }, total: 1450 });

        await service.makeCustomPlanForPlay(customPlan([block({ theme: 'pin', time: 90 })]));

        expect(blockService.getPuzzlesForBlock).toHaveBeenCalledWith(
          expect.objectContaining({ theme: 'pin', elo: 1300, time: 90 })
        );
      });

      it('cada bloque devuelto trae sus puzzles y puzzlesPlayed vacío', async () => {
        blockService.getPuzzlesForBlock
          .mockResolvedValueOnce([{ id: 'a' }])
          .mockResolvedValueOnce([{ id: 'b' }]);

        const result = await service.makeCustomPlanForPlay(
          customPlan([
            block({ puzzlesPlayed: [{ uid: 'viejo' } as any] }),
            block({ theme: 'pin' }),
          ])
        );

        expect(result.blocks.map((b) => b.puzzles)).toEqual([[{ id: 'a' }], [{ id: 'b' }]]);
        expect(result.blocks.every((b) => b.puzzlesPlayed.length === 0)).toBe(true);
      });

      it('reporta el progreso (cargados, total) tras cada bloque', async () => {
        const onProgress = jest.fn();

        await service.makeCustomPlanForPlay(
          customPlan([block(), block(), block()]),
          1500,
          onProgress
        );

        expect(onProgress.mock.calls).toEqual([
          [1, 3],
          [2, 3],
          [3, 3],
        ]);
      });

      it('carga los bloques en orden, uno tras otro', async () => {
        const themes: string[] = [];
        blockService.getPuzzlesForBlock.mockImplementation(async (b: Block) => {
          themes.push(b.theme);
          return [];
        });

        await service.makeCustomPlanForPlay(
          customPlan([block({ theme: 'a' }), block({ theme: 'b' }), block({ theme: 'c' })])
        );

        expect(themes).toEqual(['a', 'b', 'c']);
      });

      it('si falla la carga de puzzles el error se propaga y no se avisa que empezó la rutina', async () => {
        blockService.getPuzzlesForBlock.mockRejectedValue(new Error('sin red'));

        await expect(service.makeCustomPlanForPlay(customPlan([block()]))).rejects.toThrow('sin red');

        expect(analytics.logEvent).not.toHaveBeenCalled();
        expect(reminders.onSessionStarted).not.toHaveBeenCalled();
      });
    });

    describe('plan devuelto', () => {
      it('es una sesión nueva: uid nuevo, tipo custom, referencia al plan de origen y fecha actual', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-03-04T10:00:00Z'));

        const result = await service.makeCustomPlanForPlay(
          customPlan([block()], { uid: 'origen', planType: 'plan5' as Plan['planType'] })
        );

        expect(result).toMatchObject({
          uid: 'uid-nuevo',
          uidCustomPlan: 'origen',
          planType: 'custom',
          createdAt: new Date('2026-03-04T10:00:00Z').getTime(),
          title: 'Mi rutina',
        });
      });

      it('no modifica el plan recibido', async () => {
        const original = customPlan([block({ theme: 'all' })]);
        const snapshot = JSON.parse(JSON.stringify(original));

        await service.makeCustomPlanForPlay(original);

        expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
      });
    });

    describe('efectos secundarios', () => {
      it('registra routine_started con la duración en minutos y el nombre de la rutina', async () => {
        await service.makeCustomPlanForPlay(
          customPlan([block({ time: 120 }), block({ time: 180 }), block({ time: -1 })])
        );

        expect(analytics.logEvent).toHaveBeenCalledWith('routine_started', {
          routine_kind: 'custom',
          routine_minutes: 5,
          routine_category: '',
          routine_name: 'Mi rutina',
          routine_uid: 'c1',
          blocks_count: 3,
        });
      });

      it('sin título usa "Personalizada" como nombre', async () => {
        await service.makeCustomPlanForPlay(customPlan([block()], { title: undefined }));

        expect(analytics.logEvent).toHaveBeenCalledWith(
          'routine_started',
          expect.objectContaining({ routine_name: 'Personalizada' })
        );
      });

      it('avisa al recordatorio de que empezó la sesión', async () => {
        await service.makeCustomPlanForPlay(customPlan([block()]));

        expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('newPlan', () => {
    it('limpia el plan anterior, lo recarga y solo entonces guarda el nuevo', async () => {
      await service.newPlan([block()], 'plan5');

      expect(calls).toEqual(['clear', 'load', 'set']);
    });

    it('crea el plan con uid, bloques, tipo y fecha actual y lo pone en el store', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-04T10:00:00Z'));
      const blocks = [block()];

      const plan = await service.newPlan(blocks, 'plan5');

      expect(plan).toEqual({
        uid: 'uid-nuevo',
        blocks,
        planType: 'plan5',
        createdAt: new Date('2026-03-04T10:00:00Z').getTime(),
      });
      expect(planFacade.setPlan).toHaveBeenCalledWith(plan);
    });

    it('registra routine_started con los metadatos del tipo de plan', async () => {
      await service.newPlan([block(), block()], 'plan10');

      expect(analytics.logEvent).toHaveBeenCalledWith('routine_started', {
        routine_kind: 'default',
        routine_minutes: 10,
        routine_category: expect.any(String),
        routine_name: 'Rutina 10 min',
        blocks_count: 2,
      });
    });

    it('para planes con reglas propias reporta su tipo (infinity)', async () => {
      await service.newPlan([block()], 'infinity');

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'routine_started',
        expect.objectContaining({ routine_kind: 'infinity', routine_name: 'Infinita' })
      );
    });

    it('avisa al recordatorio de que empezó la sesión', async () => {
      await service.newPlan([block()], 'plan5');

      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
    });

    it('si el store falla, guarda el mensaje de error, rechaza y no registra analítica', async () => {
      planFacade.setPlan.mockImplementation(() => {
        throw new Error('store roto');
      });

      await expect(service.newPlan([block()], 'plan5')).rejects.toThrow('store roto');

      expect(planFacade.setPlanError).toHaveBeenCalledWith('store roto');
      expect(analytics.logEvent).not.toHaveBeenCalled();
      expect(reminders.onSessionStarted).not.toHaveBeenCalled();
    });

    it('si el fallo no es un Error usa un mensaje genérico', async () => {
      planFacade.setPlan.mockImplementation(() => {
        throw 'texto suelto';
      });

      await expect(service.newPlan([block()], 'plan5')).rejects.toBe('texto suelto');

      expect(planFacade.setPlanError).toHaveBeenCalledWith('No se pudo crear el plan');
    });
  });

  describe('savePlan', () => {
    it('delega en el repositorio y devuelve su resultado', async () => {
      planRepository.savePlan.mockResolvedValue(undefined);
      const plan = customPlan([block()], { isFinished: true });

      await service.savePlan(plan);

      expect(planRepository.savePlan).toHaveBeenCalledWith(plan);
    });

    it('propaga el error del repositorio', async () => {
      planRepository.savePlan.mockRejectedValue(new Error('offline'));

      await expect(service.savePlan(customPlan([]))).rejects.toThrow('offline');
    });
  });
});
