"""
Assets del Chess Runner (app chessColate): Chocolate corriendo y saltando, las piezas de ajedrez como
obstáculos, los iconos de pista y los tiles del escenario.

Reutiliza el cuerpo y la paleta de Chocolate (`dog.py`) y las utilidades de `pixel.py`. Todo se dibuja por
código y es determinista. Los sprites miran a la derecha y los pies/la base quedan abajo.

Medidas lógicas (1 px del sprite = 1 px lógico; la app escala por un entero):
  - Chocolate: celdas de 52×40.
  - Piezas: peón 16×22, torre 20×28, alfil (trío) 52×24, caballo 28×38, dama 20×58, rey 18×44.
"""
import random

from PIL import ImageDraw

import dog as dog_mod
from pixel import C, R, layer, lerp, outlined

# ---------------------------------------------------------------------------- Chocolate


def _dog(palette, **kw):
    return dog_mod.dog_c(palette=palette, **kw)


def dog_animations(palette=dog_mod.CHOCOLATE):
    """Las poses de Chocolate en el runner: nombre -> (cuadros, fps)."""
    d = lambda **kw: _dog(palette, **kw)  # noqa: E731
    return {
        # Galope: se estira, se recoge, se estira al otro lado, se recoge
        'run': ([d(legs=(-6, -4, 6, 4), bob=-2, lift=2, ear=1, mouth='open', tail=1),
                 d(legs=(2, 3, -2, -3), bob=0, lift=3, ear=1, mouth='open'),
                 d(legs=(4, 6, -4, -6), bob=-2, lift=2, ear=1, mouth='open', tail=1),
                 d(legs=(-2, -3, 2, 3), bob=0, lift=3, ear=1, mouth='open')], 12),
        # Salto: sube con las patas estiradas, en la cima las recoge y al bajar las adelanta
        'jump': ([d(legs=(-7, -5, 7, 5), bob=-3, lift=3, ear=1, mouth='open', hd=(1, -1), tail=1),
                  d(legs=(1, 1, -1, -1), bob=-3, lift=7, ear=1, mouth='open', hd=(0, -1), tail=0),
                  d(legs=(5, 3, 8, 6), bob=-1, lift=2, ear=1, mouth='open', hd=(0, 1), tail=-1)], 1),
        # Agachado: panza al suelo, patas estiradas, cabeza al frente
        'slide': ([d(legs=(-7, -5, 7, 5), bob=8, lift=0, ear=1, mouth='open', hd=(2, 0), tail=-1),
                   d(legs=(-5, -7, 5, 7), bob=8, lift=0, ear=1, mouth='open', hd=(2, 0), tail=-1)], 10),
        # Tropiezo: ojos cerrados, lengua afuera, sacudida
        'hurt': ([d(legs=(0, 0, 0, 0), bob=2, eye='closed', mouth='open', hd=(-2, 2), ear=1, tail=-1),
                  d(legs=(0, 0, 0, 0), bob=3, eye='closed', mouth='open', hd=(-1, 3), ear=1, tail=-1)], 8),
        # Contento: al llegar
        'happy': ([d(bob=-3, mouth='open', tail=1, hd=(0, -1), ear=1),
                   d(bob=0, mouth='open', tail=-1)], 6),
        # Esperando
        'idle': ([dog_mod.dog_sit(0, palette=palette), dog_mod.dog_sit(1, palette=palette)], 3),
    }


# ---------------------------------------------------------------------------- Piezas


class PiecePalette:
    """Colores de un bando. `light` y `shade` dan volumen; `outline` es común a ambos."""

    def __init__(self, base, light, shade, accent):
        self.base, self.light, self.shade, self.accent = C(base), C(light), C(shade), C(accent)


WHITE = PiecePalette('#f1e6d0', '#ffffff', '#c3ae8d', '#d99a3d')
BLACK = PiecePalette('#46343b', '#765b66', '#271a1f', '#d99a3d')
OUTLINE = C('#1d120d')
PIECE_PALETTES = {'w': WHITE, 'b': BLACK}


