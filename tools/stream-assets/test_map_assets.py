"""
Pruebas del mapa del Chess Runner (`export_map.py`).   ./.venv/bin/python -m unittest -v

Lo que importa (contrato en docs/personajes/ASSETS_SPEC.md): tamaños exactos, transparencia donde toca, puntos dentro
del lienzo y en su número por zona, al menos 4 animaciones de ambiente por zona dentro del lienzo y sin tapar los puntos,
oscuridad que crece de zona en zona (y que se nota: la luz baja al menos 0.03 por nivel), que `map.json` describa bien
los PNG, que las zonas verdes no se vuelvan oliva al oscurecerlas (y que la selva sea verde oscuro, el cañón rojizo y el
pantano azul verdoso), determinismo y que lo versionado coincida.
Lo que aún no existe (zonas, nodos o papel por construir) se salta con un aviso que dice qué falta.
"""
import colorsys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from PIL import Image

import export_map
from pack_common import check, compare, frames_of

ZONE = (220, 420)
PAPER = (220, 320)
MARGIN = 14
NODE = 20
# Puntos por zona: (de patrón sin contar al jefe, jefe, rescate, campamento, puertas, rey)
POINTS = {1: (5, 1, 1, 1, 0, 0), 2: (5, 1, 1, 1, 0, 0), 3: (5, 1, 1, 1, 0, 0), 4: (5, 1, 1, 1, 0, 0),
          5: (4, 1, 1, 1, 0, 0), 6: (4, 1, 1, 1, 0, 0), 7: (2, 0, 0, 0, 6, 1)}
KINDS = ('pattern', 'boss', 'rescue', 'camp', 'door', 'king')
STARRED = ('pattern', 'boss')
BOSSES = ('ardilla', 'conejo', 'mono', 'caballo', 'elefante', 'tortuga', 'rey')
CHECKPOINTS = 43


def node_sprites():
    """Nombre -> (ancho, alto, cuadros) de cada nodo y pieza suelta que pide el contrato."""
    want = {}
    for kind in KINDS:
        dones = ('done1', 'done2', 'done3') if kind in STARRED else ('done',)
        for state, frames in [('locked', 1), ('open', 2), ('current', 2)] + [(d, 1) for d in dones]:
            want[f'map-node-{kind}-{state}'] = (NODE, NODE, frames)
    want['map-lock'] = (12, 14, 1)
    want['map-path-dot'] = (4, 4, 2)
    return want


def paper_sprites():
    want = {f'paper-map-d{i}': (*PAPER, 1) for i in range(3)}
    want.update({'cookie-board': (10, 10, 1), 'cookie-board-empty': (10, 10, 1), 'cookie-gold': (10, 10, 1),
                 'paper-marker': (12, 12, 2)})
    for boss in BOSSES:
        for state in ('open', 'locked'):
            want[f'paper-stop-{boss}-{state}'] = (20, 20, 1)
    return want


def _stats(img):
    """(saturación media, luminancia media) de una escena opaca."""
    small = img.convert('RGB').resize((55, 105), Image.BOX)
    sat = lum = 0.0
    for r, g, b in small.getdata():
        _h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        sat, lum = sat + s, lum + l
    n = small.size[0] * small.size[1]
    return sat / n, lum / n


LUMA_STEP = 0.03   # lo mínimo que tiene que bajar la luminancia media por cada nivel de oscuridad


def _luma(img):
    """Luminancia media Rec.709 (0–1) de una escena opaca: lo que el ojo ve como «más clara» u «más oscura»."""
    small = img.convert('RGB').resize((55, 105), Image.BOX)
    return sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in small.getdata()) / (255 * 55 * 105)


