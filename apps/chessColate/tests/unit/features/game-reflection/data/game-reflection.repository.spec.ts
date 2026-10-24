import { TestBed } from '@angular/core/testing';
import { deleteDoc, getDoc, getDocs, setDoc } from 'firebase/firestore';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';
import { GameReflectionRepository } from '@features/game-reflection/data/game-reflection.repository';
import { GameReflection } from '@features/game-reflection/models/game-reflection.model';
import { fakeDocSnap, fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

const reflexion: GameReflection = {
  gameKey: 'lichess:q7ZvsdUF',
  platform: 'lichess',
  playedAt: 1,
  outcome: 'win',
  best: ['dynamism'],
  improve: ['tactics'],
  updatedAt: 2,
};

describe('GameReflectionRepository', () => {
  let repo: GameReflectionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    [getDoc, getDocs, setDoc, deleteDoc].forEach((m) => (m as jest.Mock).mockReset());
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db: {} } }],
    });
    repo = TestBed.inject(GameReflectionRepository);
  });

  it('guarda la reflexión en el documento de la clave de la partida, dentro del usuario', async () => {
    await repo.saveReflection('u1', reflexion);

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'Users/u1/gameReflections/lichess:q7ZvsdUF' }),
      reflexion
    );
  });

  it('lee la reflexión de una partida', async () => {
    (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('lichess:q7ZvsdUF', reflexion));

    const result = await repo.getReflection('u1', 'lichess:q7ZvsdUF');

    expect(getDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'Users/u1/gameReflections/lichess:q7ZvsdUF' })
    );
    expect(result).toEqual(reflexion);
  });

  it('devuelve null si la partida aún no tiene reflexión', async () => {
    (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('x'));

    expect(await repo.getReflection('u1', 'x')).toBeNull();
  });

  it('lee todas las reflexiones del usuario', async () => {
    (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([{ id: 'a', data: reflexion }]));

    const result = await repo.getReflections('u1');

    expect(getDocs).toHaveBeenCalledWith(expect.objectContaining({ collection: 'Users/u1/gameReflections' }));
    expect(result).toEqual([reflexion]);
  });

  it('borra la reflexión de la partida', async () => {
    await repo.deleteReflection('u1', 'lichess:q7ZvsdUF');

    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'Users/u1/gameReflections/lichess:q7ZvsdUF' })
    );
  });

  it('guarda y lee los tags propios en su subcolección', async () => {
    const tag = { id: 'u_abc', label: 'Cambios de dama', createdAt: 1 };
    (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([{ id: 'u_abc', data: tag }]));

    await repo.saveTag('u1', tag);
    const tags = await repo.getTags('u1');

    expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'Users/u1/gameTags/u_abc' }), tag);
    expect(getDocs).toHaveBeenCalledWith(expect.objectContaining({ collection: 'Users/u1/gameTags' }));
    expect(tags).toEqual([tag]);
  });
});
