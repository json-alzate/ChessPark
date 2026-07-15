# Puzzle Racer (Multijugador) — Feature Document

## Concepto

Réplica del **Puzzle Racer de Lichess**: varios jugadores compiten **en tiempo real** resolviendo la **misma secuencia de puzzles** lo más rápido posible durante una carrera de tiempo fijo. Gana quien más puntúe antes de que se agote el reloj.

La diferencia de este documento respecto a "hacer un racer" es la **restricción de infraestructura**: no hay backend propio, solo Firebase, y el objetivo explícito es que el modo multijugador **casi no consuma recursos de Firebase**. Todo el diseño gira alrededor de esa restricción.

> **Idea central de optimización:** Firebase no toca el contenido de los puzzles (eso ya se sirve desde el **CDN + caché IndexedDB** que usa [`puzzles-provider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts)). Firebase solo transporta **enteros diminutos** (índice de puzzle, puntaje, combo) por un canal efímero, y solo **persiste** el resultado final. Con eso, el coste por carrera baja de "dólares por cada mil partidas" a "decenas de miles de partidas por dólar".

---

## Modo de juego

| Parámetro | Valor propuesto (ajustable) |
|---|---|
| Jugadores por carrera | 2–8 |
| Duración | 90–120 s de reloj sincronizado |
| Secuencia de puzzles | **Idéntica para todos**, dificultad ascendente (~40 puzzles precargados) |
| Puntuación | +1 por puzzle resuelto (opcional: multiplicador de combo por aciertos seguidos) |
| Movimiento incorrecto | Se salta al siguiente puzzle (cuenta como fallo, rompe el combo). Sin "vidas". |
| Fin | Al agotarse el reloj global. Ganador = mayor puntaje; desempate por tiempo del último acierto |

Flujo de una carrera:

```
[Jugador entra a "Racer"]
        ↓
[Matchmaking] → se une a un lobby abierto o crea uno (transacción RTDB)
        ↓
[Cuenta atrás sincronizada]  ← todos calculan el mismo startAt (reloj de servidor)
        ↓
[Carrera] cada quien resuelve la MISMA lista de puzzles a su ritmo
   → el board local avanza al siguiente puzzle en cada acierto/fallo
   → cada cliente publica su progreso (throttle ~1s): {i, score, combo}
   → ve una barra/ranking en vivo con los enteros de los rivales
        ↓
[endAt] el reloj llega a 0 → todos congelan
        ↓
[Resumen] ranking final; el host escribe UN documento de resultado
        ↓
[Limpieza] el nodo de la carrera se borra (onDisconnect + borrado del host)
```

---

## El problema de coste (por qué el enfoque naíf no sirve)

Un racer multijugador "hecho a la ligera" hace que **cada jugada** de **cada jugador** sea una escritura, y que **cada jugador** esté suscrito al progreso de **todos los demás**. Con `P` jugadores y `U` actualizaciones cada uno, el tráfico crece como **`P² · U`**. En Firestore, además, **cada jugada es un _write_ facturado y cada actualización recibida es un _read_ facturado**:

- 8 jugadores × ~40 puzzles × (1 write propio + 7 reads de rivales) ⇒ **miles de operaciones facturadas por partida**.
- A escala, eso son **dólares por cada pocos miles de partidas**, justo lo que se quiere evitar.

Las siete decisiones siguientes atacan ese crecimiento.

---

## Principios de optimización

### 1 · Cero datos de puzzles en Firebase

El contenido de los puzzles (`fen`, `moves`, `rating`) **ya existe** fuera de Firebase: [`puzzles-provider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts) los descarga del CDN y los cachea en IndexedDB. La carrera solo necesita que **todos converjan en la misma secuencia**. Dos formas:

| Opción | Cómo | Coste Firebase |
|---|---|---|
| **A · Semilla determinista** | El nodo guarda `{seed, query}`; cada cliente ejecuta una **selección con PRNG sembrado** (reemplazando el `shuffleArray` con `Math.random` de hoy) y obtiene la misma lista localmente. | ~0 bytes extra |
| **B · Lista precargada por el host** *(recomendada)* | El host construye la lista ordenada **una sola vez** y escribe los payloads mínimos (`uid,fen,moves,rating`) en el nodo. ~150 B × 40 ≈ **6 KB**, escrito 1 vez y leído 1 vez por cliente al unirse. | 1 write + P reads de ~6 KB |

Se recomienda **B**: garantiza que todos jueguen exactamente los mismos puzzles **aunque el CDN o la caché difieran entre dispositivos**, y evita tener que resolver `uid → puzzle` (el CDN agrupa por ELO/tema, no por `uid`). El coste es despreciable frente a la robustez. La opción A queda como optimización futura si se hace la selección 100% determinista.

### 2 · Realtime Database para el canal en vivo, **no** Firestore

Esta es la decisión de coste más importante. El proyecto hoy usa **solo Firestore**; para el canal en vivo conviene **añadir Realtime Database (RTDB)**:

| | Firestore | Realtime Database |
|---|---|---|
| Facturación | **Por operación** (read/write/delete) | **Por ancho de banda + almacenamiento**, sin coste por operación |
| Muchas escrituras pequeñas y frecuentes | Caro (cada una cuenta) | Barato (solo pesan los bytes) |
| Latencia | Mayor | Menor (pensada para tiempo real) |
| Presencia / desconexión | Manual | **`onDisconnect()` nativo** |

→ **RTDB** para el estado efímero y de alta frecuencia de la carrera. **Firestore** se reserva para lo **durable y consultable** (resultado final, ELO del usuario, historial), donde las escrituras son escasas y su modelo por operación no duele.

### 3 · Cliente autoritativo + escrituras throttled

Cada cliente calcula **su propio** progreso localmente (resolver un puzzle no consulta a nadie). Solo publica su estado a RTDB **como mucho cada ~1 s** (o una vez por puzzle resuelto, lo que sea más lento), nunca por movimiento. El payload es un puñado de enteros:

```jsonc
// races/{raceId}/players/{uid}
{ "i": 12, "s": 12, "c": 4, "d": false, "t": 1699999999 }
//   índice   score  combo done   timestamp
```

En una carrera de 120 s eso son, en el peor caso, ≤120 escrituras diminutas por jugador; en la práctica ~30 (una por acierto).

### 4 · Fan-in de enteros, no fan-out de jugadas

Cada cliente se suscribe **solo** al mapa `players/` de su carrera (P registros diminutos). Como cada actualización son ~20 bytes, el término `P²` que asustaba en el modelo naíf se vuelve **irrelevante en KB**: 8 jugadores generan del orden de **decenas de KB de tráfico total por carrera**, no miles de operaciones facturadas.

### 5 · Limpieza gratis con `onDisconnect()`

Al unirse, el cliente registra `onDisconnect(players/{uid}).remove()`. Si cierra la app o pierde conexión, RTDB **borra su presencia automáticamente** — sin jugadores fantasma, sin función programada, sin servidor arbitrando abandonos.

### 6 · Nodos efímeros con borrado agresivo

Las carreras viven en `races/{raceId}` y se **borran al terminar** (el host borra el nodo; `onDisconnect` cubre las caídas). No queda estado acumulándose. Si se quiere una red de seguridad para nodos huérfanos, basta **una** de estas (no todas):
- El **último jugador en salir** borra el nodo.
- Reglas de seguridad RTDB que **rechazan** lecturas/escrituras de nodos cuyo `endAt` ya pasó (quedan inertes y baratos hasta que un barrido los limpie).
- *(Opcional)* una única Cloud Function programada de barrido — pero se puede evitar por completo con lo anterior.

### 7 · Reloj de servidor para sincronizar sin árbitro

Todos derivan el inicio/fin de `startAt`/`endAt` (timestamps de servidor RTDB) y corrigen su reloj local con `.info/serverTimeOffset`. Así la carrera es justa **sin un servidor que dé el pistoletazo** ni que valide el reloj de cada quién.

---

## Matchmaking sin backend

Con una **transacción de RTDB** (atómica, a prueba de condiciones de carrera) no hace falta un árbitro server-side:

```
matchmaking/{bracket}/open/{lobbyId}:
  { count, startAt, raceId, players: { uid: true } }
```

- **Unirse:** transacción que busca un lobby abierto con cupo en el `bracket` del jugador (p. ej. por rango de ELO) y lo añade; si no hay ninguno, **crea uno**. La atomicidad de la transacción evita que dos jugadores pisen el mismo cupo.
- **Arranque:** cuando el lobby alcanza el mínimo de jugadores (o expira un temporizador corto), el creador fija `startAt = ahora + countdown` y `raceId`. Todos los clientes ya suscritos al lobby ven el mismo `startAt` y arrancan sincronizados.
- **Bracket por ELO:** particionar `matchmaking` por rango de ELO (usando `elo`/`eloPuzzles` del [`User`](../../libs/models/src/lib/user.model.ts)) reduce el tamaño de cada lista y empareja gente de nivel similar.

> **Fallback:** si el matchmaking por transacciones resulta engorroso en la práctica, una **única** Cloud Function ligera puede orquestar los emparejamientos con coste marginal. Se plantea client-first para no depender de Functions.

---

## Modelo de datos

### Realtime Database (efímero, tiempo real)

```jsonc
races/{raceId}: {
  meta:   { status: "countdown|running|ended", startAt, endAt, hostUid, puzzleCount },
  puzzles: [ { uid, fen, moves, rating }, … ],      // escrito 1 vez por el host (~6 KB)
  players: {
    {uid}: { name, i, s, c, d, t }                  // escritura throttled, ~20 B
  }
}

matchmaking/{bracket}/open/{lobbyId}: {
  count, startAt, raceId, players: { {uid}: true }
}
```

### Firestore (durable, escaso)

```jsonc
raceResults/{raceId}: {                              // 1 write por el host al terminar
  endedAt, bracket,
  players: [ { uid, name, score, rank } ]
}

users/{uid}: { racerElo, racerBestScore, racerGamesPlayed }   // ≤1 write por jugador al terminar
```

> **Persistir el resultado es opcional.** Si no se quiere leaderboard histórico, se puede **no escribir nada en Firestore** y dejar que el ranking final viva solo en RTDB hasta que el nodo se borre. La versión con leaderboard cuesta ≤ (1 + P) writes de Firestore **por carrera**, no por jugada.

---

## Presupuesto de coste (estimación por carrera de 8 jugadores, 120 s)

| Concepto | Operaciones | Tráfico |
|---|---|---|
| Escritura del set de puzzles (host) | 1 write RTDB | ~6 KB |
| Lectura del set (cada cliente, 1 vez) | 8 lecturas | ~48 KB |
| Escrituras de progreso (throttled) | ~30 × 8 ≈ 240 writes diminutos | ~5 KB |
| Fan-out del progreso a suscriptores | 240 × 7 push | ~33 KB |
| Presencia / `onDisconnect` | — | despreciable |
| **Total RTDB por carrera** | | **~90–120 KB** |
| Firestore durante la carrera | **0** | — |
| Firestore al terminar (con leaderboard) | ≤ 9 writes | — |

Con RTDB facturando la descarga a ~$1/GB, **~90–120 KB por carrera ⇒ del orden de 10 000 carreras por dólar** de ancho de banda. El modelo naíf en Firestore (write por jugada + reads de rivales) costaría **~100× más** en operaciones facturadas. Ese factor ~100× **es** la feature.

---

## Anti-trampas

El modelo es **cliente-autoritativo**, así que es técnicamente manipulable (los puzzles y sus soluciones están en el cliente). Para un modo casual es aceptable; mitigaciones por niveles:

- **Básico (ahora):** validar que el puntaje es alcanzable (`score ≤ puzzleCount`) y coherente con `endAt`. Reglas de seguridad RTDB que impidan a un jugador **escribir en el nodo de otro** o **escribir después de `endAt`**.
- **Medio (futuro):** exigir que cada cliente envíe un hash de la secuencia de soluciones para auditoría estadística de outliers.
- **Ranked (futuro):** si se quiere un ELO competitivo serio, validar un _replay_ del lado servidor con **una** Cloud Function que reejecuta las jugadas con `chess.js`. Solo para partidas ranked, no para el modo casual — así el coste server-side se mantiene marginal.

---

## Integración con la app

### Se reutiliza

- **[`board-puzzle`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts):** se alimenta con `@Input() setPuzzle` puzzle a puzzle y se escuchan `@Output() puzzleCompleted` / `puzzleFailed` para avanzar. Se usa `setForceStopTimer` y se **oculta el timer por-puzzle** (`showBoardControls = false`): el racer usa un **reloj global** de carrera, no el del board.
- **[`puzzles-provider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts) + caché IndexedDB:** el host obtiene el set con `getPuzzles({ eloMin, eloMax, count })`; el resto lo recibe ya resuelto por RTDB.
- **[`AuthService`](../../apps/chessColate/src/app/services/auth.service.ts):** `uid` y nombre del jugador.
- **`AnalyticsService`** ([catálogo](../implementado/OBSERVABILITY_TRACKING.md)): instrumentar `race_joined`, `race_started`, `race_finished`, `race_rank`.
- **NgRx** (`libs/state`): un slice `racer` para el estado de la carrera en curso.

### Se añade

- **`provideDatabase(getDatabase())`** en los providers de Firebase de [`main.ts`](../../apps/chessColate/src/main.ts) (RTDB no está cableada hoy).
- **`RaceService`** — wrapper de RTDB: crear/unirse a carrera, publicar progreso throttled, suscribirse a `players/`, `onDisconnect`, borrado.
- **`MatchmakingService`** — transacciones de lobby por bracket de ELO.
- **Selección determinista** *(si se adopta la opción A)* — util con PRNG sembrado en [`common-utils`](../../libs/common-utils) que reemplace el `shuffleArray` con `Math.random`.
- **Página/UI del racer** — cuenta atrás, tablero, barra/ranking en vivo con enteros de rivales, pantalla de resultados.
- **Reglas de seguridad de RTDB** — forma/tamaño del payload, un jugador solo escribe su propio nodo, rechazo de escrituras tras `endAt`.

---

## Pendientes antes de implementar

- [ ] Confirmar duración, nº de jugadores y esquema de puntuación (¿combo con multiplicador?).
- [ ] Elegir **Opción A (semilla) vs B (lista precargada)** para la sincronización de puzzles (recomendado: B).
- [ ] Definir los **brackets de ELO** del matchmaking y el mínimo de jugadores para arrancar.
- [ ] Decidir si se **persiste** resultado/leaderboard en Firestore o el ranking vive solo en RTDB.
- [ ] Escribir las **reglas de seguridad** de RTDB (validación de payload y de ventana temporal).
- [ ] Definir la estrategia de **barrido** de nodos huérfanos (último-en-salir vs reglas por `endAt` vs Function de barrido).
- [ ] Modo de relleno con **bots** si no hay suficientes jugadores humanos (para que el modo no se sienta vacío al inicio).
- [ ] ¿ELO competitivo (ranked con validación server-side) o solo puntajes casuales?
- [ ] **Identidad de jugador:** hoy no hay auth anónima (solo Google/email + modo invitado sin `uid`). Decidir si el racer exige cuenta o si se activa `signInAnonymously` para que los invitados tengan un `uid` estable en el matchmaking.
```