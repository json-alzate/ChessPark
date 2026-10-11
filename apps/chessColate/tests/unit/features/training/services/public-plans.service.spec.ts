import { TestBed } from '@angular/core/testing';

import { Block, Plan, PlanInteraction, PublicPlan } from '@chesspark/models';

import { PlanService } from '@features/training/services/plan.service';
import { PublicPlansService } from '@features/training/services/public-plans.service';

const block = (): Block => ({
  time: 60,
  puzzlesCount: 0,
  theme: 'fork',
  elo: 1500,
  color: 'white',
  puzzlesPlayed: [],
});

const publicPlan = (uid: string, extra: Partial<PublicPlan> = {}): PublicPlan => ({
  uid,
  title: 'Plan público',
  uidUser: 'creador',
  eloTotal: 1500,
  blocks: [block()],
  createdAt: 100,
  planType: 'custom',
  isFinished: false,
  uidCustomPlan: 'origen',
  isPublic: true,
  timesPlayed: 9,
  likesCount: 4,
  savedCount: 2,
  lastPlayedAt: 50,
  ...extra,
});

const interaction = (planUid: string, extra: Partial<PlanInteraction> = {}): PlanInteraction => ({
  uid: `u1_${planUid}`,
  uidUser: 'u1',
  planUid,
  liked: true,
  played: false,
  saved: false,
  ...extra,
});

describe('PublicPlansService', () => {
  let service: PublicPlansService;
  let planService: { makeCustomPlanForPlay: jest.Mock };

  beforeEach(() => {
    planService = { makeCustomPlanForPlay: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: PlanService, useValue: planService }],
    });
    service = TestBed.inject(PublicPlansService);
  });

  describe('enrichPlansWithInteractions', () => {
    it('agrega a cada plan la interacción del usuario con ese plan', () => {
      const result = service.enrichPlansWithInteractions(
        [publicPlan('a'), publicPlan('b')],
        [interaction('b', { liked: false, saved: true }), interaction('a')]
      );

      expect(result[0].userInteraction).toEqual(interaction('a'));
      expect(result[1].userInteraction).toEqual(interaction('b', { liked: false, saved: true }));
    });

    it('deja userInteraction indefinida en los planes sin interacción', () => {
      const [plan] = service.enrichPlansWithInteractions([publicPlan('a')], [interaction('otro')]);

      expect(plan.userInteraction).toBeUndefined();
    });

    it('conserva el orden y los demás campos, y no muta los planes originales', () => {
      const original = publicPlan('a');

      const result = service.enrichPlansWithInteractions([publicPlan('z'), original], [interaction('a')]);

      expect(result.map((p) => p.uid)).toEqual(['z', 'a']);
      expect(result[1]).toMatchObject({ timesPlayed: 9, likesCount: 4 });
      expect(original.userInteraction).toBeUndefined();
      expect(result[1]).not.toBe(original);
    });

    it('con listas vacías devuelve lista vacía', () => {
      expect(service.enrichPlansWithInteractions([], [interaction('a')])).toEqual([]);
    });

    it('si hay dos interacciones del mismo plan gana la última', () => {
      const [plan] = service.enrichPlansWithInteractions(
        [publicPlan('a')],
        [interaction('a', { liked: false }), interaction('a', { liked: true })]
      );

      expect(plan.userInteraction?.liked).toBe(true);
    });
  });

  describe('preparePlanForPlay', () => {
    it('convierte el plan público en plan y lo manda a makeCustomPlanForPlay con elo y progreso', async () => {
      const prepared = { uid: 'nuevo' } as Plan;
      planService.makeCustomPlanForPlay.mockResolvedValue(prepared);
      const onProgress = jest.fn();

      const result = await service.preparePlanForPlay(publicPlan('p1'), 1800, onProgress);

      expect(result).toBe(prepared);
      const [plan, elo, progress] = planService.makeCustomPlanForPlay.mock.calls[0];
      expect(elo).toBe(1800);
      expect(progress).toBe(onProgress);
      expect(plan).toEqual({
        uid: 'p1',
        title: 'Plan público',
        uidUser: 'creador',
        eloTotal: 1500,
        blocks: [block()],
        createdAt: 100,
        planType: 'custom',
        isFinished: false,
        uidCustomPlan: 'origen',
        isPublic: true,
      });
    });

    it('quita las estadísticas públicas antes de jugar', async () => {
      planService.makeCustomPlanForPlay.mockResolvedValue({} as Plan);

      await service.preparePlanForPlay(publicPlan('p1', { userInteraction: interaction('p1') }));

      const plan = planService.makeCustomPlanForPlay.mock.calls[0][0];
      for (const key of ['timesPlayed', 'likesCount', 'savedCount', 'lastPlayedAt', 'userInteraction']) {
        expect(plan).not.toHaveProperty(key);
      }
    });

    it('usa 1500 como elo de arranque por defecto', async () => {
      planService.makeCustomPlanForPlay.mockResolvedValue({} as Plan);

      await service.preparePlanForPlay(publicPlan('p1'));

      expect(planService.makeCustomPlanForPlay.mock.calls[0][1]).toBe(1500);
    });

    it('un plan que no es custom se devuelve tal cual, sin cargar puzzles', async () => {
      const result = await service.preparePlanForPlay(publicPlan('p1', { planType: 'plan5' }));

      expect(planService.makeCustomPlanForPlay).not.toHaveBeenCalled();
      expect(result.uid).toBe('p1');
      expect(result.planType).toBe('plan5');
    });

    it('un plan custom sin uidCustomPlan tampoco se prepara', async () => {
      const result = await service.preparePlanForPlay(
        publicPlan('p1', { uidCustomPlan: undefined })
      );

      expect(planService.makeCustomPlanForPlay).not.toHaveBeenCalled();
      expect(result.uid).toBe('p1');
    });

    it('propaga el error de makeCustomPlanForPlay', async () => {
      planService.makeCustomPlanForPlay.mockRejectedValue(new Error('sin puzzles'));

      await expect(service.preparePlanForPlay(publicPlan('p1'))).rejects.toThrow('sin puzzles');
    });
  });

  describe('getUserInteractionForPlan', () => {
    it('devuelve la interacción del plan pedido', () => {
      const target = interaction('b');

      expect(service.getUserInteractionForPlan('b', [interaction('a'), target])).toBe(target);
    });

    it('devuelve undefined si no hay interacción con ese plan', () => {
      expect(service.getUserInteractionForPlan('z', [interaction('a')])).toBeUndefined();
      expect(service.getUserInteractionForPlan('z', [])).toBeUndefined();
    });
  });
});
