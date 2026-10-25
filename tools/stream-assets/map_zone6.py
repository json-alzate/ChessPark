"""
Zona 6 «Pantano/costa» del mapa del Chess Runner (jefe: la tortuga; oscuridad 5): marisma de hierba azul verdosa entre la
costa y una laguna con niebla, charcas de agua estancada, juncos, cipreses y árboles muertos con musgo colgando.
Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110, donde sale el de la zona 5), deja a la derecha los juncos de las luciérnagas y a la
izquierda la charca de las burbujas, se asoma a la playa (el mar ocupa el borde derecho en la mitad de abajo y el centro),
vuelve a la marisma, sube al campamento junto a la laguna de la niebla y llega a la laguna de la tortuga, el jefe, que
dormita en su islote; sale por arriba (x = 110) entre dos cipreses.

Luz: noche de niebla, sin sol. Una luz difusa y fría desde arriba a la izquierda (la luna tras la niebla) aclara la cara
de arriba de copas y rocas y deja sombras cortas, azul marino, hacia abajo a la derecha. El suelo es hierba de marisma azul
verdosa con manchas de turba oscura y calvas de barro; el agua (mar, charcas, lagunas) es más azul y más oscura que la
hierba, y la arena de la playa es gris. Nada de color vivo: la única luz cálida es la brasa del campamento, y lo que brilla
(espuma, luciérnagas) lo pone el ambiente.

Puntos (5 de patrón con el último de jefe, rescate y campamento; mismo orden que la zona 5):
  1 pattern · 2 pattern · 3 rescue · 4 pattern · 5 pattern · 6 camp · 7 boss

Ambiente: `olas` (la protagonista: las crestas del mar avanzan hacia la orilla y la espuma sube y baja por la arena
mojada), `burbujas` (burbujas que suben, se hinchan y revientan en la charca de la izquierda, con su anillo de agua),
`niebla` (bancos de niebla que se desplazan sobre la laguna de arriba y respiran), `luciernagas` (luciérnagas que se
encienden y apagan entre los juncos de abajo) y `tortuga` (el jefe asoma la cabeza del caparazón, parpadea y la esconde;
el agua de su laguna hace ondas).
"""
import functools
import math
import random

from PIL import Image, ImageDraw, ImageFilter

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 6
LEVEL = 5

# Hierba de marisma azul verdosa (tono ~172°): el `grade` del nivel 5 le quita más de la mitad de la saturación y el 40 % de
# la luz; con el tono de partida en el cian, el resultado sigue azul verdoso (ni gris ni oliva).
GROUND = {'base': C('#1a8a6a'), 'light': C('#1e9474'), 'dark': C('#187c62'), 'dash': C('#167258'),
          'dash2': C('#2aa080'), 'tuft': C('#106050')}
PEAT = (C('#156656'), C('#10584c'))                    # turba oscura, encharcada
MUD = (C('#4e6a62'), C('#3e5854'))                     # calvas de barro gris azulado
MOON = C('#3aae92')                                    # la luz difusa de la luna en la hierba
PATH = {'fill': C('#c8b890'), 'dark': C('#a29470'), 'light': C('#d6c8a0'), 'speck': C('#b4a680'),
        'rim': C('#1e4440'), 'pebble': C('#dcd8c4'), 'grass': C('#2a6a62')}
SAND = (C('#bcb294'), C('#aaa284'), C('#ccc4a6'))      # arena gris de la playa: base, sombra, grano claro
WET = (C('#82847a'), C('#727a70'))                     # arena mojada
SEA = {'deep': C('#145a6e'), 'mid': C('#1a6a7a'), 'shallow': C('#22807e'), 'trough': C('#0e4a5e'),
       'crest': C('#6ab4b4'), 'crest2': C('#a8dad4'), 'foam': C('#d8f0ea')}
POOL = {'fill': C('#245a54'), 'deep': C('#1a4642'), 'light': C('#3e7a6c'), 'bank': C('#163a36'),
        'bank2': C('#24504a')}
LAGOON = {'fill': C('#1e5a68'), 'deep': C('#164858'), 'light': C('#3c7c84'), 'bank': C('#163a3c'),
          'bank2': C('#204c4a')}
WEED = (C('#3e7656'), C('#5a8e62'))                    # lentejas de agua y nenúfares
STONE = {'stone': (C('#3c4c54'), C('#566870'), C('#7a8c90')), 'stone_out': C('#18242a')}
CYPRESS = {'bark': (C('#2e3634'), C('#46504c'), C('#66706a')), 'bark_out': C('#141a18'),
           'leaf': (C('#1a463e'), C('#225848'), C('#2e6c56'), C('#468468')), 'leaf_out': C('#0e2622')}
SNAG = {'bark': (C('#3a403e'), C('#565c58'), C('#7a807a')), 'bark_out': C('#181c1a')}
MOSS = (C('#4c6c5e'), C('#6a8a78'))                    # el musgo que cuelga de las ramas
PALM = {'bark': (C('#3e3e36'), C('#5a5a4c'), C('#7a7866')), 'bark_out': C('#1a1a16'),
        'leaf': (C('#1c4a40'), C('#265c4e'), C('#347058'), C('#4c8a6c')), 'leaf_out': C('#0e2620')}
