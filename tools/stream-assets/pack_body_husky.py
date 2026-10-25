"""
Cuerpo compartido de la familia «husky» de la manada (Kiana, Zack y Nannukk, la malamute): perros nórdicos de orejas
paradas, pelaje denso de dos tonos (manto oscuro arriba, blanco abajo), cola enroscada sobre el lomo y antifaz en la
cara. El mismo estilo de mascota que Choco (`dog.py`) y que la familia lab (`pack_body_lab.py`): cabezón, patas cortas y
gruesas, lengua afuera y contorno de 1 px con `outlined()`.

Un perro de la familia es una **paleta** (`HuskyPalette`), unos **rasgos** (`HuskyTraits`: dibujo de la cara, orejas,
cola, cuánto pelo esponjoso) y una **talla** (`HuskyBuild`: `L` para los husky, `XL` para la malamute). Las poses (de
pie/corriendo, salto, choque, sentado, contento) salen de aquí. Los sprites miran a la derecha y los pies quedan abajo
(fila `GY = H - 1` del lienzo).

Medidas (con el contorno): `L` = lienzo de 56×46, cabeza de 21×19 y patas de 10×5 (Choco: 18×18 y 9×5); `XL` = lienzo de
68×55 (el «~68×55» de Nannukk en el contrato), cabeza de 26×23 y patas de 12×7. Como en la familia lab, al correr las
orejas se echan atrás y la cola enroscada queda por debajo de la cabeza, que es el punto más alto de la silueta.

Contrato: `docs/personajes/ASSETS_SPEC.md`. Python 3.9: nada de `X | Y` en los tipos.
"""
from dataclasses import dataclass, replace

from PIL import ImageChops, ImageDraw

from pixel import C, R, layer, outlined


@dataclass(frozen=True)
class HuskyBuild:
    """Medidas de una talla. Las x van de izquierda (cola) a derecha (hocico); las y, de arriba abajo."""
    W: int
    H: int
    leg_len: int       # de la cadera al suelo
    leg_w: int         # grosor de las patas
    depth: int         # alto del tronco
    rear: tuple        # (x0, x1) del anca
    chest: tuple       # (x0, x1) del pecho
    legs_x: tuple      # x de las patas: (trasera cercana, trasera lejana, delantera cercana, delantera lejana)
    head: tuple        # (ancho, alto) del óvalo de la cabeza
    head_x: int        # x de la cabeza de pie
    neck: int          # cuánto sube la cabeza (su borde de arriba) sobre la cadera
    snout: int         # borde derecho del hocico, en coordenadas de la cabeza
    k: float           # escala de colas, orejas, mechones y del galope (1 = L)
    sit_w: int
    sit_head: tuple    # (X, Y) de la cabeza sentado


BUILDS = {
    'L': HuskyBuild(W=54, H=44, leg_len=10, leg_w=5, depth=12, rear=(6, 21), chest=(15, 32), legs_x=(6, 11, 20, 25),
                    head=(21, 19), head_x=25, neck=21, snout=23, k=1.0, sit_w=50, sit_head=(22, 8)),
    'XL': HuskyBuild(W=66, H=53, leg_len=12, leg_w=7, depth=16, rear=(6, 24), chest=(17, 39), legs_x=(7, 12, 25, 30),
                     head=(26, 23), head_x=30, neck=26, snout=28, k=1.25, sit_w=60, sit_head=(26, 10)),
}


@dataclass(frozen=True)
class HuskyPalette:
    coat: tuple          # manto (lomo, flancos, nuca y gorro de la cabeza)
    coat_light: tuple    # reflejo del lomo
    coat_dark: tuple     # sombra del manto, oreja lejana, raya del lomo
    white: tuple         # cara, pecho, vientre y patas
    white_shade: tuple   # sombra del blanco (patas lejanas, vientre, almohadillas)
    cap: tuple           # gorro de la cabeza (casi siempre = coat)
    ear: tuple
    ear_inner: tuple
    tail: tuple
    tail_under: tuple    # la parte de abajo de la cola enroscada (blanca o crema)
    nose: tuple
    eye: tuple           # pupila
    collar: tuple
    collar_edge: tuple
    tag: tuple
    tag_mark: tuple
    outline: tuple
    iris: tuple = None   # ojo de color (azul o ámbar) alrededor de la pupila
    rim: tuple = None    # delineado oscuro alrededor del ojo (el «antifaz» de Zack)
    brow: tuple = None   # manchita clara sobre el ojo (las «cejas» del husky)
    mask: tuple = None   # raya de la mejilla (del ojo hacia la oreja)
    tan: tuple = None    # franja de transición entre el manto y el blanco (malamute)
    cheek_fluff: tuple = None   # color de la gorguera de las mejillas (si no, `white`)
    saddle: tuple = None        # silla oscura en lo alto del lomo, sobre el manto (malamute)
    tail_swirl: tuple = None    # trazo de la vuelta de la cola (si no, `coat_light`)
    mouth_line: tuple = C('#3a2c30')
    tongue: tuple = C('#ff8aa1')
    tongue_shade: tuple = C('#e0587a')
    mouth_dark: tuple = C('#4a1420')
    eye_white: tuple = C('#ffffff')
    cheek: tuple = C('#f0a0a8')
    lid: tuple = None    # ojos cerrados o en arco (si no, `mouth_line`)
    star: tuple = C('#fff4c2')
    star_core: tuple = C('#ffc34d')


