"""
Luna, de la familia de los pequeños de la manada: chihuahua beige (leonado claro) de pelo liso, la más pequeña de los
perros. Cabeza de manzana, orejas enormes y paradas con el dentro rosa, ojos grandes, redondos y saltones, hocico corto
con la cara clara (canosa alrededor de los ojos y del hocico), nariz negra y redonda y la cola fina en hoz. Collar turquesa.

Cuerpo y poses: `pack_body_small.py`. Fotos: `docs/local/referencias/luna-*.jpg`.
"""
import pack_body_small as small
from pixel import C

META = {'id': 'luna', 'name': 'Luna', 'family': 'small', 'size': 'S',
        'collar': '#36d1c4',
        'notes': 'chihuahua beige de pelo liso, orejas enormes, ojos grandes y saltones, cara clara; collar turquesa'}

PALETTE = small.SmallPalette(
    body=C('#d7a062'), light=C('#e9bd84'), dark=C('#ad7a43'),
    ear=C('#d29a5c'), ear_inner=C('#eaa49b'), ear_light=C('#e9bd84'), tail=C('#cc955a'),
    muzzle=C('#ecd7b8'), muzzle_light=C('#f6e9d4'), nose=C('#1d1212'),
    chest=C('#ebc893'), chest_shade=C('#cf9f66'),
    paw=C('#ebc893'), paw_far=C('#a5733d'),
    collar=C(META['collar']), collar_edge=C('#127a72'), tag=C('#ffd24a'), tag_mark=C('#c08a1a'),
    outline=C('#3a2414'),
    face=C('#ead6b8'), ear_far=C('#b98446'), eye=C('#15100e'), eye_rim=C('#7a5640'), mouth_line=C('#8a5a3a'),
)

# el retrato se corre 2 px: la oreja enorme manda a la cara abajo a la derecha (abajo no se puede: el busto no llega)
TRAITS = small.SmallTraits(build='toy', ear='bat', coat='smooth', tail='sickle', eyes='big', far_ear=True,
                           portrait_shift=(2, 0))


def animations():
    return small.animations(PALETTE, TRAITS)


def portrait():
    return small.portrait(PALETTE, TRAITS)
