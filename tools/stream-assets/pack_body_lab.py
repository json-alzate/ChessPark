"""
Cuerpo compartido de la familia «lab» de la manada (Tormenta, Tony…): el mismo estilo de mascota que Choco (`dog.py`:
cabezón, patitas cortas, lengua afuera, contorno de 1 px con `outlined()`), pero parametrizado por **paleta** (`LabPalette`)
y **rasgos** (`LabTraits`: forma de oreja, pelo corto o largo con flecos, pecho, cola, largo de patas y de hocico, etc.).

Un perro nuevo de la familia es una paleta y unos rasgos; las poses (de pie/corriendo, salto, choque, sentado, contento)
salen de aquí. Los sprites miran a la derecha y los pies quedan abajo (fila `GY` del lienzo).

Medidas: lienzo de pie de `W`×`H` (52×42 con el contorno): el ancho de Choco (50 → 52) y 2 filas más arriba para la
oreja y el bote del salto. Como Choco, la cabeza es grande (18×16 o más, ≥ 40 % del alto de pie), las patas cortas y
gruesas (4–5 px de grueso, 10–11 de largo) y el tronco corto (`trunk` corre el pecho y la cabeza hacia el anca). Al correr
la oreja va tumbada hacia atrás, pegada a la nuca, y el perro no pasa de unas 36 filas, como Choco (31–34).

Contrato: `docs/personajes/ASSETS_SPEC.md`. Python 3.9: nada de `X | Y` en los tipos.
"""
from dataclasses import dataclass

from PIL import ImageDraw

from pixel import C, R, layer, outlined

W, H = 50, 40
GY = 39          # fila del suelo (la base de las patas) en el lienzo de pie
SIT_W, SIT_H = 44, 40


@dataclass(frozen=True)
class LabPalette:
    body: tuple
    light: tuple        # reflejo del lomo y de la frente
    dark: tuple         # patas del lado lejano y sombra del vientre
    ear: tuple
    ear_fold: tuple     # la parte de la oreja que se dobla
    ear_light: tuple    # el canto del doblez, que coge la luz
    tail: tuple
    muzzle: tuple
    muzzle_light: tuple
    nose: tuple
    chest: tuple        # garganta y pecho (crema o blanco)
    chest_shade: tuple
    paw: tuple          # base de las patas cercanas
    paw_far: tuple      # base de las patas lejanas
    collar: tuple
    collar_edge: tuple  # borde del collar (para que se lea sobre el pelaje)
    tag: tuple          # chapita (o corbatita) del collar
    tag_mark: tuple
    tongue: tuple
    tongue_shade: tuple
    outline: tuple
    eye: tuple = C('#1a100c')
    iris: tuple = C('#1a100c')     # distinto de `eye`: ojo de color con pupila
    fringe: tuple = C('#101010')   # puntas de los flecos (pelo largo)
    grizzle: tuple = C('#101010')  # canas entre la cara y el hocico
    cheek: tuple = C('#d98c8c')
    eye_white: tuple = C('#ffffff')
    mouth_dark: tuple = C('#4a1420')
    star: tuple = C('#fff4c2')
    star_core: tuple = C('#ffc34d')  # centro de la estrellita (para que se lea sobre un pelaje claro)
    head_rim: tuple = None         # sombra de la nuca (perros oscuros: la cabeza no se funde con el lomo)
    lip: tuple = None              # punta del hocico más oscura, bajo la nariz (si no, no se dibuja)
    lid: tuple = None              # ojos cerrados o en arco (si no, `nose`; en un perro negro, uno claro)
    crease: tuple = None           # pliegue del muslo al sentarse (si no, `dark`)


