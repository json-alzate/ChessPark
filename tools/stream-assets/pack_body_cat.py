"""
Cuerpo de la familia «cat» de la manada (la gatita): el mismo estilo de mascota que Choco (`dog.py`) y que los perritos
de `pack_body_small.py` (cabezona, patas cortas, contorno de 1 px con `outlined()`, paletas sin negros puros), pero con
lo que hace que se lea gato a 1×: dos orejas puntiagudas en triángulo con el dentro rosa, cara chata (nariz rosa en la
punta, sin hocico de perro), ojos grandes de gatito, cuerpo fino y una cola larga y anillada. No jadea: en vez de la
lengua de perro, la boca es una «ω» pequeña que se abre en un «miau».

Una gata de la familia es una **paleta** (`CatPackPalette`: casi toda blanca, con manchas melocotón atigradas y
manchas grises atigradas, como una calicó pálida) y una **talla** (`CatBuild`, en `BUILDS`). Las poses salen de aquí:
  - `stand()`: de pie / corriendo / saltando / choque / contento. El galope de gato dobla el lomo: `arch` lo arquea
    (se recoge) y `stretch` alarga el anca hacia atrás (se estira); `bob` y `pitch` suben y cabecean el cuerpo;
  - `sit()`: sentada, erguida, con la cola que se mece detrás.
Los sprites miran a la derecha y los pies quedan abajo (fila `H - 1` del lienzo).

Medidas (con el contorno; Luna, el perro más pequeño: lienzo de 36×31, celda 38×32, cabeza de 15×13):
  - `kitten` (la gatita): lienzo de 33×28 (celda 35×29, alto de celda 28), cabeza de 14×13, patas de 6×3. El retrato
    se dibuja aparte (busto con cabeza de 20×18), para que en el botón la cara mida como la de los perros.
La cola en `run` queda al menos 4 px por debajo del tope de la cabeza (orejas); en `happy` sube en «?», como la de un
gato contento.

Contrato: `docs/personajes/ASSETS_SPEC.md`. Python 3.9: nada de `X | Y` en los tipos.
"""
from dataclasses import dataclass

from PIL import ImageChops, ImageDraw

from pixel import C, R, layer, outlined


@dataclass(frozen=True)
class CatBuild:
    """Medidas de una talla. Las x van de izquierda (cola) a derecha (cara); las y, de arriba abajo."""
    W: int
    H: int
    leg_len: int       # de la cadera al suelo
    leg_w: int         # grosor de las patas
    depth: int         # alto del tronco
    rear: tuple        # (x0, x1) del anca
    chest: tuple       # (x0, x1) del pecho
    legs_x: tuple      # x de las patas: (trasera lejana, trasera cercana, delantera lejana, delantera cercana)
    head: tuple        # (ancho, alto) del óvalo de la cabeza
    head_x: int
    head_y: int        # y de la cabeza de pie, en reposo (el galope la sube y la baja)
    sit_w: int
    sit_x: int         # x de la cabeza sentada
    sit_y: int


BUILDS = {
    'kitten': CatBuild(W=31, H=26, leg_len=6, leg_w=3, depth=6, rear=(6, 14), chest=(11, 20), legs_x=(9, 7, 16, 14),
                       head=(14, 13), head_x=16, head_y=7, sit_w=25, sit_x=10, sit_y=4),
}


@dataclass(frozen=True)
class CatPackPalette:
    white: tuple          # el pelo blanco (cara, pecho, vientre y patas)
    white_shade: tuple    # sombra del blanco: el muslo, el vientre y el canto de las patas
    white_far: tuple      # patas lejanas
    orange: tuple         # manchas melocotón: la gorra de la cabeza y la mitad delantera del lomo
    orange_light: tuple
    stripe: tuple         # rayas del atigrado melocotón
    grey: tuple           # manchas grises: la oreja cercana, la nuca, la mitad trasera del lomo, el anca y la cola
    grey_dark: tuple      # rayas del atigrado gris y anillos de la cola
    ear_far: tuple        # la oreja lejana (melocotón en sombra)
    ear_inner: tuple      # dentro rosa de la oreja
    nose: tuple
    eye: tuple            # pupila
    iris: tuple
    eye_white: tuple
    mouth: tuple          # la «ω» y la boca abierta
    tongue: tuple
    cheek: tuple
    collar: tuple         # el color del collar de META
    collar_edge: tuple
    bell: tuple           # cascabel
    bell_mark: tuple
    outline: tuple
    lid: tuple            # ojos cerrados («>») y en arco
    star: tuple = C('#fff4c2')
    star_core: tuple = C('#ffc34d')


