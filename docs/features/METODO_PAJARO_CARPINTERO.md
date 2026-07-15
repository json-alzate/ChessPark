# Método del Pájaro Carpintero (Woodpecker Method) — Feature Document

## Concepto

Un modo de entrenamiento basado en el **Woodpecker Method** (Axel Smith / Hans Tikkanen): en vez de resolver puzzles siempre nuevos, el usuario **arma un set fijo y grande de puzzles** y lo **repite en varias vueltas**, cada vuelta más rápido. La idea no es la novedad sino la **repetición del mismo material** hasta que el reconocimiento de patrones se vuelve casi automático.

La mecánica original del libro:
1. Resuelves un **set fijo** (p. ej. 200–1000 posiciones tácticas), anotando aciertos y tiempo.
2. Cuando terminas, **vuelves a empezar el mismo set desde cero** (la "vuelta 2"), intentando ir más rápido.
3. Repites por **N vueltas**, y clásicamente **el tiempo disponible se va reduciendo** (a menudo a la mitad) en cada vuelta.
4. El progreso se mide viendo cómo **mejora la precisión y baja el tiempo** vuelta a vuelta sobre **los mismos puzzles**.

La diferencia crítica con una rutina normal de ChessColate: aquí el **conjunto de puzzles se congela** y se repite; no se re-piden puzzles nuevos en cada sesión. Eso es lo que hay que construir.

---

## Objetivos

- Ofrecer un **plan de repetición espaciada de patrones tácticos** fiel al método del libro.
- Permitir **configurar el set** de forma flexible: cantidad de puzzles, ELO, temas.
- Soportar **múltiples vueltas** con **orden configurable** y **timing decreciente**.
- **Medir la mejora entre vueltas** (precisión y tiempo) sobre el mismo material — el corazón del método.
- Reutilizar el tablero y el motor de puzzles existentes (`@chesspark/board`, [`getPuzzlesForBlock`](../../apps/chessColate/src/app/services/block.service.ts), [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts)).

---

## Configuración del plan (lo que arma el usuario)

Al crear un plan tipo "Pájaro Carpintero", el usuario define **cómo se genera el set** y **cómo se repite**:

### A) Composición del set

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| **Cantidad de puzzles** | Tamaño total del set fijo | 200 |
| **Mínimo aceptable** | Si el catálogo no da la cantidad pedida para los filtros, mínimo con el que se acepta el set | 150 |
| **Rango de ELO** | `eloMin` / `eloMax` de los puzzles | 1400–1700 |
| **Temas a incluir** | Lista de temas, o **todos** | `['pin', 'fork', 'endgame']` o `all` |
| **Distribución por tema** | (opcional) reparto entre temas: equitativo o pesos | equitativo |

> El set se **genera una sola vez** (al crear el plan) pidiendo puzzles al catálogo con estos filtros, y luego **se congela**: todas las vueltas usan exactamente los mismos puzzles.

### B) Repetición (vueltas)

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| **Cantidad de vueltas** | Cuántas pasadas al set completo | 7 |
| **Orden en las vueltas** | `mismo` (idéntico cada vuelta), `aleatorio` (baraja en cada vuelta), `inverso` (alterna) | aleatorio |
| **Timing por vuelta** | Cómo cambia el tiempo disponible: `sin límite`, `fijo` por puzzle, o **decreciente** (clásico: se reduce cada vuelta) | decreciente |
| **Tiempo base / objetivo** | Tiempo de la vuelta 1 y regla de reducción (p. ej. −20% por vuelta, o mitad de tiempo en la 2ª mitad de vueltas) | 60s/puzzle → decrece |

---

## El punto crítico: el set se congela

En el modelo actual, una rutina personalizada **re-pide** sus puzzles en tiempo de juego y al guardar **descarta** el array `puzzles` del bloque:

```ts
// custom-plan-form.component.ts (comportamiento actual)
const blocksToSave = this.blocks.map(({ puzzles, puzzlesPlayed, ...rest }) => ({ ...rest, puzzlesPlayed: [] }));
```

Para el Pájaro Carpintero eso **no sirve**: si se re-pidieran puzzles cada vuelta, no serían los mismos y el método pierde todo el sentido. El set debe **persistirse** una vez generado.

Se reutiliza el mismo patrón que el feature de [Rutina con BD de Puzzles Personalizada](./RUTINA_PGN_PERSONALIZADA.md): guardar el set como un documento aparte referenciado por id, en vez de re-pedirlo.

```ts
interface WoodpeckerSet {
  id: string;
  puzzleUids: string[];      // orden canónico del set (vuelta 1)
  puzzles: Puzzle[];         // set congelado (o solo uids si se cachean aparte)
  createdAt: number;
  config: WoodpeckerConfig;  // filtros usados para generarlo (trazabilidad)
}
```

