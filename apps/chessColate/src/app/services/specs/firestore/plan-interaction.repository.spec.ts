import { TestBed } from '@angular/core/testing';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { FirestoreConnection } from '../../firestore/firestore-connection.service';
import { PublicPlanRepository } from '../../firestore/public-plan.repository';
import { PlanInteractionRepository } from '../../firestore/plan-interaction.repository';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

describe('PlanInteractionRepository', () => {
  let repo: PlanInteractionRepository;
  let publicPlans: {
    getPublicPlan: jest.Mock;
    incrementPlanStats: jest.Mock;
    decrementPlanStats: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    publicPlans = {
      getPublicPlan: jest.fn(),
      incrementPlanStats: jest.fn().mockResolvedValue(undefined),
      decrementPlanStats: jest.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FirestoreConnection, useValue: { db: {} } },
        { provide: PublicPlanRepository, useValue: publicPlans },
      ],
    });
    repo = TestBed.inject(PlanInteractionRepository);
  });

  it('rechaza el like del creador sin escribir nada', async () => {
    publicPlans.getPublicPlan.mockResolvedValue({ uid: 'p1', uidUser: 'u1' });

    await expect(repo.togglePlanLike('u1', 'p1', true)).rejects.toThrow(
      'El creador del plan no puede dar me gusta a su propio plan'
    );
    expect(setDoc).not.toHaveBeenCalled();
    expect(publicPlans.incrementPlanStats).not.toHaveBeenCalled();
  });

  it('crea la interacción y suma likesCount al dar like por primera vez', async () => {
    publicPlans.getPublicPlan.mockResolvedValue({ uid: 'p1', uidUser: 'u2' });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    await repo.togglePlanLike('u1', 'p1', true);

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: 'u1_p1', planUid: 'p1', liked: true })
    );
    expect(publicPlans.incrementPlanStats).toHaveBeenCalledWith('p1', 'likesCount');
  });

  it('suma timesPlayed solo la primera vez que se marca como jugado', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ played: true }),
    });

    await repo.markPlanAsPlayed('u1', 'p1');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ played: true })
    );
    expect(publicPlans.incrementPlanStats).not.toHaveBeenCalled();
  });
});
