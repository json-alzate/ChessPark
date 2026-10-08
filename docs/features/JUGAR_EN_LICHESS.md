# Jugar en Lichess desde ChessColate — Feature Document

## Concepto

Conectar la cuenta de **lichess** del usuario (OAuth) para que pueda **jugar partidas reales, en tiempo real, contra jugadores reales de lichess** sin salir de ChessColate — con el tablero y la UI propios de la app. La idea es apoyarnos en la **audiencia ya existente** de lichess en vez de montar nuestro propio matchmaking de cero: lichess pone los rivales (y su propio sistema de rating/emparejamiento), ChessColate pone la experiencia de juego.

> **Por qué solo lichess y no chess.com**: se evaluó primero (ver conversación que originó este doc) si esto era posible contra el público de **ambas** plataformas. La API pública de **chess.com es de solo lectura**, sin OAuth ni forma de jugar/retar — no expone ningún mecanismo oficial para esto. **lichess**, al ser open source, sí publica una **Board API** pensada explícitamente para que apps y hardware de terceros jueguen partidas reales con una cuenta de lichess. Este documento cubre solo lichess; chess.com queda descartado para esta feature mientras no cambien su API.

> **No es Puzzle Racer**: tampoco existe una API de "Puzzle Racer" ni "Puzzle Storm" para terceros en ninguna de las dos plataformas — esas son features propietarias de su UI, sin endpoint público. El modo carrera de puzzles de ChessColate sigue siendo [Puzzle Racer (F15)](./PUZZLE_RACER.md), jugador-de-ChessColate contra jugador-de-ChessColate vía Firebase RTDB. Esta feature es otra cosa: **partidas normales de ajedrez**, uno contra uno, contra cualquier persona que esté jugando en lichess en ese momento.

> **Relación con [Game Analytics](./GAME_ANALYTICS.md)**: esa feature ya trae el conector de lectura `@chesspark/lichess-provider` (histórico de partidas, sin auth). Esta feature es **complementaria y separada**: necesita OAuth (escritura/jugar), no reemplaza ni modifica el provider de solo-lectura existente.

---

## Qué permite la Board API de lichess

