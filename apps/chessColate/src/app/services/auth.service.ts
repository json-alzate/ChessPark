// core and third party libraries
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Store } from '@ngrx/store';

// Firebase
import {
  type User as FirebaseUser,
  type UserCredential,
  type Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  signInWithCredential,
  initializeAuth,
  indexedDBLocalPersistence
} from 'firebase/auth';
import { getApp } from 'firebase/app';

// rxjs
import { from, Subject } from 'rxjs';

// State management
import { 
  AuthState, 
  setErrorRegister, 
  logOut,
  setInitialized,
  IAuthService 
} from '@cpark/state';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements IAuthService {

  private auth!: Auth;

  constructor(
    private platform: Platform,
    private store: Store<AuthState>
  ) { }

  init() {
    this.auth = this.setAuth();
    // El estado de inicialización se marcará como true después del primer auth state
  }

  /**
   * Marca el servicio como inicializado (llamado después del primer auth state)
   */
  markAsInitialized() {
    const action = setInitialized({ isInitialized: true });
    this.store.dispatch(action);
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
    let userCredential: UserCredential | void | null;
    if (this.platform.is('capacitor')) {
      userCredential = await this.loginWithGoogleNative();
    } else {
      userCredential = await this.loginWithGoogleWeb();
    }
    return userCredential;
  }

  /**
   * Para escuchar el estado del usuario logueado
   *
   * @returns Subject<FirebaseUser>
   */
  getAuthState(): Subject<FirebaseUser | null> {
    const authState = new Subject<FirebaseUser | null>();
    this.auth.onAuthStateChanged((user: FirebaseUser | null) => {
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
    return firebaseCreateUserWithEmailAndPassword(auth, email, password).catch((error: any) => {
      // TODO: Traducir con TranslateService - llaves: 'RegisterError', 'EmailReadyInUse'
      let message = 'Error de registro';
      if (error.code === 'auth/email-already-in-use') {
        message = 'El correo ya está en uso';
      }
      const action = setErrorRegister({ error: message });
      this.store.dispatch(action);
      throw error;
    });
  }

  /**
   * Ingresa con email y contraseña
   *
   * @param email
   * @param password
   */
  async signInWithEmailAndPassword(email: string, password: string) {
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
    return firebaseSendPasswordResetEmail(auth, email);
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
  private async loginWithGoogleNative(): Promise<UserCredential | null> {
    // 1. Create credentials on the native layer
    const result = await FirebaseAuthentication.signInWithGoogle()
      .catch((error: any) => {
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

