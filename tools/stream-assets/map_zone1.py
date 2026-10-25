"""
Zona 1 «Bosque» del mapa del Chess Runner (jefe: la ardilla; oscuridad 0): bosque de nogales y troncos con hojarasca,
día luminoso y verdes vivos. Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110), serpentea en tres lazos, cruza el arroyo por un puentecito y sale por arriba
(x = 110) entre los nogales grandes del jefe.

Puntos (HISTORIA.md, «Puntos del mapa»: 6 de patrón con el último de jefe + rescate + campamento; el orden entre ellos no lo
fija la historia, así que se decide aquí): el **rescate a mitad** de zona (4.º, justo antes del puente) y el **campamento justo
antes del jefe** (7.º; HISTORIA dice «campamento al final de cada zona»):
  1 pattern · 2 pattern · 3 pattern · 4 rescue · 5 pattern · 6 pattern · 7 camp · 8 boss

Ambiente: `hojas` (hojas que caen de un nogal y se posan), `copas` (dos copas que se mecen), `arroyo` y `arroyo2`
(corriente y destellos, a cada lado del puente) y `ardilla` (asoma por detrás del tronco del nogal grande, junto al jefe, y
sale a la rama).
"""
import functools
import math
import random

from PIL import Image, ImageDraw

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 1
LEVEL = 0

GROUND = {'base': C('#86c25e'), 'light': C('#97cd6a'), 'dark': C('#77b453'), 'dash': C('#79b656'),
          'dash2': C('#a3d677'), 'tuft': C('#68a44a')}
PATH = {'fill': C('#e4c48e'), 'dark': C('#bb9460'), 'light': C('#f3ddb0'), 'speck': C('#d2ad78'),
        'rim': C('#6e8a3c'), 'pebble': C('#f7ecd4'), 'grass': C('#74b052')}
WALNUT = {'leaf': (C('#3f8a48'), C('#55a552'), C('#6fbd5c'), C('#93d26e')), 'leaf_out': C('#2a5a36'),
          'bark': (C('#5e4632'), C('#7d6248'), C('#9c8062')), 'bark_out': C('#3a2a20'), 'nut': C('#d6df86')}
OAK = {'leaf': (C('#367a44'), C('#4a964c'), C('#62ae56'), C('#86c868')), 'leaf_out': C('#244e30'),
       'bark': (C('#55402e'), C('#715640'), C('#8e7254')), 'bark_out': C('#35261c')}
LIME = {'leaf': (C('#4a9446'), C('#62b052'), C('#80c662'), C('#a8dc80')), 'leaf_out': C('#2e5e34'),
        'bark': (C('#5e4632'), C('#7d6248'), C('#9c8062')), 'bark_out': C('#3a2a20')}
BUSH = {'leaf': (C('#3f8a48'), C('#55a552'), C('#70be5e'), C('#94d270')), 'leaf_out': C('#2a5a36')}
WOOD = {'bark': (C('#5e4632'), C('#7d6248'), C('#9c8062')), 'bark_out': C('#3a2a20'),
        'wood': (C('#c39a68'), C('#e8c896')), 'moss': C('#7cc45a')}
STONE = {'stone': (C('#7e8088'), C('#a4a6ad'), C('#c9cbd0')), 'stone_out': C('#4a4c58')}
LITTER = (C('#d9a441'), C('#c77d3a'), C('#e8c25a'), C('#a8692e'))
LEAF_FALL = {'fill': C('#ffd65a'), 'light': C('#fff0a0'), 'edge': C('#8a4a1e')}   # las que caen: fuera de `LITTER`
WATER = {'fill': C('#5db0d6'), 'deep': C('#4790bd'), 'light': C('#8dd2ec'), 'foam': C('#e6f7fc'),
         'bank': C('#8a7048'), 'bank2': C('#a88a5a')}

