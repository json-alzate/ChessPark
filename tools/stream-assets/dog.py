"""
Perros en pixel art, estilo mascota (cabezón, patitas cortas, lengua afuera).

Todos los poses reciben una `DogPalette`: un perro nuevo del mismo cuerpo es solo una paleta nueva
(ver `DOG_PALETTES`). Un perro con otras proporciones (otra raza) pide dibujar sus propios poses.

Los sprites miran a la derecha; los pies quedan abajo. El contorno se añade solo.
"""
from dataclasses import dataclass

from PIL import ImageDraw

from pixel import C, R, layer, outlined

# Desplazamiento horizontal común para dejar sitio a la cola, que sobresale por la izquierda.
OX = 4


@dataclass(frozen=True)
class DogPalette:
    body: tuple
    light: tuple       # reflejo del lomo y de la cabeza
    dark: tuple        # patas del lado lejano y sombra del vientre
    ear: tuple
    tail: tuple
    muzzle: tuple
    muzzle_light: tuple
    nose: tuple
    collar: tuple
    collar_stripe: tuple
    tag: tuple         # chapita del collar
    tongue: tuple
    tongue_shade: tuple
    paw: tuple
    outline: tuple
    cheek: tuple = C('#d98c8c')
    eye_white: tuple = C('#ffffff')
    mouth_dark: tuple = C('#4a1420')
    dirt: tuple = C('#8a6240')
    ball: tuple = C('#e8473f')
    ball_shine: tuple = C('#ffb3a8')


# Chocolate: labrador chocolate de hocico gris, collar verde.
CHOCOLATE = DogPalette(
    body=C('#6e4331'), light=C('#8c5a43'), dark=C('#4d2e21'),
    ear=C('#52301f'), tail=C('#3a2218'),
    muzzle=C('#cdbfb2'), muzzle_light=C('#e3d9cf'),
    nose=C('#1a100c'), collar=C('#7fd35a'), collar_stripe=C('#f0903c'), tag=C('#ffd24a'),
    tongue=C('#ff8aa1'), tongue_shade=C('#e0587a'), paw=C('#4d2e21'), outline=C('#2a1710'),
)

# Todos los perros de la escena. Para sumar uno: añade aquí su paleta y expórtalo (ver README).
DOG_PALETTES = {'chocolate': CHOCOLATE}


def _leg(d, x, y0, y1, dx, color, p):
    x += OX
    d.polygon([(x, y0), (x + 4, y0), (x + dx + 4, y1), (x + dx, y1)], fill=color)
    R(d, x + dx, y1 - 1, x + dx + 5, y1, p.paw)


def _eye(d, ex, ey, p, closed=False):
    if closed:
        R(d, ex, ey + 1, ex, ey + 1, p.nose)
        R(d, ex + 1, ey, ex + 2, ey, p.nose)
        R(d, ex + 3, ey + 1, ex + 3, ey + 1, p.nose)
    else:
        R(d, ex, ey, ex + 2, ey + 3, p.nose)
        R(d, ex + 1, ey, ex + 1, ey, p.eye_white)


