"""
Zona 7 «Guarida» del mapa del Chess Runner (jefe: el Rey de las Sombras, id `rey`; oscuridad 6): la fortaleza del Rey
sobre un tablero de ajedrez roto, con murallas de piedra negra, torres negras y violeta, grietas que dejan ver una luz
violeta y una tormenta encima. Es el final del viaje: la escena más tenebrosa, casi monocroma, con el violeta como único
color. Escena 220×420, ambientes y puntos según `docs/personajes/ASSETS_SPEC.md`.

El camino entra por abajo (x = 110, donde sale el de la zona 6) por la puerta de la muralla exterior, cruza el patio de
las grietas, sube por la puerta de la segunda muralla, atraviesa una plaza de tablero roto (primer patrón), pasa la puerta
de la tercera muralla junto a la torre de los ojos rojos, la puerta de las ruinas, la segunda plaza de tablero (segundo
patrón), la puerta del adarve y, por la última puerta (la de la muralla interior), entra en la sala del trono, donde le
espera el Rey de las Sombras entre dos braseros de fuego violeta. No sale por arriba: el camino acaba en el trono.

Luz: noche de tormenta. Sin luna: la poca luz es fría y difusa, viene de arriba a la izquierda (el cielo de tormenta) y
deja sombras cortas violeta oscuro hacia abajo a la derecha. Suelo de ceniza y roca violeta casi negra, con trozos del
tablero (casillas claras y oscuras, rotas, hundidas o que faltan). Piedra negra en murallas y torres; las torres del Rey,
violeta. Luz propia solo en luces puntuales: el núcleo de la grieta grande, los ojos rojos de la torre, el fuego violeta
de los braseros y el rayo.

Puntos (6 puertas y 2 de patrón, con el Rey al final; las puertas de las murallas marcan el avance y los patrones están
en las dos plazas de tablero, intercalados):
  1 door (muralla exterior) · 2 door (segunda muralla) · 3 pattern (plaza baja) · 4 door (tercera muralla) ·
  5 door (puerta de las ruinas) · 6 pattern (plaza alta) · 7 door (puerta del adarve) · 8 door (muralla interior) · 9 king

Ambiente: `relampagos` (la protagonista: la tormenta del cielo de arriba a la izquierda está quieta y, de vez en cuando,
un rayo cae y alumbra las nubes un instante), `grietas` (la grieta grande del patio exterior late en violeta: el pulso
recorre la grieta), `ojos` (ojos rojos que se abren y parpadean en las ventanas de la torre negra de la derecha),
`estandartes` (los dos estandartes del muro del trono ondean) y `brasero1` / `brasero2` (el fuego violeta de los dos
braseros que flanquean al Rey: van en capas separadas porque una sola caja taparía el punto del Rey).
"""
import functools
import math
import random

from PIL import Image, ImageDraw, ImageFilter

import mapkit as mk
from pixel import C, layer, outlined

ZONE = 7
LEVEL = 6

# Ceniza y roca violeta (tono ~270°): el `grade` del nivel 6 le quita dos tercios de la saturación y la mitad de la luz, y
# empuja las sombras al violeta frío; con el tono de partida en el violeta, el resultado es casi gris con un velo violeta.
GROUND = {'base': C('#68407a'), 'light': C('#724a86'), 'dark': C('#5c366c'), 'dash': C('#52305f'),
          'dash2': C('#7a5290'), 'tuft': C('#3e2a4a')}
ASH = (C('#6a6070'), C('#545060'))                     # calvas de ceniza gris
BOARD = {'light': C('#a08cb4'), 'light_hi': C('#baa8cc'), 'light_lo': C('#806e94'),
         'dark': C('#443252'), 'dark_hi': C('#584468'), 'dark_lo': C('#2e2038'),
         'joint': C('#1e1828'), 'void': C('#120e1a'), 'crack': C('#241c30')}
PATH = {'fill': C('#b8aac4'), 'dark': C('#7e6e90'), 'light': C('#cec0da'), 'speck': C('#9e90ac'),
        'rim': C('#221a2e'), 'pebble': C('#d4ccdc'), 'grass': C('#3a2e48')}
BLACK = {'stone': (C('#1e1a24'), C('#2e2838'), C('#423a50'), C('#5a5070')), 'out': C('#0a080e'), 'win': C('#08060a')}
VIOLET = {'stone': (C('#3a1e6a'), C('#55309a'), C('#7448c8'), C('#9a70e8')), 'out': C('#100a1c'), 'win': C('#0a0612')}
WALL = {'stone': (C('#26222e'), C('#38323f'), C('#4c4458'), C('#665c76')), 'out': C('#0c0a10'), 'win': C('#08060a')}
RUBBLE = {'stone': (C('#2e2838'), C('#4a4258'), C('#6a6080')), 'stone_out': C('#0e0c14')}
STATUE = {'stone': (C('#3a3448'), C('#5a5270'), C('#80789a'), C('#a29ab8')), 'out': C('#100e16')}
SKY = (C('#2a2634'), C('#383246'), C('#484258'), C('#5a5470'))   # nubes de tormenta: de la más oscura a la más clara
SKY_LIT = (C('#6a6488'), C('#8a84aa'), C('#aaa4c8'), C('#cac4e6'))  # las mismas, alumbradas por el rayo
CRACK = {'void': C('#0e0a16'), 'core': C('#7a48b0'), 'edge': C('#5a4a6e')}
BANNER = {'cloth': (C('#4a1a80'), C('#6a2ab0'), C('#8a48d8')), 'sign': C('#a090c0'), 'pole': C('#2a2430'),
          'out': C('#0c0814')}
