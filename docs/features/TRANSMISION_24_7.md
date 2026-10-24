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
| Nadie se entera de que cayó | Aviso **por correo** (ver [Aviso de caída por correo](#aviso-de-caída-por-correo)) |

> **Excepción a la regla de `devctl`:** las preferencias globales prohíben LaunchAgents para apps de *desarrollo*. Esto es un servicio de producción que debe sobrevivir a reinicios, así que **sí requeriría un LaunchAgent**. Hay que aprobarlo explícitamente antes de crearlo.

---

## Prueba en el canal personal

Orden de trabajo para el primer directo real (canal personal, directo **no listado**):

1. **Canal listo:** verificación por teléfono y transmisión en vivo activada (YouTube puede tardar hasta 24 h en habilitarla). Se hace primero porque es lo que más tarda.
2. **Derechos de la música:** hacer antes la [prueba de derechos](#plan-de-derechos-de-la-música) con videos privados; no hace falta esperar al directo.
3. **Crear la transmisión** en YouTube Studio → Transmitir en vivo → Transmisión: visibilidad **No listado**, clave **reutilizable** (para que un reinicio del runner no cree un directo nuevo) y la descripción con `tools/stream-runner/music/DESCRIPCION_MUSICA.txt`.
4. **Clave de transmisión:** nunca en el repo ni en el chat. Para esta primera prueba, por variable de entorno en la terminal (`read -s RTMP_KEY`); el llavero del Mac entra con el LaunchAgent.
5. **Emitir:** compilar y servir la app de producción y lanzar el runner:
   ```bash
   npx nx build live-stream
   npx nx serve-static live-stream --port=4310
   RTMP_URL="rtmp://a.rtmp.youtube.com/live2/$RTMP_KEY" node tools/stream-runner/run-stream.mjs --url=http://localhost:4310/ --target=rtmp
   ```
   (Falta un solo comando que haga las dos cosas: es parte del trabajo del LaunchAgent.)
6. **Qué mirar:** el estado de la transmisión en YouTube Studio (bitrate, fotogramas, advertencias), el audio, los avisos de derechos de autor y la CPU/memoria del Mac. Duración: 2–3 h; después, 24 h seguidas antes de hacerlo público.

## Plan de derechos de la música

**"Sin ningún derecho" no existe en la práctica para música ya publicada.** Incluso CC0 o dominio público puede recibir un reclamo de Content ID (alguien la registró, o el sistema se confunde). Lo único con riesgo casi nulo es música **de la que eres el autor**. Por eso el plan va por capas, de lo más barato a lo más caro:

1. **Prueba de derechos antes de emitir (barata).** `node tools/stream-runner/rights-check.mjs` arma 6 videos privados de menos de 1 h (imagen fija + las 88 pistas, con el audio tal cual sale en el directo); se suben como **privados** y se leen las verificaciones de derechos de autor de YouTube Studio (`--find=<video>:<minuto>` traduce un minuto reclamado a una pista): dice qué pista, en qué minuto y de quién es el reclamo. Se descartan las pistas con reclamo (el manifiesto ya tiene `descartadas.json`).
2. **Directo no listado de horas.** Content ID también actúa en vivo y puede silenciar o cortar el directo. Es la prueba definitiva.
3. **Si aun así hay reclamos o cortes**, reemplazar la música por una de estas, de menor a mayor esfuerzo:
   - **Biblioteca de pago con licencia para directos** (p. ej. Epidemic Sound): cuesta cada mes y hay que confirmar que su licencia cubra un directo 24/7. *No verificado.*
   - **Música generada con IA con licencia comercial** (plan de pago): revisar los términos de uso y que las pistas no se registren en Content ID. *No verificado.*
   - **Música generada por código** en el propio Mac mini (lofi procedural: acordes, batería, ruido de vinilo): sin licencias, sin repetición exacta y con tu autoría. Es lo más caro de construir y no se sabe de antemano si suena bien.
4. **Disputas:** la evidencia de cada licencia ya está guardada en `tools/stream-runner/music/licencias/`.

Un reclamo de Content ID **no es un strike**: los strikes llegan por solicitudes de retiro manuales, y tres strikes cierran el canal. Un reclamo no penaliza el canal, pero sí puede bloquear o silenciar el directo. Por eso la prueba del punto 1 se hace antes de emitir.

## LaunchAgent (arranque automático)

Un **LaunchAgent** es la forma que tiene macOS de decir "cuando esta persona inicie sesión, arranca este programa y, si se cae, vuélvelo a arrancar". Es un archivo `.plist` en `~/Library/LaunchAgents`. Sin él, tras un reinicio o un corte de luz el directo se queda apagado hasta que alguien lo note.

**Requiere aprobación explícita** (excepción a la regla global de no usar LaunchAgents para apps de desarrollo: esto es un servicio de producción). Qué se haría:

- **Carpeta de producción aislada del repo de desarrollo (hecha: `ChessPark-stream`, ver [production/README.md](../../tools/stream-runner/production/README.md)).** El runner se reinicia solo cada 4 h (y en cualquier caída) y en cada reinicio vuelve a leer `music/playlist.json`, los audios, la app de `dist/apps/live-stream` y su propio código. Si eso vive en el repo donde se desarrolla, un `git switch`, un `nx build` o un `npm install` en mal momento deja el directo caído o con una versión a medias. Opciones: (A) un worktree aparte fijado a una etiqueta, con su propio `dist` ya compilado, o (B) una copia mínima y autónoma (runner + app compilada + música). Se actualiza a propósito: compilar la versión nueva, cambiarla y reiniciar en un momento tranquilo. El LaunchAgent apunta a esa carpeta. *Deducido del código, no probado.*
- Compilar o correr pruebas en el mismo Mac mientras emite puede hacer perder fotogramas (8 GB de RAM; el directo usa ~1 núcleo y ~1,5 GB). *No medido.*
- `tools/stream-runner/start-live.mjs` sirve la app compilada y lanza el runner: **un solo comando**. Hecho y ensayado (sin YouTube, con salida HLS).
- La clave de transmisión se lee del **llavero** (`security find-generic-password -w`), nunca del `.plist` ni del repo.
- `KeepAlive` para que macOS lo relance si el runner muere, y registros en `~/Library/Logs/`.
- **Requisito del Mac:** inicio de sesión automático tras un reinicio; si no, el LaunchAgent no se activa hasta que alguien escriba la contraseña. El Mac ya no se suspende y arranca solo tras un corte de luz (`pmset`).
- Comandos para pausarlo o quitarlo (`launchctl bootout`/`bootstrap`), para no depender de recordar el comando.

## Aviso de caída por correo

El runner ya reinicia solo lo que se cae; esto es para enterarte **cuando no pueda**. Diseño propuesto:

- **Vigilante externo con latido:** el Mac manda un "estoy vivo" cada pocos minutos a un servicio externo (p. ej. Healthchecks.io, gratis) que te escribe si el latido deja de llegar. Es lo único que cubre también la caída del Mac entero o de su internet. No necesita contraseñas de correo en el Mac.
- **Qué cuenta como "vivo":** no basta con que el proceso exista; el latido solo se envía si ffmpeg sigue entregando video (contador de frames que avanza). Más adelante se puede comprobar contra la API de YouTube que el directo está recibiendo señal.
- **Anti-spam:** un correo por incidente y otro al recuperarse, con un mínimo de minutos entre avisos.
- **Alternativa sin servicio externo:** enviar el correo desde el propio Mac con SMTP de Gmail y una *contraseña de aplicación* guardada en el llavero. Más simple, pero **no avisa si el Mac entero se cae**.

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
El runner y el supervisor ya existen; lo que falta es probarlos contra YouTube: ver
[Prueba en el canal personal](#prueba-en-el-canal-personal) y [Plan de derechos de la música](#plan-de-derechos-de-la-música).

### Fase 4 · Endurecimiento 24/7 y salida a público
[LaunchAgent](#launchagent-arranque-automático), [aviso de caída por correo](#aviso-de-caída-por-correo), `pmset`, créditos y
descripción del canal (créditos ya hechos), revisión de políticas de YouTube. Pasar el directo a público.
Las dos primeras piezas **no se dejan para el final**: se construyen en cuanto la prueba de la Fase 3 confirme que el envío funciona.

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
- [ ] Aprobar el **LaunchAgent** para el runner (excepción a la regla de `devctl`); la configuración de energía del Mac mini ya está (no se suspende, arranca tras un corte de luz). Falta activar el **inicio de sesión automático**. Ver [LaunchAgent](#launchagent-arranque-automático).
- [ ] **Aviso de caída por correo**: decidir entre servicio externo con latido (recomendado) o SMTP desde el Mac. Ver [Aviso de caída por correo](#aviso-de-caída-por-correo).
- [ ] **Prueba de derechos de la música** con videos privados antes del primer directo. Ver [Plan de derechos de la música](#plan-de-derechos-de-la-música).
- [ ] Verificar el **canal personal** (teléfono + transmisión en vivo) y crear la transmisión no listada con clave reutilizable.
- [ ] Nombre, identidad visual del canal y **CTA hacia la app**.
- [ ] ¿Se mide el efecto en la app (instalaciones atribuidas al canal, enlace con UTM)?
