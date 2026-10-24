import { TestBed } from '@angular/core/testing';
import { getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

import { Block, Plan, PublicPlan } from '@chesspark/models';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';
import { PublicPlanRepository } from '@features/training/data/public-plan.repository';
import { fakeDocSnap, fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

const block = (extra: Partial<Block> = {}): Block => ({
  time: 60,
  puzzlesCount: 0,
  theme: 'fork',
  elo: 1500,
  color: 'white',
  puzzlesPlayed: [],
  ...extra,
});

const customPlan = (extra: Partial<Plan> = {}): Plan => ({
  uid: 'c1',
  title: 'Mi rutina',
  uidUser: 'u1',
  eloTotal: 1600,
  blocks: [block()],
  createdAt: 100,
  planType: 'custom',
  isFinished: false,
  uidCustomPlan: 'c1',
  isPublic: true,
  ...extra,
});

/** Último documento que se escribió con setDoc: [ref, datos]. */
const lastWrite = () => {
  const calls = (setDoc as jest.Mock).mock.calls;
  return calls[calls.length - 1] as [{ path: string }, Record<string, any>];
};

describe('PublicPlanRepository', () => {
  let repo: PublicPlanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    [getDoc, getDocs, setDoc, updateDoc].forEach((m) => (m as jest.Mock).mockReset());
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db: {} } }],
    });
    repo = TestBed.inject(PublicPlanRepository);
  });

  describe('syncPlanToPublic', () => {
    describe('plan que aún no está publicado', () => {
      beforeEach(() => {
        (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', undefined));
      });

      it('lo escribe en public-plans/<uid> con los contadores en cero', async () => {
        await repo.syncPlanToPublic(customPlan());

        const [ref, data] = lastWrite();
        expect(ref.path).toBe('public-plans/c1');
        expect(data).toMatchObject({
          uid: 'c1',
          title: 'Mi rutina',
          uidUser: 'u1',
          eloTotal: 1600,
          createdAt: 100,
          planType: 'custom',
          isPublic: true,
          timesPlayed: 0,
          likesCount: 0,
          savedCount: 0,
        });
      });

      it('quita los puzzles y deja puzzlesPlayed vacío en cada bloque', async () => {
        const plan = customPlan({
          blocks: [
            block({
              puzzles: [{ id: 'z1' } as any],
              puzzlesPlayed: [{ uid: 'jugado' } as any],
            }),
          ],
        });

        await repo.syncPlanToPublic(plan);

        const [, data] = lastWrite();
        expect(data['blocks']).toHaveLength(1);
        expect(data['blocks'][0]).not.toHaveProperty('puzzles');
        expect(data['blocks'][0].puzzlesPlayed).toEqual([]);
        expect(data['blocks'][0]).toMatchObject({ theme: 'fork', time: 60, elo: 1500 });
      });

      it('no modifica el plan original del usuario', async () => {
        const plan = customPlan({ blocks: [block({ puzzles: [{ id: 'z1' } as any] })] });

        await repo.syncPlanToPublic(plan);

        expect(plan.blocks[0].puzzles).toEqual([{ id: 'z1' }]);
      });

      it('marca isPublic en false cuando el plan no lo define', async () => {
        await repo.syncPlanToPublic(customPlan({ isPublic: undefined }));

        expect(lastWrite()[1]['isPublic']).toBe(false);
      });

      it('no envía campos undefined (Firestore los rechaza)', async () => {
        await repo.syncPlanToPublic(
          customPlan({ title: undefined, eloTotal: undefined, uidCustomPlan: undefined })
        );

        const [, data] = lastWrite();
        expect(Object.keys(data)).not.toEqual(
          expect.arrayContaining(['title', 'eloTotal', 'uidCustomPlan'])
        );
        expect(Object.values(data)).not.toContain(undefined);
      });

      it('limpia los undefined también dentro de los bloques', async () => {
        await repo.syncPlanToPublic(
          customPlan({ blocks: [block({ openingFamily: undefined, description: undefined })] })
        );

        const blockData = lastWrite()[1]['blocks'][0];
        expect(blockData).not.toHaveProperty('openingFamily');
        expect(blockData).not.toHaveProperty('description');
      });
    });

    describe('plan que ya está publicado', () => {
      it('actualiza los datos del plan pero conserva los contadores existentes', async () => {
        (getDoc as jest.Mock).mockResolvedValue(
          fakeDocSnap('c1', { timesPlayed: 12, likesCount: 5, savedCount: 3 })
        );

        await repo.syncPlanToPublic(customPlan({ title: 'Título editado', isPublic: false }));

        const [ref, data] = lastWrite();
        expect(ref.path).toBe('public-plans/c1');
        expect(data).toMatchObject({
          title: 'Título editado',
          isPublic: false,
          timesPlayed: 12,
          likesCount: 5,
          savedCount: 3,
        });
      });

      it('conserva lastPlayedAt si existía', async () => {
        (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', { lastPlayedAt: 999 }));

        await repo.syncPlanToPublic(customPlan());

        expect(lastWrite()[1]['lastPlayedAt']).toBe(999);
      });

      it('no inventa lastPlayedAt si nunca se jugó', async () => {
        (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', { timesPlayed: 1 }));

        await repo.syncPlanToPublic(customPlan());

        expect(lastWrite()[1]).not.toHaveProperty('lastPlayedAt');
      });

      it('usa cero para los contadores que faltan en el documento', async () => {
        (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', {}));

        await repo.syncPlanToPublic(customPlan());

        expect(lastWrite()[1]).toMatchObject({ timesPlayed: 0, likesCount: 0, savedCount: 0 });
      });

      it('también limpia puzzles de los bloques al actualizar', async () => {
        (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', {}));

        await repo.syncPlanToPublic(
          customPlan({ blocks: [block({ puzzles: [{ id: 'z' } as any] })] })
        );

        expect(lastWrite()[1]['blocks'][0]).not.toHaveProperty('puzzles');
      });
    });

    it('propaga el error si la escritura falla', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('c1', undefined));
      (setDoc as jest.Mock).mockRejectedValue(new Error('offline'));

      await expect(repo.syncPlanToPublic(customPlan())).rejects.toThrow('offline');
    });
  });

  describe('getPublicPlans', () => {
    const stored = (extra: Record<string, unknown> = {}) => ({
      title: 'Plan',
      uidUser: 'u1',
      eloTotal: 1500,
      createdAt: 5,
      planType: 'custom',
      isPublic: true,
      timesPlayed: 2,
      likesCount: 1,
      savedCount: 0,
      blocks: [],
      ...extra,
    });

    beforeEach(() => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));
    });

    const queryUsed = () => (getDocs as jest.Mock).mock.calls[0][0];

    it('sin conexión (respuesta vacía de la caché) falla en vez de decir que no hay planes', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([], { fromCache: true }));

      await expect(repo.getPublicPlans('recent', 10)).rejects.toThrow('sin conexión');
    });

    it('vacío desde el servidor sí es una lista vacía, y con datos en caché se usan', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce(fakeQuerySnap([], { fromCache: false }));
      await expect(repo.getPublicPlans('recent', 10)).resolves.toEqual({ plans: [], lastPlanUid: null });

      (getDocs as jest.Mock).mockResolvedValueOnce(
        fakeQuerySnap([{ id: 'p1', data: stored() }], { fromCache: true })
      );
      const { plans } = await repo.getPublicPlans('recent', 10);
      expect(plans.map((p) => p.uid)).toEqual(['p1']);
    });

    it('pide solo planes activos (isPublic == true) de public-plans', async () => {
      await repo.getPublicPlans('recent', 10);

      expect(queryUsed().collection).toBe('public-plans');
      expect(queryUsed().constraints[0]).toEqual({
        type: 'where',
        field: 'isPublic',
        op: '==',
        value: true,
      });
    });

    it.each([
      ['recent', 'createdAt'],
      ['mostPlayed', 'timesPlayed'],
      ['mostLiked', 'likesCount'],
    ] as const)('el filtro %s ordena por %s de mayor a menor y limita', async (filter, field) => {
      await repo.getPublicPlans(filter, 7);

      expect(queryUsed().constraints).toEqual([
        { type: 'where', field: 'isPublic', op: '==', value: true },
        { type: 'orderBy', field, direction: 'desc' },
        { type: 'limit', count: 7 },
      ]);
    });

    it('un filtro desconocido cae al orden por fecha', async () => {
      await repo.getPublicPlans('otro' as any, 3);

      expect(queryUsed().constraints[1]).toEqual({
        type: 'orderBy',
        field: 'createdAt',
        direction: 'desc',
      });
    });

    it('sin lastPlanUid no pagina ni lee el documento ancla', async () => {
      await repo.getPublicPlans('recent', 10);

      expect(getDoc).not.toHaveBeenCalled();
      expect(JSON.stringify(queryUsed().constraints)).not.toContain('startAfter');
    });

    it('con lastPlanUid pagina empezando después de ese documento', async () => {
      const anchor = fakeDocSnap('ultimo', stored());
      (getDoc as jest.Mock).mockResolvedValue(anchor);

      await repo.getPublicPlans('recent', 10, 'ultimo');

      expect(getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'public-plans/ultimo' }));
      const constraints = queryUsed().constraints;
      expect(constraints[constraints.length - 1]).toEqual({ type: 'startAfter', snapshot: anchor });
    });

    it('si el documento ancla ya no existe, devuelve la primera página', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('ultimo', undefined));

      await repo.getPublicPlans('recent', 10, 'ultimo');

      expect(queryUsed().constraints.some((c: any) => c.type === 'startAfter')).toBe(false);
    });

    it('devuelve lista vacía y lastPlanUid null cuando no hay resultados', async () => {
      await expect(repo.getPublicPlans('recent', 10)).resolves.toEqual({
        plans: [],
        lastPlanUid: null,
      });
    });

    it('usa el id del documento como uid y devuelve el id del último como cursor', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'a', data: stored({ uid: 'otro' }) },
          { id: 'b', data: stored() },
        ])
      );

      const result = await repo.getPublicPlans('recent', 2);

      expect(result.plans.map((p) => p.uid)).toEqual(['a', 'b']);
      expect(result.lastPlanUid).toBe('b');
    });

    it('rellena con 0 los contadores que faltan y false isPublic', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'a', data: { title: 'T', uidUser: 'u', createdAt: 1, planType: 'custom', blocks: [] } },
        ])
      );

      const [plan] = (await repo.getPublicPlans('recent', 1)).plans;

      expect(plan).toMatchObject({ timesPlayed: 0, likesCount: 0, savedCount: 0, isPublic: false });
    });

    it('descarta campos undefined del plan (no aparecen como claves)', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([{ id: 'a', data: stored() }])
      );

      const [plan] = (await repo.getPublicPlans('recent', 1)).plans;

      expect(plan).not.toHaveProperty('lastPlayedAt');
      expect(plan).not.toHaveProperty('uidCustomPlan');
      expect(plan).not.toHaveProperty('isFinished');
    });

    it('aplana los bloques: copia los campos del bloque, vacía puzzlesPlayed y omite puzzles', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          {
            id: 'a',
            data: stored({
              blocks: [
                {
                  title: 'B1',
                  time: 120,
                  puzzlesCount: 0,
                  theme: 'weakness',
                  elo: 1400,
                  color: 'random',
                  puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20, extra: 'x' },
                  puzzlesPlayed: [{ uid: 'jugado' }],
                  puzzles: [{ id: 'z1' }],
                  showPuzzleSolution: true,
                  nextPuzzleImmediately: true,
                  goshPuzzle: true,
                  goshPuzzleTime: 10,
                  campoExtra: 'no debe pasar',
                },
              ],
            }),
          },
        ])
      );

      const [plan] = (await repo.getPublicPlans('recent', 1)).plans;

      expect(plan.blocks[0]).toEqual({
        title: 'B1',
        time: 120,
        puzzlesCount: 0,
        theme: 'weakness',
        elo: 1400,
        color: 'random',
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
        puzzlesPlayed: [],
        showPuzzleSolution: true,
        nextPuzzleImmediately: true,
        goshPuzzle: true,
        goshPuzzleTime: 10,
      });
    });

    it('un bloque mínimo no trae claves undefined', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          {
            id: 'a',
            data: stored({
              blocks: [{ time: 60, puzzlesCount: 0, theme: 'fork', elo: 1500, color: 'white' }],
            }),
          },
        ])
      );

      const [plan] = (await repo.getPublicPlans('recent', 1)).plans;

      expect(Object.keys(plan.blocks[0]).sort()).toEqual(
        ['color', 'elo', 'puzzlesCount', 'puzzlesPlayed', 'theme', 'time'].sort()
      );
    });

    it('si un documento no es serializable, igual devuelve el plan con bloques vacíos', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const circular: Record<string, unknown> = stored({ title: 'Circular' });
      circular['self'] = circular;
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([{ id: 'a', data: circular }]));

      const [plan] = (await repo.getPublicPlans('recent', 1)).plans;

      expect(plan).toMatchObject({ uid: 'a', title: 'Circular', blocks: [] });
      jest.restoreAllMocks();
    });
  });

  describe('getPublicPlan', () => {
    it('lee public-plans/<uid> y devuelve el plan con su uid', async () => {
      (getDoc as jest.Mock).mockResolvedValue(
        fakeDocSnap('p1', { title: 'T', timesPlayed: 4, blocks: [] })
      );

      const result = await repo.getPublicPlan('p1');

      expect(getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'public-plans/p1' }));
      expect(result).toEqual({ uid: 'p1', title: 'T', timesPlayed: 4, blocks: [] });
    });

    it('devuelve null si no existe', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('p1', undefined));

      await expect(repo.getPublicPlan('p1')).resolves.toBeNull();
    });

    it('devuelve una copia: modificarla no toca el documento recibido', async () => {
      const raw = { title: 'T', blocks: [{ theme: 'fork' }] };
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('p1', raw));

      const result = (await repo.getPublicPlan('p1')) as PublicPlan;
      result.blocks[0].theme = 'pin';

      expect(raw.blocks[0].theme).toBe('fork');
    });
  });

  describe('incrementPlanStats', () => {
    it.each(['timesPlayed', 'likesCount', 'savedCount'] as const)(
      'suma 1 al campo %s de forma atómica',
      async (field) => {
        await repo.incrementPlanStats('p1', field);

        expect(updateDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: 'public-plans/p1' }),
          { [field]: { type: 'increment', by: 1 } }
        );
      }
    );

    it('propaga el error si el plan no existe', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('not-found'));

      await expect(repo.incrementPlanStats('p1', 'likesCount')).rejects.toThrow('not-found');
    });
  });

  describe('decrementPlanStats', () => {
    it('resta 1 al valor actual del campo', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('p1', { likesCount: 5 }));

      await repo.decrementPlanStats('p1', 'likesCount');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'public-plans/p1' }),
        { likesCount: 4 }
      );
    });

    it('nunca deja el contador en negativo', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('p1', { savedCount: 0 }));

      await repo.decrementPlanStats('p1', 'savedCount');

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { savedCount: 0 });
    });

    it('trata un contador ausente como 0', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('p1', {}));

      await repo.decrementPlanStats('p1', 'likesCount');

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { likesCount: 0 });
    });

    it('no escribe nada si el plan público no existe', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('p1', undefined));

      await repo.decrementPlanStats('p1', 'likesCount');

      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
