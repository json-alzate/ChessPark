"""
Romeo, de la familia de los pequeños de la manada: perrito canela rojizo de pelo áspero (un cruce de terrier), el mayor
de los tres. Orejas pequeñas semicaídas (de botón, con la punta doblada hacia delante), cejas y barba de pelo áspero,
hocico canoso (las canas a los lados de la nariz y en la barbilla), nariz negra y la cola baja, recta y áspera. Collar rojo.

Cuerpo y poses: `pack_body_small.py`. Fotos: `docs/local/referencias/romeo-*.jpg`.
"""
import pack_body_small as small
from pixel import C

META = {'id': 'romeo', 'name': 'Romeo', 'family': 'small', 'size': 'S–M',
        'collar': '#e5483f',
        'notes': 'canela rojizo de pelo áspero, orejas semicaídas, cejas y barba, hocico canoso; collar rojo'}

PALETTE = small.SmallPalette(
    body=C('#c4773f'), light=C('#dc9a62'), dark=C('#97532a'),
    ear=C('#a65d2e'), ear_inner=C('#8b4a24'), ear_light=C('#e09a62'), tail=C('#b56a35'),
    muzzle=C('#c6a083'), muzzle_light=C('#dcc6b2'), nose=C('#22140f'),
    chest=C('#e0a874'), chest_shade=C('#b5703d'),
    paw=C('#d99a62'), paw_far=C('#87491f'),
    collar=C(META['collar']), collar_edge=C('#8e1f1c'), tag=C('#ffd24a'), tag_mark=C('#c08a1a'),
    outline=C('#3a1f10'),
    grizzle=C('#e6dbcf'), tuft=C('#e0a874'), tuft_dark=C('#b5906f'), beard=C('#d9cbbd'), head_rim=C('#a8622f'),
    ear_shadow=C('#4a2412'),
    leg=C('#cd8a51'), leg_far=C('#97532a'), eye=C('#1f120c'), mouth_line=C('#6d3a1d'), lid=C('#2a140a'),
)

TRAITS = small.SmallTraits(build='S–M', ear='semi', coat='wiry', tail='low', eyes='normal')


def animations():
    return small.animations(PALETTE, TRAITS)


def portrait():
    return small.portrait(PALETTE, TRAITS)