---

## Modelo de datos

Nuevo `planType` (extender [`PlanTypes`](../../libs/models/src/lib/plan.model.ts)):

```ts
export type PlanTypes =
  | 'warmup' | 'plan1' | /* ... */ | 'custom' | 'infinity' | 'reto333'
  | 'woodpecker';   // nuevo
```

```ts
interface WoodpeckerConfig {
  // Composición del set
  targetCount: number;         // puzzles deseados
  minCount: number;            // mínimo aceptable
  eloMin: number;
  eloMax: number;
  themes: string[] | 'all';    // temas a incluir
  // Repetición
  cycles: number;              // nº de vueltas
  order: 'same' | 'shuffle' | 'reverse';
  timing: 'none' | 'fixed' | 'decreasing';
  baseTimePerPuzzleSec?: number;   // tiempo vuelta 1 (si timing != none)
  decreaseRule?: 'halfLater' | 'percentPerCycle';
  decreasePercent?: number;        // si percentPerCycle
}

interface WoodpeckerProgress {
  planUid: string;
  setId: string;
  currentCycle: number;        // 1..cycles
  currentIndexInCycle: number; // puzzle actual dentro de la vuelta
  cycles: WoodpeckerCycleResult[];
}

interface WoodpeckerCycleResult {
  cycle: number;
  order: string[];             // orden real de puzzleUids en esta vuelta
  startedAt: number;
  finishedAt?: number;
  solved: number;
  failed: number;              // incluye failByTime
  totalTimeMs: number;
  perPuzzle: {                 // deriva de UserPuzzle
    uidPuzzle: string;
    resolved: boolean;
    failByTime: boolean;
    resolvedTime: number;
  }[];
}
```

> El resultado por puzzle ya se puede derivar del modelo [`UserPuzzle`](../../libs/models/src/lib/user-puzzles.model.ts) existente (`resolved`, `failByTime`, `resolvedTime`, `date`). El feature agrega la **agregación por vuelta** y la **comparación entre vueltas**.

---

## Cómo se juega (motor)

- Se reutiliza el tablero y el flujo de resolución de puzzles ([`board-puzzle.component.ts`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts)) — el usuario resuelve puzzle a puzzle como en cualquier rutina.
- El plan es, conceptualmente, **un bloque cuyo `puzzles` es el set congelado**, jugado **N veces** (una por vuelta), reordenando según `order`.
- El **tiempo por puzzle** de cada vuelta se aplica vía `Block.puzzleTimes` / `Puzzle.times` (ya soportado por el tablero: muestra timer y marca `failByTime`).
- Al terminar una vuelta → pantalla de **resumen de vuelta** (precisión, tiempo total, comparación con la vuelta anterior) → botón "Empezar vuelta N+1".
- Al terminar todas las vueltas → **resumen global** con la curva de mejora.

### Aplicación del timing decreciente

- **`decreasing / halfLater`** (fiel al libro): las primeras vueltas con tiempo holgado; en la segunda mitad de las vueltas el tiempo por puzzle se reduce (p. ej. a la mitad).
- **`decreasing / percentPerCycle`**: `tiempo(vuelta n) = base * (1 - percent)^(n-1)`.
- **`fixed`**: mismo tiempo todas las vueltas.
- **`none`**: sin límite (modo relajado / primeras experiencias).

---

## Flujo de usuario

```
[Nuevo plan → "Método Pájaro Carpintero"]
        ↓
[Configurar set: cantidad, mínimo, ELO, temas]
        ↓
[Configurar repetición: nº vueltas, orden, timing]
        ↓
[Generar set]  → pide puzzles al catálogo con los filtros
        │ ¿alcanza el mínimo? no → avisar y ajustar filtros
        ↓ sí
[Set congelado + plan guardado]  (WoodpeckerSet + Plan planType 'woodpecker')
        ↓
┌──────────────── Vuelta 1 ────────────────┐
│ resolver los N puzzles (orden canónico)   │
│ registra resolved / failByTime / tiempo   │
└───────────────────────────────────────────┘
        ↓  [Resumen vuelta 1]
┌──────────────── Vuelta 2..N ─────────────┐
│ mismo set, orden según config, menos tiempo│
│ [Resumen vuelta n vs vuelta n-1]          │
└───────────────────────────────────────────┘
        ↓
[Resumen global: curva de precisión y tiempo por vuelta]
```

El plan es **reanudable**: `WoodpeckerProgress` guarda vuelta e índice actuales para continuar donde se quedó.

---

## Medición del progreso (el corazón del método)

Pantalla de resultados con la **evolución vuelta a vuelta** sobre el mismo set:

