# Reproductor de Partidas / TV de Partidas — Feature Document

## Concepto

Poder **cargar una partida de ajedrez y reproducirla automáticamente** sobre el tablero, con un **timer configurable por movimiento** (1s, 2s, 3s…), como si fuera un video: play, pausa, avanzar/retroceder jugada, ir al inicio/fin.

Y un nivel más: poder **cargar un archivo con muchas partidas** (un PGN multi-partida, p. ej. todas las partidas de un jugador) y que la app **las vaya reproduciendo una tras otra** — un **"TV de partidas"**. Así el usuario puede sentarse a ver, por ejemplo, "las partidas de Kasparov" o "mis últimas 20 partidas de Lichess" en modo pasivo, o navegarlas una a una.

Dos casos de uso que comparten el mismo motor:

1. **Reproductor de una partida** — pego/importo un PGN, elijo la velocidad, le doy play y la veo desarrollarse.
2. **TV de partidas** — importo un archivo `.pgn` con N partidas y las reproduzco en cadena (autoplay entre partidas) o salto entre ellas desde una lista.

> **Base técnica ya existente**: el componente [`BoardPuzzleSolutionComponent`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts) de `@chesspark/board` ya hace casi todo lo necesario para reproducir una secuencia de jugadas: mantiene `arrayFenSolution` / `arrayMovesSolution`, un `currentMoveNumber`, botones de anterior/siguiente/ir-al-final, reproducción con `interval` de RxJS, `cm-chessboard` para el render, `chess.js` para la lógica y `SoundsService` para el sonido de las piezas. Este feature es, en buena parte, **generalizar ese motor** para que consuma un PGN arbitrario (no solo la solución de un puzzle) y añadirle el timer configurable y el encadenado de partidas.

---

## Objetivos

- Dar una herramienta de **estudio pasivo/activo**: ver partidas completas sobre el tablero sin tener que moverlas a mano.
- **Velocidad configurable por jugada** para adaptar el ritmo (repaso rápido vs. estudio lento).
- Soportar **archivos multi-partida** (colecciones de un jugador, torneo, apertura) y reproducirlos en secuencia — el "TV".
- Reutilizar el **tablero y motor de reproducción ya existentes** (`@chesspark/board`, `chess.js`, `cm-chessboard`) en vez de reinventarlos.
- Mantenerlo **offline-first**: la reproducción no depende de red una vez cargado el PGN.

---

## Alcance funcional

### 1. Reproductor de una sola partida

**Entrada del PGN** (cualquiera de estas vías):
- Pegar texto PGN en un textarea.
- Importar un archivo `.pgn` desde el dispositivo.
- (Futuro) Importar por URL / desde un ID de Lichess/Chess.com.

**Controles de reproducción** (sobre el tablero):

| Control | Acción |
|---------|--------|
| ▶ / ⏸ Play/Pausa | Inicia/pausa la reproducción automática al ritmo del timer |
| ⏮ Inicio | Vuelve a la posición inicial |
| ◀ Anterior | Retrocede una jugada |
| ▶ Siguiente | Avanza una jugada |
| ⏭ Final | Salta a la posición final |
| 🔄 Girar | Invierte la orientación del tablero (ver desde negras) |
| ⏱ Velocidad | Selector del timer por jugada (0.5s / 1s / 2s / 3s / 5s / manual) |

**Información en pantalla**:
- Cabecera con metadatos del PGN (`White`, `Black`, `Event`, `Date`, `Result`, ELOs si están).
- Lista de jugadas (notación SAN) con resaltado de la jugada actual; tocar una jugada salta a esa posición.
- Indicador de progreso (`jugada 12 / 40`).
- Barra tipo "scrubber" para arrastrar por la partida (nice-to-have).

**Comportamiento del timer**:
- Al llegar al final, se detiene (no hace loop por defecto; loop opcional).
- Sonido de pieza en cada jugada (reutilizando `SoundsService`), con opción de silenciar.

### 2. TV de partidas (archivo multi-partida)

- Al importar un `.pgn` con varias partidas, se parsea la **lista completa** y se muestra un **selector/lista de partidas** (con `White`, `Black`, resultado, evento, fecha).
- **Reproducción encadenada (autoplay)**: al terminar una partida, tras una **pausa configurable entre partidas** (p. ej. 3s), pasa automáticamente a la siguiente. Esto es el "modo TV".
- Controles adicionales del TV:
  - ⏭ Siguiente partida / ⏮ Partida anterior.
  - Modo **autoplay entre partidas** on/off.
  - **Aleatorio** (shuffle) on/off — útil para colecciones grandes.
  - **Loop de la colección** on/off.
- La lista permite saltar directamente a cualquier partida.

---

## Flujo de usuario

