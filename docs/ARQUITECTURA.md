# Arquitectura de ChessColate — mapa general

> Para qué sirve: entender **dónde vive cada cosa y por dónde pasa cada flujo**
> sin leer 50 archivos. Es un mapa, no una referencia. El detalle de cada
> funcionalidad está en [`implementado/`](./implementado/) (cómo funciona) y
> [`features/`](./features/) (qué se planeó); la deuda conocida, en
> [`DEUDA_TECNICA.md`](./DEUDA_TECNICA.md).
>
> `apps/Chesscolate-old` es código legacy congelado que se conserva a propósito
> como referencia de migración ([`MIGRACION_CHESSCOLATE.md`](./MIGRACION_CHESSCOLATE.md)).
> Nada de lo activo depende de él.

---

## 1. El workspace de un vistazo

```
apps/
  chessColate/        App principal (Angular 20 + Ionic 8 + Capacitor). Todo lo de abajo trata de esta.
  chess-extension/    Extensión de navegador (aparte).
  Chesscolate-old/    Legacy congelado. No tocar.
libs/
  models/             Tipos compartidos (Plan, Block, Puzzle, Profile…). Sin lógica.
  state/              NgRx: auth, plan, plansElos, customPlans, public-plans (+ facades).
  puzzles-provider/   Descarga y cachea el catálogo de puzzles (IndexedDB).
  chess-com-provider/ Cliente de la API de chess.com.
  lichess-provider/   Cliente de la API de lichess.
  games-provider/     Catálogo de partidas incluidas en la app.
  game-reporter/      Archivo de partidas descargadas + reportes/estadísticas.
  board/              Componentes de tablero (puzzle, partida, heatmap, 960…).
  stockfish-wasm/     Motor Stockfish en worker.
  common-utils/       Misceláneo: storage, uid, elo, sonidos, confetti, fechas.
  revenuecat/         Compras / suscripciones.
```

Dependen "hacia abajo": `apps/chessColate` → `libs/*`; `libs/*` casi nunca
dependen entre sí salvo todas de `models`.

**Alias de importación** (en `apps/chessColate/tsconfig.json`): `@chesspark/<lib>` para las libs
y, dentro de la app, `@core/*`, `@features/*`, `@shared/*` (carpetas de `src/app`),
`@app/*` (cualquier ruta de `src/app`) y `@tests/*` (`tests/`, para el apoyo de las pruebas).

---

## 2. Cómo está organizada la app

`apps/chessColate/src/app` se organiza **por funcionalidad**, no por tipo de archivo:
para entender o cambiar algo (rutinas, recordatorios, partidas…) todo está en una carpeta.

```
src/app/
  app.component.ts / app.routes.ts   Arranque y rutas (cada ruta carga su página bajo demanda)
  core/        Lo que usa toda la app                       (@core/*)
    account/     sesión (AuthService) y perfil (ProfileService + ProfileRepository)
    analytics/   AnalyticsService, eventos y manejador de errores de Crashlytics
    app/         ajustes de la app: idioma, apariencia, PWA, AppService
    firestore/   conexión única a Firestore y serialización
    guards/      auth.guard
  features/    Una carpeta por funcionalidad                (@features/*)
    training/      rutinas: entrenar, resumen, historial, rutinas propias y públicas,
                   bloques, sesión, cronómetro, pool infinito, planes y sus repositorios
    streak/        modo Racha
    woodpecker/    Método del Pájaro Carpintero: set fijo que se repite en vueltas
    records/       récords de Racha y Reto 333 y su sincronización con el perfil
    reminders/     recordatorios de entrenamiento
    games/         reproductor de partidas
    game-analytics/ análisis de partidas (chess.com / lichess)
    app-review/    pedir la calificación de la app
    home/ settings/ donation/ privacy/ coordinates/ knight-tour/ chess960/
  shared/      Lo que usan varias funcionalidades            (@shared/*)
    components/  navbar, login, onboarding, donación, selector de apariencia, count-up…
    pipes/ utils/
```

Dentro de cada funcionalidad, **siempre el mismo orden**; solo existen las carpetas que hacen falta:

