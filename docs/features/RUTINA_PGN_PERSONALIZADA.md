# Rutina con Base de Puzzles Personalizada (PGN) — Feature Document

## Concepto

Permitir que, al crear una **rutina personalizada**, el usuario pueda **cargar su propio archivo PGN con ejercicios** en vez de (o además de) usar el pool de puzzles del catálogo. Es decir: **cargar una BD de puzzles propia**.

Hoy una rutina personalizada se compone de **bloques** ([`Block`](../../libs/models/src/lib/block.model.ts)), y cada bloque pide sus puzzles al catálogo remoto vía [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts) filtrando por tema/ELO/color ([`block.service.ts` → `getPuzzlesForBlock`](../../apps/chessColate/src/app/services/block.service.ts)). Este feature añade una **fuente alternativa de puzzles para un bloque**: un archivo PGN aportado por el usuario, con una **estructura organizada** que la app sabe interpretar y convertir a la estructura interna [`Puzzle`](../../libs/models/src/lib/puzzle.model.ts).

Casos de uso:
- Un entrenador arma una colección de **posiciones tácticas/temáticas** y la reparte como `.pgn` a sus alumnos.
- El usuario exporta un **estudio de Lichess** (posiciones con su solución) y lo usa como rutina de repaso.
- Colecciones propias por apertura, final, motivo táctico, etc., que no están en el catálogo.

---

## El punto crítico: qué es un "puzzle" en la app

Antes de definir el formato PGN hay que respetar cómo la app representa un puzzle internamente. El modelo [`Puzzle`](../../libs/models/src/lib/puzzle.model.ts) sigue la **convención de Lichess**:

```ts
interface Puzzle {
  uid: string;
  fen: string;      // posición ANTES de la jugada de arranque, con el OPONENTE al turno
  moves: string;    // jugadas separadas por espacio: la 1ª es la del oponente (arma la posición),
                    // el resto es la SOLUCIÓN que debe encontrar el usuario
  rating: number;
  themes: string[];
  // ... (popularity, openingFamily, gameUrl, times, etc.)
}
```

Comportamiento confirmado en [`board-puzzle.component.ts`](../../libs/board/src/lib/board-puzzle/board-puzzle.component.ts): al montar el puzzle se hace `puzzle.moves.split(' ')`, se ejecuta **automáticamente la primera jugada** (la del oponente, `puzzleMoveResponse()`) y a partir de ahí el usuario debe reproducir el resto. El comentario en `getPuzzlesForBlock` lo confirma: _"El FEN del puzzle inicia con el turno del oponente"_.

> **Implicación de diseño**: un PGN de "partidas normales" **no** es directamente un puzzle. Un ejercicio necesita: (1) una **posición de partida** (`FEN`), (2) una **jugada de arranque del oponente** y (3) una **línea solución**. Por eso el archivo debe **seguir una estructura organizada**, no ser un PGN cualquiera.

---

## Estructura del PGN de ejercicios (contrato de formato)

Cada **ejercicio = una partida** dentro del `.pgn` (formato multi-partida estándar, igual que exporta un estudio de Lichess: un capítulo por ejercicio). La estructura propuesta:

```pgn
[Event "Mi colección - Táctica de clavadas #1"]
[FEN "r1bqk2r/ppp2ppp/2n2n2/2bpp3/4P3/2NP1N2/PPP2PPP/R1BQKB1R b KQkq - 0 5"]
[SetUp "1"]
[PuzzleRating "1450"]        ; opcional → Puzzle.rating
[PuzzleThemes "pin middlegame"] ; opcional → Puzzle.themes (separados por espacio)
[Result "*"]

5... Bg4 6. Be2 Nd4 7. O-O { solución } *
```

Reglas del contrato:

