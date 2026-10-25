"""
Cuerpo compartido de la familia «small» de la manada (Romeo, Maryluna y Luna): los perritos. El mismo estilo de mascota
que Choco (`dog.py`) y que las familias lab y husky: cabezón, patas cortas y gruesas, tronco corto, lengua afuera y
contorno de 1 px con `outlined()`; aquí la cabeza es aún más grande respecto del cuerpo, porque son los pequeños.

Un perro de la familia es una **paleta** (`SmallPalette`), unos **rasgos** (`SmallTraits`: forma de oreja, pelo áspero,
hirsuto o liso, ojos, cola, barba) y una **talla** (`SmallBuild`, en `BUILDS`: `S–M` para Romeo, `S` para Maryluna y
`toy` para Luna, la chihuahua). Las poses (de pie/corriendo, salto, choque, sentado, contento) salen de aquí. Los sprites
miran a la derecha y los pies quedan abajo (fila `GY = H - 1` del lienzo).

Medidas (con el contorno; Choco: lienzo de 52×40, cabeza de 18×18, patas de 9×5, celda 54×43):
  - `S–M` (Romeo): lienzo de 43×35 (celda 45×36), cabeza de 18×14 (plana, de terrier), patas de 8×4;
  - `S` (Maryluna): lienzo de 39×33 (celda 41×34), cabeza de 16×14, patas de 8×4;
  - `toy` (Luna): lienzo de 36×31 (celda 38×32), cabeza de 15×13 (de manzana: la mayor para su cuerpo), patas de 7×3.
El lienzo del salto es el de pie, así que su alto marca la celda. Al correr, la oreja semicaída se echa atrás, pegada a la
nuca; las paradas (Maryluna y Luna) se van atrás a unos 45°, que es como corren esas razas y lo que dibuja su silueta.
La cola queda al menos 4 px por debajo de la cabeza, que es el punto más alto.

Contrato: `docs/personajes/ASSETS_SPEC.md`. Python 3.9: nada de `X | Y` en los tipos.
"""
from dataclasses import dataclass

from PIL import ImageChops, ImageDraw

from pixel import C, R, layer, outlined


@dataclass(frozen=True)
class SmallBuild:
    """Medidas de una talla. Las x van de izquierda (cola) a derecha (hocico); las y, de arriba abajo."""
    W: int
    H: int
    leg_len: int       # de la cadera al suelo
    leg_w: int         # grosor de las patas
    depth: int         # alto del tronco
    rear: tuple        # (x0, x1) del anca
    chest: tuple       # (x0, x1) del pecho
    legs_x: tuple      # x de las patas: (trasera lejana, trasera cercana, delantera lejana, delantera cercana)
    head: tuple        # (ancho, alto) del óvalo de la cabeza
    head_x: int        # x de la cabeza de pie
    head_y: int        # y de la cabeza de pie, en reposo (el galope la sube 2–3 px)
    snout: int         # borde derecho del hocico, en coordenadas de la cabeza
    gait: float        # escala del galope y del salto (cuánto se abren y se levantan las patas)
    sit_w: int
    sit_k: float       # escala del cuerpo sentado respecto del de la familia lab
    sit_x: int         # x de la cabeza sentado
    sit_y: int         # y de la cabeza sentado


BUILDS = {
    'S–M': SmallBuild(W=41, H=33, leg_len=8, leg_w=4, depth=8, rear=(4, 14), chest=(8, 21), legs_x=(7, 4, 15, 11),
                      head=(18, 14), head_x=17, head_y=9, snout=21, gait=0.75, sit_w=36, sit_k=0.8, sit_x=14,
                      sit_y=5),
    'S': SmallBuild(W=37, H=31, leg_len=8, leg_w=4, depth=7, rear=(4, 12), chest=(8, 20), legs_x=(6, 4, 15, 11),
                    head=(16, 14), head_x=16, head_y=10, snout=18, gait=0.7, sit_w=34, sit_k=0.72, sit_x=13,
                    sit_y=8),
    'toy': SmallBuild(W=34, H=29, leg_len=7, leg_w=3, depth=7, rear=(4, 11), chest=(8, 18), legs_x=(6, 4, 13, 10),
                      head=(15, 13), head_x=14, head_y=10, snout=16, gait=0.6, sit_w=31, sit_k=0.62, sit_x=11,
                      sit_y=10),
}


