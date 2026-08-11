# Flujo del Reproductor de Partidas

La app trae un **catálogo de partidas de campeones del mundo**. Descargas el
paquete de un jugador y ves sus partidas sobre el tablero, jugada a jugada, con
la velocidad que quieras. Y si le das al botón grande, la app las va pasando
sola: el **modo TV**.

> Este documento describe cómo funciona lo implementado. La idea original
> (planificación) está en
> [`../features/REPRODUCTOR_PARTIDAS.md`](../features/REPRODUCTOR_PARTIDAS.md).

---

## Qué ve el usuario

Tres pantallas, entrando desde **Partidas** en el menú lateral.

**El catálogo** lista los campeones. Arriba, lo que ya está en el dispositivo —
es lo único que funciona sin conexión y es a lo que se vuelve. Debajo, los que
faltan, cada uno diciendo **cuántas partidas trae y cuánto ocupa antes de
descargar**, con la misma honestidad que la pantalla de Almacenamiento. El botón
de descarga se convierte en barra de progreso y luego en flecha de entrar.

**La pantalla del jugador** abre con un botón grande de **Ver en modo TV** —
darle y sentarse es el caso de uso principal. Debajo, para quien quiere elegir,
la lista con búsqueda por rival y filtros de resultado y color.

**El reproductor** tiene el tablero, la lista de jugadas que se desplaza sola,
los cinco controles (inicio, atrás, play, adelante, final), la velocidad, girar
y silenciar. La franja del modo TV — partida anterior y siguiente, aleatorio,
repetir y automático — **solo aparece si se entró por el botón de TV**; si
entraste tocando una partida concreta, esos controles sobran.

Hay además una entrada para **abrir un PGN propio**, pegándolo o eligiendo un
archivo.

## El catálogo vive fuera de la app