@dataclass(frozen=True)
class LabTraits:
    ear: str = 'rose'        # 'rose': parada, punta doblada hacia delante · 'fold': grande, doblada a media altura, flecos
    coat: str = 'short'      # 'short' | 'long' (flecos en orejas, pecho, vientre, manos, anca y cola)
    tail: str = 'sickle'     # 'sickle': fina y en hoz hacia arriba · 'plume': plumero tupido
    blaze: bool = False      # franja blanca en el pecho (si no, garganta crema)
    toes: bool = False       # puntas blancas en las patas
    grizzle: bool = False    # hocico canoso
    tie: bool = False        # corbatita de papel en vez de chapita
    leg_edge: bool = False   # canto claro en las patas cercanas (para que un perro negro no sea una mancha a 1×)
    leg_w: int = 4           # grosor de las patas
    hip: int = 27            # fila donde arrancan las patas (más alta = patas más largas)
    depth: int = 10          # alto del tronco
    neck: int = 16           # cuánto sube la cabeza sobre la cadera
    snout: int = 22          # borde derecho del hocico, en coordenadas de la cabeza
    head: tuple = (18, 16)   # ancho y alto de la cabeza
    trunk: int = 4           # cuántos px se corren el pecho, las manos y la cabeza hacia el anca (tronco corto)
    happy_ear: int = 0       # oreja del 2.º cuadro de `happy` (1 = echada atrás en los dos: no aletea)


# Orejas como mapas de píxeles: e = oreja, f = doblez, l = canto del doblez, x = fleco. (dx, dy) = esquina del mapa
# respecto de la esquina del óvalo de la cabeza. Estados: 0 reposo, 1 echada atrás, pegada a la nuca (carrera, salto,
# choque y bote de contento: como la oreja de Choco, que en movimiento se va hacia atrás).
EARS = {
    # Tormenta: parada en la base y la punta doblada hacia delante
    'rose': {
        0: ((1, -7), ["....llll..",
                      "...eellfff",
                      "..eeee.fff",
                      "..eeee..ff",
                      ".eeeee...f",
                      ".eeeeee...",
                      "eeeeeee...",
                      "eeeeeee..."]),
        1: ((-4, -2), [".....leee..",
                       "..ffeeeeeee",
                       "fffeeeeee..",
                       "ff........."]),
    },
    # Tony: semierguida, un triángulo que sube desde el cráneo, y la punta doblada hacia delante: el canto del doblez
    # coge la luz y la parte doblada (más oscura) cae por delante, hacia el ojo, con un mechón en la punta
    'fold': {
        0: ((2, -5), ["...l........",
                      "..eel.......",
                      ".eeeel......",
                      ".eeeeellll..",
                      ".eeeeeffffl.",
                      "..eeeeffffx.",
                      "...eeefffxx.",
                      ".....fff.x..",
                      "......ff...."]),
        1: ((-5, -2), [".....leeee...",
                       "..fffeeeeeeee",
                       "xfffeeeeeee..",
                       ".xff........."]),
    },
}


# --------------------------------------------------------------------------------------------------- piezas


def _bitmap(d, x, y, rows, colors):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in colors:
                d.point((x + i, y + j), fill=colors[ch])


def _stroke(d, pts, color, width=2):
    """Trazo continuo de `width` px (sin huecos entre filas, para que el contorno no lo «raye»)."""
    for k in range(width):
        d.line([(x + k, y) for x, y in pts], fill=color)


def _eye(d, p, ex, ey, state):
    lid = p.lid or p.nose
    if state == 'closed':      # choque: ojo apretado, un «>» que se lee a 2×
        d.point((ex, ey), fill=lid)
        R(d, ex + 1, ey + 1, ex + 2, ey + 1, lid)
        d.point((ex + 3, ey + 2), fill=lid)
        R(d, ex + 1, ey + 3, ex + 2, ey + 3, lid)
        d.point((ex, ey + 4), fill=lid)
    elif state == 'happy':     # contento: arco hacia arriba
        d.point((ex, ey + 2), fill=lid)
        R(d, ex + 1, ey + 1, ex + 2, ey + 1, lid)
        d.point((ex + 3, ey + 2), fill=lid)
    elif p.iris != p.eye:      # ojo de color (miel): pupila con su brillo y el iris solo detrás y abajo
        R(d, ex, ey, ex + 2, ey + 3, p.eye)
        R(d, ex, ey + 1, ex, ey + 3, p.iris)
        R(d, ex + 1, ey + 3, ex + 2, ey + 3, p.iris)
        d.point((ex + 1, ey), fill=p.eye_white)
    else:
        R(d, ex, ey, ex + 2, ey + 3, p.eye)
        d.point((ex + 1, ey), fill=p.eye_white)


