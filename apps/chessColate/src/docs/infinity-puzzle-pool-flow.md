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
  elo: number          // ELO con que fue construido el pool
  createdAt: number    // timestamp Date.now()
}
```

---

## Reglas del Pool

| Propiedad           | Valor                                 |
|---------------------|---------------------------------------|
| Tamaño objetivo     | 50 puzzles                            |
| Máx. por tema       | 5 puzzles (en el pool total)          |
| Temas mínimos       | 10 distintos al construir             |
| ELO de referencia   | `infinityTotal` del perfil (1500 si sin sesión) |
| Invalidación        | `|pool.elo - userElo| > 50`           |
| Umbral de relleno   | ≤ 15 puzzles restantes → relleno en background |

---

## Flujo Completo

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
│ pool existe AND |pool.elo - userElo|≤50 │
│ AND pool.puzzles.length > 0             │
└─────────────────────────────────────────┘
        │ SI
        ▼
  popOnePuzzle() → mostrar en tarjeta
  Si pool ≤15 → refillPoolBackground() [no bloqueante]

        │ NO (pool inválido o vacío)
        ▼
┌─────────────────────────────────────────┐
│ CASO 2: Buscar en archivos CDN cacheados│
│ getCachedUrlsMatchingElo(userElo, ±50)  │
│ Parsea URLs del puzzlesIndex IDB        │
└─────────────────────────────────────────┘
        │ URLs encontradas
        ▼
  getCachedPuzzles(url aleatoria) → puzzle[0] (shuffled)
  buildPool(userElo) en background [no bloqueante]
  mostrar puzzle

        │ Sin URLs en caché
        ▼
┌─────────────────────────────────────────┐
│ CASO 3: Descarga desde CDN              │
│ puzzlesProvider.getPuzzles({elo, count})│
└─────────────────────────────────────────┘
        │
        ▼
  puzzle = puzzles[0]
  buildPool(userElo) en background [no bloqueante]
  mostrar puzzle
```

---

## Construcción del Pool (`buildPool`)

```
1. Verificar si ya existe pool válido → si sí, retornar sin hacer nada
2. Elegir 10 temas aleatorios de AVAILABLE_THEMES (58 disponibles)
3. Fetch en paralelo: getPuzzles({ elo, theme, count: 5 }) × 10 temas
4. Flatten + shuffle → slice(0, 50)
5. Guardar en IndexedDB: { id, puzzles, elo, createdAt }
```

---

## Relleno del Pool (`refillPoolBackground`)

Se dispara cuando el pool cae a ≤15 puzzles (tras pop o take).

```
1. Si isRefilling === true → return (evita concurrencia)
2. isRefilling = true
3. Cargar pool actual
   ├─ Si inválido → delegar a buildPool(elo) y retornar
4. needed = 50 - pool.puzzles.length
5. Calcular themeCount de puzzles existentes
6. Seleccionar temas con espacio (themeCount[t] < 5)
7. Fetch puzzles faltantes por tema
8. Merge con existentes + shuffle → slice(0, 50)
9. Guardar pool actualizado
10. isRefilling = false (en finally)
```

---

## Flujo al Iniciar Entrenamiento Continuo (`startInfinityPlan`)

```
Usuario presiona "Continuar" en tarjeta del home
        │
        ▼
generateBlocksForPlan('infinity')
  → block.elo = profileService.getEloTotalByPlanType('infinity')

        │
        ▼
takePuzzles(20) del pool
  ├─ Pool válido con ≥20 → retorna 20 puzzles
  ├─ Pool válido con <20 → retorna los disponibles
  └─ Pool inválido/vacío → retorna []
        │
        ▼
  ¿poolPuzzles.length > 0?
  │ SI → blocks[0].puzzles = poolPuzzles
  │ NO → blocks[0].puzzles = blockService.getPuzzlesForBlock(blocks[0])
        │
        ▼
  planService.newPlan(blocks, 'infinity')
  router.navigate(['/puzzles/training'])
```

---

## Flujo de Reposición Durante el Entrenamiento

```
Usuario resuelve puzzle (onPuzzleCompleted)
        │
        ▼
selectPuzzleToPlay()
  puzzlesLeftToPlay = block.puzzles.length - countPuzzlesPlayedBlock

        │
  ¿puzzlesLeftToPlay < 10 AND !isInfinityRefetching?
        │ NO → continuar normalmente
        │ YES (planType === 'infinity')
        ▼
  isInfinityRefetching = true
  takePuzzles(20)
    ├─ Hay puzzles → block.puzzles = nuevos; countPuzzlesPlayedBlock = 0
    └─ Pool vacío → fallback: blockService.getPuzzlesForBlock(currentBlock)
                              block.puzzles = nuevos; countPuzzlesPlayedBlock = 0
  isInfinityRefetching = false (finally)

  [Para otros planes: lógica existente sin cambios]
```

> **Nota sobre `countPuzzlesPlayedBlock = 0`:** El acceso a puzzles es por índice absoluto (`block.puzzles[countPuzzlesPlayedBlock]`). Al reemplazar el array con un batch nuevo, el contador se reinicia para acceder desde el primer elemento del nuevo lote.

---

## Invalidación del Pool

El pool queda obsoleto cuando:
- `Math.abs(pool.elo - userElo) > 50`

Por ejemplo: pool construido con ELO 1800, usuario ahora tiene 1860 → pool sigue válido. Si tiene 1860 → 1851+ ya invaliada. Si tiene 1800 → 1751- o 1851+ invalida.

Cuando el pool es inválido, se descarta automáticamente y se reconstruye la próxima vez que se necesite (via `buildPool`).

---

## Qué NO cambia

- La lógica de reposición de puzzles para planes distintos de `infinity` (warmup, plan1-30, backToCalm, reto333) **no se modifica**. Siguen usando `blockService.getPuzzlesForBlock()` que respeta el tema y ELO del bloque.
- El caché de archivos CDN (`puzzlesCache` + `puzzlesIndex` en IndexedDB) sigue funcionando igual.
- El ELO por tema dentro del entrenamiento infinity (`infinityTotal` en Firestore) se sigue calculando y guardando como antes.
