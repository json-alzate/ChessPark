"""
Zona 2 «Praderas» del mapa del Chess Runner (jefe: el conejo; oscuridad 1): praderas con madrigueras, un huerto de
zanahorias y cercas bajas; tarde cálida, con el sol bajo a la izquierda y las primeras sombras largas.
Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110, donde sale el de la zona 1), tuerce primero a la derecha, serpentea en tres lazos y sale
por arriba (x = 110) por la portezuela abierta de la cerca, después de la gran madriguera del jefe.

Puntos: mismo reparto que la zona 1 (HISTORIA.md no fija el orden; se decide aquí): **rescate a mitad** (4.º) y
**campamento justo antes del jefe** (7.º, «campamento al final de cada zona»):
  1 pattern · 2 pattern · 3 pattern · 4 rescue · 5 pattern · 6 pattern · 7 camp · 8 boss

Ambiente: `conejo` (orejas que asoman de una madriguera), `mariposas` (dos que revolotean sobre las flores), `hierba`
(un pastizal alto que ondea con el viento) y `nube` (una nubecilla que pasa, con su sombra, y se desvanece).
"""
import functools
import math
import random

from PIL import ImageDraw

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 2
LEVEL = 1

# Tarde: suelo más bajo de luz que el del bosque (la zona 2 tiene que leerse más oscura), con las luces tirando a naranja.
GROUND = {'base': C('#98ae5a'), 'light': C('#a8ba64'), 'dark': C('#86a04e'), 'dash': C('#8ca450'),
          'dash2': C('#d0b462'), 'tuft': C('#748a3a')}
PATH = {'fill': C('#dcae74'), 'dark': C('#b68852'), 'light': C('#f4d8a2'), 'speck': C('#d0a26a'),
        'rim': C('#7e883a'), 'pebble': C('#f6e4c0'), 'grass': C('#98b250')}
OAK = {'leaf': (C('#4e7e3a'), C('#68983e'), C('#88b04a'), C('#b0c862')), 'leaf_out': C('#34502a'),
       'bark': (C('#5e4230'), C('#7c5a40'), C('#9a7656')), 'bark_out': C('#3a281e')}
APPLE = {'leaf': (C('#4a8040'), C('#62a048'), C('#82b856'), C('#a8cc6a')), 'leaf_out': C('#30502c'),
         'bark': (C('#5e4230'), C('#7c5a40'), C('#9a7656')), 'bark_out': C('#3a281e'), 'nut': C('#e05a3a')}
HEDGE = {'leaf': (C('#4c7e3a'), C('#64983e'), C('#82b04c'), C('#a6c462')), 'leaf_out': C('#34502a')}
FENCE = {'wood': (C('#8a6440'), C('#b08454'), C('#d2a470')), 'wood_out': C('#4a3220')}
STONE = {'stone': (C('#857f7c'), C('#a8a29c'), C('#cbc5bc')), 'stone_out': C('#4e4846')}
EARTH = (C('#6a4a30'), C('#8e6640'), C('#a87c50'), C('#c49a68'))
HOLE = C('#2e2018')
FUR = {'fur': C('#cdbfa8'), 'shade': C('#a2927c'), 'pink': C('#eea2aa'), 'out': C('#4e4238'), 'eye': C('#2a201c')}
FLOWERS = (C('#ffe066'), C('#fff4dc'), C('#f6b0c8'), C('#ffd040'))