def _ear(d, p, t, X, Y, ear):
    (dx, dy), rows = EARS[t.ear][ear]
    colors = {'e': p.ear, 'f': p.ear_fold, 'l': p.ear_light}
    if t.coat == 'long':
        colors['x'] = p.fringe
    _bitmap(d, X + dx, Y + dy, rows, colors)


def _head(d, p, t, X, Y, mouth='smile', eye='open', ear=0, tag_dx=4):
    """La cabeza con su collar. (X, Y) es la esquina superior izquierda del óvalo de la cabeza. `tag_dx`: dónde cuelga
    la chapita (o corbatita) bajo el collar, respecto de X."""
    hw, hh = t.head
    s = t.snout
    d.ellipse([X, Y, X + hw - 1, Y + hh - 1], fill=p.body)
    if p.head_rim is not None:   # sombra en la nuca: separa la cabeza del lomo cuando son del mismo color oscuro
        d.arc([X, Y, X + hw - 1, Y + hh - 1], 170, 225, fill=p.head_rim)
    R(d, X + 5, Y + 1, X + hw - 6, Y + 1, p.light)
    # hocico
    m = Y + hh - 10           # fila de arriba del hocico (el puente)
    d.rounded_rectangle([X + hw - 6, m, X + s, Y + hh - 2], radius=3, fill=p.muzzle)
    R(d, X + hw - 5, Y + hh - 3, X + s - 1, Y + hh - 2, p.muzzle_light)
    if t.grizzle:   # el puente sigue negro; lo canoso queda a los lados de la nariz y en la barbilla
        R(d, X + hw - 5, m, X + s - 2, m, p.body)
        for gx, gy in ((hw - 7, 2), (hw - 7, 4), (hw - 8, 3), (hw - 6, 6)):
            d.point((X + gx, m + gy), fill=p.grizzle)
    R(d, X + s - 1, m, X + s, m + 2, p.nose)
    d.point((X + s - 2, m), fill=p.nose)
    # ojo y ceja
    ex, ey = X + hw - 6, m - 3
    _eye(d, p, ex, ey, eye)
    R(d, ex, ey - 1, ex + 2, ey - 1, p.light)
    d.point((X + hw - 8, m + 4), fill=p.cheek)
    # boca
    m0 = X + hw - 4
    if mouth == 'smile':
        R(d, m0, Y + hh - 3, X + s - 2, Y + hh - 3, p.dark)
        d.point((m0 - 1, Y + hh - 4), fill=p.dark)
        R(d, m0 + 2, Y + hh - 2, m0 + 4, Y + hh + 1, p.tongue)
        R(d, m0 + 3, Y + hh - 1, m0 + 3, Y + hh, p.tongue_shade)
    elif mouth == 'open':
        R(d, m0, Y + hh - 4, X + s - 1, Y + hh - 2, p.mouth_dark)
        R(d, m0 + 1, Y + hh - 1, X + s - 2, Y + hh, p.muzzle_light)
        R(d, m0 + 2, Y + hh - 3, m0 + 5, Y + hh, p.tongue)
        R(d, m0 + 3, Y + hh - 2, m0 + 4, Y + hh - 1, p.tongue_shade)
    if p.lip is not None:     # punta del hocico y labio más oscuros que la cara (bajo la nariz)
        R(d, X + s, m + 3, X + s, Y + hh - 4, p.lip)
        d.point((X + s - 1, Y + hh - 4), fill=p.lip)
    # collar: una banda en el cuello, sobre la nuca y por delante de la garganta
    # (inclinada: de la nuca, arriba a la izquierda, a la garganta, abajo a la derecha)
    cy = Y + hh - 4
    for i, (x0, x1) in enumerate(((-2, 2), (-2, 3), (-1, 4), (0, 5))):
        R(d, X + x0, cy + i, X + x1, cy + i, p.collar_edge if i == 0 else p.collar)
    R(d, X + 1, cy + 4, X + 6, cy + 4, p.collar_edge)
    d.point((X + 6, cy + 3), fill=p.collar_edge)
    d.point((X - 2, cy + 3), fill=p.collar_edge)
    tx, ty = X + tag_dx, cy + 5
    if t.tie:   # corbatita de papel (la de la foto de Tony)
        R(d, tx - 1, ty, tx + 1, ty, p.tag_mark)
        R(d, tx - 1, ty + 1, tx + 1, ty + 3, p.tag)
        d.point((tx, ty + 4), fill=p.tag)
        d.point((tx, ty + 2), fill=p.tag_mark)
    else:
        R(d, tx - 1, ty, tx + 1, ty + 1, p.tag)
        d.point((tx, ty + 2), fill=p.tag)
        d.point((tx, ty), fill=p.tag_mark)
    _ear(d, p, t, X, Y, ear)


