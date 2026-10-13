"""Utilidades de pixel art: color, capas, rectángulos y contorno automático."""
from PIL import Image


def C(h, a=255):
    """'#rrggbb' (+ alfa) -> tupla RGBA."""
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def layer(w, h):
    """Capa RGBA transparente."""
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def R(d, x0, y0, x1, y1, c):
    """Rectángulo relleno con esquinas inclusivas."""
    d.rectangle([x0, y0, x1, y1], fill=c)


def outlined(sp, col):
    """Añade un contorno de 1 px (en 4 direcciones) alrededor de lo que no es transparente."""
    w, h = sp.size
    out = layer(w + 2, h + 2)
    px, op = sp.load(), out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    if op[x + 1 + dx, y + 1 + dy][3] == 0:
                        op[x + 1 + dx, y + 1 + dy] = col
    out.paste(sp, (1, 1), sp)
    return out


def flip(sp):
    """Voltea horizontalmente (los sprites miran a la derecha por defecto)."""
    return sp.transpose(Image.FLIP_LEFT_RIGHT)


def lerp(a, b, t):
    return int(a + (b - a) * t)