@dataclass(frozen=True)
class SmallPalette:
    body: tuple
    light: tuple          # reflejo del lomo y de la frente
    dark: tuple           # patas lejanas, sombra del vientre y trazos del pelo
    ear: tuple
    ear_inner: tuple      # dentro de la oreja (orejas paradas) o el doblez (semicaídas)
    ear_light: tuple      # el canto que coge la luz
    tail: tuple
    muzzle: tuple
    muzzle_light: tuple
    nose: tuple
    chest: tuple          # garganta y pecho
    chest_shade: tuple
    paw: tuple            # base de las patas cercanas
    paw_far: tuple        # base de las patas lejanas
    collar: tuple         # el color del collar de META (en Maryluna, la franja rosa)
    collar_edge: tuple
    tag: tuple
    tag_mark: tuple
    outline: tuple
    collar_band: tuple = None   # banda del collar si no es `collar` (Maryluna: negra, con la franja rosa en medio)
    head: tuple = None          # cabeza de otro color que el cuerpo (Maryluna: canela sobre el cuerpo crema)
    saddle: tuple = None        # manchas del lomo y del anca (Maryluna)
    face: tuple = None          # antifaz claro de la cara, alrededor del ojo y del hocico (Luna, Maryluna)
    grizzle: tuple = None       # canas del hocico y de la barbilla (Romeo)
    tuft: tuple = None          # mechones del pelo áspero o hirsuto (cejas, barba, lomo)
    tuft_dark: tuple = None     # el lado en sombra de los mechones
    leg: tuple = None           # patas de otro color que el cuerpo (Maryluna: crema)
    leg_far: tuple = None
    ear_far: tuple = None       # la oreja lejana (si no, `dark`)
    beard: tuple = None         # barba y cejas (si no, `tuft`)
    head_rim: tuple = None      # sombra de la nuca: separa la cabeza del lomo cuando son del mismo color
    ear_shadow: tuple = None    # sombra que la solapa semicaída echa sobre el cráneo (si no, `outline`)
    eye: tuple = C('#1a100c')
    eye_rim: tuple = None       # borde del ojo grande (Luna)
    tongue: tuple = C('#ff8aa1')
    tongue_shade: tuple = C('#e0587a')
    mouth_dark: tuple = C('#4a1420')
    mouth_line: tuple = None    # si no, `dark`
    eye_white: tuple = C('#ffffff')
    cheek: tuple = C('#e98f96')
    lid: tuple = None           # ojos cerrados o en arco (si no, `outline`)
    star: tuple = C('#fff4c2')
    star_core: tuple = C('#ffc34d')


@dataclass(frozen=True)
class SmallTraits:
    build: str = 'S'         # 'S–M' | 'S' | 'toy' (ver BUILDS)
    ear: str = 'semi'        # 'semi' (semicaída, la punta doblada) · 'prick' (parada) · 'bat' (enorme, de chihuahua)
    coat: str = 'smooth'     # 'smooth' (liso) · 'wiry' (áspero: cejas, barba y mechones sueltos) · 'shaggy' (hirsuto)
    tail: str = 'sickle'     # 'low' (baja, recta y áspera) · 'flag' (alta y peluda) · 'sickle' (fina, en hoz)
    eyes: str = 'normal'     # 'normal' · 'big' (redondos y saltones, con brillo doble)
    face: str = 'mask'       # dibujo de `face`: 'mask' (antifaz alrededor del ojo) · 'muzzle' (solo bajo el ojo)
    far_ear: bool = False    # la otra oreja asoma detrás (orejas paradas: se leen las dos)
    happy_ear: int = 0       # oreja del 2.º cuadro de `happy`
    portrait_shift: tuple = (0, 0)   # (dx, dy) del recorte del retrato: + corre el encuadre a la derecha y abajo


# --------------------------------------------------------------------------------------------------- utilidades


def _clip_paste(dst, mask_img, draw):
    """Dibuja con `draw(ImageDraw)` en una capa aparte y la pega en `dst` solo donde `mask_img` es opaca."""
    tmp = layer(*dst.size)
    draw(ImageDraw.Draw(tmp))
    m = ImageChops.multiply(tmp.getchannel('A'), mask_img.getchannel('A'))
    dst.paste(tmp, (0, 0), m)


def _bitmap(d, x, y, rows, colors):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in colors:
                d.point((x + i, y + j), fill=colors[ch])


def _stroke(d, pts, color, width=2):
    """Trazo continuo de `width` px (sin huecos entre filas, para que el contorno no lo «raye»)."""
    for k in range(width):
        d.line([(x + k, y) for x, y in pts], fill=color)


def _tuft(d, x, y, direction, color, size=2):
    """Mechón: un triangulito de `size` px que rompe la silueta. `direction`: 'up', 'down', 'back' (izquierda) o 'fwd'."""
    s = size
    if direction == 'up':
        d.polygon([(x, y), (x + s, y), (x - 1, y - s)], fill=color)
    elif direction == 'down':
        d.polygon([(x, y), (x + s, y), (x - 1, y + s)], fill=color)
    elif direction == 'back':
        d.polygon([(x, y), (x, y + s), (x - s, y + s + 1)], fill=color)
    else:
        d.polygon([(x, y), (x, y + s), (x + s, y + s + 1)], fill=color)