def _leg(d, p, t, x, y0, foot, color, paw, feather=False, edge=False):
    """Pata de la cadera (x, y0) al pie. `foot` = (dx, lift): cuánto se adelanta el pie y cuánto se levanta del suelo."""
    dx, lift = foot
    w = t.leg_w
    y1 = GY - lift
    d.polygon([(x, y0), (x + w - 1, y0), (x + dx + w - 1, y1), (x + dx, y1)], fill=color)
    if edge and t.leg_edge:   # canto delantero claro: separa la pata del tronco y de la de atrás
        d.line([(x + w - 1, y0 + 2), (x + dx + w - 1, y1 - 2)], fill=p.light)
    R(d, x + dx, y1 - 1, x + dx + w, y1, paw)
    if t.toes:
        R(d, x + dx + w - 1, y1, x + dx + w, y1, p.chest)
    if feather and t.coat == 'long':
        # flecos detrás de la mano: un mechón que cuelga hacia atrás
        yy = int(y0 + 0.35 * (y1 - y0))
        xx = int(round(x + dx * 0.35))
        d.polygon([(xx, yy), (xx, yy + 3), (xx - 2, yy + 3)], fill=color)


def _tail(d, p, t, bx, by, tail):
    """Cola desde el anca (bx, by). `tail`: 0 arriba, 1 meneo, -1 caída (choque). En movimiento la punta queda unos
    7 px sobre el anca, por debajo de la cabeza: como en Choco, la cabeza es el punto más alto de la silueta."""
    if t.tail == 'sickle':
        pts = {0: [(0, 0), (-2, -2), (-3, -4), (-3, -6), (-2, -7), (0, -7), (1, -7)],
               1: [(0, 0), (-1, -2), (-1, -4), (0, -5), (2, -6), (3, -6)],
               -1: [(0, 0), (-2, 1), (-4, 3), (-5, 6), (-5, 8)]}[tail]
        _stroke(d, [(bx + x, by + y) for x, y in pts], p.tail)
        x, y = pts[-1]
        d.point((bx + x + 1, by + y), fill=p.light)
    else:
        pts = {0: [(1, 1), (-2, 0), (-4, -2), (-5, -4), (-4, -6), (-1, -7), (0, -6), (-2, -4), (-1, -2), (2, -1)],
               1: [(1, 1), (-2, 0), (-3, -2), (-3, -4), (-1, -5), (2, -6), (2, -4), (0, -3), (1, -2), (2, -1)],
               -1: [(1, -1), (-2, 0), (-4, 2), (-6, 6), (-6, 9), (-4, 10), (-3, 7), (-1, 4), (1, 2)]}[tail]
        d.polygon([(bx + x, by + y) for x, y in pts], fill=p.tail)
        # mechones que cuelgan del plumero
        tufts = {0: [(-5, -3), (-6, -1), (-3, 1)], 1: [(-4, -3), (-5, -1), (-2, 1)], -1: [(-7, 8), (-5, 11), (-3, 9)]}[tail]
        for x, y in tufts:
            d.polygon([(bx + x, by + y), (bx + x + 2, by + y), (bx + x, by + y + 2)], fill=p.tail)
            d.point((bx + x, by + y + 1), fill=p.fringe)
        hl = {0: [(-3, -6), (-2, -6), (-4, -4)], 1: [(-2, -5), (-1, -5), (-2, -3)], -1: [(-5, 6), (-4, 4), (-5, 7)]}[tail]
        for x, y in hl:
            d.point((bx + x, by + y), fill=p.light)


