import { TestBed } from '@angular/core/testing';
import { getDocs, setDoc, updateDoc } from 'firebase/firestore';

import { PlanElos } from '@chesspark/models';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';
import { PlanElosRepository } from '@features/training/data/plan-elos.repository';
import { fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

const elos = (uid: string, extra: Partial<PlanElos> = {}): PlanElos => ({
  uid,
  uidUser: 'u1',
  uidPlan: 'p1',
  themes: { fork: 1600 },
  openings: {},
  total: 1550,
  ...extra,
});

describe('PlanElosRepository', () => {
  let repo: PlanElosRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    [getDocs, setDoc, updateDoc].forEach((m) => (m as jest.Mock).mockReset());
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db: {} } }],
    });
    repo = TestBed.inject(PlanElosRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getPlansElos', () => {
    it('consulta plansElos filtrando por uidUser', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.getPlansElos('u1');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'plansElos',
        constraints: [{ type: 'where', field: 'uidUser', op: '==', value: 'u1' }],
      });
    });

    it('devuelve todos los elos del usuario con el id del documento como uid', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'e1', data: elos('viejo-1') },
          { id: 'e2', data: elos('viejo-2', { uidPlan: 'p2' }) },
        ])
      );

      const result = await repo.getPlansElos('u1');

      expect(result.map((e) => [e.uid, e.uidPlan])).toEqual([
        ['e1', 'p1'],
        ['e2', 'p2'],
      ]);
    });
  });

  describe('getPlanElos', () => {
    it('filtra por plan Y por usuario, en ese orden', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.getPlanElos('p7', 'u3');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'plansElos',
        constraints: [
          { type: 'where', field: 'uidPlan', op: '==', value: 'p7' },
          { type: 'where', field: 'uidUser', op: '==', value: 'u3' },
        ],
      });
    });

    it('devuelve el primer documento encontrado', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'e1', data: elos('e1', { total: 1700 }) },
          { id: 'e2', data: elos('e2', { total: 1200 }) },
        ])
      );

      const result = await repo.getPlanElos('p1', 'u1');

      expect(result.total).toBe(1700);
    });

    it('devuelve un objeto vacío (sin uid) si aún no hay elos del plan', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      const result = await repo.getPlanElos('p1', 'u1');

      expect(result).toEqual({});
      expect(result.uid).toBeUndefined();
    });
  });

  describe('savePlanElo', () => {
    it('escribe en plansElos/<uid> el documento completo', async () => {
      const e = elos('e1');

      await repo.savePlanElo(e);

      expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'plansElos/e1' }), e);
    });
  });

  describe('updatePlanElo', () => {
    it('actualiza plansElos/<uid> con una copia de los campos', async () => {
      const e = elos('e1', { total: 1620 });

      await repo.updatePlanElo(e);

      const [ref, data] = (updateDoc as jest.Mock).mock.calls[0];
      expect(ref.path).toBe('plansElos/e1');
      expect(data).toEqual(e);
      expect(data).not.toBe(e);
    });

    it('propaga el error de Firestore', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('not-found'));

      await expect(repo.updatePlanElo(elos('e1'))).rejects.toThrow('not-found');
    });
  });
});
