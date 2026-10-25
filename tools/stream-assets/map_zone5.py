"""
Zona 5 «Sabana» del mapa del Chess Runner (jefe: el elefante; oscuridad 4): sabana seca con baobabs y acacias, huesos y
charcas; naranja apagado y gris, atardecer sucio. Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110, donde sale el de la zona 4), deja a la derecha la charca de abajo, pasa junto a los
huesos de un elefante (con los buitres que giran encima), bordea la salina del espejismo, sube al campamento y llega a la
charca del jefe, donde espera el elefante bajo el baobab gigante; sale por arriba (x = 110) entre dos baobabs.

Luz: atardecer sucio. El sol, bajo y a la izquierda, tiñe de naranja la cara izquierda de troncos, rocas y matas y estira
sombras largas y grises hacia la derecha; el suelo es hierba seca naranja apagada con calvas de tierra gris y manchas de
polvo. El gris lo ponen los baobabs, las rocas, el elefante y los huesos; el color vivo, solo el reflejo del sol en el agua.

Puntos (5 de patrón con el último de jefe, rescate y campamento; mismo criterio que las zonas 1–4: el rescate hacia la
mitad y el campamento justo antes del jefe):
  1 pattern · 2 pattern · 3 rescue · 4 pattern · 5 pattern · 6 camp · 7 boss

Ambiente: `espejismo` (el aire que tiembla sobre la salina y un falso lago que reluce y se deshace), `elefante` (el jefe
abanica una oreja y balancea la trompa), `buitres` (tres buitres que giran sobre los huesos), `charca` (el sol del
atardecer reluce en la charca de abajo y un anillo de agua se abre) y `hierba` (la hierba alta que ondea con el viento).
"""
import functools
import math
import random

from PIL import ImageDraw, ImageFilter

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 5
LEVEL = 4

# Hierba seca naranja apagada (tono ~30°): el `grade` del nivel 4 le quita casi la mitad de la saturación y la luz; con
# menos saturación de partida, sale marrón gris sin carácter.
GROUND = {'base': C('#aa5a00'), 'light': C('#b46404'), 'dark': C('#9c5200'), 'dash': C('#925000'),
          'dash2': C('#c47818'), 'tuft': C('#6e5a26')}
BARE = (C('#9a7458'), C('#a07e60'))                  # calvas de tierra polvorienta (gris cálido: el gris lo ponen rocas y huesos)
DUSK = C('#6e5040')                                  # sombra de nube sucia, gris
SUNLIT = C('#c88a34')                                # luz rasante del atardecer sobre la hierba
PATH = {'fill': C('#d0a470'), 'dark': C('#a88054'), 'light': C('#deb27e'), 'speck': C('#b88e5e'),
        'rim': C('#6a4a2e'), 'pebble': C('#ead6b4'), 'grass': C('#8a6a2e')}
STONE = {'stone': (C('#625a5e'), C('#878084'), C('#b8a69a')), 'stone_out': C('#322c30')}
BAOBAB = {'bark': (C('#625856'), C('#887a74'), C('#c09672')), 'bark_out': C('#342c2a'),
          'leaf': (C('#4c5630'), C('#646c3c'), C('#82844c'), C('#a49e62')), 'leaf_out': C('#2c3220')}
ACACIA = {'bark': (C('#3a2e28'), C('#544234'), C('#7a5e46')), 'bark_out': C('#221a14'),
          'leaf': (C('#4a5030'), C('#626838'), C('#7e8046'), C('#a09a5a')), 'leaf_out': C('#2a2e1c')}
DRYBUSH = {'leaf': (C('#6a5228'), C('#86682e'), C('#a6823a'), C('#c49e4a')), 'leaf_out': C('#3a2c18')}
GRASS = (C('#7a5424'), C('#a8782e'), C('#d4a04a'))  # hierba alta: pie, tallo, punta con sol
BONE = {'bone': C('#e6dac2'), 'shade': C('#b4a48a'), 'dark': C('#4e4036'), 'out': C('#4a3e32')}
WATER = {'fill': C('#647c84'), 'deep': C('#475a64'), 'light': C('#90a8aa'), 'bank': C('#4e3c2c'),
         'bank2': C('#6a5440')}
MUD = (C('#7e6248'), C('#5c4634'))                   # barro seco agrietado alrededor de las charcas
SALT = (C('#b09a7e'), C('#9c8870'), C('#7a6a58'))    # lecho seco de la salina: costra, costra en sombra, grieta
SKY = (C('#a0c0f0'), C('#c8dcff'))                   # el cielo que refleja el espejismo (azul: parece agua)
GLINT = (C('#a86c34'), C('#c8853a'), C('#e8c080'))   # el sol en el agua, color FINAL (luz propia, tras el `grade`):
                                                     # apagándose, encendido, núcleo (solo en el ambiente)
