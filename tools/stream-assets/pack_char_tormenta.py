"""
Tormenta, de la familia lab de la manada: perrita canela claro de pelo corto, la más esbelta de las tres (patas algo más
largas y finas que Choco, aunque con el mismo estilo de mascota: cabezona y de tronco corto), con las orejas
medio caídas (paradas en la base y con la punta doblada hacia delante), hocico largo de nariz negra, garganta crema y la
cola fina en hoz hacia arriba. Collar amarillo.

Cuerpo y poses: `pack_body_lab.py`. Fotos: `docs/local/referencias/tormenta-*.jpg`.
"""
import pack_body_lab as lab
from pixel import C

META = {'id': 'tormenta', 'name': 'Tormenta', 'family': 'lab', 'size': 'M',
        'collar': '#ffd23f',
        'notes': 'canela claro de pelo corto, orejas medio caídas con la punta doblada, cola en hoz; collar amarillo'}

PALETTE = lab.LabPalette(
    body=C('#d9a868'), light=C('#ecc48c'), dark=C('#b3824a'),
    ear=C('#cf9a5a'), ear_fold=C('#a5713d'), ear_light=C('#e6b77c'), tail=C('#c99558'),
    muzzle=C('#d4a062'), muzzle_light=C('#f3dcb4'), nose=C('#231512'),
    chest=C('#f3ddb2'), chest_shade=C('#dcbf8c'),
    paw=C('#f0d6a8'), paw_far=C('#c9a272'),
    collar=C(META['collar']), collar_edge=C('#9a6a12'), tag=C('#cfd8e6'), tag_mark=C('#7f8ea8'),
    tongue=C('#ff8aa1'), tongue_shade=C('#e0587a'), outline=C('#3a2414'),
    eye=C('#2a1810'), lid=C('#3a2414'), lip=C('#8a5a2c'), head_rim=C('#c08f55'),
)

TRAITS = lab.LabTraits(ear='rose', coat='short', tail='sickle', leg_w=4, hip=28, depth=10,
                       neck=17, snout=22, head=(18, 16), trunk=4, happy_ear=1)


def animations():
    return lab.animations(PALETTE, TRAITS)


def portrait():
    return lab.portrait(PALETTE, TRAITS)
