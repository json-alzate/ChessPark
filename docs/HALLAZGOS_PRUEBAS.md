# Hallazgos al completar la suite de pruebas

> **Fecha:** 2026-10-10 · Origen: la suite unitaria y E2E que se escribió antes de
> reorganizar el código ([ARQUITECTURA.md](./ARQUITECTURA.md)).
>
> **Ninguno de estos puntos está corregido.** El objetivo del trabajo era no cambiar
> el comportamiento de la app, así que las pruebas fijan lo que el código hace hoy y los
> bugs probables quedan como `it.skip('BUG: …')` con la prueba del comportamiento
> correcto ya escrita: al corregir el código basta con quitar el `skip`.
>
> **Estado de verificación:** ✅ = lo comprobé yo leyendo el código · 🧪 = el agente que
> escribió la prueba lo reprodujo ejecutándola · ❔ = solo reportado, sin verificar
> (léelo antes de actuar).

## Probables bugs (con `it.skip`)

| # | Qué | Dónde | Verif. |
|---|---|---|---|
| 1 | **Elo de arranque de rutinas propias y públicas siempre es el de `plan5Total`.** Los umbrales (3000 / 6000 / 12000) se comparan con el tiempo de los bloques, que está en **segundos**: son 50 / 100 / 200 min, y cualquier rutina real (300–1800 s) cae en la primera franja. Parecen pensados para 300 / 600 / 1200. La regla está **repetida en tres sitios**. | `custom-plans-list.component.ts` (`play`), `custom-plan-form.component.ts` (`getEloToStart`), `public-plans.component.ts` (`onPlayPlan`) | ✅ |
| 2 | **Recursión infinita en el visor de partidas** en modo TV con repetición si ninguna partida se deja leer (`RangeError: Maximum call stack`). | `pages/games/viewer/viewer.page.ts` (`loadGame` ↔ `goToNextGame`) | 🧪 |
| 3 | **Hora vacía en recordatorios:** un campo de hora vacío guarda hora 0 con minuto `undefined` (`''.split(':').map(Number)` da `[0]` y `Number.isNaN(undefined)` es `false`). | `reminders.page.ts` (`onReminderTimeChange`), `manual-reminder-modal.component.ts` (`save`) | 🧪 |
| 4 | **Tocar un recordatorio manual o de prueba no abre `/home`**: el listener solo reacciona a `source === 'training_reminder'`; los manuales llevan `training_reminder_manual` y la prueba `training_reminder_test`. La documentación dice que al tocar se abre el home sin distinguir tipo. Puede ser intencional. | `training-reminder.service.ts` (`init`) | ❔ |
| 5 | **`calculateEloPuzzlePlan` muta el estado del store** (copia superficial de `profile.elos` y escribe en `${plan}Max` / `${plan}MaxOpenings`). | `profile.service.ts` | ❔ |
| 6 | **Primera apertura de un plan no cambia el elo** si el perfil tiene `elos` pero no el mapa `${plan}Openings` (se queda en 1500 aunque acierte). Sin `profile.elos` sí lo calcula. | `profile.service.ts` | ❔ |

## Encontrados al recorrer la app en E2E

| # | Qué | Verif. |
|---|---|---|
| 7 | **`/games` sigue mostrando un paquete ya borrado**: solo carga la lista en `ngOnInit`; al volver desde la lista del campeón el catálogo enseña el paquete en "On your device". Está como `test.fixme` en `partidas.spec.ts` (basta quitar el `.fixme` al corregirlo, p. ej. con `ionViewWillEnter`). | 🧪 |
| 8 | **Error de descarga en Análisis se ve como "sin partidas"**: con lichess 429 o un mes con 500 en chess.com, `GamesArchive.sync` solo cuenta `monthsFailed` y la pantalla dice "We found no games in that period". El mensaje `syncFailed` casi nunca sale. | 🧪 |
| 9 | **Racha: "New streak" desde la pantalla de error pierde la racha**: el reintento llama a `startRun` sin `finishRun`, así que no se guarda como récord (salir por "Back to home" sí). | 🧪 |

## Comportamientos dudosos (la prueba fija el comportamiento actual)

- **Textos sin traducir o con typos:** el historial muestra "1 plan guardados", "17% correctos" y títulos "Plan 1" en vez de "Bullet" (`getPlanTypeName` con nombres en español fijos); la descripción del Reto 333 sale "Mate en 1" con la UI en inglés (`buildReto333Blocks`); el navbar dice "Login / Sing up" (`AUTH.login.menuBar`). ❔
- **`ion-loading` "Iniciando…"** puede seguir en el DOM tapando clics sobre el tablero con la máquina cargada. ❔
- **`#main-content` queda con `aria-hidden="true"`** varios segundos tras elegir la salida con `ion-select` en el recorrido del caballo (posible rareza de Ionic con popover dentro de sheet modal). ❔
- **`getPuzzles` no deduplica por `uid`**: con el CDN real no ocurre, pero con datos repetidos un bloque trae el mismo puzzle varias veces. ❔
- **`/puzzles/public-plans` sin sesión** muestra "No public sessions available" cuando falla la red, sin distinguir un error de que no haya rutinas. ❔

