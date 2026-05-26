# Game Analytics — Feature Document

## Concepto

Permite al usuario conectar su cuenta de **chess.com** y/o **lichess** mediante su nombre de usuario público, descargar su historial de partidas y generar reportes visuales e interactivos sobre su rendimiento. Los datos se procesan localmente y se cachean en el dispositivo para no repetir llamadas a la API.

Disponible en **chessColate (web)** y **chess-extension (mobile)**.

---

## Arquitectura

```
chess.com API  →  chess-com-provider  ─┐
                      ↕ cache local    ├→  game-reporter  →  Chart.js datasets  →  UI
lichess API    →  lichess-provider    ─┘
                      ↕ cache local
```

### Libs nuevas en el monorepo NX

| Lib | Paquete | Responsabilidad |
|-----|---------|----------------|
| `libs/chess-com-provider` | `@chesspark/chess-com-provider` | Cliente API chess.com, normalización, caché |
| `libs/lichess-provider` | `@chesspark/lichess-provider` | Cliente API lichess, normalización, caché |
| `libs/game-reporter` | `@chesspark/game-reporter` | Procesamiento de reportes + análisis PGN |

El modelo canónico `ChessGame` se agrega a `libs/models`.

---

## Modelo canónico `ChessGame`

```ts
// libs/models/src/lib/chess-game.model.ts

export type ChessPlatform = 'chess.com' | 'lichess';
export type GameResult = '1-0' | '0-1' | '1/2-1/2';
export type GameVariant = 'standard'; // solo estándar por ahora

export interface ChessGamePlayer {
  username: string;
  rating: number;
}

export interface ChessGame {
  id: string;
  source: ChessPlatform;
  pgn: string;
  timeControl: string;       // e.g. "600", "180+2", "900+10"
  timeControlSeconds: number; // segundos del tiempo base (sin incremento)
  playedAt: number;          // timestamp UTC en ms
  white: ChessGamePlayer;
  black: ChessGamePlayer;
  result: GameResult;
  userColor: 'white' | 'black'; // color del usuario que solicita el análisis
  opening?: {
    eco: string;             // e.g. "B20"
    name: string;            // e.g. "Sicilian Defense"
  };
  variant: GameVariant;
  analyzed: boolean;         // true si chess.com/lichess tiene análisis de computador
}
```

---

## `libs/chess-com-provider`

### API utilizada

