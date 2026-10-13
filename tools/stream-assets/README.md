# Assets de la escena del directo

Los scripts que **dibujan por código** todo el pixel art de la escena del directo 24/7
(`apps/live-stream`): Chocolate, el gato, la casa, el árbol, el hoyo, el hueso, los fondos de día
y de noche. Los PNG de `apps/live-stream/public/assets/scene/` salen de aquí; no se editan a mano.

> Viven en el repo a propósito. Una vez se perdieron por estar en `/tmp`; no vuelvas a dejarlos fuera.

## Uso

```bash
cd tools/stream-assets
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt   # una sola vez (solo Pillow)

./.venv/bin/python export_assets.py          # regenera los PNG y scene.json en la app
./.venv/bin/python export_assets.py --check  # no escribe: falla si lo versionado no coincide, píxel a píxel
./.venv/bin/python preview.py                # preview.png: todos los sprites ampliados, para revisarlos a ojo
./.venv/bin/python -m unittest               # pruebas de los scripts (determinismo, coincidencia con la app, sumar un perro)
```

Es **determinista** (las texturas usan semillas fijas): regenerar sin tocar nada da exactamente los
mismos píxeles. Por eso `--check` sirve como red de seguridad: si lo cambias, o alguien edita un PNG a
mano, avisa.

## Cómo está organizado

| Archivo | Qué contiene |
|---|---|
| `pixel.py` | Utilidades: color, capas, rectángulos, contorno automático y volteo |
| `dog.py` | Poses del perro (de pie/camina/corre, sentado, cava, dormido) y su **paleta** (`DogPalette`) |
| `cat.py` | El gato (sentado, saluda con la lengua afuera, ojos cerrados, dormido) y su paleta |
| `props.py` | Pelota, hoyo (3 estados), hueso, corazón, plato, mano |
| `scenery.py` | Cielo, colinas, pinos, casa, árbol, roca y el fondo completo de día y de noche |
| `export_assets.py` | Arma las animaciones, las pega en tiras y escribe `scene.json` |
| `preview.py` | Hoja de contacto para revisar |

Convenciones: los sprites miran a la **derecha** (la escena los voltea), 1 px del sprite = 1 px lógico
(la página escala ×2) y los pies quedan abajo. El contorno de 1 px se añade solo con `outlined()`.

## Cambiar algo

1. Edita la función del sprite o del escenario.
2. `preview.py` para verlo; `export_assets.py` para escribirlo en la app.
3. Revisa el cambio en el navegador y sube los PNG junto con el script que los generó.

Si cambias el **tamaño** de una animación (más cuadros, otro ancho), `scene.json` se actualiza solo; la
escena lo lee de ahí.

## Sumar más perros

Un perro del **mismo cuerpo** (otro color de pelaje, otro collar) es solo una paleta:

1. En `dog.py`, define su `DogPalette` y añádela a `DOG_PALETTES`, por ejemplo
   `DOG_PALETTES['bruno'] = DogPalette(...)` (copia `CHOCOLATE` y cambia los colores).
2. `export_assets.py` genera sus tiras solo, con el prefijo `dogbruno-` (`dogbruno-walk`, `dogbruno-sit`…).
   Chocolate conserva `dog-`, que es como lo conoce la escena.
3. **En la app** (`apps/live-stream/src/app/features/scene/`) hay que dar de alta al actor nuevo: hoy
   `scene-timeline.ts` y los renderizadores conocen un solo perro (`dog`). Sumar más implica pasar a una
   lista de perros y escribir su guion. Esa parte es de la app, no de estos scripts.

Un perro de **otra raza** (otras proporciones) pide dibujar sus propios poses en un archivo nuevo
(`dog_beagle.py`, por ejemplo), siguiendo el estilo de `dog.py`.

## Ojo con

- Pillow: `getbbox()` sobre una imagen RGBA mira solo el canal alfa por defecto. `--check` usa
  `alpha_only=False` para comparar todos los canales; no lo quites.
- El gato y el perro tienen la nariz y el contorno en tonos muy oscuros pero no negros puros; si cambias
  la paleta, conserva ese contraste con el fondo para que se lean de lejos.
