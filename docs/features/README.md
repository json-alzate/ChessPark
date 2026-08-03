# Índice de Features — ChessColate

Este documento es el **índice de todas las features propuestas** (carpeta [`docs/features/`](.)) y su **orden de implementación recomendado**. Las features ya implementadas viven en [`docs/implementado/`](../implementado/).

El orden busca cuatro cosas, en este equilibrio: **(1)** despachar primero lo de **esfuerzo bajo y valor inmediato**, **(2)** construir los _bloques compartidos_ que abaratan las siguientes, **(3)** priorizar features de **alto valor / esfuerzo contenido** (retención, hábito) y **(4)** dejar para el final lo que depende de **backend, hardware o infra pesada** (PvP, GPS/AR, APIs externas).

---

## Orden recomendado

| Estado | # | Feature | Valor | Esfuerzo | Depende de |
|:------:|---|---------|-------|----------|------------|
| ✅ | — | [Observabilidad — Tracking](../implementado/OBSERVABILITY_TRACKING.md) | Alto (base) | Medio | — |
| ✅ | — | [Recordatorios de Entrenamiento](../implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md) | Alto (retención) | Medio | — |
| ✅ | — | [Racha de Puzzles](../implementado/RACHA_STREAK_FLOW.md) | Alto (retención) | Medio | `board-puzzle` |
| ✅ | — | [Gestión de Descargas de Puzzles](../implementado/GESTION_DESCARGAS_PUZZLES_FLOW.md) | Medio (confianza/espacio) | Bajo-Medio | Caché de `puzzles-provider` (ya existe) |
| ✅ | — | [Calificar la App (In-App Review)](../implementado/CALIFICAR_APP_FLOW.md) | Alto (negocio) | Bajo | `@capacitor-community/in-app-review` |
| ⬜ | 1 | [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md) | Medio | Medio | — (crea el util de PGN compartido) |
| ⬜ | 2 | [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md) | Alto | Medio | #1 (parseo PGN) |
| ⬜ | 3 | [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md) | Alto | Medio | #2 (set congelado) |
| ⬜ | 4 | [Analizador de Partidas (capas de dibujo)](./ANALIZADOR_PARTIDAS.md) | Alto (estudio) | Alto | #1 (parseo PGN + navegación) |
| ⬜ | 5 | [Puzzle Feed](./PUZZLE_FEED.md) | Alto (engagement) | Medio-Alto | — |
| ⬜ | 6 | [Chess Runner](./CHESS_RUNNER.md) | Medio | Medio | — |
| ⬜ | 7 | [Game Analytics](./GAME_ANALYTICS.md) | Alto | Alto | APIs externas (chess.com/lichess) |
| ⬜ | 8 | [Sparring Personalizado (IA con tu estilo)](./SPARRING_PERSONALIZADO.md) | Alto | Alto (Nivel 1) / Muy Alto (Nivel 2) | #7 (ingesta de partidas) + `stockfish-wasm` |
| ⬜ | 9 | [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md) | Alto | Muy Alto | Backend + matchmaking |
| ⬜ | 10 | [Puzzle Racer (Multijugador)](./PUZZLE_RACER.md) | Alto (competitivo/viral) | Alto | RTDB + matchmaking (sin backend propio) |
| ⬜ | 11 | [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md) | Medio (nicho) | Muy Alto | GPS + AR + permisos |

