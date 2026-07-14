# Observabilidad — Referencia de implementación

Cómo quedó funcionando el **tageo (Firebase Analytics / GA4)** y el **tracking de errores
(Firebase Crashlytics)** en chessColate. Documento de referencia y mantenimiento.

- **Estado:** Implementado en **Android + Web** (release **2.0.5**, versionCode 22).
- **Pendiente:** iOS y follow-ups → [../PENDIENTES.md](../PENDIENTES.md) (sección 1).
- **Diseño original:** [OBSERVABILITY_TRACKING.md](./OBSERVABILITY_TRACKING.md).

---

## 1. Qué se hizo

- Se instrumentó la app con **Firebase Analytics** (pantallas + eventos de negocio) y
  **Firebase Crashlytics** (errores JS no capturados como *non-fatals* + crashes nativos).
- Toda la instrumentación pasa por **una fachada única** (`AnalyticsService`) y un
  **`ErrorHandler` global** — los componentes nunca llaman al plugin directamente. Así se
  puede cambiar de proveedor sin tocar la app.
- Reutiliza el proyecto Firebase existente (`projectId=chesscolate`, `measurementId=G-BERFF7M2CF`).

## 2. Arquitectura

```
Componentes / Router ──▶ AnalyticsService (fachada) ──▶ Firebase Analytics (GA4)
Errores JS no capturados ─▶ CrashlyticsErrorHandler (global) ─▶ Firebase Crashlytics
```

- **`AnalyticsService`** — envuelve el plugin de Analytics. API: `logEvent`, `logScreenView`,
  `setUserId`, `setUserProperty`, `setEnabled`. Todo defensivo (`try/catch`) y gateado por
  `environment.analyticsEnabled`. Funciona igual en web y nativo (Analytics tiene web).
- **`CrashlyticsErrorHandler`** — `implements ErrorHandler`. Siempre hace `console.error`; en
  nativo reporta `recordException` (non-fatal); en web es **no-op** (Crashlytics no tiene web).

## 3. Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `apps/chessColate/src/app/services/analytics.service.ts` | Fachada de Analytics + tipo `AnalyticsEventName` |
| `apps/chessColate/src/app/services/crashlytics-error-handler.ts` | ErrorHandler global → Crashlytics |
| `apps/chessColate/src/app/services/analytics-events.util.ts` | Metadatos de rutina (`routineMetaFromPlanType`, `minutesFromBlocks`) y nombres de pantalla (`screenNameFromUrl`) |
| `apps/chessColate/src/main.ts` | Registra `{ provide: ErrorHandler, useClass: CrashlyticsErrorHandler }` |
| `apps/chessColate/src/app/app.component.ts` | Init de plugins (`setEnabled`), screen tracking (Router `NavigationEnd`) y `setUserId` tras login |
| `apps/chessColate/src/environments/environment*.ts` | Flags `analyticsEnabled` / `crashlyticsEnabled` |
| `apps/chessColate/android/build.gradle` + `android/app/build.gradle` | Classpath + `apply plugin` de Crashlytics |
| `apps/chessColate/package.json` | Declara los plugins Capacitor (para que `cap sync` los detecte) |

## 4. Configuración (flags por entorno)

| Flag | dev (`environment.ts`) | prod (`environment.prod.ts`) |
|---|---|---|
| `analyticsEnabled` | `false` | `true` |
| `crashlyticsEnabled` | `false` | `true` |

- En `initFirebase()` (app.component) se llama `analyticsService.setEnabled(...)` y
  `FirebaseCrashlytics.setEnabled(...)` justo después de `initializeApp(...)`.
- El build de la tienda (AAB) usa `environment.prod.ts` → todo **activo automáticamente**.
- El comando `adb shell setprop debug.firebase.analytics.app com.jheison.chesscolate` es solo
  para **ver eventos al instante en DebugView** durante pruebas; no afecta a producción.

## 5. Web vs nativo

- **Analytics**: tiene implementación **web** (usa el SDK JS de Firebase con el `measurementId`).
  El `AnalyticsService` llama al plugin de forma uniforme; no bifurca plataforma.
- **Crashlytics**: **solo nativo** (Android/iOS). En web el `CrashlyticsErrorHandler` hace
  no-op silencioso (solo `console.error`).

## 6. Catálogo de eventos (as-built)

La **entrada a cada pantalla** la registra automáticamente `screen_view` (con `screen_name`
legible). El resto son **acciones semánticas**. Nombres y params en `snake_case`.