GREEN_ZONES = (1, 2, 3)   # zonas cuyo suelo es verde (bosque, praderas, selva)
GREEN_HUE = 70           # grados: por debajo, el verde ya se lee oliva o caqui
JUNGLE_HUE = 100         # grados: los verdes de la selva (zona 3), fríos
CANYON_HUE = (10, 20)    # grados: el suelo del cañón (zona 4), terracota
CANYON_SAT = 0.42        # por debajo, la tierra del cañón se lee marrón malva
SWAMP_HUE = (165, 200)   # grados: el azul verdoso del pantano (zona 6); por encima, azul violáceo; por debajo, verde
SAVANNA_HUE = (24, 36)   # grados: el naranja apagado de la sabana (zona 5); por debajo, terracota; por encima, ocre
SAVANNA_SAT = 0.48       # por debajo, la hierba seca de la sabana se lee tierra marrón (barro)
LAIR_HUE = (250, 300)    # grados: el violeta de la guarida (zona 7); por debajo, azul; por encima, magenta
LAIR_FAMILY = (230, 320)  # grados: lo que tiene color en la guarida cae aquí (casi monocroma: lo demás es gris)
LAIR_SAT = 0.30          # saturación media máxima de la guarida (HSV)


def _green_hues(img):
    """(tono del color más repetido, tono medio de los píxeles verdes o amarillos con algo de color), en grados."""
    px = list(img.convert('RGB').getdata())
    top = Counter(px).most_common(1)[0][0]
    ground = colorsys.rgb_to_hsv(*(v / 255 for v in top))[0] * 360
    hues = [h * 360 for h, s, _v in (colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in px)
            if 40 <= h * 360 <= 160 and s > 0.2]
    return ground, sum(hues) / max(1, len(hues))


def _size(path):
    with Image.open(path) as im:
        return im.size


class _Built(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls._tmp.name)
        cls.manifest = export_map.build(cls.out)
        cls.sprites = cls.manifest['sprites']
        cls.zones = {int(k): v for k, v in cls.manifest['zones'].items()}

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def frames(self, name):
        s = self.sprites[name]
        return frames_of(Image.open(self.out / s['file']).convert('RGBA'), s['frameW'])

    def present(self, want):
        """Comprueba medidas de lo que existe y devuelve lo que falta."""
        for name, (w, h, n) in want.items():
            if name in self.sprites:
                s = self.sprites[name]
                self.assertEqual((s['frameW'], s['frameH'], s['frames']), (w, h, n), name)
        return sorted(set(want) - set(self.sprites))


class Determinismo(_Built):
    def test_regenerar_da_los_mismos_pixeles(self):
        with tempfile.TemporaryDirectory() as b:
            export_map.build(Path(b))
            self.assertEqual(compare(Path(b), self.out)[0], [])

    def test_lo_versionado_en_la_app_coincide(self):
        self.assertEqual(check(export_map.build, export_map.DEFAULT_OUT), 0)


class Manifiesto(_Built):
    def test_describe_cada_tira(self):
        for name, s in self.sprites.items():
            self.assertEqual(_size(self.out / s['file']), (s['frameW'] * s['frames'], s['frameH']), name)

    def test_no_sobra_ningun_archivo(self):
        self.assertEqual({p.name for p in self.out.iterdir()}, {s['file'] for s in self.sprites.values()} | {'map.json'})

    def test_estan_las_siete_zonas(self):
        self.assertTrue(set(self.zones) <= set(POINTS), f'zonas desconocidas: {sorted(set(self.zones) - set(POINTS))}')
        missing = sorted(set(POINTS) - set(self.zones))
        if missing:
            self.skipTest(f'aún faltan las zonas {missing}')


