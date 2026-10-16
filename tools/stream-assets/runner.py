"""
Assets del Chess Runner (app chessColate): Chocolate corriendo y saltando, los efectos y los tiles del
escenario. Las piezas que hacen de obstáculos no salen de aquí: son las del set que el usuario eligió para el
tablero. Las piezas de pixel art de este módulo solo dibujan el horizonte de piezas gigantes.

Reutiliza el cuerpo y la paleta de Chocolate (`dog.py`) y las utilidades de `pixel.py`. Todo se dibuja por
código y es determinista. Los sprites miran a la derecha y los pies/la base quedan abajo.

Medidas lógicas (1 px del sprite = 1 px lógico; la app escala por un entero):
  - Chocolate: celdas de 52×40.
"""
import random

from PIL import Image, ImageDraw

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
        # Tropiezo: ojos cerrados, lengua afuera, sacudida
        'hurt': ([d(legs=(0, 0, 0, 0), bob=2, eye='closed', mouth='open', hd=(-2, 2), ear=1, tail=-1),
                  d(legs=(0, 0, 0, 0), bob=3, eye='closed', mouth='open', hd=(-1, 3), ear=1, tail=-1)], 8),
        # Contento: al llegar
        'happy': ([d(bob=-3, mouth='open', tail=1, hd=(0, -1), ear=1),
                   d(bob=0, mouth='open', tail=-1)], 6),
        # Esperando
        'idle': ([dog_mod.dog_sit(0, palette=palette), dog_mod.dog_sit(1, palette=palette)], 3),
    }


# ---------------------------------------------------------------------------- Piezas (solo para el horizonte)


class PiecePalette:
    """Colores de un bando. Cuatro tonos para el volumen más un acento dorado y un brillo."""

    def __init__(self, base, light, shade, deep, accent, spark):
        self.base, self.light, self.shade, self.deep = C(base), C(light), C(shade), C(deep)
        self.accent, self.spark = C(accent), C(spark)


# Blancas: marfil cálido. Negras: ébano con un matiz ciruela, para que no sean un negro plano.
WHITE = PiecePalette('#efe2c8', '#fff8e8', '#c9b48f', '#a98f68', '#e0a33c', '#ffffff')
BLACK = PiecePalette('#4b3a45', '#7d6574', '#33252e', '#1f161c', '#e0a33c', '#b79aac')
OUTLINE = C('#1d120d')
PIECE_PALETTES = {'w': WHITE, 'b': BLACK}

_MARK = (1, 2, 3, 255)  # color interno «sin sombrear»: lo que la pasada de volumen convierte en tonos


def _volume(sp, p):
    """
    Da volumen cilíndrico a todo lo pintado con `_MARK`: en cada fila, el tono depende de dónde cae el
    píxel entre el borde izquierdo y el derecho de la silueta (luz arriba a la izquierda). Así todas las
    piezas comparten el mismo sombreado sin dibujarlo a mano en cada una.
    """
    px = sp.load()
    w, h = sp.size
    for y in range(h):
        xs = [x for x in range(w) if px[x, y] == _MARK]
        if not xs:
            continue
        x0, x1 = xs[0], xs[-1]
        span = x1 - x0 + 1
        for x in xs:
            if span <= 3:
                px[x, y] = p.base
                continue
            u = (x - x0) / (span - 1)
            if u < 0.14:
                px[x, y] = p.light
            elif u < 0.34:
                px[x, y] = p.base
            elif u < 0.68:
                px[x, y] = p.base if span < 8 else p.base
            elif u < 0.86:
                px[x, y] = p.shade
            else:
                px[x, y] = p.deep if span >= 7 else p.shade
    return sp


def _slab(d, p, x0, x1, y0, y1):
    """Losa horizontal (peana o collar): canto iluminado arriba, sombra abajo; el resto lo sombrea el volumen."""
    R(d, x0, y0, x1, y1, _MARK)
    R(d, x0, y0, x1, y0, p.light)
    R(d, x0, y1, x1, y1, p.deep)