RIPPLE = (C('#7a8c90'), C('#a0b0ae'))                # el anillo de agua, color final: lado de atrás, lado de delante
ELE = {'skin': C('#8a8282'), 'dark': C('#5e5658'), 'deep': C('#48424a'), 'lit': C('#b4a092'), 'ear': C('#9a7c7a'),
       'tusk': C('#f0e6d2'), 'out': C('#2a2628'), 'eye': C('#1a1618')}
VULTURE = (C('#2a201e'), C('#8a7060'), C('#e0d0b8'))  # alas, banda clara bajo el ala, gorguera y cabeza calva
MOUND = {'clay': (C('#7a4e34'), C('#9c6644'), C('#c08a5e')), 'out': C('#3e2618')}
CAMP = {'canvas': (C('#8a7e6a'), C('#a89c84'), C('#c8bca0')), 'stone': C('#7a7276'), 'stone_l': C('#a49a98'),
        'ash': C('#463c38'), 'ember': C('#d86a34'), 'ember2': C('#f0a048'), 'wood': C('#6a4c34'),
        'out': C('#2e2622')}
EMBER_GLOW = {CAMP['ember']: mk.emissive(CAMP['ember'], LEVEL, 0.3),        # la brasa, color final
              CAMP['ember2']: mk.emissive(CAMP['ember2'], LEVEL, 0.2)}