```
features/<nombre>/
  pages/        Lo que enruta app.routes.ts: pantallas completas             *.page.ts
  containers/   Piezas con lógica (inyectan servicios) dentro de una página,
                p. ej. los modales con lógica                                *.component.ts
  components/   Piezas solo visuales: @Input/@Output, sin servicios de datos *.component.ts
  services/     Servicios (orquestan, tienen estado) y storage del dispositivo
  data/         Repositorios de Firestore                                    *.repository.ts
  models/       Tipos exclusivos de la funcionalidad                         *.model.ts
  utils/        Funciones puras                                              *.util.ts
  config/       Tablas de configuración                                      *.config.ts
  guards/       Guards de ruta propios de la funcionalidad
```

**Si algo está en `pages/`, tiene ruta; si no tiene ruta, no está ahí.**

**Una funcionalidad con varias pantallas** (training, games, settings) **tiene una subcarpeta por pantalla** dentro de
`pages/`, igual que cada componente tiene la suya: `pages/<pantalla>/<pantalla>.page.{ts,html,scss}`.
Con una sola pantalla (chess960, streak, home…) los tres archivos van directo en `pages/`.

```
features/training/pages/
  training/              training.page.ts · .html · .scss
  plans-history/         plans-history.page.ts · .html · .scss
  custom-plan-form/      …
```

### La cadena de capas

Dentro de una funcionalidad, una capa solo habla con la de abajo:

```
pages/ · containers/ · components/   Pintan y reaccionan. Delegan.
   │
   ▼
services/*.service.ts                Orquestan la funcionalidad. Tienen estado.
   │            │
   │            └──► libs/state (facades NgRx)   Estado compartido entre pantallas
   ▼
data/*.repository.ts                 Leen/escriben Firestore (un repositorio por agregado)
services/*-storage.service.ts        Leen/escriben el dispositivo (localStorage / IndexedDB)
   │
utils/*.util.ts                      Funciones PURAS: calculan, no inyectan nada, no hacen I/O
```

### Reglas

- **Las páginas, containers y componentes no inyectan repositorios.** Lo impide una
  regla de lint (`apps/chessColate/eslint.config.mjs`, `no-restricted-imports`).
  Lo que necesitan lo piden a un `service` o lo leen del store.
- **`*.util.ts` = función pura.** Recibe datos, devuelve datos. Si una función
  necesita Angular, Firestore o `localStorage`, no es un util: es un servicio.
- **`*.repository.ts` = Firestore. `*-storage.service.ts` = dispositivo.**
- **La conexión a Firestore es única** (`FirestoreConnection`, se inicia en
  `AppComponent`); los repositorios la comparten.
- **Un tipo exclusivo de una funcionalidad vive en su `models/`.** Si lo comparten
  varias funcionalidades, apps o libs, va a `libs/models`.
- **Entre funcionalidades**: cualquiera puede usar `core/`, `shared/` y `libs/`. Una
  funcionalidad que necesita algo de otra lo importa de su `services/` o `utils/`, y lo que
  usan varias sin ser de ninguna va a `shared/` (p. ej. `shared/utils/date.util.ts`).
  Dependencias que hay hoy (sacadas de los imports):
  `training` → `records`, `reminders`, `app-review` · `home` → `training`, `records`, `woodpecker` ·
  `streak` → `records`, `reminders` · `woodpecker` → `streak` (la lista de temas que no son tácticos), `reminders` ·
  `game-analytics` → `games`, `training` ·
  `settings` → `training`, `games`, `game-analytics`, `app-review` (borra sus datos locales).
  **Conocido:** `reminders` y `training` se importan mutuamente (recordatorios lee el historial
  de `PlanStorageService`; entrenamiento le avisa al empezar y terminar una sesión). Es
  acoplamiento anterior a la reorganización y no se resolvió.
- **Dónde va una carpeta nueva:** una funcionalidad nueva es `features/<nombre>/`;
  algo que usa toda la app es `core/`; algo que usan varias funcionalidades es `shared/`.

---

## Las pruebas

Las pruebas **no viven junto al código**: `apps/chessColate/tests/unit/` es un **espejo** de
`src/app/`, con el mismo árbol de carpetas y el nombre del archivo más `.spec.ts`
(`src/app/features/reminders/utils/reminder-time.util.ts` →
`tests/unit/features/reminders/utils/reminder-time.util.spec.ts`). Los dobles y datos que se
comparten van en `tests/support/` (alias `@tests/*`). Convenciones en
[`apps/chessColate/tests/README.md`](../apps/chessColate/tests/README.md).

