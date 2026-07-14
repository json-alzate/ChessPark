# Analizador de Partidas (con capas de dibujo) — Feature Document

## Concepto

Un **analizador de partidas** al estilo del de Lichess: cargar una partida y poder **estudiarla activamente** — navegar jugada a jugada, **crear variantes** (líneas alternativas que ramifican desde cualquier posición), **dejar comentarios** en posiciones concretas y anotar con flechas/marcadores en el tablero.

El **extra diferenciador** de este feature es la **capa de dibujo libre por posición**: además de las flechas "clásicas" del tablero, cada posición puede tener uno o varios **items de dibujo** — un `canvas` transparente **encima del tablero** donde el usuario puede pintar **flechas** o **trazo libre** (a mano alzada). Lo interesante es que **una misma posición puede tener múltiples de estos items** (varias "láminas" de dibujo distintas para la misma jugada), y el usuario puede **seleccionar cuál se muestra encima** en cada momento — como capas de una explicación que se van alternando.

> Ejemplo de uso: en la posición tras `12. Nd5` quiero tener tres explicaciones visuales distintas — "plan de ataque en el flanco de rey", "estructura de peones a vigilar", "maniobra del caballo" — cada una es un dibujo independiente sobre la **misma** posición, y voy alternando cuál muestro según lo que estoy explicando.

Dos capas de valor conviven:

1. **Analizador clásico** — árbol de jugadas con variantes + comentarios por posición (lo que hace Lichess).
2. **Capas de dibujo por posición** — múltiples `canvas` de flechas/dibujo libre por posición, seleccionables — el extra.

> **Relación con [Reproductor de Partidas](./REPRODUCTOR_PARTIDAS.md)**: aquel es *pasivo* (ver la partida correr como un video); este es *activo* (intervenir la partida: ramificar, comentar, dibujar). Comparten el mismo motor de tablero (`@chesspark/board`, `chess.js`, `cm-chessboard`) y el mismo parseo PGN. Idealmente el analizador **reutiliza el parseo y la navegación** del reproductor y añade encima el árbol de variantes y las capas de dibujo.

---

## Objetivos

- Ofrecer una herramienta de **estudio activo** de partidas: ramificar, comentar y anotar sobre el tablero.
- Soportar **árbol de variantes** navegable (líneas y sub-líneas desde cualquier posición), no solo la línea principal.
- Permitir **comentarios de texto por posición** (como los `{comentarios}` del PGN).
- Añadir el **extra de las capas de dibujo**: varios `canvas` de flechas/trazo libre por posición, con selección de cuál se ve encima.
- **Persistir** el trabajo (variantes + comentarios + dibujos) de forma local y **exportarlo/importarlo** (PGN para lo compatible; formato propio para lo que el PGN no cubre — los dibujos).
- Reutilizar al máximo el **tablero y motor ya existentes** (`@chesspark/board`) en vez de reinventarlos.

---

## Alcance funcional

### 1. Carga de la partida

Mismas vías que el reproductor (idealmente compartidas):
- Pegar texto PGN en un textarea.
- Importar un archivo `.pgn` desde el dispositivo.
- Empezar desde una **posición vacía / inicial** para analizar "en blanco" moviendo piezas libremente.
- (Futuro) Importar por URL / ID de Lichess/Chess.com.

### 2. Navegación y árbol de jugadas

| Control | Acción |
|---------|--------|
| ◀ / ▶ Anterior / Siguiente | Recorre la línea actual jugada a jugada |
| ⏮ / ⏭ Inicio / Final | Salta al principio/fin de la línea |
| 🔄 Girar | Invierte la orientación del tablero |
| Clic en jugada | Salta a esa posición del árbol |

- **Lista/árbol de jugadas** en notación SAN, con la jugada actual resaltada.
- Las **variantes** se muestran indentadas/anidadas bajo la jugada desde la que ramifican (como Lichess).
- **Promover / eliminar variante**: convertir una sub-línea en principal, o borrarla.

