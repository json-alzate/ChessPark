#!/usr/bin/env python3
"""
Vistas previas del mapa, para revisarlo a ojo (con `Read` se ve; no se adivina).

    ./.venv/bin/python preview_map.py [--only 1,2] [--out DIR]

Por defecto escribe en `docs/local/preview/` (ignorado por git), solo de lo que ya existe:
  - `map-zone-<n>.png`: la escena ×2 con las animaciones de ambiente (cuadro 0) y los nodos encima; a la derecha, lo mismo
    con las cajas de cada animación y el número de cada punto;
  - `map-zone-<n>-anim.png`: **tira animada**: 8 instantes seguidos (1/8 s entre uno y otro) de la zona compuesta a 1×,
    y debajo cada animación de ambiente ×4 cuadro a cuadro, con su último cuadro repetido delante del primero para ver si el
    bucle salta; además `map-zone-<n>.gif` (para verla en movimiento en un visor);
  - `map-zones.png`: las siete escenas una junto a otra, para ver cómo se oscurecen;
  - `map-nodes.png`: los nodos ×6 por tipo y estado, el candado y el puntito;
  - `map-paper.png`: los tres papeles ×2 con las paradas, el rastro de galletas a medio camino y el marcador.
"""
import argparse
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

import export_map
from pack_common import PREVIEW_DIR, frames_of
from preview_pack import _big, _label

BG = (40, 40, 48)
BOX = (255, 80, 200)
STEPS = 8          # instantes de la tira animada
STEP_S = 1 / 8     # segundos entre instantes


class Built:
    def __init__(self, out, manifest):
        self.out, self.m = out, manifest
        self.cache = {}

    def frames(self, name):
        if name not in self.cache:
            s = self.m['sprites'][name]
            self.cache[name] = frames_of(Image.open(self.out / s['file']).convert('RGBA'), s['frameW'])
        return self.cache[name]

    def has(self, name):
        return name in self.m['sprites']


def node_frame(b, kind, state='open', i=0):
    for name in (f'map-node-{kind}-{state}', f'map-node-{kind}-open'):
        if b.has(name):
            fr = b.frames(name)
            return fr[i % len(fr)]
    return None


