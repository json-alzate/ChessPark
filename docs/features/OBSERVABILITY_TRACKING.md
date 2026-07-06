# Observability & Tracking — Feature Document

## Concepto

Instrumentar la app para tener **visibilidad de lo que les pasa a los usuarios reales en producción**. Cubre dos necesidades distintas que se resuelven con herramientas complementarias:

1. **Error/Crash tracking** — capturar excepciones, crashes nativos y errores de JS que ocurren en los dispositivos de los usuarios, con stacktrace, modelo de dispositivo, versión de la app y pasos previos. Responde a *"¿qué se está rompiendo y a quién?"*.
2. **Product analytics** — saber qué pantallas ven los usuarios, qué opciones presionan, embudos de conversión, retención y eventos de negocio. Responde a *"¿qué hacen los usuarios y dónde abandonan?"*.

La app ya usa **Firebase** (Auth con `@capacitor-firebase/authentication`) + **RevenueCat** sobre **Ionic/Angular + Capacitor 7**, así que la estrategia se apoya en el ecosistema Firebase para minimizar costo (gratis) y fricción de configuración.

Aplica a **chessColate (web/PWA + Android/iOS)**.

---

## Arquitectura

```
                    ┌─────────────────────────────────────┐
   App (Angular)    │  AnalyticsService  (fachada central) │
   ─ componentes ──▶│  - logEvent(name, params)            │──▶ Firebase Analytics
   ─ router        │  - setScreen(name)                   │
                    │  - setUserProps(...)                 │
                    └─────────────────────────────────────┘
                    ┌─────────────────────────────────────┐
   ErrorHandler ───▶│  CrashlyticsErrorHandler             │──▶ Firebase Crashlytics
   global Angular   │  - handleError(err) → recordException│
                    └─────────────────────────────────────┘
```

**Principio clave:** toda la instrumentación pasa por **una sola fachada** (`AnalyticsService`) y un **`ErrorHandler` global**. Los componentes nunca llaman al plugin directamente — así se puede cambiar de proveedor (ej. añadir Sentry o Amplitude) sin tocar la app.

---

## Stack elegido

| Necesidad | Herramienta | Plugin | Costo |
|-----------|-------------|--------|-------|
| Errores / crashes | Firebase Crashlytics | `@capacitor-firebase/crashlytics` | Gratis |
| Pantallas y acciones | Firebase Analytics (GA4) | `@capacitor-firebase/analytics` | Gratis |

Ambos son de la misma familia de plugins que ya se usa (`@capacitor-firebase/authentication`) y se visualizan en la consola de Firebase ya existente.

### Alternativa evaluada: Sentry

- **Crashlytics** brilla en **nativo** (Android/iOS), es gratis e ilimitado, y ya está dentro de Firebase.
- **Sentry** brilla en **JS/web** (mejores stacktraces con source maps, breadcrumbs ricos, releases). Gratis hasta cierto volumen.
- **Decisión:** empezar con **Firebase puro** (Crashlytics + Analytics). Reconsiderar Sentry **solo si** el tracking de errores en la **PWA/web** se vuelve prioritario, ya que Crashlytics no cubre bien el entorno web.

---

## Plan de implementación

### 1. Instalación

```bash
npm install @capacitor-firebase/analytics @capacitor-firebase/crashlytics
npx cap sync
```

> Requiere `google-services.json` (Android) y `GoogleService-Info.plist` (iOS) ya presentes por Firebase Auth. Crashlytics necesita además el plugin Gradle de Crashlytics en Android.

### 2. Fachada `AnalyticsService`

`src/app/core/services/analytics.service.ts` — envuelve el plugin de Analytics:

```ts
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  async logEvent(name: string, params?: Record<string, any>) {
    try { await FirebaseAnalytics.logEvent({ name, params }); } catch {}
  }
  async setScreen(screenName: string) {
    try { await FirebaseAnalytics.setCurrentScreen({ screenName }); } catch {}
  }
  async setUserId(userId: string | null) {
    try { await FirebaseAnalytics.setUserId({ userId }); } catch {}
  }
}
```

### 3. Screen tracking automático

Engancharse a `NavigationEnd` del Router una sola vez en `app.component.ts`:

```ts
this.router.events.pipe(filter(e => e instanceof NavigationEnd))
  .subscribe((e: NavigationEnd) => this.analytics.setScreen(e.urlAfterRedirects));
```

### 4. Error handler global (Crashlytics)

`src/app/core/services/crashlytics-error-handler.ts` implementando `ErrorHandler`, registrado como provider:

```ts
{ provide: ErrorHandler, useClass: CrashlyticsErrorHandler }
```

Reporta vía `FirebaseCrashlytics.recordException(...)` y mantiene el `console.error` en desarrollo.

### 5. Asociar usuario (opcional pero recomendado)

Tras login, llamar `analytics.setUserId(uid)` y `FirebaseCrashlytics.setUserId(uid)` para correlacionar errores/eventos con cuentas (respetando privacidad — usar el UID, nunca email).

---

## Eventos a instrumentar (catálogo inicial)

Mantener nombres en `snake_case` y un catálogo versionado para evitar eventos duplicados/inconsistentes.

| Evento | Cuándo | Params sugeridos | Ubicación aprox. |
|--------|--------|------------------|------------------|
| `screen_view` | automático por Router | `screen_name` | `app.component.ts` |
| `puzzle_started` | el usuario empieza un puzzle | `theme`, `rating` | `training.component.ts` |
| `puzzle_solved` | resuelve correctamente | `theme`, `rating`, `time_seconds` | `training.component.ts` |
| `puzzle_failed` | falla el puzzle | `theme`, `rating` | `training.component.ts` |
| `plan_selected` | elige un plan de entrenamiento | `plan_id` | home / planes |
| `language_changed` | cambia idioma | `from`, `to` | `settings.page.ts` |
| `donation_opened` | abre flujo de donación | `source` | home |
| `purchase_started` / `purchase_completed` | RevenueCat | `product_id`, `price` | servicio de compras |

---

## Consideraciones de privacidad

- **No** enviar PII (email, nombre real) como parámetros de evento ni como user property. Usar solo el **UID** de Firebase.
- Revisar requisitos de consentimiento (GDPR / ATT en iOS 14+): puede requerirse un prompt de tracking transparency antes de activar Analytics en iOS.
- Documentar la recolección de datos en la política de privacidad de la app.

---

## Criterios de aceptación

- [ ] Crash forzado de prueba aparece en Firebase Crashlytics con stacktrace legible.
- [ ] Navegar entre pantallas genera `screen_view` visibles en **DebugView**.
- [ ] Al menos 3 eventos de negocio (`puzzle_solved`, `language_changed`, uno de compra) se registran correctamente.
- [ ] Toda la instrumentación pasa por `AnalyticsService` / `ErrorHandler` (cero llamadas directas al plugin desde componentes).
- [ ] Errores y eventos se correlacionan con el UID del usuario tras login.

---

## Estado

**Pendiente de desarrollo.** Documento de diseño para implementación futura.
