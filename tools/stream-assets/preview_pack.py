#!/usr/bin/env python3
"""
Vistas previas de la manada, para revisarla a ojo (con `Read` se ve el sprite; no se adivina).

    ./.venv/bin/python preview_pack.py [--only id,id] [--out DIR]

Por defecto escribe en `docs/local/preview/` (ignorado por git):
  - `pack-<id>.png`: hoja de contacto ×8, una fila por animación con sus celdas marcadas y la línea de suelo, y el retrato;
  - `pack-sizes.png`: todos a la misma escala (×4) sobre una línea de suelo, con reglas de altura cada 8 px;
  - `pack-1x2x.png`: todas las animaciones a 1× y 2× sobre el color del runner (cómo se ven en el móvil).
"""
import argparse
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

import export_pack
from pack_common import PREVIEW_DIR, SIZE_ORDER, frames_of

BG = (88, 126, 92)
BG_RUNNER = (176, 214, 236)
GRID = (120, 160, 124)
GROUND = (60, 44, 30)
INK = (255, 255, 255)


def _big(img, k):
    return img.resize((img.size[0] * k, img.size[1] * k), Image.NEAREST)


def _label(text, k=2, color=INK):
    """Texto con la fuente por defecto de Pillow, ampliado ×k para que se lea en una hoja grande."""
    tmp = Image.new('RGBA', (6 * len(text) + 4, 12), (0, 0, 0, 0))
    ImageDraw.Draw(tmp).text((1, 0), text, fill=color)
    return _big(tmp.crop(tmp.getbbox() or (0, 0, 1, 1)), k)


def _load(out, entry, anim):
    a = entry['animations'][anim]
    return frames_of(Image.open(out / a['file']).convert('RGBA'), entry['cellW'])


def contact_sheet(out, cid, entry, k=8):
    cw, ch = entry['cellW'] * k, entry['cellH'] * k
    pad, label_w = 16, 140
    anims = list(entry['animations'])
    width = label_w + 4 * (cw + pad) + pad
    height = 60 + len(anims) * (ch + pad + 24) + 32 * k // 2 + pad * 3
    sheet = Image.new('RGB', (width, height), BG)
    d = ImageDraw.Draw(sheet)
    title = f'{entry["name"]} ({cid}) · talla {entry["size"]} · celda {entry["cellW"]}x{entry["cellH"]} · collar {entry["collar"]}'
    t = _label(title)
    sheet.paste(t, (pad, pad), t)
    y = 60
    for anim in anims:
        a = entry['animations'][anim]
        lab = _label(f'{anim} {a["frames"]}c {a["fps"]}fps')
        sheet.paste(lab, (pad, y + ch // 2 - lab.size[1] // 2), lab)
        for i, f in enumerate(_load(out, entry, anim)):
            x = label_w + i * (cw + pad)
            d.rectangle([x - 1, y - 1, x + cw, y + ch], outline=GRID)
            d.line([x - 6, y + ch, x + cw + 6, y + ch], fill=GROUND, width=2)
            big = _big(f, k)
            sheet.paste(big, (x, y), big)
        y += ch + pad + 24
    lab = _label('portrait 32x32')
    sheet.paste(lab, (pad, y + 8), lab)
    portrait = _big(Image.open(out / entry['portrait']).convert('RGBA'), k // 2)
    d.rectangle([label_w - 1, y - 1, label_w + portrait.size[0], y + portrait.size[1]], outline=GRID)
    sheet.paste(portrait, (label_w, y), portrait)
    return sheet


def size_comparison(out, chars, k=4):
    """Todos de pie (`run` cuadro 0) y sentados (`idle` cuadro 0), en fila por talla, con reglas de altura."""
    order = sorted(chars, key=lambda c: (SIZE_ORDER.index(chars[c]['size']), chars[c]['cellH']))
    pad = 12 * k
    tallest = max(e['cellH'] for e in chars.values())
    width = pad + sum(chars[c]['cellW'] * k * 2 + pad * 2 for c in order) + pad
    height = tallest * k + 120
    sheet = Image.new('RGB', (max(width, 200), height), BG)
    d = ImageDraw.Draw(sheet)
    ground = height - 50
    for hh in range(0, tallest + 1, 8):
        yy = ground - hh * k
        d.line([0, yy, width, yy], fill=GRID)
        lab = _label(str(hh), 1)
        sheet.paste(lab, (2, yy - lab.size[1]), lab)
    d.line([0, ground, width, ground], fill=GROUND, width=2)
    x = pad
    for cid in order:
        entry = chars[cid]
        for anim in ('run', 'idle'):
            big = _big(_load(out, entry, anim)[0], k)
            sheet.paste(big, (x, ground - big.size[1]), big)
            x += big.size[0]
        lab = _label(f'{cid} {entry["cellH"] - 1}', 2)
        sheet.paste(lab, (x - entry['cellW'] * k - lab.size[0] // 2, ground + 10), lab)
        x += pad * 2
    return sheet


def small_scales(out, chars):
    """Cada personaje con todos sus cuadros a 1× y debajo a 2×, sobre el color del cielo del runner."""
    rows = []
    for cid, entry in chars.items():
        frames = [f for anim in entry['animations'] for f in _load(out, entry, anim)]
        portrait = Image.open(out / entry['portrait']).convert('RGBA')
        rows.append((frames + [portrait], entry))
    gap = 6
    width = 20 + max(sum((f.size[0] * 2 + gap) for f in fr) for fr, _ in rows)
    height = 20 + sum(e['cellH'] * 3 + 3 * gap for _, e in rows)
    sheet = Image.new('RGB', (width, height), BG_RUNNER)
    y = 10
    for frames, entry in rows:
        x = 10
        for f in frames:
            sheet.paste(f, (x, y + entry['cellH'] - f.size[1]), f)
            x += f.size[0] + gap
        y += entry['cellH'] + gap
        x = 10
        for f in frames:
            big = _big(f, 2)
            sheet.paste(big, (x, y + entry['cellH'] * 2 - big.size[1]), big)
            x += big.size[0] + gap
        y += entry['cellH'] * 2 + 2 * gap
    return sheet


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--only', default='', help='ids separados por coma (por defecto, todos)')
    parser.add_argument('--out', type=Path, default=PREVIEW_DIR)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        built = Path(tmp)
        chars = export_pack.build(built)['characters']
        if args.only:
            wanted = [c.strip() for c in args.only.split(',') if c.strip()]
            unknown = [c for c in wanted if c not in chars]
            if unknown:
                raise SystemExit(f'no existen: {", ".join(unknown)} (hay: {", ".join(chars) or "ninguno"})')
            chars = {c: chars[c] for c in wanted}
        if not chars:
            raise SystemExit('no hay personajes (ningún pack_char_*.py)')
        written = []
        for cid, entry in chars.items():
            contact_sheet(built, cid, entry).save(args.out / f'pack-{cid}.png')
            written.append(f'pack-{cid}.png')
        size_comparison(built, chars).save(args.out / 'pack-sizes.png')
        small_scales(built, chars).save(args.out / 'pack-1x2x.png')
        written += ['pack-sizes.png', 'pack-1x2x.png']
    print(f'{len(written)} hojas -> {args.out}: {", ".join(written)}')


if __name__ == '__main__':
    main()
