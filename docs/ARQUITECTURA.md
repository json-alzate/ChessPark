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

**Alias de importación** (en `tsconfig`): `@chesspark/<lib>` para las libs,
`@services/*` y `@shared/*` para `apps/chessColate/src/app/services` y `shared`.

---

## 2. Las capas de la app (la regla)

Dentro de `apps/chessColate/src/app` todo sigue la misma cadena. Una capa solo
habla con la de abajo:

```
pages/ (y shared/components)     Pintan y reaccionan. Delegan.
   │
   ▼
services/<área>/*.service.ts     Orquestan una funcionalidad. Tienen estado.
   │            │
   │            └──► libs/state (facades NgRx)   Estado compartido entre pantallas
   ▼
services/firestore/*.repository  Leen/escriben Firestore (un repositorio por agregado)
services/**/*-storage.service    Leen/escriben el dispositivo (localStorage / IndexedDB)
   │
services/**/*.util.ts            Funciones PURAS: calculan, no inyectan nada, no hacen I/O
```

Reglas que ya se hacen cumplir o se siguen:

- **Las páginas no inyectan repositorios.** Hay una regla de lint
  (`apps/chessColate/eslint.config.mjs`, `no-restricted-imports`) que lo impide.
  Lo que necesitan lo piden a un `service` o lo leen del store.
- **`*.util.ts` = función pura.** Recibe datos, devuelve datos. Por eso casi todos
  tienen su `.spec.ts` en `services/specs/`. Si una función necesita Angular,
  Firestore o `localStorage`, no es un util: es un servicio.
- **`*.repository.ts` = Firestore. `*-storage.service.ts` = dispositivo.**
  Una funcionalidad puede usar uno, otro o ambos (ver el cuadro de persistencia).
- **La conexión a Firestore es única** (`FirestoreConnection`, se inicia en
  `AppComponent`); los repositorios la comparten.

### Organización por funcionalidad (en migración)

La app se está pasando de "una carpeta por tipo de archivo" a "una carpeta por
funcionalidad", en `apps/chessColate/src/app/features/<nombre>/` (alias
`@features/*`). **Hoy solo `reminders` está migrada**; el resto sigue como se
describe arriba y se irá moviendo de a una, verificando con tests cada vez.

```
features/<nombre>/
  pages/        Lo que enruta app.routes.ts: pantallas completas  (*.page.ts)
  containers/   Piezas con lógica (inyectan servicios) dentro de una page,
                incluidos los modales con lógica                  (*.container.ts)
  components/   Piezas solo visuales: @Input/@Output, sin servicios de datos (*.component.ts)
  services/     Servicios y storage/repositorios de la funcionalidad
  models/       Tipos exclusivos de la funcionalidad              (*.model.ts)
  utils/        Funciones puras                                   (*.util.ts)
```

- **Si algo está en `pages/`, tiene ruta.** Si no tiene ruta, no está ahí.
- **Un tipo exclusivo de una funcionalidad vive en su `models/`.** Si lo comparten
  varias funcionalidades, apps o libs, va a `libs/models`.
- **Lo que usan varias funcionalidades** va a `shared/` (p. ej.
  `shared/utils/date.util.ts`), no se importa de la carpeta de otra.
- Los specs van junto al archivo que prueban dentro de `features/`.
- La regla de lint de repositorios cubre también `features/**/pages` y
  `features/**/containers`.

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

Rutas en `app.routes.ts` (todas con `loadComponent`, cargan bajo demanda):

| Ruta | Pantalla | Servicios principales |
|---|---|---|
| `home` | Inicio y menú de rutinas (`home/components/training-menu`) | `BlockService`, `PlanService`, `InfinityPuzzlePoolService`, `StreakStorageService`, `Reto333StorageService` |
| `puzzles/training` | **Entrenamiento (rutina)** | ver flujo 5.1 |
| `puzzles/plan-played` | Resumen de la rutina | `PlanFacadeService`, `PlanStorageService` |
| `puzzles/plans-history` | Historial | `PlanStorageService` |
| `puzzles/custom-plans*` | Rutinas propias (requiere sesión) | `CustomPlansService` → `CustomPlanRepository` |
| `puzzles/public-plans` | Rutinas públicas | `PublicPlansService` → `PublicPlanRepository` |
| `streak` | Modo Racha | `StreakService`, `StreakStorageService`, `UserRecordsService` |
| `games`, `games/viewer`, `games/:id` | Reproductor de partidas | `GamesService`, `GameReviewService` |
| `analytics` | Análisis de partidas | `GameAnalyticsService` |
| `reminders` | Recordatorios (`features/reminders/pages`) | `TrainingReminderService` |
| `coordinates`, `knight-tour`, `chess960` | Minijuegos | Servicios propios / `libs/board` |
| `settings`, `settings/storage` | Ajustes y descargas | `AppService`, `AppearanceService`, `LanguageService`, caché de `puzzles-provider` |

