# Herramientas del directo 24/7

Scripts de Node para construir y comprobar el directo (ver `docs/features/TRANSMISION_24_7.md`). Usan
`puppeteer` (ya está en el proyecto) con el **Chrome del sistema** (el que trae Puppeteer 21 no arranca
en este macOS). `ffmpeg` debe estar instalado (`brew install ffmpeg`, con `h264_videotoolbox`).

| Script | Para qué |
|---|---|
| `capture.mjs` | Prueba de captura: abre la página, graba con `Page.startScreencast`, codifica con ffmpeg a MP4 (o RTMP con `--rtmp`) y mide CPU y memoria del árbol de procesos. Es la semilla del runner. |
| `check-ladder.mjs` | Comprueba en la página real que el ELO **sube en cada puzzle**, sin estancarse ni dar saltos, y que se reinicia al llegar al tope. `--start-elo=1900` prueba los extremos difíciles. |
| `check-page-qr.mjs` | Lee el QR del panel desde los píxeles de la pantalla y comprueba que lleva a la web de ChessColate. |
| `verify-qr.mjs` | Verifica a fondo el codificador de QR (referencia + decodificador independiente). Úsalo si tocas `qr-code.ts`. |
| `prepare-music.mjs` | Normaliza la música (EBU R128 a -18 LUFS, dos pasadas, limitador de pico a -1,5 dBTP) a `music/normalized/` y escribe `music/playlist.json`. Idempotente; `--force` rehace todo. |
| `music-credits.mjs` | Genera `docs/CREDITOS_MUSICA.md` y el bloque de atribución para la descripción del directo. |
| `music-sample.mjs` | Arma una muestra de 25 s por autor para **escuchar** la música antes de salir en vivo. |
| `check-smoothness.mjs` | Mide si la **tubería de captura** entrega el movimiento parejo: graba cuadrados a velocidad constante con la misma tubería del runner y cuenta los frames que no avanzan o avanzan el doble. Úsalo si cambias algo de la captura o de ffmpeg. |
| `run-stream.mjs` | **El runner.** Chrome captura la app, ffmpeg le mezcla la música y emite por HLS (vista previa) o RTMP (YouTube). Se vigila solo: reinicia si cae ffmpeg o Chrome, o si la página deja de enviar frames. |
| `local-preview.mjs` | **Vista previa local:** sirve la app, arranca el runner y sirve una página con un reproductor, la descripción y datos técnicos, para ver cómo se vería en YouTube sin salir a YouTube. |

Los assets de pixel art de la escena se generan con `tools/stream-assets/`.

## Música (`music/`)

- `manifest.json`: las 88 pistas aceptadas, con su licencia y la URL de la página donde se verificó.
- `licencias/`: la página de cada pista guardada como **evidencia de la licencia** (6 MB, **sí se versiona**).
- `source/` y `normalized/`: los audios (~1 GB, **no se versionan**). `normalized/` sale de `source/` con `prepare-music.mjs`; `source/` se vuelve a bajar siguiendo `sourcing/`.
- `descartadas.json`: lo que se rechazó y por qué. `optional/`: pistas de Kevin MacLeod, aparte por su riesgo de Content ID.

**Haz copia de seguridad de `music/source/`**: re-descargarlo depende de que ccMixter siga con las mismas pistas.

Los tres `check-*`/`verify-*` fallan con código de salida distinto de 0 si algo no cumple, así que se
pueden usar en CI o antes de un directo de varias horas.

## Parámetros de la página para probar sin esperar

`apps/live-stream` acepta en la URL (todos opcionales): `countdown`, `present`, `opponent`, `move`,
`close` (tiempos del ciclo de un puzzle), `block` (duración de un tema), `ladder` (duración de la
escalera de ELO), `startElo` (coloca la escalera en un ELO), `day` (duración del ciclo día/noche),
`rotate` (cada cuánto rota tablero y piezas), `renderer=css|none`, y `pieces`/`board` (fijan una
apariencia). Ejemplo: `?countdown=2&move=400&block=20000&ladder=300000&startElo=1900`.

## Vista previa local (cómo se vería en YouTube)

```bash
npx nx build live-stream                                   # la app de producción
node tools/stream-runner/local-preview.mjs --port=4303     # → http://localhost:4303
```

O con `devctl`, que además la publica por Tailscale con HTTPS: `devctl up stream-preview` /
`devctl down stream-preview` / `devctl logs stream-preview`.

Mientras corre, consume ~0,7 núcleos y ~1,5 GB (Chrome a 1080p30 + ffmpeg). El retardo del reproductor es de
unos 8 s respecto al "directo" (normal en HLS). **Apágala cuando no la uses.**

### Emitir a YouTube (RTMP)

```bash
RTMP_URL='rtmp://a.rtmp.youtube.com/live2/<CLAVE>' node tools/stream-runner/run-stream.mjs \
  --url=http://127.0.0.1:4310/ --target=rtmp
```

La clave va **solo** por la variable de entorno (nunca como argumento: se vería en `ps` y en los registros, ni
dentro del repo). La salida cumple lo que pide YouTube: H.264 High `yuv420p`, 30 fps constantes, un keyframe cada
2 s, AAC-LC estéreo a 44,1 kHz. **El envío por RTMP no se ha probado contra YouTube**; lo verificado es el formato
y la recuperación con el destino HLS local. Antes de publicar, hacer un directo *no listado* (Fase 3 del doc).

### Qué se probó (y qué no)

Verificado: formato de salida con `ffprobe` (1920×1080, keyframe cada 2 s, primer frame de cada segmento es clave),
sonoridad de la mezcla (-17,8 LUFS), reproducción en navegador, y recuperación **con un espectador conectado** tras
matar ffmpeg (≈8 s) o Chrome (≈18 s). Sin verificar: emisión real a YouTube, corridas de horas, apagón y arranque
automático (LaunchAgent, Fase 4).

### Fluidez: por qué hay un marcapasos de frames

Chrome entrega los frames con un ritmo muy parejo (16,7 ms a 60 fps, ±1 ms), pero si se le pasan a ffmpeg con la hora a
la que los lee del tubo (`-use_wallclock_as_timestamps`), esa lectura sale en ráfagas y el movimiento se ve a tirones:
con un cuadrado a velocidad constante, el 22 % de los frames no avanzaba y el 17 % avanzaba el doble. `lib/frame-pacer.mjs`
escribe un frame exacto cada 1/30 s (el que Chrome produjo más cerca de ese instante) y ffmpeg recibe cadencia fija. Resultado
medido con `check-smoothness.mjs`: 0,0–0,3 % de tirones. Capturar a 60 fps de origen (`--nth=1`) da algo más de suavidad pero
cuesta ~0,3 núcleos más (1,06 frente a 0,77); por defecto es `--nth=2`.

(`capture.mjs` conserva la tubería antigua y solo sirve para medir consumo, no fluidez.)

### Pruebas

`node --test tools/stream-runner/*.test.mjs` ejecuta las pruebas de las partes puras (mezcla, argumentos de ffmpeg,
reintentos, cierre de Chrome, servidor estático).