```
[Usuario abre "Reproductor de partidas"]
        ↓
[Elige fuente: pegar PGN | importar .pgn]
        ↓
┌─────────────── ¿1 partida o varias? ───────────────┐
│                                                     │
▼ (1 partida)                          ▼ (N partidas → TV)
[Se carga la partida]                  [Se parsea la colección]
        ↓                                      ↓
[Tablero + controles + velocidad]      [Lista de partidas + tablero]
        ↓                                      ↓
[▶ Play: reproduce jugada a jugada]    [▶ Play de la 1ª partida]
        ↓                                      ↓
[Fin de la partida → stop/loop]        [Fin → pausa Ns → siguiente partida]
                                               ↓
                                       [Recorre toda la colección
                                        (autoplay / shuffle / loop)]
```

---

## Diseño técnico

### Ubicación en el proyecto

- **Nueva página**: `apps/chessColate/src/app/pages/game-viewer/` (nombre a alinear: `game-viewer` / `partidas` / `tv`), registrada en [`app.routes.ts`](../../apps/chessColate/src/app/app.routes.ts).
- **Componente de reproducción reutilizable en `@chesspark/board`**: extraer/generalizar el motor de [`board-puzzle-solution.component.ts`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts) a un nuevo `board-game-player` (o parametrizar el existente) que reciba una lista de posiciones y exponga los controles de reproducción. El tablero base es [`board.component.ts`](../../libs/board/src/lib/board/board.component.ts) / [`fen-board.component.ts`](../../libs/board/src/lib/fen-board/fen-board.component.ts).
- **Servicio de parseo PGN**: `GamePgnService` (nuevo, en `libs/common-utils` o en la app), envuelve `chess.js` para convertir PGN → estructura navegable.

### Parseo de PGN

`chess.js` (ya en el repo, `^1.4.0`) sabe cargar un PGN de **una** partida (`chess.loadPgn(pgn)` + `chess.history()`), pero **no** separa un archivo multi-partida. Para el TV hay que **dividir el archivo en partidas individuales** antes de pasarlas a `chess.js`.

Opciones para el split multi-partida:
- **Split propio por regex** sobre los headers `[Event ...]` (cada partida empieza con un bloque de tags). Suficiente para PGNs estándar, cero dependencias nuevas.
- **Librería dedicada** (`@mliebelt/pgn-parser` o similar) si necesitamos tolerar variantes, comentarios NAG, sub-líneas, etc. — evaluar solo si el split propio se queda corto.

De cada partida derivamos, con `chess.js`, la secuencia de **FENs** y de **movimientos SAN** — exactamente el mismo par de arrays (`arrayFenSolution` / `arrayMovesSolution`) que ya consume el componente de solución de puzzles.

### Modelo de datos

```ts
interface ParsedGame {
  id: string;                 // uid local para la sesión
  headers: Record<string, string>;  // White, Black, Event, Date, Result, WhiteElo...
  sanMoves: string[];         // ['e4', 'e5', 'Nf3', ...]
  fens: string[];             // FEN por cada ply, incluyendo la posición inicial
  result: string;             // '1-0' | '0-1' | '1/2-1/2' | '*'
  startFen?: string;          // para partidas con posición inicial no estándar (Chess960/FEN tag)
}

interface GameCollection {
  source: 'paste' | 'file';
  fileName?: string;
  games: ParsedGame[];
}

interface PlaybackSettings {
  msPerMove: number;          // 500 | 1000 | 2000 | 3000 | 5000
  soundEnabled: boolean;
  autoNextGame: boolean;      // modo TV: encadenar partidas
  gapBetweenGamesMs: number;  // pausa entre partidas (p. ej. 3000)
  shuffle: boolean;
  loopCollection: boolean;
  boardOrientation: 'white' | 'black';
}
```

`PlaybackSettings` se persiste en el storage local ya usado por la app (mismo patrón que el resto de settings) para recordar la velocidad preferida.

### Motor de reproducción

Reusar el patrón ya presente en el componente de solución:
- `currentMoveNumber` como índice sobre `fens`.
- Reproducción automática con `interval(msPerMove)` de RxJS + `takeUntil` para pausar/parar.
- En cada tick: `board.setPosition(fens[i])`, resaltar la jugada en la lista, disparar sonido.
- Al llegar a `fens.length - 1`: parar; si `autoNextGame`, esperar `gapBetweenGamesMs` y cargar la siguiente `ParsedGame` (respetando `shuffle` / `loopCollection`).

### Casos borde a contemplar

- PGN inválido o vacío → mensaje de error claro, no romper la pantalla.
- Partidas con **variantes/comentarios/NAGs** → en el MVP se ignoran las sub-líneas y se reproduce solo la línea principal.
- **Posición inicial no estándar** (tag `[FEN ...]`, Chess960) → respetar `startFen`.
- Partida sin movimientos (solo headers) → saltarla en el TV.
- Archivos **muy grandes** (cientos de partidas) → parsear de forma perezosa/paginada para no bloquear la UI.
- Promociones y enroques → ya cubiertos por `chess.js` al derivar los FENs.