@dataclass(frozen=True)
class HuskyTraits:
    size: str = 'L'          # 'L' | 'XL' (ver BUILDS)
    face: str = 'peak'       # dibujo del gorro: 'peak' (pico de viuda hasta el entrecejo, Zack) · 'round' (gorro
                             # redondo y la cara abierta, Kiana) · 'blaze' (franja blanca en la frente, malamute)
    ear: str = 'tall'        # 'tall' (orejas grandes, Kiana) · 'mid' (Zack) · 'round' (pequeñas y redondeadas, malamute)
    fluff: int = 1           # mechones de la gorguera, el pecho y el anca: 0, 1 o 2 (malamute)
    tail_curl: int = 1       # 1 = hoz enroscada · 2 = plumero que se apoya en el lomo (malamute)


# --------------------------------------------------------------------------------------------------- utilidades


def _sc(pts, k, ox, oy):
    return [(ox + int(round(x * k)), oy + int(round(y * k))) for x, y in pts]


def _clip_paste(dst, mask_img, draw):
    """Dibuja con `draw(ImageDraw)` en una capa aparte y la pega en `dst` solo donde `mask_img` es opaca."""
    tmp = layer(*dst.size)
    draw(ImageDraw.Draw(tmp))
    m = ImageChops.multiply(tmp.getchannel('A'), mask_img.getchannel('A'))
    dst.paste(tmp, (0, 0), m)


def _stars(d, p, x, y, f):
    """Estrellitas del golpe (dos, que se alternan de sitio), sobre la frente y por delante de la oreja."""
    for sx, sy in ((x, y), (x + 7, y + 1)) if f == 0 else ((x + 3, y - 2), (x + 10, y + 2)):
        R(d, sx - 1, sy, sx + 1, sy, p.star)
        R(d, sx, sy - 1, sx, sy + 1, p.star)
        d.point((sx, sy), fill=p.star_core)


# --------------------------------------------------------------------------------------------------- piezas

# Orejas en coordenadas de L (se escalan con `k`), respecto de la esquina del óvalo de la cabeza.
# 0 = parada (reposo) · 1 = echada atrás (carrera, salto, choque y bote de contento).
EARS = {
    'tall': {0: ([(3, 4), (5, -8), (12, 2)], [(5, 2), (6, -4), (9, 1)]),
             1: ([(3, 5), (0, -3), (2, -3), (12, 2)], [(4, 3), (3, 1), (6, 2)])},
    'mid': {0: ([(3, 4), (5, -6), (12, 2)], [(5, 2), (6, -3), (9, 1)]),
            1: ([(3, 5), (1, -2), (3, -2), (12, 2)], [(4, 3), (3, 1), (6, 2)])},
    'round': {0: ([(3, 4), (4, -3), (6, -6), (8, -5), (12, 2)], [(5, 2), (6, -2), (7, -3), (9, 1)]),
              1: ([(3, 5), (1, -1), (2, -2), (4, -2), (12, 2)], [(4, 3), (3, 0), (6, 2)])},
}


def _ear(d, p, t, b, X, Y, state, far=False):
    outer, inner = EARS[t.ear][state]
    if far:   # la oreja lejana asoma detrás, un poco más adelante y más oscura (solo parada)
        d.polygon(_sc(outer, b.k, X + int(round(5 * b.k)), Y + 1), fill=p.coat_dark)
        return
    d.polygon(_sc(outer, b.k, X, Y), fill=p.ear)
    d.polygon(_sc(inner, b.k, X, Y), fill=p.ear_inner)


def _cap(t, b, hw, hh, ex, ey):
    """Polígono del gorro (en coordenadas de la cabeza): lo que es manto en la cabeza; el resto de la cara es blanco."""
    if t.face == 'peak':     # Zack: gorro negro hasta un pico entre los ojos y una raya del ojo hacia la oreja
        return [(-2, -2), (hw + 2, -2), (hw - 1, ey - 3), (hw - 3, ey + 1), (ex + 2, ey - 2), (ex - 1, ey - 2),
                (ex - 2, ey + 1), (ex - 5, ey + 3), (3, ey + 3), (1, hh - 5), (-2, hh - 3)]
    if t.face == 'round':    # Kiana: gorro redondo que no llega a los ojos; la cara y la mejilla quedan blancas
        return [(-2, -2), (hw + 2, -2), (hw - 2, 3), (ex + 2, ey - 3), (ex - 3, ey - 2), (ex - 6, ey),
                (2, ey + 1), (-2, ey + 4)]
    # 'blaze' (malamute): gorro gris con una franja blanca en la frente, del entrecejo hacia arriba
    return [(-2, -2), (hw - 10, -2), (hw - 8, ey - 3), (ex - 1, ey - 2), (ex - 3, ey + 1), (ex - 6, ey + 2),
            (2, ey + 3), (0, hh - 5), (-2, hh - 3)]