SHRUB = {'leaf': (C('#1c4a44'), C('#245a50'), C('#30705e'), C('#4a8a72')), 'leaf_out': C('#0e2824')}
REEDS = {'stem': (C('#2a5a4c'), C('#3a6e58'), C('#58886a')), 'head': (C('#3e3024'), C('#5a4630')),
         'out': C('#12261e')}
DRIFT = {'bark': (C('#5a5a52'), C('#7a786c'), C('#9a9686')), 'bark_out': C('#26261f'),
         'wood': (C('#6a665a'), C('#a09a86'))}
# (el jefe tiene que despegarse de su laguna con la luz del nivel 5: caparazón y piel más claros que el resto del pantano)
TURTLE = {'shell': C('#96b67a'), 'scute': C('#3a4e32'), 'lit': C('#c4dc9e'), 'rim': C('#e4d898'),
          'rim2': C('#a49c66'), 'skin': C('#a8bc98'), 'skin2': C('#5a6a56'), 'eye': C('#0e120e'), 'eyelit': C('#ffffff'),
          'head': C('#d0e4b0'), 'head2': C('#f0f4d0'),
          'out': C('#121a14')}
CAMP = {'canvas': (C('#5a6460'), C('#76807a'), C('#98a29a')), 'stone': C('#56626a'), 'stone_l': C('#7e8a90'),
        'ash': C('#2e3436'), 'ember': C('#d86a34'), 'ember2': C('#f0a048'), 'wood': C('#4e4a40'),
        'out': C('#161c1c')}
EMBER_GLOW = {CAMP['ember']: mk.emissive(CAMP['ember'], LEVEL, 0.3),        # la brasa, color final
              CAMP['ember2']: mk.emissive(CAMP['ember2'], LEVEL, 0.2)}
FOG = (C('#a8c4c2'), C('#d8ecea'))                     # niebla: velo y núcleo
FIREFLY = (C('#e8f0a0'), C('#8a9a50'), C('#b8c878'))   # luciérnaga, color FINAL (luz propia, tras el `grade`): núcleo,
                                                       # halo, núcleo a media luz

