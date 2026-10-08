# Créditos de piezas y tableros

Los sets de piezas extra y los colores de tablero planos salen del repositorio de
Lichess ([lila](https://github.com/lichess-org/lila), carpeta `public/piece`).
Los sprites se generan con [`scripts/build-lichess-piece-sprite.py`](../scripts/build-lichess-piece-sprite.py)
y quedan en `apps/chessColate/src/assets/cm-chessboard/assets/pieces/`.

| Set | Autor | Licencia |
| --- | --- | --- |
| cburnett (`standard.svg`) | [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett) | GPLv2+ |
| fantasy, spatial, celtic | [Maurizio Monge](https://github.com/maurimo/chess-art) | MIT |
| chessnut | [Alexis Luengas](https://github.com/LexLuengas/chessnut-pieces) | Apache 2.0 |
| rhosgfx | [RhosGFX](https://rhosgfx.itch.io/) | CC0 1.0 |
| kiwen-suwi | [neverRare](https://github.com/neverRare) | CC BY 4.0 |
| firi | [James Faure](https://github.com/jfaure/Firi-pieceset) | CC BY 4.0 |
| totoy | Kosal Sen | CC BY 4.0 |
| papercut | [Nikolay Anzarov](https://nikoichu.itch.io/) | CC BY 4.0 |
| staunty | sadsnake1 | **CC BY-NC-SA 4.0 (no comercial)** |

Los sets con licencia CC BY exigen **atribución**: mostrar estos créditos en la app
(por ejemplo en una pantalla "Acerca de") antes de publicar.

## Lichess que no se trajeron, y por qué

- **No comerciales (CC BY-NC-SA)**: california, caliente, maestro, fresca, cardinal,
  icpieces, gioco, tatiana, dubrovny, anarcandy, disguised, cooke, monarchy, xkcd,
  minimal-warmth, horsey. No son compatibles con una app con donaciones.
- **No libres** (alpha, chess7, companion, leipzig, reillycraig, riohacha, shahi-ivory-brown).
- **Copyleft** (merida, mono, mpchess: GPL; letter, pixel, pirouetti: AGPL; shapes: CC BY-SA).
  Se pueden sumar si se acepta esa licencia.
- **Tableros con textura** (madera, mármol, cuero…): son imágenes AGPL y cm-chessboard
  pinta casillas planas. Solo se trajeron los colores de los tableros planos (los colores no tienen copyright).
