# Gestión de Descargas de Puzzles — Feature Document

## Concepto

Hoy ChessColate descarga archivos de puzzles desde el CDN y los guarda en el dispositivo **de forma completamente invisible**: el usuario nunca ve qué tiene almacenado, cuánto ocupa, ni puede borrarlo. El caché crece silenciosamente sesión tras sesión y la única limpieza es automática (expiración a 1 año, evicción a los 90 días sin uso).

Esta feature añade una **sección de Almacenamiento** donde el usuario ve **la lista de archivos de puzzles descargados localmente**, cada uno con su **tema** y su **rango de ELO**, cuánto ocupa y cuándo se descargó — y puede **borrarlos**: uno a uno, por tema, o todo de golpe.

El principio de fondo es de **transparencia y control**: en móvil el espacio es un recurso del usuario, no de la app. Una app que acumula decenas de MB sin decirlo ni ofrecer una forma de vaciarlo es una app que el usuario termina desinstalando cuando el sistema le muestra "ChessColate: 87 MB". Mejor que lo vea y lo gestione dentro de la app.

Punto clave que hace esta feature **de bajo riesgo**: los archivos son **caché puro, no datos del usuario**. Borrar uno no pierde progreso, ELO, planes ni historial — solo obliga a re-descargarlo del CDN la próxima vez que se necesite. Es una operación segura por diseño, y el copy debe transmitirlo.

---

## Objetivos

- Dar **visibilidad** sobre el espacio que ocupan los puzzles descargados (total y por archivo).
- Permitir **liberar espacio** sin desinstalar la app ni ir a los ajustes del sistema.
- Hacerlo **legible para un humano**: no mostrar URLs del CDN, sino "Horquilla · 1500–1519 · 200 puzzles · 148 KB".
- **No romper nada**: el borrado nunca debe dejar la app en un estado inconsistente (pool de infinity, entrenamiento en curso).
- De paso, **cerrar un hueco de observabilidad**: hoy no sabemos cuánto caché acumula un usuario real.

---

## Qué es un "archivo de puzzles"

La unidad de descarga **ya existe** y está bien definida: **un archivo JSON = un tema × una banda de ELO de 20 puntos**.