- **Unitarias (Jest):** `npx nx test chessColate`. Cubren servicios, repositorios, guards,
  rutas, páginas y componentes. Tablero, Ionic, Chart.js y Stockfish se sustituyen por dobles.
- **E2E (Playwright):** proyecto aparte, `apps/chessColate-e2e`
  ([README](../apps/chessColate-e2e/README.md)). Abre la app compilada en un navegador de
  móvil con la red externa cortada y compara cada pantalla con una captura de referencia.
  Es lo que verifica que un movimiento de archivos no rompió ninguna pantalla.
- Los problemas que aparecieron al escribirlas, sin corregir, están en
  [`HALLAZGOS_PRUEBAS.md`](./HALLAZGOS_PRUEBAS.md).

---

## 3. Arranque de la app

`app.component.ts → initApp()`:

1. `initializeApp(firebase)` y se habilita Analytics/Crashlytics.
2. `AuthService.init()` y `FirestoreConnection.init()`.
3. `TrainingReminderService.init()` (listeners de notificaciones; pronto, para
   atrapar el tap de una notificación en arranque en frío).
4. Se escucha `AuthService.getAuthState()`:
   - **Con usuario:** `ProfileService.checkProfile()` (lee/crea el perfil en
     Firestore y lo pone en el store) → `UserRecordsService.syncFromProfile()`
     (fusiona récords del dispositivo con los del perfil) → RevenueCat →
     analítica con el UID.
   - **Sin usuario:** `ProfileService.clearProfile()`.
   - En ambos casos termina con `AuthService.markAsInitialized()`.

El **perfil** (`ProfileService`, estado en `libs/state`) es el dato central: elo
global, elos por tema/plan, idioma, cuentas. Casi todos los flujos lo leen.

---

## 4. Mapa de pantallas → de qué dependen

Rutas en `app.routes.ts` (todas con `loadComponent`, cargan bajo demanda). La página de cada
ruta está en `features/<funcionalidad>/pages/`.

| Ruta | Funcionalidad | Servicios principales |
|---|---|---|
| `home` | `home` (menú de rutinas en `containers/training-menu`) | `BlockService`, `PlanService`, `InfinityPuzzlePoolService`, `StreakStorageService`, `Reto333StorageService` |
| `puzzles/training` | `training` · **Entrenamiento (rutina)** | ver flujo 5.1 |
| `puzzles/plan-played` | `training` · Resumen de la rutina | `PlanFacadeService`, `PlanStorageService` |
| `puzzles/plans-history` | `training` · Historial | `PlanStorageService` |
| `puzzles/custom-plans*` | `training` · Rutinas propias (requiere sesión) | `CustomPlansService` → `CustomPlanRepository` |
| `puzzles/public-plans` | `training` · Rutinas públicas | `PublicPlansService` → `PublicPlanRepository` |
| `streak` | `streak` · Modo Racha | `StreakService`, `StreakStorageService`, `UserRecordsService` |
| `games`, `games/viewer`, `games/:id` | `games` · Reproductor de partidas | `GamesService`, `GameReviewService` |
| `analytics` | `game-analytics` · Análisis de partidas | `GameAnalyticsService` |
| `reminders` | `reminders` · Recordatorios | `TrainingReminderService` |
| `woodpecker` | `woodpecker` · El set del Pájaro Carpintero: configurar, panel y evolución | `WoodpeckerService`, `WoodpeckerSetService` |
| `woodpecker/play` | `woodpecker` · Una vuelta del set | `WoodpeckerService`, `TrainingReminderService` |
| `coordinates`, `knight-tour`, `chess960` | una funcionalidad cada una · Minijuegos | Servicios propios / `libs/board` |
| `settings`, `settings/storage`, `settings/credits` | `settings` · Ajustes, descargas y créditos (la de créditos es pública y solo lee `config/credits.config.ts` y el `music-credits.config.ts` generado) | `AppService`, `AppearanceService`, `LanguageService`, caché de `puzzles-provider` |
| `donation`, `privacy` | `donation`, `privacy` | `RevenueCatService` (donación) |

---

## 5. Los flujos clave

### 5.1 Entrenar una rutina (el flujo principal)

El más largo y el que más cuesta seguir. En orden:

**Crear la rutina**
1. La pantalla (`home.page`, `training-menu` o "repetir" en `plan-played`) llama a `BlockService.generateBlocksForPlan(tipo)`
   → una lista de `Block` según una tabla por tipo de plan
   (`features/training/config/plan-blocks.config.ts`). Un bloque = un tema/apertura + elo + tiempo +
   número de ejercicios.
2. `PlanService.newPlan(blocks, tipo)` crea el `Plan` (uid, bloques), lo pone en
   el store (`PlanFacadeService.setPlan`), registra `routine_started` y avisa a
   `TrainingReminderService.onSessionStarted()` para no molestar en plena sesión.
3. Navega a `puzzles/training`.

**Jugar** (`TrainingPage`, la pantalla es la que orquesta)
4. `TrainingSessionService` (máquina de estados) lleva el plan, el bloque actual
   y los contadores. **No sabe** de sonidos, modales, cronómetro ni navegación.
   `TrainingTimerService` solo cuenta el tiempo del bloque. Ambos se proveen en
   el componente (mueren con la pantalla).
5. Por cada bloque: se muestra su presentación (`buildBlockPresentation`, util
   puro) → `BlockService.getPuzzlesForBlock()` pide puzzles a `PuzzlesProvider`
   (libs/puzzles-provider; descarga + caché en IndexedDB) → se pinta el tablero
   (`libs/board`, `board-puzzle`).
6. Cada puzzle termina en `onPuzzleCompleted(puzzle, resultado)`, que en orden:
   - ignora resultados tardíos si ya se está cambiando de bloque;
   - construye el `UserPuzzle` (`buildUserPuzzle`, util);
   - manda analítica `puzzle_completed` (**antes** de registrar, a propósito);
   - `session.registerPuzzleResult()`;
   - **actualiza elos** según el tipo de plan:
     `custom` → `PlansElosService.calculatePlanElos` (Firestore, por plan);
     `reto333` → elo local que sube por paso;
     resto → `ProfileService.calculateEloPuzzlePlan` (perfil);
   - suena el efecto, y según el bloque: muestra solución, la reproduce o sigue.
7. `session.nextStepAfterPuzzle()` decide: otro ejercicio / siguiente bloque /
   fin del plan. La pantalla ejecuta esa decisión (`follow(step)`).

**Terminar** (`endPlan()`)
8. Marca el plan como terminado, lo actualiza en el store, lo guarda en el
   dispositivo (`PlanStorageService`), llama a
   `TrainingReminderService.onSessionCompleted()` (reprograma el recordatorio),
   suma "veces jugado" si es custom, limpia recursos y navega a `plan-played`.

```
Home ─► BlockService.generateBlocksForPlan ─► PlanService.newPlan ─► [store: plan]
                                                                        │
TrainingPage      ◄──────────────── TrainingSessionService (estado) ◄──┘
   │  getPuzzlesForBlock ─► PuzzlesProvider ─► IndexedDB / red
   │  onPuzzleCompleted ─► elos (Profile | PlansElos) + analítica + sonido
   └─ endPlan ─► PlanStorageService (local) ─► plan-played
```

### 5.2 Modo Racha

Muerte súbita: el primer fallo termina. `StreakService` pide un puzzle a la vez a
`PuzzlesProvider` con la rampa de elo (+15 por acierto, sin repetir); el récord va
a `StreakStorageService` (dispositivo, en `features/records`) y `UserRecordsService` lo sincroniza con el
perfil. No toca el elo del usuario. Detalle: [`implementado/RACHA_STREAK_FLOW.md`](./implementado/RACHA_STREAK_FLOW.md).

### 5.2b Método del Pájaro Carpintero

Un set **fijo** de ejercicios que se repite en varias vueltas, cada una con menos tiempo. Todo en
`features/woodpecker/`. El usuario elige tamaño, rango de ELO, temas, vueltas, orden y ritmo;
`WoodpeckerSetService` arma el set con pocos archivos del catálogo repartidos por el rango
(`utils/woodpecker-set.util.ts` decide cuáles y qué ejercicios se quedan) y lo **congela**: el set
completo y el progreso (vueltas, orden de cada una, resultados) van a `localStorage` por separado
(`WoodpeckerStorageService`), y el progreso se escribe tras cada ejercicio para poder reanudar.
`WoodpeckerService` orquesta y registra la analítica; las transiciones del progreso (`startCycle`,
`recordResult`, `finishCycle`) y la medición entre vueltas son funciones puras en `utils/`.
**No crea un `Plan`**, no toca el ELO del perfil y no necesita sesión. La pantalla `woodpecker` es el
panel; `woodpecker/play` juega una vuelta sobre el tablero de puzzles de siempre. Detalle:
[`implementado/PAJARO_CARPINTERO_FLOW.md`](./implementado/PAJARO_CARPINTERO_FLOW.md).

