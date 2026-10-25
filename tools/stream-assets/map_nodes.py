"""
Nodos del mapa del Chess Runner: los puntos sobre el camino, el candado del ELO mínimo y el puntito del camino
(`docs/personajes/ASSETS_SPEC.md`, «Puntos (nodos)»).

  - `map-node-<kind>-<estado>.png`, cuadros de 20×20. Cada tipo se reconoce por su silueta, no solo por el color:
      pattern  galleta-tablero redonda (damero chocolate/vainilla con canto), la más pequeña
      boss     disco rojo grande con calavera: el jefe de zona
      rescue   huella de perro (almohadillas crema): rescatar a uno de la manada
      camp     tienda de campaña naranja con banderín
      door     puerta en arco de piedra y madera, con cerradura violeta (guarida del Rey, zona 7)
      king     cabeza de sombra con corona negra y ojos violeta, y un halo lila fijo: el más imponente
  - Estados: `locked` (gris y oscuro, con un candadito), `open` (2 cuadros: el 2.º con halo blanco), `current` (2 cuadros:
    anillo dorado / blanco y dorado que pulsa), `done` (con una marca verde) y, en `pattern`/`boss`, `done1`–`done3`
    (tres ranuras de estrella abajo: doradas las ganadas, apagadas las que faltan).
  - `map-lock.png` (12×14, candado sin número: el número lo escribe la app) y `map-path-dot.png` (4×4, pendiente y recorrido).

Contorno oscuro de 1 px y relleno claro en todo, para leerse del bosque luminoso (zona 1) a la guarida casi negra (zona 7).
"""
import functools

from PIL import Image

from pixel import C, layer

N = 20
KINDS = ('pattern', 'boss', 'rescue', 'camp', 'door', 'king')
STARRED = ('pattern', 'boss')
LINE = C('#2a1c18')       # contorno de casi todo (marrón muy oscuro, como el de los troncos de las zonas)
KING_LINE = C('#0c0612')

COOKIE = {'van': C('#f6e2b4'), 'choc': C('#7a4628'), 'rim': C('#5a3220'), 'hi': C('#fff4d6')}
BOSS = {'fill': C('#e0453c'), 'dark': C('#a82a2a'), 'hi': C('#ff8a70'), 'bone': C('#fff6ea'), 'eye': C('#3a0e12')}
PAW = {'fill': C('#fff0dc'), 'shade': C('#f0c8b4'), 'pink': C('#ff9cc0')}
TENT = {'fill': C('#f28c38'), 'hi': C('#ffc070'), 'dark': C('#b85a22'), 'door': C('#4a2414'), 'pole': C('#6a4630'),
        'flag': C('#ff5a6a')}
DOOR = {'stone': C('#b4b0c4'), 'stone_dk': C('#8a84a0'), 'wood': C('#c08048'), 'wood_dk': C('#8e5630'),
        'key': C('#c070ff'), 'knob': C('#ffd23a')}
KING = {'head': C('#3a1a5a'), 'head_hi': C('#6a34a0'), 'crown': C('#1a0d26'), 'crown_hi': C('#9a5ae0'),
        'gem': C('#ff6fe0'), 'eye': C('#ff3c3c'), 'halo': C('#c58aff', 150)}