def _eye(d, p, ex, ey, state, big=False):
    lid = p.lid or p.mouth_line
    if state == 'closed':      # choque: ojo apretado, un «>» que se lee a 2×
        d.point((ex, ey), fill=lid)
        R(d, ex + 1, ey + 1, ex + 2, ey + 1, lid)
        d.point((ex + 3, ey + 2), fill=lid)
        R(d, ex + 1, ey + 3, ex + 2, ey + 3, lid)
        d.point((ex, ey + 4), fill=lid)
        return
    if state == 'happy':       # contento: arco hacia arriba
        d.point((ex, ey + 2), fill=lid)
        R(d, ex + 1, ey + 1, ex + 2, ey + 1, lid)
        d.point((ex + 3, ey + 2), fill=lid)
        return
    if p.rim is not None:      # delineado oscuro (antifaz): arriba, detrás y debajo; hace que un ojo claro se lea a 1×
        R(d, ex - 1, ey - 1, ex + 3, ey - 1, p.rim)
        R(d, ex - 1, ey, ex - 1, ey + 4, p.rim)
        R(d, ex, ey + 4, ex + 2, ey + 4, p.rim)
    if p.iris is not None:     # ojo de color: el iris rodea una pupila de 1×2 (que no toca el borde) y su brillo
        R(d, ex, ey, ex + 2, ey + 3, p.iris)
        R(d, ex + 1, ey + 1, ex + 1, ey + 2, p.eye)
        d.point((ex + 2, ey), fill=p.eye_white)
    elif big:                  # XL: ojo de 4×4, redondeado, con dos brillos (que no se lea como un ojo cerrado)
        R(d, ex, ey, ex + 3, ey + 3, p.eye)
        R(d, ex + 1, ey, ex + 2, ey, p.eye_white)
        d.point((ex + 3, ey + 2), fill=p.eye_white)
    else:
        R(d, ex, ey, ex + 2, ey + 3, p.eye)
        d.point((ex + 1, ey), fill=p.eye_white)


def _fluff_cheek(d, p, t, b, X, Y, hh):
    """La gorguera: mechones claros que cuelgan de la mejilla y la nuca, bajo la cabeza."""
    col = p.cheek_fluff or p.white
    for i in range(1 + t.fluff):   # detrás de la mandíbula, bajo la oreja: cuelgan hacia atrás
        x = X + int(round((2 + 3 * i) * b.k))
        y = Y + hh - 5 + i
        d.polygon([(x, y), (x + 3, y), (x - 1, y + 3)], fill=col)