def _ring(d, p, x0, x1, y):
    """Una línea de sombra que separa las secciones de la pieza."""
    R(d, x0, y, x1, y, p.deep)


def _lathe(d, width, y0, halfwidths):
    """
    Dibuja una silueta de revolución: `halfwidths[i]` es el semiancho de la fila `y0 + i`, centrada en el
    sprite. Es la forma más limpia de sacar curvas suaves (cuellos, faldas, mitras) a mano en pixel art.
    """
    cx = width / 2
    for i, w in enumerate(halfwidths):
        left, right = round(cx - w), round(cx + w) - 1
        if right >= left:
            R(d, left, y0 + i, right, y0 + i, _MARK)


def _finish(sp, p):
    """Volumen y contorno, y se recorta lo vacío de abajo: la base tiene que tocar el borde del sprite
    o la pieza se vería flotando sobre el suelo."""
    out = outlined(_volume(sp, p), OUTLINE)
    bottom = out.getbbox()[3]
    return out.crop((0, 0, out.size[0], bottom))


def pawn(p):
    sp = layer(16, 22)
    d = ImageDraw.Draw(sp)
    d.polygon([(5, 10), (10, 10), (12, 18), (3, 18)], fill=_MARK)  # cuerpo
    d.ellipse([4, 0, 11, 8], fill=_MARK)  # cabeza
    R(d, 3, 9, 12, 10, _MARK)  # collar
    _ring(d, p, 3, 12, 11)
    _ring(d, p, 4, 11, 8)
    _slab(d, p, 1, 14, 19, 21)
    R(d, 5, 2, 6, 3, p.spark)  # brillo en la cabeza
    return _finish(sp, p)


def rook(p):
    sp = layer(20, 27)
    d = ImageDraw.Draw(sp)
    R(d, 2, 0, 17, 7, _MARK)  # almenas
    for x in (6, 13):  # los dos huecos entre merlones
        R(d, x, 0, x + 1, 2, (0, 0, 0, 0))
    R(d, 2, 3, 17, 3, p.light)  # cornisa
    _ring(d, p, 2, 17, 7)
    R(d, 4, 8, 15, 9, _MARK)  # cuello
    R(d, 5, 10, 14, 19, _MARK)  # fuste
    R(d, 8, 12, 11, 14, p.deep)  # tronera
    R(d, 9, 12, 10, 13, p.shade)
    _ring(d, p, 5, 14, 19)
    R(d, 3, 20, 16, 22, _MARK)  # zócalo
    R(d, 3, 20, 16, 20, p.light)
    _slab(d, p, 1, 18, 23, 26)
    return _finish(sp, p)


