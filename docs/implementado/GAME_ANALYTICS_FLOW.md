# Flujo del Análisis de Partidas

El usuario escribe su nombre en **chess.com**, en **lichess** o en las dos, y la
app se descarga sus partidas públicas y le enseña cómo juega de verdad:
evolución del rating, porcentaje de puntuación, con qué color va mejor, qué
aperturas le funcionan y qué días juega.

Todo se procesa en el dispositivo. **No hay backend propio ni se sube nada.**

> Este documento describe cómo funciona lo implementado. La idea original
> (planificación) está en
> [`../features/GAME_ANALYTICS.md`](../features/GAME_ANALYTICS.md).

---

## Qué ve el usuario

Una sola pantalla, **Análisis de partidas**, en el menú lateral junto a
Partidas. Tiene dos caras.

**Sin cuentas conectadas** aparece el formulario: un campo para chess.com, otro
para lichess y un selector de cuánto historial bajar (3, 6, 12 o 24 meses). No
se pide contraseña, y el texto lo dice: solo se usan las partidas públicas.
Debajo, la nota de que nada sale del dispositivo.

**Con cuentas conectadas** aparece el reporte:

- **Cuatro cifras de cabecera**: partidas, puntuación, el desglose
  ganadas / tablas / perdidas y el rating medio del rival.
- **Evolución del rating**, una línea por plataforma.
- **Mapa de actividad** al estilo del de GitHub: una columna por semana, un
  cuadro por día.
- **Con blancas y con negras**, para ver de qué lado se juega mejor.
- **Tabla de aperturas** con la barra de ganadas / tablas / perdidas a escala.

Arriba de todo, filtros por plataforma y por control de tiempo; los reportes se
recalculan al instante porque **las partidas ya están en memoria**.

Al final, las cuentas conectadas —cada una con su botón de desconectar— y el
selector de historial, por si se quiere ampliar el periodo.

---

## Arquitectura

```
chess.com API  →  chess-com-provider  ─┐
                                       ├→  game-reporter  →  pantalla
lichess API    →  lichess-provider    ─┘   (archivo + reportes)
```

### Libs nuevas

| Lib | Paquete | Responsabilidad |
|-----|---------|-----------------|
| [`libs/chess-com-provider`](../../libs/chess-com-provider/) | `@chesspark/chess-com-provider` | Cliente de la API de chess.com y normalización |
| [`libs/lichess-provider`](../../libs/lichess-provider/) | `@chesspark/lichess-provider` | Cliente de la API de lichess y normalización |
| [`libs/game-reporter`](../../libs/game-reporter/) | `@chesspark/game-reporter` | Archivo local en IndexedDB, filtros y reportes |

El modelo canónico
[`ChessGame`](../../libs/models/src/lib/chess-game.model.ts) vive en
`@cpark/models`, con los ayudantes que necesitan todos: el resultado visto desde
el color del usuario, su rating en la partida y la clasificación del control de
tiempo.

### Dónde se decidió partir de la propuesta

**El caché es IndexedDB, no localStorage.** El documento original proponía
localStorage. Un año de partidas en PGN pasa de los cinco megas que aguanta
localStorage, y quedarse sin espacio a mitad de una descarga es la peor manera
de enterarse. Se usa el mismo montaje que
[el catálogo de partidas](./REPRODUCTOR_PARTIDAS_FLOW.md) y que los puzzles.

**Los conectores no guardan nada.** En la propuesta cada conector tenía su
caché. Aquí solo hablan con la red y devuelven `ChessGame[]`; quién guarda y qué
meses faltan es cosa de `GamesArchive`, dentro de `game-reporter`. Así hay **un
solo caché** en vez de dos iguales, y los conectores se prueban sin navegador.

---

## El modelo común

Las dos plataformas devuelven formas muy distintas y los conectores las
traducen a la misma:

| | chess.com | lichess |
|---|---|---|
| Formato | JSON por mes | NDJSON en flujo |
| Resultado | `white.result` / `black.result` (`win`, `resigned`, `agreed`…) | `winner` más `status` |
| Apertura | ECO en el PGN, nombre en una URL | objeto `opening` en el JSON |
| Tiempo | `'600'`, `'180+2'`, `'1/86400'` | objeto `clock` o `daysPerTurn` |
| Fecha | `end_time` en segundos | `lastMoveAt` en milisegundos |

**El control de tiempo se clasifica con la misma regla para las dos** —tiempo
base más cuarenta jugadas de incremento—, aunque cada plataforma tenga la suya.
Si chess.com y lichess clasificaran distinto, juntar sus partidas en una misma
tabla mentiría.

**Lo que se descarta al normalizar**: variantes que no son ajedrez estándar,
partidas sin terminar (chess.com devuelve las de correspondencia en curso),
partidas abortadas y partidas en las que el usuario no aparece.

---

## La descarga

La unidad es el **mes**, porque un mes cerrado ya no cambia nunca:

```
para cada mes del periodo:
   ¿está guardado?
        │
        ├─ sí, y no es el mes en curso ──▶ se usa tal cual
        ├─ sí, es el mes en curso y tiene menos de 1 h ──▶ se usa tal cual
        └─ no ──▶ se pide a la plataforma, se guarda y se usa
```