- **Modal de recordatorio manual:** si guardar falla o devuelve `null` (tope de 15), `saving` queda en `true` y el botón se bloquea; con `null` además cierra como si hubiera guardado. ❔
- **Donación:** una compra que devuelve algo sin `customerInfo` no muestra toast ni evento (silencio total). Los toasts están en español fijo, sin i18n. ❔
- **`plans-elos.service`:** el primer elo de un tema o apertura cuenta siempre como récord, aunque se pierda; y `planElos.total || 1500` trata un 0 guardado como 1500 mientras `plan.service` usa `??`. ❔
- **`custom-plans.service.save`:** si `syncPlanToPublic` falla, el plan ya quedó en Firestore y en el store pero el formulario recibe el error. Reintentar es seguro (upsert). ❔
- **`profile.repository.checkNickname`:** declara `Promise<string[]>` pero devuelve objetos `{nickname, uidUser}`. ❔
- **`infinity-puzzle-pool.buildPool`:** si ya hay una construcción en curso y llega otra con otro elo, se une a la primera y se ignora el elo nuevo. ❔
- **`coordinates/storage.service.getAllGames`** lanza con JSON corrupto (sin `try/catch`). ❔
- **`AnalyticsService.setUserId`** no respeta `analyticsEnabled`, al contrario que `logEvent`, `logScreenView` y `setUserProperty`. Puede ser intencional. ❔
- **Historial de rutinas:** "1 plan guardados" (falta concordancia) y "Hoy/Ayer" se calcula con 24 h mientras la racha usa días de calendario. ❔
- **`custom-plan-form`:** `planElosForBlocks$` es un getter que crea un Observable nuevo en cada detección de cambios; hoy no se nota porque la facade emite síncrono. Si `getById` rechaza al editar, el rechazo queda sin manejar. ❔
- **Coordenadas:** `<app-settings-side-menu [isPlaying]>` enlaza un `@Input` que no existe (binding muerto); los umbrales de color de la barra tras un fallo (15) no coinciden con los del reloj (20 y 10). ❔
- **`knight-tour`:** alert de game over con textos fijos en español ("Game Over", "Reiniciar", "Cerrar") y `console.log` sueltos. ❔
- **Login:** la validación `notMatch` solo se recalcula al cambiar `rePassword`, no al cambiar `password` (se compensa al enviar). ❔
- **Menores:** `console.log` de depuración en `plans-elos.repository.getPlansElos`; el comentario de `plan-allowed-themes.config.ts` dice que `plan30` incluye `mateIn1` y la lista no lo tiene. ❔

## Deuda que quedó en las pruebas

- **Tablero real, Ionic, Chart.js y Stockfish están sustituidos por dobles** en las unitarias (`cm-chessboard` no carga en Jest). El renderizado real solo lo cubren las E2E.
- **`donation-modal`:** su HTML vive dentro del `ng-template` de `ion-modal`; solo se prueba la clase.
- **`home.page`:** la prueba "solo carga el puzzle continuo una vez por visita" es débil (el selector ya filtra repetidos y no ejercita el guard).
- **`keys.ts`** (ignorado por git) lo necesitan los specs que importan `environment` sin doblarlo; en un equipo sin ese archivo fallarían. No hay CI hoy.
- **Sin sesión iniciada ni funciones nativas en E2E:** no se puede simular Firebase Auth/Firestore; la pantalla de recordatorios en web solo avisa de que funciona en el móvil.
- **Guards que no se pueden probar sin sesión en E2E:** `CustomPlansGuard` siempre deja pasar y solo carga datos si hay sesión; quitarlo no cambia nada visible como invitado. Lo cubre la prueba unitaria de `app.routes`.
- **E2E sin bloques por cantidad** (`warmup`, `backToCalm`: no hay botón para llegar a ellos) y sin recorrer Rapid+/Classical completos; las capturas de rutinas completas se omitieron a propósito porque dependen del puzzle que sortea `Math.random`.
- **Los E2E dependen de la build de desarrollo** (leen el puzzle con `window.ng.getComponent`). No usar el build de producción para correrlos.
- **Bajo carga intermitente:** una suite (`board-orientation-controls`) falló una vez con la máquina saturada y pasa sola en todas las zonas horarias. Probable límite de 5 s de Jest en `compileComponents()`; ver si conviene subir `testTimeout`.