GOLD, GOLD_DK, WHITE = C('#ffd23a'), C('#c08a1a'), C('#ffffff')
STAR_OFF = C('#9a9488')
CHECK = {'fill': C('#3cc060'), 'mark': C('#ffffff')}
LOCK = {'body': C('#c2c6d0'), 'hi': C('#eef0f4'), 'dark': C('#7c8290'), 'hole': C('#2a2a34')}


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def grid(img, x0, y0, rows, pal):
    """Pinta una plantilla ASCII: cada letra es una clave de `pal`, '.' es transparente."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                put(img, x0 + i, y0 + j, pal[ch])


def disc(img, cx, cy, r, color_at):
    """Disco de radio `r` centrado en (cx, cy); `color_at(x, y, d)` da el color de cada píxel (d = distancia al centro)."""
    for y in range(img.height):
        for x in range(img.width):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= r:
                put(img, x, y, color_at(x, y, d))


def edge(img, col, alpha_min=1):
    """Contorno de 1 px (4 vecinos) dentro del mismo lienzo, alrededor de lo opaco."""
    px = img.load()
    w, h = img.size
    ring = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0 and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] >= alpha_min
                                        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                ring.append((x, y))
    for x, y in ring:
        px[x, y] = col
    return img


def over(base, top, x=0, y=0):
    base.alpha_composite(top, (x, y))
    return base


# ---------------------------------------------------------------- iconos base (sin estado), con su contorno


def cookie():
    img = layer(N, N)

    def col(x, y, d):
        if d > 5.6 or y >= 15:
            return COOKIE['rim']          # canto (más grueso abajo: la galleta tiene grosor)
        cell = ((x - 4) // 3 + (y - 4) // 3) % 2
        return COOKIE['van'] if cell == 0 else COOKIE['choc']
    disc(img, 9.5, 9.5, 6.6, col)
    put(img, 7, 6, COOKIE['hi'])
    put(img, 6, 7, COOKIE['hi'])
    return edge(img, LINE)


def boss():
    img = layer(N, N)

    def col(x, y, d):
        if d > 7.2 and y > 10:
            return BOSS['dark']
        if d < 6.5 and (x - 6) ** 2 + (y - 5) ** 2 < 5:
            return BOSS['hi']
        return BOSS['fill']
    disc(img, 9.5, 9.5, 8.3, col)
    grid(img, 6, 5, ['.WWWWWW.',
                     'WWWWWWWW',
                     'WeeWWeeW',
                     'WeeWWeeW',
                     'WWWeeWWW',
                     '.WWWWWW.',
                     '.WeWWeW.'], {'W': BOSS['bone'], 'e': BOSS['eye']})
    return edge(img, LINE)


def paw():
    img = layer(N, N)
    pal = {'F': PAW['fill'], 'S': PAW['shade'], 'P': PAW['pink']}
    grid(img, 3, 4, ['...FFF..FFF...',
                     '...FPF..FPF...',
                     'FFF.FF..FF.FFF',
                     'FPF........FPF',
                     'FFF...FF...FFF',
                     '.....FFFF.....',
                     '....FFPPFF....',
                     '...FFPPPPFF...',
                     '...FPPPPPPF...',
                     '...FFFFFFFF...',
                     '....SS..SS....'], pal)
    return edge(img, LINE)


def tent():
    img = layer(N, N)
    pal = {'F': TENT['fill'], 'H': TENT['hi'], 'D': TENT['dark'], 'O': TENT['door'], 'p': TENT['pole'],
           'f': TENT['flag']}
    grid(img, 2, 2, ['.......pff......',
                     '.......pfff.....',
                     '.......p........',
                     '.......F........',
                     '......HFD.......',
                     '.....HFFFD......',
                     '....HFFOFFD.....',
                     '....HFFOFFD.....',
                     '...HFFOOOFFD....',
                     '...HFFOOOFFD....',
                     '..HFFOOOOOFFD...',
                     '.HFFFOOOOOFFFD..',
                     '.HFFOOOOOOOFFD..',
                     'DDDDDDDDDDDDDDD.'], pal)
    return edge(img, LINE)


def door():
    img = layer(N, N)
    pal = {'S': DOOR['stone'], 's': DOOR['stone_dk'], 'W': DOOR['wood'], 'w': DOOR['wood_dk'], 'K': DOOR['key'],
           'k': DOOR['knob']}
    grid(img, 4, 2, ['....SSSS....',
                     '..SSsSSsSS..',
                     '.SSWWwWWwSS.',
                     '.SWWWwWWwWS.',
                     'SsWWWwWWwWsS',
                     'SSWWWwWWwWSS',
                     'SSWWWwWWwWSS',
                     'SsWWWKKWwWsS',
                     'SSWWWKKWwkSS',
                     'SSWWWwKWwWSS',
                     'SsWWWwWWwWsS',
                     'SSWWWwWWwWSS',
                     'SSWWWwWWwWSS',
                     'SsWWWwWWwWsS',
                     'SSSSSSSSSSSS'], pal)
    return edge(img, LINE)


def king():
    img = layer(N, N)

    def col(x, y, d):
        return KING['head_hi'] if d > 5.4 and x < 9 and y < 13 else KING['head']
    disc(img, 9.5, 12.0, 6.6, col)
    grid(img, 3, 1, ['G.....GG.....G',
                     'C....CCCC....C',
                     'CC..CCCCCC..CC',
                     'CCCCCCHHCCCCCC',
                     'CCHCCCCCCCCHCC',
                     'hhhhhhhhhhhhhh'], {'G': KING['gem'], 'C': KING['crown'], 'H': KING['gem'],
                                         'h': KING['crown_hi']})
    # ojos encendidos y boca de sombra
    for x, y in ((6, 11), (7, 11), (12, 11), (13, 11), (7, 12), (12, 12)):
        put(img, x, y, KING['eye'])
    for x in range(8, 12):
        put(img, x, 15, KING['crown'])
    edge(img, KING_LINE)
    return edge(img, KING['halo'])       # halo lila fijo: el negro solo se perdería en la guarida


BASES = {'pattern': cookie, 'boss': boss, 'rescue': paw, 'camp': tent, 'door': door, 'king': king}


# ---------------------------------------------------------------- estados


def gray(img, dark=0.42, lift=50):
    """Versión apagada: gris azulado y oscuro (el contorno sigue casi negro)."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b, a) in (LINE, KING_LINE):
                px[x, y] = (30, 30, 38, 255)        # el contorno sigue oscuro: la silueta se lee igual
            elif a:
                lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
                v = int(lum * dark + lift)
                px[x, y] = (v, v, min(255, v + 10), a if a == 255 else a // 2)
    return out


def mini_lock():
    img = layer(7, 8)
    grid(img, 0, 0, ['.LLLLL.',
                     '.L...L.',
                     'LLLLLLL',
                     'LBBBBBL',
                     'LBBhBBL',
                     'LBBhBBL',
                     'LBBBBBL',
                     'LLLLLLL'], {'L': LINE, 'B': GOLD, 'h': LINE})
    return img


def mini_check():
    img = layer(7, 7)
    grid(img, 0, 0, ['.LLLLL.',
                     'LGGGGML',
                     'LGGGMGL',
                     'LMGMGGL',
                     'LGMGGGL',
                     'LGGGGGL',
                     '.LLLLL.'], {'L': LINE, 'G': CHECK['fill'], 'M': CHECK['mark']})
    return img


def star(on):
    """Estrella de 7×7 con contorno: dorada si se ganó, gris clara si falta (se cuenta a 1×)."""
    img = layer(7, 7)
    fill, hi = (GOLD, C('#fff6b0')) if on else (STAR_OFF, STAR_OFF)
    grid(img, 0, 0, ['...L...',
                     '..LhL..',
                     'LLLFLLL',
                     'LFFFFFL',
                     '.LFFFL.',
                     '.LFLFL.',
                     '.LL.LL.'], {'L': LINE, 'F': fill, 'h': hi})
    return img


def stars(img, n):
    out = img.copy()
    for i in range(3):
        over(out, star(i < n), i * 6 + 1, 13)
    return out


def ring(img, inner, outer=None):
    """Anillo que sigue la silueta: 1 px de `inner` y, si cabe, otro de `outer` por fuera."""
    out = img.copy()
    edge(out, inner)
    if outer is not None:
        edge(out, outer)
    return out


def states(kind):
    base = BASES[kind]()
    got = {
        'locked': [over(gray(base), mini_lock(), 13, 12)],
        # Sobre la arena clara del camino (zonas 1–2) el blanco translúcido y el dorado `#ffd23a` casi no se distinguen y
        # `current` latía menos que `open` (auditoría P8-r1): blanco opaco en `open`, y en `current` un anillo exterior dorado
        # oscuro en el cuadro 0 para que los dos anillos cambien de luz al latir.
        'open': [base, ring(base, WHITE)],
        'current': [ring(base, GOLD, GOLD_DK), ring(base, WHITE, GOLD)],
    }
    if kind in STARRED:
        for n in (1, 2, 3):
            got[f'done{n}'] = [stars(base, n)]
    else:
        got['done'] = [over(base.copy(), mini_check(), 13, 13)]
    return got


def lock():
    img = layer(12, 14)
    grid(img, 0, 0, ['...LLLLLL...',
                     '..LDDDDDDL..',
                     '.LDLLLLLLDL.',
                     '.LDL....LDL.',
                     '.LDL....LDL.',
                     'LLLLLLLLLLLL',
                     'LHHHHHHHHHHL',
                     'LHBBBBBBBBDL',
                     'LHBBBooBBBDL',
                     'LHBBBooBBBDL',
                     'LHBBBBoBBBDL',
                     'LHBBBBBBBBDL',
                     'LDDDDDDDDDDL',
                     'LLLLLLLLLLLL'], {'L': LINE, 'D': LOCK['dark'], 'H': LOCK['hi'], 'B': LOCK['body'],
                                       'o': LOCK['hole']})
    return img


def path_dot(done):
    img = layer(4, 4)
    fill = (GOLD, C('#fff2a0')) if done else (C('#f4ecdc'), C('#ffffff'))
    grid(img, 0, 0, ['.LL.',
                     'LhFL',
                     'LFFL',
                     '.LL.'], {'L': C('#2a1c18', 220), 'F': fill[0], 'h': fill[1]})
    return img


@functools.lru_cache(maxsize=1)
def _assets():
    out = {}
    for kind in KINDS:
        for state, frames in states(kind).items():
            out[f'map-node-{kind}-{state}'] = frames
    out['map-lock'] = lock()
    out['map-path-dot'] = [path_dot(False), path_dot(True)]
    return out


def ASSETS():
    return {k: [f.copy() for f in v] if isinstance(v, list) else v.copy() for k, v in _assets().items()}


META = {'nodes': {
    'size': N,
    'kinds': list(KINDS),
    'states': {k: ['locked', 'open', 'current'] + (['done1', 'done2', 'done3'] if k in STARRED else ['done'])
               for k in KINDS},
    'pulse': ['open', 'current'],
}}