### 3. Crear variantes

- Estando en cualquier posición del árbol, si el usuario **mueve una pieza** (movimiento legal según `chess.js`):
  - Si coincide con la jugada que ya seguía en el árbol → simplemente avanza.
  - Si es una jugada **distinta** → se crea una **nueva variante** que ramifica desde esa posición.
- Se puede ramificar desde **cualquier nodo**, generando sub-líneas a cualquier profundidad.

### 4. Comentarios por posición

- Campo de texto asociado a la **posición actual** (nodo del árbol).
- Se muestra bajo el tablero / junto a la jugada en la lista.
- Compatible con el estándar PGN (`{comentario}`) al exportar/importar.
- (Nice-to-have) **NAGs** / glifos de evaluación (`!`, `?`, `!?`, `+/-`…) como chips rápidos.

### 5. Capas de dibujo por posición — **el extra**

Este es el núcleo diferenciador. Sobre el tablero se superpone una **capa de dibujo** (`canvas` transparente alineado con el tablero).

**Modelo mental**: cada posición (nodo del árbol) tiene una **lista de "items de dibujo"** (`DrawingLayer[]`). Cada item es una lámina independiente con sus flechas y trazos. En un momento dado se muestra **el item activo** (o ninguno).

**Herramientas de dibujo**:
- **Flecha**: se arrastra de casilla origen a casilla destino (o punto a punto libre); color seleccionable.
- **Trazo libre / lápiz**: dibujo a mano alzada sobre el tablero.
- **Círculo/marca de casilla** (reutilizando los `Markers` que ya tiene `board.component.ts`, o pintados en el canvas).
- **Goma / limpiar**: borra el último trazo o toda la lámina.
- **Selector de color** (paleta pequeña: verde/rojo/azul/amarillo, como Lichess).

**Gestión de múltiples items por posición**:
- Botón **"+ Nueva capa"** → crea un item de dibujo vacío para la posición actual.
- **Lista de capas** de la posición (p. ej. chips o miniaturas): "Capa 1", "Capa 2"… con opción de **renombrarlas** ("Plan de ataque", "Estructura").
- **Seleccionar** una capa la pone como **activa/visible** encima del tablero.
- **Ocultar todas** (ver el tablero limpio).
- **Duplicar** una capa (partir de una existente para variar).
- **Eliminar** una capa.

**Comportamiento**:
- Las capas son **por posición**: al navegar a otra jugada, se muestran las capas de esa posición (y se recuerda cuál estaba activa).
- El `canvas` debe **re-alinearse** con el tablero al redimensionar/girar (responsive) y re-renderizar el dibujo con las coordenadas relativas al tablero.
- Los dibujos se guardan como **datos vectoriales** (lista de trazos/flechas con coordenadas relativas), **no** como imagen rasterizada — así se re-renderizan nítidos a cualquier tamaño y sobreviven al giro del tablero.

---

## Flujo de usuario

```
[Usuario abre "Analizador de partidas"]
        ↓
[Carga PGN | pega | empieza en blanco]
        ↓
[Tablero + árbol de jugadas + panel de comentario + capas de dibujo]
        ↓
 ┌─────────────┬──────────────────┬─────────────────────────┐
 ▼             ▼                  ▼                         ▼
[Navega]   [Mueve pieza →    [Escribe comentario     [Dibuja: crea capa,
[jugadas]   crea variante]    en la posición]          pinta flecha/trazo]
                                                          ↓
                                              [Varias capas por posición]
                                                          ↓
                                              [Selecciona cuál se ve encima]
        ↓
[Guarda análisis local / exporta PGN + dibujos]
```

---

## Diseño técnico

### Ubicación en el proyecto