# --------------------------------------------------------------------------------------------------- utilidades


def _clip(dst, mask_img, draw):
    """Dibuja con `draw(ImageDraw)` en una capa aparte y la pega en `dst` solo donde `mask_img` es opaca."""
    tmp = layer(*dst.size)
    draw(ImageDraw.Draw(tmp))
    m = ImageChops.multiply(tmp.getchannel('A'), mask_img.getchannel('A'))
    dst.paste(tmp, (0, 0), m)


def _only(img, color):
    """Capa con solo los píxeles de `img` que son de `color` (para pintar rayas encima de una mancha)."""
    out = layer(*img.size)
    src, dst = img.load(), out.load()
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            if src[x, y][3] and src[x, y][:3] == color[:3]:
                dst[x, y] = src[x, y]
    return out


def _bitmap(d, x, y, rows, colors):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in colors:
                d.point((x + i, y + j), fill=colors[ch])


def _stars(d, p, x, y, f):
    """Estrellitas del golpe (dos, que se alternan de sitio), sobre la frente: las mismas que los perros."""
    for sx, sy in ((x, y), (x + 6, y + 1)) if f == 0 else ((x + 3, y - 2), (x + 9, y + 2)):
        R(d, sx - 1, sy, sx + 1, sy, p.star)
        R(d, sx, sy - 1, sx, sy + 1, p.star)
        d.point((sx, sy), fill=p.star_core)


def _ringed(d, p, pts, width=2):
    """Cola anillada: el trazo gris con un anillo oscuro cada dos tramos y la punta oscura."""
    for k, (a, b) in enumerate(zip(pts, pts[1:])):
        col = p.grey_dark if k % 2 == 1 or k == len(pts) - 2 else p.grey
        for w in range(width):
            d.line([(a[0] + w, a[1]), (b[0] + w, b[1])], fill=col)


# --------------------------------------------------------------------------------------------------- orejas

# Mapas de píxeles: e = oreja, i = dentro rosa. (dx, dy) respecto de la esquina del óvalo de la cabeza.
# 0 = arriba (reposo, contento) · 1 = algo echadas atrás (carrera y salto) · 2 = aplastadas atrás («de avión», choque).
# La oreja lejana es el mismo triángulo, más adelante, en sombra y sin el rosa.
EARS = {
    0: ((1, -4), [".e....",
                  ".ee...",
                  "eeie..",
                  "eeiie.",
                  "eeiiie"]),
    1: ((1, -4), [".e....",
                  "eie...",
                  "eiie..",
                  "eiiie.",
                  ".eeeee"]),
    2: ((-2, -1), ["eee.....",
                   ".eeiiee.",
                   "..eeeeee"]),
}
FAR_EAR = {0: (5, 1), 1: (5, 1), 2: (4, 1)}   # desplazamiento de la oreja lejana respecto de la cercana


def _ear(d, p, X, Y, state, far=False):
    (dx, dy), rows = EARS[state]
    if far:
        fx, fy = FAR_EAR[state]
        _bitmap(d, X + dx + fx, Y + dy + fy, rows, {'e': p.ear_far, 'i': p.ear_far})
    else:
        _bitmap(d, X + dx, Y + dy, rows, {'e': p.grey, 'i': p.ear_inner})


# --------------------------------------------------------------------------------------------------- cabeza


def _eye(d, p, ex, ey, state):
    """Ojo grande de gatito (3×4): iris ámbar atrás y abajo, pupila oscura y un brillo."""
    if state == 'closed':      # choque: ojo apretado, un «>»
        d.point((ex, ey), fill=p.lid)
        R(d, ex + 1, ey + 1, ex + 1, ey + 1, p.lid)
        d.point((ex + 2, ey + 2), fill=p.lid)
        d.point((ex + 1, ey + 3), fill=p.lid)
        d.point((ex, ey + 4), fill=p.lid)
    elif state == 'happy':     # contento: arco hacia arriba
        d.point((ex, ey + 2), fill=p.lid)
        R(d, ex + 1, ey + 1, ex + 1, ey + 1, p.lid)
        d.point((ex + 2, ey + 2), fill=p.lid)
    else:
        R(d, ex, ey, ex + 2, ey + 3, p.eye)
        R(d, ex, ey + 1, ex, ey + 3, p.iris)
        R(d, ex, ey + 3, ex + 1, ey + 3, p.iris)
        d.point((ex + 1, ey), fill=p.eye_white)


