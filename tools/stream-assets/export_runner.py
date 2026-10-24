#!/usr/bin/env python3
"""
Genera los assets del Chess Runner de chessColate y su `runner.json`.

    python3 export_runner.py                 # escribe en apps/chessColate/src/assets/images/runner
    python3 export_runner.py --out DIR       # escribe en otra carpeta
    python3 export_runner.py --check         # no escribe: falla si lo versionado no coincide con lo que
                                             # generan estos scripts (pixel a pixel)

Cada sprite es una tira horizontal de cuadros del mismo tamaño. El resultado es determinista.
`runner.json` describe cada tira (`frameW`, `frameH`, `frames`, `fps`) para que la app no repita medidas.
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image

import runner
from export_assets import same_pixels

REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / 'apps' / 'chessColate' / 'src' / 'assets' / 'images' / 'runner'


def all_sprites():
    """Nombre -> (cuadros, fps)."""
    sprites = {}
    for name, (frames, fps) in runner.dog_animations().items():
        sprites[f'dog-{name}'] = (frames, fps)
    for name, sprite in runner.scenery().items():
        sprites[f'scene-{name}'] = ([sprite], 1)
    sprites['fx-dust'] = (runner.fx_dust(), 12)
    sprites['fx-spark'] = (runner.fx_spark(), 14)
    return sprites


def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    manifest = {'sprites': {}}
    for name, (frames, fps) in all_sprites().items():
        cw = max(f.size[0] for f in frames)
        ch = max(f.size[1] for f in frames)
        strip = Image.new('RGBA', (cw * len(frames), ch), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            # pies/base abajo y centrado en la celda: el ancla del sprite es (0.5, 1)
            strip.paste(f, (i * cw + (cw - f.size[0]) // 2, ch - f.size[1]), f)
        strip.save(out / f'{name}.png')
        manifest['sprites'][name] = {'file': f'{name}.png', 'frameW': cw, 'frameH': ch, 'frames': len(frames), 'fps': fps}
    (out / 'runner.json').write_text(json.dumps(manifest, indent=1) + '\n')
    return manifest


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
    print(f'{len(manifest["sprites"])} sprites escritos en {args.out}')


if __name__ == '__main__':
    main()