def _stars(d, p, x, y, f):
    """Estrellitas del golpe (dos, que se alternan de sitio), sobre la frente y por delante de la oreja."""
    for sx, sy in ((x, y), (x + 6, y + 1)) if f == 0 else ((x + 3, y - 2), (x + 9, y + 2)):
        R(d, sx - 1, sy, sx + 1, sy, p.star)
        R(d, sx, sy - 1, sx, sy + 1, p.star)
        d.point((sx, sy), fill=p.star_core)


# --------------------------------------------------------------------------------------------------- orejas

# Mapas de píxeles: e = oreja, i = dentro (o doblez), l = canto con luz, t = mechón claro, s = sombra bajo la solapa.
# (dx, dy) = esquina del mapa respecto de la esquina del óvalo de la cabeza. 0 = reposo · 1 = echada atrás (carrera, salto, choque y bote de
# contento): la semicaída, tumbada sobre la nuca; las paradas, a unos 45° y con la punta hacia atrás, no hacia arriba.
EARS = {
    # Romeo: semicaída, una solapa: nace atrás y arriba del cráneo (lo más alto, 2 px sobre él) y el canto baja hacia
    # delante hasta la punta doblada, que cae sobre la sien a la altura del ojo; casi todo lo que se ve es el doblez
    'semi': {
        0: ((1, -2), ["..ll......",
                      ".eelll....",
                      "eeeefffl..",
                      "eeefffffl.",
                      ".eefffffff",
                      "...sffffff",
                      ".....sffff",
                      ".......sff",
                      ".........s"]),
        1: ((-4, -1), ["....leee..",
                       ".iieeeeee.",
                       "iiieeee...",
                       "ii........"]),
    },
    # Maryluna: grande y parada, con el dentro oscuro y un mechón claro en la punta
    'prick': {
        0: ((2, -8), ["..t....",
                      "..ee...",
                      ".eie...",
                      ".eiie..",
                      ".eiiie.",
                      "eiiiie.",
                      "eiiiiee",
                      "eeiiiee",
                      "eeeeeee"]),
        1: ((0, -3), ["te.........",
                      ".eiee......",
                      ".eiiee.....",
                      ".eiiiieee..",
                      "..eeeeeeeee"]),
    },
    # Luna: enorme, de chihuahua: un triángulo ancho que sube detrás del cráneo, con el dentro rosa
    'bat': {
        0: ((-1, -10), ["e.........",
                        "ee........",
                        "eie.......",
                        "eiie......",
                        "eiiie.....",
                        "eiiiie....",
                        ".eiiiie...",
                        ".eiiiiie..",
                        ".eeiiiiee.",
                        "..eeiiieee",
                        "..eeeeeeee"]),
        1: ((-2, -4), [".eie.......",
                       ".eiie......",
                       "..eiiie....",
                       "..eiiiieee.",
                       "...eeeeeeee"]),
    },
}


def _ear(d, p, t, X, Y, state, far=False):
    (dx, dy), rows = EARS[t.ear][state]
    if far:   # la oreja lejana asoma detrás, más adelante y en sombra
        c = p.ear_far or p.dark
        colors = {'e': c, 'i': c, 'f': c, 'l': c, 't': c, 's': c}
        _bitmap(d, X + dx + 4, Y + dy + 1, rows, colors)
        return
    colors = {'e': p.ear, 'i': p.ear_inner, 'f': p.ear_inner, 'l': p.ear_light, 't': p.tuft or p.ear_light,
              's': p.ear_shadow or p.outline}
    _bitmap(d, X + dx, Y + dy, rows, colors)


# --------------------------------------------------------------------------------------------------- cabeza


def _eye(d, p, t, ex, ey, state):
    lid = p.lid or p.outline
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
    elif t.eyes == 'big':      # ojos saltones: 4×5 redondeado, con borde y dos brillos
        if p.eye_rim is not None:
            R(d, ex - 1, ey, ex - 1, ey + 3, p.eye_rim)
            R(d, ex, ey + 4, ex + 3, ey + 4, p.eye_rim)
        R(d, ex, ey, ex + 3, ey + 3, p.eye)
        d.point((ex + 3, ey + 4), fill=p.eye)
        R(d, ex + 1, ey, ex + 2, ey, p.eye_white)
        d.point((ex + 1, ey + 1), fill=p.eye_white)
        d.point((ex + 3, ey + 3), fill=p.eye_white)
    else:
        R(d, ex, ey, ex + 2, ey + 3, p.eye)
        d.point((ex + 1, ey), fill=p.eye_white)


