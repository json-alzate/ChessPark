"""
La gatita, la única gata de la manada y la más pequeña de los diez: una calicó pálida, como la de la foto. Casi toda
blanca (cara, pecho, flanco y patas), con manchas melocotón apagadas y atigradas (la gorra de la cabeza, la oreja lejana
y la mitad delantera del lomo) y gris atigrado (la oreja cercana, la nuca, la mitad trasera del lomo, el anca y la cola
anillada). Orejas puntiagudas con el dentro rosa, ojos grandes color miel, nariz rosa. Collar celeste con un cascabel.

Cuerpo y poses: `pack_body_cat.py`. Foto: `docs/local/referencias/gatita-1.jpg`.
"""
import pack_body_cat as cat
from pixel import C

META = {'id': 'gatita', 'name': 'La gatita', 'family': 'cat', 'size': 'S',
        'collar': '#9be7ff',
        'notes': 'gatita calicó pálida: blanca con manchas melocotón y grises atigradas, orejas puntiagudas, ojos miel; '
                 'collar celeste con cascabel'}

PALETTE = cat.CatPackPalette(
    white=C('#f8f4ee'), white_shade=C('#d8d0c6'), white_far=C('#b8aea3'),
    orange=C('#e6ad78'), orange_light=C('#f3d0a8'), stripe=C('#c4844f'),
    grey=C('#8c8a92'), grey_dark=C('#56545e'), ear_far=C('#c99a70'), ear_inner=C('#f2a3ad'),
    nose=C('#ee8f9e'), eye=C('#21160f'), iris=C('#c98a34'), eye_white=C('#ffffff'),
    mouth=C('#6a3a34'), tongue=C('#ff8aa1'), cheek=C('#f4a7b0'),
    collar=C(META['collar']), collar_edge=C('#2f7aa3'), bell=C('#ffd24a'), bell_mark=C('#b07a12'),
    outline=C('#3a2a22'), lid=C('#3a2a22'),
)

BUILD = cat.BUILDS['kitten']


def animations():
    return cat.animations(PALETTE, BUILD)


def portrait():
    return cat.portrait(PALETTE, BUILD)