- **Nueva página**: `apps/chessColate/src/app/pages/analyzer/` (nombre a alinear), registrada en [`app.routes.ts`](../../apps/chessColate/src/app/app.routes.ts).
- **Tablero base**: [`board.component.ts`](../../libs/board/src/lib/board/board.component.ts) / [`fen-board.component.ts`](../../libs/board/src/lib/fen-board/fen-board.component.ts) de `@chesspark/board`. Ya integra `cm-chessboard` con la extensión `Markers` y expone `addMarker` / `removeMarkers`.
- **Motor de navegación/parseo**: reutilizar el parseo PGN → FEN/SAN del [Reproductor de Partidas](./REPRODUCTOR_PARTIDAS.md) (`GamePgnService` propuesto allí). El analizador **añade el árbol de variantes** encima.
- **Capa de dibujo**: nuevo componente `board-drawing-layer` (en `@chesspark/board`) — un `canvas`/SVG posicionado en `absolute` sobre el tablero, que recibe la `DrawingLayer` activa y emite los trazos nuevos. Alternativa: usar la extensión `html-layer` de `cm-chessboard` (`node_modules/cm-chessboard/src/extensions/html-layer/`) para inyectar el canvas alineado con el board.

### Árbol de variantes

`chess.js` da la **línea principal** (`history()`), pero **no** modela un árbol de variantes con sub-líneas. Necesitamos una estructura propia de nodos:

```ts
interface MoveNode {
  id: string;                 // uid del nodo
  parentId: string | null;    // null = posición raíz
  san: string | null;         // jugada que llevó a este nodo (null en la raíz)
  fen: string;                // posición resultante
  children: string[];         // ids de hijos; children[0] = continuación principal
  comment?: string;           // comentario de texto de la posición
  nags?: string[];            // glifos (!, ?, !?, +/-...)
  drawings: DrawingLayer[];   // capas de dibujo de ESTA posición (el extra)
  activeDrawingId?: string;   // qué capa se muestra encima
}

interface AnalysisTree {
  id: string;
  rootId: string;             // nodo de la posición inicial
  nodes: Record<string, MoveNode>;
  headers: Record<string, string>;  // White, Black, Event, Date, Result...
  startFen?: string;          // posición inicial no estándar (FEN tag / Chess960)
}
```

- Crear variante = añadir un `MoveNode` como hijo del nodo actual (si `san` no coincide con ningún hijo existente).
- Promover variante = reordenar `children` para que la sub-línea pase a `children[0]`.
- La **posición actual** es simplemente el `MoveNode` seleccionado; navegar = moverse por `parentId`/`children`.

### Modelo de las capas de dibujo

```ts
interface DrawingLayer {
  id: string;
  name: string;               // 'Capa 1' | 'Plan de ataque' ...
  shapes: DrawShape[];        // flechas, trazos libres, marcas
  visible?: boolean;          // (si se permite componer varias, no solo una activa)
}

type DrawShape =
  | { type: 'arrow'; from: Point; to: Point; color: string; width: number }
  | { type: 'freehand'; points: Point[]; color: string; width: number }
  | { type: 'circle'; center: Point; radius: number; color: string; width: number }
  | { type: 'squareMarker'; square: string; color: string };   // reutiliza Markers del board

// Coordenadas RELATIVAS al tablero (0..1 en cada eje) para ser
// independientes del tamaño y de la orientación del tablero.
interface Point { x: number; y: number; }
```

> **Decisión clave**: guardar los dibujos como **vectores con coordenadas relativas (0..1)**, no como PNG. Así se re-renderizan a cualquier resolución, sobreviven al giro del tablero (basta transformar `p → (1-x, 1-y)` al invertir) y ocupan poco en storage.

### Persistencia

- **Local primero** (mismo storage que el resto de la app, p. ej. `@capacitor/preferences` o el `state` lib): guardar el `AnalysisTree` completo (incluye variantes, comentarios y dibujos) bajo un id de "análisis".
- **Lista de análisis guardados** (para retomar estudios).
- **Export/Import**:
  - **PGN estándar** para lo compatible: línea principal + variantes (`( ... )`) + comentarios (`{ ... }`) + NAGs. Esto lo entienden Lichess/Chess.com.
  - **Formato propio (JSON)** para lo que el PGN **no** cubre: las **capas de dibujo**. Se puede embeber en el PGN como comentario especial (p. ej. `{[%draw ...]}`) o exportar un `.json` acompañante. A evaluar.