| Regla | Detalle |
|-------|---------|
| **1 partida = 1 ejercicio** | Se hace split multi-partida por los headers `[Event ...]`. |
| **`[FEN]` obligatorio + `[SetUp "1"]`** | Es la posición de arranque. Debe tener al **oponente al turno** (quien hace la jugada que "arma" el puzzle). Si no hay `[FEN]`, se asume posición inicial estándar. |
| **Mainline = arranque + solución** | La **primera jugada** de la línea es la del oponente (se ejecuta automática); el resto es la solución que el usuario debe encontrar. |
| **Solo línea principal en MVP** | Variantes, comentarios y NAGs se ignoran (se reproduce la mainline). |
| **Metadatos por tags (opcionales)** | `[PuzzleRating]` → `rating` (default configurable, p. ej. el ELO del bloque). `[PuzzleThemes]` → `themes`. `[Event]`/`[Site]` → título/`gameUrl`. |
| **`uid` generado** | Con [`UidGeneratorService`](../../libs/common-utils) o hash del FEN+moves para deduplicar. |

> **Nota sobre el color**: como el `FEN` marca de quién es el turno, el color que juega el usuario se **deriva** del FEN (turno del oponente → el usuario juega el color contrario), igual que hoy. No hace falta tag extra.

Se documentará este contrato como **plantilla descargable** y con un **ejemplo** para que entrenadores lo generen correctamente (o simplemente exporten un estudio de Lichess con posiciones + solución).

---

## Conversión PGN → `Puzzle[]`

Servicio nuevo `CustomPuzzlesImportService` (en `libs/common-utils` o en la app), usando `chess.js` (ya en el repo, `^1.4.0`):

```
archivo .pgn
   ↓  split multi-partida (regex por [Event]/bloque de tags)
[ raw PGN de cada ejercicio ]
   ↓  chess.loadPgn(raw)  → headers + history({verbose:true})
   ↓  fen  = header[FEN] (o posición inicial)
   ↓  moves = historia convertida al mismo formato que consume board-puzzle
   ↓  rating = header[PuzzleRating] ?? elo del bloque
   ↓  themes = header[PuzzleThemes]?.split(' ') ?? ['custom']
   ↓  uid    = uidGenerator() / hash(fen+moves)
Puzzle[]  →  se inyecta en Block.puzzles
```

**Validaciones al importar** (rechazar/avisar por ejercicio, sin romper la carga completa):
- FEN inválido o ausente cuando la línea no arranca desde la inicial.
- Menos de 2 plies en la mainline (no hay "arranque + solución").
- Jugadas ilegales según `chess.js`.
- Reporte al usuario: _"Se importaron 18 de 20 ejercicios. 2 con errores (ver detalle)."_

---

## Integración con la rutina personalizada

### Dónde encaja

El modelo [`Block`](../../libs/models/src/lib/block.model.ts) **ya** tiene un campo opcional `puzzles?: Puzzle[]`, y [`getPuzzlesForBlock`](../../apps/chessColate/src/app/services/block.service.ts) **ya** antepone `blockSettings.puzzles` a los del catálogo:

```ts
if (blockSettings.puzzles) {
  puzzles = [...blockSettings.puzzles, ...puzzlesToAdd];
}
```

Es decir, la "tubería" para inyectar puzzles propios en un bloque **ya existe**. El feature consiste en:

1. En el **formulario de bloque** ([`block-settings.component.ts`](../../apps/chessColate/src/app/pages/puzzles/components/block-settings/block-settings.component.ts)) añadir una **fuente de puzzles**: `catálogo` (actual) vs. `archivo PGN propio`.
2. Al elegir "archivo PGN propio": importar `.pgn` → `CustomPuzzlesImportService` → `Puzzle[]` → guardarlos como la BD del bloque.
3. Un bloque "PGN propio" **no** consulta al catálogo (o lo hace solo como relleno si el usuario lo permite): sus puzzles salen del archivo.

### ⚠️ Persistencia — el detalle que hay que resolver

Hoy, al guardar una rutina personalizada, el formulario **descarta** los puzzles del bloque:

```ts
// custom-plan-form.component.ts
const blocksToSave = this.blocks.map(({ puzzles, puzzlesPlayed, ...rest }) => ({ ...rest, puzzlesPlayed: [] }));
```

