"""
Zona 4 «Cañón» del mapa del Chess Runner (jefe: el caballo; oscuridad 3): llanura y cañón rojizo, cercas y establos viejos;
cielo cubierto y polvo. Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110, donde sale el de la zona 3), cruza la llanura, salva la garganta del cañón por un puente
de tablas, pasa junto al campamento y sube al rancho viejo del jefe (establo, corral); sale por arriba (x = 110) por el paso
entre dos farallones.

Luz: cielo cubierto, así que no hay sol ni sombras largas: sombras cortas y difusas y grandes manchas de nube sobre la
tierra. El polvo es una capa aparte (el remolino y la bruma, en el ambiente), no el color del suelo.

Puntos: mismo reparto que las zonas 1–3:
  1 pattern · 2 pattern · 3 pattern · 4 rescue · 5 pattern · 6 pattern · 7 camp · 8 boss

Ambiente: `remolino` (un remolino de polvo que gira en la llanura), `rodadora` (una planta rodadora que cruza dando
botes), `caballo` (un caballo junto a la cerca del corral que mueve la cola y baja la cabeza), `humo` (humo de la chimenea
del establo viejo) y `bruma` (velos de polvo que se arrastran sobre la llanura).
"""
import functools
import math
import random

from PIL import Image, ImageDraw

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 4
LEVEL = 3

# Tierra terracota con saturación de sobra: el `grade` del nivel 3 le quita un tercio y la enfría; con menos, sale malva.
# Y un poco más oscura que la de la prueba de la auditoría (#c4623a): la zona 4 tiene que perder saturación + luz respecto
# a la selva (prueba `test_cada_zona_es_mas_tenebrosa_que_la_anterior`), y la terracota gana saturación al oscurecerla.
GROUND = {'base': C('#b05434'), 'light': C('#bc603a'), 'dark': C('#a04a2a'), 'dash': C('#984628'),
          'dash2': C('#c87248'), 'tuft': C('#84723e')}
CLOUD = C('#9c4c30')                                 # sombra de nube (cielo cubierto)
PATH = {'fill': C('#d8b088'), 'dark': C('#b88c60'), 'light': C('#e4c098'), 'speck': C('#c8a070'),
        'rim': C('#9a6444'), 'pebble': C('#fff0d4'), 'grass': C('#a89458')}
ROCK = {'rock': (C('#8a2e1a'), C('#c04a28'), C('#d8673a'), C('#eea070')), 'band': C('#f2b880'),
        'rock_out': C('#4a2016')}
STONE = {'stone': (C('#8a4a34'), C('#b4694a'), C('#d28c64')), 'stone_out': C('#4e2a1e')}
DRY = {'leaf': (C('#6a6634'), C('#86824a'), C('#a49e60'), C('#c4ba7a')), 'leaf_out': C('#3e3a22')}
WOOD = {'wood': (C('#6a4a34'), C('#8a6446'), C('#a8825e')), 'wood_out': C('#3a261a')}
DEAD = {'bark': (C('#5a4434'), C('#76604a'), C('#94806a')), 'bark_out': C('#30241a')}
GORGE = {'wall': (C('#8a2e1a'), C('#b8462a'), C('#d0603a')), 'band': C('#eea070'), 'floor': C('#4e2c22'),
         'floor2': C('#62382a'), 'lip': C('#e8b488')}
HORSE = {'coat': C('#8a5232'), 'dark': C('#5e341e'), 'light': C('#aa6c44'), 'mane': C('#2e1e16'),
         'blaze': C('#efe6d6'), 'out': C('#2a1810'), 'hoof': C('#3a2a20')}
SMOKE = (C('#c8c2bc'), C('#a8a29e'))
BRUMA = C('#f0c89a')                                 # el polvo de la bruma, cálido
WEED = (C('#8a6a3e'), C('#b08c56'), C('#5e4628'))