def _stars(d, p, x, y, f):
    """Estrellitas del golpe (dos, que se alternan de sitio), por encima de la frente y por delante de la oreja."""
    for sx, sy in ((x, y), (x + 7, y + 1)) if f == 0 else ((x + 3, y - 2), (x + 10, y + 2)):
        R(d, sx - 1, sy, sx + 1, sy, p.star)
        R(d, sx, sy - 1, sx, sy + 1, p.star)
        d.point((sx, sy), fill=p.star_core)


# --------------------------------------------------------------------------------------------------- poses


def stand(p, t, legs=((0, 0),) * 4, bob=0, pitch=0, tail=0, hd=(0, 0), mouth='smile', eye='open', ear=0, stars=-1):
    """
    De pie / corriendo / saltando. `legs` = 4 pies (dx, lift) en orden lejana-trasera, cercana-trasera, lejana-delantera,
    cercana-delantera. `bob` sube (−) o baja (+) todo el cuerpo; `pitch` sube (+) o baja (−) el pecho respecto del anca;
    `hd` mueve la cabeza respecto del cuerpo; `stars` ≥ 0 dibuja las estrellitas del choque (cuadro 0 o 1).
    """
    sp = layer(W, H)
    d = ImageDraw.Draw(sp)
    rb = bob             # anca
    fb = bob - pitch     # pecho
    hip, top = t.hip, t.hip - t.depth
    k = t.trunk          # el pecho, las manos y la cabeza se corren hacia el anca: tronco corto, como Choco
    long = t.coat == 'long'
    # patas del lado lejano
    _leg(d, p, t, 10, hip + rb, legs[0], p.dark, p.paw_far)
    _leg(d, p, t, 25 - k, hip + fb, legs[2], p.dark, p.paw_far, feather=True)
    # cola, desde el anca
    _tail(d, p, t, 9, top + 2 + rb, tail)
    # cuerpo: anca redonda, pecho hondo y el vientre recogido
    d.ellipse([6, top + rb, 19, hip + 2 + rb], fill=p.body)
    d.ellipse([15 - k, top - 1 + fb, 32 - k, hip + 4 + fb], fill=p.body)
    d.polygon([(12, top + rb), (25 - k, top - 1 + fb), (25 - k, hip + 2 + fb), (12, hip + rb)], fill=p.body)
    R(d, 10, top + rb, 16, top + rb, p.light)
    R(d, 18 - k, top - 1 + fb, 23 - k, top - 1 + fb, p.light)
    d.line([(13, hip + 1 + rb), (23 - k, hip + 2 + fb)], fill=p.dark)
    # garganta y pecho
    c = 27 - k
    if t.blaze:
        # (1 px más ancha hacia delante que la garganta crema: bajo la cabeza tiene que quedar un bloque blanco visible)
        d.polygon([(c, top + 5 + fb), (c + 7, top + 5 + fb), (c + 8, hip + 2 + fb), (c + 5, hip + 5 + fb),
                   (c, hip + 2 + fb)], fill=p.chest)
        R(d, c + 1, hip + 2 + fb, c + 2, hip + 3 + fb, p.chest_shade)
    else:
        d.ellipse([c - 1, top + 3 + fb, c + 5, hip + 3 + fb], fill=p.chest)
        R(d, c, hip + 2 + fb, c + 2, hip + 3 + fb, p.chest_shade)
    if long:
        # flecos: vientre, «pantalones» del anca y pechera, en mechones que cuelgan
        for x in (13, 16, 20 - k):
            yb = hip + 1 + (rb if x < 16 else fb)
            d.polygon([(x, yb), (x + 3, yb), (x, yb + 3)], fill=p.body)
            d.point((x, yb + 2), fill=p.fringe)
        for y in (hip - 3, hip):
            d.polygon([(7, y + rb), (7, y + 3 + rb), (4, y + 4 + rb)], fill=p.body)
        for y in (top + 7, top + 11):
            d.polygon([(c + 5, y + fb), (c + 5, y + 4 + fb), (c + 7, y + 4 + fb)], fill=p.chest)
    # patas del lado cercano
    _leg(d, p, t, 6, hip + rb, legs[1], p.body, p.paw, edge=True)
    _leg(d, p, t, 21 - k, hip + fb, legs[3], p.body, p.paw, feather=True, edge=True)
    # cabeza, y la nuca que la une al lomo (sin huecos bajo la oreja echada atrás)
    X, Y = 27 - k + hd[0], hip - t.neck + fb + hd[1]
    # (con la oreja atrás, la nuca llega bajo ella y deja 1 fila libre, que el contorno pinta: la oreja se lee suelta)
    nape = (X - 2, Y + 2) if ear == 1 else (X + 1, Y + 4)
    d.polygon([(X + 3, Y + 2), (X + 9, Y + 6), (X + 4, Y + t.head[1]), (17 - k, top + fb), nape], fill=p.body)
    # de pie la cabeza tapa lo alto del pecho: la corbatita cuelga 2 px más hacia la nuca para que se vea la franja blanca
    _head(d, p, t, X, Y, mouth=mouth, eye=eye, ear=ear, tag_dx=2 if t.tie and t.blaze else 4)
    if stars >= 0:
        _stars(d, p, X + t.head[0] - 7, Y - 3, stars)
    return outlined(sp, p.outline)


