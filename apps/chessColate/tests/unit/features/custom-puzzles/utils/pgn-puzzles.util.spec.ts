import { Chess } from 'chess.js';

import {
  checkPgnText,
  limitExercises,
  parsePgnExercises,
  parseRating,
  parseThemes,
  splitExercises,
  themeLabel,
} from '@features/custom-puzzles/utils/pgn-puzzles.util';

/** Mate del pasillo: el rival juega a6 (solo) y la solución es Re8#. */
const PASILLO = `[Event "Mate del pasillo"]
[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]
[PuzzleRating "900"]
[PuzzleThemes "mateIn1 backRankMate"]

1... a6 2. Re8# *`;

/** Horquilla: h6 (rival), Nc7+ (tú), Kd7 (rival), Nxa8 (tú). */
const HORQUILLA = `[Event "Horquilla"]
[FEN "r3k3/7p/8/3N4/8/8/8/4K3 b q - 0 1"]

1... h6 2. Nc7+ Kd7 3. Nxa8 *`;

describe('splitExercises', () => {
  it('corta el archivo en un ejercicio por bloque de etiquetas', () => {
    const ejercicios = splitExercises(`${PASILLO}\n\n${HORQUILLA}\n`);

    expect(ejercicios).toHaveLength(2);
    expect(ejercicios[0].headers['Event']).toBe('Mate del pasillo');
    expect(ejercicios[1].headers['Event']).toBe('Horquilla');
  });

  it('no necesita [Event]: basta una cabecera nueva tras haber visto jugadas', () => {
    const sinEvent = `[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 2. Re8# *\n[FEN "r3k3/7p/8/3N4/8/8/8/4K3 b q - 0 1"]\n\n1... h6 2. Nc7+ Kd7 3. Nxa8 *`;

    expect(splitExercises(sinEvent)).toHaveLength(2);
  });

  it('entiende los saltos de línea de Windows y la marca BOM del principio', () => {
    const windows = `﻿${PASILLO}\r\n\r\n${HORQUILLA}\r\n`.replace(/\n/g, '\r\n');

    const ejercicios = splitExercises(windows);

    expect(ejercicios).toHaveLength(2);
    expect(ejercicios[0].headers['FEN']).toBe('6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1');
  });

  it('un comentario de varias líneas con algo parecido a una cabecera no corta el ejercicio', () => {
    const conComentario = `[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 { nota\n[Foo "bar"]\nsigue } 2. Re8# *`;

    expect(splitExercises(conComentario)).toHaveLength(1);
  });

  it('un texto vacío o solo con espacios no tiene ejercicios', () => {
    expect(splitExercises('')).toEqual([]);
    expect(splitExercises('  \n\n  ')).toEqual([]);
  });

  it('desescapa las comillas dentro de un valor', () => {
    const [ejercicio] = splitExercises('[Event "El \\"gran\\" mate"]\n\n1. e4 *');

    expect(ejercicio.headers['Event']).toBe('El "gran" mate');
  });
});

