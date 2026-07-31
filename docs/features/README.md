# Índice de Features — ChessColate

Este documento es el **índice de todas las features propuestas** (carpeta [`docs/features/`](.)) y su **orden de implementación recomendado**. Las features ya implementadas viven en [`docs/implementado/`](../implementado/).

El orden busca tres cosas, en este equilibrio: **(1)** construir primero los _bloques compartidos_ que abaratan las siguientes, **(2)** priorizar features de **alto valor / esfuerzo contenido** (retención, hábito) y **(3)** dejar para el final lo que depende de **backend, hardware o infra pesada** (PvP, GPS/AR, APIs externas).

---

## Orden recomendado

| # | Feature | Valor | Esfuerzo | Depende de |
|---|---------|-------|----------|------------|
| 1 | [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md) | Medio | Medio | — (crea el util de PGN compartido) |
| 2 | [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md) | Alto | Medio | #1 (parseo PGN) |
| 3 | [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md) | Alto | Medio | #2 (set congelado) |
| 4 | [Puzzle Feed](./PUZZLE_FEED.md) | Alto (engagement) | Medio-Alto | — |
| 5 | [Chess Runner](./CHESS_RUNNER.md) | Medio | Medio | — |
| 6 | [Game Analytics](./GAME_ANALYTICS.md) | Alto | Alto | APIs externas (chess.com/lichess) |
| 7 | [Sparring Personalizado (IA con tu estilo)](./SPARRING_PERSONALIZADO.md) | Alto | Alto (Nivel 1) / Muy Alto (Nivel 2) | #6 (ingesta de partidas) + `stockfish-wasm` |
| 8 | [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md) | Alto | Muy Alto | Backend + matchmaking |
| 9 | [Puzzle Racer (Multijugador)](./PUZZLE_RACER.md) | Alto (competitivo/viral) | Alto | RTDB + matchmaking (sin backend propio) |
| 10 | [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md) | Medio (nicho) | Muy Alto | GPS + AR + permisos |

