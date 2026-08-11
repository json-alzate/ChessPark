# Reproductor de Partidas / TV de Partidas — Feature Document

> ✅ **Primera entrega implementada.** Este documento es el **diseño original**.
> Para saber **cómo quedó funcionando** (arquitectura, decisiones que cambiaron
> al construirlo y bordes conocidos), ver
> **[REPRODUCTOR_PARTIDAS_FLOW.md](../implementado/REPRODUCTOR_PARTIDAS_FLOW.md)**.
> Las **listas de reproducción y el "me gusta"** (capa 3) siguen pendientes.

## Concepto

Una pantalla de **Partidas** donde el usuario descarga la colección de un campeón
del mundo y la ve reproducirse sobre el tablero, como un video: play, pausa,
jugada adelante y atrás, y una velocidad configurable por movimiento.

Y el modo que da nombre a la feature: **el TV**. Le das a un botón y la app va
pasando las partidas de esa colección una tras otra, sola. Sin elegir nada.

Pegar un PGN a mano es algo que casi nadie va a hacer, así que lo que convierte
esto en una feature de verdad es **que la app traiga las partidas puestas**. De
ahí las tres capas:

| Capa | Qué es | Entrega |
|---|---|---|
| **1 · Motor** | Reproducir una secuencia de jugadas, con controles y velocidad | v1 |
| **2 · Catálogo** | Paquetes de campeones descargables desde el CDN | v1 |
| **3 · Listas** | Listas propias y una automática de "me gusta" | v2 |

> **Base técnica ya existente**: [`BoardPuzzleSolutionComponent`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts)
> ya reproduce una secuencia de jugadas: mantiene las posiciones y los
> movimientos, un índice de jugada actual, botones de anterior/siguiente,
> reproducción con `interval` de RxJS, `cm-chessboard` para pintar, `chess.js`
> para la lógica y `SoundsService` para el sonido. La capa 1 es en buena parte
> **generalizar ese motor** para que consuma una partida cualquiera.

> **Importar "mis partidas" de lichess / chess.com queda fuera**, por decisión
> explícita: esos conectores son el corazón de [Game Analytics](./GAME_ANALYTICS.md)
> y se construyen allí. Cuando existan, el reproductor los consumirá como una
> fuente más.

---

## Objetivos

- Estudio pasivo o activo: ver partidas completas sin moverlas a mano.
- **Velocidad configurable** para adaptar el ritmo (repaso rápido vs. estudio lento).
- Que la app traiga **su propio catálogo**, sin que el usuario busque archivos.
- Que **añadir un jugador nuevo no obligue a publicar una versión** en la tienda.
- Reutilizar el tablero, el motor de reproducción y la caché que ya existen.
- **Offline-first**: un paquete descargado se reproduce sin red.

---

## Las tres pantallas

### 1 · Partidas (el catálogo)

```
╔═══════════════════════════════════════════╗
║  Partidas                                 ║
║                                           ║
║  EN TU DISPOSITIVO                        ║
║  ┌───────────────────────────────────┐    ║
║  │ Petrosian                         │    ║
║  │ 1.893 partidas · 1,1 MB         ▸ │    ║
║  └───────────────────────────────────┘    ║
║                                           ║
║  CAMPEONES DEL MUNDO                      ║
║  ┌───────────────────────────────────┐    ║
║  │ Alekhine    1927–1935, 1937–1946  │    ║
║  │ 1.661 partidas · 1,0 MB        ⬇  │    ║
║  ├───────────────────────────────────┤    ║
║  │ Anand       2000–2002, 2007–2013  │    ║
║  │ 4.310 partidas · 2,7 MB     ▓▓░ 62%   ║
║  └───────────────────────────────────┘    ║
║                                           ║
║  ┌───────────────────────────────────┐    ║
║  │ Abrir un PGN propio               │    ║
║  └───────────────────────────────────┘    ║
╚═══════════════════════════════════════════╝
```

Lo descargado va arriba: es lo único que funciona sin conexión y es a lo que se
vuelve. Cada jugador dice **cuántas partidas trae y cuánto ocupa antes de
descargar** — la misma honestidad que la pantalla de Almacenamiento. El botón de
descarga se convierte en barra de progreso mientras baja y en flecha de entrar
cuando termina.

Abajo, discreta, la entrada para cargar un PGN propio (pegar o abrir archivo).

### 2 · El jugador

