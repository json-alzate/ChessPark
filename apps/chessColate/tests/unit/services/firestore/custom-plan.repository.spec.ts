import { TestBed } from '@angular/core/testing';
import { getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

import { Plan } from '@chesspark/models';

import { FirestoreConnection } from '@services/firestore/firestore-connection.service';
import { CustomPlanRepository } from '@services/firestore/custom-plan.repository';
import { fakeDocSnap, fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

const plan = (uid: string, extra: Partial<Plan> = {}): Plan => ({
  uid,
  title: 'Mi rutina',
  uidUser: 'u1',
  blocks: [],
  createdAt: 1,
  planType: 'custom',
  ...extra,
});

describe('CustomPlanRepository', () => {
  let repo: CustomPlanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    [getDoc, getDocs, setDoc, updateDoc].forEach((m) => (m as jest.Mock).mockReset());
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db: {} } }],
    });
    repo = TestBed.inject(CustomPlanRepository);
  });

  describe('saveCustomPlan', () => {
    it('escribe el plan en custom-plans/<uid> (upsert completo)', async () => {
      const p = plan('c1');

      await repo.saveCustomPlan(p);

      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'custom-plans/c1' }),
        p
      );
    });

    it('propaga el error de escritura para que el formulario lo vea', async () => {
      (setDoc as jest.Mock).mockRejectedValue(new Error('offline'));

      await expect(repo.saveCustomPlan(plan('c1'))).rejects.toThrow('offline');
    });
  });

  describe('getCustomPlans', () => {
    it('consulta custom-plans filtrando por uidUser', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.getCustomPlans('u9');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'custom-plans',
        constraints: [{ type: 'where', field: 'uidUser', op: '==', value: 'u9' }],
      });
    });

    it('asigna a cada plan el id de su documento como uid', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'a', data: plan('otro-uid') },
          { id: 'b', data: plan('x') },
        ])
      );

      const plans = await repo.getCustomPlans('u1');

      expect(plans.map((p) => p.uid)).toEqual(['a', 'b']);
    });

    it('devuelve vacío cuando el usuario no tiene planes', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await expect(repo.getCustomPlans('u1')).resolves.toEqual([]);
    });
  });

  describe('getCustomPlan', () => {
    it('lee el documento custom-plans/<uid> y devuelve el plan con su uid', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', plan('distinto')));

      const result = await repo.getCustomPlan('c1');

      expect(getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'custom-plans/c1' }));
      expect(result).toEqual(plan('c1'));
    });

    it('devuelve null si el plan no existe', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', undefined));

      await expect(repo.getCustomPlan('c1')).resolves.toBeNull();
    });
  });

  describe('updateCustomPlan', () => {
    it('actualiza custom-plans/<uid> con una copia de los campos del plan', async () => {
      const p = plan('c1', { title: 'Nuevo título' });

      await repo.updateCustomPlan(p);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      const [ref, data] = (updateDoc as jest.Mock).mock.calls[0];
      expect(ref.path).toBe('custom-plans/c1');
      expect(data).toEqual(p);
      expect(data).not.toBe(p);
    });

    it('propaga el error si el documento no se puede actualizar', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('not-found'));

      await expect(repo.updateCustomPlan(plan('c1'))).rejects.toThrow('not-found');
    });
  });
});
