import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MenuController, ModalController } from '@ionic/angular/standalone';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, of } from 'rxjs';

import { Profile } from '@chesspark/models';
import { getIsInitialized } from '@chesspark/state';

import { AuthService } from '@core/account/auth.service';
import { ProfileService } from '@core/account/profile.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { uid: 'u1', name: 'Ana Pérez', email: 'ana@correo.com', ...overrides } as Profile;
}

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let store: MockStore;
  let profile$: BehaviorSubject<Profile | null>;
  let router: { navigate: jest.Mock };
  let modalController: { create: jest.Mock };
  let menuController: { open: jest.Mock };
  let authService: { logout: jest.Mock };
  let modal: { present: jest.Mock };

  const text = (): string => fixture.nativeElement.textContent as string;

  /** Crea el componente con el store inicializado o no. */
  function createComponent(initialized = true) {
    store.overrideSelector(getIsInitialized, initialized);
    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    profile$ = new BehaviorSubject<Profile | null>(null);
    router = { navigate: jest.fn() };
    modal = { present: jest.fn().mockResolvedValue(undefined) };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    menuController = { open: jest.fn() };
    authService = { logout: jest.fn().mockReturnValue(of(undefined)) };

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideMockStore(),
        provideTranslocoTesting(),
        { provide: Router, useValue: router },
        { provide: ModalController, useValue: modalController },
        { provide: MenuController, useValue: menuController },
        { provide: AuthService, useValue: authService },
        { provide: ProfileService, useValue: { profile$ } },
      ],
    }).compileComponents();

    store = TestBed.inject(Store) as MockStore;
  });

  afterEach(() => store.resetSelectors());

  it('se crea', () => {
    createComponent();

    expect(component).toBeTruthy();
  });

  it('mientras la app no se inicializa muestra "cargando" y ningún botón de ingreso', () => {
    createComponent(false);

    expect(text()).toContain('APP.components.loading');
    expect(text()).not.toContain('AUTH.login.menuBar');
  });

  it('sin sesión (ya inicializada) ofrece el botón de ingresar', () => {
    createComponent(true);

    expect(text()).toContain('AUTH.login.menuBar');
    expect(text()).not.toContain('APP.components.loading');
    expect(component.isAuthenticated).toBe(false);
  });

  it('con sesión muestra la inicial del nombre y el nombre, no el botón de ingresar', () => {
    profile$.next(makeProfile());
    createComponent(true);

    expect(component.isAuthenticated).toBe(true);
    const avatar = fixture.nativeElement.querySelector('.avatar span') as HTMLElement;
    expect(avatar.textContent?.trim()).toBe('A');
    expect(text()).toContain('Ana Pérez');
    expect(text()).not.toContain('AUTH.login.menuBar');
  });

  it('reacciona cuando el perfil llega o se va después de crearse', () => {
    createComponent(true);

    profile$.next(makeProfile({ name: 'Luis' }));
    fixture.detectChanges();
    expect(component.displayName).toBe('Luis');
    expect(text()).toContain('Luis');

    profile$.next(null);
    fixture.detectChanges();
    expect(component.displayName).toBe('');
    expect(text()).toContain('AUTH.login.menuBar');
  });

  describe('truncateEmail', () => {
    beforeEach(() => createComponent());

    it('deja intacto un correo de hasta 20 caracteres', () => {
      expect(component.truncateEmail('12345678901234567890')).toBe('12345678901234567890');
    });

    it('recorta uno más largo a 17 caracteres y añade puntos suspensivos', () => {
      expect(component.truncateEmail('123456789012345678901')).toBe('12345678901234567...');
    });

    it('un correo vacío da cadena vacía', () => {
      expect(component.truncateEmail('')).toBe('');
    });
  });

  describe('getInitials', () => {
    beforeEach(() => createComponent());

    it('usa la primera letra del nombre en mayúscula', () => {
      component.displayName = 'ana';
      component.displayEmail = 'zeta@correo.com';
      expect(component.getInitials()).toBe('A');
    });

    it('sin nombre usa la del correo', () => {
      component.displayName = '';
      component.displayEmail = 'zeta@correo.com';
      expect(component.getInitials()).toBe('Z');
    });

    it('sin nombre ni correo devuelve "?"', () => {
      component.displayName = '';
      component.displayEmail = '';
      expect(component.getInitials()).toBe('?');
    });
  });

  it('el botón de ingresar abre el modal de login en modo "login"', async () => {
    createComponent(true);

    (fixture.nativeElement.querySelector('button.btn-outline') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(modalController.create).toHaveBeenCalledWith({
      component: LoginComponent,
      componentProps: { segmentEmailPassword: 'login' },
    });
    await fixture.whenStable();
    expect(modal.present).toHaveBeenCalled();
  });

  it('el icono de menú abre el menú lateral y la campana el de notificaciones', () => {
    createComponent();
    const buttons = fixture.nativeElement.querySelectorAll('button.btn-circle') as NodeListOf<HTMLElement>;

    (fixture.nativeElement.querySelector('.navbar-start [role="button"]') as HTMLElement).click();
    expect(menuController.open).toHaveBeenLastCalledWith('side-menu');

    buttons[buttons.length - 1].click();
    expect(menuController.open).toHaveBeenLastCalledWith('notifications-menu');
  });

  it('el logo del centro lleva a /home', () => {
    createComponent();

    (fixture.nativeElement.querySelector('.navbar-center a') as HTMLElement).click();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('navigateToDonation va a /donation', () => {
    createComponent();

    component.navigateToDonation();

    expect(router.navigate).toHaveBeenCalledWith(['/donation']);
  });

  it('logout pide cerrar sesión al servicio de autenticación', () => {
    createComponent();

    component.logout();

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('al destruirse se desuscribe del perfil', () => {
    createComponent();
    fixture.destroy();

    profile$.next(makeProfile({ name: 'Tarde' }));

    expect(component.displayName).toBe('');
  });
});