def bishop(p):
    sp = layer(16, 23)
    d = ImageDraw.Draw(sp)
    d.ellipse([7, 0, 8, 1], fill=p.accent)  # bolita
    d.point((7, 0), fill=p.spark)
    # mitra apuntada, cuello, collar, pie y la peana
    _lathe(d, 16, 2, [1.4, 2.4, 3.1, 3.7, 4.0, 4.1, 4.1, 4.0, 3.7, 3.2, 2.7, 2.5])
    _lathe(d, 16, 14, [5.0, 5.0, 2.8, 3.0, 3.3, 3.8, 4.6, 5.4])
    _ring(d, p, 3, 12, 13)
    _ring(d, p, 5, 10, 16)
    R(d, 3, 13, 12, 13, p.deep)
    # corte diagonal de la mitra
    for i in range(6):
        d.point((9 - i, 4 + i), fill=p.deep)
        d.point((10 - i, 4 + i), fill=p.shade)
    _slab(d, p, 2, 13, 20, 22)
    R(d, 6, 4, 6, 5, p.spark)
    return _finish(sp, p)


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
    # silueta del caballo mirando a la derecha: pecho, cuello arqueado, frente, hocico y mandíbula
    d.polygon([(6, 31), (7, 25), (9, 19), (8, 14), (10, 9), (12, 5), (14, 1), (16, 4), (19, 5), (23, 7),
               (26, 12), (26, 16), (22, 17), (18, 19), (17, 22), (19, 26), (22, 31)], fill=_MARK)
    # el volumen del cuello: luz a la izquierda, sombra bajo la mandíbula
    d.polygon([(6, 31), (7, 25), (9, 19), (8, 14), (10, 9), (12, 5), (13, 3), (13, 12), (12, 20), (12, 31)], fill=p.light)
    d.polygon([(17, 22), (19, 26), (22, 31), (15, 31), (15, 25)], fill=p.shade)
    d.polygon([(18, 19), (22, 17), (26, 16), (25, 18), (20, 20)], fill=p.shade)
    # oreja
    d.polygon([(15, 4), (16, 0), (18, 4)], fill=_MARK)
    R(d, 16, 1, 16, 3, p.shade)
    # ojo, nariz y boca
    R(d, 18, 9, 19, 10, OUTLINE)
    R(d, 19, 9, 19, 9, p.spark)
    R(d, 24, 12, 25, 13, p.deep)
    R(d, 20, 17, 23, 17, p.deep)
    # crin: mechones a lo largo del cuello
    for x, y in ((9, 8), (8, 12), (7, 16), (6, 20), (6, 24)):
        R(d, x, y, x + 2, y + 2, p.deep)
        R(d, x + 1, y, x + 1, y + 1, p.shade)
    R(d, 13, 2, 14, 4, p.accent)  # copete dorado
    _slab(d, p, 3, 24, 32, 36)
    return _finish(sp, p)


def queen(p):
    sp = layer(20, 58)
    d = ImageDraw.Draw(sp)
    # corona: tres puntas anchas con una bolita dorada en cada una
    for cx in (4, 10, 16):
        d.polygon([(cx - 3, 12), (cx, 4), (cx + 3, 12)], fill=_MARK)
        d.ellipse([cx - 1, 0, cx + 1, 3], fill=p.accent)
        d.point((cx - 1, 1), fill=p.spark)
    # aro de la corona, cuello, busto, talle y falda que se abre
    _lathe(d, 20, 11, [7.6, 7.6, 7.2, 5.2])
    _lathe(d, 20, 15, [3.8, 4.0, 4.3, 4.7, 5.0, 5.3, 5.5, 5.8, 6.0, 4.4])
    _lathe(d, 20, 25, [3.6, 3.5, 3.4, 3.4, 3.4, 3.5, 3.6, 3.8, 4.0, 4.3, 4.6, 5.0, 5.4, 5.9, 6.4, 6.9, 7.3, 7.7, 8.0, 8.2, 8.3, 8.4])
    _lathe(d, 20, 47, [8.4, 7.2, 8.2, 8.4])
    R(d, 3, 11, 16, 11, p.light)
    _ring(d, p, 4, 15, 14)
    _ring(d, p, 4, 15, 24)
    _ring(d, p, 3, 16, 46)
    R(d, 9, 17, 10, 18, p.accent)  # joya del pecho
    R(d, 9, 17, 9, 17, p.spark)
    _slab(d, p, 1, 18, 51, 55)
    return _finish(sp, p)


def king(p):
    sp = layer(18, 44)
    d = ImageDraw.Draw(sp)
    # cruz
    R(d, 8, 0, 9, 6, p.accent)
    R(d, 6, 2, 11, 3, p.accent)
    R(d, 8, 0, 8, 6, p.spark)
    # corona: arco, aro, collar, cuerpo con hombros y peana
    _lathe(d, 18, 7, [5.2, 5.8, 6.4, 6.8, 7.0, 7.1, 7.1, 7.2, 7.4])
    _lathe(d, 18, 16, [7.8, 7.8, 5.0, 4.4, 4.4, 4.6, 4.8, 5.0, 5.3, 5.6, 5.9, 6.2, 6.5, 6.8, 7.1, 7.4,
                       7.6, 7.7, 7.9, 8.1, 8.3])
    R(d, 3, 7, 14, 7, p.light)
    R(d, 7, 11, 10, 12, p.accent)  # joya de la corona
    R(d, 7, 11, 7, 11, p.spark)
    _ring(d, p, 2, 15, 15)
    _ring(d, p, 4, 13, 18)
    _ring(d, p, 3, 14, 26)
    _ring(d, p, 2, 15, 33)
    _slab(d, p, 1, 16, 37, 42)
    return _finish(sp, p)


