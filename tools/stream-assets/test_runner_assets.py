"""
Pruebas de los assets del Chess Runner.   ./.venv/bin/python -m unittest -v

Lo que importa: que regenerar sea determinista, que lo versionado en la app coincida con lo que generan los
scripts, que el manifiesto describa bien cada tira y que cada pose y efecto que el juego espera exista.
"""
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import export_runner
import runner

# Lo que el juego pide por nombre: si falta uno, el runner se rompe en ejecución
PIEZAS = ('pawn', 'rook', 'bishop', 'knight', 'queen', 'king')
POSES_DEL_PERRO = ('run', 'jump', 'hurt', 'happy', 'idle')


class Determinismo(unittest.TestCase):
    def test_regenerar_da_los_mismos_pixeles(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            export_runner.build(Path(a))
            export_runner.build(Path(b))
            for f in sorted(p.name for p in Path(a).glob('*.png')):
                self.assertTrue(export_runner.same_pixels(Path(a) / f, Path(b) / f), f)

    def test_lo_versionado_en_la_app_coincide(self):
        self.assertEqual(export_runner.check(export_runner.DEFAULT_OUT), 0)


class Manifiesto(unittest.TestCase):
    def test_describe_cada_tira_con_sus_medidas(self):
        with tempfile.TemporaryDirectory() as tmp:
            manifest = export_runner.build(Path(tmp))
            for name, sprite in manifest['sprites'].items():
                width, height = Image.open(Path(tmp) / sprite['file']).size
                self.assertEqual(width, sprite['frameW'] * sprite['frames'], name)
                self.assertEqual(height, sprite['frameH'], name)
            self.assertEqual(json.loads((Path(tmp) / 'runner.json').read_text()), manifest)


class Contenido(unittest.TestCase):
    def setUp(self):
        self.sprites = export_runner.all_sprites()

    def test_chocolate_tiene_todas_las_poses_que_usa_el_juego(self):
        for pose in POSES_DEL_PERRO:
            self.assertIn(f'dog-{pose}', self.sprites)

    def test_no_se_exportan_piezas_ni_pistas(self):
        # Las piezas del juego son las del set que el usuario eligió para el tablero, no estas
        self.assertEqual([n for n in self.sprites if n.startswith(('piece-', 'hint-'))], [])

    def test_estan_los_efectos_y_el_horizonte(self):
        self.assertEqual(len(self.sprites['fx-dust'][0]), 3)
        self.assertEqual(len(self.sprites['fx-spark'][0]), 3)
        self.assertIn('scene-skyline', self.sprites)

    def test_el_horizonte_se_repite_sin_costura(self):
        # Ninguna pieza del horizonte toca el borde del tile: al repetirlo no se cortan ni se pegan
        skyline = self.sprites['scene-skyline'][0][0]
        for x in (0, skyline.size[0] - 1):
            self.assertTrue(all(skyline.getpixel((x, y))[3] == 0 for y in range(skyline.size[1])), x)

    def test_las_piezas_del_horizonte_no_flotan_sobre_su_peana(self):
        # La base toca el borde de abajo del sprite y no hay filas vacías dentro de la silueta
        piezas = runner.piece_sprites()
        for kind in PIEZAS:
            sprite = piezas[f'piece-{kind}-w']
            filas = [any(sprite.getpixel((x, y))[3] for x in range(sprite.size[0])) for y in range(sprite.size[1])]
            primera = filas.index(True)
            self.assertTrue(all(filas[primera:]), f'{kind} tiene filas vacías dentro de su silueta')

    def test_las_poses_tienen_los_cuadros_que_espera_la_animacion(self):
        frames = {name: len(f) for name, (f, _fps) in self.sprites.items()}
        self.assertEqual(frames['dog-run'], 4)
        self.assertEqual(frames['dog-jump'], 3)  # subir, cima, bajar
        self.assertEqual(frames['dog-hurt'], 2)

    def test_las_celdas_de_chocolate_no_pasan_de_54_px_de_ancho(self):
        # La celda es de 52 px: la hitbox del juego (config del runner) se calcula sobre ella
        for pose in POSES_DEL_PERRO:
            frames, _ = self.sprites[f'dog-{pose}']
            self.assertLessEqual(max(f.size[0] for f in frames), 54, pose)

    def test_ningun_sprite_esta_vacio(self):
        for name, (frames, _fps) in self.sprites.items():
            for i, f in enumerate(frames):
                self.assertIsNotNone(f.getbbox(), f'{name}[{i}] está vacío')

    def test_los_dos_bandos_de_las_piezas_del_horizonte_se_distinguen(self):
        piezas = runner.piece_sprites()
        self.assertNotEqual(piezas['piece-pawn-w'].tobytes(), piezas['piece-pawn-b'].tobytes())

    def test_el_suelo_y_las_colinas_se_repiten_sin_costura(self):
        # Una tile repetible no puede tener salto entre su último y su primer píxel
        hills = runner.hills_tile()
        first, last = [hills.getpixel((x, 43)) for x in (0, hills.size[0] - 1)]
        self.assertEqual(first[3], 255)
        self.assertEqual(last[3], 255)
        top_first = next(y for y in range(hills.size[1]) if hills.getpixel((0, y))[3])
        top_last = next(y for y in range(hills.size[1]) if hills.getpixel((hills.size[0] - 1, y))[3])
        self.assertLessEqual(abs(top_first - top_last), 2)


if __name__ == '__main__':
    unittest.main()
