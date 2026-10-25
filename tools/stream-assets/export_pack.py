#!/usr/bin/env python3
"""
Genera los sprites de la manada del Chess Runner (los 10 personajes) y su `pack.json`.

    ./.venv/bin/python export_pack.py              # escribe en apps/chessColate/src/assets/images/pack
    ./.venv/bin/python export_pack.py --out DIR    # escribe en otra carpeta
    ./.venv/bin/python export_pack.py --check      # no escribe: falla si lo versionado no coincide píxel a píxel

Descubre solo los módulos `pack_char_*.py` (cada uno con `META`, `animations()` y `portrait()`; ver
`docs/personajes/ASSETS_SPEC.md`). Cada personaje tiene **una sola celda** para todas sus animaciones:
  - ancho = el lienzo más ancho de sus cuadros + 2 (1 px de holgura a cada lado);
  - alto  = lo más alto que llega un cuadro con los pies en el suelo (o el lienzo del salto) + 1 px de holgura arriba.
Los pies van en la última fila de la celda en todas las animaciones menos `jump`, que apoya su lienzo en la base y
deja los pies donde el módulo los levantó.
"""
import argparse
import sys
from pathlib import Path

from pack_common import APP_IMAGES, check, content_bottom, discover, strip, write_json

DEFAULT_OUT = APP_IMAGES / 'pack'
REQUIRED = {'run': 4, 'jump': 3, 'hurt': 2, 'idle': 2, 'happy': 2}  # animación -> cuadros
AIRBORNE = ('jump',)  # animaciones cuyos pies no se pegan al suelo
PORTRAIT = (32, 32)
META_KEYS = ('id', 'name', 'family', 'size', 'collar', 'notes')


def load_characters():
    """[(META, {animación: (cuadros, fps)}, retrato)] de cada `pack_char_*.py`, validados."""
    chars, seen = [], set()
    for mod in discover('pack_char_'):
        meta = mod.META
        missing = [k for k in META_KEYS if k not in meta]
        if missing:
            raise ValueError(f'{mod.__name__}: a META le falta {missing}')
        if mod.__name__ != f'pack_char_{meta["id"]}':
            raise ValueError(f'{mod.__name__}: el archivo debe llamarse pack_char_{meta["id"]}.py')
        if meta['id'] in seen:
            raise ValueError(f'id repetido: {meta["id"]}')
        seen.add(meta['id'])
        anims = mod.animations()
        for name, count in REQUIRED.items():
            if name not in anims:
                raise ValueError(f'{meta["id"]}: falta la animación {name}')
            if len(anims[name][0]) != count:
                raise ValueError(f'{meta["id"]}: {name} debe tener {count} cuadros, tiene {len(anims[name][0])}')
        portrait = mod.portrait()
        if portrait.size != PORTRAIT:
            raise ValueError(f'{meta["id"]}: el retrato mide {portrait.size}, debe medir {PORTRAIT}')
        chars.append((meta, anims, portrait))
    return chars


def cell_of(anims):
    """(ancho, alto) de la celda única del personaje (ver la regla en la cabecera)."""
    frames = [(name, f) for name, (fs, _fps) in anims.items() for f in fs]
    w = max(f.size[0] for _, f in frames) + 2
    h = max((f.size[1] if name in AIRBORNE else content_bottom(f) + 1) for name, f in frames) + 1
    return w, h


def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'characters': {}}
    for meta, anims, portrait in load_characters():
        cid = meta['id']
        cw, ch = cell_of(anims)
        entry = {'name': meta['name'], 'family': meta['family'], 'size': meta['size'], 'collar': meta['collar'],
                 'cellW': cw, 'cellH': ch, 'animations': {}, 'portrait': f'pack-{cid}-portrait.png'}
        for name, (frames, fps) in anims.items():
            file = f'pack-{cid}-{name}.png'
            strip(frames, cw, ch, feet_on_ground=name not in AIRBORNE).save(out / file)
            entry['animations'][name] = {'file': file, 'frames': len(frames), 'fps': fps}
        portrait.save(out / entry['portrait'])
        manifest['characters'][cid] = entry
    write_json(out / 'pack.json', manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        sys.exit(check(build, args.out))
    manifest = build(args.out)
    print(f'{len(manifest["characters"])} personajes escritos en {args.out}')


if __name__ == '__main__':
    main()
