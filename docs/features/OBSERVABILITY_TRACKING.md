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

## Catálogo de eventos (implementado)

Nombres en `snake_case`. La **entrada a cada pantalla** la cubre automáticamente `screen_view` (con `screen_name` legible); los eventos de abajo son **acciones semánticas** para funnels/segmentación. Toda la lógica de metadatos (`routine_*`, `screen_name`) vive en `apps/chessColate/src/app/services/analytics-events.util.ts`.

| Evento | Cuándo | Params | Ubicación |
|--------|--------|--------|-----------|
| `screen_view` | cada cambio de ruta (auto) | `screen_name` (legible: "Coordenadas", "Entrenamiento"…) | `app.component.ts` |
| `routine_started` | inicia una rutina (por defecto / infinity / reto333 / custom / pública) | `routine_kind` (`default`/`infinity`/`reto333`/`custom`/`public`), `routine_minutes`, `routine_category` (`bullet`/`blitz`/`rapid`/`classical`), `routine_name`, `routine_uid`*, `author_uid`*, `blocks_count` | `plan.service.ts`, `public-plans.component.ts` |
| `puzzle_started` | empieza un puzzle | `routine_kind`, `routine_minutes`, `theme`, `puzzle_elo` | `training.component.ts` |
| `puzzle_completed` | resuelve / falla / se acaba el tiempo | `result` (`good`/`bad`/`timeout`), `puzzle_elo`, `user_elo`, `resolved_time`, `first_theme`, `routine_kind`, `routine_minutes` | `training.component.ts` |
| `reto333_finished` | termina el Reto 333 | `solved_count`, `time_seconds`, `elo`, `completed`, `best_score` | `training.component.ts` |
| `coordinates_started` | empieza una partida de coordenadas | `board_orientation`, `infinite_mode`, `show_pieces`, `show_coordinates` | `coordinates.page.ts` |
| `coordinates_completed` | termina la partida de coordenadas | `score`, `correct_answers`, `incorrect_answers`, `accuracy`, `color`, `infinite_mode`, `is_new_record`, `record_type` | `coordinates.page.ts` |
| `knight_tour_started` | empieza el recorrido del caballo | `start_position` | `knight-tour.page.ts` |
| `knight_tour_completed` | completa o se queda sin movimientos | `completed`, `time_seconds`, `visited_count`, `start_position` | `knight-tour.page.ts` |
| `chess960_position_changed` | cambia/aleatoriza posición en el visor 960 | `position_id`, `source` (`manual`/`random`) | `chess960.page.ts` |
| `custom_plan_created` | crea una rutina personalizada | `plan_uid`, `is_public`, `blocks_count` | `custom-plans.service.ts` |
| `custom_plan_updated` | edita una rutina personalizada | `plan_uid`, `is_public` | `custom-plans.service.ts` |
| `public_plan_saved` | guarda/quita de guardados una rutina pública | `plan_uid`, `saved` | `public-plans.component.ts` |
| `language_changed` | cambia el idioma | `from`, `to` | `settings.page.ts` |
| `donation_completed` | completa una donación (RevenueCat OK) | `value`, `currency`, `item_id` | `donation.page.ts` |

\* `routine_uid`/`author_uid` solo en rutinas custom/públicas.

Además, el `CrashlyticsErrorHandler` reporta los errores JS no capturados como **non-fatals** a Crashlytics (nativo; no-op en web).

> Para que los params custom aparezcan en los **informes estándar** de GA4 (no solo en Realtime/DebugView), hay que registrarlos como **dimensiones personalizadas** en GA4 → Admin → Definiciones personalizadas.

---

## Consideraciones de privacidad

- **No** enviar PII (email, nombre real) como parámetros de evento ni como user property. Usar solo el **UID** de Firebase.
- Revisar requisitos de consentimiento (GDPR / ATT en iOS 14+): puede requerirse un prompt de tracking transparency antes de activar Analytics en iOS.
- Documentar la recolección de datos en la política de privacidad de la app.

---

## Criterios de aceptación

- [x] Navegar entre pantallas genera `screen_view` (con `screen_name` legible) visibles en **DebugView**.
- [x] Los eventos de negocio (`routine_started`, `puzzle_completed`, `language_changed`, `donation_completed`, etc.) se registran correctamente.
- [x] Toda la instrumentación pasa por `AnalyticsService` / `ErrorHandler` (cero llamadas directas al plugin desde componentes).
- [x] Errores y eventos se correlacionan con el UID del usuario tras login.
- [ ] Crash forzado de prueba aparece en Firebase Crashlytics con stacktrace legible (verificar en dispositivo Android).

---

## Estado

**Implementado en Android + Web.** iOS y follow-ups (registrar dimensiones personalizadas en GA4, Consent Mode, symbolication) quedan en [../PENDIENTES.md](../PENDIENTES.md) (sección 1).