def compose(b, zone, t=0.0, debug=False, ambient=True):
    """La zona a 1× en el instante `t` (s): escena + ambiente + nodos (si existen; si no, círculos de prueba)."""
    img = b.frames(zone['scene'])[0].copy()
    d = ImageDraw.Draw(img)
    if ambient:
        for fx in zone.get('ambient', []):
            fr = b.frames(fx['sprite'])
            f = fr[int(t * fx['fps']) % len(fr)]
            img.paste(f, (fx['x'], fx['y']), f)
            if debug:
                d.rectangle([fx['x'], fx['y'], fx['x'] + fx['frameW'] - 1, fx['y'] + fx['frameH'] - 1], outline=BOX)
    pts = sorted(zone.get('points', []), key=lambda p: p['order'])
    current = len(pts) // 2
    for k, p in enumerate(pts):
        state = 'done3' if k < current and p['kind'] in ('pattern', 'boss') else \
            'done' if k < current else 'current' if k == current else 'locked'
        f = node_frame(b, p['kind'], state, int(t * 4))
        if f is not None:
            img.paste(f, (p['x'] - f.size[0] // 2, p['y'] - f.size[1] // 2), f)
        else:
            d.ellipse([p['x'] - 8, p['y'] - 8, p['x'] + 8, p['y'] + 8], outline=(255, 255, 255), width=2)
    return img


def zone_sheet(b, zone):
    left = _big(compose(b, zone), 2)
    right = _big(compose(b, zone, debug=True), 2)
    d = ImageDraw.Draw(right)
    for p in zone.get('points', []):
        lab = _label(str(p['order']), 2, (255, 255, 0))
        right.paste(lab, (p['x'] * 2 + 14, p['y'] * 2 - 8), lab)
        d.rectangle([p['x'] * 2 - 20, p['y'] * 2 - 20, p['x'] * 2 + 19, p['y'] * 2 + 19], outline=(255, 255, 0))
    sheet = Image.new('RGB', (left.size[0] * 2 + 30, left.size[1] + 50), BG)
    title = _label(f'zona {zone.get("_id")} · {zone.get("name", "")} · jefe {zone.get("boss", "")} · '
                   f'oscuridad {zone.get("darkness")} · {len(zone.get("ambient", []))} ambientes')
    sheet.paste(title, (10, 10), title)
    sheet.paste(left, (10, 40))
    sheet.paste(right, (left.size[0] + 20, 40))
    return sheet


def zone_anim(b, zone):
    shots = [compose(b, zone, i * STEP_S) for i in range(STEPS)]
    fxs = zone.get('ambient', [])
    rows = []
    for fx in fxs:
        fr = b.frames(fx['sprite'])
        seq = [fr[-1]] + fr          # último cuadro delante del primero: el paso de bucle tiene que verse suave
        rows.append((fx, [_big(f, 4) for f in seq]))
    gap = 6
    width = max([STEPS * (220 + gap)] + [sum(f.size[0] + gap for f in r) + 200 for _, r in rows]) + 20
    height = 420 + 30 + sum(r[0].size[1] + 30 for _, r in rows) + 20
    sheet = Image.new('RGB', (width, height), BG)
    for i, s in enumerate(shots):
        sheet.paste(s, (10 + i * (220 + gap), 10))
    y = 420 + 30
    for fx, row in rows:
        lab = _label(f'{fx["sprite"][len("map-fx-"):]} {fx["frames"]}c {fx["fps"]}fps', 1)
        sheet.paste(lab, (10, y), lab)
        x = 200
        for k, f in enumerate(row):
            ImageDraw.Draw(sheet).rectangle([x - 1, y - 1, x + f.size[0], y + f.size[1]],
                                            outline=(255, 200, 0) if k == 0 else (90, 90, 100))
            sheet.paste(f, (x, y), f)
            x += f.size[0] + gap
        y += row[0].size[1] + 30
    gif = [_big(compose(b, zone, i / 24), 2).convert('P', palette=Image.ADAPTIVE) for i in range(48)]
    return sheet, gif


def zones_strip(b, zones):
    sheet = Image.new('RGB', (len(zones) * 226 + 6, 450), BG)
    for k, (zid, zone) in enumerate(zones):
        sheet.paste(compose(b, zone, ambient=False), (6 + k * 226, 24))
        lab = _label(f'{zid} {zone.get("name", "")}', 1)
        sheet.paste(lab, (6 + k * 226, 6), lab)
    return sheet


def nodes_sheet(b):
    names = sorted(n for n in b.m['sprites'] if n.startswith('map-node-') or n in ('map-lock', 'map-path-dot'))
    if not names:
        return None
    k, cell = 6, 20 * 6 + 12
    cols = 9
    rows = -(-len(names) // cols)
    sheet = Image.new('RGB', (cols * (cell * 2) + 20, rows * (cell + 30) + 20), BG)
    for i, n in enumerate(names):
        x, y = 10 + (i % cols) * cell * 2, 10 + (i // cols) * (cell + 30)
        lab = _label(n[len('map-node-'):] if n.startswith('map-node-') else n, 1)
        sheet.paste(lab, (x, y), lab)
        for j, f in enumerate(b.frames(n)):
            big = _big(f, k)
            sheet.paste(big, (x + j * (big.size[0] + 4), y + 14), big)
    return sheet


def paper_sheet(b):
    variants = [n for n in ('paper-map-d0', 'paper-map-d1', 'paper-map-d2') if b.has(n)]
    if not variants:
        return None
    paper = b.m.get('paper', {})
    trail, stops = paper.get('trail', []), paper.get('stops', [])
    half = len(trail) // 2
    sheet = Image.new('RGB', (len(variants) * 460 + 20, 700), BG)
    for k, name in enumerate(variants):
        img = b.frames(name)[0].copy()
        for i, p in enumerate(trail):
            cookie = 'cookie-board' if i < half else 'cookie-board-empty'
            if i == 30 and b.has('cookie-gold'):
                cookie = 'cookie-gold'
            if b.has(cookie):
                f = b.frames(cookie)[0]
                img.paste(f, (p['x'] - f.size[0] // 2, p['y'] - f.size[1] // 2), f)
        for i, s in enumerate(stops):
            sprite = f'paper-stop-{s["boss"]}-{"open" if i <= 3 else "locked"}'
            if b.has(sprite):
                f = b.frames(sprite)[0]
                img.paste(f, (s['x'] - f.size[0] // 2, s['y'] - f.size[1] // 2), f)
        if trail and b.has('paper-marker'):
            f, p = b.frames('paper-marker')[0], trail[max(half - 1, 0)]
            img.paste(f, (p['x'] - f.size[0] // 2, p['y'] - f.size[1] - 4), f)
        lab = _label(name, 1)
        sheet.paste(lab, (10 + k * 460, 10), lab)
        sheet.paste(_big(img, 2), (10 + k * 460, 30))
    return sheet


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--only', default='', help='zonas separadas por coma (por defecto, todas)')
    parser.add_argument('--out', type=Path, default=PREVIEW_DIR)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    written = []
    with tempfile.TemporaryDirectory() as tmp:
        b = Built(Path(tmp), export_map.build(Path(tmp)))
        zones = [(int(z), dict(v, _id=int(z))) for z, v in b.m['zones'].items() if 'scene' in v]
        if args.only:
            wanted = {int(z) for z in args.only.split(',') if z.strip()}
            zones = [(z, v) for z, v in zones if z in wanted]
        for zid, zone in zones:
            zone_sheet(b, zone).save(args.out / f'map-zone-{zid}.png')
            sheet, gif = zone_anim(b, zone)
            sheet.save(args.out / f'map-zone-{zid}-anim.png')
            gif[0].save(args.out / f'map-zone-{zid}.gif', save_all=True, append_images=gif[1:], duration=42, loop=0)
            written += [f'map-zone-{zid}.png', f'map-zone-{zid}-anim.png', f'map-zone-{zid}.gif']
        if zones and not args.only:
            zones_strip(b, zones).save(args.out / 'map-zones.png')
            written.append('map-zones.png')
        for name, sheet in (('map-nodes.png', nodes_sheet(b)), ('map-paper.png', paper_sheet(b))):
            if sheet is not None:
                sheet.save(args.out / name)
                written.append(name)
    print(f'{len(written)} vistas -> {args.out}: {", ".join(written) or "nada aún (no hay módulos map_*.py)"}')


if __name__ == '__main__':
    main()
