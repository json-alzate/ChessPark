# 📋 Migración de Autenticación de @Chesscolate-old a @chessColate

## 🎯 Objetivo

Migrar el sistema de autenticación de la aplicación antigua (`@Chesscolate-old`) a la nueva aplicación (`@chessColate`) de manera desacoplada, distribuyendo las responsabilidades en el monorepo:

- **Estado de autenticación** → Librería `@cpark/state`
- **Servicios de autenticación** → Aplicación `@chessColate`
- **Modelos** → Librería `@cpark/models`

## ✅ Cambios Realizados

### 1. 📦 Modelos agregados a `@cpark/models`

Se crearon los siguientes modelos en `libs/models/src/lib/`:

#### `user.model.ts`
```typescript
export interface User {
  uid: string;
  name?: string;
  elo: number;
  eloPuzzles?: number;
  // ... más propiedades
}
```

#### `ui.model.ts`
```typescript
export type PiecesStyle = 'cburnett' | 'fantasy' | 'staunty';
export type BoardStyle = 'default' | 'default-contrast' | 'blue' | ...;
```

#### `profile.model.ts`
```typescript
export interface Profile extends User {
  email: string;
  lang: string;
  pieces?: PiecesStyle;
  board?: BoardStyle;
}
```

### 2. 🔄 Estado de autenticación en `@cpark/state`

Se creó la estructura completa del estado de autenticación en `libs/state/src/lib/auth/`:

- ✅ `auth.state.ts` - Interface del estado y feature selector
- ✅ `auth.actions.ts` - Acciones de NgRx
- ✅ `auth.reducer.ts` - Reducer de autenticación
- ✅ `auth.selectors.ts` - Selectores para acceder al estado
- ✅ `auth.effects.ts` - Effects para manejo de efectos secundarios

#### Características principales:

**Estado (`AuthState`)**:
```typescript
interface AuthState {
  profile: Profile | null;
  errorLogin: string | null;
  errorRegister: string | null;
}
```

**Acciones disponibles**:
- `requestLoginGoogle` - Login con Google
- `requestLoginEmail` - Login con email/password
- `requestSingUpEmail` - Registro con email/password
- `setProfile` - Establecer perfil del usuario
- `updateProfile` - Actualizar perfil
- `logOut` - Cerrar sesión

**Interfaces de inyección**:
- `IAuthService` - Interface para servicios de autenticación
- `IProfileService` - Interface para servicios de perfil
- `AUTH_SERVICE_TOKEN` - Token de inyección para AuthService
- `PROFILE_SERVICE_TOKEN` - Token de inyección para ProfileService

### 3. 🔐 Servicios en `@chessColate`

#### `auth.service.ts`

Servicio de autenticación que implementa `IAuthService`:

**Funcionalidades**:
- ✅ Login con Google (web y nativo)
- ✅ Login con email y password
- ✅ Registro con email y password
- ✅ Recuperación de contraseña
- ✅ Manejo del estado de autenticación de Firebase
- ✅ Logout

**Tecnologías**:
- Firebase Authentication
- Capacitor Firebase Authentication (para plataformas nativas)
- Integración con NgRx Store

#### `profile.service.ts`

Servicio de gestión de perfiles que implementa `IProfileService`:

**Funcionalidades**:
- ✅ Suscripción al perfil del usuario desde el store
- ✅ Verificación y creación de perfiles
- ✅ Actualización de perfiles
- ✅ Gestión de nicknames
- ✅ Cálculo de ELOs (preparado para implementación futura)

### 4. 📦 Dependencias agregadas

Se agregaron las siguientes dependencias al `package.json`:

```json
{
  "dependencies": {
    "@capacitor-firebase/authentication": "^6.0.0",
    "firebase": "^10.12.0"
  }
}
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│              @chessColate (App)                     │
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  AuthService     │      │  ProfileService  │   │
│  │  (implements     │      │  (implements     │   │
│  │  IAuthService)   │      │  IProfileService)│   │
│  └────────┬─────────┘      └─────────┬────────┘   │
│           │                           │            │
│           └───────────┬───────────────┘            │
│                       │                            │
│                       ▼                            │
│           ┌───────────────────────┐                │
│           │  NgRx Store (Inject)  │                │
│           └───────────┬───────────┘                │
└───────────────────────┼────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              @cpark/state (Lib)                     │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Actions  │  │ Reducer  │  │Selectors │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ┌──────────────────────────────────────┐         │
│  │        AuthEffects                   │         │
│  │  (usa IAuthService y IProfileService)│         │
│  └──────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│            @cpark/models (Lib)                      │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   User   │  │ Profile  │  │ UI Types │         │
│  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────┘
```

## 🚀 Próximos Pasos

### Para usar en la aplicación @chessColate:

1. **Configurar el Store** en `app.config.ts` o `app.module.ts`:

```typescript
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { authReducer, AuthEffects, AUTH_SERVICE_TOKEN, PROFILE_SERVICE_TOKEN } from '@cpark/state';
import { AuthService } from './services/auth.service';
import { ProfileService } from './services/profile.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore({ auth: authReducer }),
    provideEffects([AuthEffects]),
    { provide: AUTH_SERVICE_TOKEN, useExisting: AuthService },
    { provide: PROFILE_SERVICE_TOKEN, useExisting: ProfileService },
    // ... otros providers
  ]
};
```

2. **Inicializar Firebase** en el `app.component.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { environment } from '@environments/environment';

export class AppComponent implements OnInit {
  ngOnInit() {
    initializeApp(environment.firebase);
    this.authService.init();
  }
}
```

3. **Configurar environment** con las credenciales de Firebase

4. **Implementar FirestoreService** para las operaciones de base de datos

## 📝 Notas

- ⚠️ El `ProfileService` tiene métodos comentados con `TODO` que dependen del `FirestoreService`, el cual aún no ha sido migrado.
- ⚠️ Hay un warning de TypeScript con `firebase/auth` que no afecta la compilación.
- ✅ Toda la lógica de estado está desacoplada en la librería `@cpark/state`.
- ✅ Los servicios implementan interfaces definidas en el estado para mantener el contrato.
- ✅ Se usa inyección de dependencias mediante tokens para desacoplar los effects de las implementaciones concretas.

## 🔍 Testing

Para verificar que todo funciona correctamente:

```bash
# Construir la librería de estado
nx build state

# Construir la librería de modelos
nx build models

# Servir la aplicación
nx serve chessColate
```

## 📚 Documentación adicional

Consulta el README en `libs/state/README.md` para más detalles sobre el uso de la librería de estado.

