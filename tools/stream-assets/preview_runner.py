#!/usr/bin/env python3
"""
Hoja de contacto de los assets del Chess Runner, ampliados ×4, para revisarlos a ojo.

    ./.venv/bin/python preview_runner.py [salida.png]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from export_runner import all_sprites

SCALE = 4
PAD = 14


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('preview-runner.png')
    font = ImageFont.load_default(size=13)
    groups = {}
    for name, (frames, _fps) in all_sprites().items():
        groups.setdefault(name.split('-')[0], []).append((name, frames))

    sheet_w = 1500
    rows, x, y, row_h = [], PAD, PAD, 0
    sheet = Image.new('RGB', (sheet_w, 2400), (88, 126, 92))
    d = ImageDraw.Draw(sheet)
    for group, items in groups.items():
        d.text((PAD, y), group.upper(), font=font, fill=(255, 224, 140))
        y += 20
        x, row_h = PAD, 0
        for name, frames in items:
            width = sum(f.size[0] * SCALE + 6 for f in frames)
            if x + width > sheet_w - PAD:
                x, y = PAD, y + row_h + 22
                row_h = 0
            d.text((x, y), name, font=font, fill=(255, 255, 255))
            cx = x
            tallest = max(f.size[1] for f in frames) * SCALE
            for f in frames:
                big = f.resize((f.size[0] * SCALE, f.size[1] * SCALE), Image.NEAREST)
                sheet.paste(big, (cx, y + 16 + tallest - big.size[1]), big)
                cx += big.size[0] + 6
            x += width + PAD
            row_h = max(row_h, tallest + 16)
        y += row_h + 26
    sheet = sheet.crop((0, 0, sheet_w, y))
    sheet.save(out)
    print(f'hoja -> {out} ({sheet.size[0]}×{sheet.size[1]})')


if __name__ == '__main__':
    main()
