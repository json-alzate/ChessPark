"""
Kiana, de la familia husky de la manada: husky siberiana rojiza (cobriza) y blanca. Manto cobrizo en el lomo, la nuca y
un gorro redondo en la cabeza que deja la cara blanca y abierta (sin antifaz oscuro), con una rayita cobriza que sale del
ojo; ojos ámbar y nariz color hígado. Orejas grandes y paradas, pecho, patas y vientre blancos, y la cola enroscada clara
por debajo. Collar azul.

Cuerpo y poses: `pack_body_husky.py`. Fotos: `docs/local/referencias/kiana-*.jpg`.
"""
import pack_body_husky as husky
from pixel import C

META = {'id': 'kiana', 'name': 'Kiana', 'family': 'husky', 'size': 'L',
        'collar': '#4fa3ff',
        'notes': 'husky cobriza y blanca: gorro redondo, cara blanca abierta, ojos ámbar, nariz hígado; collar azul'}

PALETTE = husky.HuskyPalette(
    coat=C('#c47548'), coat_light=C('#dd9a6b'), coat_dark=C('#9a5332'),
    white=C('#f7f2ea'), white_shade=C('#ddd0c4'), cap=C('#c47548'),
    ear=C('#c47548'), ear_inner=C('#f3d8c8'), tail=C('#e6bd98'), tail_under=C('#f7f2ea'),
    nose=C('#6b3a2c'), eye=C('#2a1810'), iris=C('#b8822f'), mask=C('#b0653c'),
    collar=C(META['collar']), collar_edge=C('#1f5fb0'), tag=C('#ffd24a'), tag_mark=C('#c08a1a'),
    outline=C('#3a2216'), mouth_line=C('#6b3a2c'),
)

TRAITS = husky.HuskyTraits(size='L', face='round', ear='tall', fluff=1, tail_curl=1)


def animations():
    return husky.animations(PALETTE, TRAITS)


def portrait():
    return husky.portrait(PALETTE, TRAITS)
