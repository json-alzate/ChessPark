# Flujo del Pool de Puzzles — Entrenamiento Continuo (Infinity)

## Propósito

Evitar peticiones repetidas al CDN cada vez que el usuario entra al home o inicia un entrenamiento continuo. El pool es un conjunto de 50 puzzles pre-cargados, persistido en IndexedDB, que se comparte entre la tarjeta de preview del home y la sesión de entrenamiento.

---

## Estructura del Pool en IndexedDB

**Base de datos:** `ChessParkPuzzlesDB` (misma que el caché de CDN)
**Object store:** `infinityPool`
**Clave:** `'infinityPool'` (estática, una sola entrada)

```
InfinityPoolEntry {
  id: 'infinityPool'
  puzzles: Puzzle[]    // array de 0 a 50 puzzles
  elo: number          // ELO con que fue construido/re-anclado el pool
  createdAt: number    // timestamp Date.now()
}
```

---

## Reglas del Pool

| Propiedad             | Valor                                                    |
|-----------------------|----------------------------------------------------------|
| Tamaño objetivo       | 50 puzzles                                               |
| Máx. por tema         | 5 puzzles (en el pool total)                             |
| Temas mínimos         | 10 distintos al construir                                |
| Color                 | **Mixto** — el pool no filtra por color                  |
| ELO de referencia     | `infinityTotal` del perfil (1500 si sin sesión)          |
| Refresco (background) | `|pool.elo - userElo| > 100` → reconstruir **sin dejar de servir** |
| Invalidación (duro)   | `|pool.elo - userElo| > 400` → dejar de servir           |
| Umbral de relleno     | ≤ 15 puzzles restantes → relleno en background           |

---

## Color y temas: el pool es mixto por diseño

`buildPool` pide `getPuzzles({ elo, theme, count })` **sin la opción `color`**, así que el pool contiene puzzles de ambos colores, y de los 10 temas elegidos al azar.

Por eso el bloque de `infinity` (`blockService.generateBlocksForPlan('infinity')`) se declara así:

```ts
theme: '',        // el pool no filtra por tema
color: 'random',  // el pool no filtra por color
```

- **`color: 'random'`** hace que el getter `playerColor` de `training.component.ts` derive el color **del FEN de cada puzzle** (vía `player-color.util.ts`). Un color fijo en el bloque haría que la etiqueta mintiera en ~la mitad de los puzzles del pool.
- **`theme: ''`** evita anunciar un tema que el pool no respeta (la pantalla de resultados oculta el chip cuando está vacío).

> El FEN de un puzzle empieza con el turno **del oponente** (la jugada que la máquina reproduce al abrir el tablero), así que el usuario juega con el color **contrario** al que indica el FEN. Esa regla vive en `playerColorFromFen()`. El tablero (`board-puzzle.component.ts`) ya se orienta solo desde el FEN, nunca desde `block.color`.

---

## Flujo Completo (home)

```
Usuario entra al home
        │
        ▼
¿isInitialized? (Firebase auth completado)
        │ NO → mostrar skeleton, esperar
        │ YES
        ▼
getUserInfinityElo()
  → perfil.elos.infinityTotal ?? 1500

        │
        ▼
┌─────────────────────────────────────────┐
│ CASO 1: Pool válido                     │
│ pool existe AND |pool.elo-userElo| ≤400 │
│ AND pool.puzzles.length > 0             │
└─────────────────────────────────────────┘
        │ SI
        ▼
  peekOnePuzzle() → mostrar en tarjeta (preview: NO remueve)
  Al interactuar con él → removePuzzleFromPool(uid)

        │ NO (pool inválido o vacío)
        ▼
┌─────────────────────────────────────────┐
│ CASO 2: Buscar en archivos CDN cacheados│
│ getCachedUrlsMatchingElo(userElo, ±100) │
└─────────────────────────────────────────┘
        │ URLs encontradas
        ▼
  getCachedPuzzles(url aleatoria) → puzzle[0] (shuffled)
  buildPool(userElo) en background [no bloqueante]

        │ Sin URLs en caché
        ▼
┌─────────────────────────────────────────┐
│ CASO 3: Descarga desde CDN              │
│ puzzlesProvider.getPuzzles({elo})       │
└─────────────────────────────────────────┘
        │
        ▼
  puzzle = puzzles[0]
  buildPool(userElo) en background [no bloqueante]
```