def _sit_head_xy(t):
    """La cabeza del perro sentado, lo más alta posible sin que la oreja toque el borde del lienzo."""
    return 19, 2 - EARS[t.ear][0][0][1]


def sit(p, t, f=0):
    """Sentado, de perfil. `f` alterna la cola (0/1) y el jadeo (la lengua asoma un píxel más)."""
    sp = layer(SIT_W, SIT_H)
    d = ImageDraw.Draw(sp)
    g = SIT_H - 1
    hw, hh = t.head
    lw = t.leg_w
    long = t.coat == 'long'
    # cola en el suelo, que se menea
    if t.tail == 'sickle':
        _stroke(d, [(9, g - 1), (5, g - 1), (2, g - 3), (1, g - 6 - 2 * f), (2, g - 8 - 3 * f)], p.tail)
    else:
        lift = 3 * f
        d.polygon([(10, g), (5, g), (1, g - 2 - lift), (0, g - 6 - lift), (2, g - 7 - lift), (5, g - 4 - lift),
                   (10, g - 3)], fill=p.tail)
        d.polygon([(1, g - 1 - lift), (3, g - 1 - lift), (1, g + 1 - lift)], fill=p.tail)
        d.point((2, g - 5 - lift), fill=p.light)
    # anca, cuerpo erguido y patas
    R(d, 18, g - 12, 18 + lw - 1, g, p.dark)                # mano lejana
    R(d, 18, g - 1, 18 + lw, g, p.paw_far)
    d.ellipse([10, g - 27, 28, g - 2], fill=p.body)
    d.ellipse([4, g - 15, 21, g], fill=p.body)
    R(d, 13, g - 27, 19, g - 27, p.light)
    # muslo: un arco más oscuro que dibuja la pata trasera doblada
    d.arc([7, g - 12, 19, g + 2], 200, 320, fill=p.crease or p.dark)
    R(d, 7, g - 1, 17, g, p.paw)                            # pie trasero
    if not t.blaze:
        d.ellipse([22, g - 24, 28, g - 6], fill=p.chest)
    if long:
        for y in (g - 19, g - 14):
            d.polygon([(28, y), (28, y + 4), (30, y + 4)], fill=p.chest)
        for y in (g - 10, g - 6):
            d.polygon([(5, y), (5, y + 3), (3, y + 4)], fill=p.body)
    R(d, 23, g - 13, 23 + lw - 1, g, p.body)                # mano cercana
    if t.leg_edge:
        R(d, 23 + lw - 1, g - 11, 23 + lw - 1, g - 3, p.light)
    R(d, 23, g - 1, 23 + lw, g, p.paw)
    if t.blaze:   # la franja blanca baja por el pecho, por delante de la mano
        d.polygon([(22, g - 24), (28, g - 23), (29, g - 9), (27 + lw - 4, g - 3), (25 + lw - 4, g - 3),
                   (23, g - 10)], fill=p.chest)
        R(d, 24, g - 5, 25, g - 4, p.chest_shade)
    if t.toes:
        R(d, 22 + lw, g, 23 + lw, g, p.chest)
        R(d, 17 + lw, g, 18 + lw, g, p.chest)
        R(d, 15, g, 17, g, p.chest)
    X, Y = _sit_head_xy(t)
    _head(d, p, t, X, Y, mouth='smile', eye='open', ear=0)
    if f == 1:   # jadeo: la lengua asoma un píxel más
        m0 = X + hw - 4
        R(d, m0 + 2, Y + hh + 2, m0 + 4, Y + hh + 2, p.tongue)
    return outlined(sp, p.outline)