def _head(d, sp, p, t, b, X, Y, mouth='smile', eye='open', ear=0):
    """La cabeza con su collar. (X, Y) es la esquina del óvalo de la cabeza. `sp` hace falta para recortar el gorro."""
    hw, hh = b.head
    s = b.snout
    if ear == 0:
        _ear(d, p, t, b, X, Y, 0, far=True)
    # cráneo blanco, la gorguera y el gorro (recortado al cráneo)
    skull = layer(*sp.size)
    ImageDraw.Draw(skull).ellipse([X, Y, X + hw - 1, Y + hh - 1], fill=p.white)
    sp.alpha_composite(skull)
    _fluff_cheek(d, p, t, b, X, Y, hh)
    m = Y + hh - (10 if hh < 21 else 12)     # fila de arriba del hocico (el puente)
    ex, ey = X + hw - 6, m - 3
    cap = [(X + x, Y + y) for x, y in _cap(t, b, hw, hh, ex - X, ey - Y)]
    _clip_paste(sp, skull, lambda dd: dd.polygon(cap, fill=p.cap))
    # sombra en la nuca: separa la cabeza del cuello (los dos del color del manto)
    d.arc([X, Y, X + hw - 1, Y + hh - 1], 165, 228, fill=p.coat_dark)
    R(d, X + 6, Y + 1, X + hw - 8, Y + 1, p.coat_light)      # reflejo de la frente
    big = hh >= 21
    if big:
        ex -= 1
    if t.face == 'blaze':   # la franja blanca de la frente: de perfil, una lengüeta clara que sube del entrecejo
        _clip_paste(sp, skull, lambda dd: dd.polygon(
            [(ex - 1, ey - 2), (ex - 4, Y + 4), (ex - 6, Y + 3), (ex - 3, ey - 2)], fill=p.white))
    if p.mask is not None:   # raya oscura de la mejilla, del rabillo del ojo hacia la oreja
        g0 = 2 if big else 1     # (en XL, 1 px más atrás, para que no se pegue al ojo)
        d.line([(ex - g0, ey + 2), (ex - g0 - 4, ey + 4)], fill=p.mask)
        if big:
            d.line([(ex - g0, ey + 3), (ex - g0 - 4, ey + 5)], fill=p.mask)
    # hocico blanco, nariz y labio
    d.rounded_rectangle([X + hw - 6, m, X + s, Y + hh - 2], radius=3, fill=p.white)
    R(d, X + hw - 5, Y + hh - 3, X + s - 1, Y + hh - 2, p.white_shade)
    R(d, X + s - 1, m, X + s, m + 2, p.nose)
    d.point((X + s - 2, m), fill=p.nose)
    if hh >= 21:
        R(d, X + s - 2, m, X + s, m + 3, p.nose)
        d.point((X + s - 3, m), fill=p.nose)
    # ojo, ceja clara y mejilla
    _eye(d, p, ex, ey, eye, big)
    if p.brow is not None and eye == 'open':
        R(d, ex - 1, ey - 2 - (p.rim is not None), ex + 1, ey - 2 - (p.rim is not None), p.brow)
    d.point((X + hw - 8, m + 4), fill=p.cheek)
    # boca
    m0 = X + hw - 4
    if mouth == 'smile':
        R(d, m0, Y + hh - 3, X + s - 2, Y + hh - 3, p.mouth_line)
        d.point((m0 - 1, Y + hh - 4), fill=p.mouth_line)
        R(d, m0 + 2, Y + hh - 2, m0 + 4, Y + hh + 1, p.tongue)
        R(d, m0 + 3, Y + hh - 1, m0 + 3, Y + hh, p.tongue_shade)
    else:   # 'open': jadeando
        R(d, m0, Y + hh - 4, X + s - 1, Y + hh - 2, p.mouth_dark)
        R(d, m0 + 1, Y + hh - 1, X + s - 2, Y + hh, p.white_shade)
        R(d, m0 + 2, Y + hh - 3, m0 + 5, Y + hh, p.tongue)
        R(d, m0 + 3, Y + hh - 2, m0 + 4, Y + hh - 1, p.tongue_shade)
    # collar: una banda inclinada en el cuello, de la nuca a la garganta, con borde y chapita
    cy = Y + hh - 4
    rows = ((-3, 2), (-3, 3), (-2, 4), (-1, 5), (0, 6)) if b.k > 1 else ((-2, 2), (-2, 3), (-1, 4), (0, 5))
    for i, (x0, x1) in enumerate(rows):
        R(d, X + x0, cy + i, X + x1, cy + i, p.collar_edge if i == 0 else p.collar)
    n = len(rows)
    R(d, X + rows[-1][0] + 1, cy + n, X + rows[-1][1] + 1, cy + n, p.collar_edge)
    d.point((X + rows[-1][1] + 1, cy + n - 1), fill=p.collar_edge)
    d.point((X + rows[-1][0] - 2, cy + n - 1), fill=p.collar_edge)
    tx, ty = X + 4, cy + n + 1
    R(d, tx - 1, ty, tx + 1, ty + 1, p.tag)
    d.point((tx, ty + 2), fill=p.tag)
    d.point((tx, ty), fill=p.tag_mark)
    _ear(d, p, t, b, X, Y, ear)


def _leg(d, p, b, x, y0, foot, color, paw, near=False, thigh=0):
    """
    Pata de la cadera (x, y0) al pie. `foot` = (dx, lift): cuánto se adelanta el pie y cuánto se levanta. `thigh` > 0
    pinta de canela (`tan`) los primeros `thigh` px de la pata: el muslo leonado de la malamute.
    """
    dx, lift = foot
    w = b.leg_w
    y1 = b.H - 1 - lift
    d.polygon([(x, y0), (x + w - 1, y0), (x + dx + w - 1, y1), (x + dx, y1)], fill=color)
    if thigh and p.tan is not None:
        yt = y0 + thigh
        xt = x + dx * thigh // max(1, y1 - y0)
        d.polygon([(x, y0), (x + w - 1, y0), (xt + w - 1, yt), (xt, yt)], fill=p.tan)
    if near:   # sombra en el canto de atrás: separa la pata blanca del vientre y de la otra pata
        d.line([(x, y0 + 2), (x + dx, y1 - 2)], fill=p.white_shade)
    R(d, x + dx, y1 - 1, x + dx + w, y1, color)
    R(d, x + dx + 1, y1, x + dx + w - 1, y1, paw)


