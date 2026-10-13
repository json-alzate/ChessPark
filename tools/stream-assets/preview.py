#!/usr/bin/env python3
"""
Hoja de contacto con todos los sprites (ampliados ×4, cada cuadro con su etiqueta) para revisarlos
a ojo antes de exportar.

    python3 preview.py [salida.png]      # por defecto: preview.png junto a este archivo
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from export_assets import all_animations

SCALE = 4
BG = (92, 128, 70)
PAD = 16


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('preview.png')
    font = ImageFont.load_default(size=14)
    rows = []
    for name, (frames, fps) in all_animations().items():
        rows.append((f'{name}  ({len(frames)} {"cuadro" if len(frames) == 1 else "cuadros"}, {fps} fps)', frames))

    width = max(sum(f.size[0] * SCALE + PAD for f in frames) for _, frames in rows) + PAD
    height = sum(max(f.size[1] for f in frames) * SCALE + 36 + PAD for _, frames in rows) + PAD
    sheet = Image.new('RGB', (width, height), (47, 58, 66))
    d = ImageDraw.Draw(sheet)

    y = PAD
    for label, frames in rows:
        d.text((PAD, y), label, font=font, fill=(244, 201, 93))
        y += 22
        x = PAD
        tallest = max(f.size[1] for f in frames) * SCALE
        for frame in frames:
            big = frame.resize((frame.size[0] * SCALE, frame.size[1] * SCALE), Image.NEAREST)
            sheet.paste(Image.new('RGB', big.size, BG), (x, y + tallest - big.size[1]))
            sheet.paste(big, (x, y + tallest - big.size[1]), big)
            x += big.size[0] + PAD
        y += tallest + 14 + PAD
    sheet.save(out)
    print(f'{len(rows)} animaciones -> {out}')


if __name__ == '__main__':
    main()
