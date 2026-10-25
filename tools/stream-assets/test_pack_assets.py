"""
Pruebas de la manada del Chess Runner (`export_pack.py`).   ./.venv/bin/python -m unittest -v

Lo que importa (contrato en docs/personajes/ASSETS_SPEC.md): que cada personaje tenga sus 5 animaciones y su retrato,
una sola celda para todas, los pies en la base, el collar visible en cada cuadro, tallas dentro de la tabla, que
`pack.json` describa bien los PNG, que regenerar sea determinista y que lo versionado en la app coincida.
"""
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import export_pack
from pack_common import SIZE_ORDER, check, compare, frames_of
from pixel import C

# Los diez de la manada y el alto de su contenido (alto de celda − 1 px de holgura), según la tabla del contrato.
# Choco mide 40 de pie y 42 sentado (`dog_sit`, el `idle` del runner de siempre).
EXPECTED_HEIGHT = {
    'choco': (40, 42), 'tormenta': (38, 42), 'tony': (38, 42), 'kiana': (44, 48), 'zack': (44, 48),
    'nannukk': (53, 56), 'romeo': (34, 36), 'maryluna': (31, 34), 'luna': (29, 32), 'gatita': (27, 30),
}
ON_GROUND = [a for a in export_pack.REQUIRED if a not in export_pack.AIRBORNE]


def _opaque_colors(img):
    return {px[:3] for px in img.getdata() if px[3] == 255}


def _size(path):
    with Image.open(path) as im:
        return im.size


class _Built(unittest.TestCase):
    """Genera la manada una sola vez en una carpeta temporal para todas las pruebas de la clase."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls._tmp.name)
        cls.manifest = export_pack.build(cls.out)
        cls.chars = cls.manifest['characters']

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def frames(self, cid, anim):
        entry = self.chars[cid]
        return frames_of(Image.open(self.out / entry['animations'][anim]['file']).convert('RGBA'), entry['cellW'])


class Determinismo(_Built):
    def test_regenerar_da_los_mismos_pixeles(self):
        with tempfile.TemporaryDirectory() as b:
            export_pack.build(Path(b))
            self.assertEqual(compare(Path(b), self.out)[0], [])

    def test_lo_versionado_en_la_app_coincide(self):
        self.assertEqual(check(export_pack.build, export_pack.DEFAULT_OUT), 0)


class Manifiesto(_Built):
    def test_describe_cada_tira_con_su_celda_unica(self):
        for cid, entry in self.chars.items():
            for anim, a in entry['animations'].items():
                w, h = _size(self.out / a['file'])
                self.assertEqual((w, h), (entry['cellW'] * a['frames'], entry['cellH']), f'{cid}/{anim}')
            self.assertEqual(_size(self.out / entry['portrait']), export_pack.PORTRAIT, cid)

    def test_cada_uno_tiene_las_cinco_animaciones_con_sus_cuadros(self):
        for cid, entry in self.chars.items():
            self.assertEqual({a: v['frames'] for a, v in entry['animations'].items()}, export_pack.REQUIRED, cid)

    def test_no_sobra_ningun_archivo(self):
        files = {'pack.json'}
        for entry in self.chars.values():
            files |= {a['file'] for a in entry['animations'].values()} | {entry['portrait']}
        self.assertEqual({p.name for p in self.out.iterdir()}, files)

    def test_estan_los_diez(self):
        missing = sorted(set(EXPECTED_HEIGHT) - set(self.chars))
        extra = sorted(set(self.chars) - set(EXPECTED_HEIGHT))
        self.assertEqual(extra, [], 'personajes que no están en el contrato')
        if missing:
            self.skipTest(f'aún faltan en la manada: {", ".join(missing)}')


class Poses(_Built):
    def test_los_pies_quedan_en_la_ultima_fila_menos_en_el_salto(self):
        for cid, entry in self.chars.items():
            for anim in ON_GROUND:
                for i, f in enumerate(self.frames(cid, anim)):
                    last = [f.getpixel((x, f.size[1] - 1))[3] for x in range(f.size[0])]
                    self.assertTrue(any(last), f'{cid}/{anim}[{i}] no apoya los pies en la base')

    def test_en_el_salto_se_levantan_los_pies(self):
        for cid in self.chars:
            lifted = [not any(f.getpixel((x, f.size[1] - 1))[3] for x in range(f.size[0]))
                      for f in self.frames(cid, 'jump')]
            self.assertTrue(any(lifted), f'{cid}: ningún cuadro del salto despega del suelo')

    def test_ningun_cuadro_esta_vacio_ni_se_sale_de_la_celda(self):
        for cid, entry in self.chars.items():
            for anim in entry['animations']:
                for i, f in enumerate(self.frames(cid, anim)):
                    box = f.getbbox()
                    self.assertIsNotNone(box, f'{cid}/{anim}[{i}] vacío')
                    self.assertGreater(box[0], 0, f'{cid}/{anim}[{i}] toca el borde izquierdo')
                    self.assertLess(box[2], f.size[0], f'{cid}/{anim}[{i}] toca el borde derecho')
                    self.assertGreater(box[1], 0, f'{cid}/{anim}[{i}] toca el techo de la celda')

    def test_el_collar_se_ve_en_todos_los_cuadros_y_en_el_retrato(self):
        for cid, entry in self.chars.items():
            collar = C(entry['collar'])[:3]
            for anim in entry['animations']:
                for i, f in enumerate(self.frames(cid, anim)):
                    self.assertIn(collar, _opaque_colors(f), f'{cid}/{anim}[{i}] sin collar {entry["collar"]}')
            portrait = Image.open(self.out / entry['portrait']).convert('RGBA')
            self.assertIn(collar, _opaque_colors(portrait), f'{cid}: retrato sin collar')

    def test_los_collares_no_se_repiten(self):
        collars = [e['collar'].lower() for e in self.chars.values()]
        self.assertEqual(len(collars), len(set(collars)))

    def test_sin_negro_puro(self):
        for cid, entry in self.chars.items():
            for anim in entry['animations']:
                for f in self.frames(cid, anim):
                    self.assertNotIn((0, 0, 0), _opaque_colors(f), f'{cid}/{anim} usa negro puro')


class Tallas(_Built):
    def test_la_talla_es_una_de_las_conocidas(self):
        for cid, entry in self.chars.items():
            self.assertIn(entry['size'], SIZE_ORDER, cid)

    def test_el_alto_esta_dentro_de_la_tabla_del_contrato(self):
        for cid, entry in self.chars.items():
            lo, hi = EXPECTED_HEIGHT[cid]
            self.assertTrue(lo <= entry['cellH'] - 1 <= hi, f'{cid}: alto {entry["cellH"] - 1}, contrato {lo}–{hi}')

    def test_una_talla_mayor_no_es_mas_baja_ni_mas_corta(self):
        items = list(self.chars.items())
        for a, ea in items:
            for b, eb in items:
                if SIZE_ORDER.index(ea['size']) > SIZE_ORDER.index(eb['size']):
                    self.assertGreaterEqual(ea['cellH'], eb['cellH'], f'{a} ({ea["size"]}) más bajo que {b}')
                    self.assertGreaterEqual(ea['cellW'], eb['cellW'], f'{a} ({ea["size"]}) más corto que {b}')


if __name__ == '__main__':
    unittest.main()