# Cola en coordenadas de L, desde la raíz en el anca: (contorno, punta clara, remolino claro que dibuja la vuelta).
# 0 enroscada sobre el lomo · 1 meneo (la vuelta se va 2 px atrás) · -1 caída (choque y caída del salto).
# En movimiento la vuelta sube 7 px sobre la raíz: queda ≥ 4 px por debajo de la cabeza, como en la familia lab.
TAILS = {
    1: {0: ([(1, 1), (-2, 0), (-4, -2), (-4, -5), (-2, -7), (2, -7), (5, -6), (6, -4), (5, -2), (2, -1)],
            [(2, -6), (4, -6), (5, -5), (5, -3), (4, -4), (3, -5)],
            [(-2, -3), (-1, -5), (2, -5), (3, -3)]),
        1: ([(1, 1), (-2, 0), (-5, -2), (-6, -4), (-4, -7), (0, -7), (3, -6), (4, -4), (3, -2), (1, -1)],
            [(0, -6), (2, -6), (3, -5), (3, -3), (2, -4), (1, -5)],
            [(-4, -3), (-3, -5), (0, -5), (1, -3)]),
        -1: ([(1, -1), (-2, 0), (-5, 2), (-7, 5), (-7, 9), (-5, 11), (-3, 10), (-3, 7), (-1, 4), (2, 2)],
             [(-7, 5), (-7, 9), (-5, 11), (-4, 10), (-5, 8), (-6, 5)], [])},
    # plumero de malamute: más grueso y largo, se apoya sobre el lomo con la punta (crema) cayendo hacia delante
    2: {0: ([(1, 1), (-2, 0), (-5, -2), (-5, -5), (-3, -7), (1, -7), (5, -7), (8, -5), (9, -3), (8, -1), (5, -2),
             (2, -1)],
            [(1, 1), (-2, 0), (-5, -2), (-5, -3), (-2, -2), (1, -3), (4, -4), (6, -5), (8, -5), (9, -3), (8, -1),
             (5, -2), (2, -1)],
            [(-3, -4), (-2, -5), (1, -6), (4, -6), (6, -5)]),
        1: ([(1, 1), (-2, 0), (-6, -2), (-6, -5), (-4, -7), (0, -7), (4, -7), (7, -5), (7, -2), (4, -2), (1, -1)],
            [(1, 1), (-2, 0), (-6, -2), (-6, -3), (-2, -2), (1, -3), (4, -4), (6, -5), (7, -5), (7, -2), (4, -2),
             (1, -1)],
            [(-4, -4), (-3, -5), (0, -6), (3, -6), (5, -5)]),
        -1: ([(1, -1), (-2, 0), (-5, 2), (-7, 5), (-7, 10), (-5, 12), (-3, 11), (-3, 7), (-1, 4), (2, 2)],
             [(-7, 5), (-7, 10), (-5, 12), (-4, 11), (-5, 8), (-6, 5)], [])},
}


def _tail(d, p, t, b, bx, by, state):
    outer, tip, swirl = TAILS[t.tail_curl][state]
    d.polygon(_sc(outer, b.k, bx, by), fill=p.tail)
    d.polygon(_sc(tip, b.k, bx, by), fill=p.tail_under)
    if swirl:
        d.line(_sc(swirl, b.k, bx, by), fill=p.tail_swirl or p.coat_light)
    if state == -1:   # caída sobre el anca: el canto de dentro, oscuro, la separa del muslo; el de atrás, claro
        d.line(_sc([(2, 2), (0, 4), (-2, 7), (-3, 9)], b.k, bx, by), fill=p.coat_dark)
    elif t.fluff >= 2:   # plumero: un escalón de 2 px en el canto de atrás de cada mitad (gris arriba, crema abajo)
        x0 = bx + int(round(min(x for x, _ in outer) * b.k))
        for ty, col in ((-5, p.tail), (-3, p.tail_under)):
            y0 = by + int(round(ty * b.k))
            R(d, x0 - 2, y0, x0, y0 + 1, col)


# --------------------------------------------------------------------------------------------------- poses