def _head(d, sp, p, t, b, X, Y, mouth='smile', eye='open', ear=0):
    """La cabeza con su collar. (X, Y) es la esquina del óvalo de la cabeza. `sp` hace falta para recortar el antifaz."""
    hw, hh = b.head
    s = b.snout
    big = t.eyes == 'big'
    if ear == 0 and t.far_ear:
        _ear(d, p, t, X, Y, 0, far=True)
    skull = layer(*sp.size)
    ImageDraw.Draw(skull).ellipse([X, Y, X + hw - 1, Y + hh - 1], fill=p.head or p.body)
    sp.alpha_composite(skull)
    if p.head_rim is not None:
        d.arc([X, Y, X + hw - 1, Y + hh - 1], 170, 225, fill=p.head_rim)
    R(d, X + 5, Y + 1, X + hw - 7, Y + 1, p.light)
    m = Y + hh - 8                          # fila de arriba del hocico (el puente)
    ex, ey = X + hw - (7 if big else 6), m - (4 if big else 3)
    if p.face is not None:   # antifaz claro: rodea el ojo y baja por el hocico y la mejilla
        if t.face == 'muzzle':   # el ojo queda en el color de la cabeza; lo claro es el hocico y la mejilla
            face = [(ex - 4, ey + 5), (ex + 3, ey + 4), (X + hw, ey + 3), (X + hw, Y + hh), (ex - 4, Y + hh)]
        else:
            face = [(ex - 2, ey - 1), (ex + 2, ey - 2), (X + hw, ey), (X + hw, Y + hh), (ex - 4, Y + hh),
                    (ex - 3, ey + 3)]
        _clip_paste(sp, skull, lambda dd: dd.polygon(face, fill=p.face))
    # hocico
    d.rounded_rectangle([X + hw - 6, m, X + s, Y + hh - 2], radius=2, fill=p.muzzle)
    R(d, X + hw - 5, Y + hh - 3, X + s - 1, Y + hh - 2, p.muzzle_light)
    if p.grizzle is not None:   # canas: bajo el ojo, a los lados de la nariz, en la mejilla y en la barbilla
        for gx, gy in ((hw - 7, 0), (hw - 6, 1), (hw - 6, 2), (hw - 5, 4), (hw - 7, 4), (hw - 4, 1)):
            d.point((X + gx, m + gy), fill=p.grizzle)
        R(d, X + hw - 3, Y + hh - 2, X + s - 3, Y + hh - 2, p.grizzle)
    R(d, X + s - 1, m, X + s, m + 2, p.nose)
    d.point((X + s - 2, m), fill=p.nose)
    if big:   # chihuahua: nariz redonda y grande en un hocico corto
        R(d, X + s - 2, m, X + s, m + 2, p.nose)
        d.point((X + s - 1, m), fill=p.eye_white)
    # ojo y ceja
    _eye(d, p, t, ex, ey, eye)
    rough = t.coat in ('wiry', 'shaggy')
    if rough and eye != 'closed':
        # cejas de pelo áspero: un mechón claro sobre el ojo que sale hacia delante
        col = p.beard or p.tuft or p.light
        R(d, ex - 1, ey - 1, ex + 2, ey - 1, col)
        R(d, ex + 1, ey - 2, ex + 3, ey - 2, col)
        if t.coat == 'shaggy' and ear == 0:   # el pelo suelto de la ceja (al correr haría un pico ante la oreja)
            d.point((ex + 4, ey - 3), fill=col)
    elif eye == 'open' and not big:
        R(d, ex, ey - 1, ex + 2, ey - 1, p.light)
    d.point((X + hw - 8, m + 3), fill=p.cheek)
    # boca
    line = p.mouth_line or p.dark
    m0 = X + hw - 4
    if mouth == 'smile':
        R(d, m0, Y + hh - 3, X + s - 2, Y + hh - 3, line)
        d.point((m0 - 1, Y + hh - 4), fill=line)
        R(d, m0 + 2, Y + hh - 2, m0 + 3, Y + hh + 1, p.tongue)
        d.point((m0 + 2, Y + hh), fill=p.tongue_shade)
    else:   # 'open': jadeando (la cabeza más pequeña lleva la lengua 1 px más estrecha)
        tw = 3 if hw >= 16 else 2
        R(d, m0, Y + hh - 4, X + s - 1, Y + hh - 2, p.mouth_dark)
        R(d, m0 + 1, Y + hh - 1, X + s - 2, Y + hh - 1, p.muzzle_light)
        R(d, m0 + 1, Y + hh - 3, m0 + 1 + tw, Y + hh, p.tongue)
        R(d, m0 + 2, Y + hh - 2, m0 + tw, Y + hh - 1, p.tongue_shade)
    if rough:
        # barba: cuelga de la mandíbula, por detrás de la lengua, y un mechón en la punta de la barbilla
        bc, bdk = p.beard or p.tuft or p.muzzle, p.tuft_dark or p.muzzle_light
        n = 2 if t.coat == 'wiry' else 3
        x0 = X + hw - 6
        d.polygon([(x0, Y + hh - 2), (m0, Y + hh - 2), (m0, Y + hh - 2 + n), (x0 + 1, Y + hh - 3 + n)], fill=bc)
        d.point((x0 + 1, Y + hh - 2 + n), fill=bdk)
        R(d, X + s - 2, Y + hh - 1, X + s - 1, Y + hh - 1, bc)
        d.point((X + s - 2, Y + hh - 2 + n - 1), fill=bc)
    # collar: una banda inclinada en el cuello, de la nuca a la garganta, con borde y chapita
    cy = Y + hh - 4
    band = p.collar_band or p.collar
    for i, (x0, x1) in enumerate(((-2, 2), (-2, 3), (-1, 4), (0, 5))):
        # con banda (Maryluna): rosa en las dos filas de arriba y la banda negra abajo, salvo junto a la nuca
        col = p.collar_edge if i == 0 else (band if i == 3 else p.collar)
        R(d, X + x0, cy + i, X + x1, cy + i, col)
        if i == 3 and band != p.collar:
            R(d, X + x0, cy + i, X + x0 + 1, cy + i, p.collar)
    R(d, X + 1, cy + 4, X + 6, cy + 4, p.collar_edge)
    d.point((X + 6, cy + 3), fill=p.collar_edge)
    d.point((X - 2, cy + 3), fill=p.collar_edge)
    tx, ty = X + 4, cy + 5
    R(d, tx - 1, ty, tx + 1, ty, p.tag)      # chapita pequeña (2 filas): en los pequeños no llega a los pies
    d.point((tx, ty + 1), fill=p.tag)
    d.point((tx, ty), fill=p.tag_mark)
    _ear(d, p, t, X, Y, ear)