def dog_c(legs=(0, 0, 0, 0), bob=0, tail=0, hd=(0, 0), mouth='smile', eye='open', ear=0, lift=0,
          carry=False, palette=CHOCOLATE):
    """De pie / caminando / corriendo. `legs` son los desplazamientos de las 4 patas; `hd` mueve la cabeza."""
    p = palette
    sp = layer(50, 38)
    d = ImageDraw.Draw(sp)
    oy = bob
    hx, hy = hd
    for i, x in ((0, 7), (2, 22)):
        _leg(d, x, 24 + oy, 33 - lift, legs[i], p.dark, p)
    # cola
    t = {0: [(3, 17), (0, 13), (0, 8), (3, 7), (5, 12), (7, 17)],
         1: [(3, 17), (-0, 16), (0, 11), (3, 11), (5, 14), (7, 18)],
         -1: [(3, 17), (0, 20), (0, 25), (3, 25), (5, 21), (7, 18)]}[tail]
    d.polygon([(x + OX, y + oy) for x, y in t], fill=p.tail)
    # cuerpo
    d.ellipse([3 + OX, 13 + oy, 24 + OX, 26 + oy], fill=p.body)
    R(d, 9 + OX, 13 + oy, 19 + OX, 14 + oy, p.light)
    R(d, 6 + OX, 25 + oy, 21 + OX, 25 + oy, p.dark)
    for i, x in ((1, 3), (3, 18)):
        _leg(d, x, 24 + oy, 33 - lift, legs[i], p.body, p)
    # cabeza grande
    X, Y = OX + hx, oy + hy
    d.ellipse([19 + X, 2 + Y, 36 + X, 19 + Y], fill=p.body)
    R(d, 24 + X, 3 + Y, 31 + X, 4 + Y, p.light)
    d.rounded_rectangle([29 + X, 10 + Y, 39 + X, 18 + Y], radius=3, fill=p.muzzle)
    R(d, 30 + X, 16 + Y, 38 + X, 17 + Y, p.muzzle_light)
    R(d, 38 + X, 10 + Y, 39 + X, 12 + Y, p.nose)
    _eye(d, 30 + X, 7 + Y, p, closed=(eye == 'closed'))
    R(d, 30 + X, 5 + Y, 32 + X, 5 + Y, p.light)
    d.point((28 + X, 13 + Y), fill=p.cheek)
    if mouth == 'smile':
        R(d, 31 + X, 16 + Y, 37 + X, 16 + Y, p.dark)
        d.point((30 + X, 15 + Y), fill=p.dark)
        R(d, 33 + X, 17 + Y, 35 + X, 20 + Y, p.tongue)
        R(d, 34 + X, 18 + Y, 34 + X, 19 + Y, p.tongue_shade)
    elif mouth == 'open':
        R(d, 31 + X, 15 + Y, 38 + X, 17 + Y, p.mouth_dark)
        R(d, 32 + X, 18 + Y, 37 + X, 19 + Y, p.muzzle_light)
        R(d, 33 + X, 16 + Y, 36 + X, 19 + Y, p.tongue)
        R(d, 34 + X, 17 + Y, 35 + X, 18 + Y, p.tongue_shade)
    # oreja caída
    ex = 0 if ear == 0 else -3
    d.ellipse([17 + X + ex, 4 + Y + (0 if ear == 0 else -1), 25 + X + ex, 17 + Y + (0 if ear == 0 else -4)], fill=p.ear)
    # collar
    R(d, 18 + X, 17 + Y, 23 + X, 20 + Y, p.collar)
    d.point([(19 + X, 18 + Y), (21 + X, 18 + Y)], fill=p.collar_stripe)
    d.ellipse([20 + X, 20 + Y, 22 + X, 22 + Y], fill=p.tag)
    if carry:
        d.ellipse([37 + X, 14 + Y, 46 + X, 23 + Y], fill=p.ball)
        R(d, 39 + X, 16 + Y, 40 + X, 17 + Y, p.ball_shine)
    return outlined(sp, p.outline)


