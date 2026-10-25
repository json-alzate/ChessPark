# Contrato de assets: manada y mapa del Chess Runner

> Es el acuerdo que siguen todos los scripts, agentes y pantallas que tocan estos assets. Si algo de aquí cambia, se cambia aquí
> primero. Contexto de producto: [README.md](./README.md) (personajes y tallas) y [HISTORIA.md](./HISTORIA.md) (zonas, jefes, puntos).
> **Todo se dibuja por código** (Python + Pillow, determinista) en `tools/stream-assets/`, como el resto de los assets del runner.
> **No se editan PNG a mano.**

## Reglas comunes

- Pixel art: 1 px del sprite = 1 px lógico; la app amplía por un número **entero**. Contorno de 1 px con `pixel.outlined()`; paletas
  con tonos oscuros pero no negros puros (como `dog.py`).
- Los sprites **miran a la derecha**, los **pies abajo**, ancla en el centro de la base (0,5 ; 1).
- **Determinista:** misma semilla, mismos píxeles. Cada exportador tiene `--check` (falla si lo versionado no coincide píxel a píxel).
- **No tocar** `runner.json`, `export_runner.py`, `runner.py`, `dog.py`, `cat.py` ni nada de `assets/images/runner/` ni de
  `apps/live-stream/`: lo existente tiene sus pruebas y siguen en verde. Se pueden **importar** (`dog.py` da el cuerpo de Choco).
- Planos y vista previa **no se versionan**: van a `docs/local/` (ignorado por git).
- Sin commits, sin push, sin deploy.

## Manada (10 personajes)

Carpeta de salida: `apps/chessColate/src/assets/images/pack/` · manifiesto: `pack.json`.

| id | Nombre | Qué es (ver fotos en `docs/local/referencias/<id>-N.jpg`) | Talla | Alto de celda | Collar (provisional) |
|---|---|---|---|---|---|
| `choco` | Choco (Chocolate) | labrador marrón oscuro, orejas caídas, hocico gris | M | 40 (fijo: el existente) | verde `#7fd35a`, franja `#f0903c` |
| `tormenta` | Tormenta | canela claro, pelo corto, orejas medio caídas | M | 38–42 | amarillo `#ffd23f` |
| `tony` | Tony | negro de pecho blanco y pelo largo, corbatita de papel azul en una foto | M | 38–42 | naranja `#ff8a2b` |
| `kiana` | Kiana | husky rojizo y blanco | L | 44–48 | azul `#4fa3ff` |
| `zack` | Zack | husky negro y blanco, ojos azules | L | 44–48 | violeta `#b46cff` |
| `nannukk` | Nannukk | alaskan malamute, la mayor | XL | 53–56 | rosa `#ee6f86` |
| `romeo` | Romeo | perrito canela de pelo áspero, orejas semicaídas | S–M | 34–36 | rojo `#e5483f` |
| `maryluna` | Maryluna | pequeña crema de pelo hirsuto, orejas paradas; collar rosa y negro en la foto | S | 31–34 | negro con franja rosa `#ff6fb0` |
| `luna` | Luna | chihuahua beige, orejas enormes, ojos grandes | S | 29–32 | turquesa `#36d1c4` |
| `gatita` | La gatita | gatita atigrada blanca y naranja, orejas puntiagudas | S | 27–30 | celeste `#9be7ff` |

**Los colores de collar y las tallas son provisionales** (Jheison aún no ha dado los reales). Deben vivir en un solo sitio por
personaje (`META`) para cambiarlos con una línea. Cada collar tiene que **verse** en todas las poses y distinguirse de los demás.

### Proporciones

- **Alto de celda** = alto del cuadro de animación (con orejas, cola y contorno). Choco (52×40) es la medida: nadie queda más pequeño
  que la gatita ni más grande que Nannukk (68×55). La relación entre ellos se respeta **también en el ancho** (largo del cuerpo).
- **Una sola celda por personaje** (ancho × alto), **igual para todas sus animaciones**, para que cambiar de pose no mueva nada.
  Se calcula como el máximo de todos sus cuadros (más 1 px de holgura) y se declara en `pack.json`.
- Los pies (la base de las patas, en el suelo) quedan **en la última fila de la celda** en `run`, `idle`, `hurt` y `happy`; en `jump`
  se levantan, pero la **sombra de referencia** (la fila de suelo) no cambia.