# --------------------------------------------------------------------------------------------------- cuerpo


def _leg(d, p, b, x, y0, foot, color, paw, edge=None):
    """Pata de la cadera (x, y0) al pie. `foot` = (dx, lift): cuánto se adelanta el pie y cuánto se levanta."""
    dx, lift = foot
    w = b.leg_w
    y1 = b.H - 1 - lift
    d.polygon([(x, y0), (x + w - 1, y0), (x + dx + w - 1, y1), (x + dx, y1)], fill=color)
    if edge is not None:   # canto de atrás en sombra: separa la pata del vientre y de la otra pata
        d.line([(x, y0 + 2), (x + dx, y1 - 2)], fill=edge)
    R(d, x + dx, y1 - 1, x + dx + w, y1, color)
    R(d, x + dx + 1, y1, x + dx + w, y1, paw)


# Colas desde la raíz en el anca: 0 arriba · 1 meneo · -1 caída (choque y caída del salto).
TAILS = {
    # Romeo: media, baja, casi horizontal hacia atrás y algo arriba; áspera (un mechón en la punta)
    'low': {0: [(0, 0), (-2, -1), (-4, -2), (-5, -4)],
            1: [(0, 0), (-2, 0), (-4, -1), (-6, -2)],
            -1: [(0, 0), (-2, 1), (-4, 3), (-5, 5)]},
    # Maryluna: alta y peluda, curvada sobre la grupa, con el pelo hirsuto en mechones
    'flag': {0: [(0, 0), (-2, -1), (-3, -3), (-3, -4)],
             1: [(0, 0), (-2, 0), (-4, -2), (-5, -3)],
             -1: [(0, 0), (-2, 1), (-4, 3), (-5, 5)]},
    # Luna: fina, en hoz sobre el lomo
    'sickle': {0: [(0, 0), (-2, -1), (-3, -3), (-3, -5), (-1, -6), (0, -6)],
               1: [(0, 0), (-2, 0), (-4, -2), (-5, -4), (-4, -6), (-3, -6)],
               -1: [(0, 0), (-2, 1), (-3, 3), (-4, 5)]},
}


def _tail(d, p, t, bx, by, state):
    pts = [(bx + x, by + y) for x, y in TAILS[t.tail][state]]
    if t.tail == 'flag':
        _stroke(d, pts, p.tail, width=3)
        x, y = pts[-1]
        if state != -1:   # mechones del plumero: cuelgan del canto de atrás
            _tuft(d, pts[1][0] - 1, pts[1][1] + 1, 'back', p.tail)
            _tuft(d, x, y, 'back', p.tail)
    else:
        _stroke(d, pts, p.tail)
        x, y = pts[-1]
        if t.coat == 'wiry' and state != -1:   # punta áspera
            _tuft(d, x, y, 'back', p.tail)
        d.point((pts[1][0] + 1, pts[1][1] - (0 if state == -1 else 1)), fill=p.light)