- (Futuro) Sincronización en la nube con la cuenta del usuario.

### Motor de dibujo (canvas)

- Un `canvas` (o SVG) transparente en `position: absolute` cubriendo exactamente el tablero.
- **Captura de gestos**: pointer events (mouse + touch) para arrastrar flechas y pintar a mano alzada. Ojo con no interferir con el drag de piezas → **modo dibujo** explícito (toggle) que desactiva el movimiento de piezas mientras se dibuja.
- **Render**: al cambiar de posición o de capa activa, limpiar y repintar los `shapes` de la capa activa transformando coords relativas → píxeles según el tamaño/orientación actuales.
- **Redibujado responsive**: escuchar resize/rotación del tablero y repintar.

### Casos borde a contemplar

- **Colisión dibujo vs. mover piezas**: necesita un **toggle de modo** claro (mover / dibujar) o gesto diferenciado (p. ej. clic-derecho = flecha, como Lichess; arrastre con dedo = dibujo en modo dibujo).
- **Giro del tablero** con dibujos activos → transformar coordenadas.
- **PGN con variantes/comentarios de entrada** → parsearlos al árbol (el MVP del reproductor los ignora; aquí **sí** los queremos). Puede requerir un parser más robusto (`@mliebelt/pgn-parser`) que el split por regex.
- **Posición inicial no estándar** (`[FEN]`, Chess960) → `startFen` en la raíz.
- **Análisis grande** (muchas variantes + muchas capas) → cuidar el peso en storage y el render del árbol.
- **Pérdida de datos**: autoguardado del análisis en local para no perder el trabajo.

---

## Instrumentación (analytics)

Reusar el `AnalyticsService` existente (catálogo en [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md)). Eventos sugeridos:

| Evento | Cuándo | Params |
|--------|--------|--------|
| `analyzer_opened` | se abre la pantalla | `source`, `input` (`paste`/`file`/`blank`) |
| `analyzer_game_loaded` | se carga una partida | `has_variants`, `moves_count` |
| `analyzer_variant_created` | el usuario ramifica | `depth` |
| `analyzer_comment_added` | añade/edita comentario | — |
| `analyzer_drawing_layer_created` | crea una capa de dibujo | `layers_in_position` |
| `analyzer_drawing_layer_switched` | cambia la capa visible | — |
| `analyzer_analysis_saved` | guarda el análisis local | `nodes_count`, `drawings_count` |
| `analyzer_exported` | exporta PGN/JSON | `format` (`pgn`/`json`) |

---

## Consideraciones UX

- **Modo mover vs. modo dibujar** inequívoco: el usuario nunca debe dudar si su gesto moverá una pieza o pintará. Considerar el patrón Lichess (clic-izquierdo mueve, **clic-derecho** dibuja flechas/marcas) más un **modo dibujo libre** explícito para el trazo a mano.
- **Las capas se sienten como "diapositivas"** de la misma posición: crearlas, nombrarlas y alternarlas debe ser de un toque; ideal un **carrusel/segmented** de capas bajo el tablero.
- **Miniaturas o nombres claros** para distinguir capas ("Plan de ataque" vs "Capa 2").
- **Árbol de variantes legible** en móvil (indentación, colapsar sub-líneas largas).
- **No perder trabajo**: autoguardado + aviso al salir con cambios sin guardar.
- **Rápido de anotar**: paleta de colores y herramientas siempre a mano, sin menús profundos.

---

## Métricas de éxito

- Nº de `analyzer_game_loaded` y proporción con variantes creadas.
- Uso real del **extra**: nº de `analyzer_drawing_layer_created` y `analyzer_drawing_layer_switched` por sesión (¿la gente crea varias capas por posición?).
- Nº de análisis guardados (`analyzer_analysis_saved`) y retomados.
- Exportaciones (`analyzer_exported`) — señal de que el trabajo "sale" de la app.

