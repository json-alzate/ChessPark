# 🔐 Configuración de Autenticación en @chessColate

## 📋 Pasos para integrar la autenticación

### 1. ✅ Instalar dependencias (Ya instaladas)

```bash
npm install
```

Las siguientes dependencias ya fueron agregadas:
- `firebase@^10.12.0`
- `@capacitor-firebase/authentication@^6.0.0`

### 2. 🔥 Configurar Firebase

Crea o actualiza el archivo `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'TU_API_KEY',
    authDomain: 'TU_AUTH_DOMAIN',
    projectId: 'TU_PROJECT_ID',
    storageBucket: 'TU_STORAGE_BUCKET',
    messagingSenderId: 'TU_MESSAGING_SENDER_ID',
    appId: 'TU_APP_ID',
    measurementId: 'TU_MEASUREMENT_ID'
  }
};
```

Y para producción `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  firebase: {
    // ... tus credenciales de producción
  }
};
```

### 3. 🏗️ Configurar el Store de NgRx

En tu archivo de configuración de la app (`app.config.ts` para standalone o `app.module.ts` para módulos):

#### Opción A: Standalone (Recomendado)

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { 
  authReducer, 
  AuthEffects, 
  AUTH_SERVICE_TOKEN, 
  PROFILE_SERVICE_TOKEN 
} from '@cpark/state';

import { AuthService } from './services/auth.service';
import { ProfileService } from './services/profile.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Store
    provideStore({ 
      auth: authReducer 
    }),
    
    // Effects
    provideEffects([AuthEffects]),
    
    // Devtools (solo en desarrollo)
    provideStoreDevtools({ 
      maxAge: 25, 
      logOnly: false 
    }),
    
    // Servicios de autenticación
    AuthService,
    ProfileService,
    { provide: AUTH_SERVICE_TOKEN, useExisting: AuthService },
    { provide: PROFILE_SERVICE_TOKEN, useExisting: ProfileService },
    
    // ... otros providers
  ]
};
```

#### Opción B: Módulos

```typescript
import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { 
  authReducer, 
  AuthEffects, 
  AUTH_SERVICE_TOKEN, 
  PROFILE_SERVICE_TOKEN 
} from '@cpark/state';

import { AuthService } from './services/auth.service';
import { ProfileService } from './services/profile.service';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    StoreModule.forRoot({ 
      auth: authReducer 
    }),
    EffectsModule.forRoot([AuthEffects]),
    StoreDevtoolsModule.instrument({ 
      maxAge: 25, 
      logOnly: environment.production 
    }),
    // ... otros imports
  ],
  providers: [
    AuthService,
    ProfileService,
    { provide: AUTH_SERVICE_TOKEN, useExisting: AuthService },
    { provide: PROFILE_SERVICE_TOKEN, useExisting: ProfileService }
  ]
})
export class AppModule { }
```

### 4. 🚀 Inicializar Firebase en la App

En tu `app.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { environment } from '@environments/environment';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'app-root',
  // ...
})
export class AppComponent implements OnInit {
  
  constructor(private authService: AuthService) {}
  
  ngOnInit() {
    // Inicializar Firebase
    initializeApp(environment.firebase);
    
    // Inicializar el servicio de autenticación
    this.authService.init();
    
    // Escuchar cambios en el estado de autenticación
    this.authService.getAuthState().subscribe(user => {
      console.log('Auth state changed:', user);
      // Aquí puedes manejar la lógica cuando cambia el estado
    });
  }
}
```

### 5. 📝 Usar en tus componentes

#### Login con Google

```typescript
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { requestLoginGoogle, AuthState } from '@cpark/state';

@Component({
  selector: 'app-login',
  template: `
    <button (click)="loginWithGoogle()">
      Login con Google
    </button>
  `
})
export class LoginComponent {
  
  constructor(private store: Store<AuthState>) {}
  
  loginWithGoogle() {
    this.store.dispatch(requestLoginGoogle());
  }
}
```

#### Login con Email

```typescript
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { requestLoginEmail, AuthState } from '@cpark/state';

@Component({
  selector: 'app-login',
  template: `
    <form (ngSubmit)="login()">
      <input [(ngModel)]="email" type="email" placeholder="Email">
      <input [(ngModel)]="password" type="password" placeholder="Password">
      <button type="submit">Login</button>
    </form>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  
  constructor(private store: Store<AuthState>) {}
  
  login() {
    this.store.dispatch(requestLoginEmail({ 
      email: this.email, 
      password: this.password 
    }));
  }
}
```

#### Acceder al perfil del usuario

```typescript
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { getProfile, AuthState } from '@cpark/state';
import { Profile } from '@cpark/models';

@Component({
  selector: 'app-profile',
  template: `
    <div *ngIf="profile$ | async as profile">
      <h1>{{ profile.name }}</h1>
      <p>Email: {{ profile.email }}</p>
      <p>ELO: {{ profile.elo }}</p>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  profile$: Observable<Profile | null>;
  
  constructor(private store: Store<AuthState>) {}
  
  ngOnInit() {
    this.profile$ = this.store.select(getProfile);
  }
}
```

#### Logout

```typescript
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { logOut, AuthState } from '@cpark/state';

@Component({
  selector: 'app-header',
  template: `
    <button (click)="logout()">Cerrar Sesión</button>
  `
})
export class HeaderComponent {
  
  constructor(private store: Store<AuthState>) {}
  
  logout() {
    this.store.dispatch(logOut());
  }
}
```

## 📚 Documentación adicional

- Ver `libs/state/README.md` para detalles sobre la librería de estado
- Ver `MIGRACION_AUTH.md` en la raíz del proyecto para ver el proceso completo de migración

## 🔍 Testing

Para verificar que todo está funcionando:

```bash
# Servir la aplicación
nx serve chessColate

# Ejecutar tests
nx test chessColate

# Ejecutar linter
nx lint chessColate
```

## ⚠️ Notas importantes

1. **Firestore**: El `ProfileService` tiene métodos que dependen de `FirestoreService` que aún no ha sido migrado. Estos están marcados con `TODO`.

2. **Capacitor**: Para funcionalidad nativa, asegúrate de tener configurado Capacitor correctamente:
   ```bash
   npx cap sync
   ```

3. **Environment**: No olvides agregar tus credenciales de Firebase en los archivos de environment antes de ejecutar la app.

4. **Guards**: Puedes crear guards de autenticación usando los selectores:
   ```typescript
   import { inject } from '@angular/core';
   import { Router } from '@angular/router';
   import { Store } from '@ngrx/store';
   import { map } from 'rxjs/operators';
   import { getProfile, AuthState } from '@cpark/state';
   
   export const authGuard = () => {
     const store = inject(Store<AuthState>);
     const router = inject(Router);
     
     return store.select(getProfile).pipe(
       map(profile => {
         if (profile) {
           return true;
         }
         router.navigate(['/login']);
         return false;
       })
     );
   };
   ```

