"""
El escenario: cielo, colinas, pinos, la casa, el árbol y la roca del gato, en dos versiones
(día y noche). Los personajes y la mano/hueso van aparte, como sprites que se mueven.

Lienzo lógico de 960×540; la página lo escala ×2. Es determinista: las texturas usan semillas
fijas, así regenerar da exactamente los mismos píxeles.
"""
import math
import random

from PIL import Image, ImageDraw

from pixel import C, R, layer, lerp, outlined
from props import plate

W, H = 960, 540


def _shape(img, fn):
    """Dibuja con transparencia: fn recibe un ImageDraw sobre una capa que luego se compone."""
    lay = layer(W, H)
    fn(ImageDraw.Draw(lay))
    img.alpha_composite(lay)


def _put(img, sp, x, y):
    img.paste(sp, (int(x), int(y)), sp)


def sky(d):
    """Cielo en bandas con un punteado entre ellas (da el aire de pixel art sin degradado suave)."""
    top, hor, n, hy = (150, 194, 226), (216, 235, 245), 9, 440
    cols = [tuple(lerp(top[i], hor[i], k / (n - 1)) for i in range(3)) + (255,) for k in range(n)]
    bh = hy / n
    for i, c in enumerate(cols):
        R(d, 0, int(i * bh), W, int((i + 1) * bh), c)
    for i in range(n - 1):
        y1 = int((i + 1) * bh)
        for x in range(W):
            if x % 2 == 0:
                d.point((x, y1 - 1), fill=cols[i + 1])
            if x % 4 == 0:
                d.point((x, y1 - 2), fill=cols[i + 1])


