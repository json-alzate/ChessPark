# Transmisión 24/7 a YouTube (Canal de Puzzles Lofi) — Feature Document

## Concepto

Un **canal de YouTube en directo, 24/7, que se emite solo desde el Mac mini**, sin OBS ni nadie al teclado: un tablero que **resuelve puzzles por sí mismo**, rotando cada cierto tiempo el **tema y el rango de ELO**, con **música lofi sin derechos** de fondo y una escena animada que **evoluciona con un ciclo del día** (amanecer → día → atardecer → noche).

Es una pieza de **adquisición y marca**, no de retención dentro de la app: el directo es un escaparate permanente de ChessColate (el canal enlaza a la app). El espectador puede mirar de fondo o **pausar en la cuenta atrás y resolver el puzzle por su cuenta**, que es lo que hace que estos canales enganchen.

> **Idea central:** una **página web de "kiosco"** que se dibuja sola a 1920×1080, más un **runner de Node** que la abre en Chrome headless, captura sus frames, los codifica con `ffmpeg` (aceleración por hardware de Apple Silicon) y los empuja por RTMP a YouTube. La música la mezcla `ffmpeg` desde una carpeta local, no el navegador. Así OBS sobra y no hace falta audio virtual.

---

## Arquitectura

```
┌──────────────────────────┐     ┌────────────────────────────┐     ┌──────────────┐
│ apps/live-stream (Angular)│     │ tools/stream-runner (Node) │     │              │
│  página /  1920×1080      │────►│  Puppeteer + Chrome headless│────►│   ffmpeg     │──RTMP──► YouTube
│  puzzles + escena + HUD   │frames│  supervisor / watchdog     │ raw │ h264_videotoolbox
└──────────────────────────┘     └────────────────────────────┘     │ + AAC (playlist lofi)
          ▲                                                          └──────────────┘
          │ puzzles (CDN + caché IndexedDB)
   libs/puzzles-provider
```

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| **Página** (`apps/live-stream`) | Elegir el puzzle, jugarlo, pintar la escena y el HUD. Un reloj propio, sin interacción. | YouTube, ffmpeg, música |
| **Runner** (`tools/stream-runner`) | Abrir la página, capturar frames, lanzar/vigilar ffmpeg, reiniciar si algo cae. | Qué puzzle se muestra |
| **ffmpeg** | Codificar video (hardware), mezclar la playlist de audio y enviar por RTMP. | La página |

### Dónde vive en el repo

**App Nx aparte (`apps/live-stream`)**, no una ruta de `chessColate`:

