import { TestBed } from '@angular/core/testing';
import { Platform } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { logOut, setErrorRegister, setInitialized } from '@chesspark/state';
import { AuthService } from '@core/account/auth.service';

const mockNative = { value: false };
const mockFb = {
  getAuth: jest.fn(),
  initializeAuth: jest.fn(),
  getApp: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  credential: jest.fn(),
  nativeGoogle: jest.fn(),
};

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative.value },
}));
jest.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithGoogle: () => mockFb.nativeGoogle() },
}));
jest.mock('firebase/app', () => ({ getApp: () => mockFb.getApp() }));
jest.mock('firebase/auth', () => ({
  indexedDBLocalPersistence: 'INDEXED_DB',
  GoogleAuthProvider: class {
    static credential(token: string) {
      return mockFb.credential(token);
    }
  },
  getAuth: () => mockFb.getAuth(),
  initializeAuth: (app: unknown, opts: unknown) => mockFb.initializeAuth(app, opts),
  signInWithPopup: (a: unknown, p: unknown) => mockFb.signInWithPopup(a, p),
  signInWithEmailAndPassword: (a: unknown, e: string, p: string) => mockFb.signInWithEmailAndPassword(a, e, p),
  sendPasswordResetEmail: (a: unknown, e: string) => mockFb.sendPasswordResetEmail(a, e),
  createUserWithEmailAndPassword: (a: unknown, e: string, p: string) =>
    mockFb.createUserWithEmailAndPassword(a, e, p),
  signInWithCredential: (a: unknown, c: unknown) => mockFb.signInWithCredential(a, c),
}));