def stand(p, t, legs=((0, 0),) * 4, bob=0, pitch=0, tail=0, hd=(0, 0), mouth='smile', eye='open', ear=0, stars=-1):
    """
    De pie / corriendo / saltando. `legs` = 4 pies (dx, lift) en orden lejana-trasera, cercana-trasera, lejana-delantera,
    cercana-delantera. `bob` sube (−) o baja (+) todo el cuerpo; `pitch` sube (+) o baja (−) el pecho respecto del anca;
    `hd` mueve la cabeza respecto del cuerpo; `stars` ≥ 0 dibuja las estrellitas del choque (cuadro 0 o 1).
    """
    b = BUILDS[t.size]
    sp = layer(b.W, b.H)
    d = ImageDraw.Draw(sp)
    rb, fb = bob, bob - pitch
    hip = b.H - 1 - b.leg_len
    top = hip - b.depth
    (rx0, rx1), (cx0, cx1) = b.rear, b.chest
    lnr, lfr, lnf, lff = b.legs_x
    sc = lambda v: int(round(v * b.k))  # noqa: E731
    leg_feet = [(sc(dx), lift) for dx, lift in legs]
    # patas lejanas (en sombra)
    _leg(d, p, b, lfr, hip + rb, leg_feet[0], p.white_shade, p.white_shade)
    _leg(d, p, b, lff, hip + fb, leg_feet[2], p.white_shade, p.white_shade)
    bx, by = rx0 + 3, top + 2 + rb      # raíz de la cola
    # tronco blanco y el manto recortado encima
    body = layer(b.W, b.H)
    bd = ImageDraw.Draw(body)
    bd.ellipse([rx0, top + rb, rx1, hip + 2 + rb], fill=p.white)
    bd.ellipse([cx0, top - 1 + fb, cx1, hip + 4 + fb], fill=p.white)
    bd.polygon([(rx0 + 6, top + rb), (cx0 + 8, top - 1 + fb), (cx0 + 8, hip + 2 + fb), (rx0 + 6, hip + rb)],
               fill=p.white)
    # mechones del vientre y de los «pantalones» del anca
    for i in range(1 + t.fluff):
        x = rx1 - 4 + sc(4 * i)
        yb = hip + 1 + (rb + fb) // 2
        bd.polygon([(x, yb), (x + 3, yb), (x + 1, yb + 2 + (i % 2))], fill=p.white)
    bd.polygon([(rx0 + 1, hip - 3 + rb), (rx0 + 1, hip + 1 + rb), (rx0 - 2, hip + 2 + rb)], fill=p.white)
    if t.fluff >= 2:   # «pantalones» del anca más largos
        bd.polygon([(rx0 + 4, hip + 1 + rb), (rx0 + 7, hip + 1 + rb), (rx0 + 3, hip + 4 + rb)], fill=p.white)
    mid = top + int(b.depth * 0.55)

    def saddle(dd, shift=0):
        col = p.tan if shift else p.coat
        notch = [] if shift else [(rx1 - 1, mid + 1 + rb)]   # la franja canela no hace el entrante: canto liso
        dd.polygon([(rx0 - 2, hip - 2 + rb + shift), (rx0 - 2, top - 2 + rb), (cx1 - 3, top - 2 + fb),
                    (cx1 - 6, top + int(b.depth * 0.35) + fb + shift), (cx0 + 2, mid + fb + shift)] + notch +
                   [(rx1 - 4, hip - 1 + rb + shift)], fill=col)
    if p.tan is not None:   # malamute: una franja canela ancha (flanco bajo y muslo) entre el gris y el crema
        _clip_paste(body, body, lambda dd: saddle(dd, sc(4)))
    _clip_paste(body, body, saddle)
    if p.saddle is not None:   # silla oscura en lo alto del lomo, más honda en el anca que en la cruz
        _clip_paste(body, body, lambda dd: dd.polygon(
            [(rx0 - 2, top - 2 + rb), (cx1 - 3, top - 2 + fb), (cx1 - 8, top + 2 + fb), (cx0 + 2, top + 3 + fb),
             (rx1 - 2, top + 4 + rb), (rx0 + 2, top + 6 + rb), (rx0 - 2, top + 7 + rb)], fill=p.saddle))
    bd.line([(rx0 + 4, top + rb), (rx1 - 2, top + rb)], fill=p.coat_light)
    bd.line([(cx0 + 2, top - 1 + fb), (cx0 + 7, top - 1 + fb)], fill=p.coat_light)
    bd.line([(rx1 - 6, hip + 1 + rb), (cx0 + 6, hip + 2 + fb)], fill=p.white_shade)
    sp.alpha_composite(body)
    # la cola enroscada va sobre el lomo; caída, cuelga por detrás del anca (con su canto oscuro para separarla)
    _tail(d, p, t, b, bx, by, tail)
    # patas cercanas
    _leg(d, p, b, lnr, hip + rb, leg_feet[1], p.white, p.white_shade, near=True, thigh=sc(3) if p.tan else 0)
    _leg(d, p, b, lnf, hip + fb, leg_feet[3], p.white, p.white_shade, near=True)
    # cuello: la nuca (manto) que une la cabeza al lomo, y la garganta blanca por delante
    X, Y = b.head_x + hd[0], hip - b.neck + fb + hd[1]
    hw, hh = b.head
    d.polygon([(X + 2, Y + 3), (X + 8, Y + 5), (X + 4, Y + hh), (cx0 + 2, top + 1 + fb), (X - 1, Y + 6)],
              fill=p.coat)
    if t.fluff >= 2:   # gorguera: la melena de la nuca rompe la silueta en mechones que apuntan atrás
        n0, n1 = (X - 1, Y + 6), (cx0 + 2, top + 1 + fb)
        for i in (1, 2, 3):
            mx = n0[0] + (n1[0] - n0[0]) * i // 4
            my = n0[1] + (n1[1] - n0[1]) * i // 4
            d.polygon([(mx, my - 1), (mx + 1, my + 2), (mx - 3, my)], fill=p.coat)
    d.polygon([(X + 6, Y + hh - 4), (X + 12, Y + hh - 2), (cx1 - 1, top + 6 + fb), (cx1 - 6, top + 9 + fb),
               (X + 3, Y + hh)], fill=p.white)
    for i in range(t.fluff):   # pechera esponjosa: mechones cortos (2 px) por delante del pecho
        y = top + 6 + sc(4 * i) + fb
        d.polygon([(cx1, y), (cx1, y + 2), (cx1 + 1, y + 2)], fill=p.white)
    if t.fluff >= 2:   # malamute: el pelo del lomo y de la gorguera rompe la silueta en mechones (no sobre el plumero)
        tail_x1 = bx + int(round(max(x for x, _ in TAILS[t.tail_curl][tail][0]) * b.k)) if tail != -1 else -1
        for i, x in enumerate(range(rx0 + 4, cx0 + 5, 5)):
            if x <= tail_x1 + 1:
                continue
            yy = top - 1 + (rb if x < rx1 else fb)
            R(d, x, yy, x + 1 + i % 2, yy, p.saddle or p.coat)
    _head(d, sp, p, t, b, X, Y, mouth=mouth, eye=eye, ear=ear)
    if stars >= 0:
        _stars(d, p, X + hw - 7, Y - 3, stars)
    return outlined(sp, p.outline)


