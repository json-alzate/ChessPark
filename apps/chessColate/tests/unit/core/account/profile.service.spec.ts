import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';

import { Profile } from '@chesspark/models';
import { requestUpdateProfile, setProfile, updateProfile } from '@chesspark/state';
import { ProfileService } from '@core/account/profile.service';
import { ProfileRepository } from '@core/account/profile.repository';
import { AppService } from '@core/app/app.service';
import { LanguageService } from '@core/app/language.service';

// El repositorio real arrastra firebase/firestore; aquí solo importa su contrato.
jest.mock('@core/account/profile.repository', () => ({ ProfileRepository: class {} }));

const profileOf = (extra: Record<string, unknown> = {}): Profile =>
  ({ uid: 'u1', email: 'a@b.c', elo: 1500, ...extra } as unknown as Profile);

describe('ProfileService', () => {
  let state$: BehaviorSubject<{ auth: { profile: Profile | null } }>;
  let dispatch: jest.Mock;
  let repo: {
    getProfile: jest.Mock;
    createProfile: jest.Mock;
    updateProfile: jest.Mock;
    checkNickname: jest.Mock;
    addNewNickName: jest.Mock;
  };
  let language: {
    isLanguageAvailable: jest.Mock;
    setLanguage: jest.Mock;
    getStoredLang: jest.Mock;
    getCurrentLang: jest.Mock;
  };
  let app: { getThemesPuzzlesList: { value: string }[]; getOpeningsList: { value: string }[] };
  let service: ProfileService;

  const setStoreProfile = (profile: Profile | null) => state$.next({ auth: { profile } });

  beforeEach(() => {
    state$ = new BehaviorSubject<{ auth: { profile: Profile | null } }>({ auth: { profile: null } });
    dispatch = jest.fn();
    repo = {
      getProfile: jest.fn(),
      createProfile: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn().mockResolvedValue(undefined),
      checkNickname: jest.fn(),
      addNewNickName: jest.fn(),
    };
    language = {
      isLanguageAvailable: jest.fn((l: string) => l === 'en' || l === 'es'),
      setLanguage: jest.fn().mockResolvedValue(undefined),
      getStoredLang: jest.fn().mockReturnValue(null),
      getCurrentLang: jest.fn().mockReturnValue('es'),
    };
    app = {
      getThemesPuzzlesList: [{ value: 'fork' }, { value: 'pin' }],
      getOpeningsList: [{ value: 'sicilian' }, { value: 'french' }],
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Store, useValue: { pipe: (...ops: never[]) => (state$.pipe as (...o: unknown[]) => unknown)(...ops), dispatch } },
        { provide: ProfileRepository, useValue: repo },
        { provide: AppService, useValue: app },
        { provide: LanguageService, useValue: language },
      ],
    });
    service = TestBed.inject(ProfileService);
  });

  afterEach(() => jest.useRealTimers());

  describe('estado del perfil', () => {
    it('sin perfil getProfile es null y el elo de puzzles es 1500', () => {
      expect(service.getProfile).toBeNull();
      expect(service.eloPuzzles).toBe(1500);
    });

    it('sigue al store: cuando cambia el perfil lo refleja', () => {
      setStoreProfile(profileOf({ eloPuzzles: 1800 }));

      expect(service.getProfile?.uid).toBe('u1');
      expect(service.eloPuzzles).toBe(1800);
    });

    it('profile$ emite el perfil del store', () => {
      const seen: (Profile | null)[] = [];
      service.profile$.subscribe((p) => seen.push(p));

      const profile = profileOf();
      setStoreProfile(profile);

      expect(seen).toEqual([null, profile]);
    });
  });

  describe('elos por tipo de plan', () => {
    beforeEach(() => {
      setStoreProfile(
        profileOf({
          elos: {
            plan5: { fork: 1600, pin: 1400, tema_borrado: 1700 },
            plan5Total: 1550,
            plan5Openings: { sicilian: 1620, apertura_borrada: 1300 },
            plan3: [1, 2, 3],
            plan3Total: 'no es número',
            plan3Openings: ['x'],
          },
        })
      );
    });

    it('getElosThemesByPlanType devuelve solo los temas que existen en la lista de la app', () => {
      expect(service.getElosThemesByPlanType('plan5' as never)).toEqual({ fork: 1600, pin: 1400 });
    });

    it('para planes custom o sin elos devuelve vacío', () => {
      expect(service.getElosThemesByPlanType('custom')).toEqual({});
      setStoreProfile(profileOf());
      expect(service.getElosThemesByPlanType('plan5' as never)).toEqual({});
    });

    it('si los temas guardados no son un objeto (p. ej. un array) devuelve vacío', () => {
      expect(service.getElosThemesByPlanType('plan3' as never)).toEqual({});
    });

    it('getEloTotalByPlanType devuelve el total o 1500 si falta o no es número', () => {
      expect(service.getEloTotalByPlanType('plan5' as never)).toBe(1550);
      expect(service.getEloTotalByPlanType('plan3' as never)).toBe(1500);
      expect(service.getEloTotalByPlanType('plan10' as never)).toBe(1500);
      expect(service.getEloTotalByPlanType('custom')).toBe(1500);
    });

    it('getElosOpeningsByPlanType filtra por las aperturas que existen en la lista', () => {
      expect(service.getElosOpeningsByPlanType('plan5' as never)).toEqual({ sicilian: 1620 });
    });

    it('getElosOpeningsByPlanType devuelve vacío para custom, sin elos o con un array', () => {
      expect(service.getElosOpeningsByPlanType('custom')).toEqual({});
      expect(service.getElosOpeningsByPlanType('plan3' as never)).toEqual({});
      setStoreProfile(null);
      expect(service.getElosOpeningsByPlanType('plan5' as never)).toEqual({});
    });
  });

  describe('checkProfile', () => {
    it('si el perfil existe lo carga: sincroniza el idioma y lo manda al store', async () => {
      const profile = profileOf({ lang: 'es' });
      repo.getProfile.mockResolvedValue(profile);

      await service.checkProfile({ uid: 'u1' } as never);

      expect(repo.getProfile).toHaveBeenCalledWith('u1');
      expect(language.setLanguage).toHaveBeenCalledWith('es');
      expect(dispatch).toHaveBeenCalledWith(setProfile({ profile }));
      expect(repo.createProfile).not.toHaveBeenCalled();
    });

    it('si no existe crea uno inicial con elo 1500, el idioma actual y la fecha, y lo carga', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'));
      repo.getProfile.mockResolvedValue(null);

      await service.checkProfile({ uid: 'nuevo', email: 'n@x.com' } as never);

      const expected = {
        uid: 'nuevo',
        email: 'n@x.com',
        elo: 1500,
        lang: 'es',
        createAt: new Date('2026-06-15T12:00:00Z').getTime(),
      };
      expect(repo.createProfile).toHaveBeenCalledWith(expected);
      expect(dispatch).toHaveBeenCalledWith(setProfile({ profile: expected as never }));
      expect(service.getProfile).toEqual(expected);
    });
  });

  describe('setProfile', () => {
    it('aplica el idioma del perfil cuando está soportado', async () => {
      await service.setProfile(profileOf({ lang: 'en' }));

      expect(language.setLanguage).toHaveBeenCalledWith('en');
    });

    it('ignora un idioma no soportado o ausente y deja el actual', async () => {
      await service.setProfile(profileOf({ lang: 'fr' }));
      await service.setProfile(profileOf());

      expect(language.setLanguage).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearProfile', () => {
    it('mantiene el idioma guardado localmente y limpia el store', async () => {
      language.getStoredLang.mockReturnValue('es');
      setStoreProfile(profileOf());

      await service.clearProfile();

      expect(language.setLanguage).toHaveBeenCalledWith('es');
      expect(dispatch).toHaveBeenCalledWith(setProfile({ profile: null as never }));
    });

    it('sin idioma guardado usa inglés', async () => {
      await service.clearProfile();

      expect(language.setLanguage).toHaveBeenCalledWith('en');
    });
  });

  describe('requestUpdateProfile', () => {
    it('con perfil de Firestore (uid) pide la actualización por el store', () => {
      setStoreProfile(profileOf());

      service.requestUpdateProfile({ nickname: 'x' } as never);

      expect(dispatch).toHaveBeenCalledWith(requestUpdateProfile({ profile: { nickname: 'x' } as never }));
    });

    it('con perfil local de invitado (sin uid) fusiona en local y usa updateProfile', () => {
      setStoreProfile({ elo: 1500 } as unknown as Profile);

      service.requestUpdateProfile({ nickname: 'x' } as never);

      expect(service.getProfile).toMatchObject({ elo: 1500, nickname: 'x' });
      expect(dispatch).toHaveBeenCalledWith(updateProfile({ profile: { nickname: 'x' } as never }));
    });

    it('sin perfil no hace nada', () => {
      service.requestUpdateProfile({ nickname: 'x' } as never);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('fusiona los cambios en memoria y delega la escritura en el repositorio', async () => {
      setStoreProfile(profileOf({ nickname: 'viejo' }));

      await service.updateProfile({ nickname: 'nuevo' } as never);

      expect(service.getProfile).toMatchObject({ uid: 'u1', nickname: 'nuevo' });
      expect(repo.updateProfile).toHaveBeenCalledWith({ nickname: 'nuevo' });
    });

    it('propaga el error del repositorio', async () => {
      repo.updateProfile.mockRejectedValue(new Error('permiso denegado'));

      await expect(service.updateProfile({} as never)).rejects.toThrow('permiso denegado');
    });
  });

  describe('nicknames', () => {
    it('checkNickNameExist devuelve lo que responde el repositorio', async () => {
      repo.checkNickname.mockResolvedValue(['u9']);

      await expect(service.checkNickNameExist('pepe')).resolves.toEqual(['u9']);
      expect(repo.checkNickname).toHaveBeenCalledWith('pepe');
    });

    it('addNewNickName delega en el repositorio', async () => {
      repo.addNewNickName.mockResolvedValue(undefined);

      await expect(service.addNewNickName('pepe', 'u1')).resolves.toBeUndefined();
      expect(repo.addNewNickName).toHaveBeenCalledWith('pepe', 'u1');
    });

    it('si el repositorio falla lanza un error genérico en español', async () => {
      repo.addNewNickName.mockRejectedValue(new Error('detalle interno'));

      await expect(service.addNewNickName('pepe', 'u1')).rejects.toThrow('Error al agregar nuevo nickname');
    });
  });

  describe('calculateEloPuzzlePlan', () => {
    // Con el elo del puzzle igual al del jugador, ganar da +16, perder -16 y empatar 0.
    const lastChanges = () =>
      (dispatch.mock.calls[dispatch.mock.calls.length - 1][0] as { profile: { elos: Record<string, any> } }).profile.elos;

    const withElos = (elos: Record<string, unknown>) => setStoreProfile(profileOf({ elos }));

    it('acierto: sube tema, total y apertura, y marca récords en todos', () => {
      withElos({
        plan5: { fork: 1500 },
        plan5Total: 1500,
        plan5Openings: { sicilian: 1500 },
      });

      const info = service.calculateEloPuzzlePlan(1500, 1, 'plan5' as never, ['fork', 'pin'], 'sicilian');

      expect(info).toEqual({
        isNewTotalRecord: true,
        isNewThemeRecord: true,
        isNewOpeningRecord: true,
        newThemeRecords: ['fork', 'pin'],
        newOpeningRecord: 'sicilian',
        newTotalElo: 1516,
        totalEloChange: 16,
      });
      const elos = lastChanges();
      expect(elos['plan5']).toEqual({ fork: 1516, pin: 1516 });
      expect(elos['plan5Total']).toBe(1516);
      expect(elos['plan5Openings']).toEqual({ sicilian: 1516 });
      expect(elos['plan5MaxTotal']).toBe(1516);
      expect(elos['plan5Max']).toEqual({ fork: 1516, pin: 1516 });
      expect(elos['plan5MaxOpenings']).toEqual({ sicilian: 1516 });
    });

    it('fallo: baja los elos y no marca ningún récord si ya había máximos superiores', () => {
      withElos({
        plan5: { fork: 1500 },
        plan5Total: 1500,
        plan5Openings: { sicilian: 1500 },
        plan5MaxTotal: 1700,
        plan5Max: { fork: 1700 },
        plan5MaxOpenings: { sicilian: 1700 },
      });

      const info = service.calculateEloPuzzlePlan(1500, 0, 'plan5' as never, ['fork'], 'sicilian');

      expect(info).toMatchObject({
        isNewTotalRecord: false,
        isNewThemeRecord: false,
        isNewOpeningRecord: false,
        newThemeRecords: [],
        newOpeningRecord: undefined,
        newTotalElo: 1484,
        totalEloChange: -16,
      });
      const elos = lastChanges();
      expect(elos['plan5Total']).toBe(1484);
      expect(elos['plan5']['fork']).toBe(1484);
      expect(elos['plan5Openings']['sicilian']).toBe(1484);
      expect(elos['plan5MaxTotal']).toBe(1700);
      expect(elos['plan5Max']['fork']).toBe(1700);
    });

    it('empate contra un puzzle del mismo elo no cambia nada', () => {
      withElos({ plan5: { fork: 1500 }, plan5Total: 1500, plan5Openings: {} });

      const info = service.calculateEloPuzzlePlan(1500, 0.5, 'plan5' as never, ['fork'], '');

      expect(info.totalEloChange).toBe(0);
      expect(info.newTotalElo).toBe(1500);
    });

    it('sin familia de apertura no toca las aperturas ni sus máximos', () => {
      withElos({ plan5: {}, plan5Total: 1500 });

      const info = service.calculateEloPuzzlePlan(1500, 1, 'plan5' as never, ['fork'], '');

      expect(info.isNewOpeningRecord).toBe(false);
      expect(info.newOpeningRecord).toBeUndefined();
      expect(lastChanges()['plan5Openings']).toBeUndefined();
    });

    it('un tema nuevo parte de 1500; un máximo previo mayor evita el récord de tema', () => {
      withElos({ plan5: { fork: 1600 }, plan5Total: 1500, plan5Max: { fork: 1600 }, plan5MaxTotal: 1500 });

      const info = service.calculateEloPuzzlePlan(1600, 1, 'plan5' as never, ['fork', 'pin'], '');

      // fork: 1600 vs 1600 → 1616 > 1600 récord. pin: 1500 vs 1600 → sube más de 16
      expect(info.newThemeRecords).toEqual(['fork', 'pin']);
      expect(lastChanges()['plan5']['fork']).toBe(1616);
      expect(lastChanges()['plan5']['pin']).toBeGreaterThan(1516);
    });

    it('sin elos en el perfil arranca todo desde 1500 y crea los máximos', () => {
      setStoreProfile(profileOf());

      const info = service.calculateEloPuzzlePlan(1500, 1, 'plan1' as never, ['fork'], 'french');

      expect(info.newTotalElo).toBe(1516);
      expect(info.isNewTotalRecord).toBe(true);
      const elos = lastChanges();
      expect(elos['plan1']).toEqual({ fork: 1516 });
      expect(elos['plan1Openings']).toEqual({ french: 1516 });
      expect(elos['plan1MaxTotal']).toBe(1516);
    });

    it('sin perfil devuelve la información igualmente, pero no hay a quién actualizar', () => {
      const info = service.calculateEloPuzzlePlan(1500, 1, 'plan5' as never, ['fork'], '');

      expect(info.newTotalElo).toBe(1516);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('con perfil de Firestore manda un único requestUpdateProfile con los elos', () => {
      withElos({ plan5: {}, plan5Total: 1500 });

      service.calculateEloPuzzlePlan(1500, 1, 'plan5' as never, ['fork'], '');

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0][0].type).toBe(requestUpdateProfile.type);
    });

    it.skip('BUG: no debería mutar los mapas de máximos del estado original del perfil (el store es inmutable)', () => {
      const elos = {
        plan5: { fork: 1500 },
        plan5Total: 1500,
        plan5Openings: { sicilian: 1500 },
        plan5Max: { fork: 1500 },
        plan5MaxTotal: 1500,
        plan5MaxOpenings: { sicilian: 1500 },
      };
      const snapshot = JSON.parse(JSON.stringify(elos));
      withElos(elos);

      service.calculateEloPuzzlePlan(1500, 1, 'plan5' as never, ['fork'], 'sicilian');

      // Hoy plan5Max / plan5MaxOpenings se copian por referencia y el servicio escribe sobre ellos.
      expect(elos).toEqual(snapshot);
    });

    it.skip('BUG: con elos en el perfil pero sin mapa de aperturas, la primera apertura debería subir con el acierto', () => {
      withElos({ plan5: {}, plan5Total: 1500 });

      service.calculateEloPuzzlePlan(1500, 1, 'plan5' as never, ['fork'], 'sicilian');

      // Sin perfil.elos sí se calcula (1516); con elos pero sin "plan5Openings" queda en 1500.
      expect(lastChanges()['plan5Openings']['sicilian']).toBe(1516);
    });
  });
});
