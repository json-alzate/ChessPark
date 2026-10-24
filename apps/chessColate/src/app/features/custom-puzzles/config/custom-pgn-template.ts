/**
 * PGN de ejemplo que se enseña y se descarga desde la ayuda. Tiene que leerse
 * sin ningún problema: una prueba lo comprueba.
 *
 * Los comentarios entre llaves son parte del PGN (se ignoran al leer) y sirven de guía.
 */
export const CUSTOM_PGN_TEMPLATE = `[Event "Mate del pasillo"]
[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]
[PuzzleRating "900"]
[PuzzleThemes "mateIn1 backRankMate"]

{ El FEN es la posición ANTES de la jugada del rival. Aquí mueven las negras (a6) y eso se juega solo; tu solución empieza después. }
1... a6 2. Re8# *

[Event "Horquilla de caballo"]
[FEN "r3k3/7p/8/3N4/8/8/8/4K3 b q - 0 1"]
[PuzzleRating "1200"]
[PuzzleThemes "fork"]

{ Si la solución tiene varias jugadas, las del rival van en medio: h6 (rival, solo) Nc7+ (tú) Kd7 (rival, solo) Nxa8 (tú). }
1... h6 2. Nc7+ Kd7 3. Nxa8 *

[Event "Mate del pastor"]
[FEN "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3"]
[PuzzleRating "600"]
[PuzzleThemes "mateIn1"]

1... Nf6 2. Qxf7# *
`;
