# Pendientes — ChessPark / chessColate

Backlog vivo de trabajos pendientes. Cada ítem indica estado, prioridad y contexto.
Estados: 🔴 pendiente · 🟡 en progreso · 🟢 hecho (se deja un tiempo como referencia).

> Relacionados: [DEUDA_TECNICA.md](./DEUDA_TECNICA.md) (deuda técnica) · [features/](./features/) (diseño de features).

---

## 1. Observabilidad (Analytics + Crashlytics)

Diseño: [implementado/OBSERVABILITY_TRACKING.md](./implementado/OBSERVABILITY_TRACKING.md) · Referencia de cómo quedó: [implementado/OBSERVABILITY_REFERENCIA.md](./implementado/OBSERVABILITY_REFERENCIA.md).
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

## 2. Definir una estructura/convención de código 🔴 (prioridad media)

No hay una convención escrita de dónde va cada tipo de archivo, y la carpeta `services/` se ha convertido en un cajón de sastre. **Pendiente: acordar la estructura, documentarla (en este repo o en [STYLE_GUIDE.md](./STYLE_GUIDE.md)) y luego migrar.** No tocar código todavía.

Síntomas concretos hoy en `apps/chessColate/src/app/`:

- **Utils dentro de `services/`** — ✅ `training-reminder.util.ts` ya se resolvió: se migró a `features/reminders/` (ver [ARQUITECTURA.md](./ARQUITECTURA.md), «Organización por funcionalidad»), que es la convención acordada y se aplicará al resto de funcionalidades. Sigue pendiente `analytics-events.util.ts`, y el resto de utils sueltos. Son funciones puras, no servicios inyectables. Decidir si van a un `utils/` local, junto a su feature, o a la lib compartida [libs/common-utils/](../libs/common-utils/).
- **Archivos que no son servicios ni utils** — `crashlytics-error-handler.ts` (provider de Angular) también vive en `services/`.
- **Config suelta en la raíz de `app/`** — `features/training/config/plan-allowed-themes.config.ts` está al mismo nivel que `app.component.ts` y `app.routes.ts`.
- **Orden de componentes** — `shared/components/` solo agrupa por "es compartido", sin criterio de qué merece estar ahí frente a vivir junto a su página. Revisar también la organización dentro de `pages/`.
- **Sin sitio definido para modelos/tipos locales** — existe [libs/models/](../libs/models/), pero no está escrito qué va ahí y qué se queda en la app.

Decisiones a cerrar antes de mover nada:

1. ¿Estructura por capa (`services/`, `utils/`, `models/`) o por feature (todo lo de una feature junto)?
2. ¿Qué criterio promueve un archivo de la app a `libs/`?
3. ¿Convención de sufijos (`.util.ts`, `.config.ts`, `.service.ts`) y regla de una responsabilidad por archivo?

> Relacionado con los hallazgos P0.1/P0.2 (god-services y god-components) de [DEUDA_TECNICA.md](./DEUDA_TECNICA.md): reordenar carpetas sin partir esos archivos grandes solo mueve el problema de sitio.

---

## 3. Roadmap de features siguientes 🔴

Ya implementadas: Notificaciones de Entrenamiento (F02), Game Analytics (F12) y Método del Pájaro Carpintero (F08) y Chess Runner (F11). Lo que sigue, en orden
(diseños en [features/](./features/)):

1. **Rutina con BD de Puzzles Personalizada (PGN)** — [features/RUTINA_PGN_PERSONALIZADA.md](./features/RUTINA_PGN_PERSONALIZADA.md). Siguiente en la fila: reutiliza el set congelado del Pájaro Carpintero (`WoodpeckerSet`, que ya guarda su `source`).
2. **Analizador de Partidas** — [features/ANALIZADOR_PARTIDAS.md](./features/ANALIZADOR_PARTIDAS.md).
3. **Puzzle Feed** — [features/PUZZLE_FEED.md](./features/PUZZLE_FEED.md).
4. Después: Sparring Personalizado, Cuadros de Conquista (necesita un *design spike* antes de codificar), Puzzle Racer, Puzzle Geo Hunt y Jugar en Lichess.

> El orden vivo está en [features/README.md](./features/README.md), que es el que se
> mantiene al día conforme salen features.

---

## 4. Calificar la app (In-App Review) — verificación 🔴 (prioridad media)

