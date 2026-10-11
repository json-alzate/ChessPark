import { TestBed } from '@angular/core/testing';
import { getDocs, setDoc } from 'firebase/firestore';

import { Plan } from '@chesspark/models';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';
import { PlanRepository } from '@features/training/data/plan.repository';
import { fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

const plan = (uid: string): Plan => ({ uid, blocks: [], createdAt: 1, planType: 'plan5' });

describe('PlanRepository', () => {
  let repo: PlanRepository;
  const db = { name: 'db' };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDocs as jest.Mock).mockReset();
    (setDoc as jest.Mock).mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db } }],
    });
    repo = TestBed.inject(PlanRepository);
  });

  describe('getPlans', () => {
    it('consulta la colección plans filtrando por uidUser', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.getPlans('u1');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'plans',
        constraints: [{ type: 'where', field: 'uidUser', op: '==', value: 'u1' }],
      });
    });

    it('devuelve los planes con el uid tomado del id del documento', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'doc-a', data: { ...plan('viejo'), createdAt: 10 } },
          { id: 'doc-b', data: plan('otro') },
        ])
      );

      const plans = await repo.getPlans('u1');

      expect(plans.map((p) => p.uid)).toEqual(['doc-a', 'doc-b']);
      expect(plans[0].createdAt).toBe(10);
    });

    it('devuelve una lista vacía si el usuario no tiene planes', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await expect(repo.getPlans('u1')).resolves.toEqual([]);
    });

    it('propaga el error de Firestore', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('permission-denied'));

      await expect(repo.getPlans('u1')).rejects.toThrow('permission-denied');
    });
  });

  describe('savePlan', () => {
    it('escribe el plan completo en plans/<uid>', async () => {
      const p = plan('p1');

      await repo.savePlan(p);

      expect(setDoc).toHaveBeenCalledWith({ type: 'doc', path: 'plans/p1', collection: 'plans', id: 'p1' }, p);
    });

    it('propaga el error si la escritura falla', async () => {
      (setDoc as jest.Mock).mockRejectedValue(new Error('offline'));

      await expect(repo.savePlan(plan('p1'))).rejects.toThrow('offline');
    });
  });
});
