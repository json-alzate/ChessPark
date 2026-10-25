"""
Piezas comunes a los exportadores de la manada (`export_pack.py`) y del mapa (`export_map.py`).

- `discover(prefix)`: importa los módulos `<prefix>*.py` de esta carpeta (nadie edita un registro común).
- `strip(...)`: pega los cuadros de una animación en una tira horizontal de celdas iguales.
- `compare(fresh, target)` y `check(build, target)`: el `--check` píxel a píxel de siempre.
- `ground_row`, `content_bottom`: medidas que usan los exportadores y las pruebas.

Contrato: `docs/personajes/ASSETS_SPEC.md`. Python 3.9 (el del `.venv`): nada de `X | Y` en los tipos.
"""
import importlib
import json
import tempfile
from pathlib import Path

from PIL import Image

from export_assets import same_pixels

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
APP_IMAGES = REPO / 'apps' / 'chessColate' / 'src' / 'assets' / 'images'
PREVIEW_DIR = REPO / 'docs' / 'local' / 'preview'

# Tallas en orden de menor a mayor (README de personajes). `S–M` se escribe así en META.
SIZE_ORDER = ('S', 'S–M', 'M', 'L', 'XL')


def discover(prefix):
    """Los módulos `<prefix>*.py` de esta carpeta, importados y ordenados por nombre de archivo."""
    mods = []
    for path in sorted(HERE.glob(f'{prefix}*.py')):
        mods.append(importlib.import_module(path.stem))
    return mods


def content_bottom(frame):
    """Fila más baja con algún píxel opaco (None si el cuadro está vacío)."""
    box = frame.getbbox()
    return None if box is None else box[3] - 1


def strip(frames, cell_w, cell_h, feet_on_ground=True):
    """
    Tira horizontal de `len(frames)` celdas de `cell_w`×`cell_h`. Cada cuadro se centra en horizontal (por su lienzo,
    no por su contenido: así una cola más larga no corre la cabeza) y en vertical:
      - `feet_on_ground`: su fila opaca más baja (los pies) cae en la última fila de la celda;
      - si no (el salto): su lienzo se apoya en la base de la celda y los pies quedan donde el módulo los levantó.
    """
    out = Image.new('RGBA', (cell_w * len(frames), cell_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        bottom = content_bottom(f) + 1 if feet_on_ground else f.size[1]
        out.paste(f, (i * cell_w + (cell_w - f.size[0]) // 2, cell_h - bottom), f)
    return out


def frames_of(strip_img, frame_w):
    """Parte una tira en sus cuadros."""
    w, h = strip_img.size
    return [strip_img.crop((x, 0, x + frame_w, h)) for x in range(0, w, frame_w)]


def compare(fresh: Path, target: Path):
    """Lista de diferencias entre la carpeta recién generada y la versionada (vacía si coinciden)."""
    problems = []
    expected = {p.name for p in fresh.iterdir()}
    present = {p.name for p in target.iterdir()} if target.exists() else set()
    for name in sorted(expected - present):
        problems.append(f'falta {name}')
    for name in sorted(present - expected):
        problems.append(f'sobra {name} (no lo generan los scripts)')
    for name in sorted(expected & present):
        if name.endswith('.json'):
            if json.loads((fresh / name).read_text()) != json.loads((target / name).read_text()):
                problems.append(f'{name} difiere')
        elif not same_pixels(fresh / name, target / name):
            problems.append(f'{name} difiere')
    return problems, len(expected)


def check(build, target: Path) -> int:
    """`--check`: genera en una carpeta temporal y compara píxel a píxel con `target`."""
    with tempfile.TemporaryDirectory() as tmp:
        build(Path(tmp))
        problems, count = compare(Path(tmp), target)
    if problems:
        print('NO COINCIDE:\n  ' + '\n  '.join(problems))
        return 1
    print(f'OK: los {count} archivos de {target} coinciden píxel a píxel con lo que generan los scripts.')
    return 0


def write_json(path: Path, data):
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