def _head(d, sp, p, b, X, Y, mouth='closed', eye='open', ear=0):
    """La cabeza con su collar. (X, Y) es la esquina del óvalo. `sp` hace falta para recortar la gorra y la nuca."""
    hw, hh = b.head
    _ear(d, p, X, Y, ear, far=True)
    skull = layer(*sp.size)
    sd = ImageDraw.Draw(skull)
    sd.ellipse([X, Y, X + hw - 1, Y + hh - 1], fill=p.white)
    sd.rounded_rectangle([X + hw - 5, Y + 5, X + hw, Y + hh - 2], radius=2, fill=p.white)   # morro chato
    sd.ellipse([X - 1, Y + 5, X + 5, Y + hh], fill=p.white)                                 # mejilla mullida
    sp.alpha_composite(skull)
    ex, ey = X + hw - 5, Y + 4
    # gorra melocotón: la coronilla, la nuca y detrás del ojo; la cara (del ojo para abajo) queda blanca
    cap = [(X - 2, Y + 6), (X - 2, Y - 1), (X + hw, Y - 1), (X + hw - 2, Y + 2), (ex + 2, ey - 1), (ex - 1, ey),
           (ex - 2, ey + 2), (X + 3, Y + 6), (X, Y + 7)]
    _clip(sp, skull, lambda dd: dd.polygon(cap, fill=p.orange))
    # mancha gris atigrada en la nuca, bajo la oreja cercana (la de la foto), con dos rayas
    _clip(sp, skull, lambda dd: (dd.ellipse([X - 2, Y - 1, X + 3, Y + 5], fill=p.grey),
                                 dd.line([(X, Y + 1), (X + 1, Y + 3)], fill=p.grey_dark),
                                 dd.line([(X + 2, Y), (X + 3, Y + 1)], fill=p.grey_dark)))
    # atigrado de la frente («M») y la raya de la mejilla
    for sx in (X + 4, X + 6, X + 8):
        R(d, sx, Y + 1, sx, Y + 2, p.stripe)
    d.point((X + 1, Y + 3), fill=p.stripe)
    d.point((X + 2, Y + 4), fill=p.stripe)
    d.point((X + 5, Y), fill=p.orange_light)
    d.point((X + 7, Y), fill=p.orange_light)
    _eye(d, p, ex, ey, eye)
    # nariz rosa en la punta del morro, la «ω» y el rubor
    nx, ny = X + hw, Y + 6
    d.point((nx - 1, ny), fill=p.nose)
    d.point((nx, ny), fill=p.nose)
    d.point((nx, ny + 1), fill=p.nose)
    if mouth == 'open':      # «miau»: boca abierta pequeña, con el rosa dentro
        R(d, nx - 2, ny + 2, nx - 1, ny + 4, p.mouth)
        d.point((nx - 1, ny + 4), fill=p.tongue)
        d.point((nx, ny + 2), fill=p.mouth)
    else:
        d.point((nx, ny + 2), fill=p.mouth)
        d.point((nx - 1, ny + 3), fill=p.mouth)
    d.point((ex - 1, ey + 5), fill=p.cheek)
    # collar: una banda inclinada en el cuello, de la nuca a la garganta, con borde y cascabel
    cy = Y + hh - 4
    for i, (x0, x1) in enumerate(((-2, 2), (-2, 3), (-1, 4), (0, 4))):
        R(d, X + x0, cy + i, X + x1, cy + i, p.collar_edge if i in (0, 3) else p.collar)
    bx, by = X + 3, cy + 4
    R(d, bx - 1, by, bx + 1, by + 1, p.bell)
    d.point((bx, by + 1), fill=p.bell_mark)
    _ear(d, p, X, Y, ear)


# --------------------------------------------------------------------------------------------------- cuerpo


