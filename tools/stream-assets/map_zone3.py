"""
Zona 3 «Selva» del mapa del Chess Runner (jefe: el mono; oscuridad 2): selva con ruinas de piedra y lianas, verde oscuro
y luz que se filtra entre las copas. Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110, donde sale el de la zona 2), sube a la izquierda, cruza delante de la pared en ruinas de
la cascada, rodea el claro de los rayos de luz, pasa junto al campamento y llega al ídolo de piedra del jefe; sale por arriba
(x = 110) entre dos columnas, la puerta de la selva.

Luz: el suelo es un verde oscuro y frío (tono ≥ 100°, no oliva: el caqui es del cañón de la zona 4) y la luz entra a
manchas claras y en rayos sobre él; los árboles y las plantas van con la paleta de ese suelo.

Puntos: mismo reparto que las zonas 1–2:
  1 pattern · 2 pattern · 3 pattern · 4 rescue · 5 pattern · 6 pattern · 7 camp · 8 boss

Ambiente: `cascada` (el agua que cae de la pared en ruinas y la espuma del pozo), `lianas` (cuelgan del dintel de un arco
de piedra y se mecen), `charco` (gotas que caen de una hoja grande a un charco), `mono` (un monito que se columpia de una
liana) y `rayos` (rayos de luz que respiran en el claro, con motas que flotan).
"""
import functools
import math
import random

from PIL import Image, ImageDraw

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 3
LEVEL = 2

# Suelo de selva: verde oscuro y frío; la luz entra en manchas (`SUN`) y en rayos (ambiente).
# (S ≥ 0.5 de partida: con menos, tras el `grade` sale un verde salvia lechoso y la selva pierde más color que el cañón)
GROUND = {'base': C('#58aa54'), 'light': C('#66b45e'), 'dark': C('#50a04e'), 'dash': C('#4a9a4a'),
          'dash2': C('#7ac066'), 'tuft': C('#3a8046')}
SHADE = C('#4c964c')                                 # suelo bajo la bóveda
SUN = (C('#b0e08a'), C('#d8f2a8'))                 # manchas de luz (tono ~100°), la segunda en el centro
PATH = {'fill': C('#d4ac7a'), 'dark': C('#a47e52'), 'light': C('#e8c696'), 'speck': C('#b08c5e'),
        'rim': C('#36663e'), 'pebble': C('#e4cea8'), 'grass': C('#5c9a56')}
CANOPY = {'leaf': (C('#236e3e'), C('#338a49'), C('#4baa50'), C('#78c862')), 'leaf_out': C('#1e4630'),
          'bark': (C('#463a2e'), C('#605040'), C('#7e6a54')), 'bark_out': C('#241c16')}
KAPOK = {'leaf': (C('#297242'), C('#3b904f'), C('#56ae56'), C('#86cc6d')), 'leaf_out': C('#204834'),
         'bark': (C('#504436'), C('#6c5e4c'), C('#8c7c66')), 'bark_out': C('#28221a')}
PALM = {'leaf': (C('#1c6a35'), C('#2e883b'), C('#47a642'), C('#74c454')), 'leaf_out': C('#173a24'),
        'bark': (C('#4e402e'), C('#6c5a42'), C('#8a7658')), 'bark_out': C('#281e16')}
FERN = {'leaf': (C('#207041'), C('#31903f'), C('#4baa44'), C('#78c85a')), 'leaf_out': C('#1a4028')}
BUSH = {'leaf': (C('#1c6439'), C('#297e40'), C('#409c47'), C('#67bc58')), 'leaf_out': C('#173626')}
STONE = {'stone': (C('#566460'), C('#7a8882'), C('#9eaaa2')), 'stone_out': C('#2c3632'), 'moss': C('#4e9048')}
WATER = {'fill': C('#3a8a96'), 'deep': C('#2a687a'), 'light': C('#68b8c0'), 'foam': C('#d2eeea'),
         'bank': C('#34463a'), 'bank2': C('#4e6a4c')}
VINE = (C('#1a3a22'), C('#3e7a34'), C('#80b85a'))   # tallo oscuro y hojitas claras: se leen sobre el suelo
MONKEY = {'fur': C('#76482a'), 'light': C('#9a663c'), 'face': C('#dcb486'), 'out': C('#341e12'), 'eye': C('#1e120c')}
FIRE = {'stone': C('#7a8480'), 'stone_l': C('#a2aca6'), 'ash': C('#4a4038'), 'ember': C('#d86a34'),
        'ember2': C('#f0a048'), 'out': C('#2c3430')}

