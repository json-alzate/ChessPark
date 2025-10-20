// core and third party libraries
import { Component, OnInit, Input } from '@angular/core';
import { ModalController, PopoverController } from '@ionic/angular';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';

import { TranslateService } from '@ngx-translate/core';

// rxjs

// states
import { AuthState } from '@redux/states/auth.state';


// actions
import { requestLoginGoogle, requestSingUpEmail, requestLoginEmail } from '@redux/actions/auth.actions';
import { setErrorRegister } from '@redux/actions/auth.actions';

// selectors
import { getErrorLogin, getErrorRegister } from '@redux/selectors/auth.selectors';

// models
import { User as FirebaseUser } from 'firebase/auth';


// services
import { AuthService } from '@services/auth.service';

// components


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {

  @Input() showAs: 'modal' | 'popover';

  formSingUp: UntypedFormGroup;
  formLogin: UntypedFormGroup;
  formResetPassword: UntypedFormGroup;

  showResetPassword = false;
  showEmailPassword = false;
  segmentEmailPassword: 'login' | 'singUp' = 'login';

  errorLogin: string;
  errorSingUp: string;
  showPasswordRestoreMessage = false;

  emailRegexValidator = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private popoverController: PopoverController,
    private modalController: ModalController,
    private authService: AuthService,
    private translateService: TranslateService,
    private store: Store<AuthState>
  ) {
    this.buildFormSingUp();
    this.buildFormLogin();
    this.buildFormResetPassword();
    this.listenAuthState();
  }

  get emailFieldLogin() {
    return this.formLogin.get('email');
  }

  get passwordFielLogin() {
    return this.formLogin.get('password');
  }

  get emailFieldSingUp() {
    return this.formSingUp.get('email');
  }

  get passwordFielSingUp() {
    return this.formSingUp.get('password');
  }

  get rePasswordFielSingUp() {
    return this.formSingUp.get('rePassword');
  }

  get emailFieldResetPassword() {
    return this.formResetPassword.get('email');
  }

  ngOnInit() {

    this.store.select(getErrorLogin).subscribe((error: string) => {
      this.errorLogin = error;
      if (error) {
        this.showPasswordRestoreMessage = false;
        this.emailFieldLogin.setValue('');
        this.passwordFielLogin.setValue('');
      }
    });

    this.store.select(getErrorRegister).subscribe((error: string) => {
      this.errorSingUp = error;
      this.passwordFielSingUp.setValue('');
      this.rePasswordFielSingUp.setValue('');
    });

  }


  listenAuthState() {
    // se inicia a escuchar el estado del auth para cerrar el componente
    this.authService.getAuthState().subscribe((dataAuth: FirebaseUser) => {
      if (dataAuth && dataAuth?.email) {
        this.close();
      }
    });

  }


  /**
   * Ingresa con Google
   */
  loginGoogle() {
    const action = requestLoginGoogle();
    this.store.dispatch(action);
    this.close();
  }


  segmentChanged(ev: any) {
    this.errorLogin = null;
    this.errorSingUp = null;
    this.segmentEmailPassword = ev?.detail?.value;
  }

  // Ingresar
  buildFormLogin() {
    this.formLogin = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(this.emailRegexValidator)]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }



  onSubmitLogin($event: Event) {
    $event.preventDefault();
    if (this.formLogin.valid) {
      const credentials = {
        email: this.emailFieldLogin.value,
        password: this.passwordFielLogin.value
      };
      const action = requestLoginEmail(credentials);
      this.store.dispatch(action);
    } else {
      this.emailFieldLogin.markAsDirty();
      this.passwordFielLogin.markAsDirty();
    }
  }



  // ----------------------------------------------------------------------------

  // Registrarse
  buildFormSingUp() {
    this.formSingUp = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(this.emailRegexValidator)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rePassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }




  onSubmitSingUp($event: Event) {

    $event.preventDefault();
    if (this.formSingUp.valid) {

      if (this.passwordFielSingUp.value !== this.rePasswordFielSingUp.value) {
        const message = this.translateService.instant('PasswordsNoMatch');
        const action = setErrorRegister({ error: message });
        this.store.dispatch(action);
        return;
      } else {

        const credentials = {
          email: this.emailFieldSingUp.value,
          password: this.passwordFielSingUp.value,
          rePassword: this.rePasswordFielSingUp.value
        };
        const action = requestSingUpEmail(credentials);
        this.store.dispatch(action);
        this.formSingUp.reset();
      }

    } else {
      this.emailFieldSingUp.markAsDirty();
      this.passwordFielSingUp.markAsDirty();
    }
  }

  // ----------------------------------------------------------------------------
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

      this.authService.sendPasswordResetEmail(this.emailFieldResetPassword.value).then((data) => {
        this.showResetPassword = false;
        this.segmentEmailPassword = 'login';
        this.formResetPassword.reset();
        this.showPasswordRestoreMessage = true;

      });

    } else {
      this.emailFieldResetPassword.markAsDirty();
    }

  }

  close() {
    if (this.showAs === 'modal') {
      this.modalController.dismiss().then(() => { }).catch(() => { });
    } else if (this.showAs === 'popover') {
      this.popoverController.dismiss().then(() => { }).catch(() => { });
    }
  }

}