Implementado y documentado en [implementado/CALIFICAR_APP_FLOW.md](./implementado/CALIFICAR_APP_FLOW.md).
Lo que no se puede cerrar desde el entorno de desarrollo:

- **Probar la tarjeta nativa en un canal de pruebas de Play Store** 🔴 — en `debug`
  la llamada no falla pero no muestra nada, que es el comportamiento esperado. Para
  verla de verdad hace falta la app instalada desde Play (internal testing sirve).
- **Comprobar que "Califícanos" abre la ficha** 🔴 — se usa `market://details?id=…`
  en Android nativo y la URL web en el resto; conviene confirmarlo en dispositivo.
- **iOS** 🔴 — el plugin soporta `SKStoreReviewController` y la lógica es la misma,
  pero falta `npx cap sync ios`, validarlo en dispositivo y apuntar la fila de
  Ajustes a la App Store en vez de a Play.
- **Mirar la distribución de `trigger`** en GA4 tras unas semanas: si casi todo
  entra por `grace_window`, los umbrales de "buena rutina" están demasiado altos.

---

## 5. Reproductor de Partidas — verificación y catálogo 🔴 (prioridad media)

Implementado y documentado en [implementado/REPRODUCTOR_PARTIDAS_FLOW.md](./implementado/REPRODUCTOR_PARTIDAS_FLOW.md).
Lo que queda:

- **Probarlo en un móvil** 🔴 — compila y los tests de la lógica pasan, pero el
  tablero, la descarga real desde el CDN y el encadenado del modo TV no se han
  ejecutado en un dispositivo. Comprobar sobre todo que la pantalla se queda
  encendida al reproducir y **se suelta al salir**.