---

## Alcance inicial (MVP)

1. Página "Analizador de partidas" enlazada desde menú/home.
2. Cargar partida por **PGN pegado** + navegación jugada a jugada (reutilizando el motor del reproductor) + girar tablero.
3. **Árbol de variantes**: mover una pieza ramifica; lista de jugadas con variantes anidadas; promover/eliminar variante.
4. **Comentarios de texto** por posición.
5. **Capa de dibujo**: `canvas` sobre el tablero con **flecha** y **trazo libre** + selector de color, en **modo dibujo** explícito.
6. **Múltiples capas por posición** + selección de cuál se ve encima (crear/renombrar/eliminar/seleccionar).
7. **Guardar/retomar análisis en local** + **exportar PGN** (variantes + comentarios).
8. Eventos de analytics.

## Fuera de alcance inicial

- Análisis con **Stockfish** (evaluación, mejores jugadas) — el motor ya está en `@chesspark/stockfish-wasm`; se añade después como "evaluar esta posición".
- Importar por **URL/API** de Lichess/Chess.com.
- **Sincronización en la nube** de los análisis (por ahora local).
- Embeber los **dibujos dentro del PGN** de forma interoperable (empezar con JSON propio; el PGN exporta solo lo estándar).
- **Composición de varias capas a la vez** (mostrar 2+ simultáneas) — el MVP muestra una activa; multi-visible es iteración posterior.
- Colaboración/compartir el análisis con dibujos como enlace.

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar** los detalles de diseño/producto:

1. **Gesto de dibujo**: ¿patrón Lichess (clic-derecho = flechas) + modo dibujo aparte para el trazo libre, o un toggle global "mover/dibujar"? En móvil no hay clic-derecho — ¿toggle es lo natural?
2. **¿Qué es una "capa"?**: ¿siempre se muestra **una** activa (más simple), o queremos poder **componer varias visibles** desde el inicio? El pedido habla de "seleccionar cuál se ve encima" → una activa parece suficiente para el MVP.
3. **Persistencia de los dibujos**: ¿JSON propio aparte del PGN, o embeberlos en el PGN como comentario especial para que viajen con la partida?
4. **Parser PGN**: para **leer** variantes/comentarios de entrada necesitamos un parser robusto (`@mliebelt/pgn-parser`). ¿Lo adoptamos ya, o el MVP solo permite crear variantes desde cero sobre una línea principal simple?
5. **Reutilización del tablero**: ¿extendemos `board.component.ts` con la capa de dibujo (riesgo de tocar el flujo de puzzles) o creamos un `board-analyzer`/`board-drawing-layer` hermano?
6. **Nombre y ubicación**: ¿"Analizador", "Analizar partida", "Estudio"? ¿Entrada desde home, menú o ambos? ¿Se une con el reproductor en una sola sección "Partidas"?

---

## Dependencias técnicas

- `chess.js` (ya en el repo) para legalidad de jugadas y derivar FENs.
- `cm-chessboard` + `@chesspark/board` (ya en el repo) para el render, `Markers` y la capa HTML (`html-layer`).
- Motor de parseo/navegación PGN del [Reproductor de Partidas](./REPRODUCTOR_PARTIDAS.md) (compartido).
- `canvas`/SVG para la capa de dibujo (nativo del navegador; sin dependencia nueva salvo que se quiera una lib de dibujo).
- (Probable) `@mliebelt/pgn-parser` para leer PGNs con variantes/comentarios.
- Storage local existente (`state` lib / `@capacitor/preferences`) para guardar análisis.
- Import de archivos: file input web / `@capacitor/filesystem` para `.pgn`.
- `AnalyticsService` existente para la instrumentación.
- (Opcional futuro) `@chesspark/stockfish-wasm` para evaluación de posiciones.