---

## Instrumentación (analytics)

Reusar el `AnalyticsService` existente (catálogo en [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md)). Eventos sugeridos:

| Evento | Cuándo | Params |
|--------|--------|--------|
| `game_viewer_opened` | se abre la pantalla | `source` (`home`/`menu`) |
| `game_loaded` | se carga PGN correctamente | `mode` (`single`/`collection`), `games_count`, `input` (`paste`/`file`) |
| `game_playback_started` | play de una partida | `ms_per_move` |
| `game_viewer_speed_changed` | cambia el timer | `ms_per_move` |
| `tv_autoplay_next` | encadena a la siguiente partida | `index`, `games_count` |
| `game_load_failed` | PGN inválido | `reason` |

---

## Consideraciones UX

- **Controles grandes y accesibles** (es una experiencia tipo "reproductor de video", pensada para móvil y para dejar corriendo).
- **La velocidad debe ser fácil de cambiar en caliente**, sin reiniciar la partida.
- **Modo TV = mínima fricción**: darle play y que ruede solo; los controles de partida siguiente/anterior siempre visibles.
- **Cabecera con quién juega contra quién** siempre visible — clave cuando se ven colecciones de un jugador.
- **Silenciar el sonido** con un toque (para dejarlo de fondo).
- Respetar la **orientación** elegida a través de las partidas del TV.

---

## Métricas de éxito

- Nº de `game_loaded` (uso real) y proporción `single` vs `collection`.
- Duración media de sesión en la pantalla del TV.
- Distribución de `ms_per_move` (qué velocidad prefiere la gente).
- Tasa de `game_load_failed` (calidad del parseo).

---

## Alcance inicial (MVP)

1. Página nueva "Reproductor de partidas" enlazada desde el menú/home.
2. Cargar **una** partida por PGN pegado + reproducción con **timer configurable** (0.5/1/2/3/5s) y controles play/pausa/anterior/siguiente/inicio/fin.
3. Lista de jugadas con salto por clic + cabecera de metadatos + girar tablero + sonido on/off.
4. Generalizar el motor de reproducción a partir de [`board-puzzle-solution.component.ts`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts).
5. **TV**: importar `.pgn` multi-partida, lista de partidas, autoplay encadenado con pausa entre partidas, siguiente/anterior partida.
6. Persistir `PlaybackSettings` (velocidad, sonido) y eventos de analytics.

## Fuera de alcance inicial

- Variantes, comentarios y NAGs (solo línea principal en el MVP).
- Importar por URL / API de Lichess o Chess.com (solo pegar + archivo local).
- Análisis con Stockfish sobre la partida reproducida (el motor ya está en `@chesspark/stockfish-wasm`; se puede añadir después como "evaluar esta posición").
- Guardar/gestionar colecciones de partidas en la nube (por ahora es una carga efímera por sesión).
- Scrubber/timeline con arrastre fino (nice-to-have, no bloqueante).

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar** los detalles de diseño/producto:

1. **Nombre y ubicación**: ¿"Reproductor de partidas", "TV de partidas", "Ver partidas"? ¿Entrada desde el home, el menú lateral o ambos?
2. **Velocidades del timer**: ¿el set 0.5/1/2/3/5s está bien, o prefieres un slider continuo?
3. **Split multi-PGN**: ¿empezamos con split propio por regex (cero deps) o metemos ya una librería de parseo robusta?
4. **Modo TV por defecto**: al cargar una colección, ¿arranca en autoplay solo o espera al play del usuario?
5. **Fuentes de entrada del MVP**: ¿pegar + archivo local es suficiente, o quieres desde el inicio la importación por usuario de Lichess/Chess.com?
6. **Reutilización vs. componente nuevo**: ¿generalizamos `BoardPuzzleSolutionComponent` (riesgo de tocar el flujo de puzzles) o creamos un `BoardGamePlayerComponent` hermano y compartimos utilidades?

---

## Dependencias técnicas

- `chess.js` (ya en el repo) para derivar FENs/SAN de cada partida.
- `cm-chessboard` + `@chesspark/board` (ya en el repo) para el render y los controles.
- `SoundsService` de `@chesspark/common-utils` para el sonido de piezas.
- Storage local existente para `PlaybackSettings`.
- Import de archivos: plugin de Capacitor para leer `.pgn` del dispositivo (p. ej. `@capacitor/filesystem` / file input web).
- `AnalyticsService` existente para la instrumentación.
- (Opcional futuro) split robusto de PGN multi-partida (`@mliebelt/pgn-parser` u otro).
