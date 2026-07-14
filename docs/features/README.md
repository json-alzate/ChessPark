# Índice de Features — ChessColate

Este documento es el **índice de todas las features propuestas** (carpeta [`docs/features/`](.)) y su **orden de implementación recomendado**. Las features ya implementadas viven en [`docs/implementado/`](../implementado/).

El orden busca tres cosas, en este equilibrio: **(1)** construir primero los _bloques compartidos_ que abaratan las siguientes, **(2)** priorizar features de **alto valor / esfuerzo contenido** (retención, hábito) y **(3)** dejar para el final lo que depende de **backend, hardware o infra pesada** (PvP, GPS/AR, APIs externas).

---

## Orden recomendado

| # | Feature | Valor | Esfuerzo | Depende de |
|---|---------|-------|----------|------------|
| 1 | [Notificaciones de Entrenamiento](./NOTIFICACIONES_ENTRENAMIENTO.md) | Alto (retención) | Bajo-Medio | [Observabilidad](../implementado/OBSERVABILITY_TRACKING.md) (ya lista) |
| 2 | [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md) | Medio | Medio | — (crea el util de PGN compartido) |
| 3 | [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md) | Alto | Medio | #2 (parseo PGN) |
| 4 | [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md) | Alto | Medio | #3 (set congelado) |
| 5 | [Puzzle Feed](./PUZZLE_FEED.md) | Alto (engagement) | Medio-Alto | — |
| 6 | [Chess Runner](./CHESS_RUNNER.md) | Medio | Medio | — |
| 7 | [Game Analytics](./GAME_ANALYTICS.md) | Alto | Alto | APIs externas (chess.com/lichess) |
| 8 | [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md) | Alto | Muy Alto | Backend + matchmaking |
| 9 | [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md) | Medio (nicho) | Muy Alto | GPS + AR + permisos |

---

## Por qué este orden

### 1 · [Notificaciones de Entrenamiento](./NOTIFICACIONES_ENTRENAMIENTO.md)
**Primero por ROI.** Es la palanca de **retención y hábito** más directa, de alcance contenido (notificaciones locales de Capacitor, sin backend) y se apoya en la [observabilidad ya implementada](../implementado/OBSERVABILITY_TRACKING.md) para saber a qué hora entrena cada usuario. Mejora todas las demás features: si el usuario vuelve, todo lo demás rinde más.

### 2 · [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md)
**Cimiento técnico de las dos siguientes.** Introduce el **util de parseo de PGN con `chess.js`** y **generaliza el motor de reproducción** de jugadas (a partir de [`board-puzzle-solution`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts)). Es relativamente autocontenido (no toca ELO ni scoring) y deja listo un componente reutilizable.

### 3 · [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md)
**Reutiliza el parseo PGN de #2** y estrena el patrón de **"set de puzzles congelado y persistido"** (en vez de re-pedirlo al catálogo). Alto valor para entrenadores y estudio dirigido.

### 4 · [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md)
**Reutiliza el "set congelado" de #3** y le añade **vueltas + timing decreciente + comparación entre pasadas**. Al llegar después de #3, gran parte de la persistencia y del juego por set ya está resuelta.

### 5 · [Puzzle Feed](./PUZZLE_FEED.md)
**Motor de engagement** estilo TikTok/Reels sobre puzzles. Reutiliza [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) y el catálogo; el algoritmo de recomendación puede empezar **local** (ELO + temas + historial) sin backend. Alto potencial de uso, independiente de #1–#4.

### 6 · [Chess Runner](./CHESS_RUNNER.md)
**Capa de gamificación** (mini-juego previo al puzzle). Autocontenido, sin dependencias de datos externas; encaja cuando ya hay volumen de puzzles jugándose. Esfuerzo medio (animación/gameplay).

### 7 · [Game Analytics](./GAME_ANALYTICS.md)
**Nuevas libs** (`chess-com-provider`, `lichess-provider`, `game-reporter`) y **APIs externas**. Alto valor pero mayor superficie y dependencia de terceros; es bastante independiente, así que puede solaparse en paralelo con las anteriores si hay capacidad.

### 8 · [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md)
**PvP asíncrono** con matchmaking, economía de poderes y estado compartido → **requiere backend**. Complejidad alta; conviene atacarlo cuando la base de usuarios (que #1 y #5 ayudan a crecer) lo justifique.

### 9 · [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md)
**GPS + AR + permisos de cámara/ubicación.** El más caro en hardware/plataforma y el más de nicho. Último, como apuesta diferenciadora una vez consolidado el núcleo.

---

## Bloques compartidos (construir una vez, reutilizar)

Conviene tratarlos como piezas transversales, no re-implementarlas por feature:

- **Util de parseo PGN** (`chess.js`) → lo estrena #2 y lo reutilizan #3 y #4. Extraer a [`libs/common-utils`](../../libs/common-utils).
- **Set de puzzles congelado y persistido por id** → patrón común de #3 y #4 (y posible fuente de sets en #4). Evita el _strip_ actual de `puzzles` al guardar planes.
- **Motor de reproducción de jugadas** (tablero + secuencia de FEN/SAN + controles) → de #2, reutilizable donde se "reproduzca" una línea.
- **Board de puzzles** [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) → ya existe; lo consumen #3, #4, #5, #6, #9.
- **AnalyticsService** [(catálogo)](../implementado/OBSERVABILITY_TRACKING.md) → todas instrumentan sobre la base ya implementada.

---

## Leyenda

- **Valor**: impacto esperado en retención/engagement/diferenciación.
- **Esfuerzo**: tamaño relativo de implementación (incl. infra y plataforma).
- El orden es una **recomendación**, no un contrato: #7 (Game Analytics) es lo bastante independiente como para paralelizarse; #1 y #5 pueden adelantarse si la prioridad es crecimiento antes que las herramientas de estudio (#2–#4).

---

## Ya implementado

- [Observabilidad — Tracking](../implementado/OBSERVABILITY_TRACKING.md) · [Referencia](../implementado/OBSERVABILITY_REFERENCIA.md) — Firebase Analytics + Crashlytics y el `AnalyticsService` que reutilizan todas las features.