- **Regla exacta de la celda (fijada en P0, `export_pack.py`):** ancho = el lienzo más ancho de todos sus cuadros + 2 (1 px a cada
  lado); alto = lo más alto que llega un cuadro con los pies en el suelo (en `jump`, su lienzo entero) + 1 px arriba. Cada cuadro se
  centra en horizontal **por su lienzo**; en vertical, su fila opaca más baja se pega a la última fila de la celda, salvo en `jump`, que
  apoya el lienzo en la base y deja los pies donde el módulo los levantó (al menos un cuadro del salto tiene la última fila vacía).
  El «alto de celda» de la tabla se mide como `cellH − 1`. Choco da 54×43 (de pie mide 40; sentado, `dog_sit`, 42).

### Animaciones obligatorias (todas, para todos)

| Animación | Cuadros | fps | Qué se ve |
|---|---|---|---|
| `run` | 4 | 12 | galope: se estira, se recoge, se estira al otro lado, se recoge |
| `jump` | 3 | 1 (se controla por fases) | despega estirado, en la cima recoge las patas, al caer las adelanta |
| `hurt` | 2 | 8 | choque/tropiezo: ojos cerrados, cabeza gacha, sacudida |
| `idle` | 2 | 3 | quieto/sentado, cola o respiración que se mueve |
| `happy` | 2 | 6 | contento: salta o mueve la cola, lengua afuera |
| `portrait` | 1 | — | **32×32**, cara/busto para botones y selector |

Cada animación se escribe como **una tira horizontal** `pack-<id>-<animación>.png` (`portrait` es `pack-<id>-portrait.png`).
Las animaciones deben ser **legibles tal cual** a 1× y a 2× (que es como se ven en el móvil), y entre cuadros el cuerpo no «salta» sin
motivo (la cabeza y el torso no cambian de sitio un píxel de más).

### Contrato de código (para añadir o cambiar un personaje)

Cada personaje es un módulo `tools/stream-assets/pack_char_<id>.py` con:

```python
META = {'id': 'nannukk', 'name': 'Nannukk', 'family': 'malamute', 'size': 'XL',
        'collar': '#ee6f86', 'notes': 'texto corto'}

def animations() -> dict:   # nombre -> (lista de cuadros PIL RGBA, fps); obligatorias: run, jump, hurt, idle, happy
def portrait():             # PIL RGBA de 32×32
```

Los cuerpos compartidos por una familia viven en `pack_body_<familia>.py`. **`export_pack.py` descubre solo** los módulos
`pack_char_*.py` (nadie edita un registro común), pega las tiras con la regla de celda de arriba y escribe `pack.json`:

```json
{ "version": 1,
  "characters": {
    "nannukk": { "name": "Nannukk", "size": "XL", "collar": "#ee6f86", "cellW": 70, "cellH": 57,
                 "animations": { "run": {"file": "pack-nannukk-run.png", "frames": 4, "fps": 12}, "...": {} },
                 "portrait": "pack-nannukk-portrait.png" } } }
```

Comandos (desde `tools/stream-assets`, con `./.venv/bin/python`): `export_pack.py` (escribe) · `export_pack.py --check` ·
`preview_pack.py [--only id,id] [--out DIR]` (hoja de contacto ×8 con las tiras etiquetadas y una **comparación de tamaños** con todos
a escala) · `python -m unittest` (incluye `test_pack_assets.py`: todos tienen las 5 animaciones + retrato, celda única, pies en la base,
`pack.json` coincide con los PNG, determinismo).

## Mapa (7 zonas)

Carpeta de salida: `apps/chessColate/src/assets/images/map/` · manifiesto: `map.json`. Se muestra **por zonas**, no es un mapa enorme.

### Escenas de zona

- `map-zone-<1..7>.png`: **220×420 px lógicos** (vertical; la app lo amplía ×2 en un móvil de 393×852).
- Cada zona es un cuadro propio con un **camino serpenteante** (de abajo hacia arriba: se entra por abajo y se sale por arriba) y
  espacio despejado para dibujar encima los puntos (nodos). El camino y los puntos **no se pintan en la escena con texto**.
