"""
Mapa de papel del Chess Runner (el minimapa): el pergamino, el rastro de galletas, las paradas de los jefes y la huella
(`docs/personajes/ASSETS_SPEC.md`, «Mapa de papel (minimapa)» y «Forma fijada en P0»; `docs/personajes/HISTORIA.md`,
«Puntos del mapa» y «El mapa de papel»).

  - `paper-map-d0/d1/d2.png` (220×320): pergamino doblado en 2×3 paneles, bordes quemados y una ruta de tinta a trazos que
    serpentea de abajo (la panadería, donde empieza el viaje) a arriba (la torre del Rey), con los territorios de cada zona
    insinuados en tinta como en un mapa del tesoro (nogal, pradera con madriguera, palmera y ruina, mesetas del cañón,
    baobab, olas y torre). d0 limpio y crema; d1 gastado (amarillento, manchas, pliegues abiertos); d2 chamuscado (gris,
    hollín, más borde quemado y agujeros): la luz media baja de una variante a la siguiente, y en cada papel la parte de
    arriba (la guarida) ya está más oscura que la de abajo. El papel NO lleva dibujadas las galletas ni las paradas: las
    pinta la app encima, en las posiciones de `META['paper']`.
  - `cookie-board.png` (10×10, la galleta de la opción B: damero de 4×3 casillas chocolate/vainilla y canto),
    `cookie-board-empty.png` (la misma, apagada en gris) y `cookie-gold.png` (dorada y crema, rara).
  - `paper-stop-<jefe>-open.png` / `-locked.png` (20×20): la cara de cada jefe, que se reconoce por su silueta (la cola en «?»
    por encima de la cabeza de la ardilla, orejas largas del conejo, orejas redondas y antifaz del mono, cara larga con crin del caballo,
    orejazas y trompa del elefante, cabeza que asoma del caparazón de la tortuga, corona del rey); `locked` es esa misma
    silueta en tinta oscura con un «?».
  - `paper-marker.png` (12×12, 2 cuadros): la huella de la manada, que late (el 2.º cuadro, más clara y con anillo dorado).

Rastro: una galleta por checkpoint de patrón, en orden, con su `zone` ('1'…'7'). Reparto (HISTORIA, «Puntos del mapa»: un
checkpoint por patrón; el rescate y el campamento no cuentan): zonas 1–4, 6 cada una (5 patrones + el jefe); zonas 5–6, 5
(4 + el jefe); zona 7, 9 (6 puertas de repaso + mateIn4 + mateIn5 + el Rey) = 6·4 + 5·2 + 9 = 43. Cada parada va a la
ENTRADA de su zona (es el cartel del territorio: a progreso 0 la huella está en la primera parada) y detrás vienen sus
galletas; la última de cada zona es la del jefe (la app la pinta dorada) y queda justo antes de la parada siguiente.
"""
import functools
import math
import random

from map_nodes import COOKIE, GOLD, GOLD_DK, KING_LINE, LINE, edge, king, put
from pixel import C, layer

W, H = 220, 320
BOSSES = ('ardilla', 'conejo', 'mono', 'caballo', 'elefante', 'tortuga', 'rey')
ZONE_CHECKPOINTS = (6, 6, 6, 6, 5, 5, 9)
STOP, COOKIE_PX = 20, 10
STOP_GAP = 19        # de una parada a la galleta de al lado (por el camino): ni se pisan ni se separan de su zona
PAD = (20, 16)       # de la panadería a la primera parada y de la última galleta a la torre

# Puntos de control de la ruta (px del papel), de abajo (panadería) a arriba (torre): cinco pasadas que serpentean.
ROUTE = [(22, 300), (40, 292), (82, 298), (126, 288), (166, 294), (192, 276), (190, 250), (158, 236), (112, 244),
         (66, 234), (32, 218), (30, 190), (62, 174), (110, 182), (156, 170), (190, 152), (188, 124), (152, 110),
         (106, 118), (62, 108), (30, 90), (34, 62), (70, 48), (112, 56), (150, 44), (168, 34)]


# ---------------------------------------------------------------- la ruta y sus puntos


def _catmull(points, steps=40):
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(points[-1])
    return out