# las dos primeras, en x = 110: el camino sale por abajo por las mismas columnas por las que sale por arriba el de la
# zona 4 (empalme sin escalón; lo comprueba `test_map_assets`)
PATH_CTRL = [(110, 434), (110, 404), (88, 386), (58, 370), (46, 342), (66, 318), (108, 308), (152, 298), (176, 272),
             (166, 242), (128, 230), (88, 222), (62, 200), (62, 170), (88, 152), (132, 146), (168, 130), (178, 104),
             (160, 82), (120, 76), (84, 68), (68, 48), (82, 28), (104, 14), (110, 4), (110, -14)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('pattern', 'pattern', 'rescue', 'pattern', 'pattern', 'camp', 'boss')
FRACS = (0.06, 0.20, 0.335, 0.47, 0.605, 0.74, 0.865)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

SHADOW = (1.05, 0.26)          # atardecer: sol bajo a la izquierda, sombras largas hacia la derecha

POND = ((170, 362, 27, 11), (190, 372, 16, 8))        # la charca de abajo: elipses (centro, radios)
BOSS_POND = ((190, 44, 20, 9), (200, 34, 12, 6))       # la charca del jefe
PAN = ((172, 190, 34, 14), (150, 198, 16, 8), (196, 182, 16, 8))   # la salina del espejismo
LAKE = (172, 191)              # centro del falso lago
ELEPHANT_AT = (142, 62)        # pie del elefante (centro de la base)
CARCASS = (30, 276)            # los huesos (pie del costillar)
CAMP_SPOTS = ((150, 114), (148, 112), (146, 110), (144, 108))   # pie del campamento, junto al punto 6

FX = [
    ('map-fx-5-espejismo', (128, 168, 216, 212), 8, 6),
    ('map-fx-5-elefante', (122, 30, 168, 66), 8, 4),
    ('map-fx-5-buitres', (4, 236, 60, 270), 8, 5),
    ('map-fx-5-charca', (142, 348, 214, 384), 8, 5),
    ('map-fx-5-hierba', (4, 392, 84, 420), 8, 4),
]

META = {'zones': {str(ZONE): {
    'name': 'Sabana', 'boss': 'elefante', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- piezas propias

def elephant(ear=0, trunk=0):
    """
    El elefante de perfil mirando a la izquierda (38×30): `ear` 0/1/2 = oreja pegada, a medio abrir, abierta (se ve el
    interior rosado y el borde se acerca a la cabeza); `trunk` 0/1/2 = trompa colgando, la punta adelante, recogida
    hacia el pecho. La luz del atardecer le da en la cara izquierda.
    """
    e = ELE
    w, h = 38, 30
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    # patas de atrás (las del otro lado, más oscuras)
    for x in (15, 29):
        d.rectangle([x, 18, x + 3, 27], fill=e['deep'])
    # cuerpo
    d.ellipse([11, 5, 35, 23], fill=e['skin'])
    d.chord([11, 5, 35, 23], 200, 340, fill=e['lit'])               # el lomo con luz
    d.chord([11, 5, 35, 23], 20, 160, fill=e['dark'])               # la panza en sombra
    d.ellipse([12, 7, 34, 21], outline=None)
    for x, y in ((22, 12), (27, 15), (19, 16), (30, 11)):            # arrugas
        d.point((x, y), fill=e['dark'])
    # patas de delante (las de este lado)
    for x in (12, 26):
        d.rectangle([x, 19, x + 4, 28], fill=e['skin'])
        d.line([(x, 19), (x, 28)], fill=e['lit'])
        d.line([(x + 4, 20), (x + 4, 28)], fill=e['dark'])
        d.line([(x, 28), (x + 4, 28)], fill=e['tusk'])                # uñas
        d.point((x + 2, 28), fill=e['dark'])
    # cola
    d.line([(35, 10), (36, 17)], fill=e['dark'])
    d.point((36, 18), fill=e['out'])
    d.point((37, 18), fill=e['out'])
    # cabeza
    d.ellipse([3, 2, 16, 15], fill=e['skin'])
    d.chord([3, 2, 16, 15], 180, 300, fill=e['lit'])
    d.point((7, 7), fill=e['eye'])
    d.point((6, 6), fill=e['dark'])
    # trompa
    trunks = {0: [(5, 12), (4, 16), (4, 20), (4, 24), (5, 26)],
              1: [(5, 12), (3, 16), (2, 20), (1, 23), (0, 24)],
              2: [(5, 12), (5, 16), (7, 19), (9, 20), (10, 18)]}
    pts = trunks[trunk]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        d.line([(ax, ay), (bx, by)], fill=e['skin'], width=3)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        d.line([(ax - 1, ay), (bx - 1, by)], fill=e['lit'])
    tip = pts[-1]
    d.point(tip, fill=e['dark'])
    for k, (x, y) in enumerate(pts[1:-1]):
        d.point((x + 1, y), fill=e['dark'])
    # colmillo
    d.line([(6, 13), (4, 16), (2, 17)], fill=e['tusk'])
    d.point((3, 17), fill=e['tusk'])
    # oreja: un abanico detrás de la cabeza, con su borde de atrás en sombra (así se separa del cuerpo); al abrirse se
    # estrecha (se despega hacia la cámara) y enseña el interior rosado
    if ear == 0:
        poly = [(10, 2), (16, 0), (22, 3), (23, 11), (20, 17), (14, 18), (11, 13)]
        d.polygon(poly, fill=e['skin'])
        d.line([(16, 0), (22, 3), (23, 11), (20, 17), (14, 18)], fill=e['deep'])
        d.line([(15, 1), (20, 4)], fill=e['lit'])
        d.line([(12, 4), (12, 11)], fill=e['lit'])
        for x, y in ((17, 8), (19, 12), (16, 14)):
            d.point((x, y), fill=e['dark'])
    elif ear == 1:
        poly = [(10, 2), (15, 0), (19, 3), (20, 11), (17, 17), (12, 17), (11, 13)]
        d.polygon(poly, fill=e['skin'])
        d.polygon([(13, 4), (16, 3), (18, 10), (15, 15), (13, 13)], fill=e['ear'])
        d.line([(15, 0), (19, 3), (20, 11), (17, 17), (12, 17)], fill=e['deep'])
        d.line([(14, 1), (17, 3)], fill=e['lit'])
    else:
        poly = [(10, 2), (13, 0), (16, 2), (17, 11), (15, 17), (12, 17), (11, 13)]
        d.polygon(poly, fill=e['ear'])
        d.line([(13, 0), (16, 2), (17, 11), (15, 17), (12, 17)], fill=e['skin'])
        d.line([(14, 0), (17, 2), (18, 11), (16, 17)], fill=e['deep'])
        d.line([(12, 5), (13, 12)], fill=C('#b49496'))
    return outlined(sp, e['out'])


def vulture(flap=0):
    """
    Buitre visto desde abajo con las alas abiertas (15×6): alas oscuras de 2 px en la raíz con la banda clara de debajo,
    las plumas de la punta abiertas, gorguera y cabeza calva claras, cola corta. `flap` 0 = planea, 1 = las puntas arriba.
    """
    a, b, c = VULTURE
    sp = layer(15, 6)
    d = ImageDraw.Draw(sp)
    if flap:
        d.line([(1, 0), (3, 1), (6, 2)], fill=a)
        d.line([(8, 2), (11, 1), (13, 0)], fill=a)
        d.line([(3, 2), (5, 3)], fill=b)
        d.line([(9, 3), (11, 2)], fill=b)
        d.point((0, 0), fill=a)
        d.point((14, 0), fill=a)
        d.point((2, 0), fill=a)
        d.point((12, 0), fill=a)
    else:
        d.line([(1, 2), (13, 2)], fill=a)                             # el borde de delante de las alas
        d.line([(3, 3), (5, 3)], fill=b)                              # la banda clara de debajo
        d.line([(9, 3), (11, 3)], fill=b)
        for x in (0, 2, 12, 14):                                      # las plumas de la punta, abiertas
            d.point((x, 3), fill=a)
        d.point((1, 3), fill=a)
        d.point((13, 3), fill=a)
    d.rectangle([6, 2, 8, 3], fill=a)                                 # el cuerpo (2 px de ala en la raíz)
    d.rectangle([6, 4, 8, 4], fill=a)
    d.point((6, 5), fill=a)                                           # la cola
    d.point((8, 5), fill=a)
    d.point((7, 0), fill=c)                                           # la cabeza calva y la gorguera
    d.line([(6, 1), (8, 1)], fill=c)
    return sp


def ribcage():
    """El costillar de un elefante (26×13): el espinazo y siete costillas en arco, la del medio partida."""
    bo = BONE
    w, h = 26, 13
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.line([(1, 10), (24, 9)], fill=bo['shade'])                      # espinazo
    for x in range(2, 24, 2):
        d.point((x, 10), fill=bo['bone'])
    for k, x in enumerate(range(3, 24, 3)):
        top = 1 + abs(k - 3) // 2
        if k == 3:
            d.line([(x, 9), (x - 1, 6)], fill=bo['bone'])
            d.point((x + 1, 4), fill=bo['shade'])
            continue
        d.line([(x, 9), (x - 1, top + 3), (x + 1, top)], fill=bo['bone'])
        d.line([(x + 1, 9), (x, top + 3)], fill=bo['shade'])
    d.line([(4, 12), (8, 12)], fill=bo['shade'])
    return outlined(sp, bo['out'])


def skull():
    """
    El cráneo del elefante de perfil (14×9, mirando a la derecha) con su colmillo partido y un hueso largo al lado: la
    frente abombada a la izquierda, la base de la trompa que baja a la derecha, una sola cuenca (de lado, no de frente).
    """
    bo = BONE
    w, h = 24, 12
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 0, 9, 8], fill=bo['bone'])                          # la bóveda, abombada
    d.polygon([(5, 2), (11, 3), (13, 6), (12, 9), (6, 9), (2, 7)], fill=bo['bone'])   # la cara y la base de la trompa
    d.line([(1, 7), (5, 9), (11, 9)], fill=bo['shade'])               # la cara de abajo, en sombra
    d.line([(12, 6), (12, 8)], fill=bo['shade'])
    d.line([(1, 2), (3, 0)], fill=C('#f4ecd8'))                       # la frente, con la luz del atardecer
    d.rectangle([7, 3, 8, 4], fill=bo['dark'])                         # la cuenca
    d.point((7, 5), fill=bo['dark'])
    d.point((12, 4), fill=bo['dark'])                                 # el hueco de la trompa
    d.line([(10, 9), (12, 10), (14, 11), (15, 11)], fill=bo['bone'])  # el colmillo partido, en curva
    d.point((15, 10), fill=bo['shade'])
    d.line([(17, 9), (22, 7)], fill=bo['bone'])                       # un fémur
    for x, y in ((16, 9), (17, 10), (22, 6), (23, 7)):
        d.point((x, y), fill=bo['bone'])
    d.point((19, 9), fill=bo['shade'])
    return outlined(sp, bo['out'])


def bone_bit(seed):
    """Un hueso suelto (7×3)."""
    bo = BONE
    sp = layer(7, 3)
    d = ImageDraw.Draw(sp)
    d.line([(1, 1), (5, 1)], fill=bo['bone'])
    for x, y in ((0, 0), (0, 2), (6, 0), (6, 2)):
        d.point((x, y), fill=bo['bone'])
    d.point((3, 2), fill=bo['shade'])
    if seed % 2:
        sp = sp.rotate(35, expand=True)
    return outlined(sp, bo['out'])


def termite_mound(seed, h):
    """Termitero: un cono de barro de varias torres, con la luz a la izquierda."""
    rnd = random.Random(seed)
    w = max(7, h // 2 + 2)
    sp = layer(w + 4, h)
    px = sp.load()
    cl = MOUND['clay']
    spires = [(w / 2 + 1, h, w / 2)]
    for _ in range(2):
        spires.append((w / 2 + 1 + rnd.uniform(-w / 3, w / 3), h * rnd.uniform(0.45, 0.7), w / 3.2))
    for x in range(w + 4):
        for y in range(h):
            for cx, hh, hw in spires:
                u = (h - 1 - y) / hh
                if u > 1:
                    continue
                half = hw * (1 - u) ** 0.8 + 0.6
                if abs(x + 0.5 - cx) <= half:
                    rel = (x + 0.5 - (cx - half)) / (2 * half)
                    c = cl[2] if rel < 0.35 else (cl[0] if rel > 0.75 else cl[1])
                    if mk._h(x, y // 2, seed) < 0.12:
                        c = cl[0]
                    px[x, y] = c
    return outlined(sp, MOUND['out'])


def grass_clump(seed, sway=0, h=9):
    """Mata de hierba alta de la sabana (pie = centro de la base): hojas finas en abanico con la punta al sol."""
    rnd = random.Random(seed)
    w = 9
    sp = layer(w + 2, h + 2)
    px = sp.load()
    base = h
    for k in range(7):
        u = (k - 3) / 3.0
        hh = h * rnd.uniform(0.65, 1.0) * (1 - 0.25 * abs(u))
        for j in range(int(hh)):
            v = j / hh
            x = 5 + u * 1.2 + u * 3.2 * v * v + sway * v * v * 1.6
            y = base - j
            xi = int(round(x))
            if 0 <= xi < w + 2 and 0 <= y < h + 2:
                px[xi, y] = GRASS[2] if v > 0.72 else (GRASS[1] if v > 0.25 else GRASS[0])
    return sp


def camp():
    """Campamento: una tienda de lona baja, la fogata con su anillo de piedras y un tronco para sentarse."""
    cp = CAMP
    w, h = 30, 16
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    # tienda (A, vista de frente con su faldón derecho en sombra)
    d.polygon([(1, 13), (8, 2), (15, 13)], fill=cp['canvas'][1])
    d.polygon([(8, 2), (15, 13), (11, 13)], fill=cp['canvas'][0])
    d.line([(1, 13), (8, 2)], fill=cp['canvas'][2])
    d.polygon([(6, 13), (8, 8), (10, 13)], fill=cp['out'])            # la entrada
    d.point((8, 1), fill=cp['wood'])
    # fogata
    d.ellipse([17, 7, 27, 13], fill=cp['stone'])
    d.ellipse([19, 8, 25, 12], fill=cp['ash'])
    d.point((22, 10), fill=cp['ember'])
    d.point((21, 9), fill=cp['ember2'])
    d.line([(20, 9), (24, 11)], fill=cp['wood'])
    for x, y in ((17, 10), (19, 7), (22, 7), (25, 7), (27, 10), (25, 13), (22, 13), (19, 13)):
        d.point((x, y), fill=cp['stone_l'])
    d.rectangle([18, 14, 27, 15], fill=cp['wood'])                    # tronco
    d.line([(18, 14), (27, 14)], fill=C('#8a6a4a'))
    return outlined(sp, cp['out'])


# ---------------------------------------------------------------- la escena

def _patches(sc):
    """
    El suelo de la sabana a la hora del atardecer: calvas de tierra gris (polvo), manchas de sombra de nube sucia y, del
    lado del sol (la izquierda), destellos de hierba con luz rasante.
    """
    px = sc.ground.load()
    bare = [(150, 250, 30, 12), (40, 220, 22, 10), (120, 120, 26, 10), (70, 400, 22, 8), (190, 330, 20, 9),
            (30, 120, 18, 9), (110, 270, 20, 7), (150, 410, 18, 7)]
    dusk = [(176, 140, 46, 26), (36, 330, 40, 22), (130, 40, 40, 18), (200, 400, 40, 20), (60, 180, 30, 14)]
    for y in range(mk.H):
        for x in range(mk.W):
            v = 0.0
            for bx, by, rx, ry in dusk:
                e = ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2
                if e < 1:
                    v = max(v, 1 - e)
            if v > 0.12 + 0.5 * mk.dither(x, y):
                px[x, y] = DUSK
            b = 0.0
            for bx, by, rx, ry in bare:
                wob = 1 + 0.25 * math.sin(x * 0.4 + y * 0.3 + bx)
                e = ((x - bx) / (rx * wob)) ** 2 + ((y - by) / ry) ** 2
                if e < 1:
                    b = max(b, 1 - e)
            if b > 0.15 + 0.45 * mk.dither(x + 1, y):
                px[x, y] = BARE[0] if mk._h(x, y, 51) < 0.7 else BARE[1]
            elif x < 90 and mk._h(x // 2, y, 53) < 0.03 * (1 - x / 90):
                px[x, y] = SUNLIT


def _paint_ponds(sc):
    for shapes, seed, name in ((POND, 3, 'pond'), (BOSS_POND, 5, 'boss_pond')):
        m = mk.blob_mask(shapes, wob=0.18, seed=seed)
        mud = m.filter(ImageFilter.MaxFilter(7))
        mp, wp, px = mud.load(), m.load(), sc.ground.load()
        bb = mud.getbbox()
        for y in range(bb[1], bb[3]):
            for x in range(bb[0], bb[2]):
                if mp[x, y] and not wp[x, y]:
                    px[x, y] = MUD[1] if mk._h(x // 2, y, seed) < 0.18 or (x + 2 * y) % 7 == 0 and \
                        mk._h(x, y, seed + 1) < 0.5 else MUD[0]
        mk.paint_water(sc.ground, m, WATER)
        setattr(sc, '_' + name, m)
        sc.reserved.append((bb[0], bb[1], bb[2], bb[3]))


def _paint_pan(sc):
    """La salina: una costra clara y agrietada (en polígonos), con el borde en sombra arriba."""
    m = mk.blob_mask(PAN, wob=0.15, seed=8)
    mm, px = m.load(), sc.ground.load()
    bb = m.getbbox()
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if not mm[x, y]:
                continue
            up = y > 0 and mm[x, y - 1]
            c = SALT[0]
            if not up:
                c = SALT[1]
            # grietas: bordes de celdas (Voronoi gordo con hash)
            cx, cy = x // 7, y // 5
            best = []
            for gx in (cx - 1, cx, cx + 1):
                for gy in (cy - 1, cy, cy + 1):
                    fx = gx * 7 + 7 * mk._h(gx, gy, 81)
                    fy = gy * 5 + 5 * mk._h(gy, gx, 82)
                    best.append((x - fx) ** 2 + ((y - fy) * 1.4) ** 2)
            best.sort()
            if best[1] - best[0] < 5:
                c = SALT[2]
            elif mk.dither(x, y) < 0.08:
                c = SALT[1]
            px[x, y] = c
    sc._pan = m
    sc.reserved.append(bb)


def _scene():
    rnd = random.Random(505)
    sc = mk.Scene(LEVEL, GROUND, seed=5)
    sc.shadow_color = C('#463844', 92)
    _patches(sc)
    _paint_ponds(sc)
    _paint_pan(sc)
    sc.lay_path(CURVE, PATH, POINTS)
    for name, box, _n, _fps in FX:
        if name not in ('map-fx-5-buitres',):     # los buitres vuelan por encima de los huesos (se reservan aparte)
            sc.reserved.append(box)

    def deco(sp, x, y, **kw):
        box = sc.put(sp, x, y, **kw)
        sc.reserved.append(box)
        return box

    # --- el jefe: el elefante junto a su charca, bajo el baobab gigante
    el = elephant()
    sc.put(el, ELEPHANT_AT[0], ELEPHANT_AT[1], key='elephant', shadow=SHADOW)
    deco(mk.baobab(55, 54, BAOBAB), 204, 118, shadow=SHADOW)
    # --- la salida: dos baobabs a los lados del camino
    deco(mk.baobab(51, 40, BAOBAB), 44, 24, shadow=SHADOW)
    deco(mk.baobab(52, 30, BAOBAB, leaves=False), 150, 22, shadow=SHADOW)
    # --- los huesos (los buitres giran encima)
    deco(ribcage(), CARCASS[0], CARCASS[1], shadow=SHADOW)
    deco(skull(), CARCASS[0] + 22, CARCASS[1] + 8, shadow=SHADOW)
    for k, (x, y) in enumerate(((12, 290), (50, 292), (18, 262))):
        sc.try_put(bone_bit(k), x, y, pad=1, shadow=SHADOW)
    # --- el campamento junto al punto 6
    # (en la cara de dentro de la curva, a ~30 px del punto; si ninguno cabe, error: que no vuelva a faltar en silencio)
    sp = camp()
    for x, y in CAMP_SPOTS:
        if sc.free(sc.opaque_box(sp, x, y), 1):
            deco(sp, x, y, shadow=SHADOW)
            sc._camp_at = (x, y)
            break
    else:
        raise ValueError(f'zona {ZONE}: el campamento no cabe en ninguno de {CAMP_SPOTS}')

    def named(sp, spots, pad=1):
        for x, y in spots:
            if sc.free(sc.opaque_box(sp, x, y), pad):
                deco(sp, x, y, shadow=SHADOW)
                return (x, y)
        return None

    # --- baobabs y acacias por los bordes
    for k, (x, y, h) in enumerate(((18, 168, 40), (206, 300, 44), (16, 410, 36), (200, 236, 30), (106, 196, 30),
                                   (14, 74, 30))):
        named(mk.baobab(60 + k, h, BAOBAB, leaves=k % 2 == 0), ((x, y), (x + 6, y), (x - 6, y), (x, y + 8)))
    for k, (x, y, w) in enumerate(((100, 356, 30), (190, 416, 26), (130, 270, 24), (30, 380, 22), (120, 100, 26),
                                   (40, 120, 24), (204, 160, 22), (84, 290, 20))):
        named(mk.acacia(70 + k, w, ACACIA), ((x, y), (x + 8, y), (x - 8, y), (x, y - 8), (x, y + 8)))
    # --- termiteros
    for k, (x, y) in enumerate(((150, 330), (16, 346), (96, 128), (196, 196))):
        named(termite_mound(80 + k, rnd.choice((14, 17, 20))), ((x, y), (x + 6, y), (x - 6, y)))
    # --- rocas grises (kopjes) en grupos
    for gx, gy in ((150, 236), (20, 196), (190, 126), (60, 404), (82, 252), (130, 410)):
        for k in range(3):
            x, y = gx + rnd.randint(-8, 8), gy + rnd.randint(-5, 5)
            sc.try_put(mk.rock(600 + gx + k, rnd.choice((6, 8, 10, 12)), STONE), x, y, pad=1, shadow=SHADOW)
    # --- matas secas y hierba alta, en manchas
    for k in range(160):
        x, y = rnd.randint(2, 218), rnd.randint(20, 420)
        sc.try_put(mk.bush(900 + k, rnd.choice((2, 2, 3, 3, 4)), DRYBUSH), x, y, pad=1, shadow=SHADOW)
    for k in range(260):
        x, y = rnd.randint(3, 217), rnd.randint(6, 420)
        sp = grass_clump(1000 + k, 0, rnd.choice((6, 7, 8, 9)))
        sc.try_put(sp, x, y, pad=1, shadow=SHADOW)
    # --- la hierba alta del ambiente: matas con clave para que ondeen
    box = FX[4][1]
    gr = random.Random(77)
    sc._grass = []
    for k in range(160):
        x, y = gr.randint(box[0] + 6, box[2] - 6), gr.randint(box[1] + 12, box[3] - 1)
        h = gr.choice((10, 11, 12, 13))
        sp = grass_clump(1500 + k, 0, h)
        ob = sc.opaque_box(sp, x, y)
        if ob[0] < box[0] + 2 or ob[2] > box[2] - 2 or ob[1] < box[1] + 2 or sc.near_path(ob, 2):
            continue
        if any(abs(x - gx) < 5 and abs(y - gy) < 3 for gx, gy, _s, _h in sc._grass):
            continue
        key = f'grass{k}'
        sc.put(sp, x, y, key=key, shadow=SHADOW)
        sc._grass.append((x, y, 1500 + k, h))
    return sc


# ---------------------------------------------------------------- ambientes

def _fx_espejismo(sc):
    """
    Espejismo sobre la salina: el aire caliente hace temblar la costra (cada fila se desplaza 1 px a un lado u otro con
    una onda que sube) y un falso lago, franjas tramadas del color del cielo, reluce, se ensancha y se deshace. Solo
    dentro de la salina (que no tiene decorado encima: no deja «fantasmas»).
    """
    box = FX[0][1]
    pm = sc._pan.load()

    def fn(t, i):
        def over(img, x0, y0):
            src = img.copy().load()
            px = img.load()
            w, h = img.size
            for y in range(h):
                Y = y + y0
                shift = mk.step3(mk.wave(t, -Y / 10.0))
                for x in range(w):
                    X = x + x0
                    if not pm[X, Y]:
                        continue
                    sx = x - shift
                    if 0 <= sx < w and pm[sx + x0, Y]:
                        px[x, y] = src[sx, y]
                    # el falso lago: un óvalo de franjas del color del cielo que se ensancha y encoge; cada franja
                    # se rompe en trazos que corren a los lados (el aire que tiembla)
                    rx = 23 + 5 * mk.wave(t)
                    ry = 6.5 + 1.2 * mk.wave(t)
                    e = ((X - LAKE[0]) / rx) ** 2 + ((Y - LAKE[1]) / ry) ** 2
                    if e >= 1:
                        continue
                    dirn = 1 if Y % 2 == 0 else -1
                    streak = math.sin(2 * math.pi * (X / 16.0 + dirn * t + mk._h(Y, 7)))
                    if streak > -0.55 + 1.35 * e:
                        px[x, y] = SKY[1] if (e < 0.45 and streak > 0.6) else SKY[0]
        return None, over
    return fn


def _fx_elefante(sc):
    ears = (0, 1, 2, 1, 0, 0, 0, 1)
    trunks = (0, 0, 0, 1, 1, 0, 2, 2)
    sprites = {(a, b): elephant(a, b) for a in range(3) for b in range(3)}

    def fn(t, i):
        return {'elephant': sprites[(ears[i], trunks[i])]}, None
    return fn


def _fx_buitres(sc):
    """Tres buitres que giran sobre los huesos (un tercio de vuelta por bucle: la ronda vuelve a su sitio)."""
    box = FX[2][1]
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + 1
    rx, ry = (box[2] - box[0]) / 2 - 9, (box[3] - box[1]) / 2 - 5
    birds = [vulture(0), vulture(1)]

    def fn(t, i):
        def over(img, x0, y0):
            for k in range(3):
                a = 2 * math.pi * (k / 3 + t / 3)
                X = cx + rx * math.cos(a)
                Y = cy + ry * math.sin(a) - 2 * math.sin(a)
                flap = 1 if (i + 3 * k) % 8 in (0, 1) else 0
                sp = birds[flap]
                mk.blit(img, sp, int(round(X - sp.size[0] / 2)) - x0, int(round(Y - sp.size[1] / 2)) - y0)
        return None, over
    return fn


def _fx_charca(sc):
    """
    El sol del atardecer reluce en la charca de abajo: una estela de destellos naranjas que se encienden y apagan por
    turnos, y un anillo de agua que se abre y se borra (un insecto que toca el agua). Todo es luz propia (el reflejo del
    sol): se pinta con su color final después del oscurecido, si no saldría gris.
    """
    box = FX[3][1]
    wm = sc._pond.load()
    rnd = random.Random(15)
    glints = []
    for k in range(14):
        for _ in range(40):
            X = rnd.randint(box[0] + 2, box[2] - 4)
            Y = rnd.randint(box[1] + 2, box[3] - 2)
            if wm[X, Y] and wm[X + 2, Y] and wm[X, Y - 2] and wm[X, Y + 1]:
                glints.append((X, Y, rnd.random(), rnd.choice((1, 2, 3))))
                break
    ring_at = (176, 366)

    def glow(t, i):
        out = []
        for X, Y, ph, ln in glints:
            v = mk.fade((t + ph) % 1.0)
            if v < 0.35:
                continue
            c = GLINT[2] if v > 0.85 else (GLINT[1] if v > 0.6 else GLINT[0])
            for dx in range(ln if v > 0.6 else 1):
                if wm[X + dx, Y]:
                    out.append((X + dx, Y, c if dx == 0 or c is not GLINT[2] else GLINT[1]))
        u = (t * 2) % 1.0                      # dos anillos por bucle: se abre de 4 a 10 px en 4 cuadros y se borra
        r = 4 + 8 * u
        seen = set()
        for a in range(0, 360, 3):
            X = int(round(ring_at[0] + r * math.cos(math.radians(a))))
            Y = int(round(ring_at[1] + r * 0.45 * math.sin(math.radians(a))))
            if (X, Y) in seen or not wm[X, Y] or (u > 0.6 and mk.dither(X, Y) > 0.5):
                continue
            seen.add((X, Y))
            out.append((X, Y, RIPPLE[1] if math.sin(math.radians(a)) > 0 else RIPPLE[0]))
        return out
    return glow


def _fx_hierba(sc):
    """La hierba alta ondea: una racha de viento la cruza de izquierda a derecha (cada mata se inclina 1 px y vuelve)."""
    variants = {}
    for x, y, seed, h in sc._grass:
        variants[(seed, -1)] = grass_clump(seed, -1, h)
        variants[(seed, 1)] = grass_clump(seed, 1, h)
        variants[(seed, 0)] = grass_clump(seed, 0, h)

    def fn(t, i):
        out = {}
        for x, y, seed, h in sc._grass:
            s = mk.step3(mk.wave(t, -x / 80.0))
            out[f'grass{seed - 1500}'] = variants[(seed, s)]
        return out, None
    return fn


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    # la brasa de la fogata tiene luz propia: se pinta sobre la escena ya oscurecida (si no, sale gris)
    mk.glow_base(sc, mk.glow_spots(camp(), *sc._camp_at, EMBER_GLOW))
    makers = {'map-fx-5-espejismo': _fx_espejismo, 'map-fx-5-elefante': _fx_elefante, 'map-fx-5-buitres': _fx_buitres,
              'map-fx-5-charca': _fx_charca, 'map-fx-5-hierba': _fx_hierba}
    glows = {'map-fx-5-charca'}               # ambientes de luz propia: `makers` da su `glow(t, i)`
    for name, box, n, fps in FX:
        if name in glows:
            mk.add_glow_fx(sc, name, box, n, fps, None, makers[name](sc))
        else:
            sc.add_fx(name, box, n, fps, makers[name](sc))
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
