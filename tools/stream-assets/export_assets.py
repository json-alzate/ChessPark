#!/usr/bin/env python3
"""
Genera los assets de la escena del directo (fondos y tiras de animación) y su `scene.json`.

    python3 export_assets.py                 # escribe en apps/live-stream/public/assets/scene
    python3 export_assets.py --out DIR       # escribe en otra carpeta
    python3 export_assets.py --check         # no escribe: falla si lo versionado no coincide con lo que
                                             # generan estos scripts (pixel a pixel)

Cada animación es una tira horizontal de cuadros del mismo tamaño; el ancla de los sprites es
(0.5, 1): centro y pies. El resultado es determinista.
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

import cat as cat_mod
import dog as dog_mod
import props
import scenery

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / 'apps' / 'live-stream' / 'public' / 'assets' / 'scene'


def dog_animations(prefix, p):
    """Las animaciones de un perro. `prefix` es el nombre en la escena ('dog' para Chocolate)."""
    d = lambda **kw: dog_mod.dog_c(palette=p, **kw)  # noqa: E731
    return {
        f'{prefix}-sit': ([dog_mod.dog_sit(0, palette=p), dog_mod.dog_sit(1, palette=p)], 3),
        f'{prefix}-walk': ([d(legs=(-3, 3, 3, -3), tail=1), d(bob=-1, lift=1),
                            d(legs=(3, -3, -3, 3), tail=1), d(bob=-1, lift=1)], 8),
        f'{prefix}-run': ([d(legs=(-6, -4, 6, 4), bob=-2, lift=2, ear=1, mouth='open', tail=1),
                           d(legs=(3, 5, -3, -1), ear=1, mouth='open')], 10),
        f'{prefix}-bark': ([d(hd=(0, -2), mouth='open', tail=1), d(hd=(0, -3), mouth='open', tail=0)], 5),
        f'{prefix}-dig': ([dog_mod.dog_dig(0, palette=p), dog_mod.dog_dig(1, palette=p)], 6),
        f'{prefix}-sleep': ([dog_mod.dog_sleep(0, palette=p), dog_mod.dog_sleep(1, palette=p)], 1.5),
    }


def dog_prefix(name):
    """Chocolate conserva 'dog' porque así lo conoce la escena; los demás usan 'dog<nombre>' (un solo
    token: la escena agrupa los sprites por lo que va antes del primer guion)."""
    return 'dog' if name == 'chocolate' else f'dog{name}'


def all_animations():
    anims = {}
    for name, palette in dog_mod.DOG_PALETTES.items():
        anims.update(dog_animations(dog_prefix(name), palette))
    anims.update({
        'cat-tease': ([cat_mod.cat_s('tease', 0), cat_mod.cat_s('tease', 1)], 3),
        'cat-sit': ([cat_mod.cat_s('sit'), cat_mod.cat_s('smug')], 1),
        'hand': ([props.hand_open()], 1),
        'bone': ([props.bone()], 1),
        'heart': ([props.heart()], 1),
        'hole-open': ([props.hole('open')], 1),
        'hole-half': ([props.hole('half')], 1),
        'hole-mound': ([props.hole('mound')], 1),
    })
    for i, w in enumerate((92, 80, 86)):
        anims[f'cloud-{i}'] = ([scenery.cloud(w)], 1)
    return anims


def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    for name, night in (('bg-day', False), ('bg-night', True)):
        scenery.background(night).convert('RGB').save(out / f'{name}.png')

    manifest = {
        'logical': {'w': scenery.W, 'h': scenery.H},
        'backgrounds': {'day': 'bg-day.png', 'night': 'bg-night.png'},
        'sprites': {},
    }
    for name, (frames, fps) in all_animations().items():
        cw = max(f.size[0] for f in frames)
        ch = max(f.size[1] for f in frames)
        strip = Image.new('RGBA', (cw * len(frames), ch), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            # pies abajo y centrado en la celda: el ancla del sprite es (0.5, 1)
            strip.paste(f, (i * cw + (cw - f.size[0]) // 2, ch - f.size[1]), f)
        strip.save(out / f'{name}.png')
        manifest['sprites'][name] = {'file': f'{name}.png', 'frameW': cw, 'frameH': ch, 'frames': len(frames), 'fps': fps}
    (out / 'scene.json').write_text(json.dumps(manifest, indent=1))
    return manifest


def same_pixels(a: Path, b: Path) -> bool:
    ia, ib = Image.open(a).convert('RGBA'), Image.open(b).convert('RGBA')
    # `alpha_only=False`: en una diferencia el alfa siempre es 0, y por defecto getbbox() solo mira el alfa.
    return ia.size == ib.size and ImageChops.difference(ia, ib).getbbox(alpha_only=False) is None


def check(target: Path) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        fresh = Path(tmp)
        build(fresh)
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
    if problems:
        print('NO COINCIDE:\n  ' + '\n  '.join(problems))
        return 1
    print(f'OK: los {len(expected)} archivos de {target} coinciden píxel a píxel con lo que generan los scripts.')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        sys.exit(check(args.out))
    manifest = build(args.out)
    print(f'{len(manifest["sprites"])} tiras + 2 fondos escritos en {args.out}')


if __name__ == '__main__':
    main()