THRONE = {'stone': (C('#3a2a5a'), C('#6a58a0'), C('#9a88d0'), C('#d0c4f0')), 'cushion': (C('#8a2ad0'), C('#c070ff')),
          'out': C('#08060c')}
BRAZIER = {'stone': (C('#26222c'), C('#3e3848'), C('#5a5268')), 'ember': C('#9a5ae0'), 'out': C('#0a080e')}
# luz propia, color FINAL (se pinta tras el `grade`)
CORE_GLOW = (C('#6a3aa8'), C('#9a5ee0'), C('#d0a0ff'))            # la grieta: apagada, a media luz, en su pico
CORE_HALO = (150, 80, 230, 90)
EYE = (C('#ff3a2a'), C('#b02418'), (230, 40, 30, 90))               # ojo: núcleo, borde, halo (mezclado)
FLAME = (C('#5a2a98'), C('#9a5ae0'), C('#d8b0ff'), C('#f4e8ff'))   # fuego violeta: de fuera adentro
BOLT = (C('#f4f0ff'), (170, 150, 230, 170))                        # el rayo: núcleo y su resplandor (mezclado)

# la primera, en x = 110: el camino sale por abajo por las mismas columnas por las que sale por arriba el de la zona 6
PATH_CTRL = [(110, 434), (110, 404), (124, 386), (152, 372), (164, 348), (150, 326), (116, 316), (80, 306), (58, 284),
             (62, 258), (92, 244), (132, 236), (160, 214), (158, 186), (128, 172), (92, 164), (64, 146), (60, 120),
             (78, 100), (104, 90), (110, 72), (110, 52)]
CURVE = mk.Curve(PATH_CTRL)
KINDS = ('door', 'door', 'pattern', 'door', 'door', 'pattern', 'door', 'door', 'king')
FRACS = (0.05, 0.17, 0.29, 0.41, 0.62, 0.72, 0.80, 0.88, 1.0)
POINTS = mk.points_on(CURVE, FRACS, KINDS)

SHADOW = (0.35, 0.2)           # luz difusa de arriba a la izquierda: sombras cortas hacia abajo a la derecha

# murallas: (pie, alto, puerta) con la puerta = `order` del punto que la atraviesa
WALLS = ((418, 11, 1), (356, 12, 2), (272, 12, 4), (120, 12, 8))
KEEP_WALL = (56, 164, 36, 20)  # el muro del trono: x0, x1, pie, alto
THRONE_AT = (110, 37)
BRAZIERS = ((84, 54), (136, 54))
BANNERS = ((72, 32), (148, 32))
EYE_TOWER = (196, 306)         # la torre negra de los ojos (pie)
CHASM = [[(6, 374), (18, 366), (30, 370), (42, 360), (56, 366), (68, 356), (80, 362), (90, 358)],
         [(30, 370), (34, 382), (46, 388), (52, 396)],
         [(56, 366), (62, 378), (72, 384)],
         [(18, 366), (12, 356), (16, 348)]]

FX = [
    ('map-fx-7-relampagos', (0, 0, 60, 42), 8, 2),
    ('map-fx-7-estandartes', (62, 12, 158, 34), 8, 5),
    ('map-fx-7-brasero1', (76, 34, 94, 46), 8, 6),
    ('map-fx-7-brasero2', (126, 34, 144, 46), 8, 6),
    ('map-fx-7-ojos', (176, 228, 220, 312), 8, 3),
    ('map-fx-7-grietas', (2, 340, 96, 402), 8, 4),
]

META = {'zones': {str(ZONE): {
    'name': 'Guarida', 'boss': 'rey', 'darkness': LEVEL, 'scene': f'map-zone-{ZONE}',
    'points': POINTS, 'ambient': mk.ambient_meta(FX)}}}


# ---------------------------------------------------------------- piezas propias