PIECES = {'pawn': pawn, 'rook': rook, 'bishop': bishop_trio, 'knight': knight, 'queen': queen, 'king': king}


def piece_sprites():
    """Nombre -> sprite: `piece-<tipo>-<w|b>`."""
    sprites = {}
    for side, palette in PIECE_PALETTES.items():
        for kind, draw in PIECES.items():
            sprites[f'piece-{kind}-{side}'] = draw(palette)
    return sprites


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


def skyline_tile():
    """
    192×92, repetible: monumentos de piezas de ajedrez gigantes en la bruma del horizonte. Ata el escenario
    con la temática: Chocolate corre por un tablero hacia una ciudad de piezas.
    """
    sp = layer(192, 92)
    lit, dim = C('#b9d0de'), C('#a6bfd0')
    sprites = piece_sprites()
    plan = [(4, 'rook', 2), (50, 'pawn', 2), (84, 'knight', 1), (122, 'bishop', 2), (160, 'queen', 1)]
    for x, kind, scale in plan:
        # el alfil es un trío: solo se usa uno de los tres como monumento
        base = bishop(WHITE) if kind == 'bishop' else sprites[f'piece-{kind}-w']
        w, h = base.size
        mask = base.resize((w * scale, h * scale), Image.NEAREST)
        px = mask.load()
        for yy in range(mask.size[1]):
            for xx in range(mask.size[0]):
                if px[xx, yy][3] > 0:
                    px[xx, yy] = lit if xx < mask.size[0] * 0.45 else dim
        sp.paste(mask, (x, 92 - mask.size[1]), mask)
    return sp


def fx_dust():
    """Tres cuadros de una nube de polvo que crece y se apaga (12×8)."""
    frames = []
    for i, (r, a) in enumerate(((2, 235), (3, 180), (4, 110))):
        sp = layer(12, 8)
        d = ImageDraw.Draw(sp)
        col = C('#f3e6c8', a)
        d.ellipse([6 - r - 1, 7 - r - 1, 6 - r + 2, 7], fill=col)
        d.ellipse([6 + r - 2, 7 - r - 1, 6 + r + 1, 7], fill=col)
        d.ellipse([5 - r // 2, 7 - r - 2, 6 + r // 2, 7], fill=col)
        frames.append(sp)
    return frames


def fx_spark():
    """Tres cuadros de una chispa de acierto (11×11)."""
    frames = []
    for arm in (2, 4, 5):
        sp = layer(11, 11)
        d = ImageDraw.Draw(sp)
        gold, white = C('#ffd24a'), C('#ffffff')
        R(d, 5 - arm, 5, 5 + arm, 5, gold)
        R(d, 5, 5 - arm, 5, 5 + arm, gold)
        if arm >= 4:
            for k in (2, 3):
                d.point((5 - k, 5 - k), fill=gold)
                d.point((5 + k, 5 - k), fill=gold)
                d.point((5 - k, 5 + k), fill=gold)
                d.point((5 + k, 5 + k), fill=gold)
        d.point((5, 5), fill=white)
        frames.append(sp)
    return frames


def scenery():
    return {'floor': floor_tile(), 'hills': hills_tile(), 'sky': sky_tile(),
            'cloud-0': cloud(46), 'cloud-1': cloud(36), 'skyline': skyline_tile()}
