"""
Zack, de la familia husky de la manada: husky siberiano negro y blanco de ojos azules. Manto negro en el lomo y la nuca,
un gorro negro que baja en pico hasta el entrecejo y por detrás de la mejilla, el ojo azul hielo delineado en negro con
la «ceja» blanca encima, hocico, pecho, patas y vientre blancos, orejas paradas con el interior blanco y la cola
enroscada negra por encima y blanca por debajo. Collar violeta.

Cuerpo y poses: `pack_body_husky.py`. Fotos: `docs/local/referencias/zack-*.jpg`.
"""
import pack_body_husky as husky
from pixel import C

META = {'id': 'zack', 'name': 'Zack', 'family': 'husky', 'size': 'L',
        'collar': '#b46cff',
        'notes': 'husky negro y blanco: gorro en pico, ojos azules delineados, cejas blancas; collar violeta'}

PALETTE = husky.HuskyPalette(
    coat=C('#3b3a46'), coat_light=C('#646372'), coat_dark=C('#24232c'),
    white=C('#f5f4f1'), white_shade=C('#cfcdd4'), cap=C('#2e2d37'),
    ear=C('#2e2d37'), ear_inner=C('#e6e4ea'), tail=C('#3b3a46'), tail_under=C('#f5f4f1'),
    nose=C('#17161c'), eye=C('#15202c'), iris=C('#8fd3ff'), rim=C('#17161c'), brow=C('#ffffff'),
    mask=C('#2e2d37'),
    collar=C(META['collar']), collar_edge=C('#6a2fb0'), tag=C('#cfd8e6'), tag_mark=C('#7f8ea8'),
    outline=C('#111015'),
)

TRAITS = husky.HuskyTraits(size='L', face='peak', ear='mid', fluff=1, tail_curl=1)


def animations():
    return husky.animations(PALETTE, TRAITS)


def portrait():
    return husky.portrait(PALETTE, TRAITS)