describe('AuthService', () => {
  let service: AuthService;
  let dispatch: jest.Mock;
  let isCapacitor: boolean;
  let fakeAuth: { onAuthStateChanged: jest.Mock; signOut: jest.Mock };

  beforeEach(() => {
    mockNative.value = false;
    isCapacitor = false;
    Object.values(mockFb).forEach((fn) => fn.mockReset());
    fakeAuth = { onAuthStateChanged: jest.fn(), signOut: jest.fn().mockResolvedValue(undefined) };
    mockFb.getAuth.mockReturnValue(fakeAuth);
    mockFb.initializeAuth.mockReturnValue(fakeAuth);
    mockFb.getApp.mockReturnValue('APP');
    dispatch = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: Platform, useValue: { is: (name: string) => name === 'capacitor' && isCapacitor } },
        { provide: Store, useValue: { dispatch } },
        { provide: TranslocoService, useValue: { translate: (key: string) => `t:${key}` } },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('setAuth', () => {
    it('en web usa getAuth', () => {
      expect(service.setAuth()).toBe(fakeAuth);
      expect(mockFb.getAuth).toHaveBeenCalled();
      expect(mockFb.initializeAuth).not.toHaveBeenCalled();
    });

    it('en nativo inicializa auth con persistencia en IndexedDB', () => {
      mockNative.value = true;

      expect(service.setAuth()).toBe(fakeAuth);
      expect(mockFb.initializeAuth).toHaveBeenCalledWith('APP', { persistence: 'INDEXED_DB' });
      expect(mockFb.getAuth).not.toHaveBeenCalled();
    });
  });

  describe('acciones del store', () => {
    it('markAsInitialized marca el estado como inicializado', () => {
      service.markAsInitialized();

      expect(dispatch).toHaveBeenCalledWith(setInitialized({ isInitialized: true }));
    });

    it('triggerLogout lanza la acción logOut', () => {
      service.triggerLogout();

      expect(dispatch).toHaveBeenCalledWith(logOut());
    });
  });

  describe('getAuthState', () => {
    it('emite cada cambio de usuario que notifica Firebase', () => {
      service.init();
      const seen: unknown[] = [];

      const state$ = service.getAuthState();
      state$.subscribe((u) => seen.push(u));
      const callback = fakeAuth.onAuthStateChanged.mock.calls[0][0];
      callback({ uid: 'u1' });
      callback(null);

      expect(seen).toEqual([{ uid: 'u1' }, null]);
    });
  });

  describe('email y contraseña', () => {
    it('signInWithEmailAndPassword delega en Firebase con el auth actual', async () => {
      mockFb.signInWithEmailAndPassword.mockResolvedValue({ user: 'u' });

      await expect(service.signInWithEmailAndPassword('a@b.c', 'pw')).resolves.toEqual({ user: 'u' });
      expect(mockFb.signInWithEmailAndPassword).toHaveBeenCalledWith(fakeAuth, 'a@b.c', 'pw');
    });

    it('si el login falla propaga el error de Firebase', async () => {
      mockFb.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

      await expect(service.signInWithEmailAndPassword('a@b.c', 'mal')).rejects.toEqual({
        code: 'auth/wrong-password',
      });
    });

    it('sendPasswordResetEmail delega en Firebase', async () => {
      mockFb.sendPasswordResetEmail.mockResolvedValue(undefined);

      await service.sendPasswordResetEmail('a@b.c');

      expect(mockFb.sendPasswordResetEmail).toHaveBeenCalledWith(fakeAuth, 'a@b.c');
    });

    it('createUserWithEmailAndPassword devuelve la credencial cuando todo sale bien', async () => {
      mockFb.createUserWithEmailAndPassword.mockResolvedValue({ user: 'nuevo' });

      await expect(service.createUserWithEmailAndPassword('a@b.c', 'pw')).resolves.toEqual({ user: 'nuevo' });
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('con email ya registrado manda al store el mensaje específico y relanza el error', async () => {
      const error = { code: 'auth/email-already-in-use' };
      mockFb.createUserWithEmailAndPassword.mockRejectedValue(error);

      await expect(service.createUserWithEmailAndPassword('a@b.c', 'pw')).rejects.toBe(error);

      expect(dispatch).toHaveBeenCalledWith(setErrorRegister({ error: 't:AUTH.errors.emailInUse' }));
    });

    it('con cualquier otro error manda el mensaje genérico de registro y relanza', async () => {
      const error = { code: 'auth/weak-password' };
      mockFb.createUserWithEmailAndPassword.mockRejectedValue(error);

      await expect(service.createUserWithEmailAndPassword('a@b.c', '1')).rejects.toBe(error);

      expect(dispatch).toHaveBeenCalledWith(setErrorRegister({ error: 't:AUTH.errors.registerError' }));
    });
  });

  describe('logout', () => {
    it('cierra sesión en Firebase y completa', async () => {
      service.init();

      await firstValueFrom(service.logout());

      expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    });

    it('si signOut falla, el observable emite el error', async () => {
      service.init();
      fakeAuth.signOut.mockRejectedValue(new Error('sin red'));

      await expect(firstValueFrom(service.logout())).rejects.toThrow('sin red');
    });
  });

  describe('loginGoogle', () => {
    beforeEach(() => service.init());

    it('en web abre el popup de Google con el auth del servicio', async () => {
      mockFb.signInWithPopup.mockResolvedValue({ user: 'web' });

      await expect(service.loginGoogle()).resolves.toEqual({ user: 'web' });

      expect(mockFb.signInWithPopup).toHaveBeenCalledWith(fakeAuth, expect.anything());
      expect(mockFb.nativeGoogle).not.toHaveBeenCalled();
    });

    it('en web propaga el error si se cierra o falla el popup', async () => {
      mockFb.signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

      await expect(service.loginGoogle()).rejects.toEqual({ code: 'auth/popup-closed-by-user' });
    });

    it('en capacitor pide el token a la capa nativa y entra en la web con esa credencial', async () => {
      isCapacitor = true;
      mockFb.nativeGoogle.mockResolvedValue({ credential: { idToken: 'TOKEN' } });
      mockFb.credential.mockReturnValue('CRED');
      mockFb.signInWithCredential.mockResolvedValue({ user: 'nativo' });

      await expect(service.loginGoogle()).resolves.toEqual({ user: 'nativo' });

      expect(mockFb.credential).toHaveBeenCalledWith('TOKEN');
      expect(mockFb.signInWithCredential).toHaveBeenCalledWith(fakeAuth, 'CRED');
      expect(mockFb.signInWithPopup).not.toHaveBeenCalled();
    });

    it('en capacitor, si la capa nativa falla devuelve null sin lanzar ni entrar en Firebase', async () => {
      isCapacitor = true;
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      mockFb.nativeGoogle.mockRejectedValue(new Error('cancelado'));

      await expect(service.loginGoogle()).resolves.toBeNull();

      expect(mockFb.signInWithCredential).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();
    });
  });
});