def stand(p, t, legs=((0, 0),) * 4, bob=0, pitch=0, tail=0, hd=(0, 0), mouth='smile', eye='open', ear=0, stars=-1):
    """
    De pie / corriendo / saltando. `legs` = 4 pies (dx, lift) en orden lejana-trasera, cercana-trasera, lejana-delantera,
    cercana-delantera. `bob` sube (−) o baja (+) todo el cuerpo; `pitch` sube (+) o baja (−) el pecho respecto del anca;
    `hd` mueve la cabeza respecto del cuerpo; `stars` ≥ 0 dibuja las estrellitas del choque (cuadro 0 o 1).
    """
    b = BUILDS[t.build]
    sp = layer(b.W, b.H)
    d = ImageDraw.Draw(sp)
    rb, fb = bob, bob - pitch
    hip = b.H - 1 - b.leg_len
    top = hip - b.depth
    (rx0, rx1), (cx0, cx1) = b.rear, b.chest
    lfr, lnr, lff, lnf = b.legs_x
    leg, leg_far = p.leg or p.body, p.leg_far or p.dark
    # patas lejanas (en sombra)
    _leg(d, p, b, lfr, hip + rb, legs[0], leg_far, p.paw_far)
    _leg(d, p, b, lff, hip + fb, legs[2], leg_far, p.paw_far)
    # cola, desde el anca
    _tail(d, p, t, rx0 + 3, top + (3 if t.tail == 'sickle' else 2) + rb, tail)
    # tronco: anca redonda, pecho hondo y el vientre recogido
    body = layer(b.W, b.H)
    bd = ImageDraw.Draw(body)
    bd.ellipse([rx0, top + rb, rx1, hip + 1 + rb], fill=p.body)
    bd.ellipse([cx0, top - 1 + fb, cx1, hip + 2 + fb], fill=p.body)
    bd.polygon([(rx0 + 5, top + rb), (cx0 + 6, top - 1 + fb), (cx0 + 6, hip + 1 + fb), (rx0 + 5, hip + rb)],
               fill=p.body)
    if p.saddle is not None:   # manchas canela: el anca y la cruz, sobre el cuerpo crema
        _clip_paste(body, body, lambda dd: dd.polygon(
            [(rx0 - 1, top - 1 + rb), (cx1 - 3, top - 2 + fb), (cx1 - 6, top + 2 + fb), (cx0 + 2, top + 3 + fb),
             (rx1 - 1, top + 3 + rb), (rx0 + 4, top + 5 + rb), (rx0 - 1, top + 6 + rb)],
            fill=p.saddle))
    sp.alpha_composite(body)
    R(d, rx0 + 3, top + rb, rx1 - 3, top + rb, p.light)
    R(d, cx0 + 3, top - 1 + fb, cx0 + 7, top - 1 + fb, p.light)
    d.line([(rx0 + 6, hip + rb), (cx0 + 6, hip + 1 + fb)], fill=p.dark)
    # garganta y pecho
    c = cx1 - 5
    d.ellipse([c - 1, top + 3 + fb, c + 5, hip + 2 + fb], fill=p.chest)
    R(d, c, hip + 1 + fb, c + 2, hip + 2 + fb, p.chest_shade)
    # pelo áspero / hirsuto: mechones que rompen la silueta (lomo, grupa, pecho y vientre) y trazos en el tronco
    if t.coat in ('wiry', 'shaggy'):
        sh = t.coat == 'shaggy'
        for x in ((rx0 + 5, cx0 + 3) if not sh else (rx1 - 1, cx0 + 4)):
            yy = top + (rb if x < rx1 - 2 else fb) - (1 if x >= cx0 else 0)
            if sh:   # hirsuto: mechones que se levantan y se echan atrás
                _tuft(d, x, yy, 'up', p.saddle or p.body, 2)
            else:    # áspero: el lomo se rompe en un escalón de 2 px, sin pinchos
                R(d, x, yy - 1, x + 1, yy - 1, p.body)
        _tuft(d, cx1, top + 6 + fb, 'fwd', p.chest, 2)                        # pechera
        _tuft(d, rx0 + 8, hip + 1 + rb, 'down', p.body, 2)                   # vientre
        if sh:
            _tuft(d, cx0 + 3, hip + 2 + fb, 'down', p.body, 2)
            _tuft(d, rx0, hip - 3 + rb, 'back', p.body, 2)                   # «pantalones» del anca
            _tuft(d, cx1 - 1, top + 10 + fb, 'fwd', p.chest, 2)
        for x0, y0 in ((rx0 + 4, top + 3), (rx0 + 8, top + 2), (cx0 + 4, top + 3)):   # trazos del pelo
            yy = y0 + (rb if x0 < rx1 else fb)
            d.line([(x0, yy), (x0 + 1, yy + 2)], fill=(p.tuft_dark or p.dark) if sh else p.dark)
    # patas cercanas
    _leg(d, p, b, lnr, hip + rb, legs[1], leg, p.paw, edge=p.chest_shade if p.leg else None)
    _leg(d, p, b, lnf, hip + fb, legs[3], leg, p.paw, edge=p.chest_shade if p.leg else None)
    # cabeza y la nuca que la une al lomo (sin huecos bajo la oreja echada atrás)
    hw, hh = b.head
    X, Y = b.head_x + hd[0], b.head_y + fb + hd[1]
    nape = (X - 2, Y + 3) if ear == 1 else (X + 1, Y + 4)
    d.polygon([(X + 3, Y + 2), (X + 9, Y + 6), (X + 4, Y + hh), (cx0 + 3, top + fb), nape], fill=p.head or p.body)
    if t.coat == 'shaggy':   # melena de la nuca: mechones que apuntan atrás
        _tuft(d, X - 1, Y + 6, 'back', p.head or p.body, 2)
    _head(d, sp, p, t, b, X, Y, mouth=mouth, eye=eye, ear=ear)
    if stars >= 0:
        _stars(d, p, X + hw - 7, Y - 3, stars)
    return outlined(sp, p.outline)


