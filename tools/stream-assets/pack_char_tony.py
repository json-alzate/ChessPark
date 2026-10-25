"""
Tony, de la familia lab de la manada: perro negro de pelo largo con el pecho blanco (una franja que baja por el pecho),
hocico canoso, ojos color miel, orejas grandes dobladas a media altura y flecos en orejas, pecho, vientre, patas y en la
cola, que es un plumero. Puntas blancas en las patas. Collar naranja, con la corbatita de papel azul de una de sus fotos
colgando como chapita.

Cuerpo y poses: `pack_body_lab.py`. Fotos: `docs/local/referencias/tony-*.jpg`.
"""
import pack_body_lab as lab
from pixel import C

META = {'id': 'tony', 'name': 'Tony', 'family': 'lab', 'size': 'M',
        'collar': '#ff8a2b',
        'notes': 'negro de pelo largo con flecos y pecho blanco, hocico canoso, ojos miel; collar naranja y corbatita azul'}

PALETTE = lab.LabPalette(
    body=C('#35323e'), light=C('#5a5669'), dark=C('#1e1c25'),
    ear=C('#3b3846'), ear_fold=C('#1c1a22'), ear_light=C('#6a6679'), tail=C('#302d39'),
    muzzle=C('#4d4958'), muzzle_light=C('#aaa6b0'), nose=C('#15121a'),
    chest=C('#f2f0ec'), chest_shade=C('#c9c6c4'),
    paw=C('#35323e'), paw_far=C('#1e1c25'),
    collar=C(META['collar']), collar_edge=C('#b3501a'), tag=C('#6cc0ee'), tag_mark=C('#2a6fb0'),
    tongue=C('#ff8aa1'), tongue_shade=C('#e0587a'), outline=C('#110f15'),
    eye=C('#15121a'), iris=C('#a8702e'),
    fringe=C('#4a4657'), grizzle=C('#8a8693'), crease=C('#4a4657'), lid=C('#cfcbd8'), head_rim=C('#1e1c25'),
)

TRAITS = lab.LabTraits(ear='fold', coat='long', tail='plume', blaze=True, toes=True, grizzle=True, tie=True,
                       leg_edge=True, leg_w=5, hip=29, depth=11, neck=18, snout=22, head=(19, 17), trunk=4)


def animations():
    return lab.animations(PALETTE, TRAITS)


def portrait():
    return lab.portrait(PALETTE, TRAITS)
