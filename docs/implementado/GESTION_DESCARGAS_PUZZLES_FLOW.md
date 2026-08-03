# Flujo de la gestión de descargas de puzzles

La app descarga archivos de puzzles del CDN y los guarda en el dispositivo.
Antes esto era **invisible**: el usuario no veía qué tenía guardado, cuánto
ocupaba, ni podía borrarlo. Ahora hay una pantalla que lo lista y permite
vaciarlo.

> Este documento describe cómo funciona lo implementado. La idea original
> (planificación) está en
> [`../features/GESTION_DESCARGAS_PUZZLES.md`](../features/GESTION_DESCARGAS_PUZZLES.md).

---

## Qué ve el usuario

**Ajustes** gana una sección de **Almacenamiento** con el resumen
("124 archivos · 18,3 MB") y un acceso a la pantalla de gestión
(`/settings/storage`), donde los archivos aparecen **agrupados por tema o
apertura** y ordenados de mayor a menor tamaño — quien entra viene a liberar
espacio, así que lo caro va primero.

```
Puzzles descargados
124 archivos · 18,3 MB                [Borrar todo]
─────────────────────────────────────────────────
▸ Mate en 2            31 archivos · 5,4 MB     🗑
▾ Horquilla            12 archivos · 2,1 MB     🗑
    1480–1499 · 200 puzzles · 148 KB            🗑
    1500–1519 · 200 puzzles · 151 KB            🗑
▸ Defensa Siciliana     8 archivos · 1,3 MB     🗑   (Aperturas)
```

Tres niveles de borrado — un archivo, un grupo, todo — cada uno con su
confirmación. **El copy siempre recuerda que no se pierde progreso ni ELO**,
porque es la duda número uno ante un botón de borrar y aquí la respuesta es
honesta: todo lo que se lista es caché. Tras borrar, la lista se refresca sola;
no hay toast, la lista encogiendo es el feedback.

Si no hay nada descargado: *"No tienes puzzles descargados. Se descargan solos
cuando entrenas."* Sin CTA — pre-descargar es otra feature, deliberadamente
fuera de alcance.

**Nunca se muestra una URL.** El usuario ve "Mate en 2 · 1500–1519".

## La unidad: un archivo = un tema × una banda de ELO

No hizo falta cambiar el backend ni el formato de los archivos porque **la URL
del CDN ya codifica tema y rango de ELO**:

```
…/puzzlesFilesThemes/fork/fork_1500_1519.json
                     └tema┘ └tema┘└ rango  ┘
```

De ahí sale [`parsePuzzleUrl()`](../../libs/puzzles-provider/src/lib/utils.ts),
la inversa de `buildPuzzleUrl`. El nombre del tema/apertura se toma de **la
carpeta contenedora**, no del nombre del archivo: los valores de apertura llevan
guiones bajos (`Sicilian_Defense`) y partir el nombre sería ambiguo.

`getCachedUrlsMatchingElo()` ahora también lo usa, con lo que desapareció el
`eloEnd = eloStart + 19` hardcodeado que tenía.

## Dónde vive el dato

Todo está en **IndexedDB** (`ChessParkPuzzlesDB`), envuelto por
[`PuzzlesCacheService`](../../libs/puzzles-provider/src/lib/cache.service.ts):

| Store | Contenido |
|---|---|
| `puzzlesCache` | `{ url, puzzles, timestamp, lastAccessedAt }` — pesado |
| `puzzlesIndex` | `CachedFileIndexEntry` — ligero, es lo que lee la pantalla |
| `infinityPool` | el pool del entrenamiento continuo |

La metadata vive en **el índice**, no en el caché: leer las 124 entradas de
`puzzlesCache` para pintar una lista significaría deserializar ~18 MB de puzzles.

```ts
interface CachedFileIndexEntry {
  key: string;        // URL — misma clave que puzzlesCache
  timestamp: number;  // fecha de descarga
  theme?: string;
  opening?: string;
  eloStart?: number;
  eloEnd?: number;
  count?: number;     // nº de puzzles
  sizeBytes?: number; // tamaño aproximado
}
```

**No se subió `DB_VERSION`**: IndexedDB no impone esquema por registro, así que
añadir campos a los objetos de un store existente no requiere `onupgradeneeded`.
Solo haría falta para crear un índice IDB nuevo, y con ~124 entradas ordenar en
memoria es gratis.

### Cómo se llena la metadata

- **Al descargar**: `cachePuzzles()` escribe tema/apertura, rango, `count` y
  `sizeBytes` junto a la entrada del índice. No cambió su firma — todo se deriva
  de la URL y de los puzzles que ya recibe.
- **En dispositivos que ya tenían caché**: las entradas antiguas no traen
  `count` ni `sizeBytes`. `listCachedFiles()` los completa **de forma perezosa
  la primera vez** (`backfillIndexMetadata`) y los persiste, así que se paga una
  sola vez por archivo. Por eso la pantalla muestra un **skeleton**, no un
  spinner bloqueante.
- Si el backfill falla, la fila se muestra **sin tamaño (`—`)** en vez de dejar
  la lista vacía. Solo se descartan entradas cuando el recorrido completó y se
  sabe con certeza que están huérfanas (en el índice pero no en el caché); esas
  además se limpian del índice.

