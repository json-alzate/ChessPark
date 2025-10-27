import { Component, OnInit, Input, inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import {
  ModalController,
  IonFab, IonFabButton, IonContent,
  IonLabel, IonIcon, IonRow, IonCol, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { 
  mailOutline, mailSharp, closeOutline, alertCircleOutline, 
  lockClosedOutline, keyOutline 
} from 'ionicons/icons';


// services
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonSegmentButton,
    IonSegment,
    IonCol,
    IonRow,
    IonFab,
    IonFabButton,
    IonContent,
    IonLabel,
    IonIcon
  ]
})
export class LoginComponent implements OnInit {

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segmentChanged(ev: any) {
    this.errorLogin = '';
    this.errorSingUp = '';
    this.segmentEmailPassword = ev?.detail?.value;
  }

  // Ingresar
  buildFormLogin() {
    this.formLogin = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(this.emailRegexValidator)]],
      password: ['', [Validators.required]]
    });
  }

  onSubmitLogin($event: Event) {
    $event.preventDefault();
    if (this.formLogin.valid) {
      const credentials = {
        email: this.emailFieldLogin?.value,
        password: this.passwordFieldLogin?.value
      };
      this.authService.signInWithEmailAndPassword(credentials.email, credentials.password).then((data) => {
        console.log('Login exitoso', data);
      }).catch((error) => {
        console.error('Error en login', error);
        this.errorLogin = 'Error al iniciar sesión. Verifica tus credenciales.';
      });
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
      rePassword: ['', [Validators.required, Validators.minLength(8)]]
    });

    // Valida que las contraseñas coincidan
    this.rePasswordFieldSingUp?.valueChanges.subscribe(() => {
      if (this.rePasswordFieldSingUp?.value !== this.passwordFieldSingUp?.value) {
        this.rePasswordFieldSingUp?.setErrors({ notMatch: true });
      }
    });
  }

  onSubmitSingUp($event: Event) {
    $event.preventDefault();
    if (this.formSingUp.valid) {
      if (this.passwordFieldSingUp?.value !== this.rePasswordFieldSingUp?.value) {
        this.errorSingUp = 'Las contraseñas no coinciden';
        return;
      } else {
        const credentials = {
          email: this.emailFieldSingUp?.value,
          password: this.passwordFieldSingUp?.value,
          rePassword: this.rePasswordFieldSingUp?.value
        };
        this.authService.createUserWithEmailAndPassword(credentials.email, credentials.password).then((data) => {
          console.log('Registro exitoso', data);
          this.formSingUp.reset();
        }).catch((error) => {
          console.error('Error en registro', error);
          this.errorSingUp = 'Error al registrarse. Intenta con otro email.';
        });
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