Tiene sentido para bloques de catálogo (se re-piden en tiempo de juego), **pero una BD personalizada no se puede re-pedir**: si se descarta, se pierde. Por eso hace falta una **estrategia de persistencia propia** para las colecciones importadas. Opciones (a alinear):

- **A — Colección referenciada** (recomendada): guardar la BD de puzzles como un documento aparte (`CustomPuzzleSet`) y que el bloque guarde solo un `customPuzzleSetId`. En tiempo de juego, `getPuzzlesForBlock` carga el set por id. Escala mejor y evita inflar cada `Plan`.
- **B — Puzzles embebidos en el bloque**: dejar de hacer strip de `puzzles` cuando el bloque es de tipo "PGN propio". Simple, pero engorda el `Plan` y complica si se comparte/publica.

```ts
interface CustomPuzzleSet {
  id: string;
  name: string;             // nombre de la colección / archivo
  createdAt: number;
  sourceFileName?: string;
  puzzles: Puzzle[];
}

// En Block:
interface Block {
  // ...campos actuales...
  puzzleSource?: 'catalog' | 'custom';   // nuevo
  customPuzzleSetId?: string;            // nuevo (opción A)
}
```

### Orden y modo de juego dentro del bloque

- **Orden**: secuencial (como está el PGN) o aleatorio — toggle en el bloque.
- **ELO/scoring**: al ser puzzles propios, el ELO no es comparable al catálogo. Decisión a alinear: (a) no afectan el ELO del usuario (modo "estudio"), o (b) usan `rating` del tag para un scoring local del `uidCustomPlan`. Recomendado empezar en modo estudio (no toca ELO global).
- El resto de settings del bloque (tiempo, mostrar solución, etc.) se respetan igual.

---

## Flujo de usuario

```
[Crear rutina personalizada] → [Añadir bloque]
        ↓
[Fuente de puzzles del bloque: ○ Catálogo  ● Archivo PGN propio]
        ↓ (PGN propio)
[Importar .pgn]  →  parseo + validación
        ↓
[Resumen: "18/20 ejercicios importados, 2 con error"]
        ↓
[Se guarda como CustomPuzzleSet, el bloque referencia su id]
        ↓
[Guardar rutina]  →  aparece en "Mis rutinas"
        ↓
[Jugar rutina] → getPuzzlesForBlock carga los puzzles del set propio
        ↓
[Se juega sobre el tablero normal (board-puzzle), con su solución]
```

---

## Modelo de datos (resumen)

```ts
// Nuevo
interface CustomPuzzleSet {
  id: string;
  name: string;
  createdAt: number;
  sourceFileName?: string;
  puzzles: Puzzle[];        // ya en formato interno Puzzle
}

// Extensión de Block
puzzleSource?: 'catalog' | 'custom';
customPuzzleSetId?: string;

// Puzzle importado (mapeo desde PGN)
// uid, fen, moves → derivados del PGN
// rating ← [PuzzleRating] ?? block.elo
// themes ← [PuzzleThemes] ?? ['custom']
// gameUrl ← [Site]/[Event] (opcional)
```

Persistencia local con el storage ya usado por la app (mismo patrón que planes personalizados). Sincronización a la nube = fuera de alcance inicial.

---

## Instrumentación (analytics)

Reusar `AnalyticsService` (catálogo en [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md)):

| Evento | Cuándo | Params |
|--------|--------|--------|
| `custom_pgn_import_started` | usuario elige importar `.pgn` | — |
| `custom_pgn_import_completed` | import ok | `total`, `imported`, `failed` |
| `custom_pgn_import_failed` | archivo inválido/vacío | `reason` |
| `custom_puzzle_block_created` | se crea un bloque con fuente `custom` | `puzzles_count` |
| `custom_puzzle_set_played` | se juega un bloque de set propio | `set_id`, `puzzles_count` |

---

## Consideraciones UX

