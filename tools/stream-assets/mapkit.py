"""
Piezas comunes a las 7 escenas de zona del mapa del Chess Runner (`map_zone<n>.py`).

No se llama `map_*.py` a propósito: `export_map.py` importa esos módulos y exige que declaren `ASSETS`.
Contrato: `docs/personajes/ASSETS_SPEC.md` («Mapa (7 zonas)»). Python 3.9 (nada de `X | Y`). Todo determinista.

Cómo se arma una zona:

    sc = Scene(level=1, ground=PAL_GROUND)          # lienzo 220×420 con su suelo texturizado
    curve = Curve([(110, 432), ..., (110, -12)])     # el camino, de abajo (entrada) a arriba (salida)
    pts = points_on(curve, [0.06, ...], KINDS)       # los puntos: centro del nodo sobre el camino, `order` 1 = abajo
    sc.lay_path(curve, PAL_PATH, pts)                # el camino (borde, relieve, textura) con un claro bajo cada punto
    sc.put(tree(...), x, y)                          # decorado: sprites con el pie en (x, y), ordenados por su `y`
    sc.cast(...)                                     # sombras proyectadas (cortas a mediodía, largas por la tarde)
    sc.add_fx('map-fx-1-hojas', box, 8, 6, fn)       # ambiente: `fn(t, i)` -> (variantes, capa encima), t en [0, 1)
    sc.base()                                        # la escena terminada, ya con su oscuridad horneada

- **Ambiente sin saltos:** cada animación se dibuja re-componiendo su caja con la fase `t = i / n` y se guarda solo lo que
  cambia respecto a la escena base (lo demás, transparente). Como todo depende de `t` de forma periódica (senos de periodo 1,
  secuencias que vuelven a su inicio, cosas que se desplazan y se desvanecen), el último cuadro lleva al primero. `add_fx`
  comprueba que la capa no toque el camino ni la caja (20×20 + margen) de ningún punto.
- **Oscuridad progresiva** (`grade`, nivel 0–6 = zona 1–7): menos saturación, menos luz, sombras que tiran a violeta frío y una
  viñeta en escalones con tramado ordenado (sin degradados suaves). Se hornea en la escena y en sus capas de ambiente (con la
  misma posición absoluta, así encajan píxel a píxel); no es un filtro de la app. Nivel 0 = la escena tal cual.
- Entrada y salida de cada zona por `GATE_X` (centro del borde inferior y superior), para que las zonas empalmen.
"""
import colorsys
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from pixel import C, layer, outlined

W, H = 220, 420
GATE_X = 110            # x por la que el camino entra (abajo) y sale (arriba) en todas las zonas
NODE = 20               # lado del sprite de un punto
KEEP = 13               # medio lado de la caja que se deja libre alrededor de cada punto (10 del nodo + 3 de aire)

BAYER4 = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


def dither(x, y):
    """Umbral de tramado ordenado 4×4 en (0, 1)."""
    return (BAYER4[y & 3][x & 3] + 0.5) / 16


def mix(a, b, t):
    """Mezcla dos colores RGBA (el alfa del primero)."""
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (a[3] if len(a) > 3 else 255,)


def tone(c, k):
    """Aclara (k > 1) u oscurece (k < 1) un color sin pasar de 255."""
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)


def _h(*vals):
    """Ruido entero determinista (hash) en [0, 1)."""
    n = 2166136261
    for v in vals:
        n = ((n ^ (int(v) & 0xffffffff)) * 16777619) & 0xffffffff
    n ^= n >> 13
    n = (n * 1274126177) & 0xffffffff
    return (n & 0xffff) / 65536.0


# ---------------------------------------------------------------- oscuridad progresiva

SHADOW_TINT = (58, 50, 88)


def grade(img, level, origin=(0, 0)):
    """
    Oscuridad horneada del nivel `level` (0–6) sobre `img` (RGBA), que ocupa la escena desde `origin`.
    Cada píxel depende solo de su color y de su posición absoluta: un recorte da lo mismo que la escena entera.
    """
    if level <= 0:
        return img.copy()
    sat = 1 - 0.11 * level
    val = 1 - 0.08 * level
    cool = 0.06 * level
    vig = 0.10 * level
    out = img.copy()
    px = out.load()
    w, h = out.size
    ox, oy = origin
    cache = {}
    for y in range(h):
        ay = y + oy
        dy = (ay + 0.5 - H / 2) / (H / 2)
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            ax = x + ox
            dx = (ax + 0.5 - W / 2) / (W / 2)
            v = max(0.0, min(1.0, (math.sqrt(dx * dx + dy * dy) - 0.75) / 0.6))
            step = min(4, int(v * 4 + dither(ax, ay)))
            key = (r, g, b, step)
            c = cache.get(key)
            if c is None:
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                ss *= sat
                vv *= val * (1 - vig * step / 4)
                rr, gg, bb = colorsys.hsv_to_rgb(hh, ss, vv)
                k = cool * (1 - vv) ** 1.5
                rr = rr + (SHADOW_TINT[0] / 255 - rr) * k
                gg = gg + (SHADOW_TINT[1] / 255 - gg) * k
                bb = bb + (SHADOW_TINT[2] / 255 - bb) * k
                c = cache[key] = tuple(max(10, min(255, int(round(t * 255)))) for t in (rr, gg, bb))
            px[x, y] = c + (a,)
    return out


# ---------------------------------------------------------------- el camino

class Curve:
    """Curva suave (Catmull-Rom) por unos puntos de control, remuestreada cada 1 px de longitud."""

    def __init__(self, ctrl):
        raw = []
        p = [ctrl[0]] + list(ctrl) + [ctrl[-1]]
        for i in range(1, len(p) - 2):
            p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
            for k in range(40):
                t = k / 40
                raw.append(tuple(0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                        + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t * t * t) for j in (0, 1)))
        raw.append(tuple(ctrl[-1]))
        self.pts = [raw[0]]
        acc, prev = 0.0, raw[0]
        for q in raw[1:]:
            seg = math.hypot(q[0] - prev[0], q[1] - prev[1])
            while acc + seg >= 1.0 and seg > 0:
                t = (1.0 - acc) / seg
                prev = (prev[0] + (q[0] - prev[0]) * t, prev[1] + (q[1] - prev[1]) * t)
                self.pts.append(prev)
                seg = math.hypot(q[0] - prev[0], q[1] - prev[1])
                acc = 0.0
            acc += seg
            prev = q
        self.length = len(self.pts) - 1

    def at(self, s):
        """Punto a `s` px del comienzo."""
        s = max(0.0, min(self.length, s))
        i = min(int(s), self.length - 1)
        t = s - i
        a, b = self.pts[i], self.pts[i + 1]
        return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t

    def frac(self, f):
        return self.at(f * self.length)

    def mask(self, radius, wobble=1.0, seed=0):
        """Máscara 'L' del camino: un disco por cada px de curva, con un ancho que respira un poco."""
        m = Image.new('L', (W, H), 0)
        d = ImageDraw.Draw(m)
        for k, (x, y) in enumerate(self.pts):
            r = radius + wobble * (0.6 * math.sin(k / 23.0 + seed) + 0.4 * math.sin(k / 9.0 + 2 * seed))
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        return m


def points_on(curve, fracs, kinds):
    """Puntos `{x, y, kind, order}` sobre la curva (centro del nodo); `order` 1 = el primero de la lista (abajo)."""
    out = []
    for k, (f, kind) in enumerate(zip(fracs, kinds)):
        x, y = curve.frac(f)
        out.append({'x': int(round(x)), 'y': int(round(y)), 'kind': kind, 'order': k + 1})
    return out


# ---------------------------------------------------------------- la escena

