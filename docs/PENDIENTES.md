# Pendientes — ChessPark / chessColate

Backlog vivo de trabajos pendientes. Cada ítem indica estado, prioridad y contexto.
Estados: 🔴 pendiente · 🟡 en progreso · 🟢 hecho (se deja un tiempo como referencia).

> Relacionados: [DEUDA_TECNICA.md](./DEUDA_TECNICA.md) (deuda técnica) · [features/](./features/) (diseño de features).

---

## 1. Observabilidad (Analytics + Crashlytics)

Feature base: [features/OBSERVABILITY_TRACKING.md](./features/OBSERVABILITY_TRACKING.md).
Implementación Android + Web: **hecha**. Lo que queda:

### 1.1 iOS — activar Analytics + Crashlytics 🔴 (prioridad alta)

Se dejó fuera del primer entregable por el riesgo conocido de `static_framework`/subspec. Pasos:

1. **Podfile** — `apps/chessColate/ios/App/Podfile`, dentro de `def capacitor_pods` (respetar el prefijo `../../../../`):
   ```ruby
   pod 'CapacitorFirebaseAnalytics/Analytics', :path => '../../../../node_modules/@capacitor-firebase/analytics'
   pod 'CapacitorFirebaseCrashlytics', :path => '../../../../node_modules/@capacitor-firebase/crashlytics'
   ```
   La subspec `/Analytics` es la variante **sin AdId/IDFA** → evita el prompt ATT y simplifica el privacy manifest.
2. **Plist** — en `apps/chessColate/ios/App/App/GoogleService-Info.plist` poner `IS_ANALYTICS_ENABLED = true` (hoy está en `false`). Sin esto Analytics no recolecta en iOS aunque el pod esté enlazado.
3. **Sync + build** — `npm run ios:sync` y **compilar de verdad en Xcode**.
   - ⚠️ **Riesgo**: la subspec `Analytics` reproduce el bug de `static_framework` que ya rompió Authentication (el plugin queda `UNIMPLEMENTED`). Si pasa, hay que **extender `scripts/patch-capacitor-firebase-podspec.js`** para hacer *inline* de la subspec `Analytics` (igual que se hizo con `Google`) y usar `pod 'CapacitorFirebaseAnalytics'` sin subspec. Crashlytics no tiene subspecs → no necesita patch.
4. **Build phase dSYM (Crashlytics)** — en Xcode, target App → Build Phases → New Run Script:
   - Script: `"${PODS_ROOT}/FirebaseCrashlytics/run"`
   - Input Files: `${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}` y `$(SRCROOT)/$(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH)`
   - Sin esto los crashes iOS se reportan pero **no se simbolizan** (sin stacktrace legible).
5. **Verificar** en dispositivo físico: DebugView con launch arg `-FIRDebugEnabled` en el scheme de Xcode; forzar un crash, relanzar y confirmar en Firebase Console → Crashlytics.

### 1.2 Follow-ups de observabilidad 🔴 (prioridad media/baja)

- **Registrar dimensiones personalizadas en GA4** — los params custom ya se envían, pero para poder **filtrar/agrupar por ellos en los informes estándar** de GA4 hay que darlos de alta una vez en la consola: **Admin → Definiciones personalizadas → Crear dimensión personalizada**. En Realtime/DebugView se ven sin registrar; en los reportes normales, no. Lista a registrar:

  | Parámetro | Ámbito | Tipo | Notas |
  |---|---|---|---|
  | `routine_kind` | Evento | Texto | default/infinity/reto333/custom/public |
  | `routine_minutes` | Evento | (métrica, número) | registrar como *métrica personalizada* si se quiere promediar |
  | `routine_category` | Evento | Texto | bullet/blitz/rapid/classical |
  | `routine_name` | Evento | Texto | nombre real de la rutina |
  | `screen_name` | Evento | Texto | nombre legible de pantalla |
  | `result` | Evento | Texto | good/bad/timeout (puzzles) |
  | `theme` / `first_theme` | Evento | Texto | tema del puzzle |
  | `record_type` | Evento | Texto | coordenadas |
  | `start_position` | Evento | Texto | knight tour |
  | `saved` / `is_public` / `completed` / `is_new_record` | Evento | Texto | booleanos |

  > GA4 limita a 50 dimensiones personalizadas de ámbito evento; registrar solo las que se vayan a usar en reportes. Para análisis a medida sin este límite, usar el export a **BigQuery**.

- **`.eslintignore` para el build de Android** — `nx lint chessColate` falla porque ESLint escanea `apps/chessColate/android/app/build/intermediates/**` (bundles minificados: stockfish, chunks de Angular). Ese directorio está gitignored pero ESLint no lo ignora. **Añadir `**/android/**/build/**` (y análogos de iOS) al ignore de ESLint.** Es preexistente, no lo introdujo la observabilidad, pero conviene arreglarlo para que el lint vuelva a pasar.
- **Consentimiento GDPR / Consent Mode** — Analytics arranca habilitado en prod. Si hay foco en usuarios EU (web/tienda), hay que gatear la recolección tras consentimiento (Google Consent Mode) y documentarlo en la política de privacidad. Requerido también el ATT en iOS si algún día se usa IDFA.
- **Compra: evitar doble conteo** — RevenueCat tiene integración nativa con Firebase que puede enviar su propio evento de compra. Hoy emitimos `donation_completed` (nombre custom, no el reservado `purchase`) para no chocar. Si se activa la integración RevenueCat→Firebase, revisar que no se dupliquen métricas de ingresos.
- **Symbolication de errores JS (mejora)** — el `CrashlyticsErrorHandler` reporta `error.stack` como texto. Mejora opcional: parsear con `stacktrace-js` y pasar `stacktrace: StackFrame[]` a `recordException` para reportes mejor simbolizados en Crashlytics.
- **Catálogo de eventos versionado** — mantener un catálogo (este doc o el de la feature) con los nombres/params de eventos para no crear duplicados/inconsistentes al añadir nuevos.
- **User properties** — hoy solo se hace `setUserId`. Evaluar `setUserProperty` para segmentar (ej. idioma, elo bucket, plataforma).

---

## 2. Roadmap de features siguientes 🔴

Orden acordado (ver docs de diseño en [features/](./features/)):

1. **Notificaciones de Entrenamiento** — [features/NOTIFICACIONES_ENTRENAMIENTO.md](./features/NOTIFICACIONES_ENTRENAMIENTO.md). Siguiente en la fila (mayor ROI de retención; sus métricas ya se pueden medir con la observabilidad recién montada).
2. **Game Analytics** (chess.com/lichess) — [features/GAME_ANALYTICS.md](./features/GAME_ANALYTICS.md). Autocontenido, sin backend.
3. **Puzzle Feed** — [features/PUZZLE_FEED.md](./features/PUZZLE_FEED.md).
4. **Chess Runner** — [features/CHESS_RUNNER.md](./features/CHESS_RUNNER.md). Requiere assets pixel-art + cerrar decisiones abiertas del doc.
5. **Puzzle Geo Hunt** — [features/PUZZLE_GEO_HUNT.md](./features/PUZZLE_GEO_HUNT.md).
6. **Cuadros de Conquista** — [features/CUADROS_DE_CONQUISTA.md](./features/CUADROS_DE_CONQUISTA.md). El más complejo; necesita un *design spike* que cierre poderes/economía/matchmaking antes de codificar.