def rook(seed, w, h, pal, windows=0, broken=False, eyes=False):
    """
    Torre en forma de torre de ajedrez (pie = centro de la base): basa ancha, fuste que se estrecha un poco, collarín y
    almenas arriba (mordidas si `broken`), hiladas de sillares y la luz a la izquierda. `windows` ventanas en saetera (o, con
    `eyes`, anchas de 5 px para que se vean los ojos); sus esquinas quedan en `info['windows']` (coordenadas del sprite).
    """
    rnd = random.Random(seed)
    s = pal['stone']
    sp = layer(w, h)
    px = sp.load()
    d = ImageDraw.Draw(sp)
    top_h = 5                                   # almenas (3) + collarín (2)
    base_h = 3
    inset = max(1, w // 7)
    for y in range(h):
        if y < 3:                               # almenas
            n = 3 if w < 16 else 4
            seg = w / (2 * n - 1)
            x0, x1 = 0, w
            cols = [x for x in range(x0, x1) if int(x / seg) % 2 == 0]
        elif y < top_h:
            cols = range(0, w)
        elif y >= h - base_h:
            cols = range(0, w)
        else:
            u = (y - top_h) / max(1, h - top_h - base_h)
            ins = inset + int(round(1.5 * (1 - u)))
            cols = range(ins, w - ins)
        cols = list(cols)
        if not cols:
            continue
        lo, hi = cols[0], cols[-1]
        for x in cols:
            rel = (x - lo) / max(1, hi - lo)
            c = s[2] if rel < 0.3 else (s[0] if rel > 0.72 else s[1])
            if y < top_h and y in (0, 3) and rel < 0.85:
                c = s[3]                        # la cara de arriba de almenas y collarín, con luz
            elif top_h <= y < h - base_h and (y - top_h) % 4 == 3:
                c = s[0] if rel > 0.3 else s[1]  # hilada
            elif top_h <= y < h - base_h and ((y - top_h) // 4 + x // 3) % 2 == 0 and x % 5 == 0 and rel < 0.72:
                c = s[0]                        # junta vertical, alterna
            elif y == h - base_h:
                c = s[3] if rel < 0.8 else s[1]
            px[x, y] = c
    if broken:                                  # almenas mordidas y una grieta
        for x in range(w):
            for y in range(0, rnd.randint(0, 4) if rnd.random() < 0.6 else 0):
                px[x, y] = (0, 0, 0, 0)
        x, y = rnd.randint(w // 3, 2 * w // 3), top_h + 1
        for _ in range(rnd.randint(5, 9)):
            if 0 <= x < w and y < h and px[x, y][3]:
                px[x, y] = s[0]
            x += rnd.choice((-1, 0, 1))
            y += 1
    wins = []
    cx = w // 2
    for k in range(windows):
        wy = top_h + 4 + k * max(9, (h - top_h - base_h - 10) // max(1, windows))
        if eyes:
            ww, wh = 5, 4
        else:
            ww, wh = 2, 5
        wx = cx - ww // 2 + (0 if k % 2 == 0 or eyes else rnd.choice((-2, 2)))
        if wy + wh >= h - base_h - 1:
            break
        d.rectangle([wx, wy + 1, wx + ww - 1, wy + wh - 1], fill=pal['win'])
        d.line([(wx + 1, wy), (wx + ww - 2, wy)], fill=pal['win'])
        d.line([(wx, wy + wh), (wx + ww - 1, wy + wh)], fill=s[3])      # alféizar con luz
        wins.append((wx + 1, wy + 1, ww, wh))                            # (+1: el contorno)
    out = outlined(sp, pal['out'])
    out.info['windows'] = wins
    return out


def wall(seed, w, h, pal, merlon=3, windows=0):
    """
    Lienzo de muralla (pie = centro de la base) visto de frente: adarve claro arriba, almenas, sillares con hiladas y
    juntas alternas, la base en sombra; algunas almenas caídas y grietas. `windows` arcos oscuros en el muro.
    """
    rnd = random.Random(seed)
    s = pal['stone']
    sp = layer(w, h)
    px = sp.load()
    for x in range(w):
        gone = rnd.random() < 0.18
        for y in range(h):
            if y < merlon:
                if (x // 3) % 2 == 1 or gone:
                    continue
                c = s[3] if y == 0 else s[2]
            elif y == merlon:
                c = s[3]
            elif y == merlon + 1:
                c = s[2]
            elif y >= h - 2:
                c = s[0]
            else:
                yy = y - merlon - 2
                c = s[1]
                if yy % 3 == 2:
                    c = s[0]
                elif (x + 4 * ((yy // 3) % 2)) % 8 == 0:
                    c = s[0]
                elif mk._h(x, y, seed) < 0.06:
                    c = s[2]
            px[x, y] = c
    d = ImageDraw.Draw(sp)
    for _ in range(max(1, w // 18)):
        x, y = rnd.randint(2, w - 3), merlon + 2
        for _k in range(rnd.randint(3, h - merlon - 2)):
            if 0 <= x < w and y < h:
                px[x, y] = s[0]
            x += rnd.choice((-1, 0, 1))
            y += 1
    for k in range(windows):
        wx = int((k + 0.5) * w / windows) - 2
        d.rectangle([wx, merlon + 5, wx + 3, h - 4], fill=pal['win'])
        d.line([(wx + 1, merlon + 4), (wx + 2, merlon + 4)], fill=pal['win'])
    return outlined(sp, pal['out'])


def throne():
    """El trono del Rey (pie = centro de la base): respaldo alto acabado en picos como una corona, brazos y cojín violeta."""
    tp = THRONE
    s = tp['stone']
    w, h = 20, 22
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.rectangle([4, 4, 15, 15], fill=s[1])                       # respaldo
    d.line([(4, 4), (4, 15)], fill=s[2])
    d.line([(15, 4), (15, 15)], fill=s[0])
    for x, y0 in ((4, 1), (7, 2), (9, 0), (10, 0), (12, 2), (15, 1)):    # picos de la corona
        d.line([(x, y0), (x, 4)], fill=s[2] if x < 10 else s[1])
    d.point((9, 0), fill=s[3])
    d.rectangle([7, 6, 12, 13], fill=tp['cushion'][0])           # respaldo acolchado
    d.line([(7, 6), (7, 13)], fill=tp['cushion'][1])
    d.rectangle([2, 12, 17, 15], fill=s[2])                      # brazos
    d.line([(2, 12), (17, 12)], fill=s[3])
    d.rectangle([5, 14, 14, 16], fill=tp['cushion'][1])          # asiento
    d.rectangle([3, 16, 16, 20], fill=s[1])                      # base y escalón
    d.line([(3, 16), (16, 16)], fill=s[2])
    d.line([(16, 16), (16, 20)], fill=s[0])
    d.rectangle([1, 20, 18, 21], fill=s[2])
    d.line([(1, 21), (18, 21)], fill=s[0])
    return outlined(sp, tp['out'])


def brazier(lit=False):
    """Brasero de piedra (pie = centro de la base): copa sobre un pie, con las ascuas violeta (el fuego lo pone el ambiente)."""
    b = BRAZIER
    s = b['stone']
    sp = layer(10, 10)
    d = ImageDraw.Draw(sp)
    d.rectangle([0, 1, 9, 3], fill=s[1])                         # copa
    d.line([(0, 1), (9, 1)], fill=s[2])
    d.line([(9, 1), (9, 3)], fill=s[0])
    d.line([(1, 4), (8, 4)], fill=s[0])
    d.rectangle([4, 5, 5, 8], fill=s[1])                         # pie
    d.point((4, 5), fill=s[2])
    d.rectangle([2, 8, 7, 9], fill=s[1])
    d.line([(2, 8), (7, 8)], fill=s[2])
    for x in (2, 4, 5, 7):
        d.point((x, 0), fill=b['ember'])                         # ascuas
    d.point((3, 0), fill=s[0])
    d.point((6, 0), fill=s[0])
    return outlined(sp, b['out'])


def banner(t=0.0):
    """
    Estandarte (pie = la punta de abajo): asta horizontal y paño violeta largo con la corona del Rey y la cola en dos picos.
    `t` en [0, 1): el paño ondea (las columnas se desplazan con una onda que baja por la tela y crece hacia la punta).
    """
    bp = BANNER
    cw, ch = 7, 16
    w, h = cw + 6, ch + 2
    sp = layer(w, h)
    px = sp.load()
    for x in range(1, w - 1):                                    # el asta
        px[x, 0] = bp['pole']
    for y in range(ch):
        u = y / (ch - 1)
        dx = int(round(1.6 * u * math.sin(2 * math.pi * t - y / 3.0)))
        for x in range(cw):
            if y >= ch - 3 and (abs(x - cw // 2) < (y - (ch - 4))):  # la cola en dos picos
                continue
            c = bp['cloth'][1]
            if x == 0:
                c = bp['cloth'][2]
            elif x == cw - 1:
                c = bp['cloth'][0]
            shade = math.sin(2 * math.pi * t - y / 3.0 + x * 0.5)
            if shade > 0.65 and 0 < x < cw - 1:
                c = bp['cloth'][2]
            elif shade < -0.7 and 0 < x < cw - 1:
                c = bp['cloth'][0]
            X = 3 + x + dx
            if 0 <= X < w:
                px[X, y + 1] = c
    # la corona del Rey, bordada
    for x, y in ((4, 5), (6, 4), (8, 5), (4, 6), (5, 6), (6, 6), (7, 6), (8, 6), (5, 7), (6, 7), (7, 7)):
        dx = int(round(1.6 * ((y - 1) / (ch - 1)) * math.sin(2 * math.pi * t - (y - 1) / 3.0)))
        if px[x + dx, y][3]:
            px[x + dx, y] = bp['sign']
    return outlined(sp, bp['out'])


def pawn(seed, lying=False):
    """Estatua de un peón gigante (pie = centro de la base), agrietada; con `lying`, caída de lado y partida."""
    st = STATUE
    s = st['stone']
    w, h = 12, 20
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.ellipse([3, 0, 8, 5], fill=s[1])                           # cabeza
    d.chord([3, 0, 8, 5], 150, 300, fill=s[3])
    d.rectangle([3, 6, 8, 6], fill=s[2])                         # collarín
    d.polygon([(4, 7), (7, 7), (9, 15), (2, 15)], fill=s[1])     # cuerpo
    d.line([(4, 7), (2, 15)], fill=s[2])
    d.line([(7, 7), (9, 15)], fill=s[0])
    d.rectangle([1, 15, 10, 17], fill=s[2])                      # basa
    d.line([(1, 15), (10, 15)], fill=s[3])
    d.rectangle([0, 18, 11, 19], fill=s[1])
    d.line([(11, 18), (11, 19)], fill=s[0])
    rnd = random.Random(seed)
    x, y = rnd.randint(4, 7), 7
    px = sp.load()
    for _ in range(7):
        if px[x, y][3]:
            px[x, y] = s[0]
        x += rnd.choice((-1, 1))
        y += 1
    if lying:
        sp = sp.transpose(Image.ROTATE_270)
        px = sp.load()
        cut = rnd.randint(8, 11)
        for y in range(sp.size[1]):                              # partido: un hueco entre la cabeza y el cuerpo
            px[cut, y] = (0, 0, 0, 0)
    return outlined(sp, st['out'])


# ---------------------------------------------------------------- el suelo

def _board_tile(i, j, x, y, ox, oy, T, seed):
    """Color de la casilla (i, j) del tablero en (x, y), o None si falta."""
    if mk._h(i, j, seed) < 0.12:
        return None
    u, v = (x - ox) % T, (y - oy) % T
    light = (i + j) % 2 == 0
    sunk = mk._h(j, i, seed + 1) < 0.15
    b = BOARD
    if u == 0 or v == 0:
        return b['joint']
    if v == 1 or u == 1:
        c = b['light_hi'] if light else b['dark_hi']
    elif v == T - 1 or u == T - 1:
        c = b['light_lo'] if light else b['dark_lo']
    else:
        c = b['light'] if light else b['dark']
    if sunk:
        c = mk.tone(c, 0.8)
    if mk._h(i, j, seed + 2) < 0.3:                             # casilla agrietada: una línea en diagonal
        k = int(mk._h(i, j, seed + 3) * (T - 3)) + 2
        if (u + v == k + 2 or u + v == k + 3 and v % 3 == 0) and 1 < u < T - 1 and 1 < v < T - 1:
            return b['crack']
    return c


def _paint_board(sc, frags, seed, T=10, ox=4, oy=2):
    """Trozos del tablero (casillas claras y oscuras con bisel) dentro de unas manchas de borde roto; faltan casillas."""
    m = mk.blob_mask(frags, wob=0.22, seed=seed)
    mp, px = m.load(), sc.ground.load()
    bb = m.getbbox()
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if not mp[x, y]:
                continue
            i, j = (x - ox) // T, (y - oy) // T
            c = _board_tile(i, j, x, y, ox, oy, T, seed)
            if c is None:
                c = BOARD['void'] if mk.dither(x, y) < 0.7 else ASH[1]
            px[x, y] = c
    return m


def _patches(sc):
    """Calvas de ceniza gris y manchas oscuras de roca quemada."""
    px = sc.ground.load()
    ash = [(30, 300, 24, 9), (180, 380, 30, 10), (130, 120, 26, 8), (24, 200, 20, 8), (196, 168, 22, 8),
           (100, 286, 22, 7), (150, 410, 22, 6), (40, 70, 18, 7)]
    for y in range(mk.H):
        for x in range(mk.W):
            b = 0.0
            for bx, by, rx, ry in ash:
                wob = 1 + 0.25 * math.sin(x * 0.4 + y * 0.3 + bx)
                e = ((x - bx) / (rx * wob)) ** 2 + ((y - by) / ry) ** 2
                if e < 1:
                    b = max(b, 1 - e)
            if b > 0.15 + 0.45 * mk.dither(x + 1, y):
                px[x, y] = ASH[0] if mk._h(x, y, 71) < 0.6 else ASH[1]


def horizon(x):
    """Fila del horizonte en la columna `x`: por encima, el cielo de tormenta."""
    return 30 + 3 * math.sin(x / 11.0) + 2 * math.sin(x / 4.3 + 1.0)


def sky_color(x, y, lit=0.0):
    """Nubes de tormenta en bandas que se enroscan; `lit` (0–1) las alumbra desde abajo a la izquierda (el rayo)."""
    v = (0.5 + 0.5 * math.sin(x / 9.0 + y / 3.2 + 1.5 * math.sin(x / 23.0))) * 0.7 + \
        (0.5 + 0.5 * math.sin(x / 4.1 - y / 2.3)) * 0.3
    v = v * (0.55 + 0.45 * y / 34)                               # más claras hacia el horizonte
    k = max(0, min(3, int(v * 3.6 + mk.dither(x, y) * 0.8)))
    c = SKY[k]
    if lit > 0:
        near = max(0.0, 1 - math.hypot(x - 28, y - 22) / 40)
        fade = max(0.0, min(1.0, (59 - x) / 11))           # se apaga antes del borde de su caja (x = 60): sin corte
        a = lit * (0.35 + 0.65 * near) * fade
        if a > 0.15 + 0.6 * mk.dither(x, y):
            c = SKY_LIT[k]
    return c


def _paint_sky(sc):
    px = sc.ground.load()
    m = Image.new('L', (mk.W, mk.H), 0)
    mp = m.load()
    for x in range(mk.W):
        hz = horizon(x)
        for y in range(int(hz) + 1):
            if y < hz:
                px[x, y] = sky_color(x, y)
                mp[x, y] = 255
            else:
                px[x, y] = SKY[0]
    sc._sky = m


def _chasm(pts_list, rnd, widths=(2, 4)):
    """Máscara de una grieta (líneas quebradas con ancho que varía) y la lista de píxeles de su núcleo, en orden."""
    m = Image.new('L', (mk.W, mk.H), 0)
    d = ImageDraw.Draw(m)
    core = []
    for k, pts in enumerate(pts_list):
        wmax = widths[1] if k == 0 else widths[0] + 1
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            n = int(max(abs(bx - ax), abs(by - ay)))
            for s in range(n + 1):
                x = ax + (bx - ax) * s / max(1, n)
                y = ay + (by - ay) * s / max(1, n)
                r = max(0.6, wmax / 2 * (0.6 + 0.4 * math.sin(s / 3.0 + k)))
                d.ellipse([x - r, y - r, x + r, y + r], fill=255)
                core.append((int(round(x)), int(round(y)), k, len(core)))
    seen, out = set(), []
    for x, y, k, n in core:
        if (x, y) not in seen:
            seen.add((x, y))
            out.append((x, y))
    return m, out


def _paint_chasm(sc, mask, core):
    px, mp = sc.ground.load(), mask.load()
    rim = mask.filter(ImageFilter.MaxFilter(3)).load()
    for y in range(mk.H):
        for x in range(mk.W):
            if mp[x, y]:
                px[x, y] = CRACK['void']
            elif rim[x, y] and (y == 0 or not mp[x, y - 1]):
                px[x, y] = CRACK['edge']
    for x, y in core:
        px[x, y] = CRACK['core']


# ---------------------------------------------------------------- la escena

STRICT = True                  # un decorado con nombre que no cabe es un error (no se cae en silencio)


def around(x, y, r=8, step=2):
    """Sitios alrededor de (x, y), del más cercano al más lejano (para buscar hueco a un decorado con nombre)."""
    spots = [(x + dx, y + dy) for dx in range(-r, r + 1, step) for dy in range(-r, r + 1, step)]
    return sorted(spots, key=lambda q: (abs(q[0] - x) + abs(q[1] - y), q))


def _missing(msg):
    if STRICT:
        raise ValueError(f'zona {ZONE}: {msg}')
    print('FALTA', msg)


def _scene():
    rnd = random.Random(707)
    sc = mk.Scene(LEVEL, GROUND, seed=7)
    sc.shadow_color = C('#0a0812', 130)
    _patches(sc)
    # trozos del tablero: las dos plazas de los patrones, la sala del trono y restos sueltos
    p3, p6 = POINTS[2], POINTS[5]
    _paint_board(sc, [(p3['x'], p3['y'], 34, 18), (p3['x'] - 30, p3['y'] - 10, 16, 10)], 3)
    _paint_board(sc, [(p6['x'] - 30, p6['y'] + 8, 36, 16), (p6['x'] - 6, p6['y'] + 2, 18, 14)], 6)
    _paint_board(sc, [(110, 60, 52, 22)], 9)
    _paint_board(sc, [(170, 400, 30, 12), (30, 220, 18, 22), (196, 140, 22, 18), (30, 330, 22, 8)], 11)
    _paint_sky(sc)
    # la grieta grande del ambiente y grietas menores
    sc._chasm, sc._core = _chasm(CHASM, rnd)
    _paint_chasm(sc, sc._chasm, sc._core)
    sc.lay_path(CURVE, PATH, POINTS)
    small = [[(120, 290), (132, 284), (146, 290), (152, 282)], [(190, 214), (198, 226), (194, 238)],
             [(16, 150), (26, 160), (22, 176), (30, 186)], [(180, 120), (170, 134), (176, 148)],
             [(140, 404), (150, 396), (166, 400)], [(96, 206), (108, 200), (120, 208)],
             [(196, 344), (206, 334), (214, 340)]]
    keep = sc.path.filter(ImageFilter.MaxFilter(5))
    for pts in small:
        m, core = _chasm([pts], rnd, widths=(1, 3))
        m = Image.composite(Image.new('L', m.size, 0), m, keep)
        kp = keep.load()
        _paint_chasm(sc, m, [(x, y) for x, y in core if not kp[x, y] and m.getpixel((x, y))])
    for name, box, _n, _fps in FX:
        sc.reserved.append(box)

    def deco(sp, x, y, shadow=SHADOW, **kw):
        box = sc.put(sp, x, y, shadow=shadow, **kw)
        sc.reserved.append(box)
        return box

    def named(sp, spots, what, pad=1, shadow=SHADOW):
        for x, y in spots:
            if sc.free(sc.opaque_box(sp, x, y), pad):
                deco(sp, x, y, shadow=shadow)
                return (x, y)
        _missing(f'{what} no cabe en ninguno de {spots}')

    def scatter(sp, x, y, pad=1):
        if sc.free(sc.opaque_box(sp, x, y), pad):
            sc.put(sp, x, y, shadow=SHADOW)
            return True
        return False

    # --- la sala del trono: el muro del fondo, el trono, los braseros y los estandartes
    x0, x1, foot, hh = KEEP_WALL
    sc.put(wall(41, x1 - x0, hh, WALL, merlon=4, windows=0), (x0 + x1) // 2, foot)
    sc.put(throne(), *THRONE_AT, shadow=SHADOW)
    for x, y in BRAZIERS:
        sc.put(brazier(), x, y, shadow=SHADOW)
    for k, (x, y) in enumerate(BANNERS):
        sc.put(banner(k * 0.5), x, y, key=f'banner{k}', z=foot + 1)
    # torres del Rey a los lados del muro: violeta a la derecha, negra (rota) a la izquierda
    deco(rook(51, 26, 78, VIOLET, windows=3), 194, 86)
    deco(rook(52, 20, 56, BLACK, windows=2, broken=True), 24, 102)
    # --- las murallas, con una torre de puerta a cada lado de su puerta
    for k, (wy, wh, door) in enumerate(WALLS):
        p = POINTS[door - 1]
        runs, start = [], None
        for x in range(-2, mk.W + 3):
            ok = 0 <= x < mk.W and not sc.near_path((x, wy - wh - 1, x + 1, wy + 2), 2) and not any(
                mk.boxes_touch((x, wy - wh - 1, x + 1, wy + 2), (q['x'] - mk.KEEP, q['y'] - mk.KEEP,
                                                                  q['x'] + mk.KEEP + 1, q['y'] + mk.KEEP + 1))
                for q in POINTS)
            if ok and start is None:
                start = x
            elif not ok and start is not None:
                runs.append((start, x))
                start = None
        left = [r for r in runs if r[1] <= p['x']]
        right = [r for r in runs if r[0] >= p['x']]
        if not left or not right:
            raise ValueError(f'zona {ZONE}: la muralla {k} no deja tramo a los dos lados de la puerta {door}')
        for a, b in runs:
            if b - a < 8:
                continue
            sc.put(wall(60 + 7 * k + a, b - a, wh, WALL), (a + b) // 2, wy, shadow=SHADOW)
            sc.reserved.append((a, wy - wh - 1, b, wy + 2))
        # torres de la puerta: en el extremo de cada tramo, junto a la puerta
        lx, rx = max(left)[1], min(right)[0]
        gate = rook(80 + k, 12, 24, WALL, windows=1)
        for X in (lx - 5, rx + 5):
            sc.put(gate, X, wy + 2, shadow=SHADOW)
    # --- la torre de los ojos rojos (delante de la tercera muralla)
    sc._eye_tower = rook(53, 28, 74, BLACK, windows=3, eyes=True)
    sc.put(sc._eye_tower, *EYE_TOWER, shadow=SHADOW)
    # --- puertas sueltas (5 y 7): un pilar de puerta a cada lado del camino
    for door in (5, 7):
        p = POINTS[door - 1]
        pil = rook(90 + door, 10, 20, WALL)
        s0 = FRACS[door - 1] * CURVE.length
        (ax, ay), (bx, by) = CURVE.at(s0 - 4), CURVE.at(s0 + 4)
        ln = math.hypot(bx - ax, by - ay)
        nx, ny = -(by - ay) / ln, (bx - ax) / ln            # normal al camino
        stub = rook(95 + door, 10, 11, WALL, broken=True)       # lo que queda de un pilar caído
        placed = []
        for side in (-1, 1):
            spots = [(int(round(p['x'] + side * nx * dd + tx)), int(round(p['y'] + side * ny * dd + 10)))
                     for dd in range(17, 34, 2) for tx in (0, -2, 2, -4, 4)]
            for sp in (pil, stub):
                hit = next(((x, y) for x, y in spots if sc.free(sc.opaque_box(sp, x, y), 1)), None)
                if hit:
                    deco(sp, *hit)
                    placed.append(sp is pil)
                    break
        if len(placed) < 2 or not any(placed):
            _missing(f'los pilares de la puerta {door} no caben')
    # --- estatuas de peones: uno en pie junto a cada plaza y dos caídos
    named(pawn(1), [(p3['x'] - 44, p3['y'] - 4), (p3['x'] - 40, p3['y'] + 10), (p3['x'] + 36, p3['y'] - 12)], 'el peón 1')
    named(pawn(2), around(p6['x'] - 26, p6['y'] + 46, 8), 'el peón 2')
    named(pawn(3, lying=True), [(132, 296), (128, 300), (140, 300), (120, 292)], 'el peón caído 1')
    named(pawn(4, lying=True), [(28, 236), (24, 240), (34, 228)], 'el peón caído 2')
    # --- torres sueltas y ruinas
    named(rook(54, 18, 44, VIOLET, windows=2, broken=True), around(206, 216, 6), 'la torre violeta rota')
    named(rook(55, 16, 40, BLACK, windows=1, broken=True), [(196, 400), (190, 396), (200, 404)], 'la torre negra de abajo')
    named(rook(56, 16, 36, BLACK, windows=1, broken=True), [(22, 162), (26, 168), (18, 176)], 'la torre negra de la izquierda')
    named(rook(57, 14, 30, VIOLET, windows=1, broken=True), around(178, 166, 6), 'la torre violeta pequeña')
    # --- escombros: bloques, columnas rotas y piedras
    for k, (x, y) in enumerate(((186, 330), (130, 400), (40, 120), (140, 132), (100, 204), (196, 180), (24, 270),
                                (166, 96), (70, 330), (12, 410))):
        if k % 2 == 0:
            scatter(mk.pillar(200 + k, rnd.choice((10, 12, 14)), RUBBLE, broken=True, w=4), x, y)
        else:
            scatter(mk.ruin_block(210 + k, rnd.choice((8, 10)), 6, RUBBLE), x, y)
    for k in range(140):
        x, y = rnd.randint(2, 218), rnd.randint(36, 420)
        scatter(mk.rock(400 + k, rnd.choice((3, 4, 5, 5, 6)), RUBBLE), x, y)
    return sc


def _cover(sc):
    """Máscara de lo que tapa el decorado (para que la luz de un ambiente no se pinte encima de una torre)."""
    if getattr(sc, '_items_mask', None) is None:
        m = Image.new('L', (mk.W, mk.H), 0)
        for it in sc.items:
            a = it['sp'].getchannel('A').point(lambda v: 255 if v else 0)
            m.paste(255, (it['x'], it['y']), a)
        sc._items_mask = m
    return sc._items_mask


# ---------------------------------------------------------------- ambientes

LIGHTNING = (0, 0, 0, 0, 0.35, 0, 1.0, 0.45)        # cuánto alumbra el rayo en cada cuadro (destello breve en el 6)


def _bolt(seed, x0, y0, y1):
    """Píxeles del rayo: una línea quebrada de (x0, y0) a y1 con una rama."""
    rnd = random.Random(seed)
    pts, x = [], x0
    for y in range(y0, y1):
        if y % 3 == 0:
            x += rnd.choice((-1, -1, 0, 1, 1, 2))
        pts.append((x, y))
    branch = []
    bx, by = pts[len(pts) // 3]
    for k in range(10):
        if k % 2 == 0:
            bx += 1
        by += 1
        branch.append((bx + k // 3, by))
    return pts, branch


def _fx_relampagos(sc):
    box = FX[0][1]
    sky = sc._sky.load()
    cover = _cover(sc).load()
    bolt, branch = _bolt(5, 30, 0, 32)

    def fn(t, i):
        lit = LIGHTNING[i]
        if not lit:
            return None, None

        def over(img, x0, y0):
            px = img.load()
            w, h = img.size
            for y in range(h):
                for x in range(w):
                    X, Y = x + x0, y + y0
                    if sky[X, Y] and not cover[X, Y]:
                        px[x, y] = sky_color(X, Y, lit)
        return None, over

    def glow(t, i):
        if LIGHTNING[i] < 1:
            return []
        out = []
        for x, y in bolt + branch:
            if 0 <= x < box[2] and sky[x, y]:
                out.append((x, y, BOLT[0]))
                for dx in (-1, 1):
                    if 0 <= x + dx < box[2] and sky[x + dx, y]:
                        out.append((x + dx, y, BOLT[1]))
        return out
    return fn, glow


def _fx_grietas(sc):
    """El pulso violeta recorre la grieta: cada píxel del núcleo se enciende según su distancia por la grieta y la fase."""
    box = FX[5][1]
    cover = _cover(sc).load()
    core = [(x, y) for x, y in sc._core if box[0] <= x < box[2] and box[1] <= y < box[3] and not cover[x, y]]
    mask = sc._chasm.load()
    L = len(core)

    def glow(t, i):
        out = []
        for n, (x, y) in enumerate(core):
            v = 0.5 + 0.5 * math.cos(2 * math.pi * (t - n / L * 2))
            v = 0.25 + 0.75 * v * v
            c = CORE_GLOW[2] if v > 0.8 else (CORE_GLOW[1] if v > 0.45 else CORE_GLOW[0])
            out.append((x, y, c))
            if v > 0.6:                                  # en el pico, la luz se sale al borde de la grieta
                for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                    X, Y = x + dx, y + dy
                    if mask[X, Y] and not cover[X, Y]:
                        out.append((X, Y, CORE_GLOW[0] if v < 0.85 else CORE_GLOW[1]))
                    elif not cover[X, Y] and v > 0.85:
                        out.append((X, Y, CORE_HALO))
        return out
    return None, glow


def _fx_ojos(sc):
    """Ojos rojos en las ventanas de la torre negra: cada par se abre, mira, parpadea y se cierra a su ritmo."""
    sp = sc._eye_tower
    left = EYE_TOWER[0] - sp.size[0] // 2
    top = EYE_TOWER[1] - sp.size[1] + 1
    wins = [(left + wx, top + wy, ww, wh) for wx, wy, ww, wh in sp.info['windows']]
    # 0 cerrado, 1 entornado, 2 abierto
    states = ((2, 2, 2, 0, 2, 2, 1, 1), (0, 1, 2, 2, 2, 2, 2, 1), (2, 1, 0, 0, 1, 2, 2, 2))

    def glow(t, i):
        out = []
        for k, (wx, wy, ww, wh) in enumerate(wins):
            st = states[k % len(states)][i]
            if not st:
                continue
            ey = wy + 1
            for ex in (wx, wx + ww - 2):
                out.append((ex, ey, EYE[0]))
                if st == 2:
                    out.append((ex + 1, ey, EYE[0]))
                    out.append((ex, ey + 1, EYE[1]))
                    out.append((ex + 1, ey + 1, EYE[1]))
                else:
                    out.append((ex + 1, ey, EYE[1]))
            if st == 2:
                for X in range(wx - 1, wx + ww + 1):
                    out.append((X, wy - 1, EYE[2]))
                    out.append((X, wy + wh, EYE[2]))
        return out
    return None, glow


def _fx_estandartes(sc):
    """Los estandartes ondean: la onda baja por la tela (un periodo por bucle)."""
    frames = {(k, i): banner((i / 8 + k * 0.5) % 1.0) for k in range(len(BANNERS)) for i in range(8)}

    def fn(t, i):
        return {f'banner{k}': frames[(k, i)] for k in range(len(BANNERS))}, None
    return fn, None


def _fx_brasero(k):
    """El fuego violeta del brasero `k`: lenguas que suben y cambian de forma, con su núcleo claro y una chispa."""
    return lambda sc: (None, _flames(k))


def _flames(k):
    def glow(t, i):
        out = []
        for bx, by in BRAZIERS[k:k + 1]:
            top = by - 10                       # la boca de la copa (fila de las ascuas)
            for j, dx in enumerate((-3, -2, -1, 0, 1, 2, 3)):
                ph = 2 * math.pi * (t * 2 + j * 0.37 + k * 0.5)
                hgt = 2 + (3 - abs(dx)) * 1.3 + 1.6 * (0.5 + 0.5 * math.sin(ph)) + (1 if (i + j + k) % 3 == 0 else 0)
                for y in range(int(hgt)):
                    u = y / max(1, hgt)
                    c = FLAME[3] if (u < 0.3 and abs(dx) <= 1) else (FLAME[2] if u < 0.55 and abs(dx) <= 2 else
                                                                      (FLAME[1] if u < 0.85 else FLAME[0]))
                    sway = int(round(0.8 * math.sin(ph + y * 0.6) * u))
                    out.append((bx + dx + sway, top - y, c))
            # chispa que sube
            sy = top - 6 - int(((t * 2 + k * 0.3) % 1.0) * 3)
            out.append((bx + (1 if k else -1), sy, FLAME[1]))
        return out
    return glow


@functools.lru_cache(maxsize=1)
def _build():
    sc = _scene()
    makers = {'map-fx-7-relampagos': _fx_relampagos, 'map-fx-7-estandartes': _fx_estandartes,
              'map-fx-7-brasero1': _fx_brasero(0), 'map-fx-7-brasero2': _fx_brasero(1), 'map-fx-7-ojos': _fx_ojos, 'map-fx-7-grietas': _fx_grietas}
    for name, box, n, fps in FX:
        fn, glow = makers[name](sc)
        if glow:
            mk.add_glow_fx(sc, name, box, n, fps, fn, glow)
        else:
            sc.add_fx(name, box, n, fps, fn)
    return sc.assets(ZONE)


def ASSETS():
    return {k: (list(v) if isinstance(v, list) else v) for k, v in _build().items()}
