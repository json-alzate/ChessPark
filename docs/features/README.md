# Índice de Features — ChessColate

Este documento es el **índice de todas las features propuestas** (carpeta [`docs/features/`](.)) y su **orden de implementación recomendado**. Las features ya implementadas viven en [`docs/implementado/`](../implementado/).

El orden busca cuatro cosas, en este equilibrio: **(1)** despachar primero lo de **esfuerzo bajo y valor inmediato**, **(2)** construir los _bloques compartidos_ que abaratan las siguientes, **(3)** priorizar features de **alto valor / esfuerzo contenido** (retención, hábito) y **(4)** dejar para el final lo que depende de **backend, hardware o infra pesada** (PvP, GPS/AR, APIs externas).

---

## Orden recomendado

Las filas están ordenadas por **prioridad de trabajo** (primero lo ya hecho, luego lo
siguiente a atacar), pero el **ID es fijo**: se asigna una vez y no cambia nunca, aunque
la feature se implemente o cambie de posición. Por eso los IDs se leen salteados.

| Estado | ID | Feature | Valor | Esfuerzo | Depende de |
|:------:|----|---------|-------|----------|------------|
| ✅ | F01 | [Observabilidad — Tracking](../implementado/OBSERVABILITY_TRACKING.md) | Alto (base) | Medio | — |
| ✅ | F02 | [Recordatorios de Entrenamiento](../implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md) | Alto (retención) | Medio | — |
| ✅ | F03 | [Racha de Puzzles](../implementado/RACHA_STREAK_FLOW.md) | Alto (retención) | Medio | `board-puzzle` |
| ✅ | F04 | [Gestión de Descargas de Puzzles](../implementado/GESTION_DESCARGAS_PUZZLES_FLOW.md) | Medio (confianza/espacio) | Bajo-Medio | Caché de `puzzles-provider` (ya existe) |
| ✅ | F05 | [Calificar la App (In-App Review)](../implementado/CALIFICAR_APP_FLOW.md) | Alto (negocio) | Bajo | `@capacitor-community/in-app-review` |
| ✅ | F06 | [Reproductor / TV de Partidas](../implementado/REPRODUCTOR_PARTIDAS_FLOW.md) | Alto | Medio-Alto | — (estrenó el lector de PGN y el catálogo de partidas) |
| ⬜ | F07 | [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md) | Alto | Medio | F06 (lector de PGN, ya hecho) |
| ⬜ | F08 | [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md) | Alto | Medio | F07 (set congelado) |
| ⬜ | F09 | [Analizador de Partidas (capas de dibujo)](./ANALIZADOR_PARTIDAS.md) | Alto (estudio) | Alto | F06 (lector de PGN + reproducción, ya hechos) |
| ⬜ | F10 | [Puzzle Feed](./PUZZLE_FEED.md) | Alto (engagement) | Medio-Alto | — |
| ⬜ | F11 | [Chess Runner](./CHESS_RUNNER.md) | Medio | Medio | — |
| ⬜ | F12 | [Game Analytics](./GAME_ANALYTICS.md) | Alto | Alto | APIs externas (chess.com/lichess) |
| ⬜ | F13 | [Sparring Personalizado (IA con tu estilo)](./SPARRING_PERSONALIZADO.md) | Alto | Alto (Nivel 1) / Muy Alto (Nivel 2) | F12 (ingesta de partidas) + `stockfish-wasm` |
| ⬜ | F14 | [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md) | Alto | Muy Alto | Backend + matchmaking |
| ⬜ | F15 | [Puzzle Racer (Multijugador)](./PUZZLE_RACER.md) | Alto (competitivo/viral) | Alto | RTDB + matchmaking (sin backend propio) |
| ⬜ | F16 | [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md) | Medio (nicho) | Muy Alto | GPS + AR + permisos |