- **Cada zona tiene vida propia: animaciones de ambiente** (como el remolino del desierto o el agua que se mueve en el mapa de Change).
  Son **capas animadas sueltas** encima de la escena base: `map-fx-<zona>-<nombre>.png`, una tira horizontal de 2 a 8 cuadros, con su
  posición `x`,`y` (esquina superior izquierda, px lógicos) y `fps` en `map.json`, clave `ambient`. **Mínimo 4 por zona**, sutiles y que
  **cierren el bucle sin saltos** (el último cuadro lleva al primero), a 2–8 fps, sin tapar el camino ni los puntos. Ideas por zona
  (se pueden cambiar si algo queda mejor):

  | Zona | Animaciones de ambiente |
  |---|---|
  | 1 Bosque | hojas que caen, copas que se mecen, destellos en un arroyo, una ardilla que asoma en una rama |
  | 2 Praderas | hierba que ondea, mariposas, orejas de conejo que asoman de una madriguera, una nubecilla que pasa |
  | 3 Selva | lianas que se balancean, cascada, gotas en un charco, un mono que se columpia, rayos de luz que respiran |
  | 4 Cañón | **remolino de polvo**, planta rodadora, la cola de un caballo en una cerca, humo de un establo viejo |
  | 5 Sabana | espejismo de calor ondulante, oreja y trompa de elefante, buitres que giran, charca que reluce |
  | 6 Pantano/costa | **olas y agua que se mueve**, burbujas, niebla que se desplaza, luciérnagas, una tortuga que asoma |
  | 7 Guarida | relámpagos, grietas que laten en violeta, estandartes que ondean, ojos rojos que parpadean en las torres |

- **Más tenebrosa cada vez** (nivel 0 a 6 = zona 1 a 7): baja la saturación, más sombra y decorado más hostil; solo las galletas y
  los perros conservan color vivo. Es horneado en cada escena (no un filtro).

| Zona | Jefe | Territorio | Ambiente |
|---|---|---|---|
| 1 | Ardilla | bosque de nogales y troncos, hojarasca | día luminoso, verdes vivos |
| 2 | Conejo | praderas con madrigueras, zanahorias, cercas bajas | tarde cálida, empiezan las sombras largas |
| 3 | Mono | selva con ruinas de piedra y lianas | verde oscuro, luz que se filtra |
| 4 | Caballo | llanura y cañón rojizo, cercas, establos viejos | cielo cubierto, polvo |
| 5 | Elefante | sabana seca, baobabs, huesos y charcas | naranja apagado y gris, atardecer sucio |
| 6 | Tortuga | costa, pantano y laguna con niebla | azul verdoso oscuro, niebla |
| 7 | Rey de las Sombras | guarida: tablero roto, torres negras y violeta, grietas | tormenta, casi monocromo con violeta |

- `map.json` guarda, por zona: nombre, jefe, **nivel de oscuridad**, y la **lista de puntos** con su `x`,`y` (en px lógicos de esa
  escena), `kind` y orden. **Puntos por zona** (ver HISTORIA.md, «Puntos del mapa»): zonas 1–4: 6 de patrón (el último, `boss`) + 1
  `rescue` + 1 `camp` = 8; zonas 5–6: 5 de patrón (el último, `boss`) + `rescue` + `camp` = 7; zona 7: 6 `door` + 2 de patrón + `king` = 9.
  Total ≈ 55. Los puntos van **a lo largo del camino**, sin tapar el decorado importante ni salirse (margen de 14 px a cada lado).

### Puntos (nodos)

Sprites pequeños (**20×20**) con estados, una tira por tipo: `map-node-<kind>-<estado>.png`.
Tipos: `pattern`, `boss`, `rescue`, `camp`, `door`, `king`. Estados: `locked`, `open` (2 cuadros, late), `current` (2 cuadros, más
llamativo) y `done` (con 1, 2 o 3 estrellas en `pattern`/`boss`: `done1`, `done2`, `done3`). Más `map-lock.png` (candado 12×14, para el
ELO mínimo; el número lo escribe la app) y `map-path-dot.png` (puntito del camino, 4×4, 2 estados).

### Mapa de papel (minimapa)

- `paper-map.png` **220×320**: pergamino doblado con pliegues, bordes quemados y una ruta que serpentea por **siete paradas**
  (posiciones en `map.json`, clave `paper`).