class Zonas(_Built):
    def test_cada_escena_mide_220x420_y_es_opaca(self):
        for zid, zone in self.zones.items():
            scene = self.frames(zone['scene'])
            self.assertEqual(len(scene), 1, zid)
            self.assertEqual(scene[0].size, ZONE, zid)
            self.assertEqual(scene[0].getextrema()[3], (255, 255), f'zona {zid}: la escena base no puede tener huecos')

    def test_nombre_jefe_y_nivel_de_oscuridad(self):
        for zid, zone in self.zones.items():
            self.assertTrue(zone.get('name'), zid)
            self.assertEqual(zone.get('boss'), BOSSES[zid - 1], zid)
            self.assertEqual(zone.get('darkness'), zid - 1, zid)

    def test_los_puntos_son_los_que_pide_la_historia(self):
        for zid, zone in self.zones.items():
            pts = zone['points']
            counts = tuple(sum(1 for p in pts if p['kind'] == k) for k in KINDS)
            self.assertEqual(counts, POINTS[zid], f'zona {zid}: {dict(zip(KINDS, counts))}')
            self.assertEqual(sorted(p['order'] for p in pts), list(range(1, len(pts) + 1)), zid)

    def test_el_jefe_o_el_rey_es_el_ultimo_punto(self):
        for zid, zone in self.zones.items():
            last = max(zone['points'], key=lambda p: p['order'])
            self.assertEqual(last['kind'], 'king' if zid == 7 else 'boss', zid)

    def test_los_puntos_caben_con_margen_y_no_se_pisan(self):
        for zid, zone in self.zones.items():
            pts = zone['points']
            for p in pts:
                self.assertTrue(MARGIN <= p['x'] <= ZONE[0] - MARGIN and MARGIN <= p['y'] <= ZONE[1] - MARGIN,
                                f'zona {zid}: punto {p["order"]} fuera del margen ({p["x"]},{p["y"]})')
            for i, a in enumerate(pts):
                for b in pts[i + 1:]:
                    self.assertGreaterEqual(max(abs(a['x'] - b['x']), abs(a['y'] - b['y'])), NODE + 4,
                                            f'zona {zid}: los puntos {a["order"]} y {b["order"]} se pisan')

    def test_se_entra_por_abajo_y_se_sale_por_arriba(self):
        for zid, zone in self.zones.items():
            pts = sorted(zone['points'], key=lambda p: p['order'])
            self.assertGreater(pts[0]['y'], pts[-1]['y'], f'zona {zid}: el primer punto debe estar más abajo que el último')

    def test_al_menos_cuatro_animaciones_de_ambiente_que_caben_y_no_tapan_puntos(self):
        for zid, zone in self.zones.items():
            fxs = zone.get('ambient', [])
            self.assertGreaterEqual(len(fxs), 4, f'zona {zid}: {len(fxs)} animaciones de ambiente')
            for fx in fxs:
                tag = f'zona {zid} {fx["sprite"]}'
                self.assertTrue(fx['sprite'].startswith(f'map-fx-{zid}-'), tag)
                self.assertTrue(2 <= fx['frames'] <= 8, f'{tag}: {fx["frames"]} cuadros')
                self.assertTrue(2 <= fx['fps'] <= 8, f'{tag}: {fx["fps"]} fps')
                self.assertTrue(0 <= fx['x'] and fx['x'] + fx['frameW'] <= ZONE[0], f'{tag} se sale en x')
                self.assertTrue(0 <= fx['y'] and fx['y'] + fx['frameH'] <= ZONE[1], f'{tag} se sale en y')
                frames = self.frames(fx['sprite'])
                self.assertGreater(len({f.tobytes() for f in frames}), 1, f'{tag}: todos los cuadros iguales')
                for p in zone['points']:
                    half = NODE // 2
                    for f in frames:
                        box = f.getbbox()
                        if box is None:
                            continue
                        x0, y0, x1, y1 = fx['x'] + box[0], fx['y'] + box[1], fx['x'] + box[2], fx['y'] + box[3]
                        overlap = x0 < p['x'] + half and p['x'] - half < x1 and y0 < p['y'] + half and p['y'] - half < y1
                        self.assertFalse(overlap, f'{tag} tapa el punto {p["order"]}')

    def test_las_animaciones_de_ambiente_son_capas_con_transparencia(self):
        for zid, zone in self.zones.items():
            for fx in zone.get('ambient', []):
                for f in self.frames(fx['sprite']):
                    self.assertEqual(f.getextrema()[3][0], 0, f'{fx["sprite"]}: capa sin transparencia')

    def test_cada_zona_es_mas_tenebrosa_que_la_anterior(self):
        stats = {zid: _stats(self.frames(z['scene'])[0]) for zid, z in self.zones.items()}
        for zid in sorted(stats):
            if zid - 1 in stats:
                (s0, l0), (s1, l1) = stats[zid - 1], stats[zid]
                self.assertLess(l1, l0 + 0.005, f'zona {zid} más luminosa que la {zid - 1} ({l1:.3f} vs {l0:.3f})')
                self.assertLess(s1 + l1, s0 + l0, f'zona {zid} no se oscurece ni pierde color respecto a la {zid - 1}')

    def test_la_luz_baja_a_ojos_vista_en_cada_nivel(self):
        # La prueba anterior se conforma con «no más clara»: la zona 2 de la ronda 1 la pasaba con −0.011 de luminancia y a
        # simple vista no era más oscura que la 1. Aquí cada nivel tiene que restar al menos LUMA_STEP.
        luma = {zid: _luma(self.frames(z['scene'])[0]) for zid, z in self.zones.items()}
        for zid in sorted(luma):
            if zid - 1 in luma:
                levels = self.zones[zid]['darkness'] - self.zones[zid - 1]['darkness']
                self.assertGreaterEqual(luma[zid - 1] - luma[zid], LUMA_STEP * levels - 1e-9,
                                        f'zona {zid}: luminancia {luma[zid]:.3f} frente a {luma[zid - 1]:.3f} de la '
                                        f'{zid - 1}; tiene que bajar al menos {LUMA_STEP} por nivel')

    def test_los_verdes_no_se_vuelven_oliva(self):
        # Al apagar un verde amarillento sale oliva o caqui, el registro «cubierto y polvoriento» que el contrato reserva al
        # cañón (zona 4) y a la sabana: así se coló el oliva de la zona 2 en la ronda 2 del P5, con la luz en su sitio. En las
        # zonas verdes (bosque, praderas, selva) el color que más se repite (el suelo) y el tono medio de sus verdes tienen que
        # quedarse en GREEN_HUE o más.
        for zid in GREEN_ZONES:
            if zid not in self.zones:
                continue
            ground, mean = _green_hues(self.frames(self.zones[zid]['scene'])[0])
            self.assertGreaterEqual(ground, GREEN_HUE, f'zona {zid}: el suelo tira a oliva (tono {ground:.0f}°)')
            self.assertGreaterEqual(mean, GREEN_HUE, f'zona {zid}: sus verdes tiran a oliva (tono medio {mean:.0f}°)')

    def test_la_selva_es_verde_oscuro_y_el_canon_rojizo(self):
        # La luminancia media no basta: en la ronda 1 del P6 la selva cumplía con un suelo más claro que el de la zona 2
        # (la oscuridad salía solo de las copas) y el cañón con una tierra marrón malva. Se vigila el suelo (el color que
        # más se repite) y el tono de los verdes.
        need = (2, 3, 4)
        if not set(need) <= set(self.zones):
            self.skipTest(f'aún faltan las zonas {sorted(set(need) - set(self.zones))}')
        soil = {}
        for zid in need:
            px = list(self.frames(self.zones[zid]['scene'])[0].convert('RGB').getdata())
            top = Counter(px).most_common(1)[0][0]
            soil[zid] = colorsys.rgb_to_hsv(*(v / 255 for v in top))
        _ground, mean = _green_hues(self.frames(self.zones[3]['scene'])[0])
        self.assertGreaterEqual(mean, JUNGLE_HUE, f'zona 3: sus verdes tiran a amarillo (tono medio {mean:.0f}°)')
        self.assertLess(soil[3][2], soil[2][2], f'zona 3: el suelo (V {soil[3][2]:.2f}) no puede ser más claro que el de '
                                                f'la zona 2 (V {soil[2][2]:.2f})')
        h, s, _v = soil[4]
        self.assertTrue(CANYON_HUE[0] <= h * 360 <= CANYON_HUE[1], f'zona 4: el suelo no es rojizo (tono {h * 360:.0f}°)')
        self.assertGreaterEqual(s, CANYON_SAT, f'zona 4: el suelo está apagado, tira a malva (S {s:.2f})')

    def test_el_pantano_es_azul_verdoso(self):
        # La zona 6 es la más oscura antes de la guarida: al bajar tanto la luz es fácil que el azul verdoso se vuelva gris
        # (sin saturación) o que el tinte frío del `grade` lo lleve al azul violáceo. Se vigila el suelo (el color que más se
        # repite), el tono medio de lo que tiene algo de color y que lo gris no se coma la escena.
        if 6 not in self.zones:
            self.skipTest('aún falta la zona 6')
        px = list(self.frames(self.zones[6]['scene'])[0].convert('RGB').getdata())
        top = Counter(px).most_common(1)[0][0]
        h, s, _v = colorsys.rgb_to_hsv(*(v / 255 for v in top))
        self.assertTrue(SWAMP_HUE[0] <= h * 360 <= SWAMP_HUE[1], f'zona 6: el suelo no es azul verdoso (tono {h * 360:.0f}°)')
        self.assertGreaterEqual(s, 0.2, f'zona 6: el suelo es gris (S {s:.2f})')
        hues = [hh * 360 for hh, ss, _ in (colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in px) if ss > 0.15]
        self.assertGreaterEqual(len(hues) / len(px), 0.5, 'zona 6: más de la mitad de la escena es gris')
        mean = sum(hues) / len(hues)
        self.assertTrue(SWAMP_HUE[0] <= mean <= SWAMP_HUE[1] + 10, f'zona 6: el tono medio tira fuera del azul verdoso '
                                                                   f'({mean:.0f}°)')

    def test_la_sabana_es_naranja_apagado(self):
        # En la ronda 1 de la P7 el suelo de la zona 5 salía `#664f3a` (S 0.43): junto al terracota del cañón se leía barro
        # marrón, no la hierba seca «naranja apagado» del contrato. Se vigila el suelo (el color que más se repite).
        if 5 not in self.zones:
            self.skipTest('aún falta la zona 5')
        px = list(self.frames(self.zones[5]['scene'])[0].convert('RGB').getdata())
        top = Counter(px).most_common(1)[0][0]
        h, s, _v = colorsys.rgb_to_hsv(*(v / 255 for v in top))
        self.assertTrue(SAVANNA_HUE[0] <= h * 360 <= SAVANNA_HUE[1], f'zona 5: el suelo no es naranja (tono {h * 360:.0f}°)')
        self.assertGreaterEqual(s, SAVANNA_SAT, f'zona 5: el suelo está apagado, se lee barro marrón (S {s:.2f})')

    def test_la_guarida_es_casi_monocroma_y_violeta(self):
        # La zona 7 es la más oscura: con el `grade` del nivel 6 es fácil que se quede en un gris sin carácter (sin el velo
        # violeta del contrato) o que se cuele otro color en la escena base. Se vigila el suelo (el color que más se repite),
        # el tono medio de lo que tiene algo de color y que casi todo ese color sea de la familia del violeta (lo demás, gris).
        # La luz propia (ojos rojos, fuego, rayo) va en los ambientes, no en la base.
        if 7 not in self.zones:
            self.skipTest('aún falta la zona 7')
        px = list(self.frames(self.zones[7]['scene'])[0].convert('RGB').getdata())
        top = Counter(px).most_common(1)[0][0]
        h, s, _v = colorsys.rgb_to_hsv(*(v / 255 for v in top))
        self.assertTrue(LAIR_HUE[0] <= h * 360 <= LAIR_HUE[1], f'zona 7: el suelo no es violeta (tono {h * 360:.0f}°)')
        self.assertGreaterEqual(s, 0.12, f'zona 7: el suelo es gris sin velo violeta (S {s:.2f})')
        hsv = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in px]
        hues = [hh * 360 for hh, ss, _ in hsv if ss > 0.1]
        mean = sum(hues) / max(1, len(hues))
        self.assertTrue(LAIR_HUE[0] <= mean <= LAIR_HUE[1], f'zona 7: el tono medio tira fuera del violeta ({mean:.0f}°)')
        off = sum(1 for hh in hues if not LAIR_FAMILY[0] <= hh <= LAIR_FAMILY[1]) / max(1, len(hues))
        self.assertLessEqual(off, 0.02, f'zona 7: un {off:.0%} de lo que tiene color no es violeta (no es casi monocroma)')
        sat = sum(ss for _, ss, _ in hsv) / len(hsv)
        self.assertLessEqual(sat, LAIR_SAT, f'zona 7: demasiado color para la guarida (S media {sat:.2f})')