`sizeBytes` es `JSON.stringify(puzzles).length`: el tamaño del JSON, no lo que
IndexedDB reserva en disco. Se eligió el dato exacto sobre una estimación por
media porque **inventar un número en una pantalla cuyo propósito es la
transparencia sería contradictorio**; se calcula una vez por archivo, en la
escritura fire-and-forget del caché.

## Arquitectura

```
storage.page.ts            (lista, confirmaciones, analytics)
      │
      ▼
PuzzleStorageService       (agrupa, traduce, formatea bytes)   ← fachada
      │
      ▼
PuzzlesCacheService        (IndexedDB)
```

La página **nunca habla con `PuzzlesCacheService`** ni ve una URL, mismo
principio de fachada que el `AnalyticsService`. La fachada resuelve los nombres
traducidos vía `AppService` (`themes-puzzle.json` / `openings.json`) y cae al
valor interno si el catálogo no conoce un tema — mejor un slug que una fila sin
título.

Métodos nuevos en la lib:

```ts
listCachedFiles(): Promise<CachedFileIndexEntry[]>   // + backfill perezoso
deleteCachedFiles(urls: string[]): Promise<void>     // borrar un grupo, 1 transacción
getStorageSummary(): Promise<StorageSummary>         // { files, sizeBytes }
clearInfinityPool(): Promise<void>
```

## Decisiones

| Decisión | Cómo quedó | Por qué |
|---|---|---|
| **"Borrar todo" y el pool de infinity** | Lo vacía también | El pool vive en otro store y `clearCache()` no lo toca. Si no se borrara, "borrar todo" dejaría ~50 puzzles dentro y el total mostrado mentiría. Se reconstruye solo en la siguiente entrada al home. |
| **Aperturas** | Sí, un grupo por apertura | Si no, el total no cuadraría con lo que ocupa de verdad y quedarían archivos imborrables desde la UI. |
| **Tamaño** | Exacto (`JSON.stringify`) | Coherencia con el propósito de la pantalla. |
| **Fecha de descarga por fila** | No | Añade ruido a una fila ya densa. El dato está en `timestamp` si alguien lo pide. |
| **Orden** | Tamaño descendente | El objetivo es liberar espacio. |
| **Entrada** | Ajustes, junto a Idioma y Notificaciones | — |

La sección **no está condicionada a nativo** (a diferencia de Notificaciones):
el caché de IndexedDB existe igual en web/PWA.

## Bordes conocidos

- **Borrar durante un entrenamiento en curso** no rompe la sesión: los puzzles
  del bloque activo ya están en memoria. La reposición del entrenamiento
  continuo volvería a descargar, que es exactamente lo que el usuario pidió.
- **Escritura fire-and-forget**: un archivo recién descargado puede tardar un
  instante en aparecer en la lista. Irrelevante en la práctica — a esta pantalla
  se entra desde Ajustes, no en mitad de una descarga.
- **Sin IndexedDB no hay caché** (el "fallback a localStorage" que promete el
  docstring del servicio nunca existió). En ese caso la pantalla muestra el
  estado vacío, no rompe.
- `sizeBytes` es aproximado y se comunica como tal; no se promete exactitud al
  byte.

## Analítica

Cuatro eventos, catalogados en
[OBSERVABILITY_REFERENCIA](./OBSERVABILITY_REFERENCIA.md#6-catálogo-de-eventos-as-built):
`puzzle_storage_opened`, `puzzle_storage_file_deleted`,
`puzzle_storage_theme_deleted` y `puzzle_storage_cleared`.

El más valioso es **`puzzle_storage_opened`**: es la primera vez que se mide
cuánto caché acumula un usuario real. Si la mediana resulta ser de pocos MB, la
evicción automática (90 días sin uso) ya funciona y esta pantalla es sobre todo
confianza; si hay cola larga en decenas de MB, hay que revisar los umbrales de
`CACHE_STALE_THRESHOLD_MS`.

## Archivos

| Archivo | Rol |
|---|---|
| [`libs/puzzles-provider/src/lib/utils.ts`](../../libs/puzzles-provider/src/lib/utils.ts) | `parsePuzzleUrl`, `estimateSizeBytes` |
| [`libs/puzzles-provider/src/lib/cache.service.ts`](../../libs/puzzles-provider/src/lib/cache.service.ts) | listado, backfill, borrado múltiple, resumen |
| [`libs/puzzles-provider/src/lib/types.ts`](../../libs/puzzles-provider/src/lib/types.ts) | `CachedFileIndexEntry`, `StorageSummary` |
| [`apps/chessColate/src/app/services/puzzle-storage.service.ts`](../../apps/chessColate/src/app/services/puzzle-storage.service.ts) | fachada: agrupar, traducir, formatear |
| [`apps/chessColate/src/app/pages/settings/storage/`](../../apps/chessColate/src/app/pages/settings/storage/) | pantalla de gestión |
| [`apps/chessColate/src/app/pages/settings/settings.page.html`](../../apps/chessColate/src/app/pages/settings/settings.page.html) | sección de Almacenamiento |
| `assets/i18n/{es,en}.json` | claves `SETTINGS.storage` y `STORAGE.*` |

## Fuera de alcance

Pre-descarga / modo offline explícito, límite de caché configurable con LRU, y
tocar los umbrales de expiración (1 año) o de evicción (90 días). Las tres se
deciden mejor **con los datos** que ahora empieza a dar `puzzle_storage_opened`.