---

## `getNextPuzzle()` — única fuente de la sesión

Tanto `startInfinityPlan` (home) como `selectPuzzleToPlay` (training) piden puzzles **de a uno** por aquí:

```
getNextPuzzle()
  │
  ├─ popOnePuzzle()  → ¿hay? → devolverlo
  │
  └─ null (pool no puede servir)
        │
        ├─ refillPoolBackground(elo)   [no bloqueante]
        │
        └─ fetchOnePuzzleOutsidePool(elo)
              ├─ findPuzzleFromCachedFiles(elo)  → ¿hay? → devolverlo
              └─ puzzlesProvider.getPuzzles({elo}) → puzzles[0]
```

> **Nunca devuelve un lote, y esto es deliberado.** El acceso en training es por índice absoluto (`block.puzzles[countPuzzlesPlayedBlock]`) y solo consulta el pool cuando ese índice está vacío. Si el respaldo precargara 50 puzzles, el índice quedaría siempre lleno, el pool no se volvería a consultar **en toda la sesión**, y como esos 50 vendrían de `getPuzzlesForBlock` (un único tema fijo), la sesión entera quedaría encerrada en ese tema.
>
> **`getPuzzlesForBlock` no participa del camino infinity.** Devuelve `[...block.puzzles, ...nuevos]` (antepone las existentes, contrato del que dependen los demás planes para mantener alineado el índice absoluto). Usarlo aquí con `push(...)` reinyectaba los puzzles ya jugados y los reproducía en el mismo orden.

---

## Construcción del Pool (`buildPool`)

```
buildPool(elo)
  ├─ ¿hay build en vuelo? → devolver esa misma promesa (coalescing)
  └─ doBuildPool(elo)
       1. ¿Pool válido y sin necesidad de refresco? → retornar sin hacer nada
       2. Elegir 10 temas aleatorios de AVAILABLE_THEMES
       3. Fetch en paralelo: getPuzzles({ elo, theme, count: 5 }) × 10   [FUERA del lock]
       4. Flatten + shuffle + dedupeByUid
       5. [BAJO EL LOCK] re-leer el pool, conservar sólo lo que quede al MISMO elo,
          mergear + dedupe + slice(0, 50), guardar { id, puzzles, elo, createdAt }
```

- **Coalescing:** el home puede disparar dos `buildPool` concurrentes (casos 2 y 3 no son excluyentes). El segundo llamador espera al primero en vez de construir otro pool.
- **No hay guardado parcial.** Publicar un pool a medio construir significaba publicar 5 puzzles de **un solo tema** que `isPoolValid` aceptaba como válido — y no le servía a nadie, porque los `buildPool` del home son fire-and-forget y su resultado nunca se espera.
- **Merge, no `put` ciego.** El guardado final re-lee el pool bajo el lock y conserva lo que quede al mismo elo; un `put` ciego revertía los pops ocurridos durante la construcción y devolvía al pool puzzles ya servidos.
- **`dedupeByUid`** es necesario porque los temas se solapan (`mate`/`mateIn1`): el mismo puzzle llega en los archivos de dos temas.

---

## Relleno del Pool (`refillPoolBackground`)

Se dispara cuando el pool cae a ≤15 puzzles, cuando la deriva de elo supera el umbral de refresco, o cuando el pool no puede servir.

```
1. Si isRefilling → return (best-effort: descartar un relleno duplicado es aceptable)
2. Cargar pool actual
   └─ Si inválido O necesita refresco → delegar a buildPool(elo) y retornar
3. needed = 50 - pool.puzzles.length; si ≤ 0 → return
4. Calcular themeCount y elegir temas con espacio (themeCount[t] < 5)
5. Fetch de los puzzles faltantes                       [FUERA del lock]
6. [BAJO EL LOCK] re-leer el pool, merge + shuffle + dedupe → slice(0, 50)
   guardar con el elo del relleno (RE-ANCLAJE)
7. isRefilling = false (en finally)
```

> **Re-anclaje del elo.** El relleno guarda `elo` = el elo con que se pidieron los puzzles. Antes hacía `{ ...pool, puzzles: merged }`, y el spread conservaba el `pool.elo` viejo: rellenar **nunca podía devolverle la validez al pool**, sólo reconstruirlo desde cero podía.

---

## Invalidación y adaptación del ELO