@functools.lru_cache(maxsize=1)
def route():
    """(puntos densos de la curva, longitud acumulada de cada uno)."""
    pts = _catmull(ROUTE)
    acc = [0.0]
    for a, b in zip(pts, pts[1:]):
        acc.append(acc[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return pts, acc


def at(s):
    pts, acc = route()
    s = max(0.0, min(acc[-1], s))
    lo, hi = 0, len(acc) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if acc[mid] <= s:
            lo = mid
        else:
            hi = mid
    seg = acc[hi] - acc[lo] or 1
    t = (s - acc[lo]) / seg
    return (pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t)


@functools.lru_cache(maxsize=1)
def layout():
    """(paradas, rastro) con su distancia por el camino: [(jefe, s)], [(zona, s)]."""
    total = route()[1][-1]
    gaps = 2 * len(BOSSES) - 1
    inner = sum(n - 1 for n in ZONE_CHECKPOINTS)
    sp = (total - sum(PAD) - gaps * STOP_GAP) / inner
    stops, trail, s = [], [], PAD[0]
    for z, (boss, n) in enumerate(zip(BOSSES, ZONE_CHECKPOINTS), start=1):
        stops.append((boss, s))
        s += STOP_GAP
        for k in range(n):
            trail.append((str(z), s))
            s += sp if k < n - 1 else STOP_GAP
    return stops, trail, sp


def _xy(s):
    x, y = at(s)
    return int(round(x)), int(round(y))


def paper_meta():
    stops, trail, _sp = layout()
    return {'stops': [dict(zip(('x', 'y'), _xy(s)), boss=b) for b, s in stops],
            'trail': [dict(zip(('x', 'y'), _xy(s)), zone=z) for z, s in trail]}


# ---------------------------------------------------------------- ruido determinista


class Noise:
    """Ruido de valor 2D suave (rejilla con interpolación), determinista por semilla."""

    def __init__(self, seed, cell):
        self.cell, self.cache = cell, {}
        self.seed = seed

    def _v(self, i, j):
        key = (i, j)
        if key not in self.cache:
            self.cache[key] = random.Random(self.seed * 1000003 + i * 7919 + j * 104729).random()
        return self.cache[key]

    def __call__(self, x, y):
        fx, fy = x / self.cell, y / self.cell
        i, j = int(math.floor(fx)), int(math.floor(fy))
        tx, ty = fx - i, fy - j
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a = self._v(i, j) + (self._v(i + 1, j) - self._v(i, j)) * tx
        b = self._v(i, j + 1) + (self._v(i + 1, j + 1) - self._v(i, j + 1)) * tx
        return a + (b - a) * ty


# ---------------------------------------------------------------- el papel

FOLD_X = (110,)
FOLD_Y = (107, 214)

# Por variante: tonos del pergamino (de claro a oscuro), tinta, quemado (profundidad mínima, amplitud), oscurecimiento
# hacia arriba, manchas y agujeros.
VARIANTS = (
    {'tones': ('#f6e7c1', '#efdcae', '#e6cf9b', '#dbc088', '#cdae74', '#b99662'),
     'ink': '#5a3a22', 'ink_soft': '#86603c', 'burn': (3, 5), 'top': 0.10, 'stains': 2, 'holes': 0, 'shift': 0.00,
     'char': ('#2a1a10', '#6a4428', '#a07444')},
    {'tones': ('#ead6a6', '#e0c890', '#d5b97e', '#c8a86c', '#b8955c', '#a07e4c'),
     'ink': '#4e321e', 'ink_soft': '#765634', 'burn': (5, 7), 'top': 0.16, 'stains': 5, 'holes': 0, 'shift': 0.16,
     'char': ('#22140c', '#5a3820', '#8e6438')},
    {'tones': ('#d2c4a6', '#c4b494', '#b4a282', '#a28e70', '#8c7a60', '#74644e'),
     'ink': '#3a281c', 'ink_soft': '#54422e', 'burn': (8, 10), 'top': 0.24, 'stains': 8, 'holes': 3, 'shift': 0.34,
     'char': ('#140c08', '#3a2618', '#6a4e34'), 'burn_bottom': 3},
)


def _paper_base(v, seed):
    """Pergamino: tono por píxel (manchas suaves, paneles de los pliegues, oscurecimiento arriba y en los bordes)."""
    cfg = VARIANTS[v]
    tones = [C(t) for t in cfg['tones']]
    big, small, burn_n = Noise(seed, 38), Noise(seed + 1, 9), Noise(seed + 2, 7)
    img = layer(W, H)
    px = img.load()
    rng = random.Random(seed + 3)
    stains = [(rng.randint(20, W - 20), rng.randint(20, H - 20), rng.randint(7, 16)) for _ in range(cfg['stains'])]
    holes = []
    hrng = random.Random(seed + 4)
    pts = route()[0]
    meta = paper_meta()
    boxes = [(x, y, x + len(rows[0]), y + len(rows)) for rows, x, y in VIGNETTES]
    boxes += [(p['x'] - STOP // 2, p['y'] - STOP // 2, p['x'] + STOP // 2, p['y'] + STOP // 2) for p in meta['stops']]
    while len(holes) < cfg['holes']:
        hx, hy, hr = hrng.randint(16, W - 16), hrng.randint(16, H - 16), hrng.uniform(2.5, 4.5)
        if min(math.hypot(hx - x, hy - y) for x, y in pts[::4]) <= 18:      # nunca sobre la ruta
            continue
        if any(x0 - hr - 6 < hx < x1 + hr + 6 and y0 - hr - 6 < hy < y1 + hr + 6 for x0, y0, x1, y1 in boxes):
            continue                                                       # ni sobre una viñeta o una parada
        holes.append((hx, hy, hr))
    amp_bottom = cfg.get('burn_bottom', cfg['burn'][1])
    for y in range(H):
        for x in range(W):
            # profundidad del quemado: distancia al borde, con las esquinas más comidas y un borde irregular
            d = min(x, y, W - 1 - x, H - 1 - y)
            corner = min(math.hypot(x - cx, y - cy) for cx, cy in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)))
            d = min(d, corner * 0.62)
            k = max(0.0, min(1.0, (y - (H - 48)) / 24))            # abajo (donde empieza la ruta) quema menos
            amp = cfg['burn'][1] + (amp_bottom - cfg['burn'][1]) * k
            depth = cfg['burn'][0] + amp * burn_n(x * 1.0, y * 1.0) + 2.2 * small(x * 3.0, y * 3.0)
            hole = min([math.hypot(x - hx, y - hy) - hr for hx, hy, hr in holes] or [99])
            if d < depth - 3 or hole < 0:
                continue                                  # quemado del todo: transparente
            if d < depth - 1.5 or hole < 1:
                px[x, y] = C(cfg['char'][0])
                continue
            if d < depth or hole < 2:
                px[x, y] = C(cfg['char'][1])
                continue
            # tono del papel (0 = claro … 1 = oscuro)
            t = 0.18 + 0.30 * big(x, y) + 0.10 * small(x, y)
            t += cfg['shift']
            t += cfg['top'] * (1 - y / H) * 1.4                     # más oscuro hacia la guarida (arriba)
            if d < depth + 6:
                t += 0.40 * (1 - (d - depth) / 6)                  # tostado junto al quemado
            if hole < 7:
                t += 0.35 * (1 - hole / 7)
            # paneles: cada uno con su propia luz (el papel estuvo doblado)
            col, row = (x >= FOLD_X[0]), sum(y >= f for f in FOLD_Y)
            t += (0.05 if (col + row) % 2 else -0.02) + 0.05 * ((x % 110) / 110 if col else 1 - (x % 110) / 110) * 0.6
            for sx, sy, sr in stains:
                ds = math.hypot(x - sx, (y - sy) * 1.2)
                if abs(ds - sr) < 1.1:
                    t += 0.16                                   # cerco de una mancha (café, agua)
                elif ds < sr:
                    t += 0.06
            # tramado de 2×2 entre tonos vecinos (pixel art, sin degradados suaves)
            q = max(0.0, min(0.999, t)) * (len(tones) - 1)
            i, frac = int(q), q - int(q)
            dither = ((x % 2) * 2 + (y % 2) * 3) % 4 / 4 + 0.125
            px[x, y] = tones[min(len(tones) - 1, i + (1 if frac > dither else 0))]
    return img


def _folds(img, v):
    """Pliegues: una línea oscura y otra clara al lado, con roturas donde el papel está gastado."""
    cfg = VARIANTS[v]
    px = img.load()
    dark, light = C(cfg['tones'][4]), C(cfg['tones'][0])
    rng = random.Random(70 + v)
    for fx in FOLD_X:
        for y in range(H):
            if px[fx, y][3] and px[fx, y] not in (C(c) for c in cfg['char']):
                worn = v and rng.random() < 0.06 * v
                px[fx, y] = light if worn else dark
                if px[fx + 1, y][3]:
                    px[fx + 1, y] = light
    for fy in FOLD_Y:
        for x in range(W):
            if px[x, fy][3]:
                worn = v and rng.random() < 0.06 * v
                px[x, fy] = light if worn else dark
                if px[x, fy + 1][3]:
                    px[x, fy + 1] = light


# ---------------------------------------------------------------- tinta


def _ink_grid(img, x0, y0, rows, pal):
    px = img.load()
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.' and 0 <= x0 + i < W and 0 <= y0 + j < H and px[x0 + i, y0 + j][3]:
                px[x0 + i, y0 + j] = pal[ch]


def _route_ink(img, ink):
    """La ruta impresa: trazos de 2 px (4 de tinta, 3 de hueco), de la panadería a la torre."""
    total = route()[1][-1]
    px = img.load()
    s = 0.0
    while s < total:
        if s % 7 < 4:
            x, y = at(s)
            for dx in (0, 1):
                for dy in (0, 1):
                    xx, yy = int(x) + dx - 1, int(y) + dy - 1
                    if 0 <= xx < W and 0 <= yy < H and px[xx, yy][3]:
                        px[xx, yy] = ink
        s += 0.5


# Viñetas de tinta: '#' tinta fuerte, '+' tinta suave. Cada una en el hueco de su tramo de ruta (no tocan la ruta).
BAKERY = ['..........##..',      # la panadería, donde empieza el viaje
          '....####..##..',
          '...#++++#.##..',
          '..#++++++###..',
          '.#++++++++++#.',
          '##############',
          '.#..........#.',
          '.#.###..##..#.',
          '.#.#+#..##..#.',
          '.#.#+#......#.',
          '.#.#+#......#.',
          '##############']
TREE = ['....#####....',          # zona 1: nogales
        '..##+++++##..',
        '.#+++#+++++#.',
        '#+++++++#+++#',
        '#++#++++++++#',
        '#++++++#+++#.',
        '.##+++++++##.',
        '...###+###...',
        '.....#+#.....',
        '.....#+#.....',
        '....#++#.....',
        '...##..##....']
BURROW = ['....####....',         # zona 2: madriguera, zanahoria, hierba y cerca baja
          '..##++++##..',
          '.#++####++#.',
          '#++#....#++#',
          '############']
CARROT = ['...#.#',
          '....##',
          '...##.',
          '..#+#.',
          '.#+#..',
          '#+#...',
          '##....']
GRASS = ['#.#..#.#',
         '.#.#.#.#']
FENCE = ['#...#...#...#',
         '#############',
         '#...#...#...#',
         '#############',
         '#...#...#...#']
PALM = ['..###...###...',         # zona 3: palmeras y ruina de piedra
        '.#...#.#...#..',
        '#.....###....#',
        '.....#.#.#....',
        '....#..#..#...',
        '.......#......',
        '.......#......',
        '......#.......',
        '......#.......',
        '.....###......']
RUIN = ['.....###.....',
        '....#+++#....',
        '...#######...',
        '...#+#+#+#...',
        '..#########..',
        '..#+#+#+#+#..',
        '.###########.']
MESA = ['............######..',   # zona 4: mesetas del cañón
        '..######....#++++#..',
        '..#++++#...#+++++#..',
        '.#+++++##..#++++++#.',
        '.#++++++#.#+++++++#.',
        '#++++++++##++++++++#',
        '####################']
BAOBAB = ['#.#..#..#.#..',        # zona 5: baobab y huesos
          '.##.###.##...',
          '..#######....',
          '....#+#......',
          '....#+#......',
          '...#+++#.....',
          '...#+++#.....',
          '..#+++++#....',
          '.#########...']
BONES = ['#..#',
         '.##.',
         '.##.',
         '#..#']
WAVES = ['.##....##....##.',      # zona 6: olas y juncos
         '#..#..#..#..#..#',
         '....##....##....']
REEDS = ['#.#..',
         '#.#.#',
         '#.#.#',
         '.##.#',
         '.###.']
TOWER = ['..#.#.#.#.#..',         # zona 7: torre del Rey (con su banderín), tablero roto y rayos
         '..#########..',
         '...#+++++#...',
         '...#+###+#...',
         '...#+#.#+#...',
         '...#+++++#...',
         '...#+++++#...',
         '...#++#++#...',
         '...#+++++#...',
         '..##+###+##..',
         '..#++#.#++#..',
         '..#++#.#++#..',
         '..#+++++++#..',
         '.#+++++++++#.',
         '#############']
FLAG = ['#...',
        '###.',
        '#++#',
        '###.',
        '#...',
        '#...']
BOARD = ['#########',
         '#+.+.+.+#',
         '#.+.+.+.#',
         '#+.+.+.#.',
         '#.+.+.#..',
         '#+.+.#...',
         '#####....']
LIGHTNING = ['..#',
             '.#.',
             '##.',
             '.#.',
             '#..']

# (plantilla, x, y): esquina superior izquierda en px del papel.
VIGNETTES = [(BAKERY, 17, 266),
             (TREE, 58, 255), (TREE, 88, 262), (GRASS, 112, 274),
             (BURROW, 136, 268), (CARROT, 158, 258), (GRASS, 126, 258), (FENCE, 150, 220), (GRASS, 166, 218),
             (PALM, 46, 192), (RUIN, 66, 206), (PALM, 88, 196),
             (MESA, 36, 140), (MESA, 82, 148), (GRASS, 64, 130),
             (BAOBAB, 132, 134), (BONES, 150, 152),
             (WAVES, 56, 76), (WAVES, 90, 86), (REEDS, 126, 80), (REEDS, 50, 84),
             (TOWER, 172, 20), (FLAG, 178, 14), (BOARD, 150, 72), (LIGHTNING, 190, 60), (LIGHTNING, 172, 86)]


def paper(v):
    img = _paper_base(v, 1200 + v * 17)
    _folds(img, v)
    cfg = VARIANTS[v]
    pal = {'#': C(cfg['ink']), '+': C(cfg['ink_soft'])}
    for rows, x, y in VIGNETTES:
        _ink_grid(img, x, y, rows, pal)
    _route_ink(img, C(cfg['ink']))
    return img


# ---------------------------------------------------------------- galletas

COOKIE_ROWS = ['.LLLLLLLL.',
               'LhvccvvccL',
               'LvvccvvccL',
               'LccvvccvvL',
               'LccvvccvvL',
               'LvvccvvccL',
               'LvvccvvccL',
               'LrrrrrrrrL',
               'LRRRRRRRRL',
               '.LLLLLLLL.']


def _cookie(pal):
    img = layer(COOKIE_PX, COOKIE_PX)
    for j, row in enumerate(COOKIE_ROWS):
        for i, ch in enumerate(row):
            if ch != '.':
                put(img, i, j, pal[ch])
    return img


def cookie_board():
    return _cookie({'L': LINE, 'h': COOKIE['hi'], 'v': COOKIE['van'], 'c': COOKIE['choc'], 'r': C('#9a5a34'),
                    'R': COOKIE['rim']})


def cookie_empty():
    return _cookie({'L': C('#5c5852'), 'h': C('#d4d0c8'), 'v': C('#c2beb6'), 'c': C('#9a968e'), 'r': C('#8a867e'),
                    'R': C('#76726a')})


def cookie_gold():
    return _cookie({'L': LINE, 'h': C('#ffffff'), 'v': C('#fff4d6'), 'c': GOLD, 'r': C('#e8a82a'), 'R': GOLD_DK})


# ---------------------------------------------------------------- caras de los jefes


def ell(img, cx, cy, rx, ry, col):
    for y in range(img.height):
        for x in range(img.width):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                put(img, x, y, col)


def tri(img, pts, col):
    (x0, y0), (x1, y1), (x2, y2) = pts
    for y in range(img.height):
        for x in range(img.width):
            px_, py_ = x + 0.5, y + 0.5
            d1 = (px_ - x1) * (y0 - y1) - (x0 - x1) * (py_ - y1)
            d2 = (px_ - x2) * (y1 - y2) - (x1 - x2) * (py_ - y2)
            d3 = (px_ - x0) * (y2 - y0) - (x2 - x0) * (py_ - y0)
            if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                put(img, x, y, col)


def eyes(img, y, xs=(6, 12), col=C('#1e1410')):
    for x in xs:
        for dx in (0, 1):
            put(img, x + dx, y, col)
            put(img, x + dx, y + 1, col)
        put(img, x, y, C('#ffffff'))


def face_ardilla():
    """Cabeza redonda y naranja delante de una cola grande que sube por la derecha y se curva por encima (la «?» de la
    ardilla). Orejas bajas y redondas con un mechón que asoma 1 px; el crema solo en el hocico y lo único blanco, las paletas."""
    img = layer(STOP, STOP)
    o, od, cr, cheek = C('#c8682a'), C('#94481a'), C('#f6e2b4'), C('#e8a868')
    tail, tail_hi, tail_dk, tuft = C('#b05a24'), C('#e08a44'), C('#8a4218'), C('#4a2414')
    ell(img, 15.2, 10.5, 4.2, 8.0, tail)                      # la cola: columna derecha entera…
    ell(img, 11.5, 3.2, 5.2, 3.0, tail)                       # …que se curva por encima de la cabeza
    for x, y in ((18, 6), (18, 7), (18, 8), (18, 9), (18, 10), (18, 11), (18, 12), (18, 13), (17, 3), (17, 4), (17, 5),
                 (16, 2), (16, 3), (15, 1), (14, 1), (13, 1), (12, 1), (11, 1), (10, 1), (9, 2), (8, 2), (17, 14),
                 (17, 15), (17, 16)):
        put(img, x, y, tail_hi)                               # luz en el borde exterior (esponjosa)
    for x, y in ((15, 9), (15, 10), (15, 11), (15, 12), (15, 13), (16, 7), (16, 8), (15, 5), (14, 4), (13, 4), (12, 4),
                 (11, 4)):
        put(img, x, y, tail_dk)                               # el rizo de la cola, por dentro
    hx, hy, ecy = 7.5, 12.2, 5.6
    ell(img, hx, hy, 7.0, 6.0, LINE)                          # contorno de la cabeza y las orejas sobre la cola
    for ex in (hx - 3.6, hx + 3.6):
        ell(img, ex, ecy, 2.7, 3.4, LINE)
    for ex in (hx - 3.6, hx + 3.6):
        ell(img, ex, ecy, 1.7, 2.4, od)                       # orejas bajas y redondas
        put(img, int(ex), 5, cheek)
        put(img, int(ex), 6, cheek)
    ell(img, hx, hy, 6.0, 5.0, o)
    for ex in (hx - 3.6, hx + 3.6):
        put(img, int(ex), 1, tuft)                            # mechón: asoma 1 px por encima de la oreja
        put(img, int(ex), 2, tuft)
    ell(img, hx - 4.2, hy + 1.6, 1.5, 1.3, cheek)            # mofletes
    ell(img, hx + 4.2, hy + 1.6, 1.5, 1.3, cheek)
    ell(img, hx, hy + 3.0, 2.4, 1.8, cr)                      # hocico pequeño
    eyes(img, 10, xs=(4, 9))
    for x in (7, 8):
        put(img, x, 13, C('#5a2414'))                         # nariz
        put(img, x, 16, C('#ffffff'))                         # paletas
        put(img, x, 17, C('#ffffff'))
    return edge(img, LINE)


def face_conejo():
    img = layer(STOP, STOP)
    w, sh, pk = C('#f4f0ea'), C('#c8beb8'), C('#ff9cc0')
    ell(img, 6.5, 4.5, 1.9, 4.6, w)
    ell(img, 12.5, 4.5, 1.9, 4.6, w)
    for y in range(2, 8):
        put(img, 6, y, pk)
        put(img, 13, y, pk)
    ell(img, 9.5, 12.5, 6.2, 5.4, w)
    ell(img, 9.5, 15.5, 4.5, 2.0, sh)
    ell(img, 9.5, 14.8, 3.2, 1.6, w)
    eyes(img, 11, xs=(6, 12))
    put(img, 9, 14, pk)
    put(img, 10, 14, pk)
    put(img, 9, 16, C('#8a6a64'))
    put(img, 10, 16, C('#8a6a64'))
    for x, y in ((3, 13), (4, 14), (16, 13), (15, 14)):
        put(img, x, y, sh)                                   # bigotes
    return edge(img, LINE)


def face_mono():
    img = layer(STOP, STOP)
    br, bd, sk = C('#8a5a34'), C('#5e3a20'), C('#f0c896')
    ell(img, 3.0, 10.5, 2.6, 2.8, br)
    ell(img, 16.0, 10.5, 2.6, 2.8, br)
    ell(img, 3.0, 10.5, 1.2, 1.4, sk)
    ell(img, 16.0, 10.5, 1.2, 1.4, sk)
    ell(img, 9.5, 10.0, 6.4, 7.0, br)
    for x in range(6, 14):
        put(img, x, 3, bd)                                   # flequillo
    put(img, 9, 2, bd)
    put(img, 10, 2, bd)
    ell(img, 7.2, 9.5, 2.6, 2.6, sk)                         # antifaz en corazón
    ell(img, 11.8, 9.5, 2.6, 2.6, sk)
    ell(img, 9.5, 13.6, 4.4, 3.2, sk)
    eyes(img, 9, xs=(6, 12))
    put(img, 8, 13, bd)
    put(img, 11, 13, bd)
    for x in range(7, 13):
        put(img, x, 15, bd)                                  # sonrisa
    put(img, 6, 14, bd)
    put(img, 13, 14, bd)
    return edge(img, LINE)


def face_caballo():
    img = layer(STOP, STOP)
    br, bd, mz, mane = C('#a8683c'), C('#7a4826'), C('#d8a878'), C('#3a2216')
    tri(img, ((5, 6), (6, 0), (8, 5)), br)
    tri(img, ((14, 6), (13, 0), (11, 5)), br)
    ell(img, 9.5, 9.0, 5.0, 6.6, br)
    ell(img, 9.5, 14.5, 4.4, 4.0, mz)                        # hocico largo y claro
    for y in range(4, 12):
        put(img, 9, y, C('#fff4e4'))                         # lucero (franja blanca)
        put(img, 10, y, C('#fff4e4'))
    for x, y in ((8, 1), (9, 1), (10, 1), (9, 2), (10, 2), (11, 2), (10, 3), (11, 3), (8, 2), (7, 2), (11, 1)):
        put(img, x, y, mane)                                 # tupé de la crin
    eyes(img, 8, xs=(5, 13))
    for x in (7, 12):
        put(img, x, 16, bd)                                  # ollares
        put(img, x, 15, bd)
    return edge(img, LINE)


def face_elefante():
    img = layer(STOP, STOP)
    g, gd, pk, tusk = C('#a4aab4'), C('#7a808c'), C('#e8b0b8'), C('#fffaf0')
    ell(img, 3.6, 8.5, 3.4, 5.4, gd)                          # orejazas
    ell(img, 15.4, 8.5, 3.4, 5.4, gd)
    ell(img, 3.8, 8.5, 2.0, 3.8, pk)
    ell(img, 15.2, 8.5, 2.0, 3.8, pk)
    ell(img, 9.5, 8.0, 5.0, 5.4, g)
    for y in range(11, 18):
        for x in (9, 10):
            put(img, x, y, g)                                 # trompa
    put(img, 11, 17, g)
    put(img, 11, 18, g)
    put(img, 12, 17, g)
    for y in range(14, 16):
        put(img, 9, y, gd)
    put(img, 7, 13, tusk)
    put(img, 7, 14, tusk)
    put(img, 12, 13, tusk)
    put(img, 12, 14, tusk)
    eyes(img, 7, xs=(6, 12))
    return edge(img, LINE)


def face_tortuga():
    img = layer(STOP, STOP)
    gr, gd, sh, shd, shl = C('#7cc05a'), C('#4e8a38'), C('#a07a34'), C('#6e5020'), C('#d0a050')
    ell(img, 9.5, 19.5, 9.0, 8.0, sh)                         # caparazón en cúpula
    for x, y in ((4, 15), (5, 14), (6, 14), (7, 15), (12, 15), (13, 14), (14, 14), (15, 15), (9, 17), (10, 17),
                 (8, 18), (11, 18), (3, 18), (16, 18), (2, 17), (17, 17)):
        put(img, x, y, shd)                                   # placas
    for x, y in ((5, 13), (6, 13), (13, 13), (14, 13), (3, 15), (16, 15)):
        put(img, x, y, shl)
    ell(img, 9.5, 8.0, 5.4, 5.6, gr)                          # la cabeza asoma por delante
    for x in range(7, 13):
        put(img, x, 13, gr)
        put(img, x, 14, gd)                                   # cuello
    eyes(img, 6, xs=(6, 12))
    for x in range(8, 12):
        put(img, x, 10, gd)                                   # sonrisa
    put(img, 7, 9, gd)
    put(img, 12, 9, gd)
    return edge(img, LINE)


FACES = {'ardilla': face_ardilla, 'conejo': face_conejo, 'mono': face_mono, 'caballo': face_caballo,
         'elefante': face_elefante, 'tortuga': face_tortuga, 'rey': king}

QMARK = ['.###.',
         '#...#',
         '...#.',
         '..#..',
         '.....',
         '..#..']


def silhouette(img):
    """La misma silueta de la cara en tinta oscura (su contorno casi negro, sin engordarla) con un «?» claro en medio."""
    out = layer(STOP, STOP)
    src, px = img.load(), out.load()
    for y in range(STOP):
        for x in range(STOP):
            if src[x, y][3] == 255:                           # el halo translúcido del rey no cuenta
                px[x, y] = C('#1a1210') if src[x, y] in (LINE, KING_LINE) else C('#4a3a34')
    box = img.getbbox()
    cy = (box[1] + box[3]) // 2 - 2
    for j, row in enumerate(QMARK):
        for i, ch in enumerate(row):
            if ch == '#':
                put(out, 8 + i, cy + j - 1, C('#f6e7c1'))
    return out


# ---------------------------------------------------------------- huella


PAW = ['..TT..TT..',
       '..TT..TT..',
       'TT......TT',
       'TT..PP..TT',
       '...PPPP...',
       '..PPPPPP..',
       '..PPPPPP..',
       '...PP.PP..']


def marker(lit):
    img = layer(12, 12)
    fill = C('#ff6a5a') if lit else C('#e0453c')
    hi = C('#ffb0a0') if lit else C('#ff8a70')
    for j, row in enumerate(PAW):
        for i, ch in enumerate(row):
            if ch != '.':
                put(img, 1 + i, 2 + j, fill)
    for x, y in ((3, 2), (7, 2), (5, 6), (1, 4)):
        put(img, x, y, hi)
    edge(img, LINE)
    if lit:
        edge(img, GOLD)
    return img


# ---------------------------------------------------------------- export


@functools.lru_cache(maxsize=1)
def _assets():
    out = {f'paper-map-d{v}': paper(v) for v in range(3)}
    out['cookie-board'] = cookie_board()
    out['cookie-board-empty'] = cookie_empty()
    out['cookie-gold'] = cookie_gold()
    for boss in BOSSES:
        face = FACES[boss]()
        out[f'paper-stop-{boss}-open'] = face
        out[f'paper-stop-{boss}-locked'] = silhouette(face)
    out['paper-marker'] = [marker(False), marker(True)]
    return out


def ASSETS():
    return {k: [f.copy() for f in v] if isinstance(v, list) else v.copy() for k, v in _assets().items()}


META = {'paper': paper_meta()}