def sit(p, t, f=0):
    """
    Sentado de perfil, la cabeza alta: el anca en el suelo, el pie trasero delante, las manos rectas. `f` alterna la cola
    (0/1) y el jadeo (la lengua asoma un píxel más).
    """
    b = BUILDS[t.build]
    W, H = b.sit_w, b.H
    sp = layer(W, H)
    d = ImageDraw.Draw(sp)
    g = H - 1
    k = b.sit_k
    sc = lambda v: int(round(v * k))  # noqa: E731
    X, Y = b.sit_x, b.sit_y
    hw, hh = b.head
    lw = b.leg_w
    leg, leg_far = p.leg or p.body, p.leg_far or p.dark
    # cola en el suelo, que se menea
    hx = X - sc(15)                     # borde de atrás del anca
    wag = 2 * f
    if t.tail == 'flag':
        _stroke(d, [(hx + 5, g - 1), (hx + 1, g - 2), (hx - 1, g - 5 - wag), (hx, g - 8 - wag)], p.tail, width=3)
        _tuft(d, hx + 1, g - 9 - wag, 'up', p.tuft or p.light)
    else:
        _stroke(d, [(hx + 5, g - 1), (hx + 1, g - 1), (hx - 1, g - 3), (hx - 1, g - 6 - wag)], p.tail)
        if t.coat == 'wiry':
            _tuft(d, hx - 1, g - 7 - wag, 'up', p.tail)
    # mano lejana, anca y torso erguido
    R(d, X - 1, g - sc(12), X - 2 + lw, g, leg_far)
    R(d, X - 1, g - 1, X - 1 + lw, g, p.paw_far)
    body = layer(W, H)
    bd = ImageDraw.Draw(body)
    bd.ellipse([X - sc(9), Y + hh - 8, X + sc(9), g - 2], fill=p.body)
    bd.ellipse([hx, g - sc(15), X + sc(2), g], fill=p.body)
    if p.saddle is not None:   # mancha canela en el lomo y el anca
        _clip_paste(body, body, lambda dd: dd.polygon(
            [(hx - 1, g - 4), (hx - 1, g - sc(16)), (X - sc(9), Y + hh - 8), (X - 1, Y + hh - 8),
             (X - 3, g - sc(12)), (hx + sc(10), g - 3)], fill=p.saddle))
    sp.alpha_composite(body)
    R(d, X - sc(9) + 3, Y + hh - 8, X - 2, Y + hh - 8, p.light)
    # muslo: un arco más oscuro que dibuja la pata trasera doblada
    d.arc([hx + 2, g - sc(12), X - 1, g + 2], 200, 320, fill=p.dark)
    R(d, hx + 3, g - 1, hx + 3 + sc(10), g, leg)                   # pie trasero
    R(d, hx + 4, g, hx + 3 + sc(10), g, p.paw)
    d.ellipse([X + 2, Y + hh - 4, X + sc(9) + 1, g - sc(5)], fill=p.chest)
    if t.coat in ('wiry', 'shaggy'):   # pechera áspera y mechón del anca
        _tuft(d, X + sc(9) + 1, Y + hh, 'fwd', p.chest, 2)
        if t.coat == 'shaggy':
            _tuft(d, X + sc(9), Y + hh + 5, 'fwd', p.chest, 2)
            _tuft(d, hx + 1, g - sc(13), 'back', p.saddle or p.body, 2)
    R(d, X + 3, g - sc(13), X + 2 + lw, g, leg)                    # mano cercana
    if p.leg is not None:
        R(d, X + 3, g - sc(13) + 1, X + 3, g - 2, p.chest_shade)
    R(d, X + 3, g - 1, X + 3 + lw, g, p.paw)
    # nuca y cabeza
    d.polygon([(X + 2, Y + 3), (X + 8, Y + 5), (X + 3, Y + hh + 1), (X - sc(4), Y + hh + 3), (X - 1, Y + 6)],
              fill=p.head or p.body)
    if t.coat == 'shaggy':
        _tuft(d, X - 1, Y + 7, 'back', p.head or p.body, 2)
    if p.head_rim is not None:   # sombra de la nuca: la cabeza sobresale del cuello en vez de fundirse con el lomo
        for nx, ny in ((-1, 6), (-1, 7), (0, 8)):
            d.point((X + nx, Y + ny), fill=p.ear_inner)
    _head(d, sp, p, t, b, X, Y, mouth='smile', eye='open', ear=0)
    if f == 1:   # jadeo: la lengua asoma un píxel más
        m0 = X + hw - 4
        R(d, m0 + 2, Y + hh + 2, m0 + 3, Y + hh + 2, p.tongue)
    return outlined(sp, p.outline)


