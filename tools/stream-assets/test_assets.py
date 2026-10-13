"""
Pruebas de los scripts de assets.   ./.venv/bin/python -m unittest -v

Cubren lo que más importa para que la escena pueda seguir creciendo sin romperse: que regenerar sea
determinista, que lo versionado en la app coincida con lo que generan los scripts, y que sumar un perro
nuevo solo con una paleta funcione.
"""
import dataclasses
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageChops

import dog as dog_mod
import export_assets


def same(a: Path, b: Path) -> bool:
    ia, ib = Image.open(a).convert('RGBA'), Image.open(b).convert('RGBA')
    return ia.size == ib.size and ImageChops.difference(ia, ib).getbbox(alpha_only=False) is None


class ExportAssets(unittest.TestCase):
    def test_regenerar_da_los_mismos_pixeles(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            export_assets.build(Path(a))
            export_assets.build(Path(b))
            for f in sorted(p.name for p in Path(a).glob('*.png')):
                self.assertTrue(same(Path(a) / f, Path(b) / f), f)

    def test_lo_versionado_en_la_app_coincide(self):
        self.assertEqual(export_assets.check(export_assets.DEFAULT_OUT), 0)

    def test_el_manifiesto_describe_cada_tira(self):
        with tempfile.TemporaryDirectory() as tmp:
            manifest = export_assets.build(Path(tmp))
            for name, sprite in manifest['sprites'].items():
                width, height = Image.open(Path(tmp) / sprite['file']).size
                self.assertEqual(width, sprite['frameW'] * sprite['frames'], name)
                self.assertEqual(height, sprite['frameH'], name)
            self.assertEqual(json.loads((Path(tmp) / 'scene.json').read_text()), manifest)

    def test_chocolate_conserva_el_prefijo_dog(self):
        names = export_assets.all_animations().keys()
        self.assertIn('dog-walk', names)
        self.assertNotIn('dogchocolate-walk', names)


class MasPerros(unittest.TestCase):
    def setUp(self):
        # Un perro nuevo = una paleta nueva. Se añade en memoria y se retira al terminar.
        bruno = dataclasses.replace(dog_mod.CHOCOLATE, body=(200, 160, 90, 255), ear=(150, 110, 60, 255))
        dog_mod.DOG_PALETTES['bruno'] = bruno
        self.addCleanup(dog_mod.DOG_PALETTES.pop, 'bruno')

    def test_genera_todas_sus_tiras_con_su_prefijo(self):
        names = set(export_assets.all_animations())
        for pose in ('sit', 'walk', 'run', 'bark', 'dig', 'sleep'):
            self.assertIn(f'dogbruno-{pose}', names)

    def test_tiene_las_mismas_medidas_que_chocolate(self):
        anims = export_assets.all_animations()
        for pose in ('sit', 'walk', 'run', 'bark', 'dig', 'sleep'):
            choc, bruno = anims[f'dog-{pose}'][0], anims[f'dogbruno-{pose}'][0]
            self.assertEqual([f.size for f in choc], [f.size for f in bruno], pose)

    def test_se_ve_distinto_a_chocolate(self):
        anims = export_assets.all_animations()
        self.assertIsNotNone(ImageChops.difference(anims['dog-walk'][0][0], anims['dogbruno-walk'][0][0]).getbbox(alpha_only=False))

    def test_no_altera_a_chocolate(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_assets.build(Path(tmp))
            self.assertTrue(same(Path(tmp) / 'dog-walk.png', export_assets.DEFAULT_OUT / 'dog-walk.png'))


if __name__ == '__main__':
    unittest.main()