Chess.com [API pública](https://www.chess.com/news/view/published-data-api) — no requiere autenticación.

```
GET https://api.chess.com/pub/player/{username}/games/{year}/{month}
```

Devuelve un JSON con array de partidas. Incluye PGN, time control, resultado, jugadores y ratings.

### Responsabilidades

- `fetchGames(username, options?)` — descarga partidas de un usuario
  - `options.from?: Date` — mes de inicio
  - `options.to?: Date` — mes de fin (default: mes actual)
  - `options.timeControlMin?: number` — filtrar por tiempo mínimo (segundos)
  - `options.timeControlExact?: number` — filtrar por tiempo exacto
- Filtra variantes no estándar (Chess960, Bughouse, etc.)
- Normaliza a `ChessGame[]`
- Cachea en LocalStorage por clave `chesscom_{username}_{year}_{month}`
- Respeta el cache: si ya hay datos del mes, no llama a la API (excepto el mes actual)

### Cache strategy

- Meses pasados: permanentes (no cambian)
- Mes actual: TTL de 1 hora
- Clave de cache: `chesspark_chesscom_{username}_{YYYY}_{MM}`

---

## `libs/lichess-provider`

### API utilizada

[Lichess API](https://lichess.org/api) — no requiere autenticación para partidas públicas.

```
GET https://lichess.org/api/games/user/{username}
  ?since=<timestamp_ms>
  &until=<timestamp_ms>
  &perfType=bullet,blitz,rapid,classical
  &format=application/x-ndjson
```

Devuelve NDJSON (un JSON por línea). Cada objeto incluye PGN, clocks, jugadores, apertura.

### Responsabilidades

- `fetchGames(username, options?)` — misma firma que chess-com-provider
- Parsea el stream NDJSON
- Filtra variantes no estándar
- Normaliza a `ChessGame[]`
- Cachea en LocalStorage por clave `chesspark_lichess_{username}_{YYYY}_{MM}`
- Misma cache strategy que chess-com-provider

### Diferencias técnicas con chess.com

- Lichess devuelve las partidas en PGN con headers; hay que parsear `[TimeControl "..."]`, `[White "..."]`, etc.
- El campo `opening` viene en el objeto JSON si se solicita con `?opening=true`
- Los ratings en Lichess son inflados respecto a FIDE/chess.com — se normaliza solo el valor, sin conversión

---

## `libs/game-reporter`

### Entrada

```ts
interface ReporterOptions {
  games: ChessGame[];
  username: string;        // para saber qué color es el usuario en cada partida
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    timeControlMin?: number;
    timeControlExact?: number;
    platform?: ChessPlatform | 'both';
  };
}
```

### Reportes disponibles

#### 1. Progreso de rating (`getRatingProgress`)

```ts
interface RatingDataPoint {
  date: number;       // timestamp
  rating: number;
  platform: ChessPlatform;
}
// Retorna: RatingDataPoint[]  (ordenado por fecha)
```

Gráfica de línea con Chart.js. Se puede separar por plataforma o mostrar una línea combinada.

#### 2. Estadísticas generales (`getGeneralStats`)

```ts
interface GeneralStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;       // 0–1
  byPlatform: Record<ChessPlatform, { games: number; winRate: number }>;
  byTimeControl: Record<string, { games: number; winRate: number }>;
}
```

#### 3. Rendimiento por apertura (`getOpeningStats`)

```ts
interface OpeningStats {
  eco: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  asWhite: number;
  asBlack: number;
}
// Retorna: OpeningStats[]  (ordenado por games desc)
```

#### 4. Análisis PGN profundo (`getPgnAnalysis`)

Requiere parsear el PGN con `chess.js` (ya está disponible en el proyecto).

```ts
interface PgnAnalysis {
  avgMovesPerGame: number;
  mostAdvancedPawns: {
    username: string;
    pawnSquare: string;   // e.g. "e7"
    game: string;         // game id
  };
  avgAccuracy?: number;   // solo si la partida tiene análisis de computador
  phaseStats: {
    openingMoves: number;   // promedio de jugadas de apertura
    middlegameMoves: number;
    endgameMoves: number;
  };
}
```

> El análisis PGN es computacionalmente intenso — se ejecuta de forma lazy y solo sobre el subset filtrado de partidas.

#### 5. Heatmap de actividad (`getActivityHeatmap`)

```ts
interface ActivityDay {
  date: string;    // "YYYY-MM-DD"
  games: number;
}
// Retorna: ActivityDay[]
```

Visualización estilo GitHub contribution graph.

---

## Flujo de usuario (UX)

```
[Pantalla Analytics]
         ↓
[Usuario ingresa username de chess.com y/o lichess]
         ↓
[App descarga partidas (muestra progress bar)]
  → lee cache local primero
  → fetcha solo los meses que faltan
         ↓
[Filtros disponibles]
  → Plataforma: chess.com / lichess / ambas
  → Control de tiempo: bullet / blitz / rapid / clásico / personalizado
  → Rango de fechas
         ↓
[Reportes se generan en tiempo real al cambiar filtros]
  → Gráfica de progreso de rating
  → Estadísticas generales (win rate, etc.)
  → Tabla de aperturas
  → Análisis PGN (on demand, botón separado)
```

---

## Alcance inicial (MVP)

- [ ] Modelo `ChessGame` en `libs/models`
- [ ] `chess-com-provider`: fetch + normalización + cache
- [ ] `lichess-provider`: fetch + normalización + cache
- [ ] `game-reporter`: filtros + `getRatingProgress` + `getGeneralStats` + `getOpeningStats`
- [ ] UI básica en chessColate: input de username, filtros, gráfica de rating, tabla de aperturas

## Fuera de alcance inicial

- OAuth / partidas privadas
- `getPgnAnalysis` (análisis PGN profundo) — segunda iteración
- `getActivityHeatmap` — segunda iteración
- Comparación entre usuarios
- Variantes no estándar

---

## Dependencias técnicas

| Dependencia | Uso |
|-------------|-----|
| `chess.js` | Parseo de PGN para análisis profundo (ya en el proyecto) |
| `chart.js` + `ng2-charts` | Visualización en la UI de Angular |
| `@chesspark/models` | Modelo `ChessGame` compartido |

---

## Consideraciones

- **Rate limiting:** chess.com pide no hacer más de 1 req/segundo; lichess tiene límites más generosos. Los providers deben respetar esto especialmente al bajar histórico largo.
- **Privacidad:** no se almacena ningún dato en backend propio — todo queda en el dispositivo del usuario.
- **Partidas en curso:** la API de chess.com devuelve partidas del mes actual incluyendo las no terminadas; hay que filtrar por `result !== '*'`.
- **PGN encoding:** lichess codifica las partidas con UTF-8; chess.com a veces incluye caracteres especiales en nombres de jugadores.