def _g(legs, k, minlift=0):
    """Escala el galope de la familia lab a unas patas más cortas: cuánto se abren y se levantan los pies."""
    return tuple((int(round(dx * k)), max(minlift, int(round(lift * k)))) for dx, lift in legs)


def animations(p, t):
    """Las 5 animaciones de la manada: nombre -> (cuadros, fps). Mismos ritmos que Choco y las familias lab y husky."""
    b = BUILDS[t.build]
    s = lambda **kw: stand(p, t, **kw)  # noqa: E731
    g = b.gait
    brake = _g(((-2, 0), (-3, 0), (3, 0), (4, 0)), g)
    return {
        # Galope: se estira (manos adelante, patas atrás, el pecho arriba), apoya las manos, se recoge (el pecho baja),
        # apoya las patas y vuelve a estirar. El cuerpo sube y baja 2–3 px; las orejas van echadas atrás.
        'run': ([s(legs=_g(((-3, 1), (-4, 0), (5, 2), (6, 1)), g), bob=-2, pitch=1, ear=1, mouth='open', tail=1),
                 s(legs=_g(((-1, 2), (-2, 3), (-1, 0), (-2, 0)), g), bob=0, ear=1, mouth='open', tail=0),
                 s(legs=_g(((4, 2), (5, 0), (-3, 2), (-2, 3)), g), bob=-2, pitch=-1, ear=1, mouth='open', tail=1),
                 s(legs=_g(((1, 0), (0, 0), (4, 4), (3, 3)), g), bob=0, ear=1, mouth='open', tail=0)], 12),
        # Salto: despega estirado (pecho arriba), en la cima recoge las patas, al caer adelanta las manos
        'jump': ([s(legs=_g(((-4, 3), (-5, 2), (5, 6), (6, 5)), g, 1), bob=0, pitch=1, ear=1, mouth='open', hd=(1, 0),
                    tail=1),
                  s(legs=_g(((2, 6), (1, 5), (-2, 6), (-1, 5)), g, 1), bob=-1, ear=1, mouth='open', tail=0),
                  s(legs=_g(((-3, 4), (-4, 5), (5, 2), (6, 1)), g, 1), bob=0, pitch=-1, ear=1, mouth='open',
                    tail=-1)], 1),
        # Choque: frena con las manos, ojos apretados, orejas atrás, la cabeza se va 3 px atrás y abajo y el pecho
        # se hunde. Estrellitas sobre la frente.
        # (en los pequeños la cabeza baja 2–3 px, no 5–6: si no, toca el suelo)
        'hurt': ([s(legs=brake, bob=1, pitch=0, eye='closed', mouth='open', hd=(-3, 1), ear=1, tail=-1, stars=0),
                  s(legs=brake, bob=2, pitch=-1, eye='closed', mouth='open', hd=(0, 0), ear=1, tail=-1, stars=1)], 8),
        'idle': ([sit(p, t, 0), sit(p, t, 1)], 3),
        # Contento: bota con las manos en alto (las orejas se van atrás en el bote) y menea la cola, lengua afuera
        'happy': ([s(legs=_g(((0, 0), (1, 0), (2, 3), (3, 4)), g), bob=0, pitch=2, hd=(0, -1), mouth='open',
                     eye='happy', tail=1, ear=1),
                   s(bob=0, mouth='open', eye='happy', tail=0, ear=t.happy_ear)], 6),
    }


def portrait(p, t):
    """Busto del perro sentado: cabeza con las orejas, collar y pecho, centrados en 32×32 con el corte abajo."""
    b = BUILDS[t.build]
    sitting = sit(p, t, 0)
    X = b.sit_x
    left, right = X + 1 - 6, X + 1 + b.snout + 2      # del cuello a la punta de la nariz (con el contorno)
    x0 = (left + right) // 2 - 16 + t.portrait_shift[0]
    top = sitting.getbbox()[1] + t.portrait_shift[1]
    bust = sitting.crop((x0, top, x0 + 32, top + 31))
    out = layer(32, 32)
    out.paste(bust, (0, 1), bust)
    return out