> ✅ = ya implementado (detalle en [Ya implementado](#ya-implementado)) · ⬜ = pendiente.
> Las filas con ✅ no llevan número porque ya salieron del orden de trabajo: eran las
> dos primeras del plan original (**Notificaciones de Entrenamiento** y **Racha de
> Puzzles**), la base de observabilidad, la **Gestión de Descargas de Puzzles** y
> **Calificar la App**.
> Los pendientes se renumeran cuando una feature sale de la lista.

---

## Por qué este orden

### 1 · [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md)
**Cimiento técnico de las tres siguientes.** Introduce el **util de parseo de PGN con `chess.js`** y **generaliza el motor de reproducción** de jugadas (a partir de [`board-puzzle-solution`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts)). Es relativamente autocontenido (no toca ELO ni scoring) y deja listo un componente reutilizable.

### 2 · [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md)
**Reutiliza el parseo PGN de #1** y estrena el patrón de **"set de puzzles congelado y persistido"** (en vez de re-pedirlo al catálogo). Alto valor para entrenadores y estudio dirigido.

### 3 · [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md)
**Reutiliza el "set congelado" de #2** y le añade **vueltas + timing decreciente + comparación entre pasadas**. Al llegar después de #2, gran parte de la persistencia y del juego por set ya está resuelta.

### 4 · [Analizador de Partidas (capas de dibujo)](./ANALIZADOR_PARTIDAS.md)
**La versión activa de #1**: donde el reproductor deja mirar la partida, el analizador deja intervenirla — ramificar en variantes, comentar posiciones y dibujar encima del tablero (varias "láminas" por posición, alternables). Comparte con #1 el parseo PGN y la navegación, así que llega después; va tras el bloque de estudio (#2–#3) porque es **claramente el más caro de los cuatro**: árbol de variantes, persistencia propia y motor de dibujo sobre `canvas`.

### 5 · [Puzzle Feed](./PUZZLE_FEED.md)
**Motor de engagement** estilo TikTok/Reels sobre puzzles. Reutiliza [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) y el catálogo; el algoritmo de recomendación puede empezar **local** (ELO + temas + historial) sin backend. Alto potencial de uso, independiente de #1–#4.

### 6 · [Chess Runner](./CHESS_RUNNER.md)
**Capa de gamificación** (mini-juego previo al puzzle). Autocontenido, sin dependencias de datos externas; encaja cuando ya hay volumen de puzzles jugándose. Esfuerzo medio (animación/gameplay).

### 7 · [Game Analytics](./GAME_ANALYTICS.md)
**Nuevas libs** (`chess-com-provider`, `lichess-provider`, `game-reporter`) y **APIs externas**. Alto valor pero mayor superficie y dependencia de terceros; es bastante independiente, así que puede solaparse en paralelo con las anteriores si hay capacidad.

### 8 · [Sparring Personalizado (IA con tu estilo)](./SPARRING_PERSONALIZADO.md)
**Consume directamente la ingesta de #7**: los providers de chess.com/lichess, el caché de partidas y el modelo `ChessGame`. A partir de ahí construye un **perfil de estilo** y un rival jugable que aproxima tu fuerza y tus manías. El **Nivel 1** (perfil estadístico + Stockfish sesgado con [`stockfish-wasm`](../../libs/stockfish-wasm/src/lib/)) es **on-device, sin backend** — de ahí que llegue justo tras #7. El **Nivel 2** (clon neuronal tipo Maia fine-tuneado) es I+D con GPU/backend y **no bloquea** el lanzamiento.

### 9 · [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md)
**PvP asíncrono** con matchmaking, economía de poderes y estado compartido → **requiere backend**. Complejidad alta; conviene atacarlo cuando la base de usuarios (que la Racha y #5 ayudan a crecer) lo justifique.

### 10 · [Puzzle Racer (Multijugador)](./PUZZLE_RACER.md)
**PvP en tiempo real** estilo [Puzzle Racer de Lichess](https://lichess.org/racer): varios jugadores compiten sobre la **misma secuencia de puzzles** contra el reloj. A diferencia de #9, está diseñado para correr **sin backend propio**: Firebase solo transporta enteros diminutos por un canal efímero de **Realtime Database** y el contenido de los puzzles sale del CDN + caché que ya existe — el objetivo explícito es que **casi no consuma recursos de Firebase** (~10 000 carreras por dólar de ancho de banda). Estrena el bloque compartido de **RTDB + matchmaking client-side** que #9 puede reutilizar. Alto valor competitivo/viral; llega en el clúster PvP porque el matchmaking y la sincronización son la parte más delicada.

### 11 · [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md)
**GPS + AR + permisos de cámara/ubicación.** El más caro en hardware/plataforma y el más de nicho. Último, como apuesta diferenciadora una vez consolidado el núcleo.

---

## Bloques compartidos (construir una vez, reutilizar)

Conviene tratarlos como piezas transversales, no re-implementarlas por feature:

- **Util de parseo PGN** (`chess.js`) → lo estrena #1 y lo reutilizan #2, #3 y #4. Extraer a [`libs/common-utils`](../../libs/common-utils).
- **Set de puzzles congelado y persistido por id** → patrón común de #2 y #3 (y posible fuente de sets en #3). Evita el _strip_ actual de `puzzles` al guardar planes.
- **Motor de reproducción de jugadas** (tablero + secuencia de FEN/SAN + controles) → de #1, reutilizable donde se "reproduzca" una línea; #4 lo extiende con el árbol de variantes.
- **Board de puzzles** [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) → ya existe; lo consumen la Racha, #2, #3, #5, #6, #10 y #11.
- **Metadata del caché de puzzles** (tema + rango de ELO + tamaño por archivo descargado) → **ya existe**: la estrenó la [Gestión de Descargas](../implementado/GESTION_DESCARGAS_PUZZLES_FLOW.md) y deja medible cuánto espacio ocupa la app.
- **RTDB + matchmaking client-side** (canal efímero de tiempo real, transacciones de lobby, `onDisconnect`) → lo estrena #10 y lo puede reutilizar #9 (Cuadros de Conquista) para su capa PvP. RTDB no está cableada hoy (solo Firestore).
- **AnalyticsService** [(catálogo)](../implementado/OBSERVABILITY_TRACKING.md) → todas instrumentan sobre la base ya implementada.

---

## Leyenda

- **Estado**: ✅ implementado · ⬜ pendiente.
- **Valor**: impacto esperado en retención/engagement/diferenciación (o en negocio).
- **Esfuerzo**: tamaño relativo de implementación (incl. infra y plataforma).
- El orden es una **recomendación**, no un contrato: #7 (Game Analytics) es lo bastante independiente como para paralelizarse; #5 (Puzzle Feed) puede adelantarse si la prioridad es crecimiento antes que las herramientas de estudio (#1–#4).

---

## Ya implementado

- [Observabilidad — Tracking](../implementado/OBSERVABILITY_TRACKING.md) · [Referencia](../implementado/OBSERVABILITY_REFERENCIA.md) — Firebase Analytics + Crashlytics y el `AnalyticsService` que reutilizan todas las features.
- [Recordatorios de Entrenamiento](../implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md) — recordatorio automático que aprende tu hora habitual, más alarmas manuales por día. Idea original en [`NOTIFICACIONES_ENTRENAMIENTO.md`](./NOTIFICACIONES_ENTRENAMIENTO.md).
- [Racha de Puzzles](../implementado/RACHA_STREAK_FLOW.md) — modo de muerte súbita con dificultad creciente y récord personal. Idea original en [`RACHA_STREAK.md`](./RACHA_STREAK.md).
- [Pool de Puzzles del Entrenamiento Continuo](../implementado/INFINITY_PUZZLE_POOL_FLOW.md) — 50 puzzles pre-cargados en IndexedDB que comparten la tarjeta del home y la sesión de entrenamiento continuo, para no repetir peticiones al CDN.
- [Gestión de Descargas de Puzzles](../implementado/GESTION_DESCARGAS_PUZZLES_FLOW.md) — pantalla de Almacenamiento que lista los archivos descargados por tema y rango de ELO, con su tamaño, y permite borrarlos. Idea original en [`GESTION_DESCARGAS_PUZZLES.md`](./GESTION_DESCARGAS_PUZZLES.md).
- [Calificar la App (In-App Review)](../implementado/CALIFICAR_APP_FLOW.md) — invitación silenciosa a calificar en la Play Store, solo tras una rutina que salió bien y como mucho cada 90 días, más un acceso manual en Ajustes. Idea original en [`CALIFICAR_APP.md`](./CALIFICAR_APP.md).