# las dos primeras, en x = 110: el camino sale por abajo por las mismas columnas por las que sale por arriba el de la
# zona 5 (empalme sin escalón; lo comprueba `test_map_assets`)
PATH_CTRL = [(110, 434), (110, 404), (96, 384), (70, 368), (56, 342), (72, 318), (106, 306), (134, 290), (144, 262),
             (126, 240), (92, 230), (64, 212), (56, 184), (74, 162), (108, 152), (138, 140), (156, 114), (160, 86),
             (142, 64), (112, 56), (82, 48), (66, 30), (84, 14), (104, 6), (110, 0), (110, -14)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('pattern', 'pattern', 'rescue', 'pattern', 'pattern', 'camp', 'boss')
FRACS = (0.06, 0.20, 0.335, 0.47, 0.605, 0.74, 0.865)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

SHADOW = (0.4, 0.22)           # luz difusa de arriba a la izquierda: sombras cortas hacia abajo a la derecha

SEA_Y = (138, 362)             # el mar: filas que toca (la orilla se curva hacia fuera en los extremos)
POOL_SHAPES = ((34, 268, 26, 11), (58, 278, 14, 7), (14, 282, 10, 6))     # la charca de las burbujas
TURTLE_POND = ((30, 84, 26, 13), (12, 98, 12, 7), (50, 96, 10, 6))        # la laguna de la tortuga
FOG_POND = ((198, 36, 18, 14), (186, 52, 12, 7))                         # la laguna de la niebla
DUCK_POND = ((22, 392, 18, 8), (36, 402, 10, 5))                          # charca de abajo a la izquierda
ISLET = (32, 88)               # el islote donde dormita la tortuga (pie)
ISLET_RIM = C('#7a9a8a')

FX = [
    ('map-fx-6-olas', (158, 136, 220, 364), 8, 5),
    ('map-fx-6-burbujas', (4, 254, 76, 292), 8, 5),
    ('map-fx-6-niebla', (166, 8, 220, 74), 8, 3),
    ('map-fx-6-luciernagas', (136, 370, 216, 418), 8, 4),
    ('map-fx-6-tortuga', (6, 64, 64, 110), 8, 4),
]

META = {'zones': {str(ZONE): {
    'name': 'Pantano', 'boss': 'tortuga', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- la costa

def shore(y):
    """x de la orilla del mar en la fila `y` (a su derecha, agua); en los extremos se curva hacia fuera del lienzo."""
    mid, half = (SEA_Y[0] + SEA_Y[1]) / 2, (SEA_Y[1] - SEA_Y[0]) / 2 - 26
    e = max(0.0, abs(y - mid) - half) / 26
    return 172 + 5 * math.sin(y / 21.0) + 3 * math.sin(y / 8.5 + 1.3) + 70 * e * e


def sand_color(x, y):
    """La arena seca de la playa (fija: no depende del tiempo)."""
    if mk._h(x, y, 61) < 0.07:
        return SAND[2]
    if mk._h(x // 2, y, 62) < 0.12 or (x + y) % 9 == 0 and mk._h(x, y, 63) < 0.4:
        return SAND[1]
    return SAND[0]


def coast_color(x, y, t):
    """
    Color del mar y de la franja de arena mojada en (x, y) en la fase `t`, o None si es arena seca o marisma.
    Las crestas avanzan hacia la orilla (una separación de crestas por bucle: cierra sin salto) y se rompen en trazos que
    cambian despacio; la espuma sube por la arena y vuelve, dejando la arena mojada más oscura.
    """
    d = x - shore(y)
    swash = 1.5 + 2.5 * (0.5 + 0.5 * math.sin(2 * math.pi * t + y / 27.0))
    if d < -6:
        return None
    if d < 0:
        if -d < swash - 1:
            return SEA['foam'] if -d > swash - 2.2 else (SEA['crest2'] if mk.dither(x, y) < 0.5 else SEA['shallow'])
        if -d < swash + 1.5 or -d < 3:
            return WET[0] if mk.dither(x, y) < 0.7 else WET[1]
        return None
    if d < 2:
        return SEA['foam'] if mk.dither(x, y) < 0.6 + 0.3 * math.sin(2 * math.pi * t + y / 13.0) else SEA['crest2']
    c = SEA['shallow'] if d < 7 or d < 11 and mk.dither(x, y) < (11 - d) / 4 else (
        SEA['mid'] if d < 20 or d < 28 and mk.dither(x, y) < (28 - d) / 8 else SEA['deep'])
    ph = (d / 12.0 + t) % 1.0
    brk = math.sin(y / 3.1 + d * 0.41) + 0.7 * math.sin(y / 1.7 - d * 0.7)
    if 0.20 < ph < 0.30 and brk > 0.1:
        return SEA['crest2'] if (d < 14 and brk > 0.6) else SEA['crest']
    if 0.30 <= ph < 0.38 and brk > 0.3:
        return SEA['trough']
    return c


# ---------------------------------------------------------------- piezas propias

def turtle(head=0, blink=False):
    """
    La tortuga de perfil mirando a la izquierda (40×22): caparazón alto con sus escudos y el borde amarillento, aletas
    gruesas. `head` 0/1/2 = escondida (solo asoma la nariz), a medio sacar, fuera con el cuello estirado (la cabeza
    recorre 8 px). La cabeza lleva la cara de arriba con luz y el ojo claro, para que se lea sobre el caparazón.
    """
    tp = TURTLE
    w, h = 38, 22
    body = layer(w, h)
    d = ImageDraw.Draw(body)
    # aletas del otro lado (más oscuras)
    d.ellipse([29, 13, 35, 17], fill=tp['skin2'])
    d.ellipse([16, 14, 22, 18], fill=tp['skin2'])
    # caparazón: una cúpula alta con la luz arriba a la izquierda y el borde de escudos marginales amarillento
    d.ellipse([9, 1, 35, 23], fill=tp['shell'])
    d.chord([9, 1, 35, 23], 195, 290, fill=tp['lit'])
    d.rectangle([9, 14, 35, 23], fill=(0, 0, 0, 0))
    d.line([(10, 13), (34, 13)], fill=tp['rim'])
    d.line([(11, 14), (33, 14)], fill=tp['rim2'])
    for x in range(13, 34, 3):
        d.point((x, 13), fill=tp['rim2'])
    # escudos: tres hexágonos en la fila de arriba y las juntas que bajan al borde
    for cx, cy in ((16, 8), (22, 6), (28, 8)):
        d.polygon([(cx - 3, cy), (cx - 1, cy - 3), (cx + 1, cy - 3), (cx + 3, cy), (cx + 1, cy + 3), (cx - 1, cy + 3)],
                  outline=tp['scute'])
    for x0, x1 in ((15, 14), (19, 19), (25, 25), (29, 30), (12, 11), (32, 33)):
        d.line([(x0, 11), (x1, 12)], fill=tp['scute'])
    for x, y in ((15, 6), (21, 4), (16, 8), (22, 6)):
        d.point((x, y), fill=C('#b4c896'))
    # aletas de este lado: palas redondeadas que apoyan en el islote
    d.ellipse([9, 14, 17, 19], fill=tp['skin'])
    d.line([(10, 18), (16, 18)], fill=tp['skin2'])
    d.ellipse([30, 14, 37, 18], fill=tp['skin'])
    d.point((36, 17), fill=tp['skin2'])
    sp = layer(w + 2, h)                       # 2 px más a la izquierda: sitio para el cuello estirado
    sp.alpha_composite(body, (2, 0))
    d = ImageDraw.Draw(sp)
    # cabeza
    if head == 0:
        d.ellipse([8, 9, 13, 13], fill=tp['skin'])
        d.line([(9, 9), (11, 9)], fill=tp['head'])
        d.point((9, 10), fill=tp['head2'])
    else:
        hx = 4 if head == 1 else 0
        d.polygon([(12, 9), (12, 14), (hx + 5, 13), (hx + 5, 10)], fill=tp['skin'])
        d.line([(hx + 5, 10), (12, 9)], fill=tp['head'])                 # el cuello, con luz arriba
        d.ellipse([hx, 7, hx + 7, 13], fill=tp['skin'])
        d.chord([hx, 7, hx + 7, 13], 180, 330, fill=tp['head'])
        d.line([(hx + 2, 7), (hx + 4, 7)], fill=tp['head2'])
        d.line([(hx + 1, 12), (hx + 5, 12)], fill=tp['skin2'])           # la boca
        if blink:
            d.line([(hx + 2, 9), (hx + 3, 9)], fill=tp['skin2'])
        else:
            d.point((hx + 2, 9), fill=tp['eyelit'])                     # el ojo claro, con su pupila
            d.point((hx + 3, 9), fill=tp['eye'])
        d.point((hx + 4, 13), fill=tp['skin2'])
    return outlined(sp, tp['out'])


def snag(seed, h):
    """
    Árbol muerto del pantano (pie = centro de la base): tronco gris que se estrecha, raíces abiertas como zancos, dos a
    cuatro ramas torcidas y barbas de musgo que cuelgan de ellas.
    """
    rnd = random.Random(seed)
    w = h + 8
    sp = layer(w, h + 3)
    d = ImageDraw.Draw(sp)
    b = SNAG['bark']
    cx, base = w // 2, h + 1
    lean = rnd.choice((-2, -1, 1, 2))
    top = (cx + lean, base - int(h * 0.75))
    for dx in (-5, -3, 3, 5):                                       # raíces en zanco
        d.line([(cx + dx // 2, base - 4), (cx + dx, base)], fill=b[0] if dx > 0 else b[1])
    d.line([(cx - 1, base), top], fill=b[2])
    d.line([(cx, base), (top[0] + 1, top[1])], fill=b[1])
    d.line([(cx + 1, base - 1), (top[0] + 1, top[1] + 4)], fill=b[0])
    hangs = []
    for k in range(rnd.randint(2, 4)):
        u = rnd.uniform(0.35, 1.0)
        sx = cx + lean * u
        sy = base - h * 0.75 * u
        side = -1 if k % 2 == 0 else 1
        ln = rnd.uniform(0.25, 0.4) * h
        mx, my = sx + side * ln * 0.6, sy - ln * 0.5
        ex, ey = mx + side * ln * 0.5, my - ln * 0.15 + rnd.uniform(-2, 2)
        d.line([(sx, sy), (mx, my), (ex, ey)], fill=b[1])
        d.point((int(ex), int(ey) - 1), fill=b[2])
        hangs += [(mx, my), ((mx + ex) / 2, (my + ey) / 2)]
    trunk = outlined(sp, SNAG['bark_out'])
    px = trunk.load()
    W_, H_ = trunk.size
    for hx, hy in hangs:                                            # barbas de musgo
        x = int(round(hx)) + 1
        for j in range(1, rnd.randint(4, 8)):
            y = int(round(hy)) + 1 + j
            if 0 <= x < W_ and 0 <= y < H_:
                px[x, y] = MOSS[1] if j < 3 else MOSS[0]
            if j > 2 and rnd.random() < 0.35 and 0 <= x + 1 < W_ and y < H_:
                px[x + 1, y] = MOSS[0]
    return trunk


def lily_pads(img, mask, seed, n):
    """Nenúfares y lentejas de agua sobre una charca (en el suelo, fijos)."""
    rnd = random.Random(seed)
    m, px = mask.load(), img.load()
    bb = mask.getbbox()
    for _ in range(n):
        x, y = rnd.randint(bb[0] + 2, bb[2] - 3), rnd.randint(bb[1] + 2, bb[3] - 2)
        if not (m[x - 1, y] and m[x + 2, y] and m[x, y - 1] and m[x, y + 1]):
            continue
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, -1), (1, -1)):
            px[x + dx, y + dy] = WEED[0]
        px[x, y - 1] = WEED[1]
        px[x + 1, y] = POOL['deep']                                 # la muesca de la hoja


def camp():
    """Campamento: una tienda baja de lona gris, la fogata con su anillo de piedras y una canoa volcada."""
    cp = CAMP
    w, h = 32, 16
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.polygon([(1, 13), (8, 2), (15, 13)], fill=cp['canvas'][1])
    d.polygon([(8, 2), (15, 13), (11, 13)], fill=cp['canvas'][0])
    d.line([(1, 13), (8, 2)], fill=cp['canvas'][2])
    d.polygon([(6, 13), (8, 8), (10, 13)], fill=cp['out'])
    d.point((8, 1), fill=cp['wood'])
    d.ellipse([17, 6, 27, 12], fill=cp['stone'])
    d.ellipse([19, 7, 25, 11], fill=cp['ash'])
    d.point((22, 9), fill=cp['ember'])
    d.point((21, 8), fill=cp['ember2'])
    d.line([(20, 8), (24, 10)], fill=cp['wood'])
    for x, y in ((17, 9), (19, 6), (22, 6), (25, 6), (27, 9), (25, 12), (22, 12), (19, 12)):
        d.point((x, y), fill=cp['stone_l'])
    d.chord([16, 12, 31, 16], 180, 360, fill=DRIFT['bark'][1])      # canoa volcada
    d.line([(17, 13), (30, 13)], fill=DRIFT['bark'][2])
    return outlined(sp, cp['out'])


# ---------------------------------------------------------------- la escena

def _patches(sc):
    """Turba oscura encharcada, calvas de barro gris azulado y, arriba a la izquierda, la luz de la luna en la hierba."""
    px = sc.ground.load()
    peat = [(40, 330, 34, 20), (180, 400, 40, 18), (120, 200, 30, 14), (30, 140, 30, 18), (200, 110, 30, 16),
            (90, 270, 26, 12), (60, 20, 30, 12), (150, 330, 16, 22)]
    mud = [(100, 360, 16, 6), (30, 230, 18, 7), (120, 120, 18, 7), (150, 30, 16, 6), (84, 410, 14, 5),
           (30, 170, 14, 6)]
    for y in range(mk.H):
        for x in range(mk.W):
            v = 0.0
            for bx, by, rx, ry in peat:
                e = ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2
                if e < 1:
                    v = max(v, 1 - e)
            if v > 0.12 + 0.5 * mk.dither(x, y):
                px[x, y] = PEAT[0] if v < 0.55 else PEAT[1]
            b = 0.0
            for bx, by, rx, ry in mud:
                wob = 1 + 0.25 * math.sin(x * 0.4 + y * 0.3 + bx)
                e = ((x - bx) / (rx * wob)) ** 2 + ((y - by) / ry) ** 2
                if e < 1:
                    b = max(b, 1 - e)
            if b > 0.15 + 0.45 * mk.dither(x + 1, y):
                px[x, y] = MUD[0] if mk._h(x, y, 51) < 0.7 else MUD[1]
            elif x + y < 200 and mk._h(x // 2, y, 53) < 0.035 * (1 - (x + y) / 200):
                px[x, y] = MOON


def _paint_coast(sc):
    """El mar del borde derecho (pintado con el cuadro 0 de las olas) y su playa de arena gris."""
    px = sc.ground.load()
    sea = Image.new('L', (mk.W, mk.H), 0)
    sm = sea.load()
    for y in range(SEA_Y[0] - 4, SEA_Y[1] + 4):
        s = shore(y)
        for x in range(max(0, int(s) - 16), mk.W):
            d = x - s
            beach = 10 + 3 * math.sin(y / 7.0) + 2 * mk._h(y, 64)
            if d >= -6:
                c = coast_color(x, y, 0.0)
                if d >= 0:
                    sm[x, y] = 255
                px[x, y] = c if c is not None else sand_color(x, y)
            elif d > -beach or d > -beach - 2 and mk.dither(x, y) < 0.5:
                px[x, y] = sand_color(x, y)
    sc._sea = sea
    # lo que el ambiente repinta (mar y franja de espuma): nada de decorado encima
    sc._coast = sea.filter(ImageFilter.MaxFilter(15))


def _paint_waters(sc):
    for shapes, seed, name, pal in ((POOL_SHAPES, 3, 'pool', POOL), (TURTLE_POND, 5, 'pond', LAGOON),
                                    (FOG_POND, 7, 'fogpond', LAGOON), (DUCK_POND, 9, 'duck', POOL)):
        m = mk.blob_mask(shapes, wob=0.18, seed=seed)
        mud = m.filter(ImageFilter.MaxFilter(5))
        mp, wp, px = mud.load(), m.load(), sc.ground.load()
        bb = mud.getbbox()
        for y in range(bb[1], bb[3]):
            for x in range(bb[0], bb[2]):
                if mp[x, y] and not wp[x, y]:
                    px[x, y] = MUD[1] if mk._h(x // 2, y, seed) < 0.3 else PEAT[1]
        mk.paint_water(sc.ground, m, pal)
        if pal is POOL:
            lily_pads(sc.ground, m, seed, 14)
        setattr(sc, '_' + name, m)
        sc.reserved.append(bb)


def _scene():
    rnd = random.Random(606)
    sc = mk.Scene(LEVEL, GROUND, seed=6)
    sc.shadow_color = C('#0c1c26', 120)
    _patches(sc)
    _paint_coast(sc)
    _paint_waters(sc)
    sc.lay_path(CURVE, PATH, POINTS)
    for name, box, _n, _fps in FX:
        if name not in ('map-fx-6-luciernagas', 'map-fx-6-olas'):   # las luciérnagas vuelan entre juncos; el mar, aparte
            sc.reserved.append(box)
    coast = sc._coast

    def on_coast(box):
        x0, y0, x1, y1 = max(0, box[0]), max(0, box[1]), min(mk.W, box[2]), min(mk.H, box[3])
        return x1 > x0 and y1 > y0 and coast.crop((x0, y0, x1, y1)).getbbox() is not None

    def free(box, pad=1):
        return sc.free(box, pad) and not on_coast(box)

    def deco(sp, x, y, **kw):
        box = sc.put(sp, x, y, **kw)
        sc.reserved.append(box)
        return box

    def named(sp, spots, pad=1):
        for x, y in spots:
            if free(sc.opaque_box(sp, x, y), pad):
                deco(sp, x, y, shadow=SHADOW)
                return (x, y)
        return None

    def scatter(sp, x, y, pad=1):
        if free(sc.opaque_box(sp, x, y), pad):
            sc.put(sp, x, y, shadow=SHADOW)
            return True
        return False

    # --- el jefe: la tortuga en su islote
    isl = layer(24, 6)
    ImageDraw.Draw(isl).ellipse([0, 0, 23, 5], fill=MUD[1])
    ImageDraw.Draw(isl).ellipse([2, 0, 21, 3], fill=MUD[0])
    ImageDraw.Draw(isl).line([(3, 0), (20, 0)], fill=ISLET_RIM)         # la orilla del islote, mojada y más clara
    sc.put(isl, ISLET[0], ISLET[1] + 2, z=ISLET[1] - 30)
    sc.put(turtle(1), ISLET[0] - 1, ISLET[1], key='turtle', shadow=SHADOW)
    # --- la salida: dos cipreses a los lados del camino
    deco(mk.tree(31, 9, CYPRESS, trunk_h=6), 76, 12, shadow=SHADOW)
    deco(mk.tree(32, 8, CYPRESS, trunk_h=5), 144, 22, shadow=SHADOW)
    # --- el campamento junto al punto 6
    cam = [p for p in POINTS if p['kind'] == 'camp'][0]
    for dx, dy in ((-34, 4), (-30, 18), (30, 24), (-34, -10), (0, 30)):
        sc._camp_at = named(camp(), [(cam['x'] + dx, cam['y'] + dy)])
        if sc._camp_at:
            break
    else:
        raise ValueError(f'zona {ZONE}: el campamento no cabe junto al punto 6')
    # --- palmeras de la costa, a lo largo de la playa
    for k, (x, y, h) in enumerate(((150, 186, 22), (154, 330, 20), (186, 128, 24), (166, 364, 18), (150, 226, 16))):
        sp = mk.palm(40 + k, h, PALM, n=6, droop=1.5, fore=0.7, frond=11)
        for X, Y in ((x, y), (x - 4, y), (x + 4, y), (x, y + 6), (x, y - 6)):
            if free(sc.opaque_box(sp, X, Y)):
                deco(sp, X, Y)          # sin sombra: la de la copa, aplastada, cruzaría la playa como un muelle
                break
    # --- árboles muertos y cipreses por la marisma
    for k, (x, y, h) in enumerate(((20, 236, 30), (96, 196, 26), (16, 58, 28), (190, 416, 26), (12, 330, 28),
                                   (110, 274, 22), (84, 120, 24), (40, 414, 22))):
        named(snag(70 + k, h), ((x, y), (x + 6, y), (x - 6, y), (x, y + 8), (x, y - 8)))
    for k, (x, y, r) in enumerate(((18, 170, 10), (120, 104, 9), (190, 96, 8), (96, 340, 9), (62, 150, 8),
                                   (14, 128, 9), (130, 410, 8), (100, 80, 8), (40, 46, 8), (140, 214, 8))):
        named(mk.tree(80 + k, r, CYPRESS), ((x, y), (x + 6, y), (x - 6, y), (x, y + 6), (x, y - 6)))
    # --- troncos a la deriva en la playa y caídos en la marisma
    for k, (x, y, ln) in enumerate(((154, 270, 16), (150, 160, 14), (34, 312, 18), (120, 382, 14))):
        named(mk.log(90 + k, ln, DRIFT, thick=4), ((x, y), (x - 4, y), (x + 4, y), (x, y + 4)))
    # --- rocas grises en grupos (y en la orilla)
    for gx, gy in ((150, 300), (24, 206), (84, 284), (120, 26), (40, 360), (178, 84), (150, 248)):
        for k in range(3):
            x, y = gx + rnd.randint(-7, 7), gy + rnd.randint(-5, 5)
            scatter(mk.rock(600 + gx + k, rnd.choice((5, 6, 8, 10)), STONE), x, y)
    # --- juncos alrededor de las charcas y lagunas
    rims = []
    for m in (sc._pool, sc._pond, sc._fogpond, sc._duck):
        ring = m.filter(ImageFilter.MaxFilter(9))
        rp, mp = ring.load(), m.load()
        bb = ring.getbbox()
        for y in range(bb[1], bb[3], 2):
            for x in range(bb[0], bb[2], 3):
                if rp[x, y] and not mp[x, y]:
                    rims.append((x, y))
    rnd.shuffle(rims)
    for k, (x, y) in enumerate(rims[:160]):
        scatter(mk.reeds(300 + k, rnd.choice((4, 5, 6)), rnd.choice((7, 9, 11)), REEDS,
                         heads=rnd.choice((0, 1, 2))), x, y + 3)
    # --- matas bajas y juncos sueltos por toda la marisma
    for k in range(260):
        x, y = rnd.randint(2, 218), rnd.randint(14, 420)
        scatter(mk.bush(900 + k, rnd.choice((2, 2, 3, 3, 4)), SHRUB), x, y)
    for k in range(380):
        x, y = rnd.randint(3, 217), rnd.randint(8, 420)
        scatter(mk.reeds(1000 + k, rnd.choice((3, 4, 5)), rnd.choice((6, 7, 8, 9)), REEDS,
                         heads=rnd.choice((0, 0, 1))), x, y)
    sc._items_mask = None
    return sc


def _cover(sc):
    """Máscara de lo que tapa el decorado (para que el ambiente no pinte el agua encima de una palmera o una roca)."""
    if sc._items_mask is None:
        m = Image.new('L', (mk.W, mk.H), 0)
        for it in sc.items:
            a = it['sp'].getchannel('A').point(lambda v: 255 if v else 0)
            m.paste(255, (it['x'], it['y']), a)
        sc._items_mask = m
    return sc._items_mask


def _shade(sc):
    """(máscara de sombras proyectadas, color y opacidad de la sombra), como las pinta `Scene._final_ground`."""
    m = sc.shadow.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    return m.load(), sc.shadow_color


# ---------------------------------------------------------------- ambientes

def _fx_olas(sc):
    """Las olas: el mar y la franja de espuma se repintan con la fase `t` (las crestas avanzan, la espuma sube y baja)."""
    box = FX[0][1]
    cover = _cover(sc).load()
    sh, scol = _shade(sc)

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for y in range(h):
                Y = y + y0
                if not (SEA_Y[0] - 4 <= Y < SEA_Y[1] + 4):
                    continue
                for x in range(w):
                    X = x + x0
                    if cover[X, Y]:
                        continue
                    c = coast_color(X, Y, t)
                    if c is None:
                        c = sand_color(X, Y) if X - shore(Y) >= -6 else None
                    if c is None:
                        continue
                    if sh[X, Y]:
                        c = mk.mix(c, scol, scol[3] / 255)
                    px[x, y] = c
        return None, over
    return fn


def _fx_burbujas(sc):
    """Burbujas que suben a la charca: un punto, una bola con brillo, revienta en un anillo que se abre y se borra."""
    wm = sc._pool.load()
    rnd = random.Random(21)
    bb = sc._pool.getbbox()
    spots = []
    while len(spots) < 6:
        X, Y = rnd.randint(bb[0] + 4, bb[2] - 5), rnd.randint(bb[1] + 3, bb[3] - 3)
        if all(wm[X + dx, Y + dy] for dx in (-4, 4) for dy in (-2, 2)) and \
                all(abs(X - a) + abs(Y - b) > 8 for a, b, _ in spots):
            spots.append((X, Y, len(spots) / 6 + rnd.uniform(-0.04, 0.04)))
    light, ring = C('#9ac4b4'), C('#5e9a88')

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()

            def put(X, Y, c):
                if wm[X, Y]:
                    px[X - x0, Y - y0] = c
            for X, Y, ph in spots:
                u = (t + ph) % 1.0
                if u < 0.25:                                           # asoma: un punto
                    put(X, Y, ring)
                elif u < 0.5:                                          # se hincha: bola con brillo
                    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                        put(X + dx, Y + dy, POOL['light'])
                    put(X, Y, light)
                    put(X - 1, Y + 1, POOL['deep'])
                else:                                                  # revienta: un anillo que se abre
                    r = 1.5 + 6 * (u - 0.5) / 0.5
                    for a in range(0, 360, 12):
                        rx = int(round(X + r * math.cos(math.radians(a))))
                        ry = int(round(Y + r * 0.5 * math.sin(math.radians(a))))
                        if mk.dither(rx, ry) < 1.15 - (u - 0.5) * 2:
                            put(rx, ry, light if math.sin(math.radians(a)) > 0 else ring)
        return None, over
    return fn


def _fx_niebla(sc):
    """
    Bancos de niebla que se desplazan sobre la laguna de arriba: un velo tramado cuya densidad corre a la izquierda 24 px
    por bucle (su dibujo se repite cada 24 px: cierra sin salto) y respira, dentro de un óvalo que se apaga hacia los
    bordes de la caja (reservada: debajo no hay decorado, así que no deja «fantasmas»).
    """
    box = FX[2][1]
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    rx, ry = (box[2] - box[0]) / 2 + 2, (box[3] - box[1]) / 2 + 1
    cover = _cover(sc).load()
    P = 24

    def fn(t, i):
        dx = mk.drift(t, P, 8)

        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for y in range(h):
                Y = y + y0
                for x in range(w):
                    X = x + x0
                    env = 1 - ((X - cx) / rx) ** 2 - ((Y - cy) / ry) ** 2
                    if env <= 0 or cover[X, Y]:
                        continue
                    u = (X + dx) / P
                    band = 0.5 + 0.5 * math.sin(Y / 2.4 + 1.2 * math.sin(2 * math.pi * u))
                    v = (0.35 + 0.65 * band) * (0.6 + 0.25 * math.sin(2 * math.pi * u + Y / 13.0) +
                                                0.15 * math.sin(2 * math.pi * 2 * u - Y / 6.0))
                    v *= (0.85 + 0.15 * mk.wave(t, Y / 40.0)) * min(1.0, env * 1.8)
                    th = mk.dither(X, Y)
                    if v > 0.5 + 0.3 * th:
                        px[x, y] = mk.mix(px[x, y], FOG[1], 0.8)
                    elif v > 0.22 + 0.35 * th:
                        px[x, y] = mk.mix(px[x, y], FOG[0], 0.55)
        return None, over
    return fn


def _fx_luciernagas(sc):
    """Luciérnagas entre los juncos de abajo: cada una deriva en un óvalo pequeño y se enciende y apaga a su ritmo."""
    box = FX[3][1]
    rnd = random.Random(31)
    path = sc.path.filter(ImageFilter.MaxFilter(5)).load()
    flies = []
    while len(flies) < 9:
        X, Y = rnd.uniform(box[0] + 6, box[2] - 22), rnd.uniform(box[1] + 5, box[3] - 12)  # lejos de la esquina oscura
        if not path[int(X), int(Y)] and all(abs(X - a) + abs(Y - b) > 9 for a, b, *_ in flies):
            flies.append((X, Y, rnd.random(), rnd.choice((-1, 1)), rnd.uniform(2, 4)))

    def glow(t, i):
        out = []
        for X, Y, ph, sgn, r in flies:
            a = 2 * math.pi * (t * sgn + ph)
            x = int(round(X + r * math.cos(a)))
            y = int(round(Y + 0.6 * r * math.sin(a)))
            lum = mk.fade((t + ph) % 1.0)
            if lum < 0.2 or not (box[0] + 1 <= x < box[2] - 1 and box[1] + 1 <= y < box[3] - 1) or path[x, y]:
                continue
            if lum > 0.45:                        # encendida: núcleo y halo en cruz
                halo = FIREFLY[1] if lum > 0.75 else FIREFLY[1][:3] + (150,)
                out += [(x + ddx, y + ddy, halo) for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            out.append((x, y, FIREFLY[0] if lum > 0.75 else (FIREFLY[2] if lum > 0.45 else FIREFLY[1])))
        return out
    return glow


def _fx_tortuga(sc):
    """La tortuga asoma la cabeza, parpadea y la esconde; el agua de su laguna se riza en anillos alrededor del islote."""
    heads = (1, 2, 2, 2, 2, 1, 0, 0)
    blinks = (0, 0, 0, 1, 0, 0, 0, 0)
    sprites = {(a, b): turtle(a, bool(b)) for a in range(3) for b in range(2)}
    wm = sc._pond.load()
    cover = _cover(sc).load()

    def fn(t, i):
        def over(img, x0, y0):
            px = img.load()
            for k in range(2):
                u = (t + k / 2) % 1.0
                r = 15 + 8 * u
                for a in range(0, 360, 5):
                    X = int(round(ISLET[0] + r * math.cos(math.radians(a))))
                    Y = int(round(ISLET[1] + 1 + r * 0.42 * math.sin(math.radians(a))))
                    if wm[X, Y] and not cover[X, Y] and mk.dither(X, Y) < 1.0 - u:
                        px[X - x0, Y - y0] = SEA['crest2'] if math.sin(math.radians(a)) > 0 else SEA['crest']
        return {'turtle': sprites[(heads[i], blinks[i])]}, over
    return fn


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    # la brasa de la fogata tiene luz propia: se pinta sobre la escena ya oscurecida (si no, sale gris)
    mk.glow_base(sc, mk.glow_spots(camp(), *sc._camp_at, EMBER_GLOW))
    makers = {'map-fx-6-olas': _fx_olas, 'map-fx-6-burbujas': _fx_burbujas, 'map-fx-6-niebla': _fx_niebla,
              'map-fx-6-luciernagas': _fx_luciernagas, 'map-fx-6-tortuga': _fx_tortuga}
    glows = {'map-fx-6-luciernagas'}          # ambientes de luz propia: `makers` da su `glow(t, i)`
    for name, box, n, fps in FX:
        if name in glows:
            mk.add_glow_fx(sc, name, box, n, fps, None, makers[name](sc))
        else:
            sc.add_fx(name, box, n, fps, makers[name](sc))
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
