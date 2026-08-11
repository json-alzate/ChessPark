import {
  buildGame,
  countPlies,
  parseGameHeader,
  parsePackHeaders,
  splitHeadersAndMoves,
  splitPgnGames,
} from './pgn';

/** Dos partidas seguidas, tal como vienen en los archivos de PGN Mentor. */
const PACK = `[Event "Tbilisi"]
[Site "Tbilisi"]
[Date "1945.??.??"]
[Round "?"]
[White "Sereda, Viktor"]
[Black "Petrosian, Tigran V"]
[Result "0-1"]
[WhiteElo ""]
[BlackElo ""]
[ECO "E60"]

1.d4 Nf6 2.Nf3 g6 3.g3 Bg7 0-1

[Event "Moscow"]
[Site "Moscow"]
[Date "1963.05.20"]
[Round "5"]
[White "Petrosian, Tigran V"]
[Black "Botvinnik, Mikhail"]
[Result "1-0"]
[WhiteElo "2600"]
[BlackElo "2610"]
[ECO "D94"]

1.d4 d5 2.c4 e6 1-0
`;

describe('splitPgnGames', () => {
  it('corta el archivo en una entrada por partida', () => {
    const games = splitPgnGames(PACK);

    expect(games).toHaveLength(2);
    expect(games[0]).toContain('Sereda');
    expect(games[1]).toContain('Botvinnik');
  });

  it('un archivo vacío no da partidas', () => {
    expect(splitPgnGames('')).toEqual([]);
  });
});

describe('splitHeadersAndMoves', () => {
  it('separa las etiquetas del texto de jugadas', () => {
    const { headers, movetext } = splitHeadersAndMoves(splitPgnGames(PACK)[0]);

    expect(headers['White']).toBe('Sereda, Viktor');
    expect(headers['Result']).toBe('0-1');
    expect(movetext).toBe('1.d4 Nf6 2.Nf3 g6 3.g3 Bg7 0-1');
  });
});

describe('countPlies', () => {
  it('cuenta jugadas con el número pegado, como las escribe PGN Mentor', () => {
    expect(countPlies('1.d4 Nf6 2.Nf3 g6 3.g3 Bg7 0-1')).toBe(6);
  });

  it('también con el número separado', () => {
    expect(countPlies('1. d4 Nf6 2. Nf3 g6 1/2-1/2')).toBe(4);
  });

  it('ignora el resultado y los símbolos de evaluación', () => {
    expect(countPlies('1.e4 $1 e5 *')).toBe(2);
  });

  it('sin jugadas devuelve cero', () => {
    expect(countPlies('')).toBe(0);
  });
});

describe('parseGameHeader', () => {
  const games = splitPgnGames(PACK);

  it('saca quién juega, evento, fecha y resultado', () => {
    const header = parseGameHeader(games[1], 1);

    expect(header.index).toBe(1);
    expect(header.white).toBe('Petrosian, Tigran V');
    expect(header.black).toBe('Botvinnik, Mikhail');
    expect(header.event).toBe('Moscow');
    expect(header.result).toBe('1-0');
    expect(header.year).toBe(1963);
    expect(header.whiteElo).toBe(2600);
  });

  it('deja el ELO en null cuando el PGN lo trae vacío', () => {
    const header = parseGameHeader(games[0], 0);

    expect(header.whiteElo).toBeNull();
    expect(header.blackElo).toBeNull();
  });

  it('entiende una fecha con el mes y el día en interrogantes', () => {
    const header = parseGameHeader(games[0], 0);

    expect(header.date).toBe('1945.??.??');
    expect(header.year).toBe(1945);
  });
});

describe('parsePackHeaders', () => {
  it('numera las partidas en el orden del archivo', () => {
    const { headers, games } = parsePackHeaders(PACK);

    expect(headers.map((h) => h.index)).toEqual([0, 1]);
    expect(games).toHaveLength(2);
  });
});

describe('buildGame', () => {
  const games = splitPgnGames(PACK);

  it('deriva una posición por jugada, más la inicial', () => {
    const game = buildGame(games[0], parseGameHeader(games[0], 0));

    expect(game).not.toBeNull();
    expect(game?.sanMoves).toEqual(['d4', 'Nf6', 'Nf3', 'g6', 'g3', 'Bg7']);
    expect(game?.fens).toHaveLength(7);
    expect(game?.fens[0]).toContain('rnbqkbnr/pppppppp');
  });

  it('anota las casillas de cada jugada, para resaltarlas', () => {
    const game = buildGame(games[0], parseGameHeader(games[0], 0));

    expect(game?.moveSquares).toHaveLength(6);
    expect(game?.moveSquares[0]).toEqual({ from: 'd2', to: 'd4' });
  });

  it('conserva la cabecera de la partida', () => {
    const game = buildGame(games[1], parseGameHeader(games[1], 1));

    expect(game?.header.white).toBe('Petrosian, Tigran V');
    expect(game?.header.plies).toBe(4);
  });

  it('devuelve null si la partida no tiene jugadas', () => {
    const onlyHeaders = '[Event "X"]\n[White "A"]\n[Black "B"]\n[Result "*"]\n\n*';

    expect(buildGame(onlyHeaders, parseGameHeader(onlyHeaders, 0))).toBeNull();
  });

  it('respeta una posición inicial no estándar', () => {
    const fromFen = `[Event "Estudio"]
[White "A"]
[Black "B"]
[Result "*"]
[SetUp "1"]
[FEN "8/8/8/8/8/5k2/6q1/7K b - - 0 1"]

1...Qg3 *`;

    const game = buildGame(fromFen, parseGameHeader(fromFen, 0));

    expect(game).not.toBeNull();
    expect(game?.fens[0]).toContain('8/8/8/8/8/5k2/6q1/7K');
  });
});
