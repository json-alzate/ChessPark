"""
Nannukk, de la familia husky de la manada: alaskan malamute, la mayor y la más grande (talla XL). Esponjosa: silla
gris-negra en el lomo, manto gris acero y una franja canela ancha en el flanco y el muslo que lo separa del crema,
gorguera y pechera de mechones, «pantalones» en el anca, orejas pequeñas y redondeadas, gorro gris con la franja blanca
en la frente, la raya oscura que sale del ojo, ojos marrones y el plumero de la cola apoyado sobre el lomo: más claro
que el manto y con la mitad de abajo crema, para que se lea como un penacho aparte. Collar rosa.

Cuerpo y poses: `pack_body_husky.py`. Fotos: `docs/local/referencias/nannukk-*.jpg`. Boceto anterior: `dog_nannukk.py`.
"""
import pack_body_husky as husky
from pixel import C

META = {'id': 'nannukk', 'name': 'Nannukk', 'family': 'malamute', 'size': 'XL',
        'collar': '#ee6f86',
        'notes': 'alaskan malamute gris y crema, la mayor: esponjosa, franja blanca en la frente, plumero; collar rosa'}

PALETTE = husky.HuskyPalette(
    coat=C('#5d6068'), coat_light=C('#868a93'), coat_dark=C('#3c3e46'),
    white=C('#f1e9da'), white_shade=C('#d6bf9c'), cap=C('#565961'), tan=C('#c9a674'),
    ear=C('#4a4d55'), ear_inner=C('#e6cdb8'), tail=C('#8a8d96'), tail_under=C('#f1e9da'),
    tail_swirl=C('#a4a7ae'), saddle=C('#404249'),
    nose=C('#1c1819'), eye=C('#3a2418'), mask=C('#3c3e46'),
    collar=C(META['collar']), collar_edge=C('#a83a52'), tag=C('#ffd24a'), tag_mark=C('#c08a1a'),
    outline=C('#1f191c'), lid=C('#1f191c'),
)

TRAITS = husky.HuskyTraits(size='XL', face='blaze', ear='round', fluff=2, tail_curl=2)


def animations():
    return husky.animations(PALETTE, TRAITS)


def portrait():
    return husky.portrait(PALETTE, TRAITS)