def _base(d, p, x0, x1, y0, y1):
    """Peana común: una losa ancha con reflejo arriba y sombra abajo."""
    R(d, x0, y0, x1, y1, p.base)
    R(d, x0, y0, x1, y0, p.light)
    R(d, x0, y1, x1, y1, p.shade)


def pawn(p):
    sp = layer(16, 22)
    d = ImageDraw.Draw(sp)
    d.polygon([(5, 10), (10, 10), (12, 18), (3, 18)], fill=p.base)
    R(d, 5, 10, 6, 17, p.light)
    R(d, 10, 12, 11, 18, p.shade)
    d.ellipse([4, 0, 11, 8], fill=p.base)
    R(d, 5, 1, 6, 3, p.light)
    R(d, 3, 9, 12, 10, p.base)
    R(d, 3, 10, 12, 10, p.shade)
    _base(d, p, 1, 14, 19, 21)
    return outlined(sp, OUTLINE)


def rook(p):
    sp = layer(20, 28)
    d = ImageDraw.Draw(sp)
    R(d, 2, 0, 17, 7, p.base)
    for x in (6, 13):  # huecos de las almenas
        R(d, x, 0, x + 1, 2, (0, 0, 0, 0))
    R(d, 2, 0, 3, 7, p.light)
    R(d, 16, 2, 17, 7, p.shade)
    R(d, 4, 8, 15, 9, p.shade)
    R(d, 5, 10, 14, 19, p.base)
    R(d, 5, 10, 6, 19, p.light)
    R(d, 13, 10, 14, 19, p.shade)
    R(d, 3, 20, 16, 22, p.base)
    R(d, 3, 20, 16, 20, p.light)
    _base(d, p, 1, 18, 23, 26)
    return outlined(sp, OUTLINE)


def bishop(p):
    sp = layer(16, 24)
    d = ImageDraw.Draw(sp)
    d.ellipse([7, 0, 9, 2], fill=p.accent)
    d.ellipse([4, 2, 11, 13], fill=p.base)
    R(d, 5, 4, 6, 9, p.light)
    R(d, 10, 6, 11, 11, p.shade)
    R(d, 8, 5, 9, 7, p.shade)  # el corte de la mitra
    R(d, 7, 6, 8, 6, p.shade)
    R(d, 3, 13, 12, 14, p.base)
    R(d, 3, 14, 12, 14, p.shade)
    d.polygon([(5, 15), (10, 15), (11, 19), (4, 19)], fill=p.base)
    R(d, 5, 15, 6, 18, p.light)
    _base(d, p, 2, 13, 20, 22)
    return outlined(sp, OUTLINE)


def bishop_trio(p):
    """Un alfil no es alto: es una fila de tres que hay que saltar de un tirón."""
    one = bishop(p)
    w, h = one.size
    step = w - 3
    sp = layer(step * 2 + w, h)
    for i in range(3):
        sp.paste(one, (i * step, 0), one)
    return sp


def knight(p):
    sp = layer(28, 38)
    d = ImageDraw.Draw(sp)
    # silueta del caballo mirando a la derecha: cuello, hocico, orejas
    d.polygon([(6, 31), (7, 25), (10, 19), (9, 14), (11, 9), (13, 4), (15, 0), (17, 4), (22, 6),
               (26, 11), (26, 16), (21, 17), (17, 19), (19, 25), (22, 31)], fill=p.base)
    d.polygon([(6, 31), (7, 25), (10, 19), (9, 14), (11, 9), (13, 4), (15, 3), (13, 12), (13, 20), (12, 31)],
              fill=p.light)
    d.polygon([(19, 25), (22, 31), (17, 31), (16, 24)], fill=p.shade)
    R(d, 23, 11, 25, 12, p.shade)  # nariz
    R(d, 17, 8, 18, 9, p.nose if hasattr(p, 'nose') else OUTLINE)  # ojo
    # crin
    for i, (x, y) in enumerate(((9, 12), (9, 16), (8, 20), (7, 24))):
        R(d, x - 1, y, x, y + 2, p.shade)
    R(d, 14, 1, 15, 3, p.accent)  # copete
    _base(d, p, 3, 24, 32, 36)
    return outlined(sp, OUTLINE)


