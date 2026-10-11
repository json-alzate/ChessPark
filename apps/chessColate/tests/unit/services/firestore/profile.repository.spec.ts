import { TestBed } from '@angular/core/testing';
import { addDoc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

import { Profile } from '@chesspark/models';

import { FirestoreConnection } from '@services/firestore/firestore-connection.service';
import { ProfileRepository } from '@services/firestore/profile.repository';
import { fakeDocSnap, fakeQuerySnap } from '@tests/support/firestore-plans.fake';

jest.mock('firebase/firestore', () =>
  jest.requireActual('@tests/support/firestore-plans.fake').createFirestoreMock()
);

const profile = { uid: 'u1', email: 'a@b.c' } as unknown as Profile;

describe('ProfileRepository', () => {
  let repo: ProfileRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    [getDoc, getDocs, setDoc, addDoc, updateDoc].forEach((m) => (m as jest.Mock).mockReset());
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: FirestoreConnection, useValue: { db: {} } }],
    });
    repo = TestBed.inject(ProfileRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getProfile', () => {
    it('lee Users/<uid> y devuelve los datos del perfil', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('u1', profile));

      const result = await repo.getProfile('u1');

      expect(getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'Users/u1' }));
      expect(result).toBe(profile);
    });

    it('devuelve null si el usuario no existe', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('u1', undefined));

      await expect(repo.getProfile('u1')).resolves.toBeNull();
    });
  });

  describe('createProfile', () => {
    it('escribe el perfil en Users/<uid>', async () => {
      await repo.createProfile(profile);

      expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'Users/u1' }), profile);
    });
  });

  describe('updateProfile', () => {
    it('falla si nunca se leyó un perfil (no hay documento al que escribir)', async () => {
      await expect(repo.updateProfile({ nickname: 'x' } as Partial<Profile>)).rejects.toThrow(
        'No profileDocRef'
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('actualiza el documento del último getProfile con solo los cambios', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('u1', profile));
      await repo.getProfile('u1');
      const changes = { nickname: 'nuevo' } as Partial<Profile>;

      await repo.updateProfile(changes);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Users/u1' }),
        changes
      );
    });

    it('escribe sobre el perfil leído más recientemente', async () => {
      (getDoc as jest.Mock).mockResolvedValue(fakeDocSnap('x', profile));
      await repo.getProfile('u1');
      await repo.getProfile('u2');

      await repo.updateProfile({} as Partial<Profile>);

      expect((updateDoc as jest.Mock).mock.calls[0][0].path).toBe('Users/u2');
    });
  });

  describe('checkNickname', () => {
    it('consulta nickNames por nickname exacto', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await repo.checkNickname('torre');

      expect(getDocs).toHaveBeenCalledWith({
        type: 'query',
        collection: 'nickNames',
        constraints: [{ type: 'where', field: 'nickname', op: '==', value: 'torre' }],
      });
    });

    it('devuelve vacío si el apodo está libre', async () => {
      (getDocs as jest.Mock).mockResolvedValue(fakeQuerySnap([]));

      await expect(repo.checkNickname('torre')).resolves.toEqual([]);
    });

    it('devuelve un elemento por cada reserva existente del apodo', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        fakeQuerySnap([{ id: 'n1', data: { nickname: 'torre', uidUser: 'u1' } }])
      );

      const result = await repo.checkNickname('torre');

      expect(result).toHaveLength(1);
    });
  });

  describe('addNewNickName', () => {
    it('reserva el apodo en nickNames con el uid del dueño y devuelve el id creado', async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: 'nick-1' });

      const id = await repo.addNewNickName('torre', 'u1');

      expect(addDoc).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'nickNames' }),
        { nickname: 'torre', uidUser: 'u1' }
      );
      expect(id).toBe('nick-1');
    });
  });
});