---

## 5. Los flujos clave

### 5.1 Entrenar una rutina (el flujo principal)

El más largo y el que más cuesta seguir. En orden:

**Crear la rutina**
1. La pantalla (`home.page`, `training-menu` o "repetir" en `plan-played`) llama a `BlockService.generateBlocksForPlan(tipo)`
   → una lista de `Block` según una tabla por tipo de plan
   (`plan-blocks.config.ts`). Un bloque = un tema/apertura + elo + tiempo +
   número de ejercicios.
2. `PlanService.newPlan(blocks, tipo)` crea el `Plan` (uid, bloques), lo pone en
   el store (`PlanFacadeService.setPlan`), registra `routine_started` y avisa a
   `TrainingReminderService.onSessionStarted()` para no molestar en plena sesión.
3. Navega a `puzzles/training`.

**Jugar** (`TrainingComponent`, la pantalla es la que orquesta)
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
TrainingComponent ◄──────────────── TrainingSessionService (estado) ◄──┘
   │  getPuzzlesForBlock ─► PuzzlesProvider ─► IndexedDB / red
   │  onPuzzleCompleted ─► elos (Profile | PlansElos) + analítica + sonido
   └─ endPlan ─► PlanStorageService (local) ─► plan-played
```

### 5.2 Modo Racha

Muerte súbita: el primer fallo termina. `StreakService` pide un puzzle a la vez a
`PuzzlesProvider` con la rampa de elo (+15 por acierto, sin repetir); el récord va
a `StreakStorageService` (dispositivo) y `UserRecordsService` lo sincroniza con el
perfil. No toca el elo del usuario. Detalle: [`implementado/RACHA_STREAK_FLOW.md`](./implementado/RACHA_STREAK_FLOW.md).

### 5.3 Recordatorios de entrenamiento

Todo vive en `features/reminders/` (la primera funcionalidad migrada):
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

`GameAnalyticsService` es una fachada: la pantalla (`pages/analytics`) conecta una
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
una facade). Las pantallas leen el store; los guards (`custom-plans.guard`,
`public-plans.guard`, `auth.guard`) controlan el acceso.

---

## 6. Dónde se guarda cada dato

| Dato | Dónde | Quién lo toca |
|---|---|---|
| Perfil (elo, idioma, elos por tema) | Firestore + store | `ProfileService` → `ProfileRepository` |
| Elos de rutinas propias | Firestore + store | `PlansElosService` → `PlanElosRepository` |
| Rutinas propias / públicas | Firestore + store | `CustomPlans*` / `PublicPlans*` |
| **Historial de rutinas jugadas** | **`localStorage`** (`chessColate_plans_history`) | `PlanStorageService` |
| Récords de Racha y Reto 333 | Dispositivo, sincronizado con el perfil | `*StorageService` + `UserRecordsService` |
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
  en `TrainingComponent` para que cada pantalla arranque limpia. Ionic puede
  reutilizar la instancia entre rutinas; por eso `start()`/`reset()` limpian todo.
- **`TrainingComponent` sigue siendo grande (~1100 líneas).** Ya delegó sesión,
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
| **Util** | Función pura, sin Angular ni I/O. Probada en `services/specs/`. |
| **Reto 333 / Racha** | Modos de juego con récord propio, fuera del sistema de elos del perfil. |

---

## 8. Dónde mirar según lo que quieras cambiar

| Quiero… | Empieza por |
|---|---|
| Cambiar qué bloques tiene una rutina | `services/plans/plan-blocks.config.ts` → `BlockService.generateBlocksForPlan` |
| Cambiar cómo se calcula el elo | `ProfileService.calculateEloPuzzlePlan` / `PlansElosService`; fórmula en `libs/common-utils/elo-calculator.service` |
| Cambiar el flujo entre ejercicios/bloques | `TrainingSessionService` (decisión) y `TrainingComponent.follow` (efecto) |
| Cambiar de dónde salen los puzzles | `libs/puzzles-provider` |
| Cambiar la hora/texto de los recordatorios | `features/reminders/utils/` (cálculo), `features/reminders/services/training-reminder.service.ts` (agenda) |
| Añadir una estadística a Análisis | `libs/game-reporter` (reporte) + `game-analytics.util.ts` (presentación) |
| Añadir un dato a Firestore | un `*.repository.ts` + su service (la página nunca lo inyecta) |
| Añadir un evento de analítica | `services/analytics/analytics-events.util.ts` y `AnalyticsService` |

---

*Mantenimiento: si cambia una capa, un flujo o un lugar de persistencia, actualiza
la sección correspondiente. Si crece más allá de lo que se lee de una sentada,
mueve el detalle a `implementado/` y deja aquí solo el mapa.*
