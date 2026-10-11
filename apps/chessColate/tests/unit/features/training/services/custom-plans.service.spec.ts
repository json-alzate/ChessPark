import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Plan } from '@chesspark/models';
import { CustomPlansFacadeService } from '@chesspark/state';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { CustomPlanRepository } from '@features/training/data/custom-plan.repository';
import { PublicPlanRepository } from '@features/training/data/public-plan.repository';
import { CustomPlansService } from '@features/training/services/custom-plans.service';

const plan = (extra: Partial<Plan> = {}): Plan => ({
  uid: 'c1',
  title: 'Mi rutina',
  uidUser: 'u1',
  blocks: [
    { time: 60, puzzlesCount: 0, theme: 'fork', elo: 1500, color: 'white', puzzlesPlayed: [] },
    { time: 60, puzzlesCount: 0, theme: 'pin', elo: 1500, color: 'white', puzzlesPlayed: [] },
  ],
  createdAt: 1,
  planType: 'custom',
  isPublic: true,
  ...extra,
});

describe('CustomPlansService', () => {
  let service: CustomPlansService;
  let order: string[];
  let customRepo: { getCustomPlan: jest.Mock; saveCustomPlan: jest.Mock; updateCustomPlan: jest.Mock };
  let publicRepo: { syncPlanToPublic: jest.Mock };
  let facade: {
    getCustomPlan$: jest.Mock;
    getCustomPlansOrderByDate$: jest.Mock;
    addOneCustomPlan: jest.Mock;
    updateCustomPlanInState: jest.Mock;
  };
  let analytics: { logEvent: jest.Mock };

  beforeEach(() => {
    order = [];
    customRepo = {
      getCustomPlan: jest.fn().mockResolvedValue(null),
      saveCustomPlan: jest.fn().mockImplementation(async () => void order.push('repo.save')),
      updateCustomPlan: jest.fn().mockImplementation(async () => void order.push('repo.update')),
    };
    publicRepo = {
      syncPlanToPublic: jest.fn().mockImplementation(async () => void order.push('sync')),
    };
    facade = {
      getCustomPlan$: jest.fn().mockReturnValue(of(undefined)),
      getCustomPlansOrderByDate$: jest.fn(),
      addOneCustomPlan: jest.fn().mockImplementation(() => order.push('state.add')),
      updateCustomPlanInState: jest.fn().mockImplementation(() => order.push('state.update')),
    };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        { provide: CustomPlanRepository, useValue: customRepo },
        { provide: PublicPlanRepository, useValue: publicRepo },
        { provide: CustomPlansFacadeService, useValue: facade },
        { provide: AnalyticsService, useValue: analytics },
      ],
    });
    service = TestBed.inject(CustomPlansService);
  });

  describe('getById', () => {
    it('devuelve el plan del store sin consultar Firestore', async () => {
      const cached = plan();
      facade.getCustomPlan$.mockReturnValue(of(cached));

      const result = await service.getById('c1');

      expect(facade.getCustomPlan$).toHaveBeenCalledWith('c1');
      expect(result).toBe(cached);
      expect(customRepo.getCustomPlan).not.toHaveBeenCalled();
    });

    it('si no está en el store, lo pide a Firestore', async () => {
      const remote = plan({ title: 'remoto' });
      customRepo.getCustomPlan.mockResolvedValue(remote);

      await expect(service.getById('c1')).resolves.toBe(remote);
      expect(customRepo.getCustomPlan).toHaveBeenCalledWith('c1');
    });

    it('devuelve null si no existe en ninguna parte', async () => {
      await expect(service.getById('c1')).resolves.toBeNull();
    });
  });

  describe('getMyPlans$', () => {
    it('expone el observable de la facade ordenado por fecha', () => {
      const stream$ = of([plan()]);
      facade.getCustomPlansOrderByDate$.mockReturnValue(stream$);

      expect(service.getMyPlans$()).toBe(stream$);
    });
  });

  describe('save', () => {
    it('escribe primero en Firestore, luego en el store y al final sincroniza el plan público', async () => {
      await service.save(plan());

      expect(order).toEqual(['repo.save', 'state.add', 'sync']);
      expect(customRepo.saveCustomPlan).toHaveBeenCalledWith(plan());
      expect(facade.addOneCustomPlan).toHaveBeenCalledWith(plan());
      expect(publicRepo.syncPlanToPublic).toHaveBeenCalledWith(plan());
    });

    it('si Firestore falla, el error llega a quien llama y el store queda intacto', async () => {
      customRepo.saveCustomPlan.mockRejectedValue(new Error('offline'));

      await expect(service.save(plan())).rejects.toThrow('offline');

      expect(facade.addOneCustomPlan).not.toHaveBeenCalled();
      expect(publicRepo.syncPlanToPublic).not.toHaveBeenCalled();
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });

    it('si falla la sincronización pública el error se propaga (el plan ya quedó guardado)', async () => {
      publicRepo.syncPlanToPublic.mockRejectedValue(new Error('sync'));

      await expect(service.save(plan())).rejects.toThrow('sync');

      expect(facade.addOneCustomPlan).toHaveBeenCalled();
    });

    it('registra custom_plan_created con uid, visibilidad y número de bloques', async () => {
      await service.save(plan());

      expect(analytics.logEvent).toHaveBeenCalledWith('custom_plan_created', {
        plan_uid: 'c1',
        is_public: true,
        blocks_count: 2,
      });
    });

    it('un plan sin isPublic se reporta como no público', async () => {
      await service.save(plan({ isPublic: undefined }));

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'custom_plan_created',
        expect.objectContaining({ is_public: false })
      );
    });

    it('un plan sin bloques se reporta con 0 bloques', async () => {
      await service.save(plan({ blocks: undefined as unknown as Plan['blocks'] }));

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'custom_plan_created',
        expect.objectContaining({ blocks_count: 0 })
      );
    });
  });

  describe('update', () => {
    it('actualiza Firestore, luego el store y al final sincroniza el plan público', async () => {
      await service.update(plan());

      expect(order).toEqual(['repo.update', 'state.update', 'sync']);
      expect(customRepo.updateCustomPlan).toHaveBeenCalledWith(plan());
      expect(facade.updateCustomPlanInState).toHaveBeenCalledWith(plan());
      expect(publicRepo.syncPlanToPublic).toHaveBeenCalledWith(plan());
    });

    it('si Firestore falla no toca el store ni sincroniza', async () => {
      customRepo.updateCustomPlan.mockRejectedValue(new Error('not-found'));

      await expect(service.update(plan())).rejects.toThrow('not-found');

      expect(facade.updateCustomPlanInState).not.toHaveBeenCalled();
      expect(publicRepo.syncPlanToPublic).not.toHaveBeenCalled();
    });

    it('registra custom_plan_updated con uid y visibilidad', async () => {
      await service.update(plan({ isPublic: false }));

      expect(analytics.logEvent).toHaveBeenCalledWith('custom_plan_updated', {
        plan_uid: 'c1',
        is_public: false,
      });
    });
  });
});