> Las dos primeras del plan original —**Notificaciones de Entrenamiento** y
> **Racha de Puzzles**— ya están implementadas; ver [Ya implementado](#ya-implementado).

---

## Por qué este orden

### 1 · [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md)
**Cimiento técnico de las dos siguientes.** Introduce el **util de parseo de PGN con `chess.js`** y **generaliza el motor de reproducción** de jugadas (a partir de [`board-puzzle-solution`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts)). Es relativamente autocontenido (no toca ELO ni scoring) y deja listo un componente reutilizable.

### 2 · [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md)
**Reutiliza el parseo PGN de #1** y estrena el patrón de **"set de puzzles congelado y persistido"** (en vez de re-pedirlo al catálogo). Alto valor para entrenadores y estudio dirigido.

### 3 · [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md)
**Reutiliza el "set congelado" de #2** y le añade **vueltas + timing decreciente + comparación entre pasadas**. Al llegar después de #2, gran parte de la persistencia y del juego por set ya está resuelta.

### 4 · [Puzzle Feed](./PUZZLE_FEED.md)
**Motor de engagement** estilo TikTok/Reels sobre puzzles. Reutiliza [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) y el catálogo; el algoritmo de recomendación puede empezar **local** (ELO + temas + historial) sin backend. Alto potencial de uso, independiente de #1–#3.

### 5 · [Chess Runner](./CHESS_RUNNER.md)
**Capa de gamificación** (mini-juego previo al puzzle). Autocontenido, sin dependencias de datos externas; encaja cuando ya hay volumen de puzzles jugándose. Esfuerzo medio (animación/gameplay).

### 6 · [Game Analytics](./GAME_ANALYTICS.md)
**Nuevas libs** (`chess-com-provider`, `lichess-provider`, `game-reporter`) y **APIs externas**. Alto valor pero mayor superficie y dependencia de terceros; es bastante independiente, así que puede solaparse en paralelo con las anteriores si hay capacidad.

### 7 · [Sparring Personalizado (IA con tu estilo)](./SPARRING_PERSONALIZADO.md)
**Consume directamente la ingesta de #6**: los providers de chess.com/lichess, el caché de partidas y el modelo `ChessGame`. A partir de ahí construye un **perfil de estilo** y un rival jugable que aproxima tu fuerza y tus manías. El **Nivel 1** (perfil estadístico + Stockfish sesgado con [`stockfish-wasm`](../../libs/stockfish-wasm/src/lib/)) es **on-device, sin backend** — de ahí que llegue justo tras #6. El **Nivel 2** (clon neuronal tipo Maia fine-tuneado) es I+D con GPU/backend y **no bloquea** el lanzamiento.

### 8 · [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md)
**PvP asíncrono** con matchmaking, economía de poderes y estado compartido → **requiere backend**. Complejidad alta; conviene atacarlo cuando la base de usuarios (que la Racha y #4 ayudan a crecer) lo justifique.

### 9 · [Puzzle Racer (Multijugador)](./PUZZLE_RACER.md)
**PvP en tiempo real** estilo [Puzzle Racer de Lichess](https://lichess.org/racer): varios jugadores compiten sobre la **misma secuencia de puzzles** contra el reloj. A diferencia de #8, está diseñado para correr **sin backend propio**: Firebase solo transporta enteros diminutos por un canal efímero de **Realtime Database** y el contenido de los puzzles sale del CDN + caché que ya existe — el objetivo explícito es que **casi no consuma recursos de Firebase** (~10 000 carreras por dólar de ancho de banda). Estrena el bloque compartido de **RTDB + matchmaking client-side** que #8 puede reutilizar. Alto valor competitivo/viral; llega en el clúster PvP porque el matchmaking y la sincronización son la parte más delicada.

### 10 · [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md)
**GPS + AR + permisos de cámara/ubicación.** El más caro en hardware/plataforma y el más de nicho. Último, como apuesta diferenciadora una vez consolidado el núcleo.

---

## Bloques compartidos (construir una vez, reutilizar)

Conviene tratarlos como piezas transversales, no re-implementarlas por feature:

- **Util de parseo PGN** (`chess.js`) → lo estrena #1 y lo reutilizan #2 y #3. Extraer a [`libs/common-utils`](../../libs/common-utils).
- **Set de puzzles congelado y persistido por id** → patrón común de #2 y #3 (y posible fuente de sets en #3). Evita el _strip_ actual de `puzzles` al guardar planes.
- **Motor de reproducción de jugadas** (tablero + secuencia de FEN/SAN + controles) → de #1, reutilizable donde se "reproduzca" una línea.
- **Board de puzzles** [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) → ya existe; lo consumen la Racha, #2, #3, #4, #5, #9 y #10.
- **RTDB + matchmaking client-side** (canal efímero de tiempo real, transacciones de lobby, `onDisconnect`) → lo estrena #9 y lo puede reutilizar #8 (Cuadros de Conquista) para su capa PvP. RTDB no está cableada hoy (solo Firestore).
- **AnalyticsService** [(catálogo)](../implementado/OBSERVABILITY_TRACKING.md) → todas instrumentan sobre la base ya implementada.

---

## Leyenda

- **Valor**: impacto esperado en retención/engagement/diferenciación.
- **Esfuerzo**: tamaño relativo de implementación (incl. infra y plataforma).
- El orden es una **recomendación**, no un contrato: #6 (Game Analytics) es lo bastante independiente como para paralelizarse; #4 (Puzzle Feed) puede adelantarse si la prioridad es crecimiento antes que las herramientas de estudio (#1–#3).

---

## Ya implementado

- [Observabilidad — Tracking](../implementado/OBSERVABILITY_TRACKING.md) · [Referencia](../implementado/OBSERVABILITY_REFERENCIA.md) — Firebase Analytics + Crashlytics y el `AnalyticsService` que reutilizan todas las features.
- [Recordatorios de Entrenamiento](../implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md) — recordatorio automático que aprende tu hora habitual, más alarmas manuales por día. Idea original en [`NOTIFICACIONES_ENTRENAMIENTO.md`](./NOTIFICACIONES_ENTRENAMIENTO.md).
- [Racha de Puzzles](../implementado/RACHA_STREAK_FLOW.md) — modo de muerte súbita con dificultad creciente y récord personal. Idea original en [`RACHA_STREAK.md`](./RACHA_STREAK.md).
