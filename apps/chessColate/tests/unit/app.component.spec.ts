// Firebase real no se inicializa en pruebas, y el entorno (con llaves privadas
// que no están en el repositorio) se sustituye por valores fijos y mutables.
jest.mock('firebase/app', () => ({ initializeApp: jest.fn() }));
jest.mock('@environments/environment', () => ({
  environment: {
    production: false,
    firebase: { projectId: 'test' },
    version: '9.9.9',
    analyticsEnabled: true,
    crashlyticsEnabled: false,
    revenueCatApiKeyWeb: '',
    revenueCatApiKeyIos: '',
    revenueCatApiKeyAndroid: '',
  },
}));

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { IonIcon, IonMenu, IonMenuToggle, IonRouterOutlet, MenuController, ModalController } from '@ionic/angular/standalone';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { RevenueCatService } from '@chesspark/revenuecat';
import { Profile } from '@chesspark/models';

import { AppComponent } from '@app/app.component';
import { AuthService } from '@services/account/auth.service';
import { ProfileService } from '@services/account/profile.service';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { PwaService } from '@services/app/pwa.service';
import { FirestoreConnection } from '@services/firestore/firestore-connection.service';
import { UserRecordsService } from '@services/progress/user-records.service';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { environment } from '@environments/environment';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

type Env = Record<string, unknown>;