- **Precisión por vuelta** (% resueltos) — debería subir.
- **Tiempo total y tiempo medio por puzzle** — debería bajar.
- **Puzzles "problemáticos"**: los que se fallan repetidamente entre vueltas (candidatos a revisar).
- Comparación visual (línea/barras) de las N vueltas.

> Reutilizar el `AnalyticsService` para instrumentar, y las pantallas de resultados existentes como base visual.

---

## Instrumentación (analytics)

Catálogo en [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md):

| Evento | Cuándo | Params |
|--------|--------|--------|
| `woodpecker_plan_created` | se genera el set | `target`, `actual`, `elo_min`, `elo_max`, `themes_count`, `cycles`, `order`, `timing` |
| `woodpecker_set_short` | el catálogo no alcanzó el `targetCount` | `requested`, `available` |
| `woodpecker_cycle_started` | inicia una vuelta | `cycle`, `set_size` |
| `woodpecker_cycle_completed` | termina una vuelta | `cycle`, `solved`, `failed`, `total_time_ms` |
| `woodpecker_plan_completed` | terminadas todas las vueltas | `cycles`, `accuracy_first`, `accuracy_last`, `time_first_ms`, `time_last_ms` |

---

## Consideraciones UX

- **Explicar el método** al crear el plan (mini-onboarding: "vas a repetir el MISMO set N veces, cada vez más rápido").
- **Set grande = compromiso**: avisar del tamaño y del tiempo estimado por vuelta.
- **Reanudable**: no obligar a terminar una vuelta de 200 puzzles de una sentada.
- **Feedback de mejora**: mostrar claramente "esta vuelta fuiste X% más rápido / más preciso" — es lo que engancha.
- **Sin novedad entre vueltas**: dejar claro (y esperado) que son los mismos puzzles; no es un bug, es el método.
- **Aviso si el catálogo no alcanza**: ofrecer ampliar rango de ELO o temas para llegar al mínimo.

---

## Alcance inicial (MVP)

1. Nuevo `planType: 'woodpecker'` + formulario de configuración (composición + repetición).
2. Generación del set desde el catálogo ([`getPuzzlesForBlock`](../../apps/chessColate/src/app/services/block.service.ts) / [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts)) con validación de `minCount`.
3. **Congelar y persistir** el set (`WoodpeckerSet`) + `WoodpeckerProgress` reanudable.
4. Juego por vueltas reutilizando el tablero de puzzles, con `order` y `timing` configurables.
5. Resumen por vuelta + resumen global con comparación de precisión/tiempo.
6. Eventos de analytics.

## Fuera de alcance inicial

- Que estos puzzles alteren el **ELO global** del usuario (mejor: métrica propia del plan; a alinear).
- Compartir/publicar sets de Woodpecker entre usuarios.
- Combinar con **BD de puzzles propia por PGN** (ver [feature relacionado](./RUTINA_PGN_PERSONALIZADA.md)) como fuente del set — natural en una 2ª iteración.
- Recordatorios/agenda de vueltas (integrable con [Notificaciones de entrenamiento](./NOTIFICACIONES_ENTRENAMIENTO.md)).

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar**:

1. **Tamaños permitidos**: ¿qué rango para `targetCount` (p. ej. 50–1000)? ¿Y `minCount` por defecto?
2. **Timing por defecto**: ¿`decreasing/halfLater` (fiel al libro) o `percentPerCycle`? ¿Tiempo base sugerido?
3. **Orden por defecto**: ¿`same` (más fiel al reconocimiento posición-por-posición) o `shuffle` (evita memorizar la secuencia)?
4. **Scoring/ELO**: ¿afecta el ELO global o se mide con métrica propia del plan (recomendado)?
5. **Persistencia del set**: ¿guardar `puzzles` completos o solo `uids` + cache del provider?
6. **Fuente del set**: ¿solo catálogo en el MVP, o desde ya permitir un PGN propio como origen?

---

## Dependencias técnicas

- [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts) / [`block.service.ts`](../../apps/chessColate/src/app/services/block.service.ts) para generar el set.
- [`Plan`](../../libs/models/src/lib/plan.model.ts) (`PlanTypes` += `'woodpecker'`), [`Block`](../../libs/models/src/lib/block.model.ts), [`Puzzle`](../../libs/models/src/lib/puzzle.model.ts), [`UserPuzzle`](../../libs/models/src/lib/user-puzzles.model.ts).
- [`board-puzzle.component.ts`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) para el juego (soporta timer y `failByTime`).
- Storage local existente para `WoodpeckerSet` / `WoodpeckerProgress` (mismo patrón que planes personalizados).
- `AnalyticsService` existente para la instrumentación.
- (Reutilizable) el enfoque de "set congelado referenciado por id" del feature [Rutina con BD de Puzzles Personalizada](./RUTINA_PGN_PERSONALIZADA.md).