### 5.3 Recordatorios de entrenamiento

Todo vive en `features/reminders/`:
- `utils/reminder-time.util.ts` — **cálculo puro de la hora**: sugerida según
  cuándo suele entrenar, efectiva y formato legible.
- `utils/reminder-schedule.util.ts` — **cálculo puro de la agenda**: próximas
  fechas, días de la semana, racha de días y qué texto usar.
- `models/reminder.model.ts` — los tipos y el estado por defecto.
- `services/training-reminder-storage.service.ts` — **guarda** el estado en el dispositivo.
- `services/training-reminder.service.ts` — **orquesta** y agenda las notificaciones
  locales (no-op en web). Se dispara al abrir la app, al volver de background y
  al terminar una sesión; regla: no notificar si ya entrenó hoy.
- `containers/` — los dos modales (permiso y recordatorio manual).

Pantalla: `features/reminders/pages/reminders.page.ts`. Detalle: [`implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md`](./implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md).

### 5.4 Análisis de partidas (Game Analytics)

`GameAnalyticsService` es una fachada: la pantalla (`features/game-analytics/pages/analytics.page.ts`) conecta una
cuenta, pide "ponerse al día" y recibe partidas **ya normalizadas**; no sabe si
vienen de chess.com o lichess.
`chess-com-provider` / `lichess-provider` descargan → `game-reporter`
(`createGamesArchive`) las guarda en IndexedDB y calcula reportes → el servicio las
mantiene en memoria mientras dura la navegación (para filtrar rápido).
`game-analytics.util.ts` tiene los cálculos de pantalla (rangos de meses,
porcentajes, aperturas a practicar). Los ajustes van a `localStorage`.
Detalle: [`implementado/GAME_ANALYTICS_FLOW.md`](./implementado/GAME_ANALYTICS_FLOW.md).

### 5.5 Reproductor de partidas

`GamesService` (catálogo + PGN) y `GameReviewService` (revisión con
`libs/stockfish-wasm`). `games.util.ts` guarda filtros y ajustes de reproducción.
Detalle: [`implementado/REPRODUCTOR_PARTIDAS_FLOW.md`](./implementado/REPRODUCTOR_PARTIDAS_FLOW.md).

### 5.6 Rutinas propias y públicas

`CustomPlansService` / `PublicPlansService` van por **NgRx** (`libs/state`:
actions → effects → repositorio Firestore → reducer → selectors, expuestos por
una facade). Las pantallas leen el store; los guards (`custom-plans.guard` y
`public-plans.guard` en `features/training/guards/`, `auth.guard` en `core/guards/`) controlan el acceso.

---

## 6. Dónde se guarda cada dato

| Dato | Dónde | Quién lo toca |
|---|---|---|
| Perfil (elo, idioma, elos por tema) | Firestore + store | `ProfileService` → `ProfileRepository` |
| Elos de rutinas propias | Firestore + store | `PlansElosService` → `PlanElosRepository` |
| Rutinas propias / públicas | Firestore + store | `CustomPlans*` / `PublicPlans*` |
| **Historial de rutinas jugadas** | **`localStorage`** (`chessColate_plans_history`) | `PlanStorageService` |
| Récords de Racha y Reto 333 | Dispositivo, sincronizado con el perfil | `*StorageService` + `UserRecordsService` |
| **Set del Pájaro Carpintero** (ejercicios congelados) y **su progreso** | **`localStorage`** (`chessColate_woodpecker_set` y `chessColate_woodpecker_progress`), solo local | `WoodpeckerStorageService` |
| Recordatorios | Dispositivo | `TrainingReminderStorageService` |
| Puzzles descargados / pool infinito | IndexedDB | `libs/puzzles-provider` (`CacheService`) |
| Partidas de chess.com/lichess | IndexedDB | `libs/game-reporter` (`createGamesArchive`) |
| Ajustes de análisis | `localStorage` | `GameAnalyticsService` |

