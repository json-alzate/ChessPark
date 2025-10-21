# @cpark/state

Librería de gestión de estado para las aplicaciones del monorepo ChessPark.

## Descripción

Esta librería contiene los estados, acciones, reducers, selectores y effects de NgRx compartidos entre las aplicaciones del monorepo.

## Estructura

```
src/
├── lib/
│   ├── auth/              # Estado de autenticación
│   │   ├── auth.state.ts
│   │   ├── auth.actions.ts
│   │   ├── auth.reducer.ts
│   │   ├── auth.selectors.ts
│   │   ├── auth.effects.ts
│   │   └── index.ts
│   └── state/             # Otros estados (legacy)
└── index.ts
```

## Uso

### Importar el estado de autenticación

```typescript
import { 
  AuthState, 
  AuthEffects,
  authReducer,
  getProfile,
  setProfile,
  logOut 
} from '@cpark/state';
```

### Configuración en la aplicación

Para usar el estado de autenticación en tu aplicación:

1. **Registrar el reducer** en el `StoreModule`:

```typescript
import { authReducer } from '@cpark/state';

@NgModule({
  imports: [
    StoreModule.forRoot({
      auth: authReducer
    }),
    // ... otros imports
  ]
})
export class AppModule {}
```

2. **Registrar los effects** en el `EffectsModule`:

```typescript
import { AuthEffects, AUTH_SERVICE_TOKEN, PROFILE_SERVICE_TOKEN } from '@cpark/state';
import { AuthService } from './services/auth.service';
import { ProfileService } from './services/profile.service';

@NgModule({
  imports: [
    EffectsModule.forRoot([AuthEffects]),
    // ... otros imports
  ],
  providers: [
    { provide: AUTH_SERVICE_TOKEN, useExisting: AuthService },
    { provide: PROFILE_SERVICE_TOKEN, useExisting: ProfileService }
  ]
})
export class AppModule {}
```

3. **Implementar las interfaces requeridas** en tus servicios:

```typescript
import { IAuthService, IProfileService } from '@cpark/state';

@Injectable()
export class AuthService implements IAuthService {
  async loginGoogle() { /* ... */ }
  async createUserWithEmailAndPassword(email: string, password: string) { /* ... */ }
  async signInWithEmailAndPassword(email: string, password: string) { /* ... */ }
  logout() { /* ... */ }
}

@Injectable()
export class ProfileService implements IProfileService {
  async updateProfile(profile: any) { /* ... */ }
  async addNewNickName(nickname: string, uidUser: string) { /* ... */ }
}
```

## Interfaces

### IAuthService

Interfaz que debe implementar el servicio de autenticación de la aplicación:

```typescript
interface IAuthService {
  loginGoogle(): Promise<any>;
  createUserWithEmailAndPassword(email: string, password: string): Promise<any>;
  signInWithEmailAndPassword(email: string, password: string): Promise<any>;
  logout(): any; // Observable o Promise
}
```

### IProfileService

Interfaz que debe implementar el servicio de perfil de la aplicación:

```typescript
interface IProfileService {
  updateProfile(profile: any): Promise<any>;
  addNewNickName(nickname: string, uidUser: string): Promise<any>;
}
```

## Estados disponibles

### Auth State

Estado para gestionar la autenticación de usuarios:

- `profile`: Perfil del usuario autenticado
- `errorLogin`: Error en el login
- `errorRegister`: Error en el registro

### Acciones

- `requestLoginGoogle`: Solicita login con Google
- `requestLoginEmail`: Solicita login con email
- `requestSingUpEmail`: Solicita registro con email
- `setProfile`: Establece el perfil del usuario
- `updateProfile`: Actualiza el perfil del usuario
- `logOut`: Cierra sesión

### Selectores

- `getProfile`: Obtiene el perfil del usuario
- `getErrorLogin`: Obtiene el error de login
- `getErrorRegister`: Obtiene el error de registro

## Dependencias

- `@ngrx/store`
- `@ngrx/effects`
- `@cpark/models` (para los tipos `Profile`)

## Migración desde @redux

Si estás migrando desde el antiguo sistema de `@redux/`, puedes seguir estos pasos:

1. Reemplazar los imports de `@redux/states/auth.state` por `@cpark/state`
2. Reemplazar los imports de `@redux/actions/auth.actions` por `@cpark/state`
3. Reemplazar los imports de `@redux/selectors/auth.selectors` por `@cpark/state`
4. Implementar las interfaces `IAuthService` y `IProfileService` en tus servicios
5. Registrar los providers con los tokens de inyección correspondientes