```
╔═══════════════════════════════════════════╗
║  ‹ Petrosian                         ⋮    ║
║  Campeón del mundo 1963–1969              ║
║  1.893 partidas                           ║
║                                           ║
║  ┌───────────────────────────────────┐    ║
║  │        ▶  VER EN MODO TV          │    ║
║  └───────────────────────────────────┘    ║
║                                           ║
║  Buscar rival…                            ║
║  [Todas] [Ganadas] [Con blancas] [Negras] ║
║                                           ║
║  Petrosian – Botvinnik            1-0     ║
║  Moscú 1963 · 41 jugadas                  ║
║  ─────────────────────────────────────    ║
║  Spassky – Petrosian              0-1     ║
║  Moscú 1966 · 36 jugadas                  ║
╚═══════════════════════════════════════════╝
```

El botón grande es el corazón de la feature: **le das y se pone a pasar partidas
sola**. Debajo, para quien sí quiere elegir, la lista con búsqueda por rival y
filtros por resultado y color. En el menú de los tres puntos, borrar el paquete.

### 3 · El reproductor

```
╔═══════════════════════════════════════════╗
║  ‹   Petrosian – Botvinnik          1-0   ║
║      Moscú 1963                           ║
║                                           ║
║           ┌─────────────────┐             ║
║           │     TABLERO     │             ║
║           └─────────────────┘             ║
║                                           ║
║   1.d4 Nf6  2.c4 e6  3.Nc3 d5  4.cxd5 ... ║
║                     ▲ jugada 12 / 41      ║
║                                           ║
║      ⏮   ◀   ▶/⏸   ▶   ⏭                 ║
║   ⏱ 2s      girar      sonido             ║
║                                           ║
║   ── solo en modo TV ─────────────────    ║
║   ⏮ anterior   partida 3/1.893   ⏭        ║
║   aleatorio · repetir · autoplay          ║
╚═══════════════════════════════════════════╝
```

La lista de jugadas se desplaza sola con la partida; tocar una salta a esa
posición. La velocidad se cambia en caliente, sin reiniciar.

La franja inferior **solo aparece si vienes del modo TV**: si entraste tocando
una partida concreta, esos controles sobran.

---

## El catálogo

### Dónde vive