- **El rastro son galletas-tablero**: `cookie-board.png` (10×10, opción B de la galleta con grosor: damero de 4×3 casillas
  chocolate/vainilla y canto) y `cookie-board-empty.png` (la misma, apagada, en gris) y `cookie-gold.png` (dorada y crema, rara).
- Paradas: `paper-stop-<jefe>-<open|locked>.png` (20×20) para `ardilla`, `conejo`, `mono`, `caballo`, `elefante`, `tortuga` y
  `rey` (cara de cada jefe; `locked` = silueta con «?»). Más `paper-marker.png` (huella de la manada, 12×12, 2 cuadros).
- El papel se oscurece hacia el final: `paper-map-d0.png`, `d1`, `d2` (3 variantes, 0 = limpio, 2 = chamuscado).

`export_map.py` descubre los módulos `map_*.py` que declaren `ASSETS` (nombre -> imagen o lista de cuadros) y `META`; igual que el
pack. **Forma fijada en P0** (detalle en la cabecera de `export_map.py`):

- `ASSETS`: diccionario o función sin argumentos que lo devuelve; nombres que empiezan por `map-`, `paper-` o `cookie-` (el archivo es
  `<nombre>.png`); una lista de cuadros se pega como tira y todos sus cuadros miden lo mismo.
- `META` (se mezcla entre módulos; una clave repetida es error): `zones: {'1': {name, boss, darkness, scene, points, ambient}}`,
  `nodes: {...}`, `paper: {stops, trail}`. `boss` es el id del jefe (`ardilla` … `rey`), `darkness` = zona − 1, `scene` = `map-zone-<n>`.
  Cada punto es `{x, y, kind, order}` con `x`,`y` = **centro** del nodo; `order` 1 = el de abajo (por donde se entra), el último es
  `boss` (o `king` en la zona 7). Cada ambiente es `{sprite: 'map-fx-<n>-<nombre>', x, y, fps}` (esquina superior izquierda) y el
  exportador le añade `file`, `frames`, `frameW`, `frameH`.
- `paper.stops`: 7 `{boss, x, y}` en orden; `paper.trail`: **43** `{x, y, zone}` (una galleta por checkpoint, en orden), en px del papel.
- Los tres papeles son `paper-map-d0/d1/d2.png` (no hay un `paper-map.png` aparte). `map-path-dot` es una tira de 2 cuadros
  (pendiente, recorrido) y `paper-marker`, de 2 cuadros.

Comandos, igual que el pack: escribe, `--check`, `preview_map.py` (que también produce una **tira animada por zona** para verla en movimiento) y
`test_map_assets.py` (tamaños exactos, transparencia donde toca, nodos dentro del lienzo, conteo de puntos por zona, **al menos 4
animaciones de ambiente por zona dentro del lienzo**, determinismo).

## Pantalla de prueba («Laboratorio de la manada»)

Ruta `chess-runner/laboratorio` (carga perezosa, se llega por un **matraz en la barra del Chess Runner que solo existe en desarrollo**). Solo sirve para revisar los assets:

- **Elegir personajes:** botones con su retrato (selección múltiple y «Todos»).
- **Reproducir:** botones `run`, `jump`, `hurt`, `idle`, `happy` (y «Recorrido» que las encadena), pausa y paso a paso, velocidad.
- **Manada:** muestra los elegidos **a la vez, a su escala real**, con una línea de suelo y reglas de altura para ver las proporciones;
  y una carrerita con todos corriendo en fila y saltando juntos.
- **Zoom entero** (1× a 4×) y **fondos** (suelo del runner y las 7 escenas de zona).
- **Mapa:** elegir zona 1–7 con sus puntos encima, sus **animaciones de ambiente** (con un interruptor para encenderlas o apagarlas) y un selector de estado de puntos; el **mapa de papel** con un deslizador de
  progreso (0 a 43 checkpoints) que mueve la huella y rellena las galletas del rastro; y alternar zonas abiertas/cerradas.
- Muestra los datos de cada personaje (talla, celda, collar) leídos de `pack.json`.
- Textos en `es.json` y `en.json` (hay pruebas que vigilan que las claves existan en ambos), estilo según
  [STYLE_GUIDE.md](../STYLE_GUIDE.md) (skill `ui-style-guide`). **No** reformatear esos JSON: editar solo las claves nuevas.
