#!/usr/bin/env python3
"""
Genera los assets del mapa del Chess Runner (7 zonas, sus animaciones de ambiente, los nodos y el mapa de papel) y `map.json`.

    ./.venv/bin/python export_map.py              # escribe en apps/chessColate/src/assets/images/map
    ./.venv/bin/python export_map.py --out DIR    # escribe en otra carpeta
    ./.venv/bin/python export_map.py --check      # no escribe: falla si lo versionado no coincide píxel a píxel

Descubre solo los módulos `map_*.py`. Cada uno declara (ver `docs/personajes/ASSETS_SPEC.md`):
  - `ASSETS`: nombre -> imagen PIL o lista de cuadros del mismo tamaño (una tira horizontal); el archivo es `<nombre>.png`.
    Puede ser una función sin argumentos que devuelva ese diccionario (para no dibujar al importar).
  - `META`: lo que el módulo aporta a `map.json`, con estas claves (todas opcionales):
      `zones`: {'1': {'name', 'boss', 'darkness', 'scene', 'points': [{'x','y','kind','order'}],
                      'ambient': [{'sprite', 'x', 'y', 'fps'}]}}
      `nodes`: {...} y `paper`: {'stops': [...], 'trail': [...]} (se copian tal cual).
    Los `META` de varios módulos se mezclan; una misma clave definida dos veces es un error.
El exportador completa cada animación de ambiente con su `file`, `frames`, `frameW` y `frameH`.
"""
import argparse
import copy
import sys
from pathlib import Path

from PIL import Image

from pack_common import APP_IMAGES, check, discover, write_json

DEFAULT_OUT = APP_IMAGES / 'map'
PREFIXES = ('map-', 'paper-', 'cookie-')


def _merge(into, extra, where):
    for key, value in extra.items():
        if key not in into:
            into[key] = copy.deepcopy(value)
        elif isinstance(into[key], dict) and isinstance(value, dict):
            _merge(into[key], value, f'{where}.{key}')
        else:
            raise ValueError(f'{where}.{key} está definido en dos módulos')


def load():
    """(assets {nombre: [cuadros]}, meta mezclado) de todos los `map_*.py`."""
    assets, meta = {}, {}
    for mod in discover('map_'):
        mod_assets = mod.ASSETS() if callable(mod.ASSETS) else mod.ASSETS
        for name, value in mod_assets.items():
            if not name.startswith(PREFIXES):
                raise ValueError(f'{mod.__name__}: {name} debe empezar por {" / ".join(PREFIXES)}')
            if name in assets:
                raise ValueError(f'{name} lo exportan dos módulos')
            frames = list(value) if isinstance(value, (list, tuple)) else [value]
            if len({f.size for f in frames}) != 1:
                raise ValueError(f'{name}: todos sus cuadros deben medir lo mismo')
            assets[name] = [f.convert('RGBA') for f in frames]
        _merge(meta, getattr(mod, 'META', {}), mod.__name__)
    return assets, meta


def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    assets, meta = load()
    sprites = {}
    for name in sorted(assets):
        frames = assets[name]
        fw, fh = frames[0].size
        tira = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            tira.paste(f, (i * fw, 0))
        tira.save(out / f'{name}.png')
        sprites[name] = {'file': f'{name}.png', 'frameW': fw, 'frameH': fh, 'frames': len(frames)}
    zones = meta.get('zones', {})
    for zid, zone in zones.items():
        for fx in zone.get('ambient', []):
            if fx['sprite'] not in sprites:
                raise ValueError(f'zona {zid}: la animación {fx["sprite"]} no está en ningún ASSETS')
            fx.update({k: sprites[fx['sprite']][k] for k in ('file', 'frames', 'frameW', 'frameH')})
        if 'scene' in zone and zone['scene'] not in sprites:
            raise ValueError(f'zona {zid}: la escena {zone["scene"]} no está en ningún ASSETS')
    manifest = {'version': 1, 'logical': {'zoneW': 220, 'zoneH': 420, 'paperW': 220, 'paperH': 320},
                'zones': dict(sorted(zones.items(), key=lambda kv: int(kv[0]))),
                'nodes': meta.get('nodes', {}), 'paper': meta.get('paper', {}), 'sprites': sprites}
    write_json(out / 'map.json', manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        sys.exit(check(build, args.out))
    manifest = build(args.out)
    print(f'{len(manifest["sprites"])} sprites y {len(manifest["zones"])} zonas escritos en {args.out}')


if __name__ == '__main__':
    main()