/** Deja correr las promesas pendientes (arranque asíncrono de la app). */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { uid: 'u1', name: 'Ana Pérez', email: 'ana@correo.com', ...overrides } as Profile;
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  let routerEvents$: Subject<unknown>;
  let router: { events: Subject<unknown>; navigate: jest.Mock };
  let authState$: Subject<{ uid: string } | null>;
  let profile$: BehaviorSubject<Profile | null>;
  let calls: string[];

  let authService: Record<'init' | 'getAuthState' | 'markAsInitialized' | 'logout', jest.Mock>;
  let profileService: Record<'checkProfile' | 'clearProfile', jest.Mock> & { profile$: BehaviorSubject<Profile | null> };
  let firestore: { init: jest.Mock };
  let revenueCat: Record<'initialize' | 'configure' | 'checkSubscriptionStatus' | 'setLogLevel', jest.Mock>;
  let analytics: Record<'setEnabled' | 'setUserId' | 'logScreenView', jest.Mock>;
  let reminders: { init: jest.Mock };
  let userRecords: { syncFromProfile: jest.Mock };
  let pwa: { isMobileBrowser: boolean; canInstall: jest.Mock; promptInstall: jest.Mock };
  let modalController: { create: jest.Mock };
  let menuController: { close: jest.Mock };
  let modal: { present: jest.Mock };

  async function create() {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await flush();
  }

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (initializeApp as jest.Mock).mockClear();
    calls = [];

    routerEvents$ = new Subject();
    router = { events: routerEvents$, navigate: jest.fn().mockResolvedValue(true) };
    authState$ = new Subject();
    profile$ = new BehaviorSubject<Profile | null>(null);
    modal = { present: jest.fn().mockResolvedValue(undefined) };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    menuController = { close: jest.fn().mockResolvedValue(true) };

    const track = (name: string) => jest.fn().mockImplementation(async () => void calls.push(name));
    authService = {
      init: jest.fn().mockImplementation(() => void calls.push('auth.init')),
      getAuthState: jest.fn().mockReturnValue(authState$),
      markAsInitialized: jest.fn().mockImplementation(() => void calls.push('auth.markAsInitialized')),
      logout: jest.fn().mockReturnValue(of(undefined)),
    };
    profileService = {
      profile$,
      checkProfile: track('profile.checkProfile'),
      clearProfile: track('profile.clearProfile'),
    };
    firestore = { init: track('firestore.init') };
    revenueCat = {
      initialize: track('revenueCat.initialize'),
      configure: track('revenueCat.configure'),
      checkSubscriptionStatus: jest.fn().mockResolvedValue(true),
      setLogLevel: jest.fn(),
    };
    analytics = {
      setEnabled: track('analytics.setEnabled'),
      setUserId: jest.fn().mockImplementation(async (id: string | null) => void calls.push(`analytics.setUserId:${id}`)),
      logScreenView: jest.fn().mockResolvedValue(undefined),
    };
    reminders = { init: track('reminders.init') };
    userRecords = { syncFromProfile: track('userRecords.sync') };
    pwa = { isMobileBrowser: false, canInstall: jest.fn().mockReturnValue(false), promptInstall: jest.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideTranslocoTesting(),
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authService },
        { provide: ProfileService, useValue: profileService },
        { provide: FirestoreConnection, useValue: firestore },
        { provide: PwaService, useValue: pwa },
        { provide: RevenueCatService, useValue: revenueCat },
        { provide: AnalyticsService, useValue: analytics },
        { provide: TrainingReminderService, useValue: reminders },
        { provide: UserRecordsService, useValue: userRecords },
        { provide: ModalController, useValue: modalController },
        { provide: MenuController, useValue: menuController },
      ],
    })
      // El menú y el router-outlet de Ionic necesitan su runtime; aquí interesa la
      // lógica de la app y el contenido que pinta, así que se dejan como etiquetas.
      .overrideComponent(AppComponent, {
        remove: { imports: [IonMenu, IonIcon, IonRouterOutlet, IonMenuToggle] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const env = environment as unknown as Env;
    env['revenueCatApiKeyWeb'] = '';
  });

  it('se crea con el título "chess-colate"', async () => {
    await create();

    expect(component).toBeTruthy();
    expect(component.title).toEqual('chess-colate');
  });

  describe('arranque', () => {
    it('inicializa Firebase, analítica, auth, Firestore y recordatorios, en ese orden', async () => {
      await create();

      expect(initializeApp).toHaveBeenCalledWith({ projectId: 'test' });
      expect(analytics.setEnabled).toHaveBeenCalledWith(true);
      expect(calls.indexOf('analytics.setEnabled')).toBeLessThan(calls.indexOf('auth.init'));
      expect(calls.indexOf('auth.init')).toBeLessThan(calls.indexOf('firestore.init'));
      expect(calls.indexOf('firestore.init')).toBeLessThan(calls.indexOf('reminders.init'));
    });

    it('sin llave de RevenueCat no lo inicializa y sigue arrancando', async () => {
      await create();

      expect(revenueCat.initialize).not.toHaveBeenCalled();
      expect(reminders.init).toHaveBeenCalledTimes(1);
    });

    it('con llave web inicializa RevenueCat con esa llave', async () => {
      (environment as unknown as Env)['revenueCatApiKeyWeb'] = 'rc-web-key';

      await create();

      expect(revenueCat.initialize).toHaveBeenCalledWith('rc-web-key', undefined);
    });

    it('un fallo de RevenueCat no tumba el arranque', async () => {
      (environment as unknown as Env)['revenueCatApiKeyWeb'] = 'rc-web-key';
      revenueCat.initialize.mockRejectedValue(new Error('sin red'));

      await create();

      expect(reminders.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('estado de la sesión', () => {
    it('con usuario: carga el perfil, funde récords, configura RevenueCat, liga analítica y marca la app inicializada', async () => {
      await create();

      authState$.next({ uid: 'u1' });
      await flush();

      expect(profileService.checkProfile).toHaveBeenCalledWith({ uid: 'u1' });
      expect(userRecords.syncFromProfile).toHaveBeenCalledTimes(1);
      expect(revenueCat.configure).toHaveBeenCalledWith('u1');
      expect(revenueCat.checkSubscriptionStatus).toHaveBeenCalledWith('donation');
      expect(analytics.setUserId).toHaveBeenCalledWith('u1');
      // los récords se fusionan ANTES de marcar la app como inicializada
      expect(calls.indexOf('userRecords.sync')).toBeLessThan(calls.indexOf('auth.markAsInitialized'));
      expect(profileService.clearProfile).not.toHaveBeenCalled();
    });

    it('sin usuario: limpia el perfil, desliga la analítica y marca la app inicializada', async () => {
      await create();

      authState$.next(null);
      await flush();

      expect(profileService.clearProfile).toHaveBeenCalledTimes(1);
      expect(analytics.setUserId).toHaveBeenCalledWith(null);
      expect(authService.markAsInitialized).toHaveBeenCalledTimes(1);
      expect(profileService.checkProfile).not.toHaveBeenCalled();
      expect(userRecords.syncFromProfile).not.toHaveBeenCalled();
    });

    it('un fallo al verificar la suscripción no impide terminar de inicializar', async () => {
      revenueCat.checkSubscriptionStatus.mockRejectedValue(new Error('rc'));
      await create();

      authState$.next({ uid: 'u1' });
      await flush();

      expect(authService.markAsInitialized).toHaveBeenCalledTimes(1);
    });
  });

  describe('seguimiento de pantallas', () => {
    it('cada navegación terminada se registra como screen_view con el nombre de la pantalla', async () => {
      await create();

      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));
      routerEvents$.next(new NavigationEnd(2, '/streak', '/streak?x=1'));

      expect(analytics.logScreenView).toHaveBeenCalledTimes(2);
      expect(analytics.logScreenView).toHaveBeenLastCalledWith('Racha');
    });

    it('ignora eventos de router que no son NavigationEnd', async () => {
      await create();

      routerEvents$.next({ type: 'otro-evento' });

      expect(analytics.logScreenView).not.toHaveBeenCalled();
    });

    it('al destruirse deja de registrar navegaciones y de escuchar el perfil', async () => {
      await create();
      fixture.destroy();

      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));
      profile$.next(makeProfile());

      expect(analytics.logScreenView).not.toHaveBeenCalled();
      expect(component.isAuthenticated).toBe(false);
    });
  });

  describe('perfil en el menú', () => {
    it('sin perfil ofrece ingresar y no muestra cerrar sesión', async () => {
      await create();

      const text = fixture.nativeElement.textContent as string;
      expect(component.isAuthenticated).toBe(false);
      expect(text).toContain('AUTH.login.menuBar');
      expect(text).not.toContain('APP.menu.logout');
    });

    it('con perfil muestra nombre, correo truncado e iniciales, y la opción de cerrar sesión', async () => {
      profile$.next(makeProfile({ name: 'Ana Pérez', email: 'una.direccion.muy.larga@correo.com' }));
      await create();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(component.isAuthenticated).toBe(true);
      expect(component.displayName).toBe('Ana Pérez');
      expect(component.displayEmail).toBe('una.direccion.muy.larg...');
      expect(component.getInitials()).toBe('AP');
      expect(text).toContain('Ana Pérez');
      expect(text).toContain('APP.menu.logout');
      expect(text).not.toContain('AUTH.login.menuBar');
    });

    it('al cerrar sesión el perfil se vacía', async () => {
      profile$.next(makeProfile());
      await create();

      profile$.next(null);

      expect(component.isAuthenticated).toBe(false);
      expect(component.displayName).toBe('');
      expect(component.displayEmail).toBe('');
    });
  });

  describe('utilidades del menú', () => {
    beforeEach(create);

    it('truncateEmail deja hasta 25 caracteres y recorta lo demás', () => {
      expect(component.truncateEmail('a'.repeat(25))).toBe('a'.repeat(25));
      expect(component.truncateEmail('a'.repeat(26))).toBe('a'.repeat(22) + '...');
      expect(component.truncateEmail('')).toBe('');
    });

    it('getInitials: dos palabras → dos iniciales; una → una; sin nombre → correo; nada → "?"', () => {
      component.displayName = 'ana maría pérez';
      expect(component.getInitials()).toBe('AM');
      component.displayName = 'ana';
      expect(component.getInitials()).toBe('A');
      component.displayName = '';
      component.displayEmail = 'zeta@correo.com';
      expect(component.getInitials()).toBe('Z');
      component.displayEmail = '';
      expect(component.getInitials()).toBe('?');
    });

    it('el menú lista las rutas de la app y oculta "donar" en la web', () => {
      const routes = component.menuOptions.map((o) => o.route);
      expect(routes).toEqual(
        expect.arrayContaining(['/home', '/puzzles/public-plans', '/puzzles/custom-plans', '/puzzles/plans-history', '/analytics', '/games', '/streak', '/coordinates', '/knight-tour', '/chess960', '/settings']),
      );
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('CHESS960.title');
      expect(text).not.toContain('APP.components.donate');
    });

    it('navigateTo navega y después cierra el menú lateral', async () => {
      component.navigateTo('/games');
      expect(router.navigate).toHaveBeenCalledWith(['/games']);
      expect(menuController.close).not.toHaveBeenCalled();

      await flush();
      expect(menuController.close).toHaveBeenCalledWith('side-menu');
    });

    it('logout cierra sesión, vuelve al inicio y cierra el menú', async () => {
      component.logout();
      await flush();

      expect(authService.logout).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
      expect(menuController.close).toHaveBeenCalledWith('side-menu');
    });

    it('el botón de ingresar del menú abre el modal de login', async () => {
      (fixture.nativeElement.querySelector('button.btn-primary') as HTMLButtonElement).click();
      await flush();

      expect(modalController.create).toHaveBeenCalledWith({
        component: LoginComponent,
        componentProps: { segmentEmailPassword: 'login' },
      });
      expect(modal.present).toHaveBeenCalledTimes(1);
    });

    it('instalar la PWA cierra el menú y luego lanza la instalación', async () => {
      await component.installPwa();

      expect(menuController.close).toHaveBeenCalledWith('side-menu');
      expect(pwa.promptInstall).toHaveBeenCalledTimes(1);
    });

    it('las opciones de instalar solo aparecen en navegador móvil que puede instalar', async () => {
      expect(fixture.nativeElement.textContent).not.toContain('APP.menu.installApp');

      pwa.isMobileBrowser = true;
      pwa.canInstall.mockReturnValue(true);
      fixture.destroy();
      await create();

      expect(fixture.nativeElement.textContent).toContain('APP.menu.installApp');
    });

    it('ir a recordatorios navega y cierra el menú de notificaciones', async () => {
      component.goToReminders();
      await flush();

      expect(router.navigate).toHaveBeenCalledWith(['/reminders']);
      expect(menuController.close).toHaveBeenCalledWith('notifications-menu');
    });

    it('cerrar el panel de notificaciones cierra ese menú', () => {
      component.closeNotificationsMenu();

      expect(menuController.close).toHaveBeenCalledWith('notifications-menu');
    });

    it('marcar notificaciones como leídas: una sola o todas', () => {
      component.notifications = [
        { id: 'a', title: '', message: '', icon: '', color: '', time: '', read: false },
        { id: 'b', title: '', message: '', icon: '', color: '', time: '', read: false },
      ];

      component.markAsRead('a');
      expect(component.notifications.map((n) => n.read)).toEqual([true, false]);

      component.markAsRead('no-existe');
      expect(component.notifications.map((n) => n.read)).toEqual([true, false]);

      component.markAllAsRead();
      expect(component.notifications.every((n) => n.read)).toBe(true);
    });
  });
});