def queen(p):
    sp = layer(20, 58)
    d = ImageDraw.Draw(sp)
    # corona: cuatro puntas con una bolita en cada una y huecos en V entre ellas
    for cx in (4, 8, 12, 16):
        d.polygon([(cx - 2, 11), (cx, 4), (cx + 2, 11)], fill=p.base)
        R(d, cx - 1, 4, cx - 1, 9, p.light)
        d.ellipse([cx - 1, 0, cx + 1, 2], fill=p.accent)
    R(d, 2, 10, 17, 11, p.base)
    R(d, 2, 10, 17, 10, p.light)
    R(d, 3, 12, 16, 14, p.base)
    R(d, 3, 14, 16, 14, p.shade)
    # cuerpo esbelto
    d.polygon([(6, 15), (13, 15), (16, 42), (3, 42)], fill=p.base)
    R(d, 6, 15, 7, 41, p.light)
    R(d, 13, 18, 15, 41, p.shade)
    R(d, 3, 28, 16, 29, p.shade)
    R(d, 3, 43, 16, 46, p.base)
    R(d, 3, 43, 16, 43, p.light)
    R(d, 4, 47, 15, 49, p.base)
    R(d, 4, 49, 15, 49, p.shade)
    _base(d, p, 1, 18, 50, 55)
    return outlined(sp, OUTLINE)


def king(p):
    sp = layer(18, 44)
    d = ImageDraw.Draw(sp)
    # cruz
    R(d, 8, 0, 9, 6, p.accent)
    R(d, 6, 2, 11, 3, p.accent)
    # corona
    R(d, 3, 7, 14, 9, p.base)
    R(d, 3, 7, 14, 7, p.light)
    d.polygon([(3, 10), (14, 10), (15, 16), (2, 16)], fill=p.base)
    R(d, 4, 10, 5, 15, p.light)
    R(d, 12, 11, 14, 15, p.shade)
    R(d, 2, 16, 15, 17, p.base)
    R(d, 2, 17, 15, 17, p.shade)
    # cuerpo
    d.polygon([(5, 18), (12, 18), (14, 33), (3, 33)], fill=p.base)
    R(d, 5, 18, 6, 32, p.light)
    R(d, 11, 20, 13, 32, p.shade)
    R(d, 3, 34, 14, 36, p.base)
    R(d, 3, 34, 14, 34, p.light)
    _base(d, p, 1, 16, 37, 42)
    return outlined(sp, OUTLINE)


PIECES = {'pawn': pawn, 'rook': rook, 'bishop': bishop_trio, 'knight': knight, 'queen': queen, 'king': king}


def piece_sprites():
    """Nombre -> sprite: `piece-<tipo>-<w|b>`."""
    sprites = {}
    for side, palette in PIECE_PALETTES.items():
        for kind, draw in PIECES.items():
            sprites[f'piece-{kind}-{side}'] = draw(palette)
    return sprites


# ---------------------------------------------------------------------------- Pistas

HINT_INK = C('#ffb347')
HINT_SHADE = C('#d9792b')
HINT_OUT = C('#3a1f10')

# 11×11. '#' = tinta, 'o' = sombra
_HINTS = {
    # un salto
    'jump': ['.....#.....', '....###....', '...#####...', '..#######..', '.#########.', '....###....',
             '....###....', '....###....', '....###....', '...........', '...........'],
    # agacharse
    'slide': ['...........', '...........', '....###....', '....###....', '....###....', '....###....',
              '.#########.', '..#######..', '...#####...', '....###....', '.....#.....'],
    # saltar y mantener: flecha arriba y el símbolo de pausa
    'hold': ['.....#.....', '....###....', '...#####...', '.....#.....', '.....#.....', '...........',
             '..###.###..', '..###.###..', '..###.###..', '..###.###..', '...........'],
    # doble salto
    'double': ['.....#.....', '....###....', '...#####...', '..#######..', '.....#.....', '....###....',
               '...#####...', '..#######..', '....###....', '....###....', '...........'],
    # salto corto y preciso: flecha con un objetivo
    'precise': ['....###....', '...#...#...', '..#..#..#..', '..#.###.#..', '..#..#..#..', '...#...#...',
                '....###....', '.....#.....', '....###....', '...#####...', '...........'],
}