def _leg(d, b, x, y0, foot, color, paw, edge=None):
    """Pata fina de la cadera (x, y0) al pie. `foot` = (dx, lift): cuánto se adelanta el pie y cuánto se levanta."""
    dx, lift = foot
    w = b.leg_w
    y1 = b.H - 1 - lift
    d.polygon([(x, y0), (x + w - 1, y0), (x + dx + w - 1, y1), (x + dx, y1)], fill=color)
    if edge is not None:
        d.line([(x, y0 + 2), (x + dx, y1 - 1)], fill=edge)
    R(d, x + dx, y1, x + dx + w, y1, paw)   # la manita redonda, 1 px más larga hacia delante


# Colas desde la raíz en el anca (dx, dy).
TAILS = {
    'back': [(0, 0), (-2, -1), (-3, -3), (-4, -4), (-4, -6)],     # carrera estirada: atrás, con la punta arriba
    'swing': [(0, 0), (-2, 0), (-3, -2), (-4, -4), (-4, -6)],    # carrera recogida: más baja y abierta
    'down': [(0, 0), (-2, 1), (-4, 3), (-5, 5)],                 # choque: caída
    'balance': [(0, 0), (-2, -1), (-3, -3), (-4, -4), (-5, -4)],  # caída del salto: atrás y algo alta, de timón
    'q': [(0, 0), (-1, -2), (-2, -5), (-2, -8), (-1, -10), (1, -11), (2, -10)],   # contenta: «?» alta
    'q2': [(0, 0), (-2, -2), (-3, -5), (-3, -8), (-2, -10), (0, -11), (1, -10)],
}