def sit(p, t, f=0):
    """
    Sentado de perfil, erguido y orgulloso: el anca en el suelo con el pie trasero delante, el pecho blanco hinchado,
    las dos manos rectas y la cabeza alta con las orejas paradas. `f` alterna la cola (0/1) y el jadeo.
    """
    b = BUILDS[t.size]
    W, H = b.sit_w, b.H
    sp = layer(W, H)
    d = ImageDraw.Draw(sp)
    g = H - 1
    k = b.k
    sc = lambda v: int(round(v * k))  # noqa: E731
    X, Y = b.sit_head
    hw, hh = b.head
    lw = b.leg_w
    # cola enroscada en el suelo, detrás del anca; la punta (clara) sube al menearse
    lift = sc(2) * f
    tail = [(sc(12), g), (sc(3), g), (0, g - sc(4)), (0, g - sc(9) - lift), (sc(2), g - sc(13) - lift),
            (sc(5), g - sc(12) - lift), (sc(4), g - sc(8) - lift), (sc(5), g - sc(3)), (sc(12), g - sc(3))]
    d.polygon(tail, fill=p.tail)
    d.polygon([(0, g - sc(9) - lift), (sc(2), g - sc(13) - lift), (sc(5), g - sc(12) - lift),
               (sc(3), g - sc(9) - lift)], fill=p.tail_under)
    d.line([(1, g - sc(5)), (1, g - sc(8) - lift)], fill=p.coat_light)
    # mano lejana (detrás)
    fx = X + sc(3)                 # x de la mano cercana
    R(d, fx + sc(4), g - sc(12), fx + sc(4) + lw - 1, g, p.white_shade)
    # tronco: anca redonda y torso erguido, blancos, con el manto recortado encima
    body = layer(W, H)
    bd = ImageDraw.Draw(body)
    bd.ellipse([sc(6), g - sc(18), sc(26), g], fill=p.white)
    bd.ellipse([sc(12), Y + hh - sc(9), X + sc(9), g - 1], fill=p.white)
    sx = X + sc(10)                # borde delantero del pecho
    bd.ellipse([X - sc(1), Y + hh - sc(4), sx, g - sc(4)], fill=p.white)

    def saddle(dd, shift=0):
        col = p.tan if shift else p.coat
        dd.polygon([(0, g - sc(4)), (0, 0), (X + sc(4), 0), (X + sc(3) + shift, Y + hh + sc(2)),
                    (X - sc(2) + shift, Y + hh + sc(10)), (sc(19) + shift, g - sc(7)), (sc(21) + shift, g - sc(2)),
                    (sc(12), g - sc(1) + shift)], fill=col)
    if p.tan is not None:
        _clip_paste(body, body, lambda dd: saddle(dd, sc(4)))
    _clip_paste(body, body, saddle)
    if p.saddle is not None:   # silla oscura: el lomo, de la nuca a la grupa
        _clip_paste(body, body, lambda dd: dd.polygon(
            [(0, 0), (X + sc(3), 0), (X + sc(1), Y + hh + sc(1)), (sc(17), Y + hh + sc(6)), (sc(8), g - sc(10)),
             (0, g - sc(8))], fill=p.saddle))
    bd.line([(sc(16), Y + hh - sc(7)), (X - sc(1), Y + hh - sc(7))], fill=p.coat_light)
    # muslo: un arco que dibuja la pata trasera doblada
    bd.arc([sc(9), g - sc(14), sc(23), g + sc(2)], 200, 320, fill=p.coat_dark)
    sp.alpha_composite(body)
    # pie trasero, delante del anca
    R(d, sc(11), g - 2, sc(22), g, p.white)
    R(d, sc(12), g, sc(21), g, p.white_shade)
    d.point((sc(11), g - 2), fill=p.white_shade)
    # pechera esponjosa y mano cercana, recta
    for i in range(2 + t.fluff):
        y = Y + hh + sc(1) + sc(4) * i
        d.polygon([(sx - 1, y), (sx - 1, y + sc(4)), (sx + 1, y + sc(4))], fill=p.white)
    R(d, fx, g - sc(14), fx + lw - 1, g, p.white)
    d.line([(fx, g - sc(12)), (fx, g - 3)], fill=p.white_shade)
    R(d, fx + 1, g, fx + lw - 1, g, p.white_shade)
    # nuca y cabeza
    d.polygon([(X + 2, Y + 3), (X + 8, Y + 5), (X + 3, Y + hh + 1), (X - sc(4), Y + hh + sc(4)), (X - 1, Y + 6)],
              fill=p.coat)
    _head(d, sp, p, t, b, X, Y, mouth='smile', eye='open', ear=0)
    if f == 1:   # jadeo: la lengua asoma un píxel más
        m0 = X + hw - 4
        R(d, m0 + 2, Y + hh + 2, m0 + 4, Y + hh + 2, p.tongue)
    return outlined(sp, p.outline)