- **Completar el catálogo** 🔴 — hoy hay tres campeones (Alekhine, Anand y
  Petrosian). Los demás salen de [PGN Mentor](https://www.pgnmentor.com/files.html)
  y **no requieren tocar la app**: dejar el `.pgn` en `players/`, añadir su
  entrada en `players.meta.json`, ejecutar `node tools/build-index.mjs` y hacer
  push en [chesscolate_pngs_packs](https://github.com/json-alzate/chesscolate_pngs_packs).
- **Mirar `games_pack_downloaded`** tras unas semanas: dice qué campeones pide
  la gente y por tanto a quién añadir después.
- **Segunda entrega**: listas de reproducción y la lista automática de "me
  gusta" (ver el documento de la feature).

---

## 6. Directo 24/7 a YouTube (F18) 🔴 (prioridad alta)

Diseño: [features/TRANSMISION_24_7.md](./features/TRANSMISION_24_7.md). Hecho: la app `live-stream`, el runner (reinicio
solo si cae ffmpeg/Chrome o se congela la página), la música y la pantalla pública de créditos. Lo que falta, **en este orden**:

- **Canal personal listo** 🔴 — verificar por teléfono y activar la transmisión en vivo (hasta 24 h de espera, así que se hace primero).
- **Publicar ChessColate** 🔴 (PR #36) — la descripción del directo enlaza a `https://chesscolate.web.app/settings/credits`; sin el despliegue daría 404 y las licencias CC BY exigen esa lista pública.
- **Prueba de derechos de la música** 🟡 — los 6 videos se generan con `tools/stream-runner/rights-check.mjs` y ya están subidos. Resultado hasta ahora: video 1 limpio; video 5 con un reclamo (**Robbero – Whisper**, ya retirada: quedan 87 pistas). **Falta confirmar los videos 2, 3, 4 y 6** (están como borrador). La pantalla de créditos de la app aún lista Whisper hasta el próximo despliegue. Ver [Plan de derechos](./features/TRANSMISION_24_7.md#plan-de-derechos-de-la-música).
- **Primer directo no listado (2–3 h)** 🔴 — el envío por RTMP **nunca se ha probado contra YouTube**. Ver [Prueba en el canal personal](./features/TRANSMISION_24_7.md#prueba-en-el-canal-personal).
- **LaunchAgent** 🔴 — que el directo vuelva solo tras un reinicio o un corte de luz. **Requiere tu aprobación explícita** y el inicio de sesión automático del Mac. Ver [LaunchAgent](./features/TRANSMISION_24_7.md#launchagent-arranque-automático).
- **Aviso de caída por correo** 🔴 — latido a un servicio externo (recomendado) o SMTP desde el Mac. Ver [Aviso de caída](./features/TRANSMISION_24_7.md#aviso-de-caída-por-correo).
- **Directo no listado de 24 h seguidas** 🔴 — antes de hacerlo público.
- **Política de YouTube** 🔴 — revisar las reglas vigentes de directos 24/7 repetitivos y los límites del archivo de directos.

---

## 7. Método del Pájaro Carpintero (F08) — verificación 🔴 (prioridad media)

Implementado y documentado en [implementado/PAJARO_CARPINTERO_FLOW.md](./implementado/PAJARO_CARPINTERO_FLOW.md).
Recorrido en navegador móvil con el catálogo real: hecho. Lo que no se puede cerrar desde el entorno de desarrollo:

- **Probarlo en un móvil de verdad** 🔴 — sobre todo el panel de fallo anclado al borde inferior (zona de gestos de iOS), el teclado de los controles de la configuración y que el set grande (500) se guarde sin problemas en WebView.
- **Mirar `woodpecker_plan_created` / `woodpecker_set_short`** tras unas semanas: dicen qué tamaños y rangos pide la gente y si el 70 % de mínimo es demasiado estricto.
- **Mirar `woodpecker_plan_abandoned`** (con `cycles_done`): si casi todos abandonan en la vuelta 1, el set por defecto (100 ejercicios, ≈ 40 min por vuelta) es demasiado grande.
- **Sincronizar el set con la cuenta** 🔴 — hoy solo vive en el dispositivo; encaja con la decisión pendiente del historial de rutinas (`TODO(premium)`).

---

## 8. Tablero redimensionable — verificación 🔴 (prioridad baja)

Implementado y documentado en [implementado/TABLERO_REDIMENSIONABLE_FLOW.md](./implementado/TABLERO_REDIMENSIONABLE_FLOW.md).
Probado con ratón en un navegador de escritorio. Pendiente:

- **Probarlo en un iPad con trackpad o ratón** 🔴 — el asa depende de `hover` y puntero fino; en iPadOS con ratón
  debería aparecer, pero no se ha comprobado en un dispositivo.
- **El reproductor de partidas no lo usa** 🔴 — tiene su propio layout (`games/viewer`) y su tablero no se agranda.
  Si se quiere, hay que pasarlo a `cc-board-column` y decidir su reserva de alto.

---

## 9. Chess Runner (F11) — verificación 🔴 (prioridad media)

Implementado y documentado en [implementado/CHESS_RUNNER_FLOW.md](./implementado/CHESS_RUNNER_FLOW.md). Probado en un navegador
móvil con gestos táctiles reales y con el teclado. Lo que no se puede cerrar desde el entorno de desarrollo:

- **Probarlo en un móvil de verdad** 🔴 — la sensación del salto y de los gestos (¿se siente justo?) solo se juzga con el
  pulgar. Si resulta difícil o fácil, se ajusta `config/runner.config.ts` (las pruebas de equilibrio dicen qué margen queda).
- **Mirar `chess_runner_finished`** tras unas semanas: `skipped` alto = la carrera molesta; `clean` bajo = es demasiado dura.
- **Llevarlo delante de las rutinas** 🔴 — hoy es un modo suelto del menú. Meterlo antes de cada ejercicio de las rutinas
  (con un interruptor en Ajustes) es la segunda fase; toca `TrainingPage`.
- **Sonidos propios** 🔴 (salto, tropiezo, llegada) y respetar «reducir movimiento» del sistema.

## 10. Hallazgos de la pasada de pruebas 🔴 (prioridad baja)

Salieron al recorrer la app entera en móvil y escritorio, y no se arreglaron por salirse del alcance:

- **No se puede borrar una sesión personalizada** 🔴 — `CustomPlansService` solo tiene `getById`, `save` y `update`; la lista
  (`/puzzles/custom-plans`) no ofrece borrar. Hace falta borrado en Firestore, quitarla del store, retirar su copia pública
  (`PublicPlanRepository`) y revisar las reglas de seguridad (no están en este repo).
- **El contador del bloque cuenta ejercicios jugados, no resueltos** — tras fallar el primero del Reto 333 el encabezado dice
  «1 / 333» y el resultado «0 / 333». Es el comportamiento de siempre en todas las rutinas; decidir si se quiere cambiar.
- **Errores 401 de RevenueCat en la web** — esperados sin credenciales de la tienda; ensucian la consola en desarrollo.