PATH_CTRL = [(110, 434), (112, 400), (92, 372), (58, 350), (48, 318), (70, 292), (120, 280), (160, 262), (172, 232),
             (160, 200), (118, 184), (70, 170), (48, 140), (58, 108), (100, 92), (146, 78), (150, 50), (128, 28), (110, 8),
             (110, -14)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('pattern', 'pattern', 'pattern', 'rescue', 'pattern', 'pattern', 'camp', 'boss')
FRACS = (0.06, 0.17, 0.30, 0.40, 0.52, 0.64, 0.76, 0.875)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

STREAM = mk.Curve([(-12, 212), (30, 222), (80, 214), (124, 230), (172, 226), (234, 238)])
BRIDGE_Y = 226

# Ambiente: (nombre, caja (x0, y0, x1, y1), cuadros, fps)
HOJAS_BOX = (152, 318, 214, 392)
FX = [
    ('map-fx-1-hojas', HOJAS_BOX, 8, 5),
    ('map-fx-1-copas', (0, 246, 64, 290), 8, 3),
    ('map-fx-1-arroyo', (0, 204, 158, 240), 8, 6),
    # el tramo a la derecha del puente (empieza pasado su borde derecho, x = 184): la fase usa la X absoluta, así que
    # las rayitas empalman con las del tramo izquierdo
    ('map-fx-1-arroyo2', (185, 216, 220, 242), 8, 6),
    ('map-fx-1-ardilla', (184, 76, 214, 104), 8, 4),
]

META = {'zones': {str(ZONE): {
    'name': 'Bosque', 'boss': 'ardilla', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- piezas propias

def squirrel(blink=False, tail=0):
    """La ardilla de perfil (mira a la derecha), 11×10: cola grande en S detrás y la cabeza con su oreja con pincel."""
    fur, light, belly, dark, eye = C('#c8682e'), C('#e8954e'), C('#f4d6a0'), C('#97461f'), C('#2c1a12')
    rows = [
        '.TT........',
        'TttT....e..',
        'TttT...hhh.',
        'TtT...hhhhh',
        '.Tt..bhhEhN',
        '..Tt.bbhhh.',
        '..TtbbBBh..',
        '...bbbBB...',
        '...bbbbB...',
        '...f..f....',
    ]
    if tail:
        # la cola se sacude: la punta se curva hacia delante
        rows = ['..TT.......', '.TttT...e..'] + rows[2:]
    sp = layer(11, 10)
    px = sp.load()
    cols = {'T': fur, 't': light, 'h': fur, 'b': fur, 'B': belly, 'e': dark, 'E': eye if not blink else dark,
            'N': dark, 'f': dark}
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in cols:
                px[x, y] = cols[ch]
    px[6, 2] = light
    px[7, 2] = light
    return outlined(sp, C('#4a2412'))


def bridge():
    """Puentecito de tablas que cruza el arroyo (plano, se ve desde arriba), con barandas a los lados."""
    w, h = 24, 19
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    planks = (C('#c8955e'), C('#dcae78'), C('#b38250'))
    for k, y in enumerate(range(2, h - 2, 3)):
        d.rectangle([3, y, w - 4, y + 1], fill=planks[k % 3])
        d.point((3 + (k * 5) % (w - 8), y), fill=C('#8a6040'))
        d.line([(3, y + 2), (w - 4, y + 2)], fill=C('#7a5236'))
    for x in (1, w - 2):
        d.rectangle([x - 1, 0, x, h - 1], fill=C('#9a6c44'))
        d.line([(x - 1, 0), (x - 1, h - 1)], fill=C('#b8865a'))
        for y in (0, h // 2, h - 2):
            d.rectangle([x - 1, y, x, y + 1], fill=C('#7a5236'))
    return outlined(sp, C('#4a2f1e'))


def mushroom(cap):
    sp = layer(3, 3)
    px = sp.load()
    px[0, 0] = cap
    px[1, 0] = cap
    px[2, 0] = cap
    px[1, 1] = C('#f4ead6')
    px[1, 2] = C('#f4ead6')
    px[0, 0] = mk.tone(cap, 1.25)
    return outlined(sp, C('#5a2a1e'))


def fire_ring():
    """Círculo de piedras con brasas apagadas (el campamento de la manada)."""
    sp = layer(13, 7)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 0, 12, 6], fill=C('#8e9096'))
    d.ellipse([2, 1, 10, 5], fill=C('#5a4a3e'))
    d.point((5, 3), fill=C('#c86a3a'))
    d.point((7, 2), fill=C('#e89a4a'))
    d.line([(4, 2), (8, 4)], fill=C('#7d6248'))
    for x, y in ((0, 3), (3, 0), (6, 0), (9, 0), (12, 3), (9, 6), (6, 6), (3, 6)):
        d.point((x, y), fill=C('#c9cbd0'))
    return outlined(sp, C('#4a4c58'))


# ---------------------------------------------------------------- la escena

def _paint_stream(sc):
    m = STREAM.mask(4.4, wobble=0.9, seed=3)
    px = sc.ground.load()
    mm = m.load()
    rim = m.filter(mk.ImageFilter.MaxFilter(3)).load()
    for y in range(mk.H):
        for x in range(mk.W):
            if mm[x, y]:
                up = y > 0 and mm[x, y - 1]
                up2 = y > 1 and mm[x, y - 2]
                down = y < mk.H - 1 and mm[x, y + 1]
                c = WATER['fill']
                if not up or (not up2 and mk.dither(x, y) < 0.5):
                    c = WATER['deep']
                elif not down:
                    c = WATER['light']
                elif mk._h(x // 3, y, 9) < 0.08:
                    c = WATER['light']
                px[x, y] = c
            elif rim[x, y]:
                px[x, y] = WATER['bank'] if (y < mk.H - 1 and mm[x, y + 1]) else WATER['bank2']
    return m


def _in(box, x, y):
    return box[0] <= x < box[2] and box[1] <= y < box[3]


def _litter(sc, x, y, n, rnd, spread=12, avoid=None):
    """Hojarasca alrededor de (x, y): nunca sobre el camino ni el agua, ni dentro de la caja `avoid`."""
    d = sc.draw()
    water = sc._stream.load()
    for _ in range(n):
        lx, ly = int(rnd.gauss(x, spread)), int(rnd.gauss(y, spread * 0.45))
        if avoid and (_in(avoid, lx, ly) or _in(avoid, lx + 1, ly)):
            continue
        if 0 <= lx < mk.W - 1 and 0 <= ly < mk.H and not sc.near_path((lx, ly, lx + 2, ly + 1), 1) \
                and not water[lx, ly] and not water[lx + 1, ly]:
            c = rnd.choice(LITTER)
            d.point((lx, ly), fill=c)
            if rnd.random() < 0.5:
                d.point((lx + 1, ly), fill=mk.tone(c, 0.85))


def _flowers(sc, rnd, n):
    d = sc.draw()
    cols = (C('#fff6e0'), C('#ffe27a'), C('#f2a7c8'))
    for _ in range(n):
        x, y = rnd.randint(3, mk.W - 4), rnd.randint(3, mk.H - 4)
        if sc.free((x - 1, y - 1, x + 2, y + 3), 2):
            c = rnd.choice(cols)
            d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=c)
            d.point((x, y), fill=C('#f0b43a'))
            d.point((x, y + 2), fill=C('#4f8f3a'))


SHADOW = (0.26, 0.16)


def _scene():
    rnd = random.Random(101)
    sc = mk.Scene(LEVEL, GROUND, seed=1)
    sc.shadow_color = C('#2c5a34', 78)
    stream = _paint_stream(sc)
    sc._stream = stream
    sc.lay_path(CURVE, PATH, POINTS)
    for name, box, _n, _fps in FX:
        sc.reserved.append(box)

    # el puente sobre el cruce del camino con el arroyo
    bx = int(round(min(range(int(CURVE.length)), key=lambda s: abs(CURVE.at(s)[1] - BRIDGE_Y) + (0 if CURVE.at(s)[0] > 120 else 999))))
    cx, cy = CURVE.at(bx)
    sc.put(bridge(), int(round(cx)), int(round(cy)) + 9, z=-1)

    # --- los animados (posiciones fijas)
    # nogal que suelta hojas (abajo a la derecha)
    t_hojas = mk.tree(11, 17, WALNUT, nuts=4)
    box = sc.put(t_hojas, 186, 358, shadow=SHADOW)
    sc._walnut = (box[0], box[1], t_hojas)
    # dos copas que se mecen (izquierda, sobre el arroyo)
    sway_a = {s: mk.tree(21, 14, LIME, sway=s) for s in (-1, 0, 1)}
    sway_b = {s: mk.tree(22, 12, OAK, sway=s) for s in (-1, 0, 1)}
    sc.put(sway_a[0], 16, 302, key='copaA', shadow=SHADOW)
    sc.put(sway_b[0], 44, 290, key='copaB', shadow=SHADOW)
    # el nogal grande de la ardilla, junto al jefe
    big = mk.tree(31, 22, WALNUT, nuts=7, branch=True, trunk_h=26)
    big_left, big_top, _r, _b = sc.put(big, 196, 116, shadow=SHADOW)

    # --- decorado fijo (el relleno no lo tapa)
    def deco(sp, x, y, **kw):
        sc.reserved.append(sc.put(sp, x, y, **kw))

    deco(fire_ring(), 116, 124)
    deco(mk.log(5, 16, WOOD), 104, 116)
    deco(mk.log(6, 13, WOOD), 128, 133)
    deco(mk.log(7, 22, WOOD, thick=7), 26, 388, shadow=SHADOW)
    deco(mk.stump(8, 10, WOOD), 140, 345, shadow=SHADOW)
    deco(mk.stump(9, 8, WOOD), 92, 245, shadow=SHADOW)
    deco(mk.log(10, 18, WOOD), 118, 152, shadow=SHADOW)
    for x, y, col in ((131, 349, C('#d8483a')), (36, 392, C('#d8483a')), (100, 248, C('#e8a040')), (126, 156, C('#d8483a'))):
        deco(mushroom(col), x, y)
    deco(mk.rock(12, 12, STONE), 96, 324, shadow=SHADOW)
    deco(mk.rock(13, 8, STONE), 206, 238, shadow=SHADOW)
    deco(mk.rock(14, 9, STONE), 6, 230)

    # --- relleno: un borde de bosque a cada lado y árboles en los huecos
    pals = (WALNUT, OAK, LIME, WALNUT)
    trees = [(186, 358, 17), (196, 116, 22), (16, 302, 14), (44, 290, 12)]
    for k in range(900):
        side = rnd.random()
        if side < 0.3:
            x = rnd.randint(-8, 20)
        elif side < 0.6:
            x = rnd.randint(200, 228)
        else:
            x = rnd.randint(10, 210)
        y = rnd.randint(4, 446)
        r = rnd.choice((9, 10, 11, 12, 13, 14, 15, 16, 18))
        if any((x - tx) ** 2 + ((y - ty) * 1.6) ** 2 < (0.62 * (r + tr)) ** 2 for tx, ty, tr in trees):
            continue
        sp = mk.tree(1000 + k, r, pals[k % 4], nuts=2 if k % 4 in (0, 3) else 0)
        if sc.try_put(sp, x, y, pad=3, shadow=SHADOW):
            trees.append((x, y, r))
    for k in range(70):
        x, y = rnd.randint(4, 216), rnd.randint(6, 416)
        sp = mk.bush(2000 + k, rnd.choice((3, 4, 5)), BUSH, flowers=C('#fff2d8') if k % 5 == 0 else None)
        sc.try_put(sp, x, y, pad=2, shadow=SHADOW)
    # bajo el nogal de las hojas, poca hojarasca: las que caen tienen que distinguirse de las que ya están en el suelo
    for x, y, _r in trees:
        if (x, y) == (186, 358):
            _litter(sc, x, y + 3, 8, rnd)
        else:
            _litter(sc, x, y + 3, 22, rnd, avoid=HOJAS_BOX)
    for k in range(18):
        _litter(sc, rnd.randint(0, 220), rnd.randint(0, 420), 10, rnd, spread=8, avoid=HOJAS_BOX)
    _flowers(sc, rnd, 40)
    sc._sway = (sway_a, sway_b)
    sc._big = (big_left, big_top, big)
    return sc


# ---------------------------------------------------------------- ambientes

def _fx_hojas(sc):
    """
    Hojas amarillas (color propio, fuera de `LITTER`, con borde) que se sueltan del borde de abajo de la copa (nunca dentro), caen
    meciéndose el 80 % de su vida y el resto se quedan quietas en el suelo antes de desaparecer.
    """
    rnd = random.Random(7)
    left, top, tree = sc._walnut
    alpha = tree.getchannel('A').load()

    def rim(x):
        """Primera fila bajo el borde de abajo de la copa en la columna `x` (escena)."""
        cx, y = x - left, 0
        while not alpha[cx, y]:
            y += 1
        while alpha[cx, y]:
            y += 1
        return top + y

    # a los lados del tronco, justo bajo el borde de la copa
    xs = [rnd.choice((rnd.randint(171, 180), rnd.randint(192, 201))) for _ in range(7)]
    # recorrido corto (18–24 px en 6–7 cuadros): con 8 cuadros como máximo, así no pasa de ~5 px por cuadro
    specs = [(x, rim(x), rnd.uniform(-12, -4), rnd.uniform(18, 24), k / 7, 1.5) for k, x in enumerate(xs)]
    L, Y, D = LEAF_FALL['light'], LEAF_FALL['fill'], LEAF_FALL['edge']
    # posturas al girar (todas de al menos 3×2 en amarillo); la primera es la hoja plana, la de posada
    poses = (('LYY.', 'YYYD', '.DDD'),
             ('LY..', 'YYY.', '.YYD', '..DD'),
             ('.LYY', 'YYYD', 'DDD.'))
    cols = {'L': L, 'Y': Y, 'D': D}
    FALL = 0.8

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            for k, (sx, sy, dx, dy, ph, sw) in enumerate(specs):
                u = (t + ph) % 1.0
                f = min(1.0, u / FALL)
                x = sx + dx * f + sw * math.sin(3 * math.pi * f)       # vuelve al eje al posarse (sin(3π) = 0)
                y = sy + dy * f
                pose = poses[0] if f >= 1.0 else poses[(int(u * 9) + k) % 3]
                X, Yy = int(round(x)) - x0, int(round(y)) - y0
                for ry, row in enumerate(pose):
                    for rx, ch in enumerate(row):
                        if ch in cols and 0 <= X + rx < img.size[0] and 0 <= Yy + ry < img.size[1]:
                            px[X + rx, Yy + ry] = cols[ch]
        return None, over
    return fn


def _fx_copas(sc):
    a, b = sc._sway
    pattern_a = (0, 1, 1, 1, 0, -1, -1, -1)
    pattern_b = (1, 1, 0, -1, -1, -1, 0, 1)

    def fn(t, i):
        return {'copaA': a[mk.seq(pattern_a, i)], 'copaB': b[mk.seq(pattern_b, i)]}, None
    return fn


def _fx_arroyo(sc, dense=0.55, fill=0.25):
    """`dense`/`fill`: parte de las rayitas claras/medias; el tramo corto de la derecha del puente lleva más para que no se vea quieto."""
    m = sc._stream.load()
    path = sc.path.load()
    ground = sc._final_ground(sc.shadow_color).load()

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for y in range(h):
                for x in range(w):
                    X, Y = x + x0, y + y0
                    if not m[X, Y] or path[X, Y] or not (Y > 0 and m[X, Y - 1]) or not (Y < mk.H - 1 and m[X, Y + 1]):
                        continue
                    if px[x, y] != ground[X, Y]:
                        continue            # algo encima del agua (el puente, una rama): no se le pinta corriente
                    # rayitas de corriente que avanzan un periodo completo (12 px) por vuelta: bucle sin salto
                    ph = (X - t * 12 + mk._h(Y, 3) * 12) % 12
                    if ph < 2 and mk._h(Y, X // 12, 5) < dense:
                        px[x, y] = WATER['light']
                    elif 2 <= ph < 3 and mk._h(Y, X // 12, 5) < fill:
                        px[x, y] = WATER['fill']
            # destellos que parpadean en su sitio
            for k, (sx, sy) in enumerate(((14, 216), (47, 221), (78, 216), (100, 224), (198, 229), (211, 233))):
                on = mk.seq((1, 0, 0, 2, 0, 0, 1, 0), i + k * 3)
                X, Y = sx - x0, sy - y0
                if on and m[sx, sy] and 0 <= X < w and 0 <= Y < h:
                    px[X, Y] = WATER['foam']
                    if on == 2:
                        for dx, dy in ((1, 0), (-1, 0)):
                            if m[sx + dx, sy + dy] and 0 <= X + dx < w:
                                px[X + dx, Y + dy] = WATER['light']
        return None, over
    return fn


def _fx_ardilla(sc):
    left, top, big = sc._big
    # la rama sale a la derecha del tronco, bajo la copa: la ardilla asoma por detrás del tronco
    trunk_r = left + big.info['trunk_r']
    branch_y = top + big.info['branch_y']
    # asoma (recortada por el tronco) y en el pico sale entera a la rama, así se ve la cola y la sacude
    frames = [None, 6, 10, 15, ('blink', 15), ('tail', 15), 10, 6]

    def fn(t, i):
        def over(img, x0, y0):
            st = frames[i]
            if st is None:
                return
            blink = isinstance(st, tuple) and st[0] == 'blink'
            tail = isinstance(st, tuple) and st[0] == 'tail'
            dx = st[1] if isinstance(st, tuple) else st
            sq = squirrel(blink=blink, tail=tail)
            sx, sy = trunk_r - 13 + dx, branch_y - sq.size[1] + 1
            clip = layer(*sq.size)
            for yy in range(sq.size[1]):
                for xx in range(sq.size[0]):
                    if sx + xx >= trunk_r + 2:
                        clip.putpixel((xx, yy), sq.getpixel((xx, yy)))
            mk.blit(img, clip, sx - x0, sy - y0)
        return None, over
    return fn


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    makers = {'map-fx-1-hojas': _fx_hojas, 'map-fx-1-copas': _fx_copas, 'map-fx-1-arroyo': _fx_arroyo,
              'map-fx-1-arroyo2': functools.partial(_fx_arroyo, dense=0.85, fill=0.4), 'map-fx-1-ardilla': _fx_ardilla}
    for name, box, n, fps in FX:
        sc.add_fx(name, box, n, fps, makers[name](sc))
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