> ✅ = ya implementado (detalle en [Ya implementado](#ya-implementado)) · ⬜ = pendiente.
> **Regla del ID:** una feature nueva toma el siguiente número libre (F17, F18, …) y se
> queda con él para siempre. Un ID no se reutiliza aunque la feature se descarte.

---

## Por qué este orden

### F07 · [Rutina con BD de Puzzles Personalizada (PGN)](./RUTINA_PGN_PERSONALIZADA.md)
**Reutiliza el lector de PGN que ya dejó F06** y estrena el patrón de **"set de puzzles congelado y persistido"** (en vez de re-pedirlo al catálogo). Alto valor para entrenadores y estudio dirigido.

### F08 · [Método del Pájaro Carpintero](./METODO_PAJARO_CARPINTERO.md)
**Reutiliza el "set congelado" de F07** y le añade **vueltas + timing decreciente + comparación entre pasadas**. Al llegar después de F07, gran parte de la persistencia y del juego por set ya está resuelta.

### F09 · [Analizador de Partidas (capas de dibujo)](./ANALIZADOR_PARTIDAS.md)
**La versión activa de F06 (ya implementado)**: donde el reproductor deja mirar la partida, el analizador deja intervenirla — ramificar en variantes, comentar posiciones y dibujar encima del tablero (varias "láminas" por posición, alternables). Comparte con F06 el lector de PGN y la navegación, que ya están hechos; va tras el bloque de estudio (F07–F08) porque es **claramente el más caro de los cuatro**: árbol de variantes, persistencia propia y motor de dibujo sobre `canvas`.

### F10 · [Puzzle Feed](./PUZZLE_FEED.md)
**Motor de engagement** estilo TikTok/Reels sobre puzzles. Reutiliza [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) y el catálogo; el algoritmo de recomendación puede empezar **local** (ELO + temas + historial) sin backend. Alto potencial de uso, independiente de F06–F09.

### F11 · [Chess Runner](./CHESS_RUNNER.md)
**Capa de gamificación** (mini-juego previo al puzzle). Autocontenido, sin dependencias de datos externas; encaja cuando ya hay volumen de puzzles jugándose. Esfuerzo medio (animación/gameplay).

### F12 · [Game Analytics](./GAME_ANALYTICS.md)
**Nuevas libs** (`chess-com-provider`, `lichess-provider`, `game-reporter`) y **APIs externas**. Alto valor pero mayor superficie y dependencia de terceros; es bastante independiente, así que puede solaparse en paralelo con las anteriores si hay capacidad.

### F13 · [Sparring Personalizado (IA con tu estilo)](./SPARRING_PERSONALIZADO.md)
**Consume directamente la ingesta de F12**: los providers de chess.com/lichess, el caché de partidas y el modelo `ChessGame`. A partir de ahí construye un **perfil de estilo** y un rival jugable que aproxima tu fuerza y tus manías. El **Nivel 1** (perfil estadístico + Stockfish sesgado con [`stockfish-wasm`](../../libs/stockfish-wasm/src/lib/)) es **on-device, sin backend** — de ahí que llegue justo tras F12. El **Nivel 2** (clon neuronal tipo Maia fine-tuneado) es I+D con GPU/backend y **no bloquea** el lanzamiento.

### F14 · [Cuadros de Conquista](./CUADROS_DE_CONQUISTA.md)
**PvP asíncrono** con matchmaking, economía de poderes y estado compartido → **requiere backend**. Complejidad alta; conviene atacarlo cuando la base de usuarios (que la Racha y F10 ayudan a crecer) lo justifique.

### F15 · [Puzzle Racer (Multijugador)](./PUZZLE_RACER.md)
**PvP en tiempo real** estilo [Puzzle Racer de Lichess](https://lichess.org/racer): varios jugadores compiten sobre la **misma secuencia de puzzles** contra el reloj. A diferencia de F14, está diseñado para correr **sin backend propio**: Firebase solo transporta enteros diminutos por un canal efímero de **Realtime Database** y el contenido de los puzzles sale del CDN + caché que ya existe — el objetivo explícito es que **casi no consuma recursos de Firebase** (~10 000 carreras por dólar de ancho de banda). Estrena el bloque compartido de **RTDB + matchmaking client-side** que F14 puede reutilizar. Alto valor competitivo/viral; llega en el clúster PvP porque el matchmaking y la sincronización son la parte más delicada.

### F16 · [Puzzle Geo Hunt](./PUZZLE_GEO_HUNT.md)
**GPS + AR + permisos de cámara/ubicación.** El más caro en hardware/plataforma y el más de nicho. Último, como apuesta diferenciadora una vez consolidado el núcleo.

---

## Bloques compartidos (construir una vez, reutilizar)

Conviene tratarlos como piezas transversales, no re-implementarlas por feature:

- **Lector de PGN** (`chess.js`) → **ya existe**: lo estrenó F06 en [`libs/games-provider`](../../libs/games-provider/src/lib/pgn.ts), con lectura en dos pasos (cabeceras primero, posiciones al abrir una partida). Lo reutilizan F07, F08 y F09.
- **Set de puzzles congelado y persistido por id** → patrón común de F07 y F08 (y posible fuente de sets en F08). Evita el _strip_ actual de `puzzles` al guardar planes.
- **Motor de reproducción de jugadas** (tablero + secuencia de posiciones + controles) → **ya existe**: [`board-game-player`](../../libs/board/src/lib/board-game-player/board-game-player.component.ts), tablero de solo mirar con su propio reloj. F09 lo extiende con el árbol de variantes.
- **Board de puzzles** [`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts) → ya existe; lo consumen la Racha, F07, F08, F10, F11, F15 y F16.
- **Catálogo descargable con índice remoto** (un archivo por jugador, índice en el CDN, caché propia en IndexedDB) → **ya existe**: lo estrenó F06 en [`libs/games-provider`](../../libs/games-provider/). A diferencia del de puzzles, su índice se descarga, así que publicar contenido nuevo no exige sacar versión.
- **Metadata del caché de puzzles** (tema + rango de ELO + tamaño por archivo descargado) → **ya existe**: la estrenó la [Gestión de Descargas](../implementado/GESTION_DESCARGAS_PUZZLES_FLOW.md) y deja medible cuánto espacio ocupa la app.
- **RTDB + matchmaking client-side** (canal efímero de tiempo real, transacciones de lobby, `onDisconnect`) → lo estrena F15 y lo puede reutilizar F14 (Cuadros de Conquista) para su capa PvP. RTDB no está cableada hoy (solo Firestore).
- **AnalyticsService** [(catálogo)](../implementado/OBSERVABILITY_TRACKING.md) → todas instrumentan sobre la base ya implementada.

---

## Leyenda

- **Estado**: ✅ implementado · ⬜ pendiente.
- **ID**: identificador **fijo y permanente** de la feature (`F01`, `F02`, …). No indica prioridad ni cambia al implementarla: sirve para referirse a la feature en commits, ramas y conversaciones sin ambigüedad. La prioridad la marca **el orden de las filas** de la tabla, que sí se reordena.
- **Valor**: impacto esperado en retención/engagement/diferenciación (o en negocio).
- **Esfuerzo**: tamaño relativo de implementación (incl. infra y plataforma).
- El orden es una **recomendación**, no un contrato: F12 (Game Analytics) es lo bastante independiente como para paralelizarse; F10 (Puzzle Feed) puede adelantarse si la prioridad es crecimiento antes que las herramientas de estudio (F06–F09).

---

## Ya implementado

- [Observabilidad — Tracking](../implementado/OBSERVABILITY_TRACKING.md) · [Referencia](../implementado/OBSERVABILITY_REFERENCIA.md) — Firebase Analytics + Crashlytics y el `AnalyticsService` que reutilizan todas las features.
- [Recordatorios de Entrenamiento](../implementado/RECORDATORIOS_ENTRENAMIENTO_FLOW.md) — recordatorio automático que aprende tu hora habitual, más alarmas manuales por día. Idea original en [`NOTIFICACIONES_ENTRENAMIENTO.md`](./NOTIFICACIONES_ENTRENAMIENTO.md).
- [Racha de Puzzles](../implementado/RACHA_STREAK_FLOW.md) — modo de muerte súbita con dificultad creciente y récord personal. Idea original en [`RACHA_STREAK.md`](./RACHA_STREAK.md).
- [Pool de Puzzles del Entrenamiento Continuo](../implementado/INFINITY_PUZZLE_POOL_FLOW.md) — 50 puzzles pre-cargados en IndexedDB que comparten la tarjeta del home y la sesión de entrenamiento continuo, para no repetir peticiones al CDN.
- [Gestión de Descargas de Puzzles](../implementado/GESTION_DESCARGAS_PUZZLES_FLOW.md) — pantalla de Almacenamiento que lista los archivos descargados por tema y rango de ELO, con su tamaño, y permite borrarlos. Idea original en [`GESTION_DESCARGAS_PUZZLES.md`](./GESTION_DESCARGAS_PUZZLES.md).
- [Calificar la App (In-App Review)](../implementado/CALIFICAR_APP_FLOW.md) — invitación silenciosa a calificar en la Play Store, solo tras una rutina que salió bien y como mucho cada 90 días, más un acceso manual en Ajustes. Idea original en [`CALIFICAR_APP.md`](./CALIFICAR_APP.md).
- [Reproductor / TV de Partidas](../implementado/REPRODUCTOR_PARTIDAS_FLOW.md) — catálogo de campeones del mundo descargable desde el CDN, reproducción jugada a jugada con velocidad configurable y modo TV que encadena la colección. Idea original en [`REPRODUCTOR_PARTIDAS.md`](./REPRODUCTOR_PARTIDAS.md).
