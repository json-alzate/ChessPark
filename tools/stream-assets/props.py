"""Objetos pequeños de la escena: pelota, hoyo, hueso, corazón, plato, mano."""
from PIL import ImageDraw

from pixel import C, R, layer, outlined


def ball():
    sp = layer(10, 10)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 0, 9, 9], fill=C('#e8473f'))
    d.arc([0, 0, 9, 9], 200, 330, fill=C('#fff4ec'))
    R(d, 2, 2, 3, 3, C('#ffb3a8'))
    return outlined(sp, C('#6d1c17'))


def hole(state='open'):
    """Hoyo que cava Chocolate: 'open', 'half' (cerrándose) o 'mound' (solo la tierra)."""
    sp = layer(34, 12)
    d = ImageDraw.Draw(sp)
    dirt, dirt2, pit = C('#9a6d44'), C('#b8885a'), C('#2a1a12')
    if state == 'mound':
        d.ellipse([2, 4, 30, 11], fill=dirt)
        d.ellipse([6, 3, 26, 9], fill=dirt2)
        return sp
    d.ellipse([0, 3, 33, 11], fill=dirt)
    d.ellipse([3, 4, 29, 10], fill=dirt2)
    d.ellipse([6, 5, 26, 10], fill=pit)
    if state == 'half':
        d.ellipse([6, 5, 26, 10], fill=dirt)
        d.ellipse([10, 6, 22, 10], fill=pit)
    return sp


def cookie():
    sp = layer(10, 10)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 0, 9, 9], fill=C('#d9a35a'))
    d.ellipse([1, 1, 7, 6], fill=C('#e8b86e'))
    for x, y in ((3, 3), (6, 5), (2, 6), (6, 2)):
        d.point((x, y), fill=C('#5a3320'))
    return outlined(sp, C('#6b4020'))


def bone():
    """El hueso que deja la mano en el plato."""
    sp = layer(16, 8)
    d = ImageDraw.Draw(sp)
    cream, shade = C('#f6ecd6'), C('#dccdab')
    R(d, 3, 2, 12, 5, cream)
    R(d, 3, 5, 12, 5, shade)
    for x0 in (0, 11):
        d.ellipse([x0, 0, x0 + 4, 3], fill=cream)
        d.ellipse([x0, 4, x0 + 4, 7], fill=shade)
    R(d, 4, 2, 10, 2, C('#ffffff'))
    return outlined(sp, C('#6b4a2a'))


def heart():
    rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
    sp = layer(7, 6)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '#':
                sp.putpixel((x, y), C('#ff5d7d'))
    sp.putpixel((1, 1), C('#ffd0da'))
    return outlined(sp, C('#8a1d3a'))


def plate():
    sp = layer(20, 8)
    d = ImageDraw.Draw(sp)
    d.ellipse([0, 2, 19, 7], fill=C('#c9ced6'))
    d.ellipse([1, 1, 18, 6], fill=C('#f5f7fa'))
    d.ellipse([4, 2, 15, 5], fill=C('#e1e6ec'))
    return sp


def hand_open():
    """La mano que asoma por la ventana de la casa."""
    sp = layer(28, 14)
    d = ImageDraw.Draw(sp)
    R(d, 0, 3, 10, 11, C('#4d6fb3'))
    R(d, 0, 3, 10, 4, C('#6b8fd0'))
    R(d, 10, 5, 18, 10, C('#f2c9a0'))
    R(d, 18, 3, 23, 11, C('#f2c9a0'))
    R(d, 23, 4, 25, 5, C('#f2c9a0'))
    R(d, 23, 7, 25, 8, C('#f2c9a0'))
    R(d, 22, 10, 24, 12, C('#f2c9a0'))
    return outlined(sp, C('#4a2f1e'))