def dog_sit(f=0, tilt=False, palette=CHOCOLATE):
    """Sentado. `f` alterna la cola (0/1); `tilt` ladea la cabeza (curiosidad)."""
    p = palette
    sp = layer(42, 40)
    d = ImageDraw.Draw(sp)
    wag = (0, 3)[f]
    d.polygon([(2, 36), (0, 33 - wag), (4, 31 - wag), (8, 34)], fill=p.tail)
    d.ellipse([3, 24, 19, 39], fill=p.body)
    d.ellipse([9, 12, 25, 36], fill=p.body)
    R(d, 12, 12, 19, 13, p.light)
    R(d, 19, 26, 23, 39, p.body)
    R(d, 19, 38, 25, 39, p.paw)
    R(d, 14, 26, 18, 39, p.dark)
    R(d, 13, 38, 19, 39, p.paw)
    R(d, 5, 38, 16, 39, p.paw)
    X, Y = 2, (0 if not tilt else 1)
    d.ellipse([14 + X, 0 + Y, 31 + X, 17 + Y], fill=p.body)
    d.rounded_rectangle([25 + X, 8 + Y, 35 + X, 16 + Y], radius=3, fill=p.muzzle)
    R(d, 26 + X, 14 + Y, 34 + X, 15 + Y, p.muzzle_light)
    R(d, 34 + X, 8 + Y, 35 + X, 10 + Y, p.nose)
    _eye(d, 26 + X, 5 + Y, p)
    R(d, 26 + X, 3 + Y, 28 + X, 3 + Y, p.light)
    R(d, 27 + X, 14 + Y, 33 + X, 14 + Y, p.dark)
    d.point((26 + X, 13 + Y), fill=p.dark)
    R(d, 29 + X, 15 + Y, 31 + X, 18 + Y, p.tongue)
    R(d, 30 + X, 16 + Y, 30 + X, 17 + Y, p.tongue_shade)
    ey = 0 if not tilt else -3
    d.ellipse([12 + X, 2 + Y + ey, 20 + X, 15 + Y + ey], fill=p.ear)
    R(d, 14 + X, 15 + Y, 19 + X, 18 + Y, p.collar)
    d.point([(15 + X, 16 + Y), (17 + X, 16 + Y)], fill=p.collar_stripe)
    return outlined(sp, p.outline)


def dog_dig(f=0, palette=CHOCOLATE):
    """Cavando: cabeza abajo, patas delanteras rascando (f alterna) y la cola en alto."""
    p = palette
    sp = layer(52, 40)
    d = ImageDraw.Draw(sp)
    wag = (0, 4)[f]
    d.polygon([(8, 14), (5 - wag // 2, 8), (4 - wag, 2), (7 - wag, 1), (9 - wag // 2, 7), (12, 14)], fill=p.tail)
    _leg(d, 6, 24, 37, 0, p.dark, p)
    _leg(d, 2, 24, 37, 0, p.body, p)
    d.ellipse([3 + OX, 11, 26 + OX, 28], fill=p.body)
    R(d, 9 + OX, 11, 20 + OX, 12, p.light)
    fx = 6 if f == 0 else -1
    _leg(d, 20, 24, 37, fx, p.dark, p)
    _leg(d, 16, 24, 37, fx + (2 if f == 0 else 0), p.body, p)
    # cabeza abajo
    d.ellipse([25 + OX, 18, 40 + OX, 33], fill=p.body)
    d.rounded_rectangle([34 + OX, 25, 43 + OX, 33], radius=3, fill=p.muzzle)
    R(d, 42 + OX, 26, 43 + OX, 28, p.nose)
    _eye(d, 34 + OX, 22, p)
    d.ellipse([22 + OX, 20, 30 + OX, 33], fill=p.ear)
    R(d, 22 + OX, 21, 26 + OX, 25, p.collar)
    if f == 1:
        for x, y in ((12, 31), (16, 34), (20, 32), (9, 34), (24, 35)):
            R(d, x + OX, y, x + OX + 1, y + 1, p.dirt)
    return outlined(sp, p.outline)


def dog_sleep(f=0, palette=CHOCOLATE):
    """Dormido, enroscado. `f` sube y baja un píxel la cabeza (respiración)."""
    p = palette
    sp = layer(48, 20)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 4, 30, 19], fill=p.body)
    R(d, 6, 5, 22, 6, p.light)
    d.polygon([(0, 14), (3, 10), (14, 13), (14, 19), (0, 19)], fill=p.tail)
    d.ellipse([22, 5 + f, 40, 19], fill=p.body)
    d.rounded_rectangle([34, 11 + f, 46, 19], radius=3, fill=p.muzzle)
    R(d, 45, 11 + f, 46, 13 + f, p.nose)
    d.ellipse([22, 6 + f, 30, 18], fill=p.ear)
    _eye(d, 34, 8 + f, p, closed=True)
    R(d, 24, 16, 30, 19, p.collar)
    R(d, 30, 17, 44, 19, p.paw)
    return outlined(sp, p.outline)