def stand(p, b, legs=((0, 0),) * 4, bob=0, pitch=0, arch=0, stretch=0, tail='back', hd=(0, 0), mouth='closed',
          eye='open', ear=0, stars=-1):
    """
    De pie / corriendo / saltando. `legs` = 4 pies (dx, lift) en orden lejana-trasera, cercana-trasera,
    lejana-delantera, cercana-delantera. `bob` sube (−) o baja (+) todo el cuerpo; `pitch` sube (+) el pecho respecto
    del anca; `arch` arquea el lomo (px); `stretch` lleva el anca atrás (+) o adelante (−); `hd` mueve la cabeza.
    """
    sp = layer(b.W, b.H)
    d = ImageDraw.Draw(sp)
    rb, fb = bob, bob - pitch
    hip = b.H - 1 - b.leg_len
    top = hip - b.depth
    (rx0, rx1), (cx0, cx1) = b.rear, b.chest
    rx0, rx1 = rx0 - stretch, rx1 - stretch
    lfr, lnr, lff, lnf = b.legs_x
    lfr, lnr = lfr - stretch, lnr - stretch
    # patas lejanas (en sombra)
    _leg(d, b, lfr, hip + rb, legs[0], p.white_far, p.white_far)
    _leg(d, b, lff, hip + fb, legs[2], p.white_far, p.white_far)
    # cola anillada, desde el anca
    rx, ry = rx0 + 1, top + 2 + rb
    _ringed(d, p, [(rx + x, ry + y) for x, y in TAILS[tail]])
    # tronco fino: anca, pecho, y el lomo que se arquea en medio
    body = layer(b.W, b.H)
    bd = ImageDraw.Draw(body)
    mid = (rb + fb) // 2
    bd.ellipse([rx0, top + rb, rx1, hip + 1 + rb], fill=p.white)
    bd.ellipse([cx0, top - 1 + fb, cx1, hip + 1 + fb], fill=p.white)
    bd.polygon([(rx0 + 4, top + rb), (cx0 + 5, top - 1 + fb), (cx0 + 5, hip + fb), (rx0 + 4, hip + rb)],
               fill=p.white)
    if arch > 0:
        mx = (rx0 + cx1) // 2
        bd.ellipse([mx - 6, top - arch + mid, mx + 5, hip - 1 + mid], fill=p.white)
    # silla partida del lomo, que deja el flanco blanco: melocotón atigrado de la cruz a media espalda y, detrás, gris
    # atigrado de media espalda al anca (la elipse gris del anca, alargada hacia delante)
    saddle = [(rx0 - 1, top - arch - 2 + rb), (cx0 + 4, top - 3 + fb), (cx0 + 3, top + 2 + fb),
              (rx1, top + 3 + rb), (rx0 + 2, top + 4 + rb)]
    sx = (rx0 + cx0) // 2 + 3          # dónde se parte la silla
    back = [(rx0 - 2, top - arch - 3 + rb), (sx, top - arch - 3 + mid), (sx - 2, top + 3 + rb), (rx0 - 2, top + 3 + rb)]
    _clip(body, body, lambda dd: dd.polygon(saddle, fill=p.orange))
    _clip(body, body, lambda dd: (dd.polygon(back, fill=p.grey),
                                  dd.ellipse([rx0 - 1, top - 1 + rb, rx0 + 4, top + 4 + rb], fill=p.grey)))
    orange, grey = _only(body, p.orange), _only(body, p.grey)

    def stripes(dd, xs, col):
        for x in xs:
            yy = top - arch - 2 + (rb if x < (rx1 + cx0) // 2 else fb)
            dd.line([(x, yy), (x - 1, yy + 6)], fill=col)

    _clip(body, orange, lambda dd: stripes(dd, range(sx + 1, cx1 - 2, 3), p.stripe))
    _clip(body, grey, lambda dd: stripes(dd, (rx0 + 1, rx0 + 3, rx0 + 6, sx - 1), p.grey_dark))
    sp.alpha_composite(body)
    d.line([(rx0 + 5, hip + rb), (cx0 + 5, hip + fb)], fill=p.white_shade)   # vientre en sombra
    d.arc([rx0 + 1, top + 2 + rb, rx1 - 1, hip + 3 + rb], 200, 330, fill=p.white_shade)   # muslo
    # patas cercanas
    _leg(d, b, lnr, hip + rb, legs[1], p.white, p.white, edge=p.white_shade)
    _leg(d, b, lnf, hip + fb, legs[3], p.white, p.white, edge=p.white_shade)
    # cabeza y la nuca que la une al lomo
    hw, hh = b.head
    X, Y = b.head_x + hd[0], b.head_y + fb + hd[1]
    d.polygon([(X + 2, Y + 3), (X + 8, Y + 6), (X + 4, Y + hh), (cx0 + 3, top + fb), (X, Y + 4)], fill=p.white)
    _head(d, sp, p, b, X, Y, mouth=mouth, eye=eye, ear=ear)
    if stars >= 0:
        _stars(d, p, X + hw - 11, Y - 3, stars)
    return outlined(sp, p.outline)


# Colas de la gata sentada: sube detrás del anca y la punta se mece.
SIT_TAILS = {0: [(0, 0), (-2, -1), (-3, -3), (-3, -6), (-2, -8)],
             1: [(0, 0), (-2, -1), (-4, -3), (-5, -5), (-5, -8)]}


def sit(p, b, f=0):
    """Sentada de perfil, erguida: el anca en el suelo, el pie trasero delante, las manos rectas. `f` mece la cola."""
    W, H = b.sit_w, b.H
    sp = layer(W, H)
    d = ImageDraw.Draw(sp)
    g = H - 1
    X, Y = b.sit_x, b.sit_y
    hw, hh = b.head
    lw = b.leg_w
    hx = X - 6                     # borde de atrás del anca
    _ringed(d, p, [(hx + 2 + x, g - 3 + y) for x, y in SIT_TAILS[f]])
    # mano lejana (asoma 1 px delante de la cercana), anca y torso erguido con el pecho mullido
    R(d, X + 5, g - 8, X + 4 + lw, g, p.white_far)
    body = layer(W, H)
    bd = ImageDraw.Draw(body)
    bd.ellipse([X - 3, Y + hh - 5, X + 8, g - 3], fill=p.white)
    bd.ellipse([hx, g - 10, X + 4, g], fill=p.white)
    # manchas del lomo: melocotón en la cruz y, de media espalda al anca, gris atigrado; el costado queda blanco
    _clip(body, body, lambda dd: dd.polygon(
        [(hx - 1, g - 4), (hx - 1, g - 12), (X - 3, Y + hh - 6), (X + 1, Y + hh - 6), (X - 2, g - 10),
         (hx + 5, g - 6)], fill=p.orange))
    _clip(body, body, lambda dd: dd.ellipse([hx - 1, g - 12, hx + 5, g - 2], fill=p.grey))
    orange, grey = _only(body, p.orange), _only(body, p.grey)

    def stripes(dd, ys, col):
        for y in ys:
            dd.line([(hx - 1, y), (X + 2, y - 2)], fill=col)

    _clip(body, orange, lambda dd: stripes(dd, range(Y + hh - 3, g - 3, 3), p.stripe))
    _clip(body, grey, lambda dd: stripes(dd, (g - 10, g - 7, g - 4), p.grey_dark))
    sp.alpha_composite(body)
    d.arc([hx + 2, g - 9, X + 2, g + 3], 200, 320, fill=p.white_shade)     # muslo de la pata doblada
    R(d, hx + 4, g - 1, X + 2, g, p.white)                                   # pie trasero
    R(d, X + 3, g - 9, X + 2 + lw, g, p.white)                              # mano cercana
    R(d, X + 2, g - 4, X + 2, g - 1, p.white_shade)                          # su canto de atrás, en sombra
    R(d, X + 3, g, X + 3 + lw, g, p.white)
    # nuca y cabeza
    d.polygon([(X + 2, Y + 3), (X + 8, Y + 5), (X + 3, Y + hh + 1), (X - 4, Y + hh + 3), (X - 1, Y + 6)],
              fill=p.orange)
    _head(d, sp, p, b, X, Y, mouth='closed', eye='open', ear=0)
    return outlined(sp, p.outline)


def animations(p, b):
    """Las 5 animaciones de la manada: nombre -> (cuadros, fps). Mismos ritmos que los perros."""
    s = lambda **kw: stand(p, b, **kw)  # noqa: E731
    brake = ((-2, 0), (-2, 0), (2, 0), (3, 0))
    return {
        # Galope de gato: se estira (manos adelante, patas atrás, lomo largo y plano), apoya las manos, se recoge (el
        # lomo se arquea y las patas traseras pasan bajo el vientre), apoya las patas y vuelve a estirarse.
        'run': ([s(legs=((-3, 1), (-3, 0), (3, 2), (4, 1)), bob=-2, pitch=1, stretch=1, ear=1, tail='back'),
                 s(legs=((0, 1), (-2, 2), (1, 0), (-1, 0)), bob=0, arch=1, ear=1, tail='swing'),
                 s(legs=((2, 1), (3, 0), (-2, 2), (-1, 3)), bob=-2, pitch=-1, arch=3, stretch=-1, ear=1,
                   tail='back'),
                 s(legs=((2, 0), (0, 0), (4, 3), (2, 2)), bob=0, arch=1, ear=1, tail='swing')], 12),
        # Salto: despega estirada (pecho arriba), en la cima recoge las patas, al caer adelanta las manos
        'jump': ([s(legs=((-3, 2), (-4, 1), (3, 4), (4, 3)), bob=0, pitch=2, stretch=1, ear=1, tail='back'),
                  s(legs=((2, 4), (1, 3), (-2, 4), (-1, 3)), bob=-1, arch=2, ear=1, tail='swing'),
                  s(legs=((-3, 3), (-4, 4), (3, 1), (4, 1)), bob=0, pitch=-1, stretch=1, ear=1, tail='balance')], 1),
        # Choque: frena con las manos, ojos apretados en «>», orejas aplastadas atrás, la cabeza gacha que se sacude
        # 3 px y el lomo que se encoge; estrellitas sobre la frente
        'hurt': ([s(legs=brake, bob=1, pitch=0, arch=1, eye='closed', mouth='open', hd=(-3, 2), ear=2, tail='down',
                    stars=0),
                  s(legs=brake, bob=2, pitch=-1, arch=1, eye='closed', mouth='open', hd=(0, 1), ear=2, tail='down',
                    stars=1)], 8),
        'idle': ([sit(p, b, 0), sit(p, b, 1)], 3),
        # Contenta: bota con las manos en alto, la cola en «?» que se mece, ojos en arco y un «miau»
        'happy': ([s(legs=((0, 0), (1, 0), (2, 3), (3, 4)), bob=0, pitch=2, hd=(0, -1), mouth='open', eye='happy',
                     tail='q', ear=0),
                   s(legs=((-1, 0), (0, 0), (1, 0), (2, 0)), bob=0, mouth='closed', eye='happy', tail='q2', ear=0)], 6),
    }


def portrait(p, b):
    """
    Busto para botones (32×32), dibujado aparte a la escala de los retratos de los perros: con el sprite de 1× la
    gata entera cabría en el botón y la cara se quedaría en la mitad que las de los demás. Cabeza de 20×18 con las dos
    orejas (la cercana gris, la lejana melocotón), la gorra melocotón atigrada con la nuca gris, el ojo miel, la nariz rosa, el collar con el cascabel y el pecho; corte abajo.
    """
    W, H = 30, 32
    sp = layer(W, H)
    d = ImageDraw.Draw(sp)
    # oreja lejana (melocotón en sombra, detrás) y pecho
    d.polygon([(16, 11), (19, 2), (23, 11)], fill=p.ear_far)
    body = layer(W, H)
    bd = ImageDraw.Draw(body)
    bd.ellipse([1, 21, 23, 44], fill=p.white)
    _clip(body, body, lambda dd: dd.polygon([(0, 20), (9, 20), (6, 26), (2, 32), (0, 32)], fill=p.orange))
    _clip(body, body, lambda dd: dd.ellipse([-2, 27, 4, 36], fill=p.grey))
    _clip(body, _only(body, p.orange), lambda dd: [dd.line([(x, 21), (x - 2, 27)], fill=p.stripe) for x in (3, 6)])
    sp.alpha_composite(body)
    R(d, 16, 29, 17, 31, p.white_shade)
    # cabeza: cráneo, mejilla mullida y morro chato
    skull = layer(W, H)
    sd = ImageDraw.Draw(skull)
    sd.ellipse([6, 7, 25, 24], fill=p.white)
    sd.ellipse([4, 14, 13, 26], fill=p.white)
    sd.rounded_rectangle([20, 14, 27, 23], radius=3, fill=p.white)
    sp.alpha_composite(skull)
    cap = [(3, 17), (3, 5), (27, 5), (25, 10), (22, 11), (18, 12), (16, 15), (11, 17), (7, 21)]
    _clip(sp, skull, lambda dd: dd.polygon(cap, fill=p.orange))
    # mancha gris atigrada en la nuca, bajo la oreja cercana, con dos rayas
    _clip(sp, skull, lambda dd: (dd.ellipse([3, 5, 11, 14], fill=p.grey),
                                 dd.line([(5, 10), (7, 13)], fill=p.grey_dark),
                                 dd.line([(8, 8), (9, 10)], fill=p.grey_dark)))
    for sx in (11, 14, 17):                         # la «M» de la frente
        R(d, sx, 8, sx, 10, p.stripe)
    d.point((20, 9), fill=p.stripe)
    for k in range(3):                              # rayas de la mejilla, detrás del ojo
        d.point((7 + k, 13 + k), fill=p.stripe)
    d.point((6, 16), fill=p.stripe)
    R(d, 12, 7, 15, 7, p.orange_light)
    # oreja cercana, gris con el dentro rosa (la lejana, detrás, melocotón en sombra)
    d.polygon([(8, 11), (10, 0), (16, 9)], fill=p.grey)
    d.polygon([(10, 9), (11, 3), (14, 9)], fill=p.ear_inner)
    # ojo grande de gatito: iris miel atrás y abajo, pupila y dos brillos
    ex, ey = 19, 13
    R(d, ex, ey, ex + 3, ey + 4, p.eye)
    R(d, ex, ey + 1, ex, ey + 4, p.iris)
    R(d, ex, ey + 4, ex + 2, ey + 4, p.iris)
    R(d, ex + 1, ey, ex + 2, ey, p.eye_white)
    d.point((ex + 1, ey + 1), fill=p.eye_white)
    # nariz, boca «ω» y rubor
    R(d, 27, 17, 28, 17, p.nose)
    d.point((28, 18), fill=p.nose)
    d.point((28, 19), fill=p.mouth)
    d.point((27, 20), fill=p.mouth)
    d.point((26, 19), fill=p.mouth)
    R(d, 18, 20, 19, 20, p.cheek)
    # collar inclinado bajo la cabeza, con el cascabel
    for i, (x0, x1) in enumerate(((5, 10), (5, 12), (6, 14), (7, 15))):
        R(d, x0, 23 + i, x1, 23 + i, p.collar_edge if i in (0, 3) else p.collar)
    R(d, 11, 27, 14, 29, p.bell)
    R(d, 12, 29, 13, 29, p.bell_mark)
    d.point((12, 27), fill=C('#fff1a8'))
    out = layer(32, 32)
    full = outlined(sp, p.outline)
    out.paste(full.crop((0, 0, 32, 31)), (0, 1))
    return out
