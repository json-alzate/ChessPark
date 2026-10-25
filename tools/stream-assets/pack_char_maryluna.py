"""
Maryluna, de la familia de los pequeños de la manada: perrita crema de pelo hirsuto, con la cabeza, las orejas y unas
manchas del lomo en canela. Orejas grandes y paradas (el dentro oscuro y un mechón claro en la punta), cejas, barba y
mechones sueltos por todo el cuerpo, hocico blanco y la cola alta y peluda. Collar negro con una franja rosa, como en la
foto (en META va el rosa, que es lo que la distingue).

Cuerpo y poses: `pack_body_small.py`. Fotos: `docs/local/referencias/maryluna-*.jpg`.
"""
import pack_body_small as small
from pixel import C

META = {'id': 'maryluna', 'name': 'Maryluna', 'family': 'small', 'size': 'S',
        'collar': '#ff6fb0',
        'notes': 'crema de pelo hirsuto con cabeza y manchas canela, orejas paradas, barba; collar negro con franja rosa'}

PALETTE = small.SmallPalette(
    body=C('#efe2c6'), light=C('#fbf3e2'), dark=C('#c9b693'),
    ear=C('#c98744'), ear_inner=C('#6b3d21'), ear_light=C('#e6b47a'), tail=C('#e2c79c'),
    muzzle=C('#f4ecdb'), muzzle_light=C('#fbf7ee'), nose=C('#1d1515'),
    chest=C('#f8f0e0'), chest_shade=C('#d6c6a6'),
    paw=C('#f8f0e0'), paw_far=C('#bfae8e'),
    collar=C(META['collar']), collar_band=C('#221c22'), collar_edge=C('#2e2530'), tag=C('#cfd8e6'),
    tag_mark=C('#7f8ea8'), outline=C('#3d2a1a'),
    head=C('#d49352'), saddle=C('#d99d62'), face=C('#f1e6cf'), ear_far=C('#a86c34'),
    tuft=C('#fbf3e2'), tuft_dark=C('#d6c6a6'),
    eye=C('#1f140e'), mouth_line=C('#8a6a4a'), lid=C('#3d2a1a'),
)

TRAITS = small.SmallTraits(build='S', ear='prick', coat='shaggy', tail='flag', eyes='normal', face='muzzle',
                           far_ear=True)


def animations():
    return small.animations(PALETTE, TRAITS)


def portrait():
    return small.portrait(PALETTE, TRAITS)