### Cosas que no son obvias leyendo el código

- **El historial de rutinas jugadas es solo local, a propósito.** La sincronización
  con Firestore está preparada pero **sin habilitar**: `PlanService.savePlan` y
  `PlanRepository` existen y `endPlan()` lleva un `TODO(premium)` donde se
  conectaría. Se activará más adelante, posiblemente como función de la versión
  premium. Mientras tanto el historial no sobrevive a reinstalar la app ni pasa
  de un dispositivo a otro. `UserPuzzleRepository` (historial de puzzles
  resueltos) está en la misma situación: acceso completo, sin consumidores aún.
  Para buscar estos puntos: `grep -rn "TODO(premium)" apps libs`.
- **El estado vive en dos sitios** (store NgRx y servicios con estado propio). La
  regla práctica: lo que comparten varias pantallas (perfil, plan activo, rutinas
  propias/públicas) va al store; lo que es de una sola pantalla (sesión de
  entrenamiento, cronómetro) vive en un servicio provisto por el componente.
- **`TrainingSessionService` y `TrainingTimerService` no son `root`.** Se proveen
  en `TrainingPage` para que cada pantalla arranque limpia. Ionic puede
  reutilizar la instancia entre rutinas; por eso `start()`/`reset()` limpian todo.
- **`TrainingPage` sigue siendo grande (~1100 líneas).** Ya delegó sesión,
  cronómetro y utils, pero aún coordina elos, sonidos, modales, analítica y
  navegación. Es el primer sitio donde buscar al seguir el flujo 5.1.

---

## 7. Glosario rápido

| Término | Qué es |
|---|---|
| **Plan / rutina** | Una sesión de entrenamiento: lista ordenada de bloques. |
| **Block / bloque** | Tramo del plan: un tema (o apertura), un elo, un tiempo y N ejercicios. |
| **UserPuzzle** | Registro de un ejercicio jugado (resultado, elo del usuario en ese momento). |
| **Facade** (`*FacadeService`) | Envoltorio de un trozo del store: dispatch + selectors, para que nadie use NgRx directo. |
| **Repository** | Acceso a Firestore de un agregado. |
| **Storage service** | Acceso a `localStorage`/IndexedDB de una funcionalidad. |
| **Util** | Función pura, sin Angular ni I/O. Se prueba en `tests/unit/`. |
| **Reto 333 / Racha** | Modos de juego con récord propio, fuera del sistema de elos del perfil. |

---

## 8. Dónde mirar según lo que quieras cambiar

| Quiero… | Empieza por |
|---|---|
| Cambiar qué bloques tiene una rutina | `features/training/config/plan-blocks.config.ts` → `BlockService.generateBlocksForPlan` |
| Cambiar cómo se calcula el elo | `ProfileService.calculateEloPuzzlePlan` / `PlansElosService`; fórmula en `libs/common-utils/elo-calculator.service` |
| Cambiar el flujo entre ejercicios/bloques | `TrainingSessionService` (decisión) y `TrainingPage.follow` (efecto) |
| Cambiar de dónde salen los puzzles | `libs/puzzles-provider` |
| Cambiar la hora/texto de los recordatorios | `features/reminders/utils/` (cálculo), `features/reminders/services/training-reminder.service.ts` (agenda) |
| Añadir una estadística a Análisis | `libs/game-reporter` (reporte) + `features/game-analytics/utils/game-analytics.util.ts` (presentación) |
| Añadir un dato a Firestore | un `*.repository.ts` en `data/` de la funcionalidad + su service (la página nunca lo inyecta) |
| Cambiar cómo se arma el set del Pájaro Carpintero o cómo baja el tiempo por vuelta | `features/woodpecker/utils/woodpecker-set.util.ts` · `woodpecker-cycle.util.ts` · `config/woodpecker.config.ts` |
| Añadir un evento de analítica | `core/analytics/analytics-events.util.ts` y `AnalyticsService` |

---

*Mantenimiento: si cambia una capa, un flujo o un lugar de persistencia, actualiza
la sección correspondiente. Si crece más allá de lo que se lee de una sentada,
mueve el detalle a `implementado/` y deja aquí solo el mapa.*