PATH_CTRL = [(110, 434), (110, 404), (92, 382), (62, 362), (50, 332), (70, 306), (114, 296), (158, 284), (178, 256),
             (164, 226), (122, 214), (76, 204), (48, 178), (54, 146), (90, 130), (140, 124), (172, 100), (166, 68),
             (132, 50), (108, 32), (110, 8), (110, -14)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('pattern', 'pattern', 'pattern', 'rescue', 'pattern', 'pattern', 'camp', 'boss')
FRACS = (0.055, 0.165, 0.29, 0.40, 0.53, 0.645, 0.76, 0.875)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

# Bajo la bóveda la luz cae casi de arriba: sombras cortas.
SHADOW = (0.22, 0.2)

# Piezas fijas (coordenadas de escena)
WALL = (160, 336)            # pie izquierdo de la pared en ruinas de la cascada (va hasta el borde derecho)
FALL_X = 186                 # columna de la cascada (centro)
POOL = (184, 351, 28, 12)    # pozo: centro y radios (toca el pie de la pared)
FALL_FOOT = 345              # donde el chorro entra en el pozo
ARCH = (8, 280)              # pie izquierdo del arco de las lianas
LEAF_TIP = (121, 168)        # punta de la hoja que gotea
PUDDLE = (121, 182, 9, 3)    # charco: centro y radios
SWING = (70, 62)             # de dónde cuelga la liana del mono
SWING_LEN = 20
# manchas de sol rotas al pie de los rayos del claro (centro y radios): dos al pie del primero, dos al del segundo, una
# al del tercero (que se pierde en el borde de la caja) y una suelta a la izquierda
CLEARING_SUN = ((110, 272, 11, 4), (99, 267, 6, 3), (132, 270, 8, 3), (141, 275, 5, 2), (147, 261, 5, 3),
                (88, 262, 7, 3))

FX = [
    ('map-fx-3-cascada', (176, 312, 200, 364), 8, 8),
    ('map-fx-3-lianas', (12, 254, 52, 292), 8, 4),
    ('map-fx-3-charco', (108, 164, 134, 188), 8, 6),
    ('map-fx-3-mono', (52, 60, 90, 94), 8, 5),
    ('map-fx-3-rayos', (70, 226, 150, 280), 8, 3),
]

META = {'zones': {str(ZONE): {
    'name': 'Selva', 'boss': 'mono', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- piezas propias

def ruin_wall(w, h):
    """
    Pared en ruinas con un caño en lo alto (de donde sale la cascada): hiladas de sillares desparejos, la cara de arriba
    mellada y con musgo, un sillar caído a cada lado. El caño queda en (FALL_X - WALL[0], 2) del sprite.
    """
    rnd = random.Random(31)
    s = STONE['stone']
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    top = 4
    # silueta de arriba mellada: unas columnas más bajas (sillares que faltan)
    tops = []
    for x in range(w):
        drop = 0 if mk._h(x // 6, 5) < 0.6 else (3 + int(mk._h(x // 6, 6) * 4))
        tops.append(drop)
    for x in range(w):
        t0 = tops[x]
        d.line([(x, t0), (x, t0 + top - 1)], fill=s[2])
        d.line([(x, t0 + top), (x, h - 1)], fill=s[1])
        d.point((x, t0 + top), fill=s[0])
    # hiladas
    y = top + 5
    row = 0
    while y < h - 1:
        d.line([(0, y), (w - 1, y)], fill=s[0])
        off = 0 if row % 2 == 0 else 5
        for jx in range(off, w, 10):
            d.line([(jx, y - 4), (jx, y - 1)], fill=s[0])
        y += 5
        row += 1
    # la cara de abajo, en sombra (agua y humedad)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=s[0])
    for x in range(w):
        if mk._h(x, 7) < 0.35:
            d.point((x, h - 2), fill=s[0])
    # musgo arriba y chorreando por la cara
    for x in range(w):
        if mk._h(x, 8) < 0.55:
            d.point((x, tops[x]), fill=STONE['moss'])
        if mk._h(x, 9) < 0.12:
            for k in range(rnd.randint(2, 6)):
                if tops[x] + top + k < h:
                    d.point((x, tops[x] + top + k), fill=STONE['moss'])
    # el caño (canal de piedra que sobresale)
    cx = FALL_X - WALL[0]
    for x in range(cx - 4, cx + 5):
        d.line([(x, 0), (x, top)], fill=s[2])
    d.line([(cx - 4, top + 1), (cx + 4, top + 1)], fill=s[0])
    d.rectangle([cx - 2, 1, cx + 2, top], fill=WATER['deep'])
    return outlined(sp, STONE['stone_out'])


def water_column(h):
    """El chorro quieto de la cascada (7 px de ancho): agua con su luz a la izquierda y la sombra a la derecha."""
    sp = layer(7, h)
    px = sp.load()
    for y in range(h):
        for x in range(7):
            c = WATER['fill']
            if x == 0 or x == 6:
                c = WATER['deep']
            elif x == 1:
                c = WATER['light']
            elif mk._h(x, y // 3, 4) < 0.15:
                c = WATER['light']
            if y >= h - 2 and (x + y) % 2 == 0:
                c = WATER['foam']                  # espuma donde entra en el pozo
            px[x, y] = c
    return sp


def arch():
    """Arco de piedra en ruinas: dos jambas de sillares y un dintel con musgo (las lianas cuelgan de él)."""
    w, h = 44, 30
    sp = layer(w, h)
    blocks = []
    for k in range(4):                        # jambas
        blocks.append((0, h - 6 - k * 6, 8, 6))
        blocks.append((w - 8, h - 6 - k * 6, 8, 6))
    out = layer(w, h)
    # el hueco del arco, en sombra: un pasadizo en penumbra (no un agujero negro: las lianas se recortan claras sobre él)
    ImageDraw.Draw(out).rectangle([7, 6, w - 9, h - 1], fill=C('#24402c'))
    ImageDraw.Draw(out).rectangle([7, 6, w - 9, 8], fill=C('#1a3022'))
    # abajo se ve el suelo del pasadizo, que se aclara hacia la salida (escalones tramados)
    opx = out.load()
    for y in range(14, h):
        for x in range(7, w - 8):
            u = (y - 14) / (h - 15)
            if u > 0.55 + 0.4 * mk.dither(x, y):
                opx[x, y] = C('#3e6a46')
            elif u > 0.1 + 0.5 * mk.dither(x, y):
                opx[x, y] = C('#2e5236')
    ImageDraw.Draw(out).line([(7, h - 1), (w - 9, h - 1)], fill=C('#4a7a50'))
    for k, (x, y, bw, bh) in enumerate(blocks):
        b = mk.ruin_block(40 + k, bw - 2, bh - 2, STONE, top=2, cracks=0)
        out.alpha_composite(b, (x, y))
    lintel = mk.ruin_block(60, w - 2, 6, STONE, top=2, cracks=2)
    out.alpha_composite(lintel, (0, 0))
    sp.alpha_composite(out)
    return sp


def vine(length, bend):
    """Liana que cuelga `length` px; `bend` desplaza la punta (la curva crece con el cuadrado de la altura)."""
    w = 9
    sp = layer(w, length + 2)
    px = sp.load()
    cx = w // 2
    for j in range(length):
        u = j / max(1, length - 1)
        x = cx + int(round(bend * u * u))
        px[x, j] = VINE[1] if j % 4 else VINE[0]
        if j % 3 == 1 and j > 1:
            side = 1 if (j // 3) % 2 else -1
            if 0 <= x + side < w:
                px[x + side, j] = VINE[2]
            if 0 <= x + side < w and j + 1 < length + 2:
                px[x + side, j + 1] = VINE[1]
    # la punta, una hojita
    xe = cx + int(round(bend))
    for dx, dy, c in ((0, length, VINE[2]), (-1, length, VINE[1]), (1, length, VINE[1]), (0, length + 1, VINE[1])):
        if 0 <= xe + dx < w:
            px[xe + dx, dy] = c
    return sp


def elephant_ear():
    """Planta de hojas grandes (oreja de elefante): tres hojas de corazón con su nervio; la de la derecha gotea."""
    w, h = 26, 20
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    L = FERN['leaf']
    stems = (12, h - 1)
    # (centro, radio x, radio y, inclinación de la punta)
    leaves = (((7, 7), 6, 4, -1), ((19, 9), 6, 4, 1), ((13, 4), 5, 4, 0))
    for (cx, cy), rx, ry, tip in leaves:
        d.line([stems, (cx, cy + ry - 1)], fill=L[0])
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=L[2])
        d.ellipse([cx - rx + 1, cy - ry, cx + rx - 1, cy + 1], fill=L[3])
        d.line([(cx - rx + 1, cy + ry - 1), (cx + rx - 1, cy + ry - 1)], fill=L[1])
        d.line([(cx, cy - ry + 1), (cx + tip * 2, cy + ry)], fill=L[1])
        if tip:
            d.point((cx + tip * (rx + 1), cy + 2), fill=L[2])
            d.point((cx + tip * (rx + 1), cy + 3), fill=L[1])
    return outlined(sp, FERN['leaf_out'])


def monkey(pose):
    """
    El monito colgado (9×11): `pose` -1/0/1 = se balancea hacia la izquierda / abajo del todo / hacia la derecha (las
    piernas y la cola quedan atrás). Agarra la liana con los dos brazos por encima de la cabeza.
    """
    f = MONKEY
    rows = {
        0: ['...aa....',
            '...aa....',
            '..hhhh...',
            '.hFFFFh..',
            '.hFEFEh..',
            '..hFFh...',
            '..bbbb...',
            '..bBBb...',
            '..bbbb.t.',
            '..l..l.t.',
            '..l..ltt.'],
        1: ['....aa...',
            '....aa...',
            '...hhhh..',
            '..hFFFFh.',
            '..hFEFEh.',
            '...hFFh..',
            '...bbbb..',
            '..bbBBb..',
            '.tbbbb...',
            't.ll.....',
            'tll......'],
    }
    key = 0 if pose == 0 else 1
    sp = layer(9, 11)
    px = sp.load()
    cols = {'a': f['fur'], 'h': f['fur'], 'F': f['face'], 'E': f['eye'], 'b': f['fur'], 'B': f['light'],
            'l': f['fur'], 't': f['light']}
    for y, r in enumerate(rows[key]):
        for x, ch in enumerate(r):
            if ch in cols:
                px[x, y] = cols[ch]
    if pose < 0:
        sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
    return outlined(sp, f['out'])


def swing_sprite(i):
    """Liana + monito en el cuadro `i` del vaivén (lienzo fijo, el punto de cuelgue arriba al centro)."""
    w, h = 38, SWING_LEN + 14
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    ang = 0.5 * math.cos(2 * math.pi * i / 8)          # vaivén de péndulo, ±24°
    ax, ay = w // 2, 0
    ex = ax + SWING_LEN * math.sin(ang)
    ey = ay + SWING_LEN * math.cos(ang)
    d.line([(ax, ay), (int(round(ex)), int(round(ey)))], fill=VINE[0])
    for k in range(3, SWING_LEN - 2, 4):                # hojitas claras a lo largo, alternando de lado
        x = ax + k * math.sin(ang)
        y = ay + k * math.cos(ang)
        d.point((int(round(x)) + (1 if (k // 4) % 2 else -1), int(round(y))), fill=VINE[2])
    vel = -math.sin(2 * math.pi * i / 8)                 # hacia dónde va: las piernas se quedan atrás
    pose = 0 if abs(vel) < 0.5 else (1 if vel > 0 else -1)
    m = monkey(pose)
    mk.blit(sp, m, int(round(ex)) - m.size[0] // 2 + (1 if pose == 0 else 0), int(round(ey)) - 1)
    return sp


def idol():
    """Cabeza de mono de piedra (el ídolo del jefe), 24×20: orejas redondas, cuencas hundidas, boca y musgo."""
    w, h = 24, 20
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    s = STONE['stone']
    d.ellipse([0, 4, 7, 11], fill=s[1])                # orejas
    d.ellipse([w - 8, 4, w - 1, 11], fill=s[0])
    d.ellipse([2, 6, 5, 9], fill=s[0])
    d.ellipse([w - 6, 6, w - 3, 9], fill=C('#3e4a46'))
    d.ellipse([4, 0, w - 5, h - 3], fill=s[1])         # cabeza
    d.ellipse([5, 0, w - 8, 9], fill=s[2])
    d.ellipse([7, 5, w - 8, h - 4], fill=s[2])         # careta
    d.rectangle([8, 7, 10, 9], fill=C('#1e2624'))      # cuencas
    d.rectangle([w - 11, 7, w - 9, 9], fill=C('#1e2624'))
    d.point((9, 8), fill=C('#e0b050'))                 # un brillo en los ojos (el jefe vigila)
    d.point((w - 10, 8), fill=C('#e0b050'))
    d.line([(9, 13), (w - 10, 13)], fill=s[0])         # boca
    d.line([(10, 14), (w - 11, 14)], fill=C('#1e2624'))
    d.rectangle([3, h - 3, w - 4, h - 1], fill=s[0])   # basa
    d.line([(3, h - 3), (w - 4, h - 3)], fill=s[1])
    for x, y in ((6, 2), (7, 1), (14, 1), (15, 2), (4, 16), (18, 15), (19, 16)):
        d.point((x, y), fill=STONE['moss'])
    return outlined(sp, STONE['stone_out'])


def camp():
    """Campamento de la manada: círculo de piedras con brasas y un cobertizo de hojas de palma."""
    sp = layer(28, 16)
    d = ImageDraw.Draw(sp)
    # cobertizo: dos palos y un techo de hojas inclinado
    L = PALM['leaf']
    d.line([(2, 15), (2, 5)], fill=PALM['bark'][0])
    d.line([(13, 15), (13, 7)], fill=PALM['bark'][0])
    for k in range(6):
        d.line([(0 + k, 3 + k // 2), (15, 5 + k // 2)], fill=L[3 if k < 2 else (2 if k < 4 else 1)])
    d.line([(0, 9), (15, 9)], fill=L[0])
    # fuego
    f = FIRE
    d.ellipse([16, 9, 27, 15], fill=f['stone'])
    d.ellipse([18, 10, 25, 14], fill=f['ash'])
    d.point((21, 12), fill=f['ember'])
    d.point((22, 11), fill=f['ember2'])
    d.line([(19, 11), (24, 13)], fill=PALM['bark'][1])
    for x, y in ((16, 12), (18, 9), (21, 9), (24, 9), (27, 12), (24, 15), (21, 15), (18, 15)):
        d.point((x, y), fill=f['stone_l'])
    return outlined(sp, f['out'])


def gate_pillar(seed):
    """Columna alta de la puerta de la selva, con una liana enroscada."""
    p = mk.pillar(seed, 26, STONE, broken=False, w=6)
    d = ImageDraw.Draw(p)
    for k in range(4, 24, 3):
        x = 3 + (k // 3) % 2 * 4
        d.point((x, k), fill=VINE[1])
        d.point((x + 1, k + 1), fill=VINE[2])
    return p


def jungle_tree(seed, r, pal, vines=0):
    """Árbol de la selva (copa de bolas) con lianas quietas que cuelgan del borde de la copa."""
    t = mk.tree(seed, r, pal)
    if not vines:
        return t
    rnd = random.Random(seed + 5)
    a = t.getchannel('A').load()
    w, h = t.size
    d = ImageDraw.Draw(t)
    trunk_x = w // 2
    for _ in range(vines):
        x = rnd.randint(3, w - 4)
        if abs(x - trunk_x) < 4:
            continue
        y = 0
        while y < h and not a[x, y]:
            y += 1
        while y < h - 1 and a[x, y + 1]:
            y += 1
        ln = rnd.randint(4, 9)
        for k in range(ln):
            if y + k < h:
                d.point((x, y + k), fill=VINE[1] if k % 3 else VINE[0])
        if y + ln < h:
            d.point((x, y + ln - 1), fill=VINE[2])
    return t


# ---------------------------------------------------------------- la escena

def _sunflecks(sc, rnd, spots, wob=0.25):
    """
    Manchas de luz en el suelo (tramadas, con un centro más claro): la luz que se cuela entre las copas. `wob` rompe el borde
    de la elipse (0.25: manchas redondeadas; 0.5: manchas rotas, sin borde ovalado).
    """
    px = sc.ground.load()
    path = sc.path.load()
    amp = wob
    for cx, cy, rx, ry in spots:
        for y in range(max(0, int(cy - ry - 2)), min(mk.H, int(cy + ry + 3))):
            for x in range(max(0, int(cx - rx - 2)), min(mk.W, int(cx + rx + 3))):
                if path[x, y]:
                    continue
                e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                wob = amp * mk._h(x // 2, y // 2, 17)
                if amp > 0.3:
                    wob -= amp * 0.9 * mk._h(x // 3, y // 2, 29)
                if e < 0.3 + wob - 0.25 * mk.dither(x, y):
                    px[x, y] = SUN[1]
                elif e < 1 + wob - 0.5 * mk.dither(x, y):
                    px[x, y] = SUN[0]


def _paint_pool(sc):
    cx, cy, rx, ry = POOL
    m = Image.new('L', (mk.W, mk.H), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    # el desagüe del pozo, que se va por el borde derecho
    d.polygon([(cx + 10, cy + 2), (mk.W + 2, cy + 14), (mk.W + 2, cy + 22), (cx + 6, cy + 10)], fill=255)
    mk.paint_water(sc.ground, m, WATER)
    sc._pool = m
    return m


def _paint_puddle(sc):
    cx, cy, rx, ry = PUDDLE
    m = Image.new('L', (mk.W, mk.H), 0)
    ImageDraw.Draw(m).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    mk.paint_water(sc.ground, m, WATER)
    sc._puddle = m


def _scene():
    rnd = random.Random(303)
    sc = mk.Scene(LEVEL, GROUND, seed=3)
    sc.shadow_color = C('#24442e', 76)
    # bajo la bóveda de los bordes el suelo se apaga (escalones tramados, sin degradado)
    gpx = sc.ground.load()
    for y in range(mk.H):
        for x in range(mk.W):
            e = max(0.0, 1 - min(x, mk.W - 1 - x) / 26.0)
            if e > 0.15 + 0.7 * mk.dither(x, y):
                gpx[x, y] = SHADE
    # manchas de luz: en los claros (no bajo la bóveda de los bordes)
    _sunflecks(sc, rnd, [(150, 168, 22, 10), (98, 160, 14, 7), (40, 386, 16, 8),
                         (146, 402, 18, 7), (96, 84, 16, 8), (128, 94, 12, 6), (164, 302, 12, 4), (60, 302, 12, 5),
                         (176, 120, 10, 5), (30, 140, 10, 5), (80, 330, 10, 5), (150, 14, 12, 5)])
    # el claro de los rayos: el suelo, el de la selva; la luz la ponen los rayos (ambiente) y unas manchas de sol rotas,
    # irregulares, al pie de cada rayo (sin óvalo de penumbra: el claro es lo más luminoso)
    _sunflecks(sc, rnd, CLEARING_SUN, wob=0.5)
    _paint_pool(sc)
    _paint_puddle(sc)
    sc.lay_path(CURVE, PATH, POINTS)
    for name, box, _n, _fps in FX:
        sc.reserved.append(box)

    def deco(sp, x, y, **kw):
        box = sc.put(sp, x, y, **kw)
        sc.reserved.append(box)
        return box

    # --- la pared de la cascada, su chorro y el pozo (abajo a la derecha)
    wall = ruin_wall(mk.W - WALL[0] + 2, 28)
    deco(wall, WALL[0] + wall.size[0] // 2, WALL[1], shadow=None)
    col = water_column(FALL_FOOT - (WALL[1] - wall.size[1] + 1 + 2))
    deco(col, FALL_X, FALL_FOOT, z=WALL[1] + 1)
    sc._wall_top = WALL[1] - wall.size[1] + 1
    sc.reserved.append((POOL[0] - POOL[2] - 2, POOL[1] - POOL[3] - 2, mk.W, POOL[1] + POOL[3] + 24))

    # --- el arco de las lianas (izquierda)
    a = arch()
    deco(a, ARCH[0] + a.size[0] // 2, ARCH[1], shadow=SHADOW)
    sc._arch = (ARCH[0], ARCH[1] - a.size[1] + 1)
    vines = []
    # tres largas salen por debajo del arco y caen sobre el suelo
    for k, (vx, ln) in enumerate(((14, 22), (20, 30), (27, 13), (33, 26), (39, 16))):
        sp = vine(ln, 0)
        top = sc._arch[1] + 7
        sc.put(sp, ARCH[0] + vx, top + sp.size[1] - 1, key=f'vine{k}', z=ARCH[1] + 1)
        vines.append((k, vx, ln))
    sc._vines = vines

    # --- la hoja que gotea y su charco
    ear = elephant_ear()
    deco(ear, 112, 176, z=170)
    # --- el ídolo del jefe con su plataforma de sillares
    for k, (x, y, w, h) in enumerate(((186, 80, 30, 7), (190, 74, 22, 6))):
        deco(mk.ruin_block(70 + k, w, h, STONE, top=3, cracks=1), x, y, z=y - 20)
    deco(idol(), 192, 72, shadow=SHADOW)
    deco(mk.pillar(81, 20, STONE), 176, 46, shadow=SHADOW)
    deco(mk.pillar(82, 14, STONE), 210, 98, shadow=SHADOW)
    # --- la puerta de la selva (salida)
    for k, x in enumerate((90, 131)):
        deco(gate_pillar(90 + k), x, 24, shadow=SHADOW)
    # --- el campamento junto al punto 7
    deco(camp(), 176, 148, shadow=SHADOW)
    # --- ruinas sueltas
    for k, (x, y, w, h) in enumerate(((92, 352, 14, 8), (20, 176, 12, 8), (162, 196, 12, 7), (118, 404, 10, 6),
                                      (196, 400, 12, 7))):
        sc.try_put(mk.ruin_block(100 + k, w, h, STONE, top=3), x, y, pad=1, shadow=SHADOW)
    for k, (x, y, hh) in enumerate(((30, 344, 16), (196, 248, 18), (108, 112, 12))):
        sc.try_put(mk.pillar(110 + k, hh, STONE), x, y, pad=1, shadow=SHADOW)

    # --- el árbol del mono (arriba a la izquierda): la liana cuelga del borde derecho de su copa
    big = jungle_tree(120, 20, KAPOK)
    deco(big, 44, 92, shadow=SHADOW)
    # la rama que sale de la copa hacia la derecha, de la que cuelga la liana
    br = layer(30, 6)
    bd = ImageDraw.Draw(br)
    bd.line([(0, 4), (12, 3), (26, 1)], fill=KAPOK['bark'][1], width=2)
    bd.line([(0, 5), (12, 4), (26, 2)], fill=KAPOK['bark'][0])
    bd.point((27, 0), fill=KAPOK['leaf'][2])
    bd.point((28, 1), fill=KAPOK['leaf'][1])
    br = outlined(br, KAPOK['bark_out'])
    deco(br, SWING[0] - 13, SWING[1] + 4, z=91)
    sc.put(swing_sprite(0), SWING[0], SWING[1] + SWING_LEN + 13, key='swing', z=93)

    # --- la bóveda: árboles grandes por los bordes, palmeras y helechos en los huecos
    trees = [(44, 92, 20)]
    for k in range(900):
        side = rnd.random()
        if side < 0.35:
            x = rnd.randint(-10, 18)
        elif side < 0.7:
            x = rnd.randint(202, 230)
        else:
            x = rnd.randint(10, 210)
        y = rnd.randint(0, 450)
        r = rnd.choice((11, 12, 13, 14, 15, 16, 17, 18, 20))
        if any((x - tx) ** 2 + ((y - ty) * 1.5) ** 2 < (0.6 * (r + tr)) ** 2 for tx, ty, tr in trees):
            continue
        pal = (CANOPY, KAPOK)[k % 2]
        sp = jungle_tree(1000 + k, r, pal, vines=2 if k % 3 == 0 else 0)
        if sc.try_put(sp, x, y, pad=3, shadow=SHADOW):
            trees.append((x, y, r))
    palms = 0
    for k in range(260):
        if palms >= 14:
            break
        x, y = rnd.randint(0, 220), rnd.randint(8, 430)
        sp = mk.palm(1500 + k, rnd.choice((16, 20, 24)), PALM, n=5, droop=1.5, fore=0.7, frond=15)
        if sc.try_put(sp, x, y, pad=2, shadow=SHADOW):
            sc.reserved.append(sc.opaque_box(sp, x, y))
            palms += 1
    ears = 0
    for k in range(200):
        if ears >= 7:
            break
        x, y = rnd.randint(4, 216), rnd.randint(20, 416)
        if sc.try_put(elephant_ear(), x, y, pad=2, shadow=SHADOW):
            ears += 1
    for k in range(700):
        x, y = rnd.randint(2, 218), rnd.randint(8, 418)
        sp = mk.palm(1800 + k, 0, FERN, n=rnd.choice((6, 7, 8)), frond=rnd.choice((6, 7, 9, 10)))
        sc.try_put(sp, x, y, pad=1, shadow=None)
    for k in range(80):
        x, y = rnd.randint(2, 218), rnd.randint(8, 418)
        sp = mk.bush(2200 + k, rnd.choice((3, 4, 5)), BUSH, flowers=C('#e86a7a') if k % 6 == 0 else None)
        sc.try_put(sp, x, y, pad=1, shadow=SHADOW)
    return sc


# ---------------------------------------------------------------- ambientes

def _fx_cascada(sc):
    """Rayas de agua que bajan por el chorro (un periodo entero por vuelta) y espuma que bulle al pie, en el pozo."""
    x0c = FALL_X - 3
    top = sc._wall_top + 6
    foot = FALL_FOOT - 1
    pool = sc._pool.load()

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for Y in range(top, foot + 1):
                for X in range(x0c + 1, x0c + 6):
                    ph = (Y - t * 16 + mk._h(X, 2) * 16) % 8          # dos rayas por periodo de 16 px
                    x, y = X - x0, Y - y0
                    if 0 <= x < w and 0 <= y < h:
                        if ph < 2:
                            px[x, y] = WATER['foam'] if X in (x0c + 2, x0c + 4) else WATER['light']
                        elif ph < 3:
                            px[x, y] = WATER['light']
            # espuma al pie: borbotones que suben y bajan en su sitio
            for k, (dx, dy) in enumerate(((-5, 0), (-2, 1), (1, 0), (4, 1), (7, 0), (-7, 2), (0, 3), (5, 3))):
                X, Y = FALL_X + dx, foot + 2 + dy
                on = mk.seq((1, 1, 0, 2, 1, 0, 0, 2), i + k * 3)
                if not on or not pool[X, Y]:
                    continue
                x, y = X - x0, Y - y0
                if 0 <= x < w and 0 <= y < h:
                    px[x, y] = WATER['foam']
                    if on == 2 and 0 <= y - 1 and pool[X, Y - 1]:
                        px[x, y - 1] = WATER['foam']
            # ondas que se abren en el pozo
            for k in range(2):
                u = (t + k * 0.5) % 1.0
                rx, ry = 4 + 9 * u, 1.5 + 3 * u
                if u > 0.85:
                    continue
                cy = foot + 6
                for a in range(0, 360, 6):
                    X = int(round(FALL_X + rx * math.cos(math.radians(a))))
                    Y = int(round(cy + ry * math.sin(math.radians(a))))
                    x, y = X - x0, Y - y0
                    if 0 <= x < w and 0 <= y < h and pool[X, Y] and Y > cy - 1:
                        px[x, y] = WATER['light']
        return None, over
    return fn


def _fx_lianas(sc):
    variants = {k: {b: vine(ln, b) for b in range(-3, 4)} for k, _vx, ln in sc._vines}

    def fn(t, i):
        out = {}
        for k, vx, ln in sc._vines:
            # vaivén con fase por liana; las largas se mecen 3 px en la punta, las cortas 2
            amp = 3 if ln >= 22 else 2
            b = int(round(amp * mk.wave(t, k * 0.17)))
            out[f'vine{k}'] = variants[k][b]
        return out, None
    return fn


def _fx_charco(sc):
    """Dos gotas que caen de la punta de la hoja (desfasadas medio ciclo) y abren un anillo en el charco."""
    tx, ty = LEAF_TIP
    cx, cy, _rx, _ry = PUDDLE
    puddle = sc._puddle.load()

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for k in range(2):
                j = (i + 4 * k) % 8
                X = tx - 2 * k
                if j < 3:                                   # cae
                    Y = ty + 1 + j * 4
                    for dy, c in ((-1, WATER['light']), (0, WATER['foam']), (1, WATER['foam'])):
                        x, y = X - x0, Y + dy - y0
                        if 0 <= x < w and 0 <= y < h:
                            px[x, y] = c
                elif j < 7:                                 # anillo que se abre
                    r = j - 2
                    for a in range(0, 360, 10):
                        XX = int(round(X + r * 1.8 * math.cos(math.radians(a))))
                        YY = int(round(cy + r * 0.6 * math.sin(math.radians(a))))
                        if puddle[XX, YY]:
                            x, y = XX - x0, YY - y0
                            if 0 <= x < w and 0 <= y < h:
                                px[x, y] = WATER['foam'] if r < 3 else WATER['light']
        return None, over
    return fn


def _fx_mono(sc):
    frames = {i: swing_sprite(i) for i in range(8)}

    def fn(t, i):
        return {'swing': frames[i]}, None
    return fn


def _fx_rayos(sc):
    """
    Tres rayos de luz inclinados que respiran (la densidad del tramado sube y baja con un seno: bucle sin salto) y unas
    motas que flotan dentro, a la deriva.
    """
    box = FX[4][1]
    rays = ((84, 7), (106, 5), (128, 6))             # x arriba del todo, ancho
    slope = 0.55
    LIGHT = C('#e6f6b4')
    motes = [(92 + k * 9, 238 + (k * 13) % 30, k / 5) for k in range(5)]

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            breath = 0.5 + 0.5 * mk.wave(t)
            for k, (rx, rw) in enumerate(rays):
                b = 0.5 + 0.5 * mk.wave(t, k * 0.3)
                for Y in range(box[1], box[3]):
                    fall = (Y - box[1]) / (box[3] - box[1])
                    xc = rx + (Y - box[1]) * slope
                    for X in range(int(xc - rw), int(xc + rw) + 1):
                        x, y = X - x0, Y - y0
                        if not (0 <= x < w and 0 <= y < h):
                            continue
                        edge = abs(X - xc) / rw
                        # más fuerte arriba y en el eje; se pierde abajo y por los bordes (borde tramado a cuadros)
                        if edge > 0.6 and (X + Y) % 2:
                            continue
                        k_ = (0.18 + 0.42 * b) * (1 - 0.5 * fall) * (1.0 if edge < 0.35 else 0.7)
                        # cerca de los bordes de la caja se apaga en escalones (que el rayo no acabe en un corte recto)
                        rim = min(X - box[0], box[2] - 1 - X, Y - box[1]) / 6.0
                        if rim < 1:
                            if mk.dither(X, Y) > rim:
                                continue
                            k_ *= 0.6
                        r, g, bb, a = px[x, y]
                        px[x, y] = mk.mix((r, g, bb, a), LIGHT, round(k_ * 20) / 20)
            for k, (mx, my, ph) in enumerate(motes):
                u = (t + ph) % 1.0
                X = int(round(mx + 2 * mk.wave(u)))
                Y = int(round(my - mk.drift(u, 8, 8)))
                a = mk.fade(u) * breath
                if a > 0.3:
                    x, y = X - x0, Y - y0
                    if 0 <= x < w and 0 <= y < h:
                        px[x, y] = mk.mix(px[x, y], LIGHT, 0.85)
        return None, over
    return fn


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    makers = {'map-fx-3-cascada': _fx_cascada, 'map-fx-3-lianas': _fx_lianas, 'map-fx-3-charco': _fx_charco,
              'map-fx-3-mono': _fx_mono, 'map-fx-3-rayos': _fx_rayos}
    for name, box, n, fps in FX:
        sc.add_fx(name, box, n, fps, makers[name](sc))
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
