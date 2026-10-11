import { TestBed } from '@angular/core/testing';

import { Profile, Reto333Record, StreakRecord, UserRecords } from '@chesspark/models';

import { ProfileService } from '@services/account/profile.service';
import { StreakStorageService } from '@features/records/services/streak-storage.service';
import { UserRecordsService } from '@features/records/services/user-records.service';
import { Reto333StorageService } from '@features/records/services/reto333-storage.service';

import { makeStreakRecord } from '@tests/support/partidas-progreso-fixtures';

const reto = (overrides: Partial<Reto333Record> = {}): Reto333Record => ({
  lastScore: 40,
  bestScore: 120,
  maxElo: 700,
  lastTime: 600,
  timeString: '10m 0s',
  completed: false,
  lastPlayedAt: 2_000,
  ...overrides,
});

describe('UserRecordsService', () => {
  let service: UserRecordsService;
  let streakStorage: StreakStorageService;
  let retoStorage: Reto333StorageService;

  /** Doble del perfil: `getProfile` es un getter en el servicio real. */
  const profileService = {
    getProfile: null as Profile | null,
    requestUpdateProfile: jest.fn(),
  };

  const setProfile = (uid: string | null, records?: UserRecords) => {
    profileService.getProfile = uid
      ? ({ uid, records } as unknown as Profile)
      : null;
  };

  /** Lo último que se mandó a escribir en el perfil. */
  const writtenRecords = (): UserRecords => {
    const calls = profileService.requestUpdateProfile.mock.calls;
    return calls[calls.length - 1][0].records;
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    profileService.getProfile = null;

    TestBed.configureTestingModule({
      providers: [
        UserRecordsService,
        { provide: ProfileService, useValue: profileService },
      ],
    });
    service = TestBed.inject(UserRecordsService);
    streakStorage = TestBed.inject(StreakStorageService);
    retoStorage = TestBed.inject(Reto333StorageService);
  });

  describe('syncFromProfile', () => {
    it('sin sesión no hace nada: ni escribe en el perfil ni toca lo local', async () => {
      streakStorage.setRecord(makeStreakRecord({ bestScore: 5, runsPlayed: 1 }));
      retoStorage.setRecord(reto());
      const streakBefore = streakStorage.getRecord();
      const retoBefore = retoStorage.getRecord();

      await service.syncFromProfile();

      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
      expect(streakStorage.getRecord()).toEqual(streakBefore);
      expect(retoStorage.getRecord()).toEqual(retoBefore);
      expect(retoBefore).not.toBeNull();
    });

    it('lo jugado como invitado se adopta al iniciar sesión: se firma con el uid y se sube', async () => {
      streakStorage.setRecord(makeStreakRecord({ bestScore: 5, runsPlayed: 2, lastPlayedAt: 100 }));
      retoStorage.setRecord(reto({ bestScore: 50 }));
      setProfile('u1', {});

      await service.syncFromProfile();

      expect(streakStorage.getRecord()).toMatchObject({ uidUser: 'u1', bestScore: 5, runsPlayed: 2 });
      expect(retoStorage.getRecord()).toMatchObject({ uidUser: 'u1', bestScore: 50 });
      expect(writtenRecords().streak).toMatchObject({ uidUser: 'u1', bestScore: 5 });
      expect(writtenRecords().reto333).toMatchObject({ uidUser: 'u1', bestScore: 50 });
    });

    it('fusiona campo a campo: mejor marca del lado que más tiene y último intento del más reciente', async () => {
      streakStorage.setRecord(
        makeStreakRecord({
          uidUser: 'u1',
          bestScore: 10,
          bestRunUid: 'local',
          runsPlayed: 4,
          lastScore: 2,
          lastPlayedAt: 3_000,
        })
      );
      setProfile('u1', {
        streak: makeStreakRecord({
          uidUser: 'u1',
          bestScore: 15,
          bestRunUid: 'nube',
          runsPlayed: 6,
          lastScore: 9,
          lastPlayedAt: 1_000,
        }),
      });

      await service.syncFromProfile();

      const expected = {
        uidUser: 'u1',
        bestScore: 15,
        bestRunUid: 'nube',
        achievedAt: 0,
        runsPlayed: 6, // el mayor, no la suma
        lastScore: 2, // el intento local es más reciente
        lastPlayedAt: 3_000,
      };
      expect(streakStorage.getRecord()).toEqual(expected);
      expect(writtenRecords().streak).toEqual(expected);
    });

    it('no escribe en Firestore si la fusión coincide con lo que ya tiene el perfil', async () => {
      const streak: StreakRecord = makeStreakRecord({
        uidUser: 'u1',
        bestScore: 10,
        bestRunUid: 'r',
        runsPlayed: 3,
        lastScore: 4,
        lastPlayedAt: 500,
      });
      const retoRecord = reto({ uidUser: 'u1' });
      streakStorage.setRecord(streak);
      retoStorage.setRecord(retoRecord);
      setProfile('u1', { streak, reto333: retoRecord });

      await service.syncFromProfile();

      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
    });

    it('si la nube va por delante, copia su récord al dispositivo sin reescribirla', async () => {
      const remoteStreak = makeStreakRecord({
        uidUser: 'u1',
        bestScore: 30,
        bestRunUid: 'nube',
        runsPlayed: 9,
        lastScore: 7,
        lastPlayedAt: 800,
      });
      setProfile('u1', { streak: remoteStreak });

      await service.syncFromProfile();

      expect(streakStorage.getRecord()).toEqual(remoteStreak);
      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
    });

    it('descarta el récord local de otra cuenta y se queda con el del perfil', async () => {
      streakStorage.setRecord(
        makeStreakRecord({ uidUser: 'otro', bestScore: 99, runsPlayed: 50, lastPlayedAt: 9_000 })
      );
      retoStorage.setRecord(reto({ uidUser: 'otro', bestScore: 300 }));
      const remoteStreak = makeStreakRecord({
        uidUser: 'u1',
        bestScore: 6,
        bestRunUid: 'mia',
        runsPlayed: 2,
        lastPlayedAt: 10,
      });
      setProfile('u1', { streak: remoteStreak });

      await service.syncFromProfile();

      expect(streakStorage.getRecord()).toEqual(remoteStreak);
      // El Reto 333 ajeno se borra del dispositivo: la cuenta no tiene ninguno propio
      expect(retoStorage.getRecord()).toBeNull();
    });

    it('si el récord local es de otra cuenta y esta no tiene nada, se limpia sin escribir en la nube', async () => {
      streakStorage.setRecord(
        makeStreakRecord({ uidUser: 'otro', bestScore: 99, runsPlayed: 50 })
      );
      retoStorage.setRecord(reto({ uidUser: 'otro' }));
      setProfile('u1', {});

      await service.syncFromProfile();

      expect(streakStorage.getRecord()).toEqual(
        makeStreakRecord({ uidUser: 'u1' })
      );
      expect(retoStorage.getRecord()).toBeNull();
      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
    });

    it('sin datos en ningún lado no escribe nada', async () => {
      setProfile('u1', undefined);

      await service.syncFromProfile();

      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
      expect(localStorage.getItem('chessColate_streak_record')).toBeNull();
    });

    it('al subir un récord conserva el otro que ya tenía el perfil (Firestore reemplaza el mapa entero)', async () => {
      const remoteReto = reto({ uidUser: 'u1', bestScore: 200 });
      streakStorage.setRecord(makeStreakRecord({ bestScore: 5, runsPlayed: 1 }));
      setProfile('u1', { reto333: remoteReto });

      await service.syncFromProfile();

      expect(writtenRecords().reto333).toEqual(remoteReto);
      expect(writtenRecords().streak).toMatchObject({ bestScore: 5, uidUser: 'u1' });
    });

    it('lo que se sube no lleva claves undefined (Firestore las rechaza)', async () => {
      // La marca guardada sin dueño se normaliza con uidUser: undefined
      retoStorage.setRecord({ ...reto(), uidUser: undefined });
      setProfile('u1', {});

      await service.syncFromProfile();

      const written = writtenRecords().reto333 as unknown as Record<string, unknown>;
      expect(Object.values(written)).not.toContain(undefined);
      expect(written['uidUser']).toBe('u1');
    });
  });

  describe('push', () => {
    it('sin sesión no sube nada', () => {
      streakStorage.setRecord(makeStreakRecord({ bestScore: 3, runsPlayed: 1 }));

      service.push();

      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
    });

    it('sube al perfil los dos récords del dispositivo firmados con el uid', () => {
      streakStorage.setRecord(makeStreakRecord({ bestScore: 8, runsPlayed: 2 }));
      retoStorage.setRecord(reto({ bestScore: 77 }));
      setProfile('u1', {});

      service.push();

      expect(profileService.requestUpdateProfile).toHaveBeenCalledTimes(1);
      expect(writtenRecords().streak).toMatchObject({ bestScore: 8, uidUser: 'u1' });
      expect(writtenRecords().reto333).toMatchObject({ bestScore: 77, uidUser: 'u1' });
    });

    it('un récord de racha vacío no se sube, pero se conserva el que ya tenía el perfil', () => {
      const remoteStreak = makeStreakRecord({ uidUser: 'u1', bestScore: 12, runsPlayed: 4 });
      retoStorage.setRecord(reto());
      setProfile('u1', { streak: remoteStreak });

      service.push();

      expect(writtenRecords().streak).toEqual(remoteStreak);
      expect(writtenRecords().reto333).toBeDefined();
    });

    it('si no hay nada que subir (ni local ni en el perfil) no escribe', () => {
      setProfile('u1', {});

      service.push();

      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
    });
  });
});