- Meterla en `chessColate` añadiría una página muerta al build de las tiendas y arrastraría Ionic, auth y el arranque de Firebase que aquí no pintan nada.
- Reutiliza `@chesspark/board`, `@chesspark/puzzles-provider` y `@chesspark/models` (ver [Integración](#integración-con-la-app)).
- En el Mac mini se sirve el **build estático en local** (sin depender del hosting). Los puzzles siguen saliendo del CDN y quedan en la caché IndexedDB del perfil de Chrome.

---

## La página (producto)

### Ciclo de un puzzle

```
[1 · Presentación]  tema + elo del puzzle (HUD), posición inicial ~2 s
        ↓
[2 · Jugada del rival]  la primera jugada de `moves` (el puzzle de Lichess la trae)
        ↓
[3 · Cuenta atrás "¿lo ves?"]  8–15 s (configurable), con la música de fondo
        ↓
[4 · Solución]  jugadas con ritmo natural (~1,2–2 s por jugada, con resaltado de casillas)
        ↓
[5 · Cierre]  ✔ pausa corta, siguiente puzzle (transición suave)
```

Reglas del reproductor:

- **Reutiliza [`board-game-player`](../../libs/board/src/lib/board-game-player/board-game-player.component.ts)** (`fens[]`, `moveSquares[]`, `msPerMove`), que **no depende de Ionic**: un util puro convierte `Puzzle.fen + moves` en la lista de FENs y casillas con `chess.js`. Se descarta `board-puzzle` y `board-puzzle-solution` — ambos dependen de Ionic, y el segundo es un modal con Stockfish, ayudas y entrada de jugadas que aquí estorban.
- **Puzzles que se rompen:** si el puzzle no carga o `chess.js` rechaza una jugada, se **salta al siguiente** y no se queda colgado. Un directo 24/7 no puede detenerse por un dato malo.
- **Sin repetición reciente:** se guarda en memoria los últimos N `uid` para no repetir en horas.
- **Sonido de jugadas:** fuera por defecto (el audio es solo la playlist lofi).

### Rotación de temas y ELO

Un util puro **`stream-schedule.util.ts`** decide qué toca **a partir de la hora, no de un estado guardado**:

```ts
// idea: bloque = floor(ahora / duraciónBloque) % programa.length
const bloque = programa[Math.floor(nowMs / DURACION_BLOQUE_MS) % programa.length];
// bloque → { tema, eloMin, eloMax, etiqueta }
```

- **Si el runner se reinicia, retoma el bloque correcto** en vez de empezar de cero.
- El programa es **una lista en un archivo de configuración** (tema, rango de ELO, etiqueta visible), fácil de editar sin tocar código.
- Duración del bloque propuesta: **20–30 min**. El HUD muestra *"Próximo tema en 07:42"*.
- Los puzzles de cada bloque salen de `PuzzlesProvider.getPuzzles({ theme, eloMin, eloMax, count })`.

**Idea opcional (recomendada): ligar ELO al ciclo del día.** Mañana = puzzles fáciles, noche = difíciles; un ciclo completo es una **escalera de dificultad** (p. ej. 600 → 2400). Une las dos "rotaciones" en una sola narrativa y da al espectador un motivo para volver a cierta hora. Alternativa: programa plano e independiente del ciclo visual.

### Escena animada: ciclo del día

Un **único reloj de escena** `t ∈ [0,1)` y una tabla de keyframes (amanecer, día, atardecer, noche) que interpola:

| Elemento | Qué cambia con `t` |
|---|---|
| Cielo | Gradiente (variables CSS interpoladas) |
| Sol / luna | Posición a lo largo de un arco; se alternan |
| Estrellas | Opacidad (solo de noche) |
| Nubes | Deriva lenta; color según la hora |
| Ventana / ciudad | Luces que se encienden al atardecer |
| Detalles lofi | Lluvia ocasional (sembrada), gato, planta, vapor de una taza |

Decisiones de diseño:

- **Duración del ciclo:** comprimido a **60–90 min** para que quien entre vea la evolución (a escala real de 24 h no se nota nada). Alternativa: atarlo a la hora local del Mac mini. Por decidir.
- **El rendimiento manda.** Todo el costo de dibujar se paga dos veces (Chrome y luego el encoder), así que: solo `transform`/`opacity` sobre capas propias, **sin `blur`, sin filtros pesados, sin `box-shadow` animados**. Un único `requestAnimationFrame`.
- **Layout fijo 1920×1080:** tablero al centro, escena detrás/alrededor, panel lateral con tema, ELO del puzzle, contador de puzzles y "próximo tema en…". Sin Ionic ni menú, sin cursor.
- Respeta [`STYLE_GUIDE.md`](../STYLE_GUIDE.md) en paleta y tipografía; la escena es un **tema propio**, no el de la app.

---

## El runner (sustituye a OBS)

### Captura

- **Puppeteer** (ya está en `package.json`, `^21.4.1`) abre la página con un perfil persistente (`--user-data-dir`) para conservar la caché IndexedDB de puzzles.
- Los frames salen con **`Page.startScreencast`** (CDP) → JPEG → stdin de ffmpeg.
- **Riesgo conocido:** el screencast de Chrome podría no sostener 30 fps con una animación constante en 1080p. La [Fase 0](#fase-0--prueba-de-concepto) lo midió con una escena sencilla y salió bien; falta confirmarlo con la escena real. Plan B (si la escena real no aguanta): **Electron con offscreen rendering**. La Fase 0 indica que de momento no hace falta.
- Descartado: capturar la pantalla real con `avfoundation`. Exige sesión desbloqueada, permiso de grabación de pantalla y una pantalla "viva"; es frágil para 24/7.

### Codificación y envío

| Parámetro | Valor de partida |
|---|---|
| Resolución / fps | 1280×720 @ 30 (subir a 1080p si el Mac aguanta) |
| Video | `h264_videotoolbox`, ~3 Mbps, keyframe cada 2 s (lo que YouTube pide) |
| Audio | AAC 128 kbps, 44,1 kHz estéreo |
| Destino | `rtmp://a.rtmp.youtube.com/live2/<clave>` |
| Clave de stream | **Clave persistente**, en Keychain o `.env` **fuera del repo** |

> `ffmpeg` **no está instalado** hoy en el Mac mini (`brew install ffmpeg`; comprobar que incluya `videotoolbox`).

### Música

- La mezcla `ffmpeg`: la página va **muda**. No hay que capturar el audio del navegador ni instalar BlackHole.
- Carpeta local de pistas + **playlist barajada**. Como `-f concat` en bucle no baraja, el supervisor **genera una playlist nueva en cada arranque** de ffmpeg.
- **≥ 3 horas de música** distinta para que el bucle no sea evidente; normalizar el volumen (`loudnorm`) al preparar los archivos, no en vivo.
- Se lleva un **`docs/CREDITOS_MUSICA.md`** (pista, autor, fuente, licencia, URL), igual que [`CREDITOS_PIEZAS.md`](../CREDITOS_PIEZAS.md).

### Supervisor / resistencia 24/7

| Fallo | Respuesta |
|---|---|
| ffmpeg termina o RTMP se corta | Reinicio con *backoff* exponencial (YouTube tolera cortes breves con la clave persistente) |
| Los frames dejan de avanzar (página congelada) | Latido de la página (cada puzzle incrementa un contador); si no avanza en X min → recargar |
| Chrome acumula memoria | Recarga programada cada pocas horas (p. ej. 4:00) |
| Se cae el Mac / se va la luz | LaunchAgent que relanza el runner al arrancar la sesión |
| Se suspende el equipo | `pmset`/`caffeinate` + arranque automático tras corte de luz |
| Nadie se entera de que cayó | Aviso (push) tras N reintentos fallidos |

> **Excepción a la regla de `devctl`:** las preferencias globales prohíben LaunchAgents para apps de *desarrollo*. Esto es un servicio de producción que debe sobrevivir a reinicios, así que **sí requeriría un LaunchAgent**. Hay que aprobarlo explícitamente antes de crearlo.

---

## Contenido: licencias y política de YouTube

- **Puzzles:** la base de puzzles de Lichess es **CC0**. Sin atribución obligatoria, aunque conviene citarla en la descripción del canal.
- **Piezas del tablero:** el canal es **monetizable**, lo que cambia el cálculo de [`CREDITOS_PIEZAS.md`](../CREDITOS_PIEZAS.md). Usar solo sets permitidos para uso comercial (cburnett GPL, MIT, Apache, CC0, CC BY con atribución). `staunty` (CC BY-NC-SA) **se retiró de la app**. Los sets que usa el directo (cburnett, celtic, chessnut, rhosgfx) no exigen atribución en la descripción; los créditos de todas las piezas están en la pantalla pública `/settings/credits` de ChessColate.
- **Música:** "libre de derechos" **no evita reclamos de Content ID**. Usar fuentes verificables (YouTube Audio Library, CC0, Pixabay, Free Music Archive) y **guardar la prueba de licencia** de cada pista.
- **Política de contenido repetitivo / reutilizado:** los directos 24/7 en bucle pueden marcarse. Que el contenido cambie constantemente (puzzles distintos, escena evolutiva) ayuda, pero **hay que revisar las reglas vigentes de YouTube** (monetización, límites de archivo de directos, restricciones de 24/7) antes de invertir en el pulido final. *No verificado en este documento.*
- **Marca:** fijar en el directo un enlace/QR a la app (CTA discreta en el HUD).

---

## Integración con la app

### Se reutiliza

- **[`board-game-player`](../../libs/board/src/lib/board-game-player/board-game-player.component.ts)** — reproductor de posiciones (`fens`, `moveSquares`, `msPerMove`, `finished`), sin Ionic.
- **[`puzzles-provider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts)** — `getPuzzles({ elo, eloMin, eloMax, theme, … })` con CDN + caché IndexedDB. No necesita sesión.
- **`@chesspark/models`** — el tipo `Puzzle`.
- **`chess.js`** — para derivar los FENs de `moves`.
- **Temas de puzzle traducidos** — para mostrar el nombre legible del tema en el HUD (a verificar de dónde salen hoy: i18n de `apps/chessColate`).

### Se añade

- **`apps/live-stream`** — app Angular standalone, sin Ionic ni Firebase.
- **`stream-schedule.util.ts`** — programa de bloques → bloque actual (puro, con `.spec.ts`).
- **`puzzle-to-frames.util.ts`** — `Puzzle` → `{ fens, moveSquares }` (puro, con `.spec.ts`).
- **`StreamDirectorService`** — máquina de estados del ciclo de un puzzle (presentación → cuenta atrás → solución → cierre) y del bloque actual.
- **`SceneClock` + componentes de escena** — el reloj `t` y las capas del ciclo del día.
- **`tools/stream-runner`** — Node: Puppeteer, supervisor de ffmpeg, watchdog, generador de playlist.
- **`docs/CREDITOS_MUSICA.md`** y un `docs/implementado/TRANSMISION_24_7_FLOW.md` cuando se implemente.

### Dependencias de `libs/board` a verificar

`board-puzzle` y `board-puzzle-solution` importan `@ionic/*`. `board-game-player` y `board` **no** (revisado al escribir este documento). Hay que confirmar que **importar `@chesspark/board` por su barrel no arrastra Ionic** al bundle de `live-stream`; si lo hace, evaluar separar los componentes sin Ionic.

---

## Fases propuestas

### Fase 0 · Prueba de concepto
**Objetivo: bajar la incertidumbre técnica antes de diseñar nada más.** Página estática con un cielo animado a 1080p, Puppeteer + ffmpeg, directo **no listado** durante 1–2 h.
- Medir CPU/GPU, temperatura, fps reales y frames perdidos en el Mac mini.
- Decidir 720p vs 1080p y si el screencast alcanza o hay que pasar a Electron.
- *Salida:* decisión documentada (captura, resolución, bitrate).

**Resultado (10-oct-2026) — viable.** Prueba en un Apple M1 de 8 GB: página con cielo animado (gradiente, sol/luna, 120 estrellas, nubes, tablero y una pieza en movimiento) a 60 fps, capturada con Puppeteer (`Page.startScreencast`, JPEG) y codificada con `ffmpeg` 9.0.2 (`h264_videotoolbox`, 30 fps) hacia un receptor RTMP local.

| Prueba | Resultado |
|---|---|
| 720p30, 40 s | 1200/1200 frames, velocidad 1,06× |
| 1080p30, 60 s y 45 s | 1800/1800 y 1350/1350 frames, 1,02–1,03× |
| **1080p30, 10 min por RTMP (flv)** | **18 000/18 000 frames, 1×, duración exacta 600,03 s, sin caídas** |
| CPU (Chrome + ffmpeg) | ~90–100 % de un núcleo (de 8) a 1080p; ~60 % a 720p |
| Memoria (Chrome + ffmpeg) | ~1 GB, estable (1042 → 905 MB en 10 min, sin fuga visible) |

Lo que **no** demuestra: el destino fue un receptor local, no YouTube; el audio era un tono de prueba; la escena era sencilla (el bitrate real fue ~1,2 Mbps, una escena con más detalle necesitará los 3–4,5 Mbps); no se usó la página Angular ni el tablero real; la prueba duró 10 min, no horas.

Hallazgos que cambian el plan:
- **El Chrome que trae Puppeteer 21 (Chrome 121) se cae al arrancar en este macOS** (Darwin 25.5). Funciona con el **Google Chrome instalado en el sistema (v154)** vía `executablePath`. Hay que decidir entre usar el Chrome del sistema o actualizar Puppeteer; no hace falta pasar a Electron.
- El screencast entregó ~58 fps con la página a 60: **hay margen**. ffmpeg normaliza a 30 fps con `-use_wallclock_as_timestamps 1` + `fps=30`.
- Para medir bien la CPU hay que sumar **solo** el árbol de procesos del runner; contar todos los "Chrome" incluye el navegador personal y falsea la cifra.
- Queda pendiente repetir con la escena real y un directo **no listado** en YouTube de varias horas.

### Fase 1 · Página con puzzles
`apps/live-stream`, `puzzle-to-frames.util`, `stream-schedule.util`, ciclo de un puzzle y HUD. Probar abriendo la página en un navegador normal, sin runner.

### Fase 2 · Escena del ciclo del día
Reloj de escena, cielo, sol/luna, estrellas, nubes, luces. Perfilar rendimiento (la Fase 0 fija el presupuesto).

### Fase 3 · Música y runner completo
Playlist barajada, mezcla de audio, supervisor, watchdog, recarga programada. Directo no listado de 24 h.

### Fase 4 · Endurecimiento 24/7 y salida a público
LaunchAgent (con aprobación), `pmset`, avisos por push, créditos y descripción del canal, revisión de políticas de YouTube. Pasar el directo a público.

### Fase 5 · Extras (opcionales)
- Votar el siguiente tema desde el **chat de YouTube**.
- Recortes automáticos para **Shorts** (el momento "solución").
- Sonido de jugadas con mezcla en ffmpeg.
- Estadísticas del canal en una pantalla de la app.

---

## Pendientes antes de implementar

- [x] **Fase 0:** el screencast de Chrome headless sostiene 1080p30 estable durante 10 min en un M1 de 8 GB (ver resultado arriba). Falta repetirla con la escena real, contra YouTube y durante horas.
- [ ] Elegir **Chrome del sistema vs. actualizar Puppeteer** (el Chrome 121 de Puppeteer 21 no arranca en este macOS).
- [ ] Modelo y recursos del Mac mini (chip, RAM), y si seguirá usándose para otras cosas mientras transmite.
- [ ] Confirmar que `@chesspark/board` se puede importar sin arrastrar Ionic a `live-stream`.
- [ ] Duración del ciclo del día (60–90 min comprimido vs. hora local real) y si **ELO se liga al ciclo** (escalera de dificultad) o es independiente.
- [ ] Programa de rotación: lista de temas, rangos de ELO y duración de bloque.
- [ ] Tiempo de la cuenta atrás (¿8, 10, 15 s?) y ritmo de las jugadas de la solución.
- [x] **Fuente de música** concreta, cantidad de pistas y registro de licencias: 88 pistas CC BY/CC0 de ccMixter y Wikimedia Commons, en `CREDITOS_MUSICA.md`. La lista pública está en `https://chesscolate.web.app/settings/credits` (hay que **publicar la app** para que esa URL exista antes de salir en vivo).
- [ ] Revisar la **política vigente de YouTube** sobre directos 24/7 y contenido repetitivo, y los límites del archivo de directos.
- [x] Revisar licencias de las **piezas** permitidas para uso comercial: `staunty` retirado de la app; el directo solo usa sets GPL/MIT/Apache/CC0.
- [ ] Dónde y cómo guardar la **clave de stream** (Keychain vs `.env`).
- [ ] Aprobar el **LaunchAgent** para el runner (excepción a la regla de `devctl`) y la configuración de energía del Mac mini.
- [ ] Mecanismo de **aviso** cuando el directo cae (push, correo…).
- [ ] Nombre, identidad visual del canal y **CTA hacia la app**.
- [ ] ¿Se mide el efecto en la app (instalaciones atribuidas al canal, enlace con UTM)?
