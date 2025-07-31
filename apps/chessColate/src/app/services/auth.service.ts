//core and third party libraries
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Store } from '@ngrx/store';

import { Platform } from '@ionic/angular';

import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { TranslateService } from '@ngx-translate/core';


import {
  User as FirebaseUser,
  UserCredential,
  Auth,
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signInWithCredential,
  initializeAuth,
  indexedDBLocalPersistence
} from 'firebase/auth';
import { getApp } from 'firebase/app';


// rxjs
import { from, Subject } from 'rxjs';

// states
import { AuthState } from '@redux/states/auth.state';

// actions
import { logOut, setErrorLogin, setErrorRegister } from '@redux/actions/auth.actions';

// selectors

// models

// services

// components


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth: Auth;

  constructor(
    private platform: Platform,
    private translateService: TranslateService,
    private store: Store<AuthState>
  ) { }

  init() {
    this.auth = this.setAuth();
  }

  // actions
  triggerLogout() {
    const action = logOut();
    this.store.dispatch(action);
  }


  setAuth() {
    let auth;
    if (Capacitor.isNativePlatform()) {
      auth = initializeAuth(getApp(), {
        persistence: indexedDBLocalPersistence
      });
    } else {
      auth = getAuth();
    }
    return auth;
  }


  /**
   * Ingresa con Google
   */
  async loginGoogle() {
    // const answer = await GoogleAuth.signIn();
    // const credential = GoogleAuthProvider.credential(answer.authentication.idToken, answer.authentication.accessToken);
    // signInWithCredential(this.auth, credential);

    let userCredential: UserCredential | void;
    if (this.platform.is('capacitor')) {
      userCredential = await this.loginWithGoogleNative();
    } else {
      userCredential = await this.loginWithGoogleWeb();
    }
  }





  /**
   * Para escuchar el estado del usuario logueado
   *
   * @returns Subject<FirebaseUser>
   */
  getAuthState(): Subject<FirebaseUser> {
    const authState = new Subject<FirebaseUser>();
    this.auth.onAuthStateChanged(user => {
      authState.next(user);
    });
    return authState;
  }


  /**
   * Registra un usuario con email y contraseña
   *
   * @param email
   * @param password
   */
  async createUserWithEmailAndPassword(email: string, password: string) {
    const auth = this.setAuth();
    createUserWithEmailAndPassword(auth, email, password).catch(error => {
      let message = this.translateService.instant('RegisterError');
      if (error.code === 'auth/email-already-in-use') {
        message = this.translateService.instant('EmailReadyInUse');
      }
      const action = setErrorRegister({ error: message });
      this.store.dispatch(action);
    });
  }

  /**
   * Ingresa con email y contraseña
   *
   * @param email
   * @param password
   */
  async signInWithEmailAndPassword(email, password) {
    const auth = this.setAuth();
    return signInWithEmailAndPassword(auth, email, password);
  }


  /**
   * Send a password reset email
   *
   * @param email
   * @returns Promise<void>
   */
  sendPasswordResetEmail(email: string) {
    const auth = this.setAuth();
    return sendPasswordResetEmail(auth, email);
  }



  /**
   * Cierra sesión
   *
   * @returns
   */
  logout() {
    return from(this.auth.signOut());
  }


  /**
   * Launch Login with google native
   *
   * @private
   * @returns Promise<UserCredential>
   */
  private async loginWithGoogleNative(): Promise<UserCredential> {
    // 1. Create credentials on the native layer
    const result = await FirebaseAuthentication.signInWithGoogle()
      .catch(error => {
        console.log('error', error);
      });
    // 2. Sign in on the web layer using the id token and nonce
    if (result) {
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      const userSignedIn = await signInWithCredential(this.auth, credential);
      return userSignedIn;
    }
    return null;
  }

  /**
   * Show Login with google popup for web
   *
   * @private
   * @returns Promise<UserCredential>
   */
  private async loginWithGoogleWeb(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

}