def cloud(w):
    """Una nube plana de `w` píxeles de ancho (sprite que se desplaza)."""
    cl = layer(w + 4, 30)
    d = ImageDraw.Draw(cl)
    col = C('#f1f6fa', 215)
    d.rounded_rectangle([0, 10, w, 26], radius=7, fill=col)
    d.rounded_rectangle([16, 0, 16 + w // 2, 18], radius=9, fill=col)
    d.rounded_rectangle([w // 2 + 12, 5, w - 12, 20], radius=7, fill=col)
    return cl


def pine(d, x, y, h, col):
    R(d, x - 1, y - 5, x + 1, y, C('#6b4a35'))
    for i in range(3):
        ty = y - 5 - h + i * (h // 3)
        half = int((i + 1) * h * 0.17) + 2
        d.polygon([(x, ty), (x - half, ty + h // 2), (x + half, ty + h // 2)], fill=C(col))


def house_big(lit=False, open_win=False):
    sp = layer(100, 82)
    d = ImageDraw.Draw(sp)
    R(d, 8, 32, 92, 79, C('#f6ead0'))
    R(d, 76, 32, 92, 79, C('#e3d3b0'))
    R(d, 6, 78, 94, 81, C('#b9a67c'))
    d.polygon([(0, 36), (50, 0), (100, 36)], fill=C('#d9674f'))
    d.polygon([(0, 36), (50, 0), (50, 5), (7, 36)], fill=C('#ea8268'))
    R(d, 0, 36, 100, 40, C('#b5503c'))
    R(d, 70, 6, 82, 24, C('#a86a58'))
    R(d, 68, 2, 84, 6, C('#8a4f40'))
    R(d, 56, 44, 80, 68, C('#9a7352'))
    glass = '#ffd86b' if lit else ('#4a382c' if open_win else '#a9dcf2')
    R(d, 60, 48, 76, 64, C(glass))
    if not open_win:
        R(d, 67, 48, 68, 64, C('#9a7352'))
        R(d, 60, 55, 76, 56, C('#9a7352'))
    else:
        R(d, 60, 48, 63, 62, C('#f4efe2'))
    R(d, 53, 68, 83, 72, C('#8a6444'))
    for fx, fc in ((55, '#ff6f91'), (60, '#ffd86b'), (65, '#ff6f91'), (70, '#ffd86b'), (75, '#ff6f91'), (80, '#ff6f91')):
        R(d, fx, 65, fx + 2, 67, C(fc))
    R(d, 18, 50, 38, 79, C('#9a6a48'))
    R(d, 18, 50, 38, 53, C('#7d5337'))
    R(d, 22, 56, 34, 66, C('#b88560'))
    R(d, 33, 66, 35, 68, C('#ffd86b'))
    return sp


def tree_big():
    sp = layer(64, 88)
    d = ImageDraw.Draw(sp)
    R(d, 28, 52, 36, 87, C('#7a5236'))
    R(d, 34, 52, 36, 87, C('#5e3d28'))
    for cx, cy, r, c in ((32, 32, 24, '#4fa357'), (14, 48, 14, '#4fa357'), (50, 48, 14, '#4fa357'),
                         (24, 22, 12, '#66b966'), (42, 16, 8, '#7bc977'), (50, 42, 6, '#66b966')):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=C(c))
    for ax, ay in ((18, 40), (40, 26), (50, 50), (30, 54)):
        R(d, ax, ay, ax + 2, ay + 2, C('#e8473f'))
    return sp


def rock_small():
    sp = layer(46, 24)
    d = ImageDraw.Draw(sp)
    d.polygon([(0, 23), (3, 12), (12, 4), (30, 0), (42, 9), (45, 23)], fill=C('#9a9aa6'))
    d.polygon([(12, 4), (30, 0), (42, 9), (34, 12), (16, 12)], fill=C('#b9b9c4'))
    d.polygon([(34, 12), (42, 9), (45, 23), (36, 23)], fill=C('#7b7b88'))
    return outlined(sp, C('#4c4c58'))


def background(night: bool) -> Image.Image:
    """Fondo completo sin personajes ni nubes (RGBA, 960×540). `night` lo oscurece y enciende la ventana."""
    rnd = random.Random(5)
    img = layer(W, H)
    d = ImageDraw.Draw(img)
    sky(d)

    if not night:
        for r, c, a in ((34, '#f6e6b0', 90), (24, '#f3d684', 255)):
            _shape(img, lambda dd, r=r, c=c, a=a: dd.ellipse([132 - r, 90 - r, 132 + r, 90 + r], fill=C(c, a)))

    # colinas lejanas (dos capas) y pinos
    for x in range(W):
        y = int(396 + 16 * math.sin(x / 90.0) + 5 * math.sin(x / 27.0 + 1))
        d.line([(x, y), (x, H)], fill=C('#aecab9'))
    for x in range(W):
        y = int(418 + 12 * math.sin(x / 70.0 + 2) + 4 * math.sin(x / 19.0))
        d.line([(x, y), (x, H)], fill=C('#98c58b'))
    for px_, py_, ph in ((180, 424, 34), (806, 426, 30), (834, 430, 22), (858, 428, 28), (900, 432, 20)):
        pine(d, px_, py_, ph, '#6aa275')

    # pradera continua con su textura, piedritas y flores
    R(d, 0, 432, W, H, C('#b2d492'))
    for _ in range(420):
        x, y = rnd.randint(0, W - 8), rnd.randint(438, H - 3)
        R(d, x, y, x + rnd.randint(2, 7), y, C('#a0c880'))
    for x, y in ((50, 530), (620, 505), (560, 520), (470, 492), (350, 470)):
        R(d, x, y, x + 4, y + 2, C('#a2a89a'))
    for fx, fy, fc in ((300, 505, '#ff6f91'), (610, 522, '#ffffff'), (520, 496, '#ffd86b'),
                       (25, 520, '#ff6f91'), (420, 470, '#ffd86b'), (240, 458, '#ff6f91')):
        d.point([(fx, fy), (fx - 1, fy), (fx + 1, fy), (fx, fy - 1), (fx, fy + 1)], fill=C(fc))
        d.point((fx, fy), fill=C('#ffe27a'))
        R(d, fx, fy + 2, fx, fy + 4, C('#4f8f3a'))

    def shadow(x, y, w, a=80):
        _shape(img, lambda dd: dd.ellipse([x, y, x + w, y + 7], fill=C('#4f7a3a', a)))

    # casa (con la ventana abierta por donde sale la mano), árbol y la roca del gato
    shadow(16, 458, 108)
    _put(img, house_big(False, True), 20, 382)
    shadow(128, 460, 52)
    _put(img, tree_big(), 118, 378)
    shadow(660, 468, 56)
    _put(img, rock_small(), 664, 454)

    # el plato donde cae el hueso
    shadow(87, 518, 22, 60)
    _put(img, plate(), 88, 512)

    if night:
        _shape(img, lambda dd: dd.rectangle([0, 0, W, H], fill=C('#16205a', 178)))
        nrnd = random.Random(3)
        for _ in range(110):
            x, y = nrnd.randint(0, W - 1), nrnd.randint(0, 400)
            d.point((x, y), fill=C('#ffffff') if nrnd.random() < 0.7 else C('#ffe9a8'))
        moon = Image.new('L', (W, H), 0)
        md = ImageDraw.Draw(moon)
        md.ellipse([116, 72, 150, 106], fill=255)
        md.ellipse([128, 66, 164, 100], fill=0)
        for r, a in ((42, 20), (32, 30)):
            _shape(img, lambda dd, r=r, a=a: dd.ellipse([133 - r, 89 - r, 133 + r, 89 + r], fill=C('#f4f1d8', a)))
        img.paste(C('#f4f1d8'), (0, 0), moon)
        # ventana encendida con su resplandor
        for r, a in ((34, 22), (24, 34)):
            _shape(img, lambda dd, r=r, a=a: dd.ellipse([88 - r, 438 - r, 88 + r, 438 + r], fill=C('#ffd86b', a)))
        R(d, 80, 430, 96, 446, C('#ffd86b'))
        R(d, 88, 430, 88, 446, C('#9a7352'))
        R(d, 80, 438, 96, 438, C('#9a7352'))

    return img