describe('parsePgnExercises', () => {
  describe('un ejercicio válido', () => {
    const { puzzles, total, issues } = parsePgnExercises(PASILLO);
    const [puzzle] = puzzles;

    it('lo convierte en un puzzle con el FEN antes de la jugada del rival y las jugadas en UCI', () => {
      expect(total).toBe(1);
      expect(issues).toEqual([]);
      expect(puzzle.fen).toBe('6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1');
      expect(puzzle.moves).toBe('a7a6 e1e8');
    });

    it('toma el rating y los temas de las etiquetas', () => {
      expect(puzzle.rating).toBe(900);
      expect(puzzle.themes).toEqual(['mateIn1', 'backRankMate']);
    });

    it('rellena el resto de campos del puzzle con valores neutros', () => {
      expect(puzzle).toMatchObject({
        ratingDeviation: 0,
        popularity: 0,
        nbPlays: 0,
        gameUrl: '',
        openingFamily: '',
        openingVariation: '',
      });
    });

    it('su solución se puede jugar entera en el tablero, jugada a jugada', () => {
      const chess = new Chess(puzzle.fen);
      puzzle.moves.split(' ').forEach((uci) => {
        expect(() =>
          chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
        ).not.toThrow();
      });
      expect(chess.isCheckmate()).toBe(true);
    });
  });

  it('una solución de varias jugadas conserva las respuestas del rival en medio', () => {
    const { puzzles } = parsePgnExercises(HORQUILLA);

    expect(puzzles[0].moves).toBe('h7h6 d5c7 e8d7 c7a8');
  });

  it('sin [PuzzleRating] ni [PuzzleThemes] usa el rating y el tema por defecto', () => {
    const { puzzles } = parsePgnExercises(HORQUILLA);

    expect(puzzles[0].rating).toBe(1500);
    expect(puzzles[0].themes).toEqual(['custom']);
  });

  it('acepta [Rating] y [Themes] como alias', () => {
    const { puzzles } = parsePgnExercises(
      '[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n[Rating "1234"]\n[Themes "pin,fork"]\n\n1... a6 2. Re8# *'
    );

    expect(puzzles[0].rating).toBe(1234);
    expect(puzzles[0].themes).toEqual(['pin', 'fork']);
  });

  it('guarda [Site] como enlace solo si es una URL', () => {
    const conUrl = parsePgnExercises(`[Site "https://lichess.org/abc"]\n${PASILLO}`);
    const sinUrl = parsePgnExercises(`[Site "Madrid"]\n${PASILLO}`);

    expect(conUrl.puzzles[0].gameUrl).toBe('https://lichess.org/abc');
    expect(sinUrl.puzzles[0].gameUrl).toBe('');
  });

  it('ignora comentarios, variantes y símbolos de evaluación: solo cuenta la línea principal', () => {
    const { puzzles, issues } = parsePgnExercises(
      '[FEN "r3k3/7p/8/3N4/8/8/8/4K3 b q - 0 1"]\n\n1... h6 { rival } (1... a5 2. Nb6+) 2. Nc7+ $1 Kd7 3. Nxa8 *'
    );

    expect(issues).toEqual([]);
    expect(puzzles[0].moves).toBe('h7h6 d5c7 e8d7 c7a8');
  });

  it('el uid depende del contenido: el mismo ejercicio da siempre el mismo uid', () => {
    const una = parsePgnExercises(PASILLO).puzzles[0].uid;
    const otra = parsePgnExercises(`${PASILLO}\n`).puzzles[0].uid;

    expect(una).toBe(otra);
    expect(una).toMatch(/^pgn-[0-9a-z]+$/);
    expect(parsePgnExercises(HORQUILLA).puzzles[0].uid).not.toBe(una);
  });

  it('respeta el orden del archivo', () => {
    const { puzzles } = parsePgnExercises(`${HORQUILLA}\n\n${PASILLO}`);

    expect(puzzles.map((p) => p.moves)).toEqual(['h7h6 d5c7 e8d7 c7a8', 'a7a6 e1e8']);
  });

  describe('promociones y enroques', () => {
    it('anota la pieza de la promoción en la jugada UCI', () => {
      const { puzzles, issues } = parsePgnExercises(
        '[FEN "7k/P7/8/8/8/8/7r/K7 b - - 0 1"]\n\n1... Kg8 2. a8=Q+ Kh7 3. Qa7+ *'
      );

      expect(issues).toEqual([]);
      expect(puzzles[0].moves.split(' ')[1]).toBe('a7a8q');
    });

    it('lee un enroque como la jugada del rey (e1g1)', () => {
      const { puzzles, issues } = parsePgnExercises(
        '[FEN "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"]\n\n1... Kd7 2. O-O Ra7 3. Rf7+ *'
      );

      expect(issues).toEqual([]);
      expect(puzzles[0].moves.split(' ')[1]).toBe('e1g1');
    });
  });

  describe('ejercicios con problemas', () => {
    it('un FEN que no se entiende se anota y no impide el resto', () => {
      const { puzzles, issues, total } = parsePgnExercises(
        `[Event "Roto"]\n[FEN "esto no es un fen"]\n\n1... a6 2. Re8# *\n\n${PASILLO}`
      );

      expect(total).toBe(2);
      expect(puzzles).toHaveLength(1);
      expect(issues).toEqual([{ index: 1, title: 'Roto', code: 'invalid-fen' }]);
    });

    it('una jugada ilegal dice cuál es', () => {
      const { puzzles, issues } = parsePgnExercises(
        '[Event "Ilegal"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 2. Qh5 *'
      );

      expect(puzzles).toEqual([]);
      expect(issues).toEqual([{ index: 1, title: 'Ilegal', code: 'illegal-move', move: 'Qh5' }]);
    });

    it('unas jugadas mal escritas (una casilla que no existe) no se pueden leer', () => {
      const { puzzles, issues } = parsePgnExercises(
        '[Event "Mal escrito"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 2. Re9# *'
      );

      expect(puzzles).toEqual([]);
      expect(issues).toEqual([{ index: 1, title: 'Mal escrito', code: 'unreadable' }]);
    });

    it('sin jugadas no hay ejercicio', () => {
      const { issues } = parsePgnExercises('[Event "Vacío"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n*');

      expect(issues).toEqual([{ index: 1, title: 'Vacío', code: 'no-moves' }]);
    });

    it('con una sola jugada falta la solución', () => {
      const { issues } = parsePgnExercises(
        '[Event "Corto"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 *'
      );

      expect(issues).toEqual([{ index: 1, title: 'Corto', code: 'too-short' }]);
    });

    it('el mismo ejercicio repetido solo entra una vez', () => {
      const { puzzles, issues } = parsePgnExercises(`${PASILLO}\n\n${PASILLO}`);

      expect(puzzles).toHaveLength(1);
      expect(issues).toEqual([{ index: 2, title: 'Mate del pasillo', code: 'duplicate' }]);
    });

    it('numera los problemas según su lugar en el archivo, contando los válidos', () => {
      const { issues } = parsePgnExercises(
        `${PASILLO}\n\n[Event "B"]\n[FEN "x"]\n\n1... a6 2. Re8# *\n\n${HORQUILLA}\n\n[Event "D"]\n[FEN "y"]\n\n1. e4 *`
      );

      expect(issues.map((i) => [i.index, i.title])).toEqual([
        [2, 'B'],
        [4, 'D'],
      ]);
    });

    it('un ejercicio sin título se anota con el título vacío', () => {
      const { issues } = parsePgnExercises('[FEN "x"]\n\n1... a6 2. Re8# *');

      expect(issues[0].title).toBe('');
    });
  });

  describe('avisos (el ejercicio entra, pero se tocó)', () => {
    it('una línea que acaba en jugada del rival se recorta para acabar en la del usuario', () => {
      const { puzzles, notes, issues } = parsePgnExercises(
        '[Event "Larga"]\n[FEN "r3k3/7p/8/3N4/8/8/8/4K3 b q - 0 1"]\n\n1... h6 2. Nc7+ Kd7 *'
      );

      expect(issues).toEqual([]);
      expect(puzzles[0].moves).toBe('h7h6 d5c7');
      expect(notes).toEqual([{ index: 1, title: 'Larga', code: 'trailing-opponent-move-dropped' }]);
    });

    it('una línea de tres jugadas se queda en la del rival y la del usuario', () => {
      const { puzzles, issues } = parsePgnExercises(
        '[Event "Tres"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1"]\n\n1... a6 2. Kf1 a5 *'
      );

      expect(puzzles).toHaveLength(1);
      expect(issues).toEqual([]);
      // a6 (rival), Kf1 (tú) y a5 (rival, recortada)
      expect(puzzles[0].moves).toBe('a7a6 g1f1');
    });

    it('sin [FEN] parte de la posición inicial y lo avisa', () => {
      const { puzzles, notes } = parsePgnExercises('[Event "Apertura"]\n\n1. e4 e5 2. Nf3 Nc6 *');

      expect(puzzles[0].fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(puzzles[0].moves).toBe('e2e4 e7e5 g1f3 b8c6');
      expect(notes).toEqual([{ index: 1, title: 'Apertura', code: 'no-fen' }]);
    });
  });
});

describe('parseThemes', () => {
  it('separa por espacios, comas y puntos y comas, sin repetir', () => {
    expect(parseThemes('fork  pin,fork;mateIn2')).toEqual(['fork', 'pin', 'mateIn2']);
  });

  it('respeta mayúsculas y minúsculas: los ids del catálogo son camelCase', () => {
    expect(parseThemes('backRankMate')).toEqual(['backRankMate']);
  });

  it.each([undefined, '', '   '])('sin temas (%p) usa el tema por defecto', (valor) => {
    expect(parseThemes(valor)).toEqual(['custom']);
  });
});

describe('parseRating', () => {
  it('lee un número entero positivo', () => {
    expect(parseRating('1450')).toBe(1450);
  });

  it.each([undefined, '', 'alto', '0', '-300'])('usa el de por defecto con %p', (valor) => {
    expect(parseRating(valor)).toBe(1500);
  });

  it('el valor por defecto puede cambiarse', () => {
    expect(parseRating(undefined, 1200)).toBe(1200);
  });
});

describe('themeLabel', () => {
  it('prefiere el nombre del catálogo', () => {
    expect(themeLabel('fork', 'Ataque doble', 'Propio')).toBe('Ataque doble');
  });

  it('un tema que el catálogo no conoce se enseña tal cual lo escribió el usuario', () => {
    expect(themeLabel('mi-tema', undefined, 'Propio')).toBe('mi-tema');
    expect(themeLabel('mi-tema', '', 'Propio')).toBe('mi-tema');
  });

  it('el tema por defecto se enseña con el rótulo «Propio»', () => {
    expect(themeLabel('custom', undefined, 'Propio')).toBe('Propio');
  });
});

describe('checkPgnText', () => {
  it('acepta un PGN normal', () => {
    expect(checkPgnText(PASILLO, 1000)).toBeNull();
  });

  it('rechaza un texto vacío', () => {
    expect(checkPgnText('  \n ', 1000)).toBe('empty');
  });

  it('rechaza un texto más largo que el máximo', () => {
    expect(checkPgnText('a'.repeat(1001), 1000)).toBe('too-big');
  });

  it('rechaza lo que trae caracteres de control, como un archivo binario', () => {
    expect(checkPgnText('PK\u0003\u0004\u0000\u0000zip', 1000)).toBe('not-text');
  });
});

describe('limitExercises', () => {
  const lista = Array.from({ length: 7 }, (_, i) => ({ uid: `p${i}` })) as never[];

  it('no toca nada si cabe', () => {
    expect(limitExercises(lista, 7)).toEqual({ kept: lista, dropped: 0 });
  });

  it('se queda con los primeros y cuenta los que sobran', () => {
    const { kept, dropped } = limitExercises(lista, 5);

    expect(kept).toHaveLength(5);
    expect(dropped).toBe(2);
    expect(kept[0]).toBe(lista[0]);
  });
});