# las dos primeras, 1–2 px a la derecha: así el camino sale por abajo en las columnas 102–117, las mismas por las que
# sale por arriba el de la zona 3 (empalme sin escalón)
PATH_CTRL = [(112, 434), (111, 404), (136, 386), (168, 364), (170, 334), (140, 316), (92, 308), (54, 292), (40, 262),
             (60, 240), (98, 232), (106, 214), (104, 196), (124, 180), (164, 166), (178, 136), (156, 110), (108, 102),
             (64, 90), (48, 62), (70, 38), (104, 22), (110, 4), (110, -14)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('pattern', 'pattern', 'pattern', 'rescue', 'pattern', 'pattern', 'camp', 'boss')
FRACS = (0.055, 0.165, 0.29, 0.40, 0.53, 0.645, 0.76, 0.875)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

GORGE_CURVE = mk.Curve([(-14, 208), (40, 216), (104, 214), (160, 208), (236, 216)])
GORGE_R = 9
SHADOW = (0.12, 0.1)          # cielo cubierto: sombra corta, casi debajo

STABLE = (184, 74)            # pie (centro de la base) del establo
CHIMNEY = (196, 40)           # boca de la chimenea (se fija al dibujar el establo)
HORSE_AT = (140, 78)          # pie del caballo (centro)

FX = [
    ('map-fx-4-remolino', (24, 344, 62, 404), 8, 8),
    ('map-fx-4-rodadora', (62, 348, 142, 370), 8, 6),
    ('map-fx-4-caballo', (124, 56, 160, 82), 8, 4),
    ('map-fx-4-humo', (182, 0, 216, 38), 8, 4),
    ('map-fx-4-bruma', (124, 192, 220, 234), 8, 3),     # el polvo que se arrastra por el lecho de la garganta
]

META = {'zones': {str(ZONE): {
    'name': 'Cañón', 'boss': 'caballo', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- piezas propias

def stable():
    """
    Establo viejo (46×38): tejado a dos aguas de tablas grises con huecos, pared de tablas con el portón entreabierto, una
    ventana y la chimenea de piedra en el faldón de la derecha.
    """
    w, h = 46, 38
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    wd = WOOD['wood']
    roof = (C('#6e6258'), C('#8a7e72'), C('#a89c8e'))
    # pared delantera
    wall_top = 20
    d.rectangle([3, wall_top, w - 4, h - 1], fill=wd[1])
    for x in range(4, w - 4, 3):
        d.line([(x, wall_top), (x, h - 1)], fill=wd[0])
    d.line([(3, wall_top), (w - 4, wall_top)], fill=wd[0])
    # portón (entreabierto: una hoja oscura)
    d.rectangle([17, 26, 28, h - 1], fill=C('#2a1c14'))
    d.rectangle([17, 26, 21, h - 1], fill=wd[2])
    d.line([(17, 26), (21, h - 1)], fill=wd[0])
    d.line([(17, h - 1), (21, 26)], fill=wd[0])
    d.line([(16, 25), (29, 25)], fill=wd[0])
    # ventana
    d.rectangle([33, 25, 38, 29], fill=C('#2a1c14'))
    d.line([(33, 27), (38, 27)], fill=wd[2])
    # tablas sueltas
    d.line([(7, 30), (9, 35)], fill=wd[2])
    # tejado a dos aguas visto desde arriba: el faldón de atrás (claro) se estrecha hacia arriba, el de delante (oscuro)
    # llega al alero; entre los dos, la cumbrera recta y clara; tablas en diagonal y un alero que sobresale 3 px de la
    # pared por los lados y le echa 2 filas de sombra
    ridge = 10
    rp = sp.load()
    for y in range(2, wall_top + 2):
        inset = max(0, (ridge - y) * 3 // (ridge - 2)) if y < ridge else 0
        for x in range(inset, w - inset):
            if y < ridge:
                c = roof[2] if (x + y) % 4 == 0 else roof[1]
            elif y == ridge:
                c = C('#cfc4b6')
            else:
                c = roof[1] if (x - y) % 4 == 0 else roof[0]
            rp[x, y] = c
    d.line([(0, wall_top + 1), (w - 1, wall_top + 1)], fill=C('#4a4038'))
    d.line([(3, wall_top + 2), (w - 4, wall_top + 2)], fill=C('#3a2a20'))     # sombra del alero
    for x in range(3, w - 3, 2):
        d.point((x, wall_top + 3), fill=C('#3a2a20'))
    for x, y in ((10, 15), (11, 16), (30, 6), (31, 7)):            # tablas que faltan
        d.point((x, y), fill=C('#2a1c14'))
    # chimenea de piedra
    cx = 34
    d.rectangle([cx, 4, cx + 4, 13], fill=STONE['stone'][1])
    d.line([(cx, 4), (cx, 13)], fill=STONE['stone'][2])
    d.line([(cx + 4, 4), (cx + 4, 13)], fill=STONE['stone'][0])
    d.line([(cx - 1, 3), (cx + 5, 3)], fill=STONE['stone'][2])
    d.point((cx + 2, 3), fill=C('#2a1c14'))
    for y in (6, 9, 12):
        d.line([(cx + 1, y), (cx + 3, y)], fill=STONE['stone'][0])
    out = outlined(sp, WOOD['wood_out'])
    out.info['chimney'] = (cx + 2 + 1, 3 + 1)            # boca (coordenadas del sprite con contorno)
    return out


def horse(tail=0, head=0):
    """
    El caballo de perfil, mirando a la izquierda (26×18): `tail` -1/0/1 = cola a un lado, colgando, al otro; `head` 0/1 =
    cabeza alta / baja (pastando).
    """
    hc = HORSE
    sp = layer(26, 18)
    d = ImageDraw.Draw(sp)
    # cuerpo
    d.ellipse([6, 5, 22, 12], fill=hc['coat'])
    d.line([(8, 6), (20, 6)], fill=hc['light'])
    d.line([(8, 12), (20, 12)], fill=hc['dark'])
    # patas
    for x, c in ((8, hc['dark']), (10, hc['coat']), (18, hc['dark']), (20, hc['coat'])):
        d.line([(x, 11), (x, 16)], fill=c)
        d.point((x, 17), fill=hc['hoof'])
    # cuello y cabeza
    if head:
        d.polygon([(9, 6), (5, 11), (3, 14), (6, 14), (10, 9)], fill=hc['coat'])
        d.rectangle([1, 13, 5, 15], fill=hc['coat'])
        d.point((1, 15), fill=hc['dark'])
        d.point((3, 13), fill=hc['blaze'])
        d.line([(7, 7), (4, 11)], fill=hc['mane'])
        d.point((4, 12), fill=hc['out'])
    else:
        d.polygon([(10, 6), (6, 1), (4, 1), (5, 5), (8, 9)], fill=hc['coat'])
        d.rectangle([1, 1, 5, 4], fill=hc['coat'])
        d.point((1, 4), fill=hc['dark'])
        d.point((3, 1), fill=hc['blaze'])
        d.line([(3, 2), (3, 3)], fill=hc['blaze'])
        d.point((5, 0), fill=hc['coat'])                         # oreja
        d.line([(7, 2), (9, 6)], fill=hc['mane'])
        d.point((6, 1), fill=hc['mane'])
        d.point((4, 2), fill=hc['out'])                          # ojo
    # cola
    tails = {-1: [(22, 6), (24, 8), (24, 11), (23, 13)], 0: [(22, 6), (23, 9), (23, 12), (22, 14)],
             1: [(22, 6), (22, 9), (21, 12), (19, 13)]}
    pts = tails[tail]
    d.line(pts, fill=hc['mane'], width=1)
    d.line([(p[0] + 1, p[1]) for p in pts[:-1]], fill=hc['mane'])
    return outlined(sp, hc['out'])


def tumbleweed(rot):
    """Planta rodadora (9×9): bola de ramitas secas enredadas; `rot` 0–3 la gira un cuarto de vuelta."""
    sp = layer(9, 9)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 0, 8, 8], outline=WEED[0])
    d.ellipse([1, 1, 7, 7], fill=None, outline=WEED[1])
    rnd = random.Random(5)
    for _ in range(9):
        a = rnd.uniform(0, math.pi)
        r = rnd.uniform(2, 4)
        x0, y0 = 4 + math.cos(a) * r, 4 + math.sin(a) * r
        x1, y1 = 4 - math.cos(a) * r, 4 - math.sin(a) * r
        d.line([(x0, y0), (x1, y1)], fill=WEED[rnd.randint(0, 1)])
    d.point((4, 4), fill=WEED[2])
    for x, y in ((2, 2), (6, 6), (6, 2)):
        d.point((x, y), fill=C('#d4b47a'))
    sp = sp.rotate(-90 * rot)
    return outlined(sp, C('#3e2c18'))


def dead_tree(seed, h):
    """Árbol seco: tronco retorcido y ramas peladas (el cañón no da sombra)."""
    rnd = random.Random(seed)
    w = h + 6
    sp = layer(w, h + 2)
    d = ImageDraw.Draw(sp)
    b = DEAD['bark']
    x, y = w // 2, h
    d.line([(x, y), (x, y - h // 2)], fill=b[1], width=2)
    d.line([(x + 1, y), (x + 1, y - h // 2)], fill=b[0])

    def branch(x, y, ang, ln, depth):
        if depth == 0 or ln < 2:
            return
        x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
        d.line([(x, y), (x2, y2)], fill=b[1 if depth > 1 else 2])
        for da in (-0.5, 0.45):
            branch(x2, y2, ang + da + rnd.uniform(-0.2, 0.2), ln * 0.62, depth - 1)

    branch(x, y - h // 2, -math.pi / 2 - 0.4, h * 0.35, 3)
    branch(x, y - h // 2, -math.pi / 2 + 0.5, h * 0.3, 3)
    branch(x, y - h // 3, -0.3, h * 0.2, 2)
    return outlined(sp, DEAD['bark_out'])


def cactus(seed, h):
    """Cardón de dos brazos (verde apagado del cañón)."""
    rnd = random.Random(seed)
    sp = layer(11, h)
    d = ImageDraw.Draw(sp)
    g = (C('#4e6a3c'), C('#66844a'), C('#84a060'))
    d.rectangle([4, 1, 6, h - 1], fill=g[1])
    d.line([(4, 1), (4, h - 1)], fill=g[2])
    d.line([(6, 1), (6, h - 1)], fill=g[0])
    ya, yb = rnd.randint(h // 3, h // 2), rnd.randint(h // 2, 2 * h // 3)
    d.line([(1, ya), (1, ya + 4)], fill=g[1])
    d.line([(1, ya + 4), (3, ya + 4)], fill=g[1])
    d.line([(9, yb - 3), (9, yb)], fill=g[0])
    d.line([(7, yb), (9, yb)], fill=g[0])
    return outlined(sp, C('#26341e'))


def bridge():
    """Puente de tablas sobre la garganta (vertical, se ve desde arriba), con sus postes y cuerdas."""
    w, h = 22, GORGE_R * 2 + 10
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    planks = (C('#a07850'), C('#b88c5e'), C('#8a6644'))
    for k, y in enumerate(range(2, h - 2, 3)):
        d.rectangle([3, y, w - 4, y + 1], fill=planks[k % 3])
        d.line([(3, y + 2), (w - 4, y + 2)], fill=C('#5a3e28'))
        if k == 3:                                    # una tabla rota
            d.rectangle([12, y, 15, y + 1], fill=C('#2a1810'))
    for x in (1, w - 2):
        d.line([(x, 0), (x, h - 1)], fill=C('#c8b088'))   # cuerda
        for y in (0, h - 2):
            d.rectangle([x - 1, y, x, y + 1], fill=C('#6a4a30'))
    return outlined(sp, C('#3a2618'))


def hay_bale():
    sp = layer(11, 7)
    d = ImageDraw.Draw(sp)
    d.rectangle([0, 0, 10, 6], fill=C('#c8a858'))
    d.rectangle([0, 0, 10, 2], fill=C('#e0c478'))
    d.line([(3, 0), (3, 6)], fill=C('#8a7038'))
    d.line([(7, 0), (7, 6)], fill=C('#8a7038'))
    d.line([(10, 3), (10, 6)], fill=C('#a08840'))
    return outlined(sp, C('#5a4626'))


def trough():
    sp = layer(14, 5)
    d = ImageDraw.Draw(sp)
    d.rectangle([0, 0, 13, 4], fill=WOOD['wood'][1])
    d.rectangle([1, 1, 12, 2], fill=C('#5a7a80'))
    d.line([(0, 4), (13, 4)], fill=WOOD['wood'][0])
    return outlined(sp, WOOD['wood_out'])


def camp():
    """Campamento: fogata con piedras y un tronco para sentarse, y una manta enrollada."""
    sp = layer(26, 12)
    d = ImageDraw.Draw(sp)
    d.ellipse([8, 4, 19, 10], fill=STONE['stone'][1])
    d.ellipse([10, 5, 17, 9], fill=C('#4a3a30'))
    d.point((13, 7), fill=C('#d86a34'))
    d.point((14, 6), fill=C('#f0a048'))
    d.line([(11, 6), (16, 8)], fill=WOOD['wood'][1])
    for x, y in ((8, 7), (10, 4), (13, 4), (16, 4), (19, 7), (16, 10), (13, 10), (10, 10)):
        d.point((x, y), fill=STONE['stone'][2])
    d.rectangle([0, 8, 6, 10], fill=WOOD['wood'][1])           # tronco
    d.ellipse([5, 8, 7, 10], fill=WOOD['wood'][2])
    d.rectangle([21, 7, 25, 10], fill=C('#7a4a6a'))            # manta enrollada
    d.line([(21, 8), (25, 8)], fill=C('#a06a8a'))
    return outlined(sp, C('#33241a'))


def horseshoe_sign():
    """
    Portón del rancho del jefe (26×27): dos postes altos, un travesaño que sobresale por los dos lados y, encima, una
    herradura grande boca arriba (la de la suerte). Se lee como la entrada del rancho, no como un banco.
    """
    w, h = 26, 27
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    wd = WOOD['wood']
    beam = 8                                         # fila de arriba del travesaño
    for x in (3, w - 5):                             # postes
        d.rectangle([x, beam, x + 1, h - 1], fill=wd[1])
        d.line([(x + 1, beam + 3), (x + 1, h - 1)], fill=wd[0])
        d.point((x, h - 1), fill=wd[0])
    d.rectangle([0, beam, w - 1, beam + 2], fill=wd[1])      # travesaño
    d.line([(0, beam), (w - 1, beam)], fill=wd[2])
    d.line([(0, beam + 2), (w - 1, beam + 2)], fill=wd[0])
    for x in (4, w - 4):                                     # clavos
        d.point((x, beam + 1), fill=C('#3a2a20'))
    # la herradura, boca arriba sobre el travesaño
    iron, hi, hole = C('#9aa2a8'), C('#dfe4e8'), C('#3a3e42')
    cx = w // 2
    d.rectangle([cx - 4, 0, cx - 3, 5], fill=iron)
    d.rectangle([cx + 3, 0, cx + 4, 5], fill=iron)
    d.line([(cx - 3, 6), (cx + 3, 6)], fill=iron)
    d.line([(cx - 2, 7), (cx + 2, 7)], fill=iron)
    d.line([(cx - 4, 0), (cx - 4, 4)], fill=hi)
    d.point((cx - 3, 6), fill=hi)
    for x, y in ((cx - 3, 1), (cx + 3, 1), (cx - 3, 4), (cx + 3, 4)):
        d.point((x, y), fill=hole)
    return outlined(sp, C('#33241a'))


def broken_cart():
    """
    Carreta rota y abandonada (30×18), vista en 3/4: la caja de tablas ladeada (le falta la rueda de la derecha y esa esquina
    toca el suelo), la rueda de la izquierda en su sitio, la lanza tirada delante y la rueda suelta tumbada a un lado.
    """
    w, h = 30, 18
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    wd = WOOD['wood']
    # la rueda suelta, tumbada en el suelo (elipse plana con radios), detrás a la derecha
    d.ellipse([20, 12, 29, 17], fill=wd[0])
    d.ellipse([21, 13, 28, 16], fill=wd[1])
    d.ellipse([23, 14, 26, 15], fill=wd[0])
    for x0, y0, x1, y1 in ((21, 14, 28, 15), (24, 12, 25, 17)):
        d.line([(x0, y0), (x1, y1)], fill=wd[2])
    # la caja: cara de arriba (tablas) inclinada hacia la derecha y su costado delantero
    top = [(2, 3), (19, 5), (20, 10), (3, 8)]
    d.polygon(top, fill=wd[1])
    for k in range(1, 5):
        d.line([(2 + k * 4, 3 + k // 2), (3 + k * 4, 8 + k // 2)], fill=wd[0])
    d.line([(2, 3), (19, 5)], fill=wd[2])
    d.polygon([(3, 8), (20, 10), (20, 13), (3, 11)], fill=wd[0])
    d.line([(3, 9), (20, 11)], fill=wd[1])
    d.point((12, 6), fill=C('#2a1c14'))                       # una tabla que falta
    d.point((13, 6), fill=C('#2a1c14'))
    # la rueda de la izquierda (de canto: aro y radios)
    d.ellipse([0, 7, 8, 16], outline=wd[0])
    d.ellipse([1, 8, 7, 15], outline=wd[2])
    d.line([(4, 8), (4, 15)], fill=wd[1])
    d.line([(1, 11), (7, 11)], fill=wd[1])
    d.point((4, 11), fill=C('#3a2a20'))
    # la lanza, tirada en el suelo hacia delante a la izquierda
    d.line([(9, 14), (13, 17)], fill=wd[2])
    d.line([(10, 14), (14, 17)], fill=wd[0])
    return outlined(sp, WOOD['wood_out'])


def cow_skull():
    """Cráneo de vaca con sus cuernos (13×9) y un par de huesos sueltos al lado: lo que queda en el cañón seco."""
    w, h = 22, 10
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    bone, shade, dark = C('#efe2c6'), C('#c2ae8c'), C('#4a3426')
    # cuernos
    d.line([(0, 1), (2, 3), (4, 3)], fill=shade)
    d.point((0, 0), fill=bone)
    d.line([(12, 1), (10, 3), (8, 3)], fill=shade)
    d.point((12, 0), fill=bone)
    # cráneo: frente ancha que se estrecha hacia el hocico
    d.polygon([(3, 3), (9, 3), (8, 7), (7, 9), (5, 9), (4, 7)], fill=bone)
    d.line([(8, 4), (7, 8)], fill=shade)
    d.point((4, 5), fill=dark)                                 # cuencas
    d.point((8, 5), fill=dark)
    d.point((5, 8), fill=shade)
    d.point((7, 8), fill=shade)
    # huesos sueltos: una costilla curva y un hueso largo con sus nudos
    d.line([(14, 8), (16, 6), (18, 6)], fill=bone)
    d.line([(15, 8), (17, 7)], fill=shade)
    d.line([(16, 3), (20, 2)], fill=bone)
    for x, y in ((15, 3), (16, 4), (20, 1), (21, 2)):
        d.point((x, y), fill=bone)
    return outlined(sp, C('#5a4632'))


def dry_trough():
    """Abrevadero seco (16×6): la artesa de tablas con el fondo de barro agrietado y una tabla suelta."""
    sp = layer(16, 6)
    d = ImageDraw.Draw(sp)
    d.rectangle([0, 0, 15, 5], fill=WOOD['wood'][1])
    d.line([(0, 0), (15, 0)], fill=WOOD['wood'][2])
    d.rectangle([1, 1, 14, 3], fill=C('#9a6a48'))
    for x, y in ((3, 2), (4, 1), (7, 2), (8, 3), (11, 1), (12, 2)):
        d.point((x, y), fill=C('#5e3c28'))                     # grietas del barro
    d.line([(0, 5), (15, 5)], fill=WOOD['wood'][0])
    d.point((15, 4), fill=(0, 0, 0, 0))                        # la tabla rota de la esquina
    d.point((15, 5), fill=(0, 0, 0, 0))
    return outlined(sp, WOOD['wood_out'])


def fallen_fence():
    """
    Tramo de cerca caída (32×11): un poste en pie con el travesaño colgando hasta el suelo, otro poste inclinado y el
    travesaño de abajo y un poste tirados en la tierra.
    """
    w, h = 32, 11
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    wd = WOOD['wood']
    # poste en pie (izquierda) y poste inclinado (centro)
    d.rectangle([1, 2, 2, 10], fill=wd[1])
    d.line([(2, 3), (2, 10)], fill=wd[0])
    d.point((1, 2), fill=wd[2])
    d.line([(14, 4), (17, 10)], fill=wd[1])
    d.line([(15, 4), (18, 10)], fill=wd[0])
    d.point((14, 4), fill=wd[2])
    # travesaño que cuelga del poste en pie hasta el suelo, y el otro tirado
    d.line([(2, 4), (12, 9)], fill=wd[2])
    d.line([(2, 5), (12, 10)], fill=wd[0])
    d.line([(17, 9), (30, 7)], fill=wd[2])
    d.line([(17, 10), (30, 8)], fill=wd[0])
    # un poste caído, tumbado
    d.line([(22, 10), (28, 10)], fill=wd[1])
    d.point((28, 10), fill=wd[2])
    return outlined(sp, WOOD['wood_out'])


# ---------------------------------------------------------------- la escena

def _paint_gorge(sc):
    """
    La garganta del cañón: en vista 3/4 se ve la pared del fondo (la orilla de arriba) con sus estratos, el lecho en sombra
    abajo y el labio claro de la orilla de delante.
    """
    m = GORGE_CURVE.mask(GORGE_R, wobble=1.4, seed=7)
    mm = m.load()
    px = sc.ground.load()
    g = GORGE
    for x in range(mk.W):
        ys = [y for y in range(150, 280) if mm[x, y]]
        if not ys:
            continue
        top, bot = min(ys), max(ys)
        span = bot - top + 1
        for y in ys:
            u = (y - top) / max(1, span - 1)
            if y == top:
                c = g['lip']
            elif u < 0.62:                                 # pared del fondo, con estratos
                k = (y - top + int(2 * mk._h(x // 5, 3))) % 5
                c = g['band'] if k == 0 else (g['wall'][2] if k in (1, 2) else g['wall'][1])
                if mk._h(x, y, 11) < 0.07 or k == 4 and mk.dither(x, y) < 0.4:
                    c = g['wall'][0]
                if x % 9 == 0 and mk._h(x, 5) < 0.6:
                    c = g['wall'][0]                       # grietas verticales
            elif u < 0.72:
                c = g['wall'][0]
            else:
                c = g['floor'] if mk.dither(x, y) < 0.7 else g['floor2']
            px[x, y] = c
        # la orilla de delante: un labio de tierra con luz
        if bot + 1 < mk.H:
            px[x, bot + 1] = GROUND['light']
    sc._gorge = m
    return m


def _clouds(sc):
    """Manchas de nube sobre la tierra (cielo cubierto): grandes, tramadas a escalones."""
    px = sc.ground.load()
    blobs = [(40, 120, 50, 26), (170, 300, 46, 22), (60, 400, 40, 18), (180, 40, 40, 20), (120, 170, 34, 14)]
    for y in range(mk.H):
        for x in range(mk.W):
            v = 0.0
            for bx, by, rx, ry in blobs:
                e = ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2
                if e < 1:
                    v = max(v, 1 - e)
            if v > 0.1 + 0.5 * mk.dither(x, y):
                px[x, y] = CLOUD


def _scene():
    rnd = random.Random(404)
    sc = mk.Scene(LEVEL, GROUND, seed=4)
    sc.shadow_color = C('#5a2e22', 70)
    _clouds(sc)
    _paint_gorge(sc)
    sc.lay_path(CURVE, PATH, POINTS)
    for name, box, _n, _fps in FX:
        if name != 'map-fx-4-bruma':          # la bruma solo pinta dentro de la garganta, que ya está reservada
            sc.reserved.append(box)
    # la garganta: nada se pone encima
    gb = sc._gorge.getbbox()
    sc.reserved.append((gb[0], gb[1] - 2, gb[2], gb[3] + 3))

    def deco(sp, x, y, **kw):
        box = sc.put(sp, x, y, **kw)
        sc.reserved.append(box)
        return box

    # --- el puente sobre la garganta
    s = min(range(int(CURVE.length)), key=lambda s: abs(CURVE.at(s)[1] - 214) + (0 if 80 < CURVE.at(s)[0] < 130 else 999))
    bx, by = CURVE.at(s)
    br = bridge()
    sc.put(br, int(round(bx)), int(round(by)) + br.size[1] // 2, z=-1)

    # --- el rancho del jefe: establo con chimenea, corral con el caballo, heno y abrevadero
    st = stable()
    left, top, _r, _b = deco(st, STABLE[0], STABLE[1], shadow=SHADOW)
    sc._chimney = (left + st.info['chimney'][0], top + st.info['chimney'][1])
    hz = horse()
    sc.put(hz, HORSE_AT[0], HORSE_AT[1], key='horse', shadow=SHADOW)
    sc.reserved.append(sc.opaque_box(hz, *HORSE_AT))
    for pts in ([(122, 86), (160, 86)], [(122, 56), (160, 56)], [(120, 58), (120, 86)]):
        sp, fx, fy = mk.fence(pts, WOOD)
        deco(sp, fx, fy, z=fy if pts[0][1] > 70 else fy - 30, shadow=SHADOW)
    deco(trough(), 102, 74, shadow=SHADOW)
    deco(hay_bale(), 170, 92, shadow=SHADOW)
    deco(hay_bale(), 178, 96, shadow=SHADOW)
    deco(horseshoe_sign(), 28, 54, shadow=SHADOW)
    sc.reserved.append((14, 54, 42, 76))           # al pie del portón, despejado: que se lea como la entrada
    # --- el campamento junto al punto 7
    deco(camp(), 116, 128, shadow=SHADOW)
    # --- el paso de la salida: dos farallones
    deco(mk.mesa(41, 70, 26, ROCK), 52, 22, shadow=None)
    deco(mk.mesa(42, 48, 24, ROCK), 152, 20, shadow=None)
    # --- cercas viejas a lo largo del camino
    for pts in ([(150, 410), (184, 406)], [(66, 142), (96, 140)], [(70, 330), (100, 330)],
                [(134, 245), (174, 246)]):
        sp, fx, fy = mk.fence(pts, WOOD)
        if sc.free(sc.opaque_box(sp, fx, fy), 1):
            deco(sp, fx, fy, shadow=SHADOW)
    # --- la llanura de abajo: piezas con nombre (en el primer sitio libre de su lista)
    def named(sp, spots, pad=1):
        for x, y in spots:
            if sc.free(sc.opaque_box(sp, x, y), pad):
                deco(sp, x, y, shadow=SHADOW)
                return (x, y)
        return None
    sc._named = {
        'carreta': named(broken_cart(), ((150, 272), (146, 276), (154, 268), (140, 280))),
        'craneo': named(cow_skull(), ((92, 386), (88, 380), (94, 376), (84, 392))),
        'abrevadero': named(dry_trough(), ((92, 344), (100, 344), (84, 344), (116, 344))),
        'cerca': named(fallen_fence(), ((146, 298), (140, 296), (152, 300), (126, 290))),
    }
    # --- mesetas por los bordes
    for k, (x, y, w, h) in enumerate(((18, 190, 44, 52), (204, 304, 44, 58), (14, 330, 34, 30), (206, 196, 36, 40),
                                      (204, 150, 32, 30), (10, 420, 40, 30), (214, 420, 36, 34), (14, 132, 30, 26))):
        sp = mk.mesa(50 + k, w, h, ROCK)
        if sc.free(sc.opaque_box(sp, x, y), 2):
            deco(sp, x, y, shadow=SHADOW)
    # --- relleno: rocas, árboles secos, cardones, matas secas
    for k in range(40):
        x, y = rnd.randint(4, 216), rnd.randint(30, 416)
        sc.try_put(mk.rock(600 + k, rnd.choice((6, 7, 8, 10, 12)), STONE), x, y, pad=2, shadow=SHADOW)
    dead = 0
    for k in range(200):
        if dead >= 7:
            break
        x, y = rnd.randint(2, 218), rnd.randint(30, 420)
        sp = dead_tree(700 + k, rnd.choice((14, 18, 22)))
        if sc.try_put(sp, x, y, pad=2, shadow=SHADOW):
            sc.reserved.append(sc.opaque_box(sp, x, y))
            dead += 1
    cacti = 0
    for k in range(120):
        if cacti >= 7:
            break
        x, y = rnd.randint(2, 218), rnd.randint(30, 420)
        if sc.try_put(cactus(800 + k, rnd.choice((12, 15, 18))), x, y, pad=2, shadow=SHADOW):
            cacti += 1
    # la llanura de abajo, más poblada: dos árboles secos más y rocas entre y 300 y 412 (la mitad de abajo no puede quedar en
    # tierra lisa; el centro, entre las vueltas del camino, tampoco)
    rnd2 = random.Random(4040)
    more = 0
    for k in range(200):
        if more >= 2:
            break
        x, y = rnd2.randint(60, 180), rnd2.randint(334, 412)
        sp = dead_tree(760 + k, rnd2.choice((16, 18, 20)))
        if sc.try_put(sp, x, y, pad=2, shadow=SHADOW):
            sc.reserved.append(sc.opaque_box(sp, x, y))
            more += 1
    stones = []
    for k in range(300):
        if len(stones) >= 20:
            break
        x, y = rnd2.randint(56, 184), rnd2.randint(236, 414)
        if any(abs(x - sx) < 16 and abs(y - sy) < 12 for sx, sy in stones):
            continue
        if sc.try_put(mk.rock(660 + k, rnd2.choice((5, 6, 7, 8, 10)), STONE), x, y, pad=2, shadow=SHADOW):
            stones.append((x, y))
    cacti2 = 0
    for k in range(200):
        if cacti2 >= 2:
            break
        x, y = rnd2.randint(60, 180), rnd2.randint(236, 414)
        if sc.try_put(cactus(860 + k, rnd2.choice((12, 15))), x, y, pad=2, shadow=SHADOW):
            cacti2 += 1
    # matas de hierba seca
    tufts = sc.draw()
    for k in range(260):
        x, y = rnd.randint(3, 216), rnd.randint(4, 416)
        if sc.free((x - 2, y - 3, x + 3, y + 1), 1):
            for dx, dy, c in ((0, 0, WEED[0]), (-1, -1, WEED[1]), (1, -1, WEED[1]), (0, -2, C('#c8a868')),
                              (-2, -2, WEED[0]), (2, -2, C('#c8a868'))):
                tufts.point((x + dx, y + dy), fill=c)
    for k in range(260):
        x, y = rnd.randint(2, 218), rnd.randint(20, 420)
        sp = mk.bush(900 + k, rnd.choice((2, 3, 3, 4)), DRY)
        sc.try_put(sp, x, y, pad=1, shadow=SHADOW)
    return sc


# ---------------------------------------------------------------- ambientes

def _dust_px(px, x, y, w, h, col, dens, X, Y):
    """Pinta polvo en (x, y) de la capa si el tramado (posición absoluta X, Y) lo deja pasar con densidad `dens`."""
    if 0 <= x < w and 0 <= y < h and mk.dither(X, Y) < dens:
        px[x, y] = mk.mix(px[x, y], col, 0.75)


def _fx_remolino(sc):
    """
    Remolino de polvo: un embudo macizo de polvo (estrecho abajo, ancho arriba) hecho de 10 anillos cada 5 px, con el cuerpo
    tramado (más ralo abajo, más denso arriba), el arco de delante de cada anillo marcado y una veta en espiral continua de
    2 px que sube dando vueltas (dos vueltas por ciclo: se ve girar). La punta se inclina ±4 px respecto al pie, a un lado y al
    otro; al pie, una polvareda de ~30 px a ras de suelo; alrededor, ramitas que orbitan. Todo es periódico en `t`.
    """
    box = FX[0][1]
    cx, base = (box[0] + box[2]) // 2, box[3] - 7
    rings = 10
    step = 5
    top = base - (rings - 1) * step
    body = C('#e0a070')                      # el polvo de esta tierra (no crema: tras el `grade` saldría gris)
    lit, back, ring = C('#f4c494'), C('#b8784c'), C('#9a5a36')
    streak = C('#fcdcae')                    # la veta: polvo con luz que sube en espiral

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size

            def put(X, Y, c, k=0.85):
                x, y = X - x0, Y - y0
                if 0 <= x < w and 0 <= y < h:
                    px[x, y] = mk.mix(px[x, y], c, k)

            lean = 4.0 * mk.wave(t)                   # la punta, ±4 px respecto al pie
            spin = 2 * math.pi * 2 * t

            def shape(Y):
                """(centro, radio) del embudo a la altura Y."""
                u = max(0.0, min(1.0, (base - Y) / float(base - top)))
                c0 = cx + lean * u * u + 0.8 * mk.wave(t, -u * 0.3) * u
                return c0, 3.0 + 9.5 * u ** 1.15, u

            # cuerpo macizo, tramado a dos tonos de polvo (densidad del tono claro 0.55 abajo -> 0.8 arriba); el lado de
            # la izquierda, con luz; el de la derecha, en sombra; el borde, deshilachado (gira con la veta)
            for Y in range(top - 2, base + 2):
                c0, r, u = shape(Y)
                dens = 0.55 + 0.25 * u
                for X in range(int(math.floor(c0 - r)) - 1, int(math.ceil(c0 + r)) + 2):
                    e = abs(X - c0) / r
                    if e > 1.12:
                        continue
                    if e > 0.82:
                        ph = int((spin / (2 * math.pi)) * 8) % 8
                        if mk._h(X - int(c0) + ph, Y // 2, 61) < 0.35 + 0.5 * (e - 0.82) / 0.3:
                            continue
                    side = (X - c0) / r
                    if mk.dither(X, Y) < dens:
                        put(X, Y, lit if side < -0.3 else (back if side > 0.55 else body), 0.9)
                    else:
                        put(X, Y, back, 0.5)
            # anillos (ry 2, cada 5 px): bajo el arco de delante, una línea en sombra; encima, una de luz
            for k in range(rings):
                Y = base - k * step
                c0, r, u = shape(Y)
                for a in range(0, 181, 5):
                    ar = math.radians(a)
                    X = int(round(c0 + r * 0.95 * math.cos(ar)))
                    Yr = int(round(Y + 2 * math.sin(ar)))
                    put(X, Yr, ring, 0.85)
                    if 20 < a < 160:
                        put(X, Yr - 1, lit, 0.6)
            # veta en espiral continua (2 px): sube dando vueltas; solo se ve por delante
            for Y in range(top, base + 1):
                c0, r, u = shape(Y)
                th = spin - (base - Y) * 0.32
                if math.sin(th) <= -0.15:
                    continue
                X = c0 + r * 0.9 * math.cos(th)
                put(int(round(X)), Y, streak, 0.9)
                put(int(round(X)) + 1, Y, streak, 0.75)
            # polvareda del pie: ~30 px a ras de suelo, en bultos que giran con el remolino y suben un poco por el tallo
            for X in range(cx - 16, cx + 17):
                for Y in range(base - 6, base + 6):
                    dx = (X - cx) / 15.0
                    hump = 3.0 + 1.6 * (0.5 + 0.5 * math.cos(2 * math.pi * (2 * (X - cx) / 30.0 - 2 * t)))
                    hgt = hump * (1 - dx * dx) + 1.5
                    e = dx * dx + ((Y - base - 1.5) / (hgt if Y < base + 1.5 else 3.0)) ** 2
                    if e < 1 and mk.dither(X, Y) < 0.85 * (1 - e) + 0.12:
                        put(X, Y, body if Y < base + 1 else back, 0.75)
            # ramitas que orbitan
            for k in range(3):
                a = 2 * math.pi * (t * 2 + k / 3)
                Y0 = base - 8 - k * 13
                c0, r, u = shape(Y0)
                X = int(round(c0 + (r + 2) * math.cos(a)))
                Y = int(round(Y0 + 2 * math.sin(a)))
                put(X, Y, WEED[2] if math.sin(a) > 0 else WEED[0], 1.0)
                put(X + 1, Y, WEED[1], 1.0)
        return None, over
    return fn


def _fx_rodadora(sc):
    """La rodadora cruza de izquierda a derecha dando botes; entra y sale disolviéndose con el tramado (sin fundido)."""
    box = FX[1][1]
    x_a, x_b = box[0] + 4, box[2] - 14
    ground_y = box[3] - 11
    sprites = [tumbleweed(r) for r in range(4)]

    def fn(t, i):
        def over(img, x0, y0):
            u = t
            X = x_a + (x_b - x_a) * u
            hop = abs(math.sin(2 * math.pi * u * 2)) * 4
            Y = ground_y - hop
            vis = min(1.0, min(u, 1 - u) / 0.25)        # 0 al empezar, 0.5 en el 1.º y el último cuadro
            sp = sprites[i % 4]
            Xi, Yi = int(round(X)), int(round(Y))
            px = img.load()
            w, h = img.size
            # sombrita
            for dx in range(1, 9):
                xx, yy = Xi + dx - x0, ground_y + 10 - y0
                if 0 <= xx < w and 0 <= yy < h and (dx + i) % 2 == 0 and mk.dither(Xi + dx, ground_y) < vis:
                    px[xx, yy] = mk.mix(px[xx, yy], C('#6a3a26'), 0.5)
            spx = sp.load()
            for sy in range(sp.size[1]):
                for sx in range(sp.size[0]):
                    if spx[sx, sy][3] and mk.dither(Xi + sx, Yi + sy) < vis:
                        xx, yy = Xi + sx - x0, Yi + sy - y0
                        if 0 <= xx < w and 0 <= yy < h:
                            px[xx, yy] = spx[sx, sy]
        return None, over
    return fn


def _fx_caballo(sc):
    # la cola va y viene; a mitad del ciclo baja la cabeza a pastar y la vuelve a subir
    tails = (0, 1, 0, -1, 0, 1, 0, -1)
    heads = (0, 0, 0, 1, 1, 1, 0, 0)
    sprites = {(tl, hd): horse(tl, hd) for tl in (-1, 0, 1) for hd in (0, 1)}

    def fn(t, i):
        return {'horse': sprites[(tails[i], heads[i])]}, None
    return fn


def _fx_humo(sc):
    """Bocanadas de humo que suben de la chimenea, se ladean con el viento, crecen y se deshacen en el tramado."""
    cx, cy = sc._chimney

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for k in range(3):
                u = (t + k / 3) % 1.0
                X = cx + 7 * u * u + 1.2 * mk.wave(u * 1.5)
                Y = cy - 2 - 34 * u
                r = 2.2 + 4.0 * u
                dens = 1.25 * (1 - u) + 0.12            # más denso al salir; se deshace arriba
                for yy in range(int(Y - r), int(Y + r) + 1):
                    for xx in range(int(X - r), int(X + r) + 1):
                        e = ((xx - X) / r) ** 2 + ((yy - Y) / (r * 0.8)) ** 2
                        if e < 1 and mk.dither(xx, yy) < dens * (1.1 - 0.4 * e):
                            lx, ly = xx - x0, yy - y0
                            if 0 <= lx < w and 0 <= ly < h:
                                px[lx, ly] = SMOKE[0] if (yy - Y) < 0 else SMOKE[1]
        return None, over
    return fn


def _fx_bruma(sc):
    """
    Velos de polvo que se arrastran por el lecho de la garganta, a la derecha del puente: franjas tramadas (un dibujo de
    24 px que se repite) que avanzan 24 px por vuelta (3 px por cuadro), así el último cuadro empalma con el primero. Solo
    pintan dentro de la garganta (que está reservada: no hay decorado debajo, así que no se ve el «fantasma» de nada), y
    sobre el lecho oscuro se leen a 1×.
    """
    box = FX[4][1]
    gm = sc._gorge.load()
    # el centro y el fondo de la garganta en cada columna de la caja
    cols = {}
    for X in range(box[0], box[2]):
        ys = [Y for Y in range(box[1], box[3]) if gm[X, Y]]
        if ys:
            cols[X] = (min(ys), max(ys))
    veil = BRUMA

    def fn(t, i):
        shift = int(mk.drift(t, 24, 8))

        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for X, (gt, gb) in cols.items():
                edge = min(1.0, (X - box[0]) / 10.0, (box[2] - 1 - X) / 6.0)
                for k, (frac, ph) in enumerate(((0.6, 0), (0.88, 11))):
                    u = ((X - shift + ph) % 24) / 24.0
                    lump = 0.5 + 0.5 * math.cos(2 * math.pi * u)        # un velo por cada 24 px
                    wob = int(round(1.2 * math.sin(2 * math.pi * (X - shift + ph) / 24.0)))
                    Y0 = int(round(gt + (gb - gt) * frac)) + wob
                    for dy in range(-3, 4):
                        Y = Y0 + dy
                        if not (gt < Y <= gb) or not (0 <= Y - y0 < h):
                            continue
                        d_ = lump * (1 - abs(dy) / 4.0) * edge
                        # el tramado viaja con el velo (periodo 4, divide a 24): no centellea en su sitio
                        if mk.dither(X - shift, Y) < d_ * 1.0:
                            px[X - x0, Y - y0] = mk.mix(px[X - x0, Y - y0], veil, 0.55 if abs(dy) > 1 else 0.7)
        return None, over
    return fn


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    makers = {'map-fx-4-remolino': _fx_remolino, 'map-fx-4-rodadora': _fx_rodadora, 'map-fx-4-caballo': _fx_caballo,
              'map-fx-4-humo': _fx_humo, 'map-fx-4-bruma': _fx_bruma}
    for name, box, n, fps in FX:
        sc.add_fx(name, box, n, fps, makers[name](sc))
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