def animations(p, t):
    """Las 5 animaciones de la manada: nombre -> (cuadros, fps). Mismos ritmos que las de Choco y la familia lab."""
    s = lambda **kw: stand(p, t, **kw)  # noqa: E731
    brake = ((-2, 0), (-3, 0), (3, 0), (4, 0))
    return {
        # Galope: se estira (manos adelante, patas atrás, el pecho arriba), apoya las manos, se recoge (el pecho baja),
        # apoya las patas y vuelve a estirar. El cuerpo sube y baja 2 px; las orejas van echadas atrás.
        'run': ([s(legs=((-3, 1), (-4, 0), (5, 2), (6, 1)), bob=-2, pitch=1, ear=1, mouth='open', tail=1),
                 s(legs=((-1, 2), (-2, 3), (-1, 0), (-2, 0)), bob=0, ear=1, mouth='open', tail=0),
                 s(legs=((4, 2), (5, 0), (-3, 2), (-2, 3)), bob=-2, pitch=-1, ear=1, mouth='open', tail=1),
                 s(legs=((1, 0), (0, 0), (4, 4), (3, 3)), bob=0, ear=1, mouth='open', tail=0)], 12),
        # Salto: despega estirado (pecho arriba), en la cima recoge las patas, al caer adelanta las manos
        'jump': ([s(legs=((-4, 3), (-5, 2), (5, 6), (6, 5)), bob=0, pitch=1, ear=1, mouth='open', hd=(1, 0), tail=1),
                  s(legs=((2, 6), (1, 5), (-2, 6), (-1, 5)), bob=-1, ear=1, mouth='open', tail=0),
                  s(legs=((-3, 4), (-4, 5), (5, 2), (6, 1)), bob=0, pitch=-1, ear=1, mouth='open', hd=(0, 1), tail=-1)],
                 1),
        # Choque: frena con las manos, ojos apretados, orejas atrás, la cabeza se va 3 px atrás y abajo y el pecho
        # se hunde. Estrellitas sobre la frente.
        'hurt': ([s(legs=brake, bob=2, pitch=0, eye='closed', mouth='open', hd=(-3, 2), ear=1, tail=-1, stars=0),
                  s(legs=brake, bob=3, pitch=-1, eye='closed', mouth='open', hd=(0, 3), ear=1, tail=-1, stars=1)], 8),
        'idle': ([sit(p, t, 0), sit(p, t, 1)], 3),
        # Contento: bota con las manos en alto (las orejas se van atrás en el bote) y menea la cola, lengua afuera
        'happy': ([s(legs=((0, 0), (1, 0), (2, 3), (3, 4)), bob=0, pitch=2, hd=(0, -1), mouth='open', eye='happy',
                     tail=1, ear=1),
                   s(bob=0, mouth='open', eye='happy', tail=0, ear=0)], 6),
    }


def portrait(p, t):
    """
    Busto del perro sentado: cabeza con las orejas, collar y pecho, centrados en 32×32 con el corte abajo. Se dibuja
    siempre con las medidas de `L` (la cabeza de `XL` no cabe con el collar): así todos los botones encuadran igual.
    """
    t = replace(t, size='L')
    b = BUILDS[t.size]
    sitting = sit(p, t, 0)
    X, Y = b.sit_head
    hw, hh = b.head
    left, right = X + 1 - 5, X + 1 + b.snout + 2      # del cuello a la punta de la nariz (con el contorno)
    x0 = (left + right) // 2 - 16
    top = sitting.getbbox()[1]
    bust = sitting.crop((x0, top, x0 + 32, top + 31))
    out = layer(32, 32)
    out.paste(bust, (0, 1), bust)
    return out