El elo del usuario se recalcula **después de cada puzzle** (`profileService.calculateEloPuzzlePlan`, K=32), y el cambio es visible de inmediato (el perfil se muta en local, sin esperar a Firestore). Como los puzzles se piden al elo del pool, la expectativa ronda 0.5 y **cada puzzle mueve el elo ~±16**.

Por eso hay **dos umbrales** en vez de uno:

- **Refresco (100).** Es ~1σ de la deriva que el propio pool experimenta a lo largo de sus 50 puzzles (`16 × √50 ≈ 113`). Al cruzarlo se reconstruye el pool **al elo actual en background, sin dejar de servir el actual**: el usuario nunca espera. Una tolerancia por debajo de esa cifra garantiza tirar el pool antes de consumirlo — con el valor original de 50, el pool moría al 4º puzzle y se descartaba el ~90% de cada pool.
- **Duro (400).** Razón de expectativa 10:1 de la escala Elo (un puzzle 400 por debajo se resuelve ~91% de las veces): ahí la dificultad ya es genuinamente equivocada. Llegar requiere ~19 puzzles monótonos consecutivos, así que la reconstrucción en background siempre gana. Existe para el caso "retomo la app tras meses".

La deriva es **con reversión a la media**, no libre: al alejarte del elo del pool la expectativa sube, así que `change = 32 × (result − expected)` se encoge en victorias y crece en derrotas (a deriva 113, una victoria es +11 y una derrota −21). Eso hace de 100 un punto de operación estable.

Cuando el pool **no puede servir**, `popOnePuzzle` agenda la reconstrucción antes de devolver `null`. Antes devolvía `null` sin más y el pool quedaba muerto el resto de la sesión.

---

## Concurrencia (`withPoolLock`)

Todos los read-modify-write del pool (`getPool` → mutar → `saveInfinityPool`) pasan por una **cadena de promesas N=1**:

```ts
private withPoolLock<T>(task: () => Promise<T>): Promise<T>
```

**Por qué existe:** IndexedDB serializa transacciones, pero eso no ayuda aquí — la lectura y la escritura son **dos transacciones distintas** con un `await` en medio (IDB auto-commitea una transacción cuando su microtask queue se vacía, así que no se puede sostener una a través de un `await`). Sin el lock, dos pops concurrentes leen el mismo pool, ambos toman `puzzles[0]` y **sirven el mismo puzzle**, y la escritura de uno pisa la del otro (lost update).

Reglas:
- **Envueltos:** `popOnePuzzle`, `removePuzzleFromPool`, y el merge-and-save final de `buildPool` y `refillPoolBackground`.
- **No envueltos:** `getPool` y `peekOnePuzzle` (sólo lectura).
- **Nunca sostener el lock durante fetches al CDN.** `buildPool` hace 10 llamadas de red de segundos; sostener el lock congelaría cada pop del entrenamiento. Se descarga fuera y se mergea dentro.
- `refillPoolBackground` se invoca siempre **fire-and-forget desde dentro de tareas con lock** (nunca con `await`), para no auto-bloquear la cadena.

---

## Qué NO cambia

- La lógica de reposición de puzzles para planes distintos de `infinity` (warmup, plan1-30, backToCalm, reto333) **no se modifica**. Siguen usando `blockService.getPuzzlesForBlock()`, que respeta el tema, color y ELO del bloque, y cuyo contrato de anteponer los puzzles existentes se mantiene intacto.
- El caché de archivos CDN (`puzzlesCache` + `puzzlesIndex` en IndexedDB) sigue funcionando igual.
- El ELO del entrenamiento infinity (`infinityTotal` en Firestore) se sigue calculando y guardando como antes.

---

## Huecos conocidos

- **No hay deduplicación entre sesiones.** `dedupeByUid` actúa dentro de una construcción y de un relleno, pero nada compara contra `block.puzzlesPlayed` ni contra un histórico de puzzles servidos. Un puzzle visto hace días puede reaparecer. Es poco probable (50 puzzles sobre un corpus de miles) y de bajo impacto; se descartó a propósito por no justificar el coste de un registro persistente de uids servidos.
- **`peekOnePuzzle` no remueve.** El home muestra un preview y sólo remueve el puzzle si el usuario interactúa con él; si no, ese mismo puzzle puede salir luego en el entrenamiento.