El mes en curso vale **una hora**: todavía puede crecer, y una hora equilibra
ver las partidas de hoy con no machacar la API cada vez que se abre la pantalla.

### Ritmo de peticiones

chess.com pide **no pasar de una petición por segundo**. Los dos conectores
encolan sus llamadas y las espacian solos, así que el límite se cumple aunque la
pantalla las pida todas de golpe. Doce meses son doce segundos de descarga
inicial, con la barra avisando de por dónde va.

Además, en chess.com se pregunta primero **qué meses tienen partidas**
(`/games/archives`) y se cruza con el periodo pedido: una cuenta creada este año
no gasta peticiones en 2019.

### Cuando algo falla

- **Un mes falla** → se cuenta como fallido, se usa lo que hubiera guardado de
  antes y se sigue con el resto. Media respuesta es mejor que un error.
- **Una plataforma falla** → la otra sigue.
- **El nombre no existe** → se avisa antes de descargar nada. Un nombre mal
  escrito descubierto tras cuarenta peticiones es una espera tirada.

---

## Los reportes

Todos son funciones puras sobre `ChessGame[]`
([`reports.ts`](../../libs/game-reporter/src/lib/reports.ts)). Se filtra una vez
y el resultado alimenta a los cuatro.

| Reporte | Qué devuelve |
|---------|--------------|
| `getRatingProgress` | Un punto por partida, con su plataforma |
| `getGeneralStats` | Totales, desglose por plataforma / tiempo / color, rival medio y racha actual |
| `getOpeningStats` | Una fila por código ECO, de la más jugada a la menos |
| `getActivityHeatmap` | Partidas por día, sin huecos entre el primero y el último |

**La puntuación cuenta las tablas como medio punto.** Con la cuenta de solo
victorias, quien hace tablas todo el rato aparecería igual que quien pierde todo
el rato.

**Las aperturas se agrupan por ECO, no por nombre.** chess.com y lichess
bautizan la misma apertura de formas distintas, y agrupar por nombre partiría en
dos filas lo que es una sola apertura. Además, del nombre de chess.com se corta
la línea concreta (`…-6.Be3-e5`): sin eso, la tabla tendría una fila por partida.

**La gráfica se adelgaza a 400 puntos como mucho.** Un año de blitz son miles de
partidas; dibujarlas todas tarda y no se lee mejor. Se toma una de cada N
conservando el primer y el último punto, que son los que marcan la tendencia.

---

## Rendimiento y espacio

Al abrir la pantalla se pinta **primero lo que ya está en el dispositivo** y solo
después se va a la red: los números aparecen al instante aunque la descarga
tarde. Si no hay nada guardado, la primera descarga arranca sola.

Lo descargado aparece en **Ajustes → Almacenamiento**, cuenta por cuenta, con su
número de partidas y su tamaño, y se puede borrar desde ahí igual que los
puzzles y los paquetes de campeones. El botón de *borrar todo* también lo
incluye: si no, el total seguiría contándolo y el número mentiría.

Desconectar una cuenta borra sus partidas del dispositivo.

---

## Analítica

Eventos añadidos al [catálogo](./OBSERVABILITY_TRACKING.md):

| Evento | Cuándo | Parámetros |
|--------|--------|------------|
| `game_analytics_opened` | Al abrir la pantalla | `connected`, `games_count` |
| `game_analytics_connected` | Al conectar cuentas | `platforms`, `history_months` |
| `game_analytics_synced` | Tras cada descarga | `platforms`, `months`, `games_count` |
| `game_analytics_filtered` | Al cambiar de plataforma | `platform`, `time_classes` |
| `game_analytics_disconnected` | Al desconectar una cuenta | `platform` |

La pantalla se registra como **Análisis de partidas** en `screen_view`.

---

## Qué queda fuera

Lo mismo que decía la propuesta, salvo el mapa de actividad, que sí entró:

- OAuth y partidas privadas.
- `getPgnAnalysis`: el recorrido jugada a jugada con `chess.js` (jugadas
  promedio, fases de la partida, peón más avanzado). Es la parte cara.
- Comparación entre usuarios.
- Variantes que no son ajedrez estándar.

---

## Archivos

**Libs**

- [`libs/models/src/lib/chess-game.model.ts`](../../libs/models/src/lib/chess-game.model.ts) — modelo común y ayudantes
- [`libs/chess-com-provider/`](../../libs/chess-com-provider/) — cliente y normalización de chess.com
- [`libs/lichess-provider/`](../../libs/lichess-provider/) — cliente y normalización de lichess
- [`libs/game-reporter/`](../../libs/game-reporter/) — archivo local, filtros y reportes

**App**

- [`services/game-analytics.service.ts`](../../apps/chessColate/src/app/services/game-analytics.service.ts) — fachada de la pantalla
- [`services/game-analytics.util.ts`](../../apps/chessColate/src/app/services/game-analytics.util.ts) — lógica pura de la pantalla
- [`pages/analytics/`](../../apps/chessColate/src/app/pages/analytics/) — pantalla y sus tres componentes