class NodosYPapel(_Built):
    def test_nodos_candado_y_puntito(self):
        missing = self.present(node_sprites())
        for name in node_sprites():
            if name in self.sprites:
                for f in self.frames(name):
                    self.assertEqual(f.getextrema()[3][0], 0, f'{name}: sin transparencia')
                    self.assertIsNotNone(f.getbbox(), name)
        if missing:
            self.skipTest(f'aún faltan {len(missing)} sprites de nodos: {", ".join(missing[:6])}…')

    def test_papel_galletas_paradas_y_marcador(self):
        missing = self.present(paper_sprites())
        if missing:
            self.skipTest(f'aún faltan {len(missing)} sprites del papel: {", ".join(missing[:6])}…')

    def test_paradas_y_rastro_del_papel(self):
        paper = self.manifest['paper']
        if not paper:
            self.skipTest('aún no hay mapa de papel')
        stops = paper['stops']
        self.assertEqual([s['boss'] for s in stops], list(BOSSES))
        self.assertEqual(len(paper['trail']), CHECKPOINTS)
        for p in stops + paper['trail']:
            self.assertTrue(0 <= p['x'] < PAPER[0] and 0 <= p['y'] < PAPER[1], p)



PAPER_CHECKPOINTS = (6, 6, 6, 6, 5, 5, 9)   # galletas del rastro por zona (HISTORIA, «Puntos del mapa»): suman 43
TRAIL_STEP = 32     # px: lo más que se separan dos galletas seguidas (o una parada de la galleta vecina) por el camino


