"""
Choco (Chocolate), el labrador de la manada: el mismo perro del runner de siempre.

No se redibuja: reutiliza las poses de `runner.dog_animations()` (cuerpo y paleta de `dog.py`), así que en el runner y en la
manada se ve idéntico. Solo añade el retrato de 32×32 para los botones y dos retoques, solo en la manada, para que
anime como los otros nueve (auditoría de coherencia P11): las estrellitas del choque en `hurt`, con el patrón y los colores
de `pack_body_lab._stars`, y el salto 5 px más bajo (sus pies subían 7/11/6 px; los de los demás, 2/5/1). En el pulido de
la noche, también como los demás: ojos en «^» en `happy` y el retrato 4 px más arriba.
"""
from PIL import ImageDraw

import dog as dog_mod
import runner
from pixel import C, layer, outlined

META = {'id': 'choco', 'name': 'Choco', 'family': 'lab', 'size': 'M',
        'collar': '#7fd35a', 'notes': 'labrador chocolate de hocico gris; collar verde con franja naranja'}


STAR, STAR_CORE = C('#fff4c2'), C('#ffc34d')
# Estrellitas de cada cuadro (lienzo de 52×40 de `runner`): sobre la frente y siguiendo la cabeza, que en el cuadro 1 baja
# 2 px; con aro de 1 px del contorno de Choco, como las de los otros nueve (auditoría P11-manada-r2).
STARS = (((31, 4), (38, 5)), ((34, 4), (41, 8)))
# Ojo de cada cuadro de `happy` (esquina de arriba del ojo de 3×4 de `dog._eye` en el lienzo de 52×40): se tapa con el pelo
# de la cabeza y se pinta el arco de `pack_body_lab._eye(…, 'happy')`.
HAPPY_EYES = ((35, 4), (35, 8))
JUMP_TRIM = 5               # filas vacías bajo los pies que se quitan al lienzo del salto (se apoya en la base de la celda)


def _with_stars(frame, f):
    w, h = frame.size
    sp = layer(w, h)
    d = ImageDraw.Draw(sp)
    for sx, sy in STARS[f]:
        d.line([(sx - 1, sy), (sx + 1, sy)], fill=STAR)
        d.line([(sx, sy - 1), (sx, sy + 1)], fill=STAR)
        d.point((sx, sy), fill=STAR_CORE)
    out = frame.copy()
    out.alpha_composite(outlined(sp, dog_mod.CHOCOLATE.outline).crop((1, 1, w + 1, h + 1)))
    return out


def _with_happy_eye(frame, f):
    ex, ey = HAPPY_EYES[f]
    p = dog_mod.CHOCOLATE
    out = frame.copy()
    d = ImageDraw.Draw(out)
    d.rectangle([ex, ey, ex + 2, ey + 3], fill=p.body)
    d.point((ex, ey + 2), fill=p.nose)
    d.line([(ex + 1, ey + 1), (ex + 2, ey + 1)], fill=p.nose)
    d.point((ex + 3, ey + 2), fill=p.nose)
    return out


def animations():
    anims = dict(runner.dog_animations(dog_mod.CHOCOLATE))
    frames, fps = anims['hurt']
    anims['hurt'] = ([_with_stars(fr, i) for i, fr in enumerate(frames)], fps)
    frames, fps = anims['happy']
    anims['happy'] = ([_with_happy_eye(fr, i) for i, fr in enumerate(frames)], fps)
    frames, fps = anims['jump']
    anims['jump'] = ([fr.crop((0, 0, fr.size[0], fr.size[1] - JUMP_TRIM)) for fr in frames], fps)
    return anims


def portrait():
    """Busto: cabeza, collar y pecho del perro sentado (`dog_sit`), centrados en 32×32 con el corte abajo."""
    sitting = dog_mod.dog_sit(0, palette=dog_mod.CHOCOLATE)
    bust = sitting.crop((9, 0, 41, 31))
    out = layer(32, 32)
    out.paste(bust, (0, 1), bust)   # la oreja arriba en y = 1–2 y el corte en el borde de abajo, como en los demás
    return out
