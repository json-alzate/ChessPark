import { TestBed } from '@angular/core/testing';
import { addDoc, getDocs } from 'firebase/firestore';

import { CoordinatesPuzzle, UserPuzzle } from '@chesspark/models';

import { FirestoreConnection } from '@core/firestore/firestore-connection.service';
import { UserPuzzleRepository } from '@services/firestore/user-puzzle.repository';
import { fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

describe('UserPuzzleRepository', () => {
  let repo: UserPuzzleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    [getDocs, addDoc].forEach((m) => (m as jest.Mock).mockReset());
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db: {} } }],
    });
    repo = TestBed.inject(UserPuzzleRepository);
  });

  describe('getCoordinatesPuzzles', () => {
    it('consulta coordinatesPuzzles por uidUser', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.getCoordinatesPuzzles('u1');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'coordinatesPuzzles',
        constraints: [{ type: 'where', field: 'uidUser', op: '==', value: 'u1' }],
      });
    });

    it('devuelve los ejercicios con el id del documento como uid', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([
          { id: 'c1', data: { uid: 'x', uidUser: 'u1' } },
          { id: 'c2', data: { uid: 'y', uidUser: 'u1' } },
        ])
      );

      const result = await repo.getCoordinatesPuzzles('u1');

      expect(result.map((c) => c.uid)).toEqual(['c1', 'c2']);
    });
  });

  describe('addCoordinatesPuzzle', () => {
    it('agrega a coordinatesPuzzles y devuelve el id generado', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'nuevo' });
      const puzzle = { uidUser: 'u1' } as unknown as CoordinatesPuzzle;

      const id = await repo.addCoordinatesPuzzle(puzzle);

      expect(addDoc).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'coordinatesPuzzles' }),
        puzzle
      );
      expect(id).toBe('nuevo');
    });
  });

  describe('getUserPuzzlesByUidUser', () => {
    it('consulta userPuzzles por uidUser', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.getUserPuzzlesByUidUser('u2');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'userPuzzles',
        constraints: [{ type: 'where', field: 'uidUser', op: '==', value: 'u2' }],
      });
    });

    it('devuelve los puzzles resueltos con el id del documento como uid', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([{ id: 'up1', data: { uid: '', uidUser: 'u2', result: 1 } }])
      );

      const result = await repo.getUserPuzzlesByUidUser('u2');

      expect(result).toEqual([{ uid: 'up1', uidUser: 'u2', result: 1 }]);
    });

    it('propaga el error de Firestore', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('unavailable'));

      await expect(repo.getUserPuzzlesByUidUser('u2')).rejects.toThrow('unavailable');
    });
  });

  describe('addOneUserPuzzle', () => {
    it('agrega a userPuzzles y devuelve el id generado', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'up9' });
      const puzzle = { uidUser: 'u2' } as unknown as UserPuzzle;

      const id = await repo.addOneUserPuzzle(puzzle);

      expect(addDoc).toHaveBeenCalledWith(expect.objectContaining({ name: 'userPuzzles' }), puzzle);
      expect(id).toBe('up9');
    });

    it('no traga el error si addDoc falla', async () => {
      (addDoc as jest.Mock).mockRejectedValue(new Error('quota'));

      await expect(repo.addOneUserPuzzle({} as UserPuzzle)).rejects.toThrow('quota');
    });
  });
});