Documentada en [lichess.org/api](https://lichess.org/api) (tag **Board**), pensada para "jugar con un tablero físico o una app de terceros, sin asistencia de motor". Funciona con **cuentas normales** de lichess (no requiere convertir la cuenta en bot).

| Endpoint | Para qué |
|---|---|
| `POST /api/board/seek` | **La pieza clave**: crea una búsqueda pública y empareja al usuario con **un rival al azar** de lichess (como el botón "Partida rápida" de lichess.org), filtrando por cadencia, rango de rating y si es rated o no. La conexión queda abierta (streaming) hasta que alguien acepta; en ese momento se cierra y la partida ya existe. |
| `POST /api/challenge/{username}` | Reto directo a **un usuario concreto** por su nombre (p. ej. un amigo que juega en lichess). |
| `GET /api/stream/event` | Stream (NDJSON) de eventos entrantes: retos recibidos, partidas que arrancan. |
| `GET /api/board/game/stream/{gameId}` | Stream (NDJSON) del estado de una partida: jugadas, relojes (`wtime`/`btime`), estado (`status`), oferta de tablas del rival, chat. Es la fuente de verdad mientras se juega. |
| `POST /api/board/game/{gameId}/move/{move}` | Enviar una jugada propia (notación UCI, p. ej. `e2e4`). |
| `POST /api/board/game/{gameId}/resign` | Rendirse. |
| `POST /api/board/game/{gameId}/abort` | Abortar (solo válido en las primeras jugadas, antes de que cuente como partida). |
| `POST /api/board/game/{gameId}/draw/{accept}` | Ofrecer o responder una oferta de tablas. |

**Restricción dura de lichess**: la Board API es explícitamente **sin asistencia de motor**. Usarla para enviar jugadas sugeridas por Stockfish es trampa y arriesga el baneo de la cuenta de lichess del usuario. Esto importa particularmente aquí porque ChessColate **ya trae Stockfish embebido** (`@chesspark/stockfish-wasm`) para puzzles/análisis — la pantalla de "jugar en lichess" debe estar **completamente aislada** de cualquier acceso al motor, sin excepciones ni modo "ayuda".

---

## Autenticación — OAuth 2.0 (Authorization Code + PKCE)

lichess soporta **clientes públicos sin secreto** (apps móviles/SPA), que es justo nuestro caso (sin backend propio):

- **Authorize URL**: `https://lichess.org/oauth`
- **Token URL**: `https://lichess.org/api/token`
- **PKCE obligatorio** (`code_challenge_method=S256`) — no hace falta `client_secret`, cualquier `client_id` único sirve.
- **Scopes necesarios**: `board:play` (jugar), `challenge:read` + `challenge:write` (crear/aceptar retos y recibir el stream de eventos).
- **Tokens de larga duración** (del orden de un año) y **sin refresh token** — cuando expira, se repite el flujo de login. Mucho más simple que manejar refresh tokens, pero hay que detectar el 401 y relanzar el login.
- **Guardado del token**: en el dispositivo (p. ej. `@capacitor/preferences`), igual de local que el resto de la app. Hay que ser explícitos con el usuario de que ese token da acceso a jugar/retar en **su cuenta real de lichess** — si se filtra, alguien podría jugar partidas a su nombre.

### Redirect URI por plataforma

- **Web**: una ruta normal de la app (`https://chesscolate.com/auth/lichess/callback` o similar) registrada como redirect URI del cliente OAuth.
- **iOS/Android (Capacitor)**: un **custom URL scheme** o **deep link**, capturado con `@capacitor/app` (`App.addListener('appUrlOpen', ...)`, ya está en el proyecto) para recibir el `code` de vuelta y continuar el intercambio PKCE.

---

## Modos de juego ofrecidos

| Modo | Cómo | Cuándo tiene sentido |
|---|---|---|
| **Partida rápida contra el público de lichess** *(principal)* | `POST /api/board/seek` con cadencia + rango de rating elegidos en la UI | Es la propuesta de valor central: jugar contra un desconocido real sin salir de la app |
| **Retar a un amigo por username** | `POST /api/challenge/{username}` | Complementario, bajo esfuerzo adicional una vez existe el resto |
| Rated vs. casual | Flag `rated` en ambos endpoints | Rated afecta el rating real de lichess del usuario — dejarlo claro en la UI |

---

## Flujo de usuario

```
[ChessColate → "Jugar en lichess"]
         ↓
[¿Cuenta de lichess conectada?] ── no ──► [OAuth: navegador/WebView a lichess.org/oauth]
         │                                    ↓ (PKCE code → token, scopes board:play + challenge:*)
         │ sí                                 ↓
         ◄────────────────────────────────────┘
         ↓
[Elige cadencia + rango de rating + rated/casual]
         ↓
[POST /api/board/seek]  → pantalla "Buscando rival…" (stream abierto)
         ↓ (alguien acepta)
[Partida creada] → abrir GET /api/board/game/stream/{gameId}
         ↓
[Tablero de @chesspark/board, reloj con wtime/btime del stream]
  → jugador mueve  → POST /api/board/game/{id}/move/{uci}
  → el rival mueve → llega por el stream, se refleja en el tablero
  → ofrecer/aceptar tablas, rendirse, abortar
         ↓
[Fin de partida] (jaque mate / tiempo / resign / tablas)
         ↓
[Resumen] → opcional: guardar PGN y enviar al Analizador de Partidas (F09)
```

---

## Diseño técnico

### Ubicación en el proyecto

- **Nueva lib**: `libs/lichess-board-provider` (`@chesspark/lichess-board-provider`) — cliente de la Board API (seek, challenge, streams NDJSON, move/resign/abort/draw). Se mantiene **separada** de `libs/lichess-provider` (solo lectura, sin auth) porque el modelo de permisos y el ciclo de vida (token OAuth vs. nada) son distintos; nada impide que ambas compartan tipos de `libs/models` donde aplique.
- **Nuevo servicio de la app**: `LichessAuthService` (`apps/chessColate/src/app/services/`) — flujo PKCE, guardado/lectura del token, detección de expiración. Independiente del `AuthService` de Firebase existente: son dos identidades distintas (cuenta ChessColate vs. cuenta lichess).
- **Nueva página**: `apps/chessColate/src/app/pages/play-lichess/` (nombre a alinear), registrada en [`app.routes.ts`](../../apps/chessColate/src/app/app.routes.ts).
- **Se reutiliza**: [`@chesspark/board`](../../libs/board/src/lib/board/board.component.ts) para el tablero jugable (movimiento libre + legalidad vía `chess.js`, igual que en [Sparring Personalizado](./SPARRING_PERSONALIZADO.md)); `@capacitor/app` para el deep link de vuelta del OAuth; `AnalyticsService` para instrumentación.
- **Explícitamente aislado de**: `@chesspark/stockfish-wasm`. La pantalla de juego contra lichess no debe importar ni tener ruta de acceso al motor — ni siquiera "ver evaluación" post-jugada mientras la partida está en curso, por la regla de fair play.

### Manejo de reconexión

lichess no sabe ni le importa si el usuario cerró la app: la partida sigue corriendo en su servidor con su propio reloj. Si el usuario vuelve a abrir ChessColate a mitad de partida hay que:
1. Al iniciar, comprobar `GET /api/stream/event` o el estado de partidas en curso.
2. Si hay una partida activa, reabrir `GET /api/board/game/stream/{gameId}` para ponerse al día (el stream manda el estado completo al conectar, no solo deltas desde cero).
3. Si el reloj del rival sigue corriendo y el usuario no vuelve, perderá por tiempo igual que en lichess.org — comportamiento esperado, no es un bug a resolver.

---

## Consideraciones

- **Fair play / riesgo de baneo**: ya cubierto arriba — cero acceso al motor desde esta pantalla. Vale la pena dejarlo explícito también en la UI ("esta partida cuenta para tu cuenta real de lichess").
- **Rate limiting**: lichess pide **no lanzar peticiones en paralelo** contra el mismo recurso; un `429` indica esperar antes de reintentar (sin un límite numérico publicado, a diferencia de chess.com). El stream de la partida en curso es la única conexión persistente a mantener; el resto son llamadas puntuales (move, resign, etc.).
- **Dependencia de terceros**: si lichess cambia o retira la Board API, la feature se cae. Es un riesgo aceptado explícitamente (igual que ya se acepta con los providers de lectura de [Game Analytics](./GAME_ANALYTICS.md)).
- **Variantes**: igual que el resto de la app, alcance inicial solo **ajedrez estándar** (`variant: standard`).
- **Privacidad**: el token OAuth vive solo en el dispositivo; nada se manda a un backend propio porque no existe uno. Explicar al usuario qué permisos está concediendo (jugar/retar en su nombre) antes de iniciar el login.
- **Identidad del usuario en ChessColate**: igual que en [Puzzle Racer](./PUZZLE_RACER.md), hoy hay invitados sin `uid` estable; conectar lichess no depende de tener cuenta ChessColate, pero conviene decidir si se exige login propio antes de ofrecer "jugar en lichess" (para poder guardar el PGN/historial contra un usuario conocido).

---

## Instrumentación (analytics)

Reusa el `AnalyticsService` existente ([catálogo](../implementado/OBSERVABILITY_TRACKING.md)):

| Evento | Cuándo | Params |
|---|---|---|
| `lichess_account_connected` | se completa el OAuth | — |
| `lichess_account_disconnected` | el usuario revoca/desconecta | — |
| `lichess_seek_started` | se lanza `board/seek` | `time_control`, `rated` |
| `lichess_game_started` | un rival acepta el seek o el reto | `vs` (`seek`/`challenge`), `rated` |
| `lichess_game_finished` | termina la partida | `result`, `reason` (`mate`/`time`/`resign`/`draw`/`abort`) |
| `lichess_game_sent_to_analyzer` | se manda el PGN al Analizador | — |

---

## Alcance inicial (MVP)

1. `LichessAuthService`: flujo OAuth PKCE completo (web + Capacitor deep link), guardado de token, logout/revocación.
2. `libs/lichess-board-provider`: `seek()`, `createChallenge(username)`, stream de eventos, stream de partida, `move()`, `resign()`, `abort()`, `offerOrAcceptDraw()`.
3. Página "Jugar en lichess": elegir cadencia + rango de rating + rated/casual → buscar rival → tablero en vivo con reloj → fin de partida.
4. Reconexión a partida en curso al reabrir la app.
5. Guardar el PGN resultante y poder enviarlo al [Analizador de Partidas](./ANALIZADOR_PARTIDAS.md).
6. Eventos de analytics.

## Fuera de alcance inicial

- Retar por username (queda para una segunda iteración; el MVP se centra en `seek` contra el público).
- Chat en vivo con el rival.
- Revancha automática / colas de varias partidas seguidas.
- Variantes no estándar (Chess960, etc.).
- Bot API (jugar como bot automatizado) — es una API distinta, pensada para engines, no para que un humano juegue vía UI.
- Cualquier integración equivalente con chess.com (no es posible con su API actual).

---

## Decisiones a alinear antes de implementar

1. **¿Se exige cuenta de ChessColate antes de ofrecer esto, o se puede jugar como invitado?** Afecta si el historial de partidas de lichess queda ligado a un perfil o es efímero.
2. **Rated por defecto o casual por defecto** — rated es más atractivo (rating real en juego) pero más delicado de explicar/soportar (reclamos, errores de conexión a mitad de partida).
3. **Rango de rating inicial del `seek`**: ¿se deriva del rating de lichess del usuario (si ya conectamos su cuenta en Game Analytics) o lo elige a mano la primera vez?
4. **Nombre y entrada**: ¿"Jugar en lichess", "Partida rápida", algo sin mencionar la marca lichess en el nombre de pantalla? (Hay que revisar si lichess tiene guías de marca para apps de terceros).
5. **Qué pasa con Stockfish**: confirmar que ninguna pantalla accesible durante una partida en curso contra lichess expone el motor, ni siquiera indirectamente (p. ej. un atajo al Analizador que sí lo use).

---

## Dependencias técnicas

- **Lichess Board API** (`https://lichess.org/api`, tag Board) — externa, sin SLA propio.
- **OAuth 2.0 + PKCE** contra `lichess.org/oauth` / `lichess.org/api/token`.
- [`@chesspark/board`](../../libs/board/src/lib/board/board.component.ts) + `chess.js` para el tablero jugable.
- `@capacitor/app` (ya en el proyecto) para capturar el redirect del OAuth en iOS/Android.
- `@capacitor/preferences` (o equivalente ya usado en el proyecto) para guardar el token localmente.
- `libs/models` — tipos nuevos para el estado de partida Board API (distintos del `ChessGame` de solo-lectura de [Game Analytics](./GAME_ANALYTICS.md), aunque convertibles a PGN para reusar el Analizador).
- `AnalyticsService` existente para instrumentación.