def _long_jump_hint():
    """Flecha diagonal hacia arriba y adelante: salto largo."""
    sp = layer(11, 11)
    d = ImageDraw.Draw(sp)
    d.line([(1, 9), (7, 3)], fill=HINT_INK, width=3)
    d.polygon([(10, 0), (3, 1), (9, 7)], fill=HINT_INK)
    d.line([(1, 10), (7, 4)], fill=HINT_SHADE, width=1)
    return outlined(sp, HINT_OUT)


def hint_icons():
    """Nombre -> icono de pista de 13×13 (con contorno)."""
    icons = {}
    for name, rows in _HINTS.items():
        sp = layer(11, 11)
        px = sp.load()
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == '#':
                    px[x, y] = HINT_INK if (y + x) % 5 else HINT_SHADE
        icons[f'hint-{name}'] = outlined(sp, HINT_OUT)
    icons['hint-long'] = _long_jump_hint()
    return dict(sorted(icons.items()))


# ---------------------------------------------------------------------------- Escenario

def floor_tile():
    """32×20: dos casillas de tablero, con el canto iluminado y la sombra de la cara frontal."""
    sp = layer(32, 20)
    d = ImageDraw.Draw(sp)
    light, dark = C('#e9d8b4'), C('#a8794d')
    R(d, 0, 0, 15, 11, light)
    R(d, 16, 0, 31, 11, dark)
    R(d, 0, 0, 31, 0, C('#fff3d6'))  # canto iluminado
    # cara frontal: se ve el grosor del tablero
    R(d, 0, 12, 31, 19, C('#5a3a26'))
    R(d, 0, 12, 31, 12, C('#7a5538'))
    R(d, 15, 12, 16, 19, C('#4a2f1e'))
    return sp


def hills_tile():
    """128×44, repetible: colinas suaves en dos tonos, para el paralaje del fondo."""
    sp = layer(128, 44)
    d = ImageDraw.Draw(sp)
    far, near = C('#9fb98e'), C('#82a272')
    for x in range(128):
        # suma de senos con periodo que divide 128: el tile se repite sin costura
        h1 = 22 + 8 * _sin(x, 128, 1) + 5 * _sin(x + 20, 128, 2)
        h2 = 12 + 6 * _sin(x + 40, 128, 2) + 3 * _sin(x, 128, 4)
        d.line([(x, 44 - int(h1)), (x, 43)], fill=far)
        d.line([(x, 44 - int(h2)), (x, 43)], fill=near)
    return sp


def _sin(x, period, k):
    import math
    return math.sin(2 * math.pi * k * x / period)


def sky_tile():
    """4×128, repetible en horizontal: bandas de cielo con el punteado entre ellas (como el del directo)."""
    w, h = 4, 128
    top, hor, n = (150, 194, 226), (216, 235, 245), 7
    cols = [tuple(lerp(top[i], hor[i], k / (n - 1)) for i in range(3)) + (255,) for k in range(n)]
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    bh = h / n
    for i, c in enumerate(cols):
        R(d, 0, int(i * bh), w - 1, int((i + 1) * bh), c)
    for i in range(n - 1):
        y1 = int((i + 1) * bh)
        for x in range(w):
            if x % 2 == 0:
                d.point((x, y1 - 1), fill=cols[i + 1])
    return sp


def cloud(w):
    cl = layer(w + 4, 22)
    d = ImageDraw.Draw(cl)
    col = C('#f7fbfd', 230)
    rnd = random.Random(w)
    d.rounded_rectangle([2, 10, w + 1, 19], radius=5, fill=col)
    x = 6
    while x < w - 8:
        r = rnd.randint(5, 8)
        d.ellipse([x, 10 - r, x + r * 2, 12 + r - 6], fill=col)
        x += rnd.randint(8, 12)
    return cl


def scenery():
    return {'floor': floor_tile(), 'hills': hills_tile(), 'sky': sky_tile(),
            'cloud-0': cloud(46), 'cloud-1': cloud(36)}
