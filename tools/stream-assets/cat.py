"""El gato naranja: pequeño (proporción real frente al perro) y dormido."""
from dataclasses import dataclass

from PIL import ImageDraw

from pixel import C, R, layer, outlined


@dataclass(frozen=True)
class CatPalette:
    fur: tuple
    stripe: tuple
    belly: tuple
    pink: tuple
    eye_green: tuple
    dark: tuple          # ojos cerrados, nariz y boca
    tongue: tuple
    outline: tuple


ORANGE_TABBY = CatPalette(
    fur=C('#f0a24c'), stripe=C('#c46f26'), belly=C('#fff1dc'), pink=C('#ff9bb0'),
    eye_green=C('#8be39a'), dark=C('#1a100c'), tongue=C('#ff6f8e'), outline=C('#4a2a14'),
)


def cat_s(pose='sit', f=0, palette=ORANGE_TABBY):
    """Sentado. pose: 'sit' (ojos abiertos), 'tease' (saca la lengua y saluda con la pata; f alterna) o 'smug' (ojos cerrados)."""
    p = palette
    sp = layer(26, 28)
    d = ImageDraw.Draw(sp)
    d.ellipse([5, 14, 20, 27], fill=p.fur)
    d.ellipse([9, 17, 16, 27], fill=p.belly)
    R(d, 6, 25, 9, 27, p.belly)
    R(d, 14, 25, 17, 27, p.belly)
    R(d, 20, 22, 24, 26, p.fur)
    R(d, 23, 14 - f, 25, 22, p.fur)
    R(d, 23, 12 - f, 25, 15 - f, p.stripe)
    d.ellipse([3, 3, 21, 17], fill=p.fur)
    d.polygon([(3, 8), (4, 0), (10, 4)], fill=p.fur)
    d.polygon([(14, 4), (20, 0), (21, 8)], fill=p.fur)
    d.point([(5, 3), (19, 3)], fill=p.pink)
    R(d, 11, 4, 12, 6, p.stripe)
    R(d, 8, 5, 8, 6, p.stripe)
    R(d, 15, 5, 15, 6, p.stripe)

    def eye(x, y, kind):
        if kind == 'open':
            R(d, x, y, x + 1, y + 2, p.eye_green)
            d.point((x, y), fill=p.dark)
            d.point((x + 1, y + 1), fill=p.dark)
        elif kind == 'closed':
            R(d, x, y + 2, x + 2, y + 2, p.dark)
        elif kind == 'happy':
            d.point([(x, y + 2), (x + 1, y + 1), (x + 2, y + 2)], fill=p.dark)

    if pose == 'sit':
        eye(7, 9, 'open')
        eye(14, 9, 'open')
    elif pose == 'tease':
        eye(6, 9, 'happy')
        eye(14, 9, 'happy')
        R(d, 11, 14, 12, 16, p.tongue)
        R(d, 0 + f, 14 - f * 2, 2 + f, 22 - f * 2, p.fur)
        R(d, 0 + f, 12 - f * 2, 2 + f, 14 - f * 2, p.belly)
    elif pose == 'smug':
        eye(6, 9, 'closed')
        eye(14, 9, 'closed')
    R(d, 11, 12, 12, 12, p.pink)
    if pose != 'tease':
        R(d, 10, 13, 13, 13, p.dark)
    return outlined(sp, p.outline)


def cat_sleep_s(f=0, palette=ORANGE_TABBY):
    """Hecho un ovillo. `f` sube y baja un píxel la cabeza."""
    p = palette
    sp = layer(28, 12)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 3, 20, 11], fill=p.fur)
    R(d, 5, 4, 15, 4, p.stripe)
    R(d, 5, 7, 15, 7, p.stripe)
    d.ellipse([13, 3 + f, 26, 11], fill=p.fur)
    d.polygon([(14, 5 + f), (15, 0 + f), (19, 4 + f)], fill=p.fur)
    d.polygon([(20, 4 + f), (24, 0 + f), (26, 6 + f)], fill=p.fur)
    R(d, 16, 8 + f, 18, 8 + f, p.dark)
    R(d, 21, 8 + f, 23, 8 + f, p.dark)
    R(d, 0, 8, 8, 11, p.stripe)
    return outlined(sp, p.outline)
