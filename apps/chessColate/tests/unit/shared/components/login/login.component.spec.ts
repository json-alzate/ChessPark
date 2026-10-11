import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';

import { AuthService } from '@services/account/auth.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authState$: Subject<{ email?: string } | null>;
  let authService: {
    getAuthState: jest.Mock;
    loginGoogle: jest.Mock;
    signInWithEmailAndPassword: jest.Mock;
    createUserWithEmailAndPassword: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let modalController: { dismiss: jest.Mock };

  const submit = (fn: (e: Event) => unknown) => fn.call(component, new Event('submit'));

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    authState$ = new Subject();
    authService = {
      getAuthState: jest.fn().mockReturnValue(authState$),
      loginGoogle: jest.fn(),
      signInWithEmailAndPassword: jest.fn().mockResolvedValue({}),
      createUserWithEmailAndPassword: jest.fn().mockResolvedValue({}),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    modalController = { dismiss: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideTranslocoTesting(),
        { provide: AuthService, useValue: authService },
        { provide: ModalController, useValue: modalController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  it('se crea con el formulario de ingreso visible', () => {
    expect(component).toBeTruthy();
    expect(component.segmentEmailPassword).toBe('login');
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

  describe('cierre automático', () => {
    it('se cierra cuando llega un usuario con correo', () => {
      authState$.next({ email: 'ana@correo.com' });

      expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    });

    it('no se cierra si no hay usuario o no trae correo', () => {
      authState$.next(null);
      authState$.next({});

      expect(modalController.dismiss).not.toHaveBeenCalled();
    });
  });

  it('el botón de Google delega en el servicio de autenticación', () => {
    (fixture.nativeElement.querySelector('button.btn-lg') as HTMLButtonElement).click();

    expect(authService.loginGoogle).toHaveBeenCalledTimes(1);
  });

  describe('pestañas', () => {
    it('cambiar de pestaña limpia los errores previos', () => {
      component.errorLogin = 'loginFailed';
      component.errorSingUp = 'registerFailed';

      component.setSegmentTab('singUp');

      expect(component.segmentEmailPassword).toBe('singUp');
      expect(component.errorLogin).toBe('');
      expect(component.errorSingUp).toBe('');
    });

    it('en la pestaña de registro se pinta el formulario de registro', () => {
      component.setSegmentTab('singUp');
      fixture.detectChanges();

      const passwords = fixture.nativeElement.querySelectorAll('input[type="password"]');
      expect(passwords.length).toBe(2); // contraseña + repetirla
    });
  });

  describe('validación de correo', () => {
    it.each(['ana@correo.com', 'a.b+c@dominio.co', 'x_y@sub-dom.org'])('acepta %s', (email) => {
      component.formLogin.patchValue({ email, password: 'x' });
      expect(component.emailFieldLogin?.valid).toBe(true);
    });

    it.each(['', 'sin-arroba', 'ana@', '@correo.com'])('rechaza "%s"', (email) => {
      component.formLogin.patchValue({ email, password: 'x' });
      expect(component.emailFieldLogin?.valid).toBe(false);
    });
  });

  describe('ingresar', () => {
    it('con datos válidos manda correo y contraseña al servicio', async () => {
      component.formLogin.setValue({ email: 'ana@correo.com', password: 'secreta123' });

      await submit(component.onSubmitLogin);

      expect(authService.signInWithEmailAndPassword).toHaveBeenCalledWith('ana@correo.com', 'secreta123');
      expect(component.errorLogin).toBeUndefined();
    });

    it('evita el envío nativo del formulario', async () => {
      const event = new Event('submit');
      const prevent = jest.spyOn(event, 'preventDefault');

      await component.onSubmitLogin(event);

      expect(prevent).toHaveBeenCalled();
    });

    it('con datos inválidos no llama al servicio y marca los campos como tocados', async () => {
      component.formLogin.setValue({ email: 'no-es-correo', password: '' });

      await submit(component.onSubmitLogin);

      expect(authService.signInWithEmailAndPassword).not.toHaveBeenCalled();
      expect(component.emailFieldLogin?.dirty).toBe(true);
      expect(component.passwordFieldLogin?.dirty).toBe(true);
    });

    it('si el servicio falla marca "loginFailed"', async () => {
      authService.signInWithEmailAndPassword.mockRejectedValue(new Error('credenciales'));
      component.formLogin.setValue({ email: 'ana@correo.com', password: 'mala' });

      await submit(component.onSubmitLogin);

      expect(component.errorLogin).toBe('loginFailed');
    });
  });

  describe('registrarse', () => {
    const fill = (password: string, rePassword: string) =>
      component.formSingUp.setValue({ email: 'ana@correo.com', password, rePassword });

    it('con contraseñas iguales crea la cuenta y limpia el formulario', async () => {
      fill('secreta123', 'secreta123');

      await submit(component.onSubmitSingUp);

      expect(authService.createUserWithEmailAndPassword).toHaveBeenCalledWith('ana@correo.com', 'secreta123');
      expect(component.emailFieldSingUp?.value).toBeNull();
    });

    it('contraseñas distintas dejan el formulario inválido con error "notMatch"', async () => {
      fill('secreta123', 'otra-distinta');

      await submit(component.onSubmitSingUp);

      expect(component.rePasswordFieldSingUp?.hasError('notMatch')).toBe(true);
      expect(authService.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('una contraseña de menos de 8 caracteres no se envía', async () => {
      fill('corta', 'corta');

      await submit(component.onSubmitSingUp);

      expect(authService.createUserWithEmailAndPassword).not.toHaveBeenCalled();
      expect(component.passwordFieldSingUp?.dirty).toBe(true);
    });

    it('si el servicio falla marca "registerFailed" y conserva lo escrito', async () => {
      authService.createUserWithEmailAndPassword.mockRejectedValue(new Error('correo en uso'));
      fill('secreta123', 'secreta123');

      await submit(component.onSubmitSingUp);

      expect(component.errorSingUp).toBe('registerFailed');
      expect(component.emailFieldSingUp?.value).toBe('ana@correo.com');
    });
  });

  describe('recuperar contraseña', () => {
    it('con un correo válido envía el correo, vuelve a ingresar y avisa', async () => {
      component.showResetPassword = true;
      component.setSegmentTab('singUp');
      component.formResetPassword.setValue({ email: 'ana@correo.com' });

      component.resetPassword(new Event('submit'));
      await Promise.resolve();
      await Promise.resolve();

      expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith('ana@correo.com');
      expect(component.showResetPassword).toBe(false);
      expect(component.segmentEmailPassword).toBe('login');
      expect(component.showPasswordRestoreMessage).toBe(true);
    });

    it('con un correo inválido no envía nada', () => {
      component.formResetPassword.setValue({ email: 'nope' });

      component.resetPassword(new Event('submit'));

      expect(authService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(component.emailFieldResetPassword?.dirty).toBe(true);
    });

    it('si el envío falla no muestra el aviso de éxito', async () => {
      authService.sendPasswordResetEmail.mockRejectedValue(new Error('red'));
      component.formResetPassword.setValue({ email: 'ana@correo.com' });

      component.resetPassword(new Event('submit'));
      await Promise.resolve();
      await Promise.resolve();

      expect(component.showPasswordRestoreMessage).toBe(false);
    });
  });
});
