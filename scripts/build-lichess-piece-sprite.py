#!/usr/bin/env python3
"""Arma el sprite de cm-chessboard de un set de piezas de Lichess.

Lichess guarda cada set como 12 SVG sueltos (wK.svg ... bP.svg). cm-chessboard
quiere un único SVG con un <g id="wk"> por pieza, así que cada pieza se mete en
un <svg> anidado de 40x40 con su propio viewBox.

Todos los SVG comparten un solo documento, así que los ids y las clases CSS de
cada pieza se prefijan: si no, los degradados y los estilos de una pieza pisarían
a los de otra (p. ej. `.cls-2` cambia de color entre piezas en rhosgfx).

Uso: build-lichess-piece-sprite.py <carpeta-del-set-de-lila> <salida.svg> <autor> <licencia>
Las piezas de Lichess están en https://github.com/lichess-org/lila/tree/master/public/piece
"""
import re
import sys
from pathlib import Path

PIECES = [c + p for c in "wb" for p in "kqrbnp"]


def build_piece(text: str, prefix: str) -> str:
    root = re.search(r"<svg\b([^>]*)>", text, re.S)
    attrs = root.group(1)
    body = text[root.end():text.rindex("</svg>")]

    view_box = re.search(r'viewBox="([^"]+)"', attrs)
    if view_box:
        view_box = view_box.group(1)
    else:
        w = float(re.search(r'\bwidth="([\d.]+)', attrs).group(1))
        h = float(re.search(r'\bheight="([\d.]+)', attrs).group(1))
        view_box = f"0 0 {w:g} {h:g}"

    # Atributos de la raíz que hay que conservar (p. ej. el style de totoy)
    style = re.search(r'\sstyle="([^"]*)"', attrs)
    keep = ""
    if style:
        css = ";".join(p for p in style.group(1).split(";") if p.strip() and not p.strip().startswith("color-scheme"))
        if css:
            keep = f' style="{css}"'

    # ids y referencias
    ids = set(re.findall(r'\bid="([^"]+)"', body))
    for i in ids:
        body = re.sub(rf'\bid="{re.escape(i)}"', f'id="{prefix}{i}"', body)
        body = body.replace(f"url(#{i})", f"url(#{prefix}{i})")
        body = re.sub(rf'(href="#){re.escape(i)}"', rf'\g<1>{prefix}{i}"', body)

    # clases: se renombran en los atributos y en los selectores de <style>
    classes = set()
    for value in re.findall(r'\bclass="([^"]+)"', body):
        classes.update(value.split())
    for c in sorted(classes, key=len, reverse=True):
        body = re.sub(rf'(?<![\w-])\.{re.escape(c)}(?![\w-])', f".{prefix}{c}", body)
    body = re.sub(
        r'\bclass="([^"]+)"',
        lambda m: 'class="' + " ".join(prefix + c for c in m.group(1).split()) + '"',
        body,
    )
    return f'<svg width="40" height="40" viewBox="{view_box}"{keep}>{body}</svg>'


def main() -> None:
    src, out, author, license_ = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4]
    set_id = src.name.lower()
    groups = []
    for piece in PIECES:
        file = src / f"{piece[0]}{piece[1].upper()}.svg"
        svg = build_piece(file.read_text(), f"{set_id}-{piece}-")
        groups.append(f'  <g id="{piece}">{svg}</g>')
    out.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f"<!--\n  Set de piezas «{set_id}» de Lichess (https://github.com/lichess-org/lila/tree/master/public/piece/{src.name}).\n"
        f"  Autor: {author}. Licencia: {license_}.\n"
        "  Generado con scripts/build-lichess-piece-sprite.py para cm-chessboard.\n-->\n"
        '<svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" '
        'xmlns:xlink="http://www.w3.org/1999/xlink">\n' + "\n".join(groups) + "\n</svg>\n"
    )


main()
