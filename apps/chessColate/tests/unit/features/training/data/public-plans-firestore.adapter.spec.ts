import { TestBed } from '@angular/core/testing';

import { PublicPlan, PlanInteraction } from '@chesspark/models';

import { PlanInteractionRepository } from '@features/training/data/plan-interaction.repository';
import { PublicPlanRepository } from '@features/training/data/public-plan.repository';
import { PublicPlansFirestoreAdapter } from '@features/training/data/public-plans-firestore.adapter';

// El adaptador solo importa los repositorios para inyectarlos; se reemplazan por dobles.
jest.mock('firebase/firestore', () => ({}));

describe('PublicPlansFirestoreAdapter', () => {
  let adapter: PublicPlansFirestoreAdapter;
  let publicPlans: { getPublicPlans: jest.Mock; getPublicPlan: jest.Mock };
  let interactions: {
    getUserPlanInteractions: jest.Mock;
    getPlanInteraction: jest.Mock;
    togglePlanLike: jest.Mock;
    markPlanAsPlayed: jest.Mock;
    togglePlanSaved: jest.Mock;
  };

  beforeEach(() => {
    publicPlans = { getPublicPlans: jest.fn(), getPublicPlan: jest.fn() };
    interactions = {
      getUserPlanInteractions: jest.fn(),
      getPlanInteraction: jest.fn(),
      togglePlanLike: jest.fn(),
      markPlanAsPlayed: jest.fn(),
      togglePlanSaved: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicPlanRepository, useValue: publicPlans },
        { provide: PlanInteractionRepository, useValue: interactions },
      ],
    });
    adapter = TestBed.inject(PublicPlansFirestoreAdapter);
  });

  describe('planes públicos', () => {
    it('getPublicPlans delega en PublicPlanRepository con todos los argumentos y devuelve su resultado', async () => {
      const page = { plans: [{ uid: 'p1' } as PublicPlan], lastPlanUid: 'p1' };
      publicPlans.getPublicPlans.mockResolvedValue(page);

      const result = await adapter.getPublicPlans('mostLiked', 20, 'anterior');

      expect(publicPlans.getPublicPlans).toHaveBeenCalledWith('mostLiked', 20, 'anterior');
      expect(result).toBe(page);
    });

    it('getPublicPlan delega por uid', async () => {
      const plan = { uid: 'p1' } as PublicPlan;
      publicPlans.getPublicPlan.mockResolvedValue(plan);

      await expect(adapter.getPublicPlan('p1')).resolves.toBe(plan);
      expect(publicPlans.getPublicPlan).toHaveBeenCalledWith('p1');
    });

    it('propaga el rechazo del repositorio', async () => {
      publicPlans.getPublicPlans.mockRejectedValue(new Error('boom'));

      await expect(adapter.getPublicPlans('recent', 5)).rejects.toThrow('boom');
    });
  });

  describe('interacciones', () => {
    it('getUserPlanInteractions delega en PlanInteractionRepository', async () => {
      const list = [{ uid: 'u_p' } as PlanInteraction];
      interactions.getUserPlanInteractions.mockResolvedValue(list);

      await expect(adapter.getUserPlanInteractions('u1')).resolves.toBe(list);
      expect(interactions.getUserPlanInteractions).toHaveBeenCalledWith('u1');
    });

    it('getPlanInteraction pasa usuario y plan en el orden correcto', async () => {
      interactions.getPlanInteraction.mockResolvedValue(null);

      await adapter.getPlanInteraction('u1', 'p1');

      expect(interactions.getPlanInteraction).toHaveBeenCalledWith('u1', 'p1');
    });

    it('togglePlanLike pasa usuario, plan y el nuevo estado', async () => {
      interactions.togglePlanLike.mockResolvedValue(undefined);

      await adapter.togglePlanLike('u1', 'p1', true);

      expect(interactions.togglePlanLike).toHaveBeenCalledWith('u1', 'p1', true);
    });

    it('togglePlanSaved pasa usuario, plan y el nuevo estado', async () => {
      interactions.togglePlanSaved.mockResolvedValue(undefined);

      await adapter.togglePlanSaved('u1', 'p1', false);

      expect(interactions.togglePlanSaved).toHaveBeenCalledWith('u1', 'p1', false);
    });

    it('markPlanAsPlayed delega y propaga errores', async () => {
      interactions.markPlanAsPlayed.mockRejectedValue(new Error('denied'));

      await expect(adapter.markPlanAsPlayed('u1', 'p1')).rejects.toThrow('denied');
      expect(interactions.markPlanAsPlayed).toHaveBeenCalledWith('u1', 'p1');
    });
  });
});