| Evento | Cuándo | Params | Origen |
|--------|--------|--------|--------|
| `screen_view` | cada cambio de ruta | `screen_name` (legible) | `app.component.ts` |
| `routine_started` | inicia una rutina | `routine_kind` (`default`/`infinity`/`reto333`/`custom`/`public`), `routine_minutes`, `routine_category` (`bullet`/`blitz`/`rapid`/`classical`), `routine_name`, `routine_uid`*, `author_uid`*, `blocks_count` | `plan.service.ts`, `public-plans.component.ts` |
| `puzzle_started` | empieza un puzzle | `routine_kind`, `routine_minutes`, `theme`, `puzzle_elo` | `training.component.ts` |
| `puzzle_completed` | resuelve/falla/timeout | `result` (`good`/`bad`/`timeout`), `puzzle_elo`, `user_elo`, `resolved_time`, `first_theme`, `routine_kind`, `routine_minutes` | `training.component.ts` |
| `reto333_finished` | termina el Reto 333 | `solved_count`, `time_seconds`, `elo`, `completed`, `best_score` | `training.component.ts` |
| `coordinates_started` | empieza coordenadas | `board_orientation`, `infinite_mode`, `show_pieces`, `show_coordinates` | `coordinates.page.ts` |
| `coordinates_completed` | termina coordenadas | `score`, `correct_answers`, `incorrect_answers`, `accuracy`, `color`, `infinite_mode`, `is_new_record`, `record_type` | `coordinates.page.ts` |
| `knight_tour_started` | empieza knight tour | `start_position` | `knight-tour.page.ts` |
| `knight_tour_completed` | completa o game over | `completed`, `time_seconds`, `visited_count`, `start_position` | `knight-tour.page.ts` |
| `chess960_position_changed` | cambia/aleatoriza posición | `position_id`, `source` (`manual`/`random`) | `chess960.page.ts` |
| `custom_plan_created` | crea rutina personalizada | `plan_uid`, `is_public`, `blocks_count` | `custom-plans.service.ts` |
| `custom_plan_updated` | edita rutina personalizada | `plan_uid`, `is_public` | `custom-plans.service.ts` |
| `public_plan_saved` | guarda/quita una pública | `plan_uid`, `saved` | `public-plans.component.ts` |
| `language_changed` | cambia idioma | `from`, `to` | `settings.page.ts` |
| `donation_completed` | donación exitosa | `value`, `currency`, `item_id` | `donation.page.ts` |

\* `routine_uid`/`author_uid` solo en rutinas custom/públicas.

**Nombres de pantalla** (`screen_name`): mapeados en `analytics-events.util.ts` — p. ej.
`/coordinates` → "Coordenadas", `/puzzles/training` → "Entrenamiento", `/knight-tour` →
"Recorrido del Caballo", `/chess960` → "Ajedrez 960", `/puzzles/custom-plans` → "Rutinas
personalizadas", `/puzzles/public-plans` → "Rutinas públicas". Rutas no mapeadas caen a la ruta cruda.

## 7. Cómo añadir un evento nuevo

1. Añade el nombre a `AnalyticsEventName` (unión cerrada) en `analytics.service.ts`.
2. En el choke point (preferir un **servicio** sobre la UI para cubrir todas las rutas), llama:
   `this.analyticsService.logEvent('mi_evento', { param_1: valor, param_2: 123 })`.
3. Params en `snake_case` y **primitivos** (GA4 no admite arrays → manda `first_theme` o un
   string, no el array completo).
4. Para verlo en los **informes estándar** de GA4, registra el param como **dimensión
   personalizada** (Admin → Definiciones personalizadas). En Realtime/DebugView se ve sin registrar.

## 8. Datos y privacidad

- Los eventos y errores se asocian al **UID de Firebase** tras login (`setUserId`); **nunca**
  se envía email ni nombre como parámetro.
- Recolección declarada en Play Store (Seguridad de los datos) y en la página de eliminación de
  cuenta: `apps/chessColate/src/assets/eliminar-cuenta.html` → publicada en
  `https://chesscolate.web.app/assets/eliminar-cuenta.html`.

## 9. Cómo verificar

- **Analytics (Android)**: `adb shell setprop debug.firebase.analytics.app com.jheison.chesscolate`
  → correr la app → Firebase Console → Analytics → **DebugView**.
- **Analytics (Web)**: Firebase → Analytics → **Realtime**, o DevTools → Network → filtrar
  `google-analytics.com/g/collect`.
- **Crashlytics**: forzar un error/crash desde la app → reabrir la app (el reporte sube en el
  siguiente arranque) → Firebase Console → **Crashlytics**.