def blit(img, sp, x, y):
    """Compone `sp` sobre `img` con su esquina en (x, y), aunque se salga por cualquier lado."""
    w, h = sp.size
    x0, y0 = max(0, -x), max(0, -y)
    x1, y1 = min(w, img.size[0] - x), min(h, img.size[1] - y)
    if x1 <= x0 or y1 <= y0:
        return
    part = sp if (x0, y0, x1, y1) == (0, 0, w, h) else sp.crop((x0, y0, x1, y1))
    img.alpha_composite(part, (x + x0, y + y0))


def boxes_touch(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


class Scene:
    """
    Una escena de zona: suelo (con camino y sombras, plano) + objetos con el pie en una fila (se ordenan por ella)
    + capas de ambiente. `level` es la oscuridad (0–6).
    """

    def __init__(self, level, ground, seed=0):
        self.level = level
        self.rng = random.Random(seed)
        self.ground = Image.new('RGBA', (W, H), ground['base'])
        self.shadow = Image.new('L', (W, H), 0)
        self.items = []
        self.path = Image.new('L', (W, H), 0)
        self.points = []
        self.reserved = []         # cajas que el relleno aleatorio no pisa
        self.fx = []               # (nombre, x, y, cuadros, fps)
        self._ground_done = None
        self._base = None
        paint_ground(self.ground, ground, seed)

    # -- suelo
    def draw(self):
        return ImageDraw.Draw(self.ground)

    def lay_path(self, curve, pal, points, radius=7.5, pad=10.5, boss_pad=13.5):
        """Pinta el camino y un claro redondo bajo cada punto (más ancho bajo el jefe)."""
        m = curve.mask(radius, seed=len(points))
        d = ImageDraw.Draw(m)
        for p in points:
            r = boss_pad if p['kind'] in ('boss', 'king') else pad
            d.ellipse([p['x'] - r, p['y'] - r, p['x'] + r, p['y'] + r], fill=255)
        self.path = ImageChops.lighter(self.path, m)
        self.points = list(points)
        paint_path(self.ground, m, pal, len(points))
        for p in points:
            self.reserved.append((p['x'] - KEEP, p['y'] - KEEP, p['x'] + KEEP + 1, p['y'] + KEEP + 1))

    def near_path(self, box, pad=2):
        x0, y0, x1, y1 = (max(0, box[0] - pad), max(0, box[1] - pad), min(W, box[2] + pad), min(H, box[3] + pad))
        if x1 <= x0 or y1 <= y0:
            return False
        return self.path.crop((x0, y0, x1, y1)).getbbox() is not None

    def free(self, box, pad=2):
        """¿La caja (x0, y0, x1, y1) no toca el camino, los puntos ni lo reservado?"""
        return not self.near_path(box, pad) and not any(boxes_touch(box, r) for r in self.reserved)

    # -- objetos
    def put(self, sp, x, y, key=None, z=None, shadow=None):
        """
        Pone `sp` con el centro de su base en (x, y). `key` permite cambiarlo en una animación (una variante del mismo
        tamaño, o None para ocultarlo). `shadow` = (kx, ky): proyecta su sombra sobre el suelo.
        """
        left, top = x - sp.size[0] // 2, y - sp.size[1] + 1
        self.items.append({'sp': sp, 'x': left, 'y': top, 'z': y if z is None else z, 'key': key, 'n': len(self.items)})
        if shadow:
            self.cast(sp, left, top, y, *shadow)
        return (left, top, left + sp.size[0], top + sp.size[1])

    def opaque_box(self, sp, x, y):
        """Caja de lo opaco de `sp` si se pusiera con la base en (x, y)."""
        bb = sp.getbbox()
        left, top = x - sp.size[0] // 2, y - sp.size[1] + 1
        return (left + bb[0], top + bb[1], left + bb[2], top + bb[3])

    def try_put(self, sp, x, y, pad=2, **kw):
        """Pone `sp` solo si cabe sin tocar camino, puntos ni lo reservado. Devuelve si lo puso."""
        if not self.free(self.opaque_box(sp, x, y), pad):
            return False
        self.put(sp, x, y, **kw)
        return True

    def cast(self, sp, left, top, foot, kx, ky, height0=0):
        """Sombra proyectada de `sp`: cada píxel a una altura `h` sobre el suelo cae `h·kx` a la derecha y `h·ky` abajo."""
        src = sp.getchannel('A').load()
        dst = self.shadow.load()
        w, h = sp.size
        for sy in range(h):
            hgt = foot - (top + sy) + height0
            if hgt < 0:
                continue
            for sx in range(w):
                if src[sx, sy]:
                    X = int(round(left + sx + hgt * kx))
                    Y = int(round(foot + hgt * ky))
                    if 0 <= X < W and 0 <= Y < H:
                        dst[X, Y] = 255

    def _final_ground(self, shadow_color):
        if self._ground_done is None:
            m = self.shadow.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
            g = self.ground.copy()
            g.paste(shadow_color[:3] + (255,), (0, 0), m.point(lambda v: shadow_color[3] if v else 0))
            self._ground_done = g
        return self._ground_done

    def compose(self, box, variants=None, overlay=None):
        """Recorte `box` de la escena sin oscurecer, con `variants` {key: sprite|None} y `overlay(img, x0, y0)` encima."""
        x0, y0 = box[0], box[1]
        img = self._final_ground(self.shadow_color).crop(box)
        for it in sorted(self.items, key=lambda i: (i['z'], i['n'])):
            sp = it['sp']
            if variants and it['key'] in variants:
                sp = variants[it['key']]
                if sp is None:
                    continue
            if boxes_touch((it['x'], it['y'], it['x'] + sp.size[0], it['y'] + sp.size[1]), box):
                blit(img, sp, it['x'] - x0, it['y'] - y0)
        if overlay:
            overlay(img, x0, y0)
        return img

    shadow_color = C('#2e4a36', 70)

    def base(self):
        """La escena terminada (opaca, 220×420) con su oscuridad horneada."""
        if self._base is None:
            self._base = grade(self.compose((0, 0, W, H)), self.level).convert('RGBA')
        return self._base

    # -- ambiente
    def add_fx(self, name, box, frames, fps, fn, allow_path=False):
        """
        Capa de ambiente `name` en la caja `box` (x0, y0, x1, y1): `fn(t, i)` devuelve (variantes, overlay) para la fase
        `t = i / frames`. Se guarda solo lo que cambia respecto a la escena base.
        """
        base = self.base().crop(box)
        out = []
        for i in range(frames):
            variants, overlay = fn(i / frames, i)
            g = grade(self.compose(box, variants, overlay), self.level, box[:2])
            diff = ImageChops.difference(g.convert('RGB'), base.convert('RGB'))
            r, gg, b = diff.split()
            m = ImageChops.lighter(ImageChops.lighter(r, gg), b).point(lambda v: 255 if v else 0)
            f = layer(box[2] - box[0], box[3] - box[1])
            f.paste(g, (0, 0), m)
            out.append(f)
            self._check_fx(name, box, f, allow_path)
        if len({f.tobytes() for f in out}) < 2:
            raise ValueError(f'{name}: todos los cuadros iguales')
        for other in self.fx:
            if boxes_touch(box, (other[1], other[2], other[1] + other[3][0].size[0], other[2] + other[3][0].size[1])):
                raise ValueError(f'{name} pisa la caja de {other[0]}')
        self.fx.append((name, box[0], box[1], out, fps))
        return out

    def _check_fx(self, name, box, f, allow_path):
        bb = f.getbbox()
        if bb is None:
            return
        if f.getextrema()[3][0] != 0:
            raise ValueError(f'{name}: un cuadro sin transparencia')
        ab = (box[0] + bb[0], box[1] + bb[1], box[0] + bb[2], box[1] + bb[3])
        for p in self.points:
            if boxes_touch(ab, (p['x'] - 11, p['y'] - 11, p['x'] + 12, p['y'] + 12)):
                raise ValueError(f'{name} tapa el punto {p["order"]}')
        if not allow_path:
            hit = ImageChops.multiply(f.getchannel('A'), self.path.crop(box)).getbbox()
            if hit is not None:
                raise ValueError(f'{name} tapa el camino en {box[0] + hit[0]},{box[1] + hit[1]}')

    def assets(self, zone):
        """{nombre: imagen o cuadros} de la escena y sus ambientes."""
        out = {f'map-zone-{zone}': self.base()}
        for name, _x, _y, frames, _fps in self.fx:
            out[name] = frames
        return out


def ambient_meta(fx_specs):
    """[{sprite, x, y, fps}] desde [(nombre, (x0, y0, x1, y1), cuadros, fps)]."""
    return [{'sprite': n, 'x': b[0], 'y': b[1], 'fps': fps} for n, b, _frames, fps in fx_specs]


# ---------------------------------------------------------------- suelo y camino

def paint_ground(img, pal, seed):
    """Suelo: base con manchas grandes de tono (tramadas), trazos cortos de hierba y motitas."""
    rnd = random.Random(seed * 7 + 1)
    px = img.load()
    blobs = [(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(18, 40), rnd.choice((-1, 1))) for _ in range(26)]
    for y in range(H):
        for x in range(W):
            v = 0.0
            for bx, by, br, sgn in blobs:
                dd = ((x - bx) ** 2 + (y - by) ** 2) / (br * br)
                if dd < 1:
                    v += sgn * (1 - dd)
            th = dither(x, y)
            if v > 0.25 + th * 0.5:
                px[x, y] = pal['light']
            elif v < -0.25 - th * 0.5:
                px[x, y] = pal['dark']
    d = ImageDraw.Draw(img)
    for _ in range(int(W * H / 55)):
        x, y = rnd.randint(0, W - 4), rnd.randint(0, H - 1)
        c = pal['dash'] if rnd.random() < 0.6 else pal['dash2']
        d.line([(x, y), (x + rnd.randint(1, 3), y)], fill=c)
    for _ in range(int(W * H / 260)):
        x, y = rnd.randint(1, W - 2), rnd.randint(2, H - 1)
        d.point((x, y), fill=pal['tuft'])
        d.point((x - 1, y - 1), fill=pal['tuft'])
        d.point((x + 1, y - 1), fill=pal['tuft'])


def paint_path(img, mask, pal, seed):
    """
    Camino de tierra: borde exterior de 1 px, la orilla de arriba hundida (sombra) y la de abajo iluminada, piedritas,
    motas y matas de hierba que lo invaden un poco por los lados.
    """
    rnd = random.Random(seed * 13 + 5)
    m = mask.load()
    px = img.load()
    rim = mask.filter(ImageFilter.MaxFilter(3))
    rm = rim.load()

    def inside(x, y):
        # fuera del lienzo por arriba o por abajo cuenta la fila del borde: el camino sigue en la zona vecina y la
        # junta entre zonas sale con el relleno, sin una fila de sombra arriba ni de luz abajo
        return 0 <= x < W and m[x, min(H - 1, max(0, y))] > 0

    for y in range(H):
        for x in range(W):
            if m[x, y]:
                c = pal['fill']
                if not inside(x, y - 1) or not inside(x, y - 2) and dither(x, y) < 0.5:
                    c = pal['dark']
                elif not inside(x, y + 1):
                    c = pal['light']
                elif _h(x, y, seed) < 0.06:
                    c = pal['speck']
                elif _h(y, x, seed + 1) < 0.035:
                    c = pal['light']
                px[x, y] = c
            elif rm[x, y]:
                px[x, y] = pal['rim']
    for _ in range(140):
        x, y = rnd.randint(2, W - 3), rnd.randint(2, H - 3)
        if inside(x, y) and inside(x + 1, y) and inside(x, y + 1) and inside(x, y - 2):
            px[x, y] = pal['pebble']
            px[x + 1, y] = pal['pebble']
            px[x, y + 1] = pal['dark']
            px[x + 1, y + 1] = pal['dark']
    for _ in range(60):
        x, y = rnd.randint(2, W - 3), rnd.randint(3, H - 1)
        if rm[x, y] and not m[x, y] and inside(x, y - 2) is False:
            for dx, dy in ((0, 0), (-1, -1), (1, -1), (0, -2)):
                if 0 <= x + dx < W and 0 <= y + dy < H:
                    px[x + dx, y + dy] = pal['grass']


# ---------------------------------------------------------------- decorado

def _blob_canopy(sp, blobs, tones, seed, dark_seam=True):
    """
    Copa hecha de bolas: cada píxel toma el tono de la última bola que lo contiene según la luz (arriba a la izquierda),
    con tramado entre tonos, textura de hojas fija a cada bola y una costura oscura donde una bola tapa a otra.
    `tones` va de oscuro a claro.
    """
    px = sp.load()
    w, h = sp.size
    owner = {}
    for k, (cx, cy, r) in enumerate(blobs):
        for y in range(max(0, int(cy - r) - 1), min(h, int(cy + r) + 2)):
            for x in range(max(0, int(cx - r) - 1), min(w, int(cx + r) + 2)):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    owner[(x, y)] = k
    n = len(tones) - 1
    for (x, y), k in owner.items():
        cx, cy, r = blobs[k]
        nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
        lit = 0.55 - 0.45 * nx - 0.65 * ny
        lit += (_h(int(x - cx), int(y - cy), seed + k) - 0.5) * 0.35
        lvl = max(0, min(n, int(lit * n + dither(x - int(cx), y - int(cy)) * 0.9)))
        c = tones[lvl]
        if dark_seam:
            for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                o = owner.get((x + dx, y + dy))
                if o is not None and o < k:
                    cx2, cy2, r2 = blobs[o]
                    if (x + dx + 0.5 - cx) ** 2 + (y + dy + 0.5 - cy) ** 2 > r * r:
                        c = tones[0] if lvl <= 1 else tones[1]
                        break
        px[x, y] = c
    return owner


def tree(seed, r, pal, sway=0, trunk_h=None, nuts=0, branch=False):
    """
    Árbol de copa redonda (nogal, roble…) visto de frente: tronco con raíces y copa de bolas sombreadas. `sway` (-1, 0, 1)
    mueve la parte alta de la copa para que se meza sin cambiar el lienzo. `pal`: `leaf` (4 tonos), `leaf_out`, `bark`
    (3 tonos), `bark_out`, opcional `nut`. `branch` deja asomar una rama a la derecha bajo la copa (para la ardilla).
    """
    rnd = random.Random(seed)
    th = trunk_h if trunk_h is not None else int(r * 0.55) + 4
    cw = int(r * 2.5) + 6
    ch = int(r * 2.1) + th + 4
    cx = cw / 2
    top = 2
    blobs = []
    main_cy = top + r * 1.05
    blobs.append((cx, main_cy + r * 0.15, r * 0.95))
    for k in range(rnd.randint(4, 6)):
        a = math.pi * (0.95 + 1.1 * k / 5) + rnd.uniform(-0.2, 0.2)
        dist = r * rnd.uniform(0.45, 0.65)
        rr = r * rnd.uniform(0.48, 0.62)
        blobs.append((cx + math.cos(a) * dist, main_cy + math.sin(a) * dist * 0.8, rr))
    for k in range(rnd.randint(2, 3)):
        a = rnd.uniform(-0.6, 0.6) - math.pi / 2
        blobs.append((cx + math.cos(a) * r * 0.35 + rnd.uniform(-2, 2), main_cy - r * 0.25, r * rnd.uniform(0.42, 0.5)))
    # orden: de atrás (abajo) adelante (arriba), la luz manda en las de arriba
    blobs.sort(key=lambda b: -b[1])
    if sway:
        ys = [b[1] for b in blobs]
        lo, hi = min(ys), max(ys)
        blobs = [(bx + sway * (1 if (hi - by) / max(1, hi - lo) > 0.45 else 0), by, br) for bx, by, br in blobs]
    sp = layer(cw, ch)
    d = ImageDraw.Draw(sp)
    # tronco
    base = ch - 3
    tx0, tx1 = int(cx) - max(2, r // 6), int(cx) + max(1, r // 6)
    ty0 = int(main_cy + r * 0.4)
    bark = pal['bark']
    d.rectangle([tx0, ty0, tx1, base], fill=bark[1])
    d.rectangle([tx0, ty0, tx0, base], fill=bark[2])
    d.rectangle([tx1, ty0, tx1, base], fill=bark[0])
    d.rectangle([tx0 - 1, base - 1, tx1 + 1, base], fill=bark[1])
    d.point((tx0 - 2, base), fill=bark[1])
    d.point((tx1 + 2, base), fill=bark[0])
    d.point((tx1 + 1, base), fill=bark[0])
    for k in range(2):
        ky = rnd.randint(ty0 + 3, base - 3)
        d.point((rnd.randint(tx0 + 1, max(tx0 + 1, tx1 - 1)), ky), fill=bark[0])
    by = int(main_cy + r * 1.1) + 2
    if branch:
        reach = int(r * 0.75)
        d.line([(tx1, by + 1), (tx1 + reach, by - 1)], fill=bark[1])
        d.line([(tx1, by + 2), (tx1 + reach, by)], fill=bark[0])
        d.point((tx1 + reach + 1, by - 2), fill=pal['leaf'][2])
        d.point((tx1 + reach + 2, by - 2), fill=pal['leaf'][1])
        d.point((tx1 + reach + 1, by - 1), fill=pal['leaf'][1])
    trunk = outlined(sp, pal['bark_out'])
    crown = layer(cw, ch)
    _blob_canopy(crown, blobs, pal['leaf'], seed)
    cp = crown.load()
    if nuts:
        spots = [(x, y) for (x, y) in ((int(b[0] + rnd.uniform(-b[2] * 0.6, b[2] * 0.6)),
                                        int(b[1] + rnd.uniform(-b[2] * 0.2, b[2] * 0.6))) for b in blobs)
                 if 0 <= x < cw and 0 <= y < ch and cp[x, y][3]]
        for x, y in spots[:nuts]:
            cp[x, y] = pal.get('nut', C('#c9d77a'))
    crown = outlined(crown, pal['leaf_out'])
    out = layer(cw + 2, ch + 2)
    out.alpha_composite(trunk)
    out.alpha_composite(crown)
    # para animaciones: borde derecho del tronco y fila de la rama (coordenadas del sprite)
    out.info['trunk_r'] = tx1 + 1
    out.info['branch_y'] = by + 1
    return out


def bush(seed, r, pal, flowers=None, sway=0):
    """Mata baja de bolas sombreadas (con flores o bayas si `flowers` = color)."""
    rnd = random.Random(seed)
    cw, ch = int(r * 3) + 4, int(r * 2) + 4
    blobs = [(cw / 2, ch - r - 1, r)]
    for k in range(rnd.randint(2, 3)):
        blobs.append((cw / 2 + rnd.uniform(-r, r) + (sway if k == 0 else 0), ch - r - 1 - rnd.uniform(1, r * 0.6),
                      r * rnd.uniform(0.6, 0.8)))
    blobs.sort(key=lambda b: -b[1])
    sp = layer(cw, ch)
    _blob_canopy(sp, blobs, pal['leaf'], seed)
    if flowers:
        px = sp.load()
        for _ in range(int(r)):
            x, y = rnd.randint(0, cw - 1), rnd.randint(0, ch - 1)
            if px[x, y][3]:
                px[x, y] = flowers
    return outlined(sp, pal['leaf_out'])


def rock(seed, w, pal):
    """Roca con cara de arriba iluminada y costado en sombra. `pal`: `stone` (3 tonos, oscuro a claro), `stone_out`."""
    rnd = random.Random(seed)
    h = max(5, int(w * 0.62))
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    s = pal['stone']
    pts = [(0, h - 1), (1, h // 2), (w * 0.25, 1 + rnd.randint(0, 1)), (w * 0.62, 0), (w - 2, h * 0.35), (w - 1, h - 1)]
    d.polygon(pts, fill=s[1])
    d.polygon([(2, h // 2), (w * 0.27, 2), (w * 0.62, 1), (w - 3, h * 0.38), (w * 0.6, h * 0.55), (w * 0.3, h * 0.55)],
              fill=s[2])
    d.polygon([(w * 0.6, h * 0.55), (w - 3, h * 0.38), (w - 1, h - 1), (w * 0.62, h - 1)], fill=s[0])
    d.point((int(w * 0.35), int(h * 0.3)), fill=tone(s[2], 1.1))
    return outlined(sp, pal['stone_out'])


def stump(seed, w, pal):
    """Tocón: canto de madera clara con anillos y corteza en los lados. `pal`: `bark` (3), `bark_out`, `wood` (2)."""
    h = int(w * 0.9)
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    b = pal['bark']
    eh = max(3, w // 2)
    d.rectangle([0, eh // 2, w - 1, h - 2], fill=b[1])
    d.rectangle([0, eh // 2, 0, h - 2], fill=b[2])
    d.rectangle([w - 2, eh // 2, w - 1, h - 2], fill=b[0])
    d.point((-1 + w // 3, h - 4), fill=b[0])
    d.rectangle([w - 3, h - 1, w + 0, h - 1], fill=b[1])
    d.point((-0, h - 1), fill=b[1])
    d.ellipse([0, 0, w - 1, eh], fill=pal['wood'][1])
    d.ellipse([2, 1, w - 3, eh - 1], outline=pal['wood'][0])
    d.point((w // 2, eh // 2), fill=pal['wood'][0])
    return outlined(sp, pal['bark_out'])


def log(seed, length, pal, thick=6):
    """Tronco caído en horizontal con su corte de anillos a la derecha y algo de musgo."""
    rnd = random.Random(seed)
    sp = layer(length, thick + 1)
    d = ImageDraw.Draw(sp)
    b = pal['bark']
    d.rectangle([0, 0, length - 4, thick - 1], fill=b[1])
    d.line([(0, 0), (length - 4, 0)], fill=b[2])
    d.line([(0, thick - 1), (length - 4, thick - 1)], fill=b[0])
    for _ in range(length // 5):
        x = rnd.randint(1, length - 6)
        d.line([(x, 1 + rnd.randint(0, 1)), (x + 2, 1 + rnd.randint(0, 1))], fill=b[0])
    d.ellipse([length - 7, 0, length - 1, thick - 1], fill=pal['wood'][1])
    d.ellipse([length - 6, 1, length - 2, thick - 2], outline=pal['wood'][0])
    if 'moss' in pal:
        for _ in range(length // 4):
            x = rnd.randint(1, length - 8)
            d.point((x, 0), fill=pal['moss'])
            d.point((x + 1, 0), fill=pal['moss'])
    return outlined(sp, pal['bark_out'])


def fence(pts, pal, step=7):
    """
    Cerca baja de madera por una polilínea `pts` (coordenadas de escena). Devuelve (sprite, x, y) con (x, y) = pie para
    `Scene.put` (el pie es la fila más baja de la cerca).

    - Tramo horizontal (|dx| ≥ |dy|): postes de 8 px cada `step` px y dos travesaños por encima, de poste a poste.
    - Tramo vertical (|dy| > |dx|, la cerca se aleja de la cámara): postes cortos y anchos (3×5) con remate claro de 2×1,
      cada `step·1.15` px (que quede hueco entre uno y otro), y los travesaños finos **desplazados a la derecha** del eje de
      los postes (se ve su cara en vista 3/4). Si los travesaños fueran por encima de postes tan juntos como en horizontal, el
      tramo se leería como un palo largo.
    """
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, y0, x1, y1 = min(xs) - 2, min(ys) - 8, max(xs) + 5, max(ys) + 1
    sp = layer(x1 - x0, y1 - y0)
    d = ImageDraw.Draw(sp)
    w = pal['wood']
    segs = []
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        vertical = abs(by - ay) > abs(bx - ax)
        seg = math.hypot(bx - ax, by - ay)
        n = max(1, int(round(seg / (step * 1.15 if vertical else step))))
        posts = [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n) for k in range(n + 1)]
        segs.append((vertical, posts))

    def at(px_, py_):
        return int(round(px_ - x0)), int(round(py_ - y0))

    # travesaños (detrás de los postes)
    for vertical, posts in segs:
        for (ax, ay), (bx, by) in zip(posts, posts[1:]):
            (AX, AY), (BX, BY) = at(ax, ay), at(bx, by)
            if vertical:
                d.line([(AX + 1, AY - 3), (BX + 1, BY - 3)], fill=w[2])
                d.line([(AX + 2, AY - 3), (BX + 2, BY - 3)], fill=w[0])
            else:
                for hgt, c in ((5, w[2]), (2, w[1])):
                    d.line([(AX, AY - hgt), (BX, BY - hgt)], fill=c)
    # postes, de atrás (arriba) adelante (abajo)
    seen = set()
    allposts = []
    for vertical, posts in segs:
        for q in posts:
            key = at(*q)
            if key not in seen:
                seen.add(key)
                allposts.append((key, vertical))
    for (X, Y), vertical in sorted(allposts, key=lambda p: p[0][1]):
        if vertical:
            # poste de 3×5: más ancho que los travesaños (así se distingue de ellos), remate claro arriba
            d.rectangle([X - 1, Y - 4, X + 1, Y], fill=w[1])
            d.line([(X + 1, Y - 3), (X + 1, Y)], fill=w[0])
            d.line([(X - 1, Y - 4), (X, Y - 4)], fill=w[2])
        else:
            d.rectangle([X - 1, Y - 7, X, Y], fill=w[1])
            d.line([(X, Y - 6), (X, Y)], fill=w[0])
            d.point((X - 1, Y - 7), fill=w[2])
    sp = outlined(sp, pal['wood_out'])
    foot_y = y1 - 1
    return sp, (x0 - 1) + sp.size[0] // 2, foot_y + 1


def drift(t, px_per_loop, frames, limit=3.0):
    """
    Desplazamiento lento y periódico: `px_per_loop · t`. Avisa (ValueError) si cada cuadro avanza más de `limit` px, para
    que las cosas lentas (nubes, niebla, polvo) bajen sus fps o su recorrido en vez de dar saltos.
    """
    if abs(px_per_loop) / frames > limit + 1e-9:
        raise ValueError(f'drift: {abs(px_per_loop) / frames:.1f} px por cuadro (máximo {limit}); '
                         f'menos recorrido o más cuadros')
    return px_per_loop * t


# ---------------------------------------------------------------- ayudas para el ambiente

def wave(t, offset=0.0):
    """sin(2π(t + offset)): periódica en t con periodo 1 (el bucle cierra solo)."""
    return math.sin(2 * math.pi * (t + offset))


def step3(v):
    """-1, 0 o 1 según un valor en [-1, 1] (para mecer de a 1 px)."""
    return -1 if v < -0.45 else (1 if v > 0.45 else 0)


def seq(values, i):
    """Elemento i de una secuencia cíclica (la secuencia vuelve a su inicio: bucle sin salto si su final empalma)."""
    return values[i % len(values)]


def fade(t):
    """0 → 1 → 0 a lo largo de t ∈ [0, 1): para cosas que se desplazan y aparecen/desaparecen sin saltar."""
    return math.sin(math.pi * (t % 1.0))


def particles(specs, t):
    """
    Posiciones de partículas que cruzan un trayecto en bucle: `specs` = [(x0, y0, dx, dy, fase, sway)].
    Devuelve [(x, y, vida)] con vida en [0, 1) (para desvanecerlas al principio y al final).
    """
    out = []
    for x0, y0, dx, dy, ph, sw in specs:
        u = (t + ph) % 1.0
        x = x0 + dx * u + sw * math.sin(2 * math.pi * (u * 2 + ph))
        y = y0 + dy * u
        out.append((x, y, u))
    return out


# ---------------------------------------------------------------- decorado de las zonas 3–7 (selva, cañón…)
# Añadidos para las zonas 3 y 4 sin tocar lo de arriba (las zonas 1–2 están cerradas): piezas que sirven a más de una zona
# (palmeras y helechos también en la costa; bloques y columnas de ruina también en la guarida; mesetas en la sabana).

def _frond(px, size, x0, y0, ang, length, droop, tones, width=3, fore=1.0, lift=0.0):
    """
    Una fronda (palmera, helecho) que sale de (x0, y0) con ángulo `ang` (rad, 0 = derecha, -π/2 = arriba): el nervio se
    curva hacia abajo con `droop` y lleva foliolos peinados hacia atrás a los dos lados (más cortos hacia la punta).
    `fore` < 1 acorta en vertical (frondas que vienen hacia la cámara). `tones` va de oscuro a claro (4).
    """
    w, h = size

    def put(x, y, c):
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < w and 0 <= yi < h:
            px[xi, yi] = c

    pts = []
    for k in range(length + 1):
        u = k / max(1, length)
        pts.append((x0 + math.cos(ang) * k, y0 + (math.sin(ang) * k) * fore - lift * k + droop * u * u * length, u))
    for k in range(1, len(pts)):
        x, y, u = pts[k]
        px_, py_ = pts[k - 1][0], pts[k - 1][1]
        dx, dy = x - px_, y - py_
        dl = math.hypot(dx, dy) or 1
        dx, dy = dx / dl, dy / dl
        nx, ny = -dy, dx
        leaf = int(round(width * (1 - 0.55 * u) + 0.4))
        if k >= 2 and leaf > 0:
            for side in (1, -1):
                sx, sy = nx * side, ny * side
                lit = sy < 0.2               # el lado que mira arriba recibe la luz
                for j in range(1, leaf + 1):
                    c = tones[3 if lit else 1] if j < leaf else tones[2 if lit else 0]
                    put(x + sx * j - dx * j * 0.6, y + sy * j - dy * j * 0.6 + 0.3 * j, c)
        put(x, y, tones[1] if u > 0.75 else tones[2])


def palm(seed, h, pal, sway=0, n=7, frond=None, droop=None, fore=0.5):
    """
    Palmera (o, con `h` = 0, un helecho bajo): tronco con anillos que se curva un poco y una corona de `n` frondas en
    estrella (las de atrás más largas, las de delante acortadas) que caen hacia las puntas. `sway` (-1, 0, 1) desplaza la
    corona 1 px para mecerla. `pal`: `leaf` (4 tonos), `leaf_out`, y si hay tronco `bark` (3 tonos) y `bark_out`.
    `droop` (por defecto 1.1 con tronco, 0.6 helecho) curva las frondas hacia abajo; `fore` (0.5) acorta las que vienen hacia
    la cámara: con pocas frondas, más caídas y menos acortadas, quedan huecos entre ellas y se ven colgar.
    Pie del sprite = centro de la base.
    """
    rnd = random.Random(seed)
    L = frond if frond is not None else (13 if h else 7)
    cw = 2 * L + 8
    ch = h + L + 8
    sp = layer(cw, ch)
    cx = cw // 2
    base = ch - 2
    bend = rnd.choice((-1, 1)) * (1 if h > 8 else 0)
    top_x, top_y = cx, base
    trunk = None
    if h:
        d = ImageDraw.Draw(sp)
        b = pal['bark']
        for k in range(h):
            u = k / max(1, h - 1)
            x = cx + int(round(bend * 3 * u * u))
            y = base - k
            d.line([(x - 1, y), (x + 1, y)], fill=b[1])
            d.point((x - 1, y), fill=b[2])
            d.point((x + 1, y), fill=b[0])
            if k % 3 == 0:
                d.line([(x - 1, y), (x, y)], fill=b[0])
            top_x, top_y = x, y
        trunk = outlined(sp, pal['bark_out'])
    crown = layer(cw, ch)
    px = crown.load()
    cy = top_y - (1 if h else 1)
    ox = top_x + sway
    order = []
    for k in range(n):
        a = -math.pi / 2 + 2 * math.pi * k / n + rnd.uniform(-0.15, 0.15)
        order.append((math.sin(a), a))
    order.sort()                                  # de atrás (arriba) adelante (abajo)
    dr = droop if droop is not None else (1.1 if h else 0.6)
    for s, a in order:
        front = s > 0.3
        ln = int(L * rnd.uniform(0.85, 1.0) * (0.7 if front else 1.0))
        _frond(px, crown.size, ox + math.cos(a) * 0.5, cy, a, ln, droop=dr, tones=pal['leaf'], width=2, fore=fore,
               lift=(0.45 if h else 0.3) * abs(math.cos(a)))
    # cogollo
    for dx, dy, c in ((0, 0, pal['leaf'][1]), (1, 0, pal['leaf'][0]), (0, -1, pal['leaf'][2])):
        if 0 <= ox + dx < cw and 0 <= cy + dy < ch:
            px[ox + dx, cy + dy] = c
    crown = outlined(crown, pal['leaf_out'])
    out = layer(cw + 2, ch + 2)
    if trunk is not None:
        out.alpha_composite(trunk)
    out.alpha_composite(crown)
    return out


def ruin_block(seed, w, h, pal, top=None, cracks=1):
    """
    Bloque de piedra tallada en vista 3/4: cara de arriba clara (`top` px de alto), cara delantera con una junta y grietas,
    y musgo por arriba si `pal` trae `moss`. `pal`: `stone` (3 tonos, oscuro a claro), `stone_out`.
    """
    rnd = random.Random(seed)
    s = pal['stone']
    tp = top if top is not None else max(2, h // 3)
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    d.rectangle([0, 0, w - 1, tp - 1], fill=s[2])
    d.rectangle([0, tp, w - 1, h - 1], fill=s[1])
    d.line([(0, tp), (w - 1, tp)], fill=s[0])
    d.line([(w - 1, tp), (w - 1, h - 1)], fill=s[0])
    if h - tp > 6:
        jy = tp + (h - tp) // 2
        d.line([(1, jy), (w - 2, jy)], fill=s[0])
        jx = rnd.randint(w // 4, 3 * w // 4)
        d.line([(jx, tp + 1), (jx, jy - 1)], fill=s[0])
    for _ in range(cracks):
        x, y = rnd.randint(1, w - 3), rnd.randint(tp + 1, h - 2)
        for _k in range(rnd.randint(2, 4)):
            if 0 <= x < w and tp < y < h:
                d.point((x, y), fill=s[0])
            x += rnd.choice((-1, 1))
            y += 1
    if 'moss' in pal:
        for _ in range(max(2, w // 3)):
            x = rnd.randint(0, w - 2)
            d.point((x, 0), fill=pal['moss'])
            if rnd.random() < 0.6:
                d.point((x + 1, 0), fill=pal['moss'])
            if rnd.random() < 0.4:
                d.point((x, 1), fill=pal['moss'])
        for _ in range(max(1, w // 6)):
            x = rnd.randint(0, w - 1)
            d.line([(x, tp), (x, tp + rnd.randint(1, 3))], fill=pal['moss'])
    return outlined(sp, pal['stone_out'])


def pillar(seed, h, pal, broken=True, w=6):
    """Columna de piedra con basa y estrías; rota por arriba (borde mellado) o con su capitel. Musgo si `pal` trae `moss`."""
    rnd = random.Random(seed)
    s = pal['stone']
    sp = layer(w + 4, h)
    d = ImageDraw.Draw(sp)
    x0, x1 = 2, w + 1
    d.rectangle([0, h - 3, w + 3, h - 1], fill=s[1])
    d.line([(0, h - 3), (w + 3, h - 3)], fill=s[2])
    d.line([(w + 3, h - 3), (w + 3, h - 1)], fill=s[0])
    top = 0
    if broken:
        top = 2
        d.rectangle([x0, top, x1, h - 4], fill=s[1])
        for x in range(x0, x1 + 1):
            d.line([(x, top), (x, top + rnd.randint(0, 2))], fill=(0, 0, 0, 0))
        d.point((x0 + 1, top + 2), fill=s[2])
    else:
        d.rectangle([0, 0, w + 3, 2], fill=s[1])
        d.line([(0, 0), (w + 3, 0)], fill=s[2])
        d.rectangle([x0, 3, x1, h - 4], fill=s[1])
    for x in range(x0, x1 + 1):
        if x == x0:
            c = s[2]
        elif x == x1:
            c = s[0]
        elif (x - x0) % 2 == 0:
            c = s[0]
        else:
            continue
        for y in range(top + 1 if broken else 3, h - 3):
            if sp.getpixel((x, y))[3]:
                d.point((x, y), fill=c)
    if 'moss' in pal:
        for _ in range(h // 3):
            x, y = rnd.randint(x0, x1), rnd.randint(top + 1, h - 4)
            if sp.getpixel((x, y))[3]:
                d.point((x, y), fill=pal['moss'])
    return outlined(sp, pal['stone_out'])


def mesa(seed, w, h, pal, top_h=None):
    """
    Meseta o farallón de roca estratificada (cañón, sabana): cara de arriba plana e irregular, y la pared con bandas
    horizontales de tono, grietas verticales y la base en sombra. `pal`: `rock` (4 tonos: sombra, pared, pared clara,
    cima), `band` (la banda de otro color) y `rock_out`.
    """
    rnd = random.Random(seed)
    r = pal['rock']
    th = top_h if top_h is not None else max(4, h // 4)
    sp = layer(w, h)
    px = sp.load()
    # silueta: cada columna con su borde de arriba (cima) y la pared que baja hasta el pie
    lo, hi = [], []
    for x in range(w):
        u = (x + 0.5) / w
        edge = 1 + int(2.5 * (1 - math.sin(math.pi * u)) ** 0.5 * 3) + (1 if _h(x // 3, seed) < 0.3 else 0)
        lo.append(edge)
        hi.append(edge + th + (1 if _h(x // 4, seed + 1) < 0.4 else 0))
    bands = []
    y = 0
    while y < h:
        bh = rnd.randint(2, 4)
        bands.append((y, y + bh, rnd.random()))
        y += bh
    cracks = {rnd.randint(2, w - 3) for _ in range(max(2, w // 7))}
    for x in range(w):
        foot = h - 1 - (1 if x in (0, w - 1) else 0)
        for y in range(lo[x], foot + 1):
            if y < hi[x]:
                c = r[3] if y > lo[x] else r[2]
                if _h(x, y, seed + 7) < 0.08:
                    c = r[2]
            else:
                yy = y - hi[x]
                depth = yy / max(1, foot - hi[x])
                band = bands[-1]
                for b in bands:
                    if b[0] <= yy < b[1]:
                        band = b
                        break
                lit = x < w * 0.3
                if band[2] < 0.2:
                    c = pal['band']
                elif band[2] > 0.6 or lit:
                    c = r[2]
                else:
                    c = r[1]
                if yy == band[1] - 1 and _h(x // 3, y, seed + 3) < 0.8:
                    c = r[0]                         # junta oscura entre estratos
                if yy == 0:
                    c = r[0]
                if x >= w - 3 or depth > 0.84:
                    c = r[0]
                if x in cracks and yy > 1 and _h(x, y // 3, seed) < 0.7:
                    c = r[0]
            px[x, y] = c
    return outlined(sp, pal['rock_out'])


def paint_water(img, mask, pal):
    """Agua plana en `mask`: la orilla de arriba hundida (`deep`), la de abajo con luz, motas claras y su ribera."""
    m = mask.load()
    px = img.load()
    rim = mask.filter(ImageFilter.MaxFilter(3)).load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if m[x, y]:
                up = y > 0 and m[x, y - 1]
                up2 = y > 1 and m[x, y - 2]
                down = y < h - 1 and m[x, y + 1]
                c = pal['fill']
                if not up or (not up2 and dither(x, y) < 0.5):
                    c = pal['deep']
                elif not down:
                    c = pal['light']
                elif _h(x // 3, y, 9) < 0.06:
                    c = pal['light']
                px[x, y] = c
            elif rim[x, y]:
                px[x, y] = pal['bank'] if (y < h - 1 and m[x, y + 1]) else pal['bank2']


# ---------------------------------------------------------------- decorado de las zonas 5–6 (sabana, pantano y costa)
# Añadidos para las zonas 5 y 6 sin tocar nada de lo de arriba (las zonas 1–4 están cerradas): árboles de la sabana
# (baobab, acacia), juncos y eneas de la orilla, huesos, y una máscara de agua con orilla irregular.

def baobab(seed, h, pal, leaves=True):
    """
    Baobab (pie = centro de la base): tronco de botella, ancho y gris, más grueso a media altura y estrecho arriba, con
    estrías verticales y la luz de un lado (la izquierda, `bark[2]`) y la sombra del otro; de lo alto salen unas ramas
    cortas y retorcidas como raíces al aire, con matas de hoja pequeñas y ralas si `leaves`. `pal`: `bark` (3 tonos,
    oscuro a claro), `bark_out` y, con hojas, `leaf` (4 tonos) y `leaf_out`.
    """
    rnd = random.Random(seed)
    tw = max(8, int(h * 0.42))                  # ancho del tronco a media altura
    th = int(h * 0.62)                          # alto del tronco
    crown = h - th
    cw = tw * 3 + 8
    ch = h + 3
    cx = cw / 2
    base = ch - 2
    sp = layer(cw, ch)
    px = sp.load()
    b = pal['bark']
    hw_top = tw * 0.26
    for k in range(th + 1):
        u = k / th
        hw = tw / 2 * (0.86 + 0.22 * math.sin(math.pi * min(1.0, u * 1.25))) * (1 - 0.55 * u * u)
        hw = max(hw, hw_top)
        if k < 2:
            hw += 1.5 - k * 0.6                    # el pie se abre un poco
        y = base - k
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            rel = (x - x0) / max(1, x1 - x0)
            if rel < 0.28:
                c = b[2]
            elif rel > 0.74:
                c = b[0]
            else:
                c = b[1]
            if 0.28 <= rel <= 0.74 and (x + int(seed)) % 3 == 0 and _h(x, y // 3, seed) < 0.7:
                c = b[0]                           # estrías
            if rel < 0.28 and dither(x, y) < 0.25 and rel > 0.18:
                c = b[1]
            px[x, y] = c
    top_y = base - th
    tips = []
    d = ImageDraw.Draw(sp)
    n = rnd.randint(5, 7)
    for j in range(n):
        side = (j - (n - 1) / 2) / max(1, (n - 1) / 2)          # -1 (izquierda) … 1 (derecha)
        a = -math.pi / 2 + side * 1.4 + rnd.uniform(-0.15, 0.15)
        ln = crown * rnd.uniform(0.8, 1.05) * (0.8 + 0.7 * abs(side))
        sx = cx + side * hw_top * 0.8
        x, y = sx, top_y + 1
        pts = [(x, y)]
        for s in range(3):
            # se abren hacia fuera y la punta se vuelve hacia arriba (como raíces al aire)
            a2 = a + (-side * 0.28 * s) + rnd.uniform(-0.3, 0.3)
            x += math.cos(a2) * ln / 3
            y += math.sin(a2) * ln / 3 * 0.85
            pts.append((x, y))
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            d.line([(ax, ay), (bx, by)], fill=b[1])
        ax, ay = pts[0]
        bx, by = pts[1]
        d.line([(ax, ay + 1), (bx, by + 1)], fill=b[0])             # la base de la rama, más gruesa
        d.line([(ax, ay - 1), (bx, by - 1)], fill=b[2])
        d.point((int(round(pts[-1][0])), int(round(pts[-1][1]))), fill=b[2])
        tips.append(pts[-1])
        if abs(side) > 0.4:
            tips.append(((pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2 - 1))
    out = outlined(sp, pal['bark_out'])
    if leaves and 'leaf' in pal:
        lay = layer(cw, ch)
        blobs = []
        for k, (x, y) in enumerate(tips):
            if rnd.random() < 0.75:
                r = rnd.uniform(1.6, 2.5)
                blobs.append((x + rnd.uniform(-1, 1), y + rnd.uniform(-1, 0.5), r))
        blobs.sort(key=lambda bb: -bb[1])
        _blob_canopy(lay, blobs, pal['leaf'], seed, dark_seam=False)
        lay = outlined(lay, pal['leaf_out'])
        out.alpha_composite(lay)
    return out


def acacia(seed, w, pal):
    """
    Acacia de copa plana (paraguas), pie = centro de la base: tronco fino que se abre en dos o tres ramas en V y una copa
    ancha y chata (unas 3 veces más ancha que alta) con la cara de arriba iluminada y la de abajo en sombra, hecha de
    elipses aplastadas con textura de hoja. `pal`: `bark` (3), `bark_out`, `leaf` (4 tonos), `leaf_out`.
    """
    rnd = random.Random(seed)
    cw = w + 4
    canopy_h = max(5, int(w * 0.32))
    trunk_h = int(w * 0.62)
    ch = canopy_h + trunk_h + 3
    sp = layer(cw, ch)
    d = ImageDraw.Draw(sp)
    b = pal['bark']
    cx = cw // 2 + rnd.randint(-1, 1)
    base = ch - 2
    fork = base - int(trunk_h * 0.5)
    d.line([(cx, base), (cx, fork)], fill=b[1])
    d.line([(cx + 1, base), (cx + 1, fork + 2)], fill=b[0])
    d.point((cx - 1, base), fill=b[1])
    d.point((cx + 2, base), fill=b[0])
    cy = canopy_h // 2 + 1
    for dx in (-w * 0.3, w * 0.05, w * 0.28):
        tx = cx + dx
        d.line([(cx, fork), (tx, cy + canopy_h * 0.35)], fill=b[1])
    trunk = outlined(sp, pal['bark_out'])
    lay = layer(cw, ch)
    px = lay.load()
    ells = []
    x = 2.0
    while x < cw - 2 - w * 0.12:
        rx = rnd.uniform(w * 0.14, w * 0.22)
        ex = min(x + rx * 0.7, cw - 2 - rx)
        ells.append((ex, cy + rnd.uniform(-1.2, 1.2), rx, canopy_h * rnd.uniform(0.42, 0.55)))
        x += rx * 1.1
    lt = pal['leaf']
    for yy in range(ch):
        for xx in range(cw):
            inside = None
            for k, (ex, ey, rx, ry) in enumerate(ells):
                e = ((xx + 0.5 - ex) / rx) ** 2 + ((yy + 0.5 - ey) / ry) ** 2
                if e <= 1:
                    inside = (k, e, (yy + 0.5 - ey) / ry, (xx + 0.5 - ex) / rx)
            if inside is None:
                continue
            k, e, ny, nx = inside
            lit = 0.62 - 0.75 * ny - 0.25 * nx + (_h(xx, yy, seed + k) - 0.5) * 0.4
            lvl = max(0, min(3, int(lit * 3 + dither(xx, yy) * 0.9)))
            px[xx, yy] = lt[lvl]
    lay = outlined(lay, pal['leaf_out'])
    out = layer(cw + 2, ch + 2)
    out.alpha_composite(trunk)
    out.alpha_composite(lay)
    return out


def reeds(seed, w, h, pal, sway=0, heads=2):
    """
    Mata de juncos o eneas (pie = centro de la base): tallos finos de 1 px que se abren en abanico, con hojas largas que
    caen a los lados y `heads` mazorcas de enea (2×3, pardas) en lo alto. `sway` (-1, 0, 1) desplaza las puntas 1 px para
    mecerlos. `pal`: `stem` (3 tonos, oscuro a claro), `head` (2 tonos) y `out`.
    """
    rnd = random.Random(seed)
    cw, ch = w + 4, h + 3
    sp = layer(cw, ch)
    px = sp.load()
    s = pal['stem']
    cx = cw / 2
    base = ch - 2
    n = max(3, w // 2 + 1)
    tops = []
    for k in range(n):
        u = (k + 0.5) / n - 0.5
        hh = h * rnd.uniform(0.6, 1.0) * (1 - 0.35 * abs(u))
        lean = u * w * 0.9 + rnd.uniform(-0.6, 0.6)
        c = s[2] if k % 3 == 0 else (s[1] if k % 3 == 1 else s[0])
        for j in range(int(hh)):
            v = j / max(1, hh)
            x = cx + u * 2 + lean * v * v + (sway * v * v if v > 0.5 else 0)
            y = base - j
            xi = int(round(x))
            if 0 <= xi < cw and 0 <= y < ch:
                px[xi, y] = c
        tops.append((cx + u * 2 + lean + sway, base - int(hh) + 1, hh))
    rnd.shuffle(tops)
    for x, y, hh in tops[:heads]:
        if hh < h * 0.7:
            continue
        xi, yi = int(round(x)), int(round(y)) + 1
        for dx, dy, c in ((0, 0, pal['head'][1]), (0, 1, pal['head'][0]), (0, 2, pal['head'][0]),
                          (1, 1, pal['head'][0]), (0, -1, s[2])):
            if 0 <= xi + dx < cw and 0 <= yi + dy < ch:
                px[xi + dx, yi + dy] = c
    return outlined(sp, pal['out'])


def blob_mask(shapes, wob=0.3, seed=0, size=None):
    """
    Máscara 'L' (por defecto del tamaño de la escena) unión de elipses `(cx, cy, rx, ry)` con el borde ondulado por ruido
    (`wob` = fracción del radio): para charcas, lagunas y salinas de orilla irregular.
    """
    w, h = size if size else (W, H)
    m = Image.new('L', (w, h), 0)
    px = m.load()
    for cx, cy, rx, ry in shapes:
        for y in range(max(0, int(cy - ry * (1 + wob)) - 1), min(h, int(cy + ry * (1 + wob)) + 2)):
            for x in range(max(0, int(cx - rx * (1 + wob)) - 1), min(w, int(cx + rx * (1 + wob)) + 2)):
                a = math.atan2((y - cy) / ry, (x - cx) / rx)
                k = 1 + wob * (0.55 * math.sin(3 * a + seed) + 0.3 * math.sin(5 * a + 2.1 * seed) +
                               0.15 * math.sin(9 * a + 0.7 * seed))
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= k * k:
                    px[x, y] = 255
    return m


# ---------------------------------------------------------------- luz propia (píxeles «emisivos»)
#
# El `grade` apaga todo por igual: un destello de sol, una luciérnaga o una brasa salen grises. Lo que da luz propia se pinta
# DESPUÉS del oscurecido (con su color final), igual en la escena que en sus capas de ambiente, así encaja píxel a píxel.

def emissive(c, level, k=0.5):
    """`c` con solo la fracción `k` del oscurecido del nivel `level` (sin viñeta ni tinte frío): el color final de una luz."""
    hh, ss, vv = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    ss *= 1 - 0.11 * level * k
    vv *= 1 - 0.08 * level * k
    return tuple(int(round(v * 255)) for v in colorsys.hsv_to_rgb(hh, ss, vv)) + (c[3] if len(c) > 3 else 255,)


def _paint_glow(img, origin, spots):
    """Pinta `spots` [(x, y, color)] (coordenadas de la escena, color final; con alfa < 255 se mezcla) sobre `img`."""
    px = img.load()
    w, h = img.size
    ox, oy = origin
    for x, y, c in spots:
        x, y = x - ox, y - oy
        if not (0 <= x < w and 0 <= y < h):
            continue
        a = c[3] if len(c) > 3 else 255
        px[x, y] = c[:3] + (255,) if a >= 255 else mix(px[x, y], c, a / 255)[:3] + (px[x, y][3],)


def glow_base(scene, spots):
    """
    Luz propia en la escena base (una brasa): `spots` [(x, y, color final)]. Llamar antes de `add_fx`/`add_glow_fx`
    (los ambientes se recortan de la base) y fuera de las cajas de ambiente (sus cuadros no la llevarían).
    """
    if scene.fx:
        raise ValueError('glow_base: va antes de los ambientes')
    img = scene.base()
    _paint_glow(img, (0, 0), spots)
    scene._glow_base = getattr(scene, '_glow_base', []) + [(x, y) for x, y, _c in spots]


def add_glow_fx(scene, name, box, frames, fps, fn, glow, allow_path=False):
    """
    `Scene.add_fx` con luz propia: como `add_fx` (`fn(t, i)` -> (variantes, overlay) o None), y además `glow(t, i)` ->
    [(x, y, color final)] que se pinta sobre cada cuadro ya oscurecido, antes de quedarse con lo que cambia. Las mismas
    comprobaciones que `add_fx` (camino, puntos, transparencia, cuadros distintos, cajas que no se pisan).
    """
    for x, y in getattr(scene, '_glow_base', []):
        if box[0] <= x < box[2] and box[1] <= y < box[3]:
            raise ValueError(f'{name}: su caja tapa una luz de la escena en {x},{y}')
    base = scene.base().crop(box)
    out = []
    for i in range(frames):
        t = i / frames
        variants, overlay = fn(t, i) if fn else (None, None)
        g = grade(scene.compose(box, variants, overlay), scene.level, box[:2])
        _paint_glow(g, box[:2], glow(t, i))
        diff = ImageChops.difference(g.convert('RGB'), base.convert('RGB'))
        r, gg, b = diff.split()
        m = ImageChops.lighter(ImageChops.lighter(r, gg), b).point(lambda v: 255 if v else 0)
        f = layer(box[2] - box[0], box[3] - box[1])
        f.paste(g, (0, 0), m)
        out.append(f)
        scene._check_fx(name, box, f, allow_path)
    if len({f.tobytes() for f in out}) < 2:
        raise ValueError(f'{name}: todos los cuadros iguales')
    for other in scene.fx:
        if boxes_touch(box, (other[1], other[2], other[1] + other[3][0].size[0], other[2] + other[3][0].size[1])):
            raise ValueError(f'{name} pisa la caja de {other[0]}')
    scene.fx.append((name, box[0], box[1], out, fps))
    return out


def glow_spots(sp, x, y, glows):
    """
    [(x, y, color final)] de los píxeles de `sp` puesto con la base en (x, y) (como `Scene.put`) cuyo color está en
    `glows` {color del sprite: color final}: la brasa de una fogata, una ventana encendida.
    """
    left, top = x - sp.size[0] // 2, y - sp.size[1] + 1
    keys = {c[:3]: v for c, v in glows.items()}
    px = sp.load()
    return [(left + i, top + j, keys[px[i, j][:3]]) for j in range(sp.size[1]) for i in range(sp.size[0])
            if px[i, j][3] and px[i, j][:3] in keys]