Repositorio público
[**chesscolate_pngs_packs**](https://github.com/json-alzate/chesscolate_pngs_packs),
servido por jsDelivr igual que los archivos de puzzles:

```
cdn.jsdelivr.net/gh/json-alzate/chesscolate_pngs_packs@main/
    index.json              ← qué colecciones existen
    players/petrosian.pgn   ← un paquete por jugador
```

**Un paquete por jugador, sin trocear por periodos.** Petrosian son 1,1 MB con
1.893 partidas; el más pesado del catálogo de PGN Mentor rondaría los 5 MB. Eso
es una descarga normal, y trocear obligaría al usuario a decidir qué periodo
quiere antes de ver nada.

**Y en PGN tal cual, sin convertir a JSON.** La app tiene que saber leer PGN de
todas formas para los archivos que trae el usuario, así que con esto hay **un
solo camino de lectura** en vez de dos, y desaparece el paso de conversión.

### Por qué el índice se descarga

Aquí está la diferencia deliberada con los puzzles. Su índice
([`puzzles-manifest.json`](../../libs/puzzles-provider/src/lib/puzzles-manifest.json))
**va compilado dentro de la app**, así que añadir puzzles exige publicar una
versión en la tienda. Aquel catálogo es estático; este está pensado para crecer.

Por eso el índice de partidas se pide al CDN, con esta cadena de respaldos:

```
¿lo guardado tiene menos de 24 h?  ── sí ──▶ se usa (la pantalla abre al instante)
         │ no
         ▼
   pedirlo al CDN  ── ok ──▶ se usa y se guarda
         │ falla
         ▼
   ¿hay algo guardado, aunque sea viejo?  ── sí ──▶ se usa
         │ no
         ▼
   la copia que viaja dentro de la app
```

**Publicar un campeón nuevo es un commit en el repositorio de partidas**: dejar
el `.pgn` en `players/`, añadir nombre y años en `players.meta.json`, ejecutar
`node tools/build-index.mjs` y hacer push. La app no se toca.

La copia de respaldo dentro de la app
([`games-index.fallback.json`](../../libs/games-provider/src/lib/games-index.fallback.json))
existe solo para que el primer arranque sin red no muestre una pantalla vacía.
Se quedará desactualizada, y no pasa nada: en cuanto haya conexión se sustituye.

## Leer el PGN en dos pasos

Es la decisión que más se nota en el uso. Un paquete tiene miles de partidas y
casi ninguna se va a abrir:

| Paso | Qué hace | Cuándo |
|---|---|---|
| **1** | Corta el archivo por partidas y saca **solo las cabeceras** (quién juega, evento, fecha, resultado, jugadas). Trabajo de cadenas, sin ajedrez. | al abrir el paquete |
| **2** | Deriva las **posiciones** de una partida con `chess.js`. | al abrir esa partida |

Medido sobre los archivos reales:

```
petrosian  1.893 partidas   cabeceras: 30 ms   una partida: ~20 ms
anand      4.310 partidas   cabeceras: 74 ms   una partida: ~20 ms
```

Hacer el paso 2 sobre las 4.310 partidas de Anand al abrir la pantalla la
habría congelado varios segundos sin que nadie lo pidiera.

El corte se hace buscando las líneas que empiezan por `[Event `: en un PGN
válido eso solo aparece al principio de una partida.

## Arquitectura

```
games.page.ts        player.page.ts        viewer.page.ts
(catálogo)           (lista y filtros)     (reproductor y TV)
      │                     │                     │
      └─────────────────────┼─────────────────────┘
                            ▼
                     GamesService              ← fachada
                     (paquete abierto,
                      ajustes, pantalla)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       GamesProvider              BoardGamePlayerComponent
   (índice, descarga, caché)      (tablero y reloj)
              │
              ▼
       GamesCacheService (IndexedDB)
```

Mismo principio de fachada que el `AnalyticsService`: **las pantallas no hablan
con el proveedor ni con el plugin de pantalla**. Piden el catálogo, abren un
paquete y piden partidas sueltas.

El **paquete abierto se guarda en memoria** mientras se navega entre la lista y
el reproductor. Volver atrás no vuelve a cortar 4.310 partidas.

### Un componente hermano, no una generalización

El plan original decía "generalizar el motor de
[`BoardPuzzleSolutionComponent`](../../libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts)".
Al abrirlo quedó claro que no: arrastra el juego del puzzle, la validación de
jugadas, la promoción de peones y todo Stockfish. Tocarlo para meter esto ponía
en riesgo el flujo de entrenamiento, que es el corazón de la app.

Así que [`BoardGamePlayerComponent`](../../libs/board/src/lib/board-game-player/board-game-player.component.ts)
es un **hermano**: unas 250 líneas, tablero de **solo mirar** (no llama a
`enableMoveInput`), y dueño del reloj de reproducción. La pantalla pinta los
controles y le habla por métodos.

Explorar variantes sobre una partida es justo lo que hará el
[Analizador de Partidas](../features/ANALIZADOR_PARTIDAS.md); meterlo aquí a
medias habría pisado esa feature.

## Dónde vive el dato

| Dato | Dónde | Por qué |
|---|---|---|
| Paquetes descargados | IndexedDB `ChessColateGamesDB` | Son 1–3 MB de texto: localStorage no da. |
| Índice del catálogo | la misma base, almacén `meta` | Con su fecha, para saber cuándo refrescar. |
| Ajustes de reproducción | `localStorage`, `chessColate_games_playback` | Diminutos, como el resto de ajustes. |

La base es **propia, separada de la de puzzles**. Añadir un almacén a aquella
habría obligado a subir la versión de su esquema y a arriesgar sus datos por una
feature que no tiene nada que ver.

Si no hay IndexedDB, la pantalla sigue funcionando: cada visita vuelve a
descargar. Todas las operaciones de caché son defensivas — guardar partidas es
una comodidad, no puede tumbar la pantalla.

## Detalles que se decidieron mirando datos reales

- **1.242 de las 1.893 partidas de Petrosian no traen ELO** (`[WhiteElo ""]`),
  normal en partidas anteriores a 1970. Se guarda `null` y no se muestra nada,
  en vez de pintar un cero que sería mentira.
- **Quién jugó con cada color se decide por el apellido**: los PGN escriben
  `Petrosian, Tigran V` y el paquete se llama `petrosian`. De ahí salen los
  filtros de color y resultado, y quién es "el rival".
- **El aleatorio se baraja una vez al arrancar el TV**, no en cada salto. Así
  "partida anterior" devuelve a la que se acaba de ver, que es lo que espera
  cualquiera.
- **La lista se pinta de 40 en 40.** Volcar 4.310 filas en el DOM no lo aguanta
  ningún móvil.

## La pantalla encendida

El modo TV es para dejarlo corriendo, así que la pantalla se mantiene despierta
mientras reproduce, con
[`@capacitor-community/keep-awake`](https://github.com/capacitor-community/keep-awake)
(versión 7; la 8 exige Capacitor 8).

Se suelta en los tres sitios: **al pausar**, **al terminar la colección** sin
repetición, y **al salir de la pantalla**. Dejar la pantalla encendida por un
descuido es de las cosas que hacen desinstalar una app.

En web no se hace nada: el plugin no aplica.

## Integración con Almacenamiento

Los paquetes descargados **se listan y se borran** en la pantalla de
Almacenamiento, junto a los puzzles, y entran en el resumen de Ajustes y en el
"borrar todo". Si el resumen los contara pero el borrado no los tocara, el
número mentiría.

También se puede borrar el paquete desde la pantalla del jugador.

## Bordes conocidos

- **Solo la línea principal**: las variantes, los comentarios y los símbolos de
  evaluación se ignoran. Los archivos del catálogo no llevan ninguno.
- **Una partida que no se deje leer** se salta sola en modo TV; abierta a
  propósito, avisa y no rompe la pantalla.
- **Sin red y sin paquete descargado** no hay partidas que ver. El catálogo lo
  dice, y lo ya descargado sigue funcionando.
- **Sin versión por paquete**: si un paquete cambia en el repositorio, quien ya
  lo tenga no se entera. Se decidió no hacerlo porque los paquetes no van a
  variar; el índice deja sitio para añadirlo sin romper nada.
- El **PGN del usuario vive solo en memoria**: al salir de la app se pierde. Las
  listas de reproducción, que son las que lo arreglarían, van en la segunda
  entrega.

## Analítica

Ocho eventos, catalogados en
[OBSERVABILITY_REFERENCIA](./OBSERVABILITY_REFERENCIA.md#6-catálogo-de-eventos-as-built).

El más valioso es **`games_pack_downloaded`**: dice **qué campeones descarga la
gente**, que es exactamente lo que hace falta para saber a quién añadir al
catálogo. Y entre `games_tv_started` y la duración en la pantalla del
reproductor se ve si el modo TV funciona de verdad o si la gente prefiere elegir
partida.

## Archivos

| Archivo | Rol |
|---|---|
| [`libs/games-provider/src/lib/pgn.ts`](../../libs/games-provider/src/lib/pgn.ts) | lectura de PGN en dos pasos |
| [`libs/games-provider/src/lib/games-provider.ts`](../../libs/games-provider/src/lib/games-provider.ts) | índice, descarga con progreso, catálogo |
| [`libs/games-provider/src/lib/games-cache.service.ts`](../../libs/games-provider/src/lib/games-cache.service.ts) | IndexedDB de paquetes e índice |
| [`libs/board/src/lib/board-game-player/`](../../libs/board/src/lib/board-game-player/) | tablero de solo mirar y reloj de reproducción |
| [`services/games.service.ts`](../../apps/chessColate/src/app/services/games.service.ts) | fachada: paquete abierto, ajustes, pantalla encendida |
| [`services/games.util.ts`](../../apps/chessColate/src/app/services/games.util.ts) | lógica pura: filtros, orden del TV, tamaños |
| [`pages/games/`](../../apps/chessColate/src/app/pages/games/) | las tres pantallas |
| `assets/i18n/{es,en}.json` | claves `GAMES.*` |
| **Fuera del repo**: [chesscolate_pngs_packs](https://github.com/json-alzate/chesscolate_pngs_packs) | paquetes, índice y su generador |

## Tests

35 tests sobre lo que tiene lógica de verdad, todo en funciones puras sin
Angular ni plugins:

- **16** del lector de PGN: el corte por partidas, el conteo de jugadas con el
  número pegado (como lo escribe PGN Mentor), los ELO vacíos, las fechas con
  interrogantes, las posiciones derivadas y las partidas sin jugadas.
- **19** de los filtros y el modo TV: quién jugó con cada color, el resultado
  desde el punto de vista del jugador, los filtros combinados, el orden del
  recorrido y el final de la colección con y sin repetición.

## Segunda entrega

- **Listas de reproducción propias** y la lista automática de **"Me gusta"**.
- Sincronización de listas con el perfil cuando hay sesión.
- Ampliar el catálogo según lo que digan las descargas.

Importar partidas de lichess y chess.com **no** entra aquí: se construye en
[Game Analytics](../features/GAME_ANALYTICS.md), que es dueña de esos
conectores, y el reproductor los consumirá después como una fuente más.
