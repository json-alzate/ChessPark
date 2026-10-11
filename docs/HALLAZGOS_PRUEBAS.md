# Hallazgos al completar la suite de pruebas

> **Fecha:** 2026-10-10 · Origen: la suite unitaria y E2E que se escribió antes de
> reorganizar el código ([ARQUITECTURA.md](./ARQUITECTURA.md)).
>
> **Actualización 2026-10-11:** una pasada exhaustiva con `/chesscolate:probar` corrigió varios
> de estos puntos (marcados **✔ corregido** más abajo) y añadió otros; ver
> [la sección nueva al final](#pasada-exhaustiva-2026-10-11). El resto sigue sin corregir.
>
> **Lo que no está marcado como corregido no lo está.** El objetivo del trabajo era no cambiar
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
| 1 | **✔ corregido** · **Elo de arranque de rutinas propias y públicas siempre es el de `plan5Total`.** Los umbrales (3000 / 6000 / 12000) se comparan con el tiempo de los bloques, que está en **segundos**: son 50 / 100 / 200 min, y cualquier rutina real (300–1800 s) cae en la primera franja. Parecen pensados para 300 / 600 / 1200. La regla está **repetida en tres sitios**. | `custom-plans-list.component.ts` (`play`), `custom-plan-form.component.ts` (`getEloToStart`), `public-plans.component.ts` (`onPlayPlan`) | ✅ |
| 2 | **✔ corregido** · **Recursión infinita en el visor de partidas** en modo TV con repetición si ninguna partida se deja leer (`RangeError: Maximum call stack`). | `pages/games/viewer/viewer.page.ts` (`loadGame` ↔ `goToNextGame`) | 🧪 |
| 3 | **✔ corregido** · **Hora vacía en recordatorios:** un campo de hora vacío guarda hora 0 con minuto `undefined` (`''.split(':').map(Number)` da `[0]` y `Number.isNaN(undefined)` es `false`). | `reminders.page.ts` (`onReminderTimeChange`), `manual-reminder-modal.component.ts` (`save`) | 🧪 |
| 4 | **Tocar un recordatorio manual o de prueba no abre `/home`**: el listener solo reacciona a `source === 'training_reminder'`; los manuales llevan `training_reminder_manual` y la prueba `training_reminder_test`. La documentación dice que al tocar se abre el home sin distinguir tipo. Puede ser intencional. | `training-reminder.service.ts` (`init`) | ❔ |
| 5 | **`calculateEloPuzzlePlan` muta el estado del store** (copia superficial de `profile.elos` y escribe en `${plan}Max` / `${plan}MaxOpenings`). | `profile.service.ts` | ❔ |
| 6 | **Primera apertura de un plan no cambia el elo** si el perfil tiene `elos` pero no el mapa `${plan}Openings` (se queda en 1500 aunque acierte). Sin `profile.elos` sí lo calcula. | `profile.service.ts` | ❔ |

## Encontrados al recorrer la app en E2E

| # | Qué | Verif. |
|---|---|---|
| 7 | **✔ corregido** · **`/games` sigue mostrando un paquete ya borrado**: solo carga la lista en `ngOnInit`; al volver desde la lista del campeón el catálogo enseña el paquete en "On your device". Está como `test.fixme` en `partidas.spec.ts` (basta quitar el `.fixme` al corregirlo, p. ej. con `ionViewWillEnter`). | 🧪 |
| 8 | **Error de descarga en Análisis se ve como "sin partidas"**: con lichess 429 o un mes con 500 en chess.com, `GamesArchive.sync` solo cuenta `monthsFailed` y la pantalla dice "We found no games in that period". El mensaje `syncFailed` casi nunca sale. | 🧪 |
| 9 | **✔ corregido** · **Racha: "New streak" desde la pantalla de error pierde la racha**: el reintento llama a `startRun` sin `finishRun`, así que no se guarda como récord (salir por "Back to home" sí). | 🧪 |

## Comportamientos dudosos (la prueba fija el comportamiento actual)

- **Textos sin traducir o con typos** (el historial, "1 plan guardados" y los títulos "Plan 1" quedaron ✔ corregidos el 2026-10-11): el historial muestra "1 plan guardados", "17% correctos" y títulos "Plan 1" en vez de "Bullet" (`getPlanTypeName` con nombres en español fijos); la descripción del Reto 333 sale "Mate en 1" con la UI en inglés (`buildReto333Blocks`); el navbar dice "Login / Sing up" (`AUTH.login.menuBar`) ✅ (visto en las capturas de `/chesscolate:probar`).
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
- **`knight-tour`:** alert de game over con textos fijos en español ("Game Over", "Reiniciar", "Cerrar") y `console.log` sueltos. ✔ corregido el 2026-10-11
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
- **Equipo con 8 GB de RAM:** con muchos workers de Jest a la vez (más `tsc`, `eslint` o una compilación), alguna suite falló de forma esporádica (`custom-plan.repository`, `appearance.service`, `count-up`, las de coordenadas…) y siempre pasó al repetir, sola o en la suite completa, también con la caché fría. No se encontró otra causa; limitar workers (`--maxWorkers=3`) lo evita.
- **Dependencia circular `reminders` ↔ `training`** (ver ARQUITECTURA.md, sección 2).
- **Lint previo a este trabajo:** 27 errores en `apps/chessColate` (`no-empty-function`, `no-case-declarations`, `prefer-const`…), iguales antes y después de la reorganización. `npx eslint` desde la raíz usa otra configuración que `nx lint` desde la carpeta de la app.
- **Bajo carga intermitente:** una suite (`board-orientation-controls`) falló una vez con la máquina saturada y pasa sola en todas las zonas horarias. Probable límite de 5 s de Jest en `compileComponents()`; ver si conviene subir `testTimeout`.


## Pasada exhaustiva 2026-10-11

Recorrido con `/chesscolate:probar` (red real, Firebase real, rama `refactor/organizacion-por-funcionalidad`).
Evidencia y reporte completo en `docs/local/exhaustiva-2026-10-11/` (no va al repo).

**Corregidos en esa pasada** (cada uno con prueba unitaria y/o E2E):

| Qué | Dónde |
|---|---|
| Una ruta inexistente dejaba la pantalla en blanco (no había `**`) | `app.routes.ts` |
| "Start" fijo en inglés en la presentación del bloque | `block-presentation.component` |
| Aviso de Ionic: `initialBreakpoint` fuera de `breakpoints` (modal de estadísticas del inicio) | `home.page.html` |
| Icono `bulb-outline` sin registrar en el visor de solución (botón "Pedir una pista" sin icono) | `board-puzzle-solution.component.ts` |
| El aviso "las contraseñas no coinciden" nunca se veía (el campo es válido para el navegador) | `login.component.html` |
| El aviso de error de login no se quitaba nunca y tapaba el botón "Iniciar sesión" (no se podía reintentar) | `login.component.*` |
| "Añadir" del bloque quedaba fuera de pantalla con una sección abierta (máximo de la hoja 0.9) | `custom-plan-form.page.ts` |
| Una sesión propia con nombre de solo espacios se guardaba; la lista ahora cae en "Sin título" | `custom-plan-form.page.ts`, `custom-plans-list.page.html` |
| "1 Bloques" → "1 Bloque" | `custom-plans-list.page.html` |
| Historial: "planes guardados", "correctos" y "Plan 1" en español fijo; ahora traducido y con el nombre real (Bullet, Blitz…) | `plans-history.page.*` |
| Recorrido del caballo: alerta de Game Over en español fijo y `console.log` sueltos | `knight-tour.page.ts` |
| Chess960: un decimal (1.5) o el campo vacío quedaban como posición | `chess960.page.ts` |
| Botones del navbar (menú y recordatorios) sin nombre accesible | `navbar.component.html` |
| `Missing translation for 'AUTH.errors.'` al renderizar el aviso vacío del registro | `login.component.html` |
| Título "ejercicios" en minúscula en la hoja de bloque | `block-settings.component.html` |

**Siguen sin corregir** (producto o fuente de datos):

- ❔ **RevenueCat devuelve 401 en web** para todo usuario con sesión (`api.revenuecat.com/v1/subscribers/<uid>` y `e.revenue.cat/v1/events`): ~430 peticiones fallidas en una sesión de ~1 h, "Restaurar compras" muestra "Error al restaurar compras". La clave configurada no es válida para RevenueCat Web. Fuente de datos/configuración.
- ❔ **No hay forma de borrar la cuenta dentro de la app.** App Store exige poder iniciar el borrado desde la app si se puede crear cuenta.
- ❔ **Guardar una sesión propia sin conexión** deja el spinner y el botón bloqueados sin ningún aviso hasta que vuelve la red (la escritura queda en cola de Firestore y se completa sola al volver). `saveAndPlay`/`save` no tienen `catch`.
- ❔ **Atrás del navegador a mitad de un entrenamiento** sale al inicio sin confirmar; la "X" sí pregunta. Y la alerta de la "X" no pausa el reloj del puzzle.
- ❔ Una jugada incorrecta en Bullet o en el mate del onboarding no da ninguna señal en pantalla (pasa al siguiente puzzle / reinicia el tablero).
- ❔ El avatar del navbar parece un botón y no hace nada.
- ❔ Gráfico de estadísticas del inicio sin datos: ejes -1…1 sin mensaje de "sin datos" y la etiqueta "1" se superpone al botón "Peores".
- ❔ Tema claro `wireframe`: "Empezar sesión" y el elo de la tarjeta se ven casi deshabilitados (contraste).
- ❔ Consola del tablero: `JSHandle@node without parentNode` (~50), `no piece on X`, `setOrientation is only once in queue allowed`.
- ❔ `<meta name="apple-mobile-web-app-capable">` está obsoleto (`mobile-web-app-capable`).
- ❔ `/privacy` solo existe en inglés.
- ❔ Con "3 meses" elegidos, Análisis dice "2 partidas en el último año".


### Segunda tanda: tablero "congelado", ciegas, confeti y rutinas completas

Se jugaron con datos reales y con puzzles reales con coronación servidos con `page.route`
(≈19 000 del CDN con coronación, 4 300 con enroque, 700 con captura al paso), con ratón y con
**dedo** (eventos táctiles reales por CDP), en Racha y en todas las rutinas (Bullet, Blitz,
Blitz+, Rápida, Rápida+ y Clásica completas, 30 min la última, con su bloque a ciegas).

**Corregidos** (cada uno con prueba unitaria y, los de tablero, también E2E en
`specs/rutinas-tablero-bloqueado.spec.ts`, que falla sin el arreglo y pasa con él):

| Qué pasaba | Dónde |
|---|---|
| Si se acababa el tiempo del ejercicio (o se saltaba/fallaba) con el **diálogo de coronación abierto**, ese diálogo quedaba dibujado sobre el puzzle siguiente; el primer toque se gastaba en cancelarlo y elegir una pieza ejecutaba la jugada vieja. | `libs/board` · `promotion-dialog.ts`, `board-puzzle.component.ts` |
| Si el tiempo se acababa con el **dedo apoyado en una pieza**, el soltar se perdía (la pieza arrastrada desaparece al redibujar): el tablero quedaba en `dragTo` con una **pieza fantasma** encima del puzzle nuevo y el primer toque se perdía. | `libs/board` · `cancel-move-input.ts` |
| **Deslizar el dedo desde el borde izquierdo** del tablero (arrastrar una pieza de la columna "a" hacia la derecha) activaba el "volver atrás" de iOS: sacaba de la rutina o, si el gesto se cancelaba a medias, dejaba la pantalla con el reloj del bloque parado. | `app.component.ts`, `core/app/swipe-back.util.ts` |
| Si se abría la solución de un ejercicio justo con el **reloj del bloque en 00:00**, el reloj quedaba parado para siempre y el bloque no terminaba nunca (126 ejercicios seguidos en un bloque de 2 min). | `training-timer.service.ts` |
| El **confeti** se dibujaba detrás de los modales (z-index 0 frente a 20 003): en Coordenadas, Racha y resumen de rutina solo asomaba por la franja de arriba. | `common-utils` · `confetti.service.ts` |

**Sin hallazgos** (probado y funciona): enroque y captura al paso del usuario y de la máquina,
subcoronaciones (caballo, alfil, torre), coronar arrastrando o tocando, cancelar el diálogo
(Escape, fuera, clic derecho, tocar otra pieza), esperar 15 s con el diálogo abierto, girar el
tablero con el diálogo abierto, coronar a ciegas, coronar en el visor de solución (pieza buena y
mala, juego libre posterior), solución en "stream" tras coronar, ejercicios a ciegas (se ocultan
a los N s, al fallar se revelan), cambio de bloque con el diálogo abierto.

**Sin corregir (producto):**

- ❔ "Cargando ejercicios… 3/4": si un archivo del CDN tarda, la carga de una rutina puede pasar de 1 min sin tiempo máximo ni cancelar.
- ❔ Racha: si el récord local se borra y el del perfil llega a mitad de una racha, la pantalla de fin dice "¡Nuevo récord!" con un resultado menor al récord que muestra al lado.
- ❔ Resumen de rutina: la mascota junto al ELO queda recortada por el borde derecho.
- ❔ El visor de solución muestra un "Queen" suelto (región de accesibilidad de cm-chessboard) en el texto de la pantalla.
- ❔ Cada resultado de ejercicio hace ~1 escritura a Firestore (cientos por rutina larga).
- ❔ `libs/board`: 4 specs de plantilla (`*.spec.ts` con `declarations`) no compilan desde antes de esta pasada.
- ❔ Un E2E (`fallar abre la solución; al cerrarla sigue con otro puzzle`) falló 2 veces de ~140 con "el primer toque no seleccionó la pieza" (0 de 62 en la base): puede ser un flaky previo o un primer toque perdido real; sin causa confirmada.