Repositorio público [**chesscolate_pngs_packs**](https://github.com/json-alzate/chesscolate_pngs_packs),
servido por jsDelivr igual que los archivos de puzzles:

```
cdn.jsdelivr.net/gh/json-alzate/chesscolate_pngs_packs@main/
    index.json              ← qué colecciones existen
    players/petrosian.pgn   ← un paquete por jugador
    players/alekhine.pgn
    players/anand.pgn
```

### Un paquete por jugador, en PGN

**Sin trocear por periodos.** El paquete de Petrosian son 1,1 MB con 1.893
partidas — unos 580 bytes por partida — y el más pesado del catálogo de PGN
Mentor rondaría los 5 MB. Eso es una descarga normal, y trocear obligaría al
usuario a entender qué periodo quiere antes de ver nada.

**Y en PGN tal cual, sin convertir a JSON.** La app tiene que saber leer PGN de
todas formas para los archivos que traiga el usuario, así que si el catálogo
también es PGN hay **un solo camino de lectura** en vez de dos, y desaparece el
paso de conversión. El tamaño es prácticamente el mismo.

### El índice, y por qué vive en el CDN

```jsonc
{
  "generatedAt": "2026-08-06T17:19:54.508Z",
  "collections": [
    {
      "id": "petrosian",
      "name": "Tigran Petrosian",
      "reign": "1963–1969",
      "games": 1893,
      "sizeBytes": 1130944,
      "file": "players/petrosian.pgn"
    }
  ]
}
```

El catálogo de la app es **un recorrido por esa lista**: cada fila pinta una
tarjeta y la URL de descarga sale de juntar la base del CDN con `file`.

Aquí hay una diferencia deliberada con los puzzles. Su índice
([`puzzles-manifest.json`](../../libs/puzzles-provider/src/lib/puzzles-manifest.json))
**va compilado dentro de la app**, así que añadir puzzles exige publicar una
versión. Aquel catálogo es estático; este está pensado para crecer, y por eso su
índice **se descarga**: publicar un campeón nuevo es un commit en el repositorio
de partidas, sin pasar por la tienda.

Se guarda en el dispositivo tras pedirlo, así que la segunda visita pinta al
instante y funciona sin conexión. Como respaldo, una copia del índice viaja
dentro de la app para el primer arranque sin red.

**Sin versión por paquete**: si un paquete cambia, quien ya lo tenga no se
entera. Se decidió no hacerlo porque los paquetes no van a variar; el índice deja
sitio para añadirlo más adelante sin romper nada.

### Añadir un jugador

En el repositorio de partidas: dejar el `.pgn` en `players/`, añadir su nombre y
años en `players.meta.json`, ejecutar `node tools/build-index.mjs` y hacer
commit. **La app no se toca.**

### Origen de las partidas

[PGN Mentor](https://www.pgnmentor.com/files.html), que las distribuye libres y
gratis, con colecciones ya organizadas por jugador. Las jugadas de una partida
son hechos y no son obra protegida; lo que sí tiene autor son los comentarios y
anotaciones, y estos archivos no llevan ninguno.

---

## Diseño técnico

### Dónde vive cada cosa

- **Lib `games-provider`**, hermana de [`puzzles-provider`](../../libs/puzzles-provider/):
  índice, descarga, caché y lectura de PGN.
- **Página** `apps/chessColate/src/app/pages/games/`, con las tres vistas.
- **Componente de reproducción** en `@chesspark/board`, hermano del de solución
  de puzzles.

### Lectura de PGN

`chess.js` (ya en el repo) sabe cargar **una** partida, pero no separa un archivo
multi-partida. El troceo se hace antes, buscando los bloques de cabecera: cada
partida empieza con sus etiquetas entre corchetes.

**Se lee en dos pasos, y esto importa con 4.310 partidas:**

1. Al abrir un paquete se extraen **solo las cabeceras** de cada partida (quién
   juega, evento, fecha, resultado). Es un recorrido de texto, sin ajedrez de
   por medio.
2. Las **posiciones de una partida se derivan cuando esa partida se va a ver**,
   no antes.

Derivar las posiciones de 4.310 partidas al abrir la pantalla la congelaría
varios segundos sin que nadie lo haya pedido.

### Modelo de datos

```ts
/** Una colección del índice remoto. */
interface GameCollectionInfo {
  id: string;
  name: string;
  reign: string;
  games: number;
  sizeBytes: number;
  file: string;
}

/** Una partida, tal como sale de la primera pasada (sin posiciones). */
interface GameHeader {
  index: number;
  white: string;
  black: string;
  event: string;
  date: string;
  result: string;
  plies: number;
}

/** Una partida ya lista para reproducir. */
interface ParsedGame {
  header: GameHeader;
  sanMoves: string[];
  fens: string[];      // una por jugada, incluida la posición inicial
  startFen?: string;   // posición inicial no estándar
}

interface PlaybackSettings {
  msPerMove: number;          // 500 | 1000 | 2000 | 3000 | 5000
  soundEnabled: boolean;
  autoNextGame: boolean;
  shuffle: boolean;
  loopCollection: boolean;
  boardOrientation: 'white' | 'black';
}
```

`PlaybackSettings` se guarda en el almacenamiento local, como el resto de ajustes.

### Motor de reproducción

- Un índice sobre la lista de posiciones.
- Reproducción con `interval(msPerMove)` de RxJS y `takeUntil` para pausar.
- En cada tick: pintar la posición, resaltar la jugada, sonar la pieza.
- Al final: parar; si el autoplay está activo, esperar una pausa breve y cargar
  la siguiente partida (respetando aleatorio y repetición).

### Casos borde

- **ELO vacío** (`[WhiteElo ""]`): normal en partidas anteriores a 1970. No se
  muestra rating en vez de mostrar cero.
- **Codificaciones viejas** en nombres de torneo: se pintan como vengan, sin
  romper la lista.
- Partidas con **variantes o comentarios**: solo la línea principal.
- **Posición inicial no estándar**: se respeta.
- Partida **sin jugadas** (solo cabeceras): se salta en el TV.
- **Sin red y sin paquete descargado**: decirlo claro y ofrecer lo que sí está.
- PGN propio inválido: mensaje claro, no romper la pantalla.

---

## Decisiones cerradas

| Decisión | Cómo quedó | Por qué |
|---|---|---|
| **Nombre y entrada** | "Partidas", desde el menú lateral | Es lo que el usuario busca; "reproductor" describe el mecanismo, no el contenido. El home ya compite con el entrenamiento. |
| **Troceo de paquetes** | Uno por jugador, sin periodos | 1,1 MB es una descarga normal; trocear añade una decisión que nadie pidió. |
| **Formato** | PGN tal cual | Un solo camino de lectura, compartido con los PGN del usuario. |
| **Índice** | Remoto, en el CDN, con copia de respaldo en la app | Añadir un campeón no debe exigir publicar una versión. |
| **Versión por paquete** | No, por ahora | No van a variar; el índice deja sitio. |
| **Tablero** | Solo mirar, no se mueven piezas | Explorar variantes es justo lo que hace el [Analizador](./ANALIZADOR_PARTIDAS.md); meterlo a medias aquí los pisa. |
| **Pantalla encendida** | Sí, mientras reproduce en modo TV | Es un modo para dejarlo corriendo; que se apague a los 30 s lo arruina. Se suelta al pausar y al salir. |
| **Filtros** | Rival, resultado y color | Salen directos de las cabeceras, sin trabajo extra al generar el catálogo. Año y torneo, si los datos lo piden. |
| **Velocidades** | Fijas: 0,5 / 1 / 2 / 3 / 5 s | Un toque frente a un arrastre fino; en móvil se nota. |
| **Al entrar en un jugador** | No arranca solo | El botón de TV es explícito y bien visible. |
| **Conectores externos** | Fuera, van en Game Analytics | No duplicarlos ni meter dependencia de terceros aquí. |
| **Componente del tablero** | Uno **hermano**, no generalizar el de puzzles | Aquel arrastra la validación de jugadas, la promoción y Stockfish; tocarlo ponía en riesgo el flujo de entrenamiento. _(decidido al construirlo)_ |
| **Fotos de los jugadores** | Fuera: solo nombre y años | Evita meterse en derechos de imagen por un adorno. _(decidido al construirlo)_ |
| **Primer catálogo** | Tres campeones | Validar el montaje antes de preparar diecisiete paquetes a ciegas. Ampliarlo no toca la app. _(decidido al construirlo)_ |

---

## Instrumentación

Sobre el `AnalyticsService` existente ([catálogo](../implementado/OBSERVABILITY_REFERENCIA.md)):

| Evento | Cuándo | Params |
|--------|--------|--------|
| `games_catalog_opened` | se abre Partidas | `downloaded_count` |
| `games_pack_downloaded` | termina una descarga | `player`, `games`, `size_kb` |
| `games_pack_deleted` | se borra un paquete | `player` |
| `game_opened` | se abre una partida | `source` (`catalog`/`tv`/`file`/`paste`), `player` |
| `games_tv_started` | arranca el modo TV | `player`, `games_count` |
| `games_tv_next` | encadena a la siguiente | `index` |
| `games_speed_changed` | cambia la velocidad | `ms_per_move` |
| `games_pgn_load_failed` | PGN propio inválido | `reason` |

---

## Métricas de éxito

- **Qué campeones se descargan** — dice a quién añadir después.
- Cuántos llegan a usar el **modo TV** y cuánto duran en él: es la métrica que
  dice si la feature funciona.
- Reparto entre catálogo y PGN propio.
- Distribución de velocidad.

---

## Alcance de la primera entrega (v1)

1. Lib `games-provider`: índice remoto con respaldo local, descarga de paquetes,
   caché en el dispositivo y lectura de PGN en dos pasos.
2. Motor de reproducción generalizado, con velocidad y controles completos.
3. Las tres pantallas, con búsqueda por rival y filtros de resultado y color.
4. Modo TV: encadenado, aleatorio, repetición y pantalla encendida.
5. Cargar PGN propio (pegar o abrir archivo).
6. Entrada en el menú lateral, textos en español e inglés, analítica e
   integración con la pantalla de Almacenamiento.

## Segunda entrega (v2)

- Listas propias y la lista automática de **"Me gusta"**.
- Sincronización de listas con el perfil cuando hay sesión.
- Ampliar el catálogo según lo que digan las descargas.

## Fuera de alcance

- Importar partidas de lichess / chess.com → [Game Analytics](./GAME_ANALYTICS.md).
- Variantes, comentarios y símbolos de evaluación.
- Análisis con Stockfish sobre la partida (el motor ya está en
  [`stockfish-wasm`](../../libs/stockfish-wasm/src/lib/); se puede añadir después).
- Barra de arrastre fino por la partida.
- Colecciones temáticas curadas a mano.

---

## Dependencias técnicas

- `chess.js` y `cm-chessboard` + `@chesspark/board` (ya en el repo).
- `SoundsService` de `@chesspark/common-utils` para el sonido de piezas.
- La caché y el patrón de catálogo de [`puzzles-provider`](../../libs/puzzles-provider/).
- `@capacitor-community/keep-awake` (versión 7, la 8 exige Capacitor 8) para la
  pantalla encendida en modo TV.
- Almacenamiento local para los ajustes de reproducción.
- `AnalyticsService` existente.
- **Fuera de la app**: el repositorio
  [chesscolate_pngs_packs](https://github.com/json-alzate/chesscolate_pngs_packs)
  y su generador de índice.