def _opaque_luma(img):
    """Luminancia media Rec.709 (0–1) de los píxeles opacos (el papel tiene el borde quemado transparente)."""
    px = [(r, g, b) for r, g, b, a in img.convert('RGBA').getdata() if a == 255]
    return sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px) / (255 * len(px))


class RastroDelPapel(_Built):
    """El rastro sigue la ruta impresa en orden, nada se pisa y el papel se oscurece de d0 a d2."""

    def setUp(self):
        self.paper = self.manifest['paper']
        if not self.paper or any(f'paper-map-d{i}' not in self.sprites for i in range(3)):
            self.skipTest('aún no hay mapa de papel')

    def test_galletas_por_zona_en_orden(self):
        zones = [t['zone'] for t in self.paper['trail']]
        self.assertEqual(zones, [str(z) for z, n in enumerate(PAPER_CHECKPOINTS, start=1) for _ in range(n)])

    def test_el_rastro_avanza_por_la_ruta_sin_saltos(self):
        # Paradas y galletas intercaladas en el orden del viaje: la parada de cada zona y luego sus galletas.
        seq, trail = [], iter(self.paper['trail'])
        for z, (stop, n) in enumerate(zip(self.paper['stops'], PAPER_CHECKPOINTS), start=1):
            seq.append(stop)
            seq.extend(next(trail) for _ in range(n))
        for a, b in zip(seq, seq[1:]):
            gap = ((a['x'] - b['x']) ** 2 + (a['y'] - b['y']) ** 2) ** 0.5
            self.assertLessEqual(gap, TRAIL_STEP, f'salto de {gap:.0f} px entre {a} y {b}')

    def test_galletas_y_paradas_no_se_pisan(self):
        boxes = [(t['x'], t['y'], 10) for t in self.paper['trail']] + [(s['x'], s['y'], 20) for s in self.paper['stops']]
        for i, a in enumerate(boxes):
            for b in boxes[i + 1:]:
                need = (a[2] + b[2]) / 2
                self.assertGreaterEqual(max(abs(a[0] - b[0]), abs(a[1] - b[1])), need, f'se pisan {a} y {b}')

    def test_la_ruta_impresa_pasa_por_cada_punto(self):
        # Bajo cada galleta y cada parada hay tinta de la ruta (a 2 px como mucho): el papel no las dibuja, pero la ruta sí.
        for i in range(3):
            img = self.frames(f'paper-map-d{i}')[0].convert('RGBA')
            paper = _opaque_luma(img)
            for p in self.paper['stops'] + self.paper['trail']:
                near = [img.getpixel((x, y)) for x in range(p['x'] - 2, p['x'] + 3) for y in range(p['y'] - 2, p['y'] + 3)
                        if 0 <= x < PAPER[0] and 0 <= y < PAPER[1]]
                darkest = min(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b, a in near if a == 255) / 255
                self.assertLess(darkest, paper * 0.6, f'd{i}: no hay ruta bajo {p}')

    def test_el_papel_se_oscurece_de_d0_a_d2(self):
        lumas = [_opaque_luma(self.frames(f'paper-map-d{i}')[0]) for i in range(3)]
        for i in range(2):
            self.assertGreaterEqual(lumas[i] - lumas[i + 1], LUMA_STEP, f'd{i} → d{i + 1}: {lumas}')
        for i in range(3):
            img = self.frames(f'paper-map-d{i}')[0]
            top = _opaque_luma(img.crop((0, 0, PAPER[0], PAPER[1] // 2)))
            bottom = _opaque_luma(img.crop((0, PAPER[1] // 2, PAPER[0], PAPER[1])))
            self.assertLess(top, bottom, f'd{i}: la guarida (arriba) no está más oscura que el comienzo')

    def test_las_paradas_cerradas_son_siluetas_oscuras(self):
        for boss in BOSSES:
            opened = _opaque_luma(self.frames(f'paper-stop-{boss}-open')[0])
            locked = self.frames(f'paper-stop-{boss}-locked')[0]
            self.assertLess(_opaque_luma(locked), 0.35, f'{boss}: la silueta no es oscura')
            if boss != 'rey':       # el rey ya es una sombra violeta: su silueta solo tiene que seguir siendo oscura
                self.assertLess(_opaque_luma(locked), opened, boss)
            self.assertEqual(locked.getextrema()[3][0], 0, f'{boss}: sin transparencia')

    def test_la_silueta_cerrada_no_engorda_la_cara(self):
        # «La misma silueta»: ocupa justo lo opaco de la cara (sin un contorno extra que cierre las orejas finas).
        for boss in BOSSES:
            opened = self.frames(f'paper-stop-{boss}-open')[0]
            locked = self.frames(f'paper-stop-{boss}-locked')[0]
            solid = {i for i, p in enumerate(opened.getdata()) if p[3] == 255}
            self.assertEqual({i for i, p in enumerate(locked.getdata()) if p[3]}, solid, boss)

    def test_ni_quemado_ni_agujeros_junto_a_paradas_y_galletas(self):
        # Ni el borde quemado ni los agujeros llegan a menos de 3 px de la caja de una parada o una galleta.
        for i in range(3):
            px = self.frames(f'paper-map-d{i}')[0].load()
            for p, size in [(s, 20) for s in self.paper['stops']] + [(t, 10) for t in self.paper['trail']]:
                x0, y0 = p['x'] - size // 2 - 3, p['y'] - size // 2 - 3
                holes = [(x, y) for x in range(x0, x0 + size + 6) for y in range(y0, y0 + size + 6)
                         if 0 <= x < PAPER[0] and 0 <= y < PAPER[1] and px[x, y][3] == 0]
                self.assertEqual(holes, [], f'd{i}: quemado junto a {p}')

    def test_la_ardilla_tiene_cola_encima_y_no_mascara_clara(self):
        # No es un zorro: la cola se curva por encima de la cabeza (pelo en la fila 1, a la derecha) y lo claro es poco
        # (el hocico, las paletas y el brillo de los ojos; la máscara blanca del zorro pasaba de 50 px).
        img = self.frames('paper-stop-ardilla-open')[0]
        px = img.load()
        line = (0x2a, 0x1c, 0x18, 255)
        fur = [x for x in range(8, 19) if px[x, 1][3] == 255 and px[x, 1] != line]
        self.assertGreaterEqual(len(fur), 6, f'sin cola por encima de la cabeza: {fur}')
        light = sum(1 for r, g, b, a in img.getdata() if a == 255 and (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.8)
        self.assertLessEqual(light, 24, f'{light} px claros: vuelve la máscara del zorro')


if __name__ == '__main__':
    unittest.main()