def animations(p, t):
    """Las 5 animaciones de la manada: nombre -> (cuadros, fps). Mismos ritmos que las de Choco."""
    s = lambda **kw: stand(p, t, **kw)  # noqa: E731
    brake = ((-2, 0), (-3, 0), (3, 0), (4, 0))
    return {
        # Galope: se estira (manos adelante, patas atrás, el pecho arriba), apoya las manos, se recoge (el pecho baja),
        # apoya las patas y vuelve a estirar. El cuerpo sube y baja 2–3 px, como Choco.
        'run': ([s(legs=((-3, 1), (-4, 0), (5, 2), (6, 1)), bob=-2, pitch=1, ear=1, mouth='open', tail=1),
                 s(legs=((-1, 2), (-2, 3), (-1, 0), (-2, 0)), bob=0, ear=1, mouth='open', tail=0),
                 s(legs=((4, 2), (5, 0), (-3, 2), (-2, 3)), bob=-2, pitch=-1, ear=1, mouth='open', tail=1),
                 s(legs=((1, 0), (0, 0), (4, 4), (3, 3)), bob=0, ear=1, mouth='open', tail=0)], 12),
        # Salto: despega estirado (pecho arriba), en la cima recoge las patas, al caer adelanta las manos
        'jump': ([s(legs=((-4, 3), (-5, 2), (5, 6), (6, 5)), bob=0, pitch=1, ear=1, mouth='open', hd=(1, 0), tail=1),
                  s(legs=((2, 6), (1, 5), (-2, 6), (-1, 5)), bob=-1, ear=1, mouth='open', tail=0),
                  s(legs=((-3, 4), (-4, 5), (5, 2), (6, 1)), bob=0, pitch=-1, ear=1, mouth='open', hd=(0, 1), tail=-1)],
                 1),
        # Choque: frena con las manos, ojos apretados, oreja atrás, la cabeza se va 3 px atrás y abajo y el pecho
        # se hunde: un golpe, no un saludo. Estrellitas sobre la frente.
        'hurt': ([s(legs=brake, bob=2, pitch=0, eye='closed', mouth='open', hd=(-3, 2), ear=1, tail=-1, stars=0),
                  s(legs=brake, bob=3, pitch=-1, eye='closed', mouth='open', hd=(0, 3), ear=1, tail=-1, stars=1)], 8),
        'idle': ([sit(p, t, 0), sit(p, t, 1)], 3),
        # Contento: bota con las manos en alto (la oreja se va atrás en el bote) y menea la cola, lengua afuera
        'happy': ([s(legs=((0, 0), (1, 0), (2, 3), (3, 4)), bob=0, pitch=2, hd=(0, -1), mouth='open', eye='happy',
                     tail=1, ear=1),
                   s(bob=0, mouth='open', eye='happy', tail=0, ear=t.happy_ear)], 6),
    }


def portrait(p, t):
    """Busto del perro sentado: cabeza, collar y pecho, centrados en 32×32 con el corte abajo."""
    sitting = sit(p, t, 0)
    X, Y = _sit_head_xy(t)
    left, right = X + 1 - 6, X + 1 + t.snout + 2      # del cuello a la punta de la nariz (con el contorno)
    x0 = (left + right) // 2 - 16
    top = sitting.getbbox()[1]
    bust = sitting.crop((x0, top, x0 + 32, top + 30))
    out = layer(32, 32)
    out.paste(bust, (0, 2), bust)
    return out