PATH_CTRL = [(110, 434), (108, 402), (132, 378), (168, 358), (176, 326), (150, 302), (100, 292), (56, 276), (44, 244),
             (66, 216), (116, 204), (160, 190), (176, 158), (158, 128), (110, 114), (66, 100), (52, 70), (72, 44),
             (100, 26), (110, 6), (110, -14)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('pattern', 'pattern', 'pattern', 'rescue', 'pattern', 'pattern', 'camp', 'boss')
FRACS = (0.055, 0.165, 0.29, 0.40, 0.53, 0.645, 0.76, 0.875)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

# Sol bajo a la izquierda: las sombras se alargan hacia la derecha.
SHADOW = (1.15, 0.30)
BURROW_EARS = (128, 256)       # madriguera de las orejas (centro del agujero)

FX = [
    ('map-fx-2-conejo', (118, 240, 140, 260), 8, 4),
    ('map-fx-2-mariposas', (70, 136, 152, 184), 8, 6),
    ('map-fx-2-hierba', (128, 46, 208, 92), 8, 5),
    ('map-fx-2-nube', (0, 368, 64, 408), 8, 2),
]

META = {'zones': {str(ZONE): {
    'name': 'Praderas', 'boss': 'conejo', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- piezas propias

def burrow(big=False):
    """Montículo de tierra con su agujero (madriguera). Devuelve (fondo, labio delantero) del mismo tamaño."""
    w, h = (34, 14) if big else (18, 9)
    back, lip = layer(w, h), layer(w, h)
    d = ImageDraw.Draw(back)
    d.ellipse([0, 1, w - 1, h - 1], fill=EARTH[1])
    d.ellipse([2, 0, w - 3, h - 3], fill=EARTH[2])
    d.ellipse([3, 0, w // 2, h // 2 - 1], fill=EARTH[3])
    hw = 6 if big else 4
    cx, cy = w // 2, h // 2 + 1
    d.ellipse([cx - hw, cy - hw // 2 - 1, cx + hw - 1, cy + hw // 2], fill=HOLE)
    d.line([(cx - hw + 1, cy - hw // 2 - 1), (cx + hw - 2, cy - hw // 2 - 1)], fill=EARTH[0])
    dl = ImageDraw.Draw(lip)
    dl.line([(cx - hw, cy + hw // 2), (cx + hw - 1, cy + hw // 2)], fill=EARTH[2])
    dl.point((cx - hw - 1, cy + hw // 2 - 1), fill=EARTH[2])
    dl.point((cx + hw, cy + hw // 2 - 1), fill=EARTH[2])
    for k in range(3):
        dl.point((cx - 3 + k * 3, cy + hw // 2 + 1), fill=EARTH[3])
    return outlined(back, EARTH[0]), outlined(lip, EARTH[0])


def carrot_pile():
    """Montón de zanahorias junto a la guarida del jefe (unas 16×10), con una mordida encima."""
    sp = layer(17, 10)
    d = ImageDraw.Draw(sp)
    orange, light, dark, leaf, leaf2 = C('#f08a2c'), C('#ffb056'), C('#c8641e'), C('#4e9a3a'), C('#6ab84a')

    def carrot(x, y, n=7, bitten=False):
        d.rectangle([x, y, x + n - 2, y + 1], fill=orange)
        d.line([(x, y), (x + n - 3, y)], fill=light)
        d.point((x + n - 1, y + 1), fill=dark)
        d.line([(x + 1, y + 1), (x + n - 2, y + 1)], fill=dark)
        d.point((x - 1, y - 1), fill=leaf)
        d.point((x - 2, y), fill=leaf2)
        d.point((x - 1, y + 1), fill=leaf)
        if bitten:                       # la punta mordida: un hueco claro con borde
            d.point((x + n - 2, y), fill=C('#ffe0b0'))
            d.point((x + n - 1, y + 1), fill=(0, 0, 0, 0))
            d.point((x + n - 2, y + 1), fill=C('#ffe0b0'))

    for x, y in ((3, 7), (9, 7), (2, 4), (8, 5), (5, 2)):
        carrot(x, y)
    carrot(9, 2, 6, bitten=True)
    return outlined(sp, C('#6a3a1a'))


def carrot_patch(cols, rows):
    """Bancal de zanahorias: surcos de tierra con las coronas naranjas y su penacho verde."""
    w, h = cols * 7 + 4, rows * 8 + 4
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.rectangle([0, 0, w - 1, h - 1], fill=EARTH[1])
    for r in range(rows):
        y = 3 + r * 8
        d.rectangle([1, y + 3, w - 2, y + 5], fill=EARTH[2])
        d.line([(1, y + 6), (w - 2, y + 6)], fill=EARTH[0])
        for c in range(cols):
            x = 3 + c * 7 + (r % 2) * 2
            d.rectangle([x, y + 3, x + 2, y + 4], fill=C('#f08a2c'))
            d.point((x, y + 3), fill=C('#ffb056'))
            d.point((x + 1, y + 5), fill=C('#c8641e'))
            d.line([(x + 1, y + 2), (x + 1, y)], fill=C('#4e9a3a'))
            d.point((x, y + 1), fill=C('#6ab84a'))
            d.point((x + 2, y + 1), fill=C('#6ab84a'))
            d.point((x - 1, y), fill=C('#4e9a3a'))
            d.point((x + 3, y), fill=C('#4e9a3a'))
    return outlined(sp, EARTH[0])


GRASS_ROOT = C('#6a8238')
GRASS_BODY = (C('#7a9a40'), C('#94b44a'))
GRASS_MID = C('#b4c860')
GRASS_TIP = C('#d2d47a')


def tall_grass(seed, lean=0, n=6):
    """
    Mata de hierba alta: `n` briznas de 5–8 px sobre una fila de raíz oscura, con el cuerpo en verdes oscuros y la luz solo
    en las puntas (de lejos se lee como mata, no como un lavado pálido). `lean` (-1, 0, 1) la inclina con el viento:
    nada en la raíz, 1 px a media altura y 2 px en la punta.
    """
    rnd = random.Random(seed)
    sp = layer(n * 2 + 4, 10)
    px = sp.load()
    xs = []
    for k in range(n):
        x = 2 + k * 2 + rnd.randint(0, 1)
        hgt = rnd.randint(5, 8)
        c = GRASS_BODY[rnd.randint(0, 1)]
        xs.append(x)
        for j in range(hgt):
            y = 8 - j
            dx = int(round(lean * 2 * (j / (hgt - 1)) ** 1.6))
            xx = max(0, min(sp.size[0] - 1, x + dx))
            px[xx, y] = GRASS_TIP if j == hgt - 1 else (GRASS_MID if j == hgt - 2 and hgt > 6 else c)
    for x in xs:                       # raíz oscura bajo cada brizna (no una raya seguida: las filas no se leen como escalones)
        px[x, 9] = GRASS_ROOT
        if rnd.random() < 0.5:
            px[x + 1, 9] = GRASS_ROOT
    return sp


def ears(twitch=False):
    """Orejas del conejo y su coronilla con los ojos (12×11 con el contorno); asoma desde el agujero en `_fx_conejo`."""
    sp = layer(10, 9)
    d = ImageDraw.Draw(sp)
    f = FUR
    # orejas largas
    d.rectangle([2, 0, 3, 6], fill=f['fur'])
    d.point((3, 1), fill=f['pink'])
    d.line([(3, 2), (3, 5)], fill=f['pink'])
    if twitch:
        d.rectangle([6, 2, 7, 6], fill=f['fur'])
        d.point((8, 1), fill=f['fur'])
        d.point((8, 2), fill=f['fur'])
        d.line([(6, 3), (6, 5)], fill=f['pink'])
    else:
        d.rectangle([6, 0, 7, 6], fill=f['fur'])
        d.line([(6, 1), (6, 5)], fill=f['pink'])
    # coronilla y ojos
    d.ellipse([1, 5, 8, 10], fill=f['fur'])
    d.line([(1, 8), (8, 8)], fill=f['shade'])
    d.point((3, 7), fill=f['eye'])
    d.point((6, 7), fill=f['eye'])
    return outlined(sp, f['out'])


def butterfly(color, wings):
    """Mariposa de 5×3: alas abiertas (`wings` = 1) o plegadas (0)."""
    sp = layer(5, 4)
    px = sp.load()
    body = C('#4a3a30')
    px[2, 1] = body
    px[2, 2] = body
    if wings:
        for x, y in ((0, 0), (1, 0), (1, 1), (3, 0), (4, 0), (3, 1), (0, 2), (4, 2)):
            px[x, y] = color
        px[0, 2] = mk.tone(color, 0.8)          # las alas de abajo, en sombra: se lee aunque el ala sea clara
        px[4, 2] = mk.tone(color, 0.8)
        px[1, 0] = mk.tone(color, 1.12)
        px[3, 0] = mk.tone(color, 1.12)
    else:
        px[1, 0] = color
        px[3, 0] = color
        px[2, 0] = mk.tone(color, 0.85)
    return sp


def cloud():
    """Nubecilla plana (sin contorno, como las del runner)."""
    sp = layer(26, 10)
    d = ImageDraw.Draw(sp)
    col = C('#fff6ec', 220)
    d.rounded_rectangle([0, 4, 25, 9], radius=3, fill=col)
    d.ellipse([5, 0, 15, 8], fill=col)
    d.ellipse([12, 2, 20, 9], fill=col)
    d.line([(2, 9), (23, 9)], fill=C('#e8d8d0', 220))
    return sp


def gate_fence(sc):
    """Cerca baja de punta a punta arriba, con la portezuela abierta donde sale el camino."""
    y = 15
    left = [(-4, y + 2), (40, y), (86, y + 1)]
    right = [(132, y + 1), (180, y), (224, y + 2)]
    for pts in (left, right):
        sp, fx, fy = mk.fence(pts, FENCE)
        sc.put(sp, fx, fy, shadow=SHADOW)
    # dos postes altos a los lados de la salida (la portezuela ya está abierta)
    for x in (88, 132):
        p = layer(4, 13)
        d = ImageDraw.Draw(p)
        d.rectangle([0, 1, 3, 12], fill=FENCE['wood'][1])
        d.line([(0, 1), (0, 12)], fill=FENCE['wood'][2])
        d.line([(3, 1), (3, 12)], fill=FENCE['wood'][0])
        d.rectangle([0, 0, 3, 0], fill=FENCE['wood'][2])
        sc.put(outlined(p, FENCE['wood_out']), x, y + 2, shadow=SHADOW)


# ---------------------------------------------------------------- la escena

def _flowers(sc, rnd, n, box=None):
    d = sc.draw()
    for _ in range(n):
        if box:
            x, y = rnd.randint(box[0], box[2]), rnd.randint(box[1], box[3])
        else:
            x, y = rnd.randint(3, mk.W - 4), rnd.randint(3, mk.H - 4)
        if sc.free((x - 1, y - 1, x + 2, y + 3), 2) or box:
            if sc.near_path((x - 1, y - 1, x + 2, y + 3), 1):
                continue
            c = rnd.choice(FLOWERS)
            d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=c)
            d.point((x, y), fill=C('#e89a30') if c != FLOWERS[0] else C('#fff4dc'))
            d.point((x, y + 2), fill=C('#5e8a34'))


def _scene():
    rnd = random.Random(202)
    sc = mk.Scene(LEVEL, GROUND, seed=2)
    sc.shadow_color = C('#4a3c58', 84)
    sc.lay_path(CURVE, PATH, POINTS)
    for name, box, _n, _fps in FX:
        sc.reserved.append(box)

    def deco(sp, x, y, **kw):
        box = sc.put(sp, x, y, **kw)
        sc.reserved.append(box)
        return box

    gate_fence(sc)
    # bajo el pastizal, el suelo más oscuro (la hierba alta da sombra): ancla las matas y de lejos se lee como pastizal
    gpx = sc.ground.load()
    path = sc.path.load()
    for y in range(48, 92):
        for x in range(130, 206):
            e = ((x - 168) / 40.0) ** 2 + ((y - 71) / 23.0) ** 2
            if e < 1 - 0.4 * mk.dither(x, y) and not path[x, y]:
                gpx[x, y] = GROUND['dark']
    # huerto de zanahorias con su cerca (abajo a la izquierda)
    deco(carrot_patch(7, 3), 40, 352, shadow=SHADOW)
    for pts in ([(6, 318), (74, 318)], [(4, 320), (4, 360)], [(76, 320), (76, 360)], [(6, 362), (74, 362)]):
        sp, fx, fy = mk.fence(pts, FENCE)
        deco(sp, fx, fy, shadow=SHADOW)
    # cerca baja a lo largo del camino
    for pts in ([(168, 404), (206, 398)], [(28, 196), (60, 186), (96, 186)]):
        sp, fx, fy = mk.fence(pts, FENCE)
        deco(sp, fx, fy, shadow=SHADOW)

    # madrigueras (la de las orejas y unas cuantas más) y la gran madriguera del jefe
    for (x, y), big in ((BURROW_EARS, False), ((92, 252), False), ((150, 270), False), ((24, 70), True),
                        ((196, 228), False), ((30, 150), False)):
        back, lip = burrow(big)
        foot = y + back.size[1] // 2
        deco(back, x, foot, z=foot - 2, shadow=(0.6, 0.2))
        sc.put(lip, x, foot, z=foot + 1, key=None)
    # el montón de zanahorias (con una mordida) delante de la guarida del jefe
    deco(carrot_pile(), 16, 90, shadow=(0.6, 0.2))
    # huecos de la pradera: una madriguera pequeña a la derecha de la entrada y una piedra con flores abajo a la izquierda
    back, lip = burrow(False)
    deco(back, 176, 382, z=380, shadow=(0.6, 0.2))
    sc.put(lip, 176, 382, z=383)
    sc.try_put(mk.rock(520, 7, STONE), 32, 304, pad=1, shadow=SHADOW)

    # árboles sueltos (sus sombras largas cruzan la pradera)
    placed = []
    for k in range(400):
        if len(placed) >= 16:
            break
        x = rnd.choice((rnd.randint(-6, 22), rnd.randint(198, 226)))
        y = rnd.randint(30, 440)
        r = rnd.choice((10, 11, 12, 13, 14, 15))
        if any(abs(x - px_) < 26 and abs(y - py_) < 34 for px_, py_ in placed):
            continue
        pal = APPLE if k % 3 == 0 else OAK
        sp = mk.tree(300 + k, r, pal, nuts=5 if pal is APPLE else 0)
        if sc.try_put(sp, x, y, pad=2, shadow=SHADOW):
            sc.reserved.append(sc.opaque_box(sp, x, y))
            placed.append((x, y))
    # setos y matas por los bordes
    for k in range(140):
        x = rnd.choice((rnd.randint(-2, 18), rnd.randint(202, 222), rnd.randint(4, 216)))
        y = rnd.randint(20, 420)
        sp = mk.bush(400 + k, rnd.choice((3, 4, 4, 5, 6)), HEDGE, flowers=C('#fff0e0') if k % 4 == 0 else None)
        if sc.try_put(sp, x, y, pad=2, shadow=SHADOW):
            sc.reserved.append(sc.opaque_box(sp, x, y))
    for k, (x, y, w) in enumerate(((96, 236, 9), (160, 238, 7), (34, 226, 8), (190, 404, 10), (82, 70, 7))):
        sc.try_put(mk.rock(500 + k, w, STONE), x, y, pad=1, shadow=SHADOW)

    # pastizal alto: el animado (arriba a la derecha) y matas sueltas
    # ~30 matas en 3 filas con algo de desorden (la de atrás tapada en parte por la de delante)
    grass = []
    gr = random.Random(9)
    for row, fy in enumerate((60, 74, 88)):
        for col in range(10):
            k = row * 10 + col
            x, y = 136 + int(col * 7.2) + (row % 2) * 3 + gr.randint(-1, 1), fy + gr.randint(-2, 2)
            sp = tall_grass(600 + k, n=4)
            box = sc.opaque_box(sp, x, y)
            if not sc.near_path(box, 2) and box[0] >= 130 and box[2] <= 206:
                sc.put(sp, x, y, key=f'grass{k}')
                grass.append((k, x, y))
    for k in range(40):
        x, y = rnd.randint(4, 216), rnd.randint(30, 416)
        sc.try_put(tall_grass(700 + k), x, y, pad=1)
    _flowers(sc, rnd, 26, box=(74, 140, 148, 182))
    _flowers(sc, rnd, 8, box=(16, 286, 66, 310))
    _flowers(sc, rnd, 7, box=(146, 362, 196, 392))
    _flowers(sc, rnd, 14, box=(6, 374, 86, 412))
    for k in range(6):
        sc.put(tall_grass(800 + k), rnd.randint(8, 84), rnd.randint(378, 414))
    _flowers(sc, rnd, 70)
    sc._grass = grass
    return sc


# ---------------------------------------------------------------- ambientes

def _fx_conejo(sc):
    x, y = BURROW_EARS
    back, lip = burrow(False)
    foot = y + back.size[1] // 2
    # el agujero está en la fila `cy` del montículo: las orejas salen de ahí
    hole_y = foot - 4          # fila del borde delantero del agujero: lo que queda por debajo no se ve
    seq = (0, 0, 3, 6, 9, 9, 9, 5)
    twitch = (False, False, False, False, False, True, False, False)

    def fn(t, i):
        def over(img, x0, y0):
            hgt = mk.seq(seq, i)
            if not hgt:
                return
            e = ears(mk.seq(twitch, i))
            e = e.crop((0, 0, e.size[0], min(e.size[1], hgt + 1)))
            mk.blit(img, e, x - e.size[0] // 2 - x0, hole_y - hgt - y0)
            lip_left, lip_top = x - lip.size[0] // 2, foot - lip.size[1] + 1
            mk.blit(img, lip, lip_left - x0, lip_top - y0)
        return None, over
    return fn


def _fx_mariposas(sc):
    # la clara es crema rosada (la blanca no contrastaba con el suelo) y la otra, naranja
    flies = ((C('#ffd4de'), 96, 160, 11, 6, 0.0), (C('#f59a3a'), 126, 156, 10, 6, 0.4))

    def fn(t, i):
        def over(img, x0, y0):
            for k, (col, cx, cy, ax, ay, ph) in enumerate(flies):
                u = t + ph
                X = cx + ax * math.sin(2 * math.pi * u)
                Y = cy + ay * math.sin(4 * math.pi * u) - 2 * abs(math.sin(2 * math.pi * u * 4))
                sp = butterfly(col, (i + k) % 2)
                mk.blit(img, sp, int(round(X)) - 2 - x0, int(round(Y)) - 2 - y0)
        return None, over
    return fn


def _fx_hierba(sc):
    variants = {}
    for k, x, y in sc._grass:
        variants[k] = {s: tall_grass(600 + k, s, n=4) for s in (-1, 0, 1)}

    def fn(t, i):
        # la ola viaja hacia la derecha (fase solo en x): una racha que cruza el pastizal, no todo a la vez
        out = {}
        for k, x, y in sc._grass:
            out[f'grass{k}'] = variants[k][mk.step3(mk.wave(t, -x / 40.0))]
        return out, None
    return fn


def _fx_nube(sc):
    cl = cloud()
    shadow = layer(*cl.size)
    sp = cl.getchannel('A').point(lambda v: 255 if v else 0)
    shadow.paste(C('#4a3c58', 60), (0, 0), sp)

    def fn(t, i):
        def over(img, x0, y0):
            # 24 px por vuelta (3 px por cuadro a 2 fps: 6 px/s, sin saltos) y entra y sale en rampa con `fade`:
            # 0 → 0.38 → 0.71 → 0.92 → 1 → 0.92 → 0.71 → 0.38; la vuelta al inicio cae en el cuadro invisible
            a = mk.fade(t)
            X = int(round(4 + mk.drift(t, 24, 8)))
            for spr, dx, dy, alpha in ((shadow, 10, 22, a * 0.9), (cl, 0, 0, a)):
                s = spr.copy()
                s.putalpha(s.getchannel('A').point(lambda v, k=alpha: int(v * min(1.0, k))))
                mk.blit(img, s, X + dx - x0, 372 + dy - y0)
        return None, over
    return fn


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    makers = {'map-fx-2-conejo': _fx_conejo, 'map-fx-2-mariposas': _fx_mariposas, 'map-fx-2-hierba': _fx_hierba,
              'map-fx-2-nube': _fx_nube}
    for name, box, n, fps in FX:
        sc.add_fx(name, box, n, fps, makers[name](sc))
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
