import { Component, OnInit, OnDestroy, Input, inject } from '@angular/core';
import {
  AbstractControl, UntypedFormGroup, UntypedFormBuilder, ValidationErrors, Validators, ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';

import {
  ModalController,
  IonFab, IonFabButton, IonContent,
  IonIcon, IonRow, IonCol
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { 
  mailOutline, mailSharp, closeOutline, alertCircleOutline, 
  lockClosedOutline, keyOutline 
} from 'ionicons/icons';

// Transloco
import { TranslocoPipe } from '@jsverse/transloco';

// services
import { AuthService } from '@core/account/auth.service';

/**
 * La confirmación debe ser igual a la contraseña. Sin confirmación escrita no marca nada: ya lo dice
 * `required`.
 */
function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value && control.value !== password ? { notMatch: true } : null;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonCol,
    IonRow,
    IonFab,
    IonFabButton,
    IonContent,
    IonIcon,
    TranslocoPipe
  ]
})
export class LoginComponent implements OnInit, OnDestroy {

  authService = inject(AuthService);
  formBuilder = inject(UntypedFormBuilder);
  modalController = inject(ModalController);

  formSingUp!: UntypedFormGroup;
  formLogin!: UntypedFormGroup;
  formResetPassword!: UntypedFormGroup;

  showResetPassword = false;
  @Input() segmentEmailPassword: 'login' | 'singUp' = 'login';

  errorLogin!: string;
  errorSingUp!: string;
  showPasswordRestoreMessage = false;

  /** Los avisos (error, correo enviado) se retiran solos a los pocos segundos. */
  private static readonly TOAST_MS = 5000;
  private toastTimers: ReturnType<typeof setTimeout>[] = [];

  emailRegexValidator = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/;

  constructor() {
    this.buildFormSingUp();
    this.buildFormLogin();
    this.buildFormResetPassword();
    this.listenAuthState();
    addIcons({
      closeOutline, mailOutline, keyOutline, alertCircleOutline, 
      lockClosedOutline, mailSharp
    });
  }

  get emailFieldLogin() {
    return this.formLogin.get('email');
  }

  get passwordFieldLogin() {
    return this.formLogin.get('password');
  }

  get emailFieldSingUp() {
    return this.formSingUp.get('email');
  }

  get passwordFieldSingUp() {
    return this.formSingUp.get('password');
  }

  get rePasswordFieldSingUp() {
    return this.formSingUp.get('rePassword');
  }

  get emailFieldResetPassword() {
    return this.formResetPassword.get('email');
  }

  ngOnInit() {
    // Inicialización adicional si es necesaria
  }

  ngOnDestroy() {
    this.toastTimers.forEach(clearTimeout);
  }

  /** Ejecuta `clear` pasados unos segundos para que el aviso no se quede para siempre. */
  private clearToastLater(clear: () => void) {
    this.toastTimers.push(setTimeout(clear, LoginComponent.TOAST_MS));
  }

  listenAuthState() {
    // se inicia a escuchar el estado del auth para cerrar el componente
    this.authService.getAuthState().subscribe((dataAuth) => {
      if (dataAuth && dataAuth?.email) {
        this.close();
      }
    });
  }

  /**
   * Ingresa con Google
   */
  loginGoogle() {
    this.authService.loginGoogle();
  }

  setSegmentTab(value: 'login' | 'singUp') {
    this.errorLogin = '';
    this.errorSingUp = '';
    this.segmentEmailPassword = value;
  }

  // Ingresar
  buildFormLogin() {
    this.formLogin = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(this.emailRegexValidator)]],
      password: ['', [Validators.required]]
    });
  }

  async onSubmitLogin($event: Event) {
    $event.preventDefault();
    if (this.formLogin.valid) {
      const credentials = {
        email: this.emailFieldLogin?.value,
        password: this.passwordFieldLogin?.value
      };
      try {
        const data = await this.authService.signInWithEmailAndPassword(credentials.email, credentials.password);
        console.log('Login exitoso', data);
      } catch (error) {
        console.error('Error en login', error);
        // El mensaje de error ahora viene de las traducciones en el HTML
        this.errorLogin = 'loginFailed'; // Solo marcamos que hay un error
        this.clearToastLater(() => (this.errorLogin = ''));
      }
    } else {
      this.emailFieldLogin?.markAsDirty();
      this.passwordFieldLogin?.markAsDirty();
    }
  }

  // Registrarse
  buildFormSingUp() {
    this.formSingUp = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(this.emailRegexValidator)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rePassword: ['', [Validators.required, Validators.minLength(8), matchesPassword]]
    });

    // Cambiar la contraseña obliga a revisar la confirmación: puede pasar a coincidir o a dejar de hacerlo
    this.passwordFieldSingUp?.valueChanges.subscribe(() => this.rePasswordFieldSingUp?.updateValueAndValidity());
  }

  async onSubmitSingUp($event: Event) {
    $event.preventDefault();
    if (this.formSingUp.valid) {
      if (this.passwordFieldSingUp?.value !== this.rePasswordFieldSingUp?.value) {
        this.errorSingUp = 'passwordsNoMatch'; // Error para las traducciones
        this.clearToastLater(() => (this.errorSingUp = ''));
        return;
      } else {
        const credentials = {
          email: this.emailFieldSingUp?.value,
          password: this.passwordFieldSingUp?.value,
          rePassword: this.rePasswordFieldSingUp?.value
        };
        try {
          const data = await this.authService.createUserWithEmailAndPassword(credentials.email, credentials.password);
          console.log('Registro exitoso', data);
          this.formSingUp.reset();
        } catch (error) {
          console.error('Error en registro', error);
          this.errorSingUp = 'registerFailed'; // Error para las traducciones
          this.clearToastLater(() => (this.errorSingUp = ''));
        }
      }
    } else {
      this.emailFieldSingUp?.markAsDirty();
      this.passwordFieldSingUp?.markAsDirty();
      this.rePasswordFieldSingUp?.markAsDirty();
    }
  }

  // Reset password
  buildFormResetPassword() {
    this.formResetPassword = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(this.emailRegexValidator)]]
    });
  }

  // Recuperar password
  resetPassword($event: Event) {
    $event.preventDefault();
    if (this.formResetPassword.valid) {
      this.authService.sendPasswordResetEmail(this.emailFieldResetPassword?.value).then(() => {
        this.showResetPassword = false;
        this.segmentEmailPassword = 'login';
        this.formResetPassword.reset();
        this.showPasswordRestoreMessage = true;
        this.clearToastLater(() => (this.showPasswordRestoreMessage = false));
      }).catch((error) => {
        console.error('Error al enviar email de recuperación', error);
      });
    } else {
      this.emailFieldResetPassword?.markAsDirty();
    }
  }

  close() {
    this.modalController.dismiss()
      .then(() => {
        // Modal cerrado exitosamente
      })
      .catch(() => {
        // Error al cerrar el modal
      });
  }
}

