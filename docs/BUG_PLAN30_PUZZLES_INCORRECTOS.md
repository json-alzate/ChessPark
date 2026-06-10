# Bug: jugadas correctas marcadas como incorrectas en plan30

> Estado: **pendiente de fix**. Documento de análisis para trabajar después.

## Síntoma reportado

Jugando el `plan30`, en un bloque en particular "algo se quedó pegado": a partir de
ese punto, al contestar los puzzles con la **jugada correcta** se marcaban como
**incorrectos**. El tablero seguía aceptando el movimiento (se podía arrastrar la
pieza), pero la validación siempre fallaba para el resto del bloque.

## Causa raíz

Archivo: `libs/board/src/lib/board-puzzle/board-puzzle.component.ts`

El componente del tablero **se reutiliza** (misma instancia) para todos los puzzles
del plan/bloque. Cada puzzle nuevo entra por el setter `setPuzzle` (línea ~152), que
solo hace `stopTimer()` + `initPuzzle()`.

La validación de si una jugada es correcta depende **enteramente** de un contador
compartido `currentMoveNumber`:

```ts
// validateMove() — línea ~657
this.currentMoveNumber++;
if (fenChessInstance === this.arrayFenSolution[this.currentMoveNumber] ||
    this.chessInstance.isCheckmate()) {
  // correcto
} else {
  this.puzzleFailed.emit(...); // incorrecto
}
```

Si `currentMoveNumber` (o `arrayFenSolution`) queda **desincronizado** del tablero, la
jugada correcta se compara contra el FEN equivocado → cae en el `else` → se marca como
incorrecta. Como el desfase vive en la instancia reutilizada, **todas** las jugadas
siguientes del bloque salen mal.

## Por qué se desincroniza: tareas async que nadie cancela

`stopTimer()` (línea ~638) solo completa `timerUnsubscribe$` y resetea la barra de
progreso. **No cancela** tres tareas async que mutan estado compartido y pueden
"sobrevivir" al cambio de puzzle:

1. **`setTimeout(500ms)` dentro de `puzzleMoveResponse()`** (línea ~698-741).
   Incrementa `currentMoveNumber` de forma **síncrona** (línea ~699) y luego, tras
   500ms, hace `chessInstance.load(arrayFenSolution[currentMoveNumber])` y reescribe
   `fenToCompareAndPlaySound`. Se llama **sin `await`** desde `initPuzzle()` (línea
   ~227). Un `puzzleMoveResponse` pendiente del puzzle anterior puede disparar sobre
   los arreglos del puzzle nuevo.

2. **Bucle de `startStreamSolution()`** (línea ~743-767). Al fallar o agotarse el
   tiempo se anima la solución con esperas de 600ms + 1000ms por jugada + 800ms
   (varios segundos). Si en ese lapso entra el siguiente puzzle, `initPuzzle()`
   reconstruye `arrayFenSolution`/`arrayMovesSolution` **mientras el bucle sigue
   corriendo** leyendo esos mismos arreglos ya reemplazados. Además llama
   `board.disableMoveInput()` (línea ~745) y **nada vuelve a habilitar el input**
   (`enableMoveInput` solo se llama una vez en `buildBoard`, línea ~273). Candidato
   más fuerte para el "se quedó pegado".

3. **Gosh timer del bloque a ciegas** (`initGoshTimer`, línea ~608-635). El bloque 5
   de plan30 (Challenge/BLIND, `goshPuzzleTime`) manipula el DOM (`.pieces` opacity)
   por `boardId`. Suma otra fuente de timing/estado que se cruza con las anteriores.

## Cadena más probable del caso reportado

1. Se resuelve/falla el último puzzle del bloque → queda un `puzzleMoveResponse` o un
   `startStreamSolution` en vuelo.
2. Entra el puzzle siguiente → `initPuzzle()` resetea `currentMoveNumber = 0` y
   reconstruye los arreglos de forma síncrona, pero **no cancela** las tareas async.
3. La tarea vieja dispara y pisa el tablero / `fenToCompareAndPlaySound` / deja el
   input deshabilitado, o un segundo `puzzleMoveResponse` adelanta
   `currentMoveNumber` de más.
4. Desde ahí, `arrayFenSolution[currentMoveNumber]` ya no corresponde a la posición
   real → cada jugada correcta cae en el `else` → **marcada incorrecta** para todo el
   resto del bloque.

## En una frase

No hay mecanismo de cancelación/identidad por puzzle: componente reutilizado + estado
mutable compartido (`currentMoveNumber`, `arrayFenSolution`, `fenToCompareAndPlaySound`,
input del tablero) + tres tareas async (`setTimeout` de respuesta,
`startStreamSolution`, gosh timer) que `stopTimer()` no cancela. Cuando una se solapa
con el cambio de puzzle, el contador queda desfasado y las respuestas correctas se
evalúan contra el FEN equivocado.

## Dirección del fix (propuesta, pendiente de implementar)

- Introducir un **token/`generationId` por puzzle** (o un `AbortController`/`Subject`)
  que las tareas async verifiquen antes de tocar estado; descartar resultados de un
  puzzle ya superado.
- Hacer que `stopTimer()` (o un nuevo `cancelPendingWork()`) **cancele** el
  `setTimeout` de `puzzleMoveResponse` y corte el bucle de `startStreamSolution`.
- Reactivar `enableMoveInput()` al iniciar cada puzzle (`initPuzzle`).
- Resetear `currentMoveNumber` de forma atómica y garantizar que ningún callback
  viejo lo modifique.

## Punteros de código

- `setPuzzle` setter: línea ~152
- `initPuzzle()`: línea ~193 (reset de estado), llamada sin await a `puzzleMoveResponse` línea ~227
- `validateMove()`: línea ~649
- `puzzleMoveResponse()` (setTimeout 500ms): línea ~698
- `startStreamSolution()`: línea ~743 (`disableMoveInput` línea ~745)
- `stopTimer()`: línea ~638
- `initTimer()`: línea ~546
- `initGoshTimer()`: línea ~608
- `enableMoveInput`: línea ~273 (solo en `buildBoard`)
