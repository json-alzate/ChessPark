# Racha de Puzzles (Streak) — Feature Document

## Concepto

Un modo de juego calcado del **[Streak de Lichess](https://lichess.org/streak)**: el usuario resuelve puzzles **uno tras otro, de dificultad creciente**, y la partida continúa **mientras no falle**. **Un solo error termina la racha.** La puntuación es simplemente **cuántos puzzles resolvió seguidos** antes de fallar.

La mecánica original de Lichess:
1. Empieza con un puzzle **fácil** (rating bajo).
2. Cada puzzle resuelto **sube ligeramente la dificultad** del siguiente.
3. **No hay reloj**: puedes pensar todo lo que quieras (a diferencia de otros modos con timer).
4. Tienes **un "saltar" (skip) por racha**: puedes pasar de un puzzle sin fallar, una única vez.
5. **Fallas una vez → se acaba.** Tu score es el número de puzzles encadenados.
6. El objetivo es **batir tu propio récord** (y presumirlo).

La diferencia con las rutinas actuales de ChessColate: aquí **no hay un set fijo ni un número objetivo de puzzles**; la sesión es **abierta y de muerte súbita**, y la dificultad **se adapta al alza** según el usuario acierta. Es un modo de **engagement / competición contra uno mismo**, no de estudio dirigido.

---

## Objetivos

- Ofrecer un modo **rápido, adictivo y auto-competitivo** (récord personal) fiel al Streak de Lichess.
- **Escalar la dificultad** puzzle a puzzle a partir de un ELO base.
- Mecánica de **muerte súbita** (un fallo termina) con **un skip** por racha.
- **Persistir el récord** (mejor racha) y permitir **compartirlo**.
- Reutilizar el tablero y el catálogo existentes (`@chesspark/board`, [`getPuzzlesForBlock`](../../apps/chessColate/src/app/services/block.service.ts) / [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts)) — **sin backend nuevo**.

---

## Mecánica del modo

| Regla | Comportamiento |
|-------|----------------|
| **Fin de racha** | El **primer fallo** (jugada incorrecta) termina la partida. |
| **Puntuación** | Nº de puzzles resueltos **consecutivamente** antes de fallar. |
| **Dificultad** | **Creciente**: cada acierto sube el ELO objetivo del siguiente puzzle. |
| **Reloj** | **Sin límite de tiempo** por puzzle (fiel a Lichess; el timer del tablero se desactiva). |
| **Skip** | **Un salto por racha**: el usuario puede pasar de un puzzle sin fallar, una sola vez. Al usarlo, se marca como consumido. |
| **Pista (hint)** | (a decidir) En Lichess no hay pistas en Streak; recomendado **deshabilitarlas** para mantener la pureza del score. |
| **Récord** | Se guarda la **mejor racha** del usuario; al terminar se compara con ella. |

> No hay "objetivo" ni "mínimo": la sesión dura lo que dure la racha. Esto la hace ideal para partidas cortas y para "una más".

---

## Progresión de dificultad (el corazón del modo)

El modo arranca en un **ELO base** y sube tras cada acierto. Dos estrategias posibles:

- **Rampa fija** (fiel y simple): `elo(n) = eloBase + step * (n - 1)`, con un `step` pequeño (p. ej. +25–40 por puzzle) y un **techo** (`eloCap`) para no dispararse.
- **Rampa adaptativa** (2ª iteración): el `step` crece más rápido si el usuario resuelve muy rápido/sin dudar, o parte del ELO real del usuario como base.

```ts
// Rampa fija (MVP)
function nextElo(index: number, cfg: StreakConfig): number {
  return Math.min(cfg.eloBase + cfg.step * index, cfg.eloCap);
}
```

Cada puzzle se pide al catálogo con ese ELO objetivo (usando `elo`, o `eloMin`/`eloMax` como banda estrecha alrededor del objetivo), reutilizando [`PuzzlesProvider.getPuzzles`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts). Los puzzles ya jugados en la racha se **descartan** para no repetir.

> **Tema**: en Lichess el Streak mezcla temas. Recomendado **`all`** por defecto (variedad), con opción de **fijar un tema** para practicar un motivo concreto en modo racha.

---

## Modelo de datos

Nuevo `planType` (extender [`PlanTypes`](../../libs/models/src/lib/plan.model.ts)):

```ts
export type PlanTypes =
  | 'warmup' | 'plan1' | /* ... */ | 'custom' | 'infinity' | 'reto333'
  | 'streak';   // nuevo
```

```ts
interface StreakConfig {
  eloBase: number;          // ELO del primer puzzle
  step: number;             // incremento de ELO por acierto
  eloCap: number;           // techo de dificultad
  theme: string | 'all';    // tema fijo o mezcla (por defecto 'all')
  allowSkip: boolean;       // si se ofrece el skip (por defecto true)
  maxSkips: number;         // nº de skips por racha (por defecto 1, como Lichess)
}

interface StreakRun {
  uid: string;
  uidUser?: string;
  startedAt: number;
  finishedAt?: number;
  config: StreakConfig;
  score: number;            // puzzles resueltos consecutivos (racha final)
  skipsUsed: number;
  endedBy: 'fail' | 'quit'; // fallo (muerte súbita) o abandono manual
  puzzleUids: string[];     // orden real jugado (trazabilidad / no repetir)
  failedPuzzleUid?: string; // el puzzle que rompió la racha
}

interface StreakRecord {
  uidUser?: string;
  bestScore: number;        // mejor racha histórica
  bestRunUid: string;
  achievedAt: number;
  runsPlayed: number;
}
```

> El resultado por puzzle se deriva del modelo [`UserPuzzle`](../../libs/models/src/lib/user-puzzles.model.ts) existente (`resolved`, `resolvedTime`). El feature añade el concepto de **racha** (contador consecutivo), el **récord persistido** y la **rampa de ELO**.

---

## Cómo se juega (motor)

- Se reutiliza el tablero de puzzles ([`board-puzzle.component.ts`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts)) — el usuario resuelve puzzle a puzzle como en cualquier rutina.
- El bucle es **de a un puzzle**, no un bloque precargado: al resolver, se **pide el siguiente** con el ELO de la rampa.
- Los eventos que el tablero ya expone gobiernan el flujo:
  - `puzzleCompleted` → **acierto**: `score++`, subir dificultad, cargar siguiente puzzle.
  - `puzzleFailed` → **fallo**: **fin de racha** → pantalla de resultado.
  - Timer **desactivado** (no se setea `Puzzle.times`), así `puzzleEndByTime` no aplica en este modo.
- **Skip**: botón que carga el siguiente puzzle sin contar acierto ni fallo, incrementando `skipsUsed`; se oculta al agotar `maxSkips`.
- **Prefetch**: para que la transición sea instantánea, **pre-cargar el siguiente puzzle** (ELO n+1) mientras el usuario resuelve el actual.

```
[resolver puzzle n]
   ├─ acierto → score++ ; elo = nextElo(n) ; [cargar puzzle n+1]
   ├─ skip (si quedan) → skipsUsed++ ; [cargar puzzle n+1]  (mismo elo)
   └─ fallo → FIN → [pantalla de resultado + récord]
```

---

## Flujo de usuario

```
[Nuevo modo → "Racha / Streak"]
        ↓
[(opcional) elegir tema: todos / uno]   ← MVP puede saltar esto y usar 'all'
        ↓
┌──────────────── Racha en curso ────────────────┐
│ puzzle 1 (fácil) → resuelto → +1                │
│ puzzle 2 (un poco más difícil) → resuelto → +1  │
│ ...                                             │
│ [skip disponible: 1]                            │
│ puzzle k → FALLO                                │
└─────────────────────────────────────────────────┘
        ↓
[Resultado: "Racha: k" · ¿nuevo récord? · compartir · reintentar]
```

- **Reintentar** arranca una racha nueva desde `eloBase`.
- **Abandonar** (salir) cuenta como `endedBy: 'quit'` y **no** rompe el récord (la racha lograda hasta ahí sí se registra).

---

## Puntuación y récords

- **Score de la racha** = puzzles consecutivos resueltos.
- **Récord personal** (`StreakRecord.bestScore`) persistido localmente (y sincronizable si hay usuario).
- Pantalla de fin: **racha actual vs récord**, con celebración si se supera ("¡Nuevo récord!").
- **Compartir**: imagen/texto con la racha ("Hice X seguidos en ChessColate 🔥") — palanca viral, igual que Lichess.
- (Futuro) **Leaderboard** de rachas — requiere backend; fuera del MVP.

---

## Instrumentación (analytics)

Catálogo en [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md):

| Evento | Cuándo | Params |
|--------|--------|--------|
| `streak_started` | inicia una racha | `elo_base`, `step`, `theme` |
| `streak_skip_used` | usa el skip | `at_score`, `elo` |
| `streak_new_record` | supera su récord | `score`, `previous_best` |
| `streak_ended` | termina (fallo o abandono) | `score`, `ended_by`, `skips_used`, `max_elo_reached`, `duration_ms` |
| `streak_shared` | comparte el resultado | `score`, `is_record` |

---

## Consideraciones UX

- **"Una más" por diseño**: fin inmediato + botón de reintentar bien visible = sesiones cortas encadenadas.
- **Tensión creciente**: mostrar el contador de racha en grande; que cada acierto "suba" visualmente (dificultad + score).
- **El fallo debe doler poco**: muerte súbita, sí, pero con reintento a un toque; nunca castigar el ELO global del usuario en este modo.
- **Skip claro**: indicar "te queda 1 salto" y que se consume; no esconder la mecánica.
- **Sin reloj a la vista**: reforzar que puede pensar sin prisa (contrasta con [Reto 3-3-3](../../libs/models/src/lib/plan.model.ts) y otros modos con timer).
- **Celebrar el récord**: la recompensa emocional es superar la mejor marca; hacerlo explícito y compartible.

---

## Alcance inicial (MVP)

1. Nuevo `planType: 'streak'` + pantalla de entrada al modo (con tema por defecto `all`).
2. Bucle de **un puzzle a la vez** con **rampa de ELO fija** (`eloBase` + `step`, con `eloCap`) pidiendo al catálogo ([`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts)) y **sin repetir** puzzles.
3. **Muerte súbita** (fallo termina) + **1 skip** por racha.
4. **Sin timer** (desactivar `Puzzle.times`).
5. **Récord personal** persistido + pantalla de resultado (racha vs récord).
6. **Compartir** resultado (texto/imagen).
7. Eventos de analytics.

## Fuera de alcance inicial

- **Leaderboard global** / rachas de amigos (requiere backend).
- Que la racha **altere el ELO global** del usuario (mejor: métrica propia del modo; a alinear).
- **Rampa adaptativa** por velocidad/desempeño (2ª iteración; MVP usa rampa fija).
- Modo **por tema con progresión de temas** (empezar con `all` o un tema fijo).
- Racha **diaria** con puzzle-del-día encadenado (integrable con [Notificaciones de entrenamiento](./NOTIFICACIONES_ENTRENAMIENTO.md)).

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar**:

1. **ELO base y step**: ¿arrancar en un ELO fijo (p. ej. 800) o **relativo al ELO del usuario**? ¿`step` por acierto (25? 40?) y `eloCap`?
2. **Skips**: ¿1 por racha (como Lichess) o configurable? ¿Se muestran o son un extra sorpresa?
3. **Pistas**: ¿deshabilitarlas en Streak (recomendado) o permitirlas rompiendo la pureza del score?
4. **Tema**: ¿`all` fijo en el MVP, o dejar elegir tema desde ya?
5. **ELO global**: ¿la racha afecta el ELO del usuario o se mide con métrica propia (recomendado, para no penalizar el juego arriesgado)?
6. **Persistencia del récord**: ¿solo local, o sincronizado con la cuenta desde el MVP?
7. **Compartir**: ¿texto simple o tarjeta/imagen generada? ¿en qué iteración?

---

## Dependencias técnicas

- [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts) / [`block.service.ts`](../../apps/chessColate/src/app/services/block.service.ts) para pedir cada puzzle por ELO objetivo (soporta `elo` y `eloMin`/`eloMax`).
- [`Plan`](../../libs/models/src/lib/plan.model.ts) (`PlanTypes` += `'streak'`), [`Puzzle`](../../libs/models/src/lib/puzzle.model.ts), [`UserPuzzle`](../../libs/models/src/lib/user-puzzles.model.ts).
- [`board-puzzle.component.ts`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) para el juego — ya expone `puzzleCompleted`, `puzzleFailed` y permite jugar **sin timer** (no setear `Puzzle.times`).
- Storage local existente para `StreakRun` / `StreakRecord` (mismo patrón que el resto de estado local).
- `AnalyticsService` existente para la instrumentación.
- (Futuro) Backend/leaderboard para rachas globales — no requerido en el MVP.