- **Plantilla + ejemplo descargables** y ayuda contextual ("Exporta un estudio de Lichess con posiciones y su solución").
- **Feedback de importación claro**: cuántos entraron, cuántos fallaron y por qué (línea/ejercicio).
- **No romper por un ejercicio malo**: importación tolerante a fallos por-item.
- **Distinguir visualmente** un bloque de catálogo vs. uno de BD propia (etiqueta/ícono).
- **Aviso de scoring**: dejar claro si estos puzzles afectan o no el ELO.

---

## Alcance inicial (MVP)

1. Contrato de formato PGN documentado (headers `[FEN]`, `[SetUp]`, `[PuzzleRating]`, `[PuzzleThemes]`) + plantilla/ejemplo.
2. `CustomPuzzlesImportService`: split multi-partida + conversión a `Puzzle[]` con `chess.js` + validación tolerante.
3. Selector de **fuente de puzzles** en el formulario de bloque (`catalog` / `custom`) + importar `.pgn`.
4. Persistencia de `CustomPuzzleSet` (opción A referenciada) + `customPuzzleSetId` en el bloque.
5. `getPuzzlesForBlock` respeta la fuente propia (no golpea el catálogo cuando es `custom`).
6. Modo estudio: los puzzles propios **no** alteran el ELO global (configurable después).
7. Eventos de analytics.

## Fuera de alcance inicial

- Variantes/comentarios/NAGs (solo mainline).
- Compartir/publicar sets personalizados o sincronizarlos en la nube.
- Editor visual de puzzles dentro de la app (crear ejercicios sin PGN).
- Scoring/ELO real basado en los ratings del archivo.
- Importar por URL directa de estudio de Lichess (por ahora archivo local / pegar texto).

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar** los detalles de diseño/producto:

1. **Estructura del PGN**: ¿adoptamos el formato "estudio de Lichess" (FEN + mainline como solución) tal cual, o definimos tags propios (`[PuzzleThemes]`, `[PuzzleRating]`)? ¿Cuáles son obligatorios?
2. **Persistencia**: ¿opción A (set referenciado por id, recomendada) u opción B (puzzles embebidos en el bloque)?
3. **Scoring/ELO**: ¿modo estudio (no toca ELO) o los ratings del archivo alimentan un ELO local del plan?
4. **Fuente mixta**: ¿un bloque `custom` puede rellenarse con puzzles del catálogo si el archivo tiene pocos, o es 100% propio?
5. **Entrada**: ¿solo archivo `.pgn` local, o también pegar el PGN en un textarea?
6. **Tamaño/límites**: ¿tope de ejercicios por set / de sets por usuario?

---

## Dependencias técnicas

- `chess.js` (ya en el repo) para parsear PGN y derivar FEN/jugadas.
- [`PuzzlesProvider`](../../libs/puzzles-provider/src/lib/puzzles-provider.ts) / [`block.service.ts`](../../apps/chessColate/src/app/services/block.service.ts) — punto de integración (`getPuzzlesForBlock`).
- [`Block`](../../libs/models/src/lib/block.model.ts) / [`Plan`](../../libs/models/src/lib/plan.model.ts) — extender con `puzzleSource` / `customPuzzleSetId`.
- [`block-settings.component.ts`](../../apps/chessColate/src/app/pages/puzzles/components/block-settings/block-settings.component.ts) y [`custom-plan-form.component.ts`](../../apps/chessColate/src/app/pages/puzzles/containers/custom-plan-form/custom-plan-form.component.ts) — UI de selección de fuente + ajustar el `strip` de `puzzles` al guardar.
- [`UidGeneratorService`](../../libs/common-utils) para los `uid`.
- Import de archivos: plugin de Capacitor (`@capacitor/filesystem`) o file input web para leer el `.pgn`.
- Storage local existente para `CustomPuzzleSet`.
- `AnalyticsService` existente para la instrumentación.

---

## Relación con otros features

- Comparte el **parseo de PGN con `chess.js`** con el [Reproductor / TV de Partidas](./REPRODUCTOR_PARTIDAS.md); conviene extraer un **util común de parseo PGN** (`libs/common-utils`) que ambos consuman: el reproductor usa la mainline como "partida a ver", este feature la usa como "solución de un ejercicio".