La URL del CDN **ya codifica tema y rango de ELO**, que es lo que hace esta feature viable sin cambiar el backend ni el formato de los archivos ([`utils.ts:41-65`](../../libs/puzzles-provider/src/lib/utils.ts#L41-L65)):

```
https://cdn.jsdelivr.net/gh/json-alzate/chesscolate-puzzles-files-themes-a-h@main/puzzlesFilesThemes/fork/fork_1500_1519.json
                                          └── repo shard por 1ª letra ──┘              └theme┘ └theme┘└elo range┘
```

```ts
// utils.ts
export function getEloRange(elo: number): string {
  const start = Math.floor(elo / ELO_CONSTANTS.ELO_STEP) * ELO_CONSTANTS.ELO_STEP;
  const end = start + (ELO_CONSTANTS.ELO_STEP - 1);
  return `${start}_${end}`;               // 1500 -> "1500_1519"
}
```

| Concepto | Valor |
|----------|-------|
| Temas | **53** ([`AVAILABLE_THEMES`](../../libs/puzzles-provider/src/lib/constants.ts#L4-L58)) |
| Aperturas | **63** ([`AVAILABLE_OPENINGS`](../../libs/puzzles-provider/src/lib/constants.ts#L63-L127)) |
| Rango de ELO | 400 – 2800, paso de 20 → **121 bandas** ([`ELO_CONSTANTS`](../../libs/puzzles-provider/src/lib/constants.ts#L132-L137)) |
| Combinaciones reales | **13 716** tema×elo (según [`puzzles-manifest.json`](../../libs/puzzles-provider/src/lib/puzzles-manifest.json)) |

> Un **`Block`** ([`block.model.ts`](../../libs/models/src/lib/block.model.ts)) es un concepto de _entrenamiento_, **no** una unidad de descarga: un bloque puede disparar N descargas de archivos a lo largo de una secuencia de ELOs. La UI de esta feature habla de **archivos**, no de bloques.

---

## Estado actual (qué ya existe y qué falta)

Todo el almacenamiento vive en **IndexedDB**, envuelto por [`PuzzlesCacheService`](../../libs/puzzles-provider/src/lib/cache.service.ts). No hay Capacitor Filesystem, ni Preferences, ni SQLite.

```ts
// cache.service.ts:9-13
private readonly DB_NAME = 'ChessParkPuzzlesDB';
private readonly DB_VERSION = 3;
private readonly STORE_NAME = 'puzzlesCache';       // keyPath: 'url'  → { url, puzzles, timestamp, lastAccessedAt }
private readonly INDEX_STORE_NAME = 'puzzlesIndex'; // keyPath: 'key'  → { key: url, timestamp }
private readonly POOL_STORE_NAME = 'infinityPool';  // keyPath: 'id'
```

### ✅ Ya está

- **Borrado individual**: `deleteCachedPuzzles(url)` ([`cache.service.ts:198`](../../libs/puzzles-provider/src/lib/cache.service.ts#L198)).
- **Borrado total**: `clearCache()` ([`cache.service.ts:221`](../../libs/puzzles-provider/src/lib/cache.service.ts#L221)), expuesto en `PuzzlesProvider.clearCache()`.
- **Listado de claves + parseo de ELO desde la URL**: `getCachedUrlsMatchingElo()` ([`cache.service.ts:395-442`](../../libs/puzzles-provider/src/lib/cache.service.ts#L395-L442)) ya hace exactamente el truco que esta UI necesita generalizar.
- **Fecha de descarga y de último acceso**: `timestamp` y `lastAccessedAt` en `CacheEntry`.
- **Acceso al servicio sin DI nueva**: `puzzlesProvider.getCacheService()` — patrón ya usado por [`infinity-puzzle-pool.service.ts:21-23`](../../apps/chessColate/src/app/services/infinity-puzzle-pool.service.ts#L21-L23).
- **Limpieza automática**: expiración a 1 año + `evictStaleEntries()` a los 90 días sin acceso, disparada fire-and-forget en `init()`.

### ❌ Falta

| Hueco | Detalle |
|-------|---------|
| **No hay `listAll()`** | Nada devuelve la lista de entradas con metadata. Lo más cercano es `getCachedUrlsMatchingElo`, que filtra por ELO. |
| **No hay tamaño en bytes** | Las entradas son objetos estructurados (no blobs/strings) → IndexedDB no reporta bytes. ⚠️ `getCacheSize()` ([`cache.service.ts:244`](../../libs/puzzles-provider/src/lib/cache.service.ts#L244)) **devuelve un conteo de entradas, no bytes**, pese a su nombre y su docstring. |
| **`puzzlesIndex` es anémico** | Solo `{ key: url, timestamp }` ([`cache.service.ts:181`](../../libs/puzzles-provider/src/lib/cache.service.ts#L181)). Sin tema, sin elo, sin count, sin bytes. |
| **No hay UI de almacenamiento** | [`settings.page.html`](../../apps/chessColate/src/app/pages/settings/settings.page.html) solo tiene Idioma y Notificaciones (+ Apariencia comentada). |
| **`clearCache()` nunca se llama** | Existe en la lib pero ningún código de app lo invoca — solo el spec. |

---

## Flujo de usuario

```
Ajustes
   │
   ├── Idioma
   ├── Notificaciones
   └── 💾 Almacenamiento            ← NUEVO
          "124 archivos · 18,3 MB"
          [Gestionar descargas ›]
                  │
                  ▼
       ┌──────────────────────────────────────────┐
       │  Puzzles descargados                     │
       │  124 archivos · 18,3 MB    [Borrar todo] │
       ├──────────────────────────────────────────┤
       │ ▸ Horquilla        12 archivos · 2,1 MB 🗑│
       │ ▾ Mate en 2        31 archivos · 5,4 MB 🗑│
       │     1480–1499 · 200 puzzles · 148 KB    🗑│
       │     1500–1519 · 200 puzzles · 151 KB    🗑│
       │     1520–1539 · 187 puzzles · 140 KB    🗑│
       │ ▸ Clavada           8 archivos · 1,3 MB 🗑│
       │ ▸ Final de peones   4 archivos · 0,6 MB 🗑│
       └──────────────────────────────────────────┘
```

### Detalle de la lista

- **Agrupada por tema**, en un accordion (`collapse` de DaisyUI). 124 archivos planos serían ilegibles; agrupados son ~15 filas.
- **Nombre del tema traducido**, no el slug: `fork` → "Horquilla" / "Fork". Viene de [`themes-puzzle.json`](../../apps/chessColate/src/assets/data/themes-puzzle.json) (`nameEs`/`nameEn`), ya cargado por `AppService.loadThemesPuzzle()` ([`app.service.ts:70-71`](../../apps/chessColate/src/app/services/app.service.ts#L70-L71)). Las **aperturas** salen de [`openings.json`](../../apps/chessColate/src/assets/data/openings.json).
- **Orden por defecto: tamaño descendente** — el usuario que entra aquí viene a liberar espacio, así que lo caro va primero.
- **Rango de ELO** con guión en la fila hoja: `1500–1519`.
- **Fecha**: en formato relativo ("hace 3 días") a partir de `timestamp`. Opcional en la primera versión.

### Borrado

Tres niveles, todos con confirmación (`ion-alert` o `dialog` de DaisyUI):

| Acción | Copy de confirmación |
|--------|----------------------|
| Un archivo | "¿Borrar Mate en 2 · 1500–1519? Se volverá a descargar cuando lo necesites." |
| Un tema | "¿Borrar los 31 archivos de Mate en 2 (5,4 MB)?" |
| Todo | "¿Borrar los 124 archivos descargados (18,3 MB)? No pierdes tu progreso ni tu ELO." |

> El copy **siempre** aclara que no se pierde progreso. Es la duda número uno del usuario ante un botón de borrar, y aquí la respuesta es honesta: es caché.

Tras borrar, la lista se refresca y el total se recalcula. Sin toast intrusivo: la propia lista encogiendo es el feedback.

### Estado vacío

Si no hay nada descargado (usuario nuevo, o acaba de borrar todo): "No tienes puzzles descargados. Se descargan solos cuando entrenas." Sin CTA — no queremos que nadie "pre-descargue" nada, eso es otra feature (ver Fuera de alcance).

---

## Modelo de datos

### Enriquecer `puzzlesIndex` (no `puzzlesCache`)

La metadata va en el **índice**, que es pequeño y se puede leer entero sin traer los puzzles a memoria. Leer 124 entradas de `puzzlesCache` para listarlas significaría deserializar ~18 MB de puzzles solo para pintar una lista — inaceptable.

```ts
/** Entrada del índice de archivos cacheados (enriquecida) */
export interface CachedFileIndexEntry {
  key: string;          // URL — misma clave que puzzlesCache
  timestamp: number;    // fecha de descarga (ya existía)
  theme?: string;       // 'fork' | undefined si es apertura
  opening?: string;     // 'Sicilian_Defense' | undefined si es tema
  eloStart?: number;    // 1500
  eloEnd?: number;      // 1519
  count?: number;       // nº de puzzles en el archivo
  sizeBytes?: number;   // tamaño aproximado
}
```

Todos los campos nuevos son **opcionales a propósito**: las entradas ya escritas en dispositivos existentes no los tienen.

> **No hace falta subir `DB_VERSION`.** IndexedDB no impone esquema por registro: añadir campos a los objetos de un store existente no requiere `onupgradeneeded`. Solo habría que subir la versión (3 → 4) si quisiéramos crear un **índice IDB** nuevo (p. ej. para ordenar por `sizeBytes` en el motor). No lo necesitamos: con ~124 entradas, ordenar en memoria es gratis.

### Backfill de entradas antiguas

Las entradas escritas antes de esta feature no tienen `sizeBytes` ni `count`. Estrategia **perezosa, en el primer listado**:

1. `listCachedFiles()` lee `puzzlesIndex`.
2. `theme`/`opening`/`eloStart`/`eloEnd` → siempre derivables **parseando la URL**, sin tocar `puzzlesCache`. Gratis.
3. `count`/`sizeBytes` → si faltan, se calculan leyendo esa entrada de `puzzlesCache` y se **persisten** en el índice. Se paga una vez por archivo.
4. Si el backfill falla o es muy lento, la fila se muestra **sin tamaño** (`—`) en vez de bloquear la lista.

### Escritura de la metadata

Se calcula en `cachePuzzles()` ([`cache.service.ts:162-193`](../../libs/puzzles-provider/src/lib/cache.service.ts#L162-L193)), que ya recibe `url` y `puzzles` — **no hace falta cambiar su firma**, el tema y el ELO se parsean de la URL:

```ts
const meta = parsePuzzleUrl(url);   // nuevo util
indexStore.put({
  key: url,
  timestamp: entry.timestamp,
  theme: meta?.theme,
  opening: meta?.opening,
  eloStart: meta?.eloStart,
  eloEnd: meta?.eloEnd,
  count: puzzles.length,
  sizeBytes: estimateSizeBytes(puzzles),
});
```

**Sobre `sizeBytes`**: `JSON.stringify(puzzles).length` es exacto-ish (≈ bytes UTF-8 para contenido ASCII, que es el caso: FEN, SAN, uids) pero cuesta un recorrido completo. Como `cachePuzzles` es **fire-and-forget** ([`puzzles-provider.ts:196`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts#L196)) y ocurre una vez por archivo, es aceptable. Alternativa más barata si molesta en gama baja: estimar `puzzles.length × BYTES_PER_PUZZLE_AVG`. Es una **decisión a alinear** (ver abajo).

---

## Cambios en `PuzzlesCacheService`

Tres métodos nuevos, todos en [`cache.service.ts`](../../libs/puzzles-provider/src/lib/cache.service.ts):

```ts
/** Lista todos los archivos cacheados con su metadata, para la UI de almacenamiento. */
async listCachedFiles(): Promise<CachedFileIndexEntry[]>

/** Borra varios archivos en una sola transacción (borrar un tema entero). */
async deleteCachedFiles(urls: string[]): Promise<void>

/** Totales agregados: nº de archivos y bytes. */
async getStorageSummary(): Promise<{ files: number; sizeBytes: number }>
```

`deleteCachedPuzzles(url)` y `clearCache()` ya sirven tal cual para el borrado individual y el total.

### Nuevo util: `parsePuzzleUrl`

La inversa de `buildPuzzleUrl`, en [`utils.ts`](../../libs/puzzles-provider/src/lib/utils.ts):

```ts
export interface ParsedPuzzleUrl {
  theme?: string;
  opening?: string;
  eloStart: number;
  eloEnd: number;
}

export function parsePuzzleUrl(url: string): ParsedPuzzleUrl | null
```

> **Aprovechar para centralizar**: `getCachedUrlsMatchingElo` ([`cache.service.ts:429-436`](../../libs/puzzles-provider/src/lib/cache.service.ts#L429-L436)) hoy hace su propio regex con **`eloEnd = eloStart + 19` hardcodeado** en vez de derivar de `ELO_CONSTANTS.ELO_STEP - 1`. Al introducir `parsePuzzleUrl` conviene que ese método lo reutilice y el `19` desaparezca. Es deuda técnica que esta feature puede saldar de paso.

---

## UI — dónde vive

### Entrada en Ajustes

Una tercera `<section>` en [`settings.page.html`](../../apps/chessColate/src/app/pages/settings/settings.page.html), siguiendo el patrón exacto de las existentes (icono + `text-lg font-bold` + tarjeta `bg-base-200/40 border border-base-content/10 rounded-box`):

```html
<!-- Almacenamiento -->
<section class="mb-8">
  <div class="flex items-center gap-2 mb-3 opacity-80">
    <ion-icon name="server-outline" class="text-xl"></ion-icon>
    <h2 class="text-lg font-bold">{{ 'SETTINGS.storage' | transloco }}</h2>
  </div>
  <!-- resumen + botón a la página de gestión -->
</section>
```

A diferencia de Notificaciones, **no** va condicionada a `isNativePlatform`: el caché IndexedDB existe también en web/PWA y ahí el listado es igual de válido.

### Página de gestión

Página nueva **standalone** en `apps/chessColate/src/app/pages/settings/storage/`, ruta `/settings/storage`. Va en página aparte y no inline en Ajustes porque la lista es larga, tiene accordion y estado de carga propio.

Sigue las convenciones ya establecidas en `settings.page.ts`: `inject()`, `addIcons({...})`, imports `[CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarComponent]`, y ojo con el `data-theme="halloween"` hardcodeado en el wrapper ([`settings.page.html:2`](../../apps/chessColate/src/app/pages/settings/settings.page.html#L2)).

### Servicio de fachada

`PuzzleStorageService` en `apps/chessColate/src/app/services/`, para que el componente no hable con `PuzzlesCacheService` directo (mismo principio de fachada que [`AnalyticsService`](../implementado/OBSERVABILITY_REFERENCIA.md)). Responsabilidades: agrupar por tema, resolver nombres traducidos vía `AppService`, formatear bytes, y emitir los eventos de analytics.

```ts
@Injectable({ providedIn: 'root' })
export class PuzzleStorageService {
  private get cacheService() {
    return this.puzzlesProvider.getCacheService();
  }

  async getGroups(): Promise<StorageThemeGroup[]> { /* listCachedFiles + group + i18n */ }
  async deleteFile(url: string): Promise<void> { }
  async deleteTheme(theme: string): Promise<void> { }
  async deleteAll(): Promise<void> { }
}
```

---

## i18n

Siguiendo el precedente de Notificaciones (que deja el título de sección en `SETTINGS.notifications` y todo el detalle en una sección hermana `TRAINING_REMINDER`):

```jsonc
// SETTINGS gana una clave
"SETTINGS": { "title": "...", "language": "...", "appearance": "...", "notifications": "...",
              "storage": "Almacenamiento" },

// y se añade una sección top-level nueva
"STORAGE": {
  "title": "Puzzles descargados",
  "summary": "{{files}} archivos · {{size}}",
  "manage": "Gestionar descargas",
  "empty": "No tienes puzzles descargados. Se descargan solos cuando entrenas.",
  "filesCount": "{{count}} archivos",
  "puzzlesCount": "{{count}} puzzles",
  "deleteAll": "Borrar todo",
  "confirm": {
    "fileTitle": "¿Borrar este archivo?",
    "fileMessage": "{{theme}} · {{eloRange}}. Se volverá a descargar cuando lo necesites.",
    "themeTitle": "¿Borrar {{theme}}?",
    "themeMessage": "{{files}} archivos ({{size}}). Se volverán a descargar cuando los necesites.",
    "allTitle": "¿Borrar todo?",
    "allMessage": "{{files}} archivos ({{size}}). No pierdes tu progreso ni tu ELO."
  }
}
```

Ambos ficheros: [`es.json`](../../apps/chessColate/src/assets/i18n/es.json) y [`en.json`](../../apps/chessColate/src/assets/i18n/en.json). Convención del repo: **`SCREAMING_SNAKE` top-level → `camelCase` anidado**, interpolación `{{x}}` con `| transloco: { x: valor }`. Las etiquetas genéricas de botón (Cancelar/Borrar) probablemente ya viven en `COMMON.actions` — reutilizar antes que duplicar.

---

## Instrumentación (analytics)

Sobre el [`AnalyticsService`](../implementado/OBSERVABILITY_REFERENCIA.md) ya existente, siguiendo el catálogo de [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md):

| Evento | Cuándo | Params |
|--------|--------|--------|
| `puzzle_storage_opened` | usuario abre la página de gestión | `files_count`, `size_mb` |
| `puzzle_storage_file_deleted` | borra un archivo | `theme`, `elo_start` |
| `puzzle_storage_theme_deleted` | borra un tema entero | `theme`, `files_count`, `size_mb` |
| `puzzle_storage_cleared` | borra todo | `files_count`, `size_mb` |

`puzzle_storage_opened` es el más valioso de los cuatro: es **la primera vez que vamos a saber cuánto caché acumulan los usuarios reales**. Si la mediana resulta ser 3 MB, la evicción automática ya funciona y esta UI es cosmética; si hay una cola larga en 80 MB, hay que revisar los umbrales de `CACHE_STALE_THRESHOLD_MS`.

---

## Consideraciones UX

- **Nunca mostrar URLs.** El usuario ve "Mate en 2 · 1500–1519", no `cdn.jsdelivr.net/gh/...`.
- **Borrar es seguro y hay que decirlo.** Todo el copy de confirmación recuerda que no se pierde progreso.
- **No prometer offline.** Esta pantalla lista caché, no una biblioteca offline gestionada. Si el usuario borra todo antes de un vuelo, se queda sin puzzles — pero tampoco tenía garantía de lo contrario. No inventar promesas que el sistema no cumple.
- **Formato de bytes localizado**: `18,3 MB` en es / `18.3 MB` en en.
- **Sin barra de cuota del sistema.** `navigator.storage.estimate()` daría un "X de Y GB" pero mezcla todos los orígenes y en WebView de Capacitor es poco fiable. Mejor un total honesto y propio.
- **La lista puede tardar** la primera vez (backfill): skeleton, no spinner bloqueante.

---

## Riesgos y bordes

| Riesgo | Mitigación |
|--------|------------|
| **Borrar durante un entrenamiento en curso** | Los puzzles del bloque activo ya están en memoria (`block.puzzles`), así que la sesión no se rompe. Aun así, la reposición de infinity re-descargaría. Aceptable; no bloquear la UI por esto. |
| **El pool de infinity no es un "archivo"** | Vive en el store `infinityPool`, aparte de `puzzlesCache`. `clearCache()` **no lo toca** hoy. Decidir si "Borrar todo" debe vaciarlo también (ver decisiones). |
| **Escrituras fire-and-forget** | `cachePuzzles` no se espera ([`puzzles-provider.ts:196`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts#L196)): un archivo recién descargado puede no aparecer en la lista inmediatamente. Irrelevante en la práctica (la pantalla se abre desde Ajustes, no durante la descarga). |
| **`sizeBytes` es aproximado** | Es el tamaño del JSON, no lo que IndexedDB ocupa en disco (que añade overhead del structured clone). Comunicar como aproximado; no prometer exactitud al byte. |
| **Sin IndexedDB no hay caché** | El "fallback a localStorage" que promete el docstring de [`cache.service.ts:6`](../../libs/puzzles-provider/src/lib/cache.service.ts#L6) **no existe**: si no hay IndexedDB, el caché se desactiva. En ese caso la sección debe mostrar el estado vacío, no romper. |

---

## Alcance inicial (MVP)

1. `parsePuzzleUrl()` en `utils.ts` (+ refactor de `getCachedUrlsMatchingElo` para reutilizarlo y matar el `19` hardcodeado).
2. Metadata enriquecida en `puzzlesIndex` al escribir (`cachePuzzles`) + backfill perezoso al listar.
3. `listCachedFiles()`, `deleteCachedFiles(urls)`, `getStorageSummary()` en `PuzzlesCacheService`.
4. `PuzzleStorageService` (fachada: agrupar, traducir, formatear).
5. Sección "Almacenamiento" en Ajustes con resumen + acceso.
6. Página `/settings/storage`: lista agrupada por tema, borrado ×3 niveles con confirmación, estado vacío.
7. Claves i18n en `es.json` / `en.json`.
8. Los 4 eventos de analytics.

## Fuera de alcance inicial

- **Pre-descarga / modo offline explícito** ("descargar el tema X para el avión"). Es una feature distinta y más ambiciosa; esta solo _expone_ lo que ya se descarga solo.
- **Límite de caché configurable** por el usuario (p. ej. "máximo 50 MB" con LRU). Antes de diseñarlo, mirar los datos de `puzzle_storage_opened`.
- **Ajustar `CACHE_STALE_THRESHOLD_MS`** (90 días) o `CACHE_EXPIRATION_MS` (1 año). Misma razón: decidir con datos.
- **Renombrar `getCacheSize()`** → devuelve un conteo, no bytes. Es deuda técnica real ([`DEUDA_TECNICA.md`](../DEUDA_TECNICA.md)) pero no bloquea; con `getStorageSummary()` nuevo, `getCacheSize()` queda huérfano y se puede limpiar aparte.
- Listado de las **aperturas** si se decide dejarlas fuera de la V1 (ver decisiones).

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar** los detalles de diseño/producto:

1. **¿"Borrar todo" vacía también el pool de infinity?** Técnicamente es otro store. A favor: el usuario espera que "borrar todo" borre todo, y son ~50 puzzles (poco espacio). En contra: destruye el pool pre-cargado y la siguiente entrada al home hace `buildPool` (10 fetches en paralelo). **Propongo sí borrarlo** — coherencia sobre optimización, y se reconstruye solo.
2. **¿Se listan las aperturas junto a los temas?** El CDN tiene un repo aparte de openings y la app las usa. Propongo **sí, en su propio grupo** ("Aperturas"), porque si no el total mostrado no cuadraría con lo que ocupa de verdad.
3. **`sizeBytes` exacto (`JSON.stringify`) o estimado (`count × media`)?** Propongo **exacto**: se paga una vez por archivo, en fire-and-forget, y un tamaño inventado en una pantalla cuyo propósito es la transparencia es contradictorio.
4. **¿Mostramos la fecha de descarga en cada fila?** Añade ruido a una fila ya densa. Propongo **no en la V1** — el dato está en `timestamp` y se puede añadir después si alguien lo pide.
5. **Orden por defecto: ¿tamaño desc o alfabético?** Propongo **tamaño desc** (el objetivo es liberar espacio), pero es discutible si se prefiere que la lista sea estable entre visitas.
6. **¿Entrada en Ajustes o en Perfil?** Propongo Ajustes, junto a Idioma/Notificaciones.

---

## Métricas de éxito

- **Distribución de `size_mb`** en `puzzle_storage_opened` — el dato que hoy no tenemos y que informa los umbrales de evicción.
- **Ratio de borrado**: % de usuarios que abren la pantalla y efectivamente borran algo. Si es muy alto, el caché está creciendo demasiado y hay que revisar la limpieza automática (la UI sería un parche, no la solución).
- **Uso de `puzzle_storage_cleared` vs `..._theme_deleted`**: si todo el mundo borra todo, el detalle por tema sobra y se puede simplificar.
- (Cualitativo) Desaparición de reseñas/quejas del tipo "la app ocupa mucho".

---

## Dependencias técnicas

- **Ninguna dependencia npm nueva.** Todo es IndexedDB + Angular/Ionic/DaisyUI ya presentes.
  > ⚠️ Nota: `@capacitor/filesystem` **no** está en el `package.json` raíz. El código con `Filesystem`/`Directory.Data` que se ve en [`apps/Chesscolate-old/src/app/services/puzzles-cache.service.ts`](../../apps/Chesscolate-old/src/app/services/puzzles-cache.service.ts) es de la **app legacy** y no aplica aquí.
- [`PuzzlesCacheService`](../../libs/puzzles-provider/src/lib/cache.service.ts) — métodos nuevos + metadata en el índice.
- [`utils.ts`](../../libs/puzzles-provider/src/lib/utils.ts) — `parsePuzzleUrl()`.
- `PuzzlesProvider.getCacheService()` ([`puzzles-provider.ts:269`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts#L269)) — ya existe, no requiere DI nueva.
- `AppService` — nombres traducidos de temas ([`themes-puzzle.json`](../../apps/chessColate/src/assets/data/themes-puzzle.json)) y aperturas (`openings.json`).
- `AnalyticsService` — los 4 eventos.
- Transloco — claves en `es.json` / `en.json`.
